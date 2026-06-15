# 10 — 美术图集加载管线

> **定位**: 运行时美术资源打包与加载规范
> **依赖**: 05-presentation（渲染层级）、09-ai-art-redesign（美术资产规格）、06-technical（渲染管线）
> **状态**: 规范定稿 — 代码优先支持图集帧加载，实际图集产物按本文生成

---

## 1. 目标

将大量小尺寸 PNG 资源从“按文件逐张加载”改为“图集 PNG + JSON 帧索引”加载，减少关卡进入时的 HTTP 请求数和图片解码次数，同时保留现有程序化兜底。

运行时必须满足：

1. 业务层继续使用原始资源路径，如 `/art/units/unit_enemy_goblin_idle_0.png`。
2. 加载层根据图集 manifest 自动把原路径解析为图集帧。
3. manifest 缺失、图集图片未加载或美术资源关闭时，保持现有单图/程序化回退。
4. 图集只改变资源加载方式，不改变 ECS、碰撞、动画状态机和数值规则。

---

## 2. 适合打图集的资源

| 优先级 | 资源目录 | 当前数量 | 是否进图集 | 打包方式 | 原因 |
|--------|----------|----------|------------|----------|------|
| P0 | `public/art/units/` | 376 | 是 | 敌人/士兵等通用单位分包；玩家塔每塔一个图集 | 数量最大，战斗中重复使用；塔单独分包可减少单图集尺寸并便于按卡牌/建造预热 |
| P0 | `public/art/tiles/` + `public/art/decor/` | 15+ | 是 | 按主题拆分，地格与同主题装饰合包 | 地图入场和战斗场景高频使用；装饰物随主题预热，避免额外请求 |
| P1 | `public/art/fx/` | 12 | 是 | 全局 FX 图集 | 小图、透明背景、复用频繁 |
| P1 | `public/art/ui/` | 8 | 是 | 全局 UI 图集 | 小型 UI 件和 9-slice 源图可共用图集 |
| P1 | `public/art/buffs/` | 12 | 是 | 全局 icon 图集 | 图标尺寸统一，局外 UI 复用 |
| P1 | `public/art/card-icon/` | 12 | 是 | 全局 icon 图集 | 小图标适合与 Buff 图标同类合并 |
| P2 | `public/art/objectives/` | 3 | 是 | 并入全局 FX 或关卡核心图集 | 数量少，但水晶/传送门与战斗场景强相关 |
| P2 | `public/art/enemies/` | 24 | 视用途 | 图鉴专用图集或保持单图 | 图鉴大图不在战斗高频渲染路径，优先级低于单位帧 |
| P3 | `public/art/cards/` | 32 | 谨慎 | 局外卡牌图集，可按页面预加载 | 卡面插画较大，不宜和小图混包；收益主要在局外界面 |
| 不打 | `public/art/backgrounds/` / `public/art/bg/` | 10 | 否 | 保持独立 WebP/背景图 | 大图尺寸差异大，和小图混包会浪费显存并阻塞首屏 |

---

## 3. 图集分包规范

### 3.1 战斗关卡图集

每个关卡生成一个敌方单位图集：

```text
public/art/atlases/levels/level_01_enemies.png
public/art/atlases/levels/level_01_enemies.json
```

包含范围：

- 当前关卡 `waves[].enemies[].enemyType` 引用的所有敌人。
- 上述敌人的 `idle`、`move`、`attack`、`death`、`skill` 等实际存在帧。
- 当前关卡 Boss 和精英怪使用的同类帧。

不包含范围：

- 玩家塔、士兵、机关、生产建筑。
- 背景、卡牌插画、图鉴大图。
- 下一关才会出现的敌人。

### 3.2 全局战斗图集

```text
public/art/atlases/global/player_units.png
public/art/atlases/global/player_units.json
public/art/atlases/global/fx_objectives.png
public/art/atlases/global/fx_objectives.json
```

玩家塔按塔类型独立生成图集：

```text
public/art/atlases/towers/tower_arrow.png
public/art/atlases/towers/tower_arrow.json
```

每个塔图集只包含对应 `unit_tower_<type>_*` 的 `idle`、`attack`、`death` 帧。塔是建筑，不生成、不打包 `move` 帧。目标尺寸优先控制在 1024 以下，避免全部塔混入一个大图集。

`player_units` 仅包含士兵、机关、生产建筑等非塔玩家单位。它们跨关卡复用，不能按关卡重复打包。

`fx_objectives` 包含技能 FX、传送门、水晶、状态小图标等战斗通用资源。

### 3.3 主题图集

```text
public/art/atlases/themes/theme_meadow_tiles.png
public/art/atlases/themes/theme_meadow_tiles.json
```

每个主题一个场景图集，包含该主题所有地格与装饰物：

- `public/art/tiles/tile_<theme>_buildable.png`
- `public/art/tiles/tile_<theme>_path.png`
- `public/art/tiles/tile_<theme>_obstacle.png`
- `public/art/tiles/tile_<theme>_path_endpoint_spawn.png`
- `public/art/tiles/tile_<theme>_path_endpoint_crystal.png`
- `public/art/decor/decor_<theme>_<decor_id>_idle_<variant>.png`

装饰物进入主题图集的是静态变体，不是逐帧动画。`idle_<variant>` manifest key 必须完整保留，运行时按位置确定性选择其中一个 key；动态效果由运行时粒子实现，不能按时间轮播这些变体。

普通路径地格每个主题只保留一个方向无关图片：`tile_<theme>_path.png`。路径直线、转角、T 字、十字等形状一律由关卡路径格拼接表达，不生成、不打包 `straight_*`、`corner_*`、`tee_*`、`cross` 等方向变体。出生口和水晶端点可保留专用端点地格，但底纹必须与普通路径一致。

AI 资源流水线必须按“生成图片 -> 抠背景 -> 打包图集”的顺序执行。项目入口为 `npm run art:pipeline`：

- 默认调用 `scripts/generate-ai-art-assets.mjs` 生成缺失资源，再处理背景，最后调用 `npm run build:atlases`。
- `--skip-generate` 用于复用已有图片，只执行背景处理和图集重建。
- `--target=<path>` 指定抠背景范围，装饰物默认处理 `public/art/decor`。
- 抠背景基于图片边缘采样，只移除与边缘连通的白色、棋盘、地格或其他生成背景，避免误删物件内部高光。

### 3.4 局外 UI 图集

```text
public/art/atlases/ui/ui_common.png
public/art/atlases/ui/ui_common.json
public/art/atlases/ui/icons_common.png
public/art/atlases/ui/icons_common.json
```

UI 基础件、Buff 图标、卡牌小图标适合进图集。卡牌插画体积较大，只有在局外页面请求数成为瓶颈时再按页面拆图集。

---

## 4. Manifest 格式

运行时统一读取入口：

```text
public/art/atlases/index.json
```

格式：

```json
{
  "atlases": [
    {
      "id": "level_01_enemies",
      "image": "/art/atlases/levels/level_01_enemies.png",
      "frames": {
        "/art/units/unit_enemy_goblin_idle_0.png": { "x": 0, "y": 0, "w": 96, "h": 96 },
        "/art/units/unit_enemy_goblin_idle_1.png": { "x": 96, "y": 0, "w": 96, "h": 96 }
      }
    }
  ]
}
```

字段规则：

| 字段 | 说明 |
|------|------|
| `id` | 图集唯一 ID，使用小写 snake_case |
| `image` | 图集 PNG 路径，必须以 `/art/atlases/` 开头 |
| `frames` | key 必须是旧单图资源路径，保证业务层无需改路径 |
| `x/y/w/h` | 帧在图集 PNG 内的像素源矩形 |
| `sourceW/sourceH` | 预留字段；当前运行时不做 trim offset 重建，逻辑尺寸按 `w/h` 计算 |

---

## 5. 压缩格式规范

图集减少请求数，压缩格式减少传输体积和解码成本。两者必须配合使用。

| 资源类型 | 推荐格式 | 推荐输出尺寸 | 说明 |
|----------|----------|--------------|------|
| 战斗单位帧 | WebP | 普通/中型单位 256×256；Boss 可 384×384 或 512×512 | 当前 256×256 PNG 已可用，优先转 WebP 后再入图集 |
| 地格 | WebP | 128×128 或 256×256 | 运行时地格通常按 64px 绘制，1024×1024 源图必须降尺寸 |
| 技能 FX | WebP | 256×256；大范围特效最多 512×512 | 当前多数 1024×1024 PNG 过大，需降尺寸 |
| UI 面板/按钮/卡框 | WebP 或 PNG | 按 9-slice 实际需要输出，通常不超过 512px 长边 | 若 WebP 边缘出现压缩色带，关键 9-slice 可保留 PNG |
| Buff/Icon/Card icon | WebP | 128×128 或 256×256 | 当前部分 card-icon 超过 1000px，必须降尺寸 |
| 卡牌插画 | WebP | 256×256 或 512×512 | 图鉴/手牌显示尺寸较小，1024×1024 原图不应直接运行时加载 |
| 图鉴敌人大图 | WebP | 256×256 或 512×512 | 图鉴卡内显示约 100×84，除详情页外不需要 1024 源图 |
| 背景 | WebP | 1920×1080 | 保持独立文件，不进小图图集 |

编码建议：

1. 默认使用 WebP `q=80` 作为运行时资源，视觉检查通过后再入库。
2. 带透明边缘的单位、FX、UI 使用 WebP alpha；若出现黑边或毛边，再单独提高质量或保留 PNG。
3. AVIF 体积可能更小，但解码成本和兼容风险更高，本项目运行时默认不采用。
4. `public/art` 只放运行时尺寸资源；AI 生成源图和高清原始素材应进入独立源素材目录，不参与游戏加载。

---

## 6. 打包约束

1. 单张图集最大边长 2048；移动端或低端设备优先控制在 1024。塔图集必须每塔一张，打包宽度上限为 1024，6 个 256×256 帧通常排为 2 行，单张尺寸约 776×518（含 padding），不得再与其他单位混包。主题图集必须合并同主题地格和场景装饰，禁止把装饰物另拆为全局图集。
2. 帧间 padding 至少 2px，使用透明像素扩边，避免线性采样串色。
3. 同一图集内尽量保持资源尺寸接近，禁止把 1920×1080 背景和 64×64 图标混包。
4. 透明 PNG 使用 premultiplied alpha 兼容输出，禁止带黑边。
5. 本阶段禁止启用 trim 透明裁剪；帧矩形必须保留原图逻辑尺寸，避免单位锚点、9-slice 和宽高比失真。
6. 输出 manifest key 必须保留原路径，不能改成短名。
7. 图集产物允许重复帧去重，但 manifest key 仍要完整保留。
8. 每次新增、删除、重命名美术资源后必须重新生成 `index.json`。
9. 路径地格方向变体属于废弃资源；资源生成脚本和图集打包脚本都不得重新引入。

---

## 7. 加载策略

运行时加载顺序：

1. 启动后尝试读取 `/art/atlases/index.json`。
2. 关卡开始时根据关卡 ID 预热当前关卡敌人图集、主题地格图集和全局战斗图集。
3. 渲染时上层仍请求原资源路径。
4. `imageCache` 若命中 manifest，则返回图集图片和源矩形。
5. 未命中 manifest 时回退到原单 PNG。
6. 美术资源开关关闭时，不加载图集也不加载单图，直接走程序化兜底。

---

## 8. 验收标准

1. 无图集产物时，现有美术资源表现不变。
2. 有图集 manifest 时，同一路径绘制结果来自图集源矩形。
3. `RenderSystem`、`UISystem`、技能特效、入场动画均支持图集帧。
4. 关闭美术资源开关后，图集和单图均不绘制，战斗逻辑不受影响。
5. 新增图集不要求改单位配置、关卡 YAML 或 UI 业务代码。
6. 压缩后的运行时资源必须通过视觉检查，不允许出现明显透明毛边、UI 边缘色带或关键轮廓糊成一团。
