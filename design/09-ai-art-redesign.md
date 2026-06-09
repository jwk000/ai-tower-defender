# 09 — AI 美术重设计需求与提示词

> **定位**: 美术生产规格 — 用 AI 生成整套暗黑休闲塔防美术资产
> **依赖**: 03-units（单位/卡牌/Buff 列表）、04-levels（关卡主题）、05-presentation（UI 与渲染层级）、08-art-assets（历史素材清单）
> **状态**: 需求定稿 — 后续资产生成与接入以本文为准

---

## 1. 目标

本次美术重设计目标是用 AI 生成图片资产，替换或覆盖当前以几何绘制为主的低细节外观，提升整体美术品质，同时保留塔防战斗的清晰辨识度。

覆盖范围：

1. 所有卡牌：塔、士兵、机关、技能、奥术、生产建筑。
2. 所有单位：玩家塔、士兵、机关、生产建筑、敌人、Boss、中立目标。
3. 所有技能、Buff 与状态：卡牌技能、敌人技能、关间 Buff、战斗状态标记。
4. 所有场景地格：可建造地、路径、障碍、出生点、基地、水晶、关卡主题装饰。
5. 所有 UI：HUD、手牌、卡牌详情、暂停、胜负、抽卡、Buff 选择、图鉴、选关、按钮、图标。
6. 动画与特效：每个单位每个状态最多 2 帧动作，关键攻击与技能用轻量特效补足表现。

---

## 2. 美术方向

### 2.1 风格关键词

整体风格为 **暗黑奇幻 + 休闲可读** 。

必须同时满足：

- 暗黑主题：深色底、冷暖强对比、黑铁、残月、深渊、腐蚀、符文、暗金边框。
- 休闲玩法：形体圆润、边缘清楚、角色不恐怖血腥、颜色编码直观、信息一眼可读。
- 塔防视角：45 度轻俯视或正侧混合，不做复杂透视，不做写实电影海报。
- 低复杂度场景：地格和场景图片不能喧宾夺主，棋盘路径、可放置区、单位轮廓始终清楚。

### 2.2 全局禁止项

AI 出图与后处理必须避免：

- 文字、数字、水印、Logo、UI 文案直接烘焙进图片。
- 过度写实、过多噪点、复杂背景、角色五官细节过密。
- 单位与地面颜色过近，导致战斗中难以识别。
- 大面积纯黑导致透明边缘或暗部丢失。
- 画面血腥、恐怖肢体、强成人向元素。
- 资产自带投影方向混乱；投影应由运行时统一处理。

### 2.3 通用正向提示词

```text
dark fantasy casual tower defense game art, stylized 2D sprite, readable silhouette, clean bold shapes, high contrast rim light, dark navy background mood, subtle hand-painted texture, clear color coding, mobile game friendly, no text, no watermark, no logo
```

### 2.4 通用负向提示词

```text
photorealistic, cinematic poster, complex background, tiny details, horror gore, realistic blood, messy silhouette, blurry, low contrast, text, letters, numbers, watermark, logo, extra limbs, distorted weapon, cropped subject
```

---

## 3. 资产规格

### 3.1 文件格式与命名

| 类别 | 路径 | 命名 |
|------|------|------|
| 卡牌插画 | `public/art/cards/` | `card_<card_id>.png` |
| 单位精灵 | `public/art/units/` | `unit_<unit_id>_<state>_<frame>.png` |
| 技能特效 | `public/art/fx/` | `fx_<skill_or_effect_id>_<frame>.png` |
| Buff 图标 | `public/art/buffs/` | `buff_<buff_id>.png` |
| UI 元素 | `public/art/ui/` | `ui_<surface>_<part>.png` |
| 地格 | `public/art/tiles/` | `tile_<theme>_<tile_type>.png` |
| 场景装饰 | `public/art/decor/` | `decor_<theme>_<decor_id>.png` |
| 背景 | `public/art/backgrounds/` | `bg_<theme>_<layer>.png` |

### 3.2 尺寸标准

| 类别 | 尺寸 | 透明背景 | 说明 |
|------|------|----------|------|
| 卡牌整卡背景 | 240×336 | 是 | 120×168 的 2x 资产 |
| 卡牌插画 | 192×160 | 否 | 卡面上半区，暗底可保留 |
| 小型单位 | 96×96 | 是 | 普通敌人、士兵、机关 |
| 中型单位 | 128×128 | 是 | 塔、生产建筑、精英怪 |
| Boss 单位 | 192×192 | 是 | Boss 与大型中立目标 |
| 技能/爆炸特效 | 128×128 或 256×256 | 是 | 可做 2 帧或 4 帧，MVP 按 2 帧 |
| Buff/状态图标 | 64×64 | 是 | UI 与单位头顶复用 |
| UI 图标 | 48×48 | 是 | 运行时可缩放到 16/24/32 |
| UI 面板九宫格 | 512×512 | 是 | 作为 9-slice 源图 |
| 按钮九宫格 | 384×128 | 是 | 普通/悬停/按下/禁用四状态可复用 |
| 地格 | 128×128 | 否 | 64×64 的 2x 资产 |
| 战斗背景 | 1920×1080 | 否 | 分层时用 far/mid/overlay |

### 3.3 动画状态规则

每个单位每个状态最多 2 帧。帧差必须明显但不能改变单位轮廓和碰撞感。

| 状态 | 帧数 | 适用对象 | 动作要求 |
|------|------|----------|----------|
| `idle` | 2 | 所有单位 | 呼吸、浮动、晶体闪烁、齿轮轻转 |
| `move` | 2 | 敌人、士兵、飞行召唤物 | 左右脚/翼位/身体前倾切换 |
| `attack` | 2 | 有攻击能力单位 | 蓄力帧 + 释放帧 |
| `hit` | 2 | 可受击单位 | 普通帧 + 受击高亮/压缩帧 |
| `death` | 2 | 敌人、士兵、塔、建筑 | 完整帧 + 破碎/消散帧 |
| `skill` | 2 | Boss、精英、法师类单位 | 施法蓄光 + 符文爆发 |
| `disabled` | 2 | 可被眩晕/冰冻单位 | 普通帧 + 状态覆盖帧 |

---

## 4. 卡牌美术需求

卡牌资产必须同时生成 **卡牌插画** 与 **整卡 UI 皮肤** 。插画负责识别单位/技能，整卡皮肤负责稀有度和类型。

### 4.1 卡牌 UI 结构

| 区域 | 美术要求 |
|------|----------|
| 外框 | 黑铁材质，稀有度发光边；圆角不超过 8px |
| 插画窗 | 暗底、有微弱景深，不能和外框粘连 |
| 类型角标 | 单位/法术/奥术/陷阱/生产 5 套小图标 |
| 费用徽章 | 暗金圆形或菱形底，不烘焙数字 |
| 名称条 | 暗色条 + 细亮边，不烘焙文字 |
| 描述区 | 简洁深色底纹，保证运行时文字可读 |

### 4.2 卡牌通用提示词

```text
dark fantasy casual tower defense card illustration, {subject}, centered heroic icon composition, strong readable silhouette, dark navy vignette background, {main_color} accent glow, subtle hand-painted texture, high contrast rim light, 192x160 game card art, no text, no frame, no watermark
```

### 4.3 卡牌清单与插画提示词

| 卡牌 | 类型 | 主视觉 | AI 提示词主体 |
|------|------|--------|---------------|
| 箭塔 | 塔 | 弓臂塔、发光箭矢 | `wood and black iron arrow tower with twin bow arms, glowing cyan arrow loaded upward, small quiver silhouettes` |
| 炮塔 | 塔 | 黑铁炮管、橙色爆口 | `heavy black iron cannon tower, round barrel, orange muzzle flare, chunky armor plates` |
| 冰塔 | 塔 | 冰晶尖塔、霜雾 | `jagged ice crystal tower, pale blue frost mist, snowflake shards around the top` |
| 闪电塔 | 塔 | 特斯拉线圈、电弧 | `tesla coil lightning tower, yellow electric arcs, copper antenna, glowing coil crown` |
| 激光塔 | 塔 | 蓝色晶体、持续光束 | `arcane laser tower with cyan crystal core, thin purple beam charging upward, orbiting light dots` |
| 暗夜塔 | 塔 | 蝙蝠翼、红眼核心 | `gothic bat tower, purple bat wings, single red eye core, small bat silhouettes` |
| 弩塔 | 塔 | 重弩、蓝色穿透箭 | `heavy ballista tower, wide crossbow arms, oversized blue energy bolt, siege base` |
| 导弹塔 | 塔 | 发射架、尾焰 | `missile launch tower, angled launch tubes, one missile lifting off with orange flame trail` |
| 火塔 | 塔 | 火焰塔、余烬 | `flame tower made of stacked fire shapes, orange red ember sparks, molten base` |
| 毒塔 | 塔 | 毒囊、绿雾 | `toxic alchemy tower, green venom sac, dripping poison drops, sickly mist` |
| 剑士 | 士兵 | 长剑前排 | `brave swordsman, red steel highlights, broad stance, raised long sword` |
| 弓箭手 | 士兵 | 兜帽拉弓 | `green hooded archer drawing a bow, arrow aimed forward, agile silhouette` |
| 盾卫 | 士兵 | 塔盾短剑 | `armored shield guard, large cyan tower shield, short sword, defensive stance` |
| 牧师 | 士兵 | 白袍治疗 | `white robed priest, golden healing staff, soft holy aura, calm support pose` |
| 工程师 | 士兵 | 扳手齿轮 | `orange hard hat engineer, large wrench, small gears and repair sparks` |
| 刺客 | 士兵 | 双匕首暗影 | `shadow assassin with twin purple daggers, crouched stealth pose, smoke trail` |
| 法师 | 士兵 | 尖帽法杖 | `purple mage with pointed hat, glowing staff crystal, swirling arcane orb` |
| 地刺 | 机关 | 三根尖刺 | `three dark metal spikes bursting from cracked ground, trap mechanism visible` |
| 捕兽夹 | 机关 | 张开夹齿 | `open bear trap with jagged metal jaws, central trigger plate, dark iron` |
| 焦油坑 | 机关 | 黏稠黑池 | `bubbling black tar pit, sticky tendrils, viscous dark surface` |
| 巨石 | 机关 | 裂纹巨石 | `large cracked grey boulder, heavy obstacle silhouette, small stone fragments` |
| 火球术 | 技能 | 飞行火球 | `massive flaming fireball, spiral flames and ember trail, impact energy` |
| 剑雨 | 技能 | 箭矢雨 | `rain of sharp arrows falling from above, stormy dark sky, bright metal arrowheads` |
| 暴风雪 | 技能 | 冰晶旋涡 | `blizzard vortex, swirling snow, blue white ice shards, freezing wind spiral` |
| 炸弹 | 技能 | 黑色圆弹 | `round black bomb with lit fuse, sparks and imminent explosion glow` |
| 紧急防护 | 奥术 | 水晶护盾 | `red crystal protected by blue shield bubble, hexagonal barrier pattern` |
| 箭术精通 | 奥术 | 强化箭矢 | `single arrow empowered by green magical runes, precision aura` |
| 坚韧守护 | 奥术 | 金色盾牌 | `golden reinforced shield, radiant protective ward, sturdy dark metal rim` |
| 淘金热 | 奥术 | 金币爆发 | `pile of gold coins sparkling, dark fantasy treasure glow, bouncing coin shapes` |
| 疾风步 | 奥术 | 风之靴 | `boots surrounded by cyan wind trails, swift movement effect, curved speed lines` |
| 金矿 | 生产 | 暗金矿井 | `small dark gold mine building, glowing ore vein, mine cart silhouette` |
| 能量塔 | 生产 | 蓝紫能量尖塔 | `arcane energy tower, blue violet crystal battery, pulsing mana ring` |

---

## 5. 单位美术需求

### 5.1 玩家单位形体语言

| 类别 | 外观规则 |
|------|----------|
| 塔 | 底座稳定、上部武器明确；攻击方向通过炮管、弓臂、晶体或线圈表达 |
| 士兵 | 头身约 1:2.2，武器大于真实比例；休闲化圆角护甲，避免复杂脸部 |
| 机关 | 与地格贴合，轮廓低矮；触发前后差异明显 |
| 生产建筑 | 与战斗塔区分，使用矿车、齿轮、能量罐等经济符号 |

### 5.2 玩家单位通用提示词

```text
dark fantasy casual tower defense unit sprite, {unit_subject}, 3/4 top-down view, centered full body, transparent background, clean bold silhouette, chunky readable shapes, {main_color} accent glow, 2D hand-painted game sprite, 128x128, no text, no shadow baked into image
```

动画帧提示词追加：

```text
animation frame {frame}/2 for {state}, same character design and same camera, only small pose change, sprite sheet consistency, transparent background
```

### 5.3 敌人单位美术分组

敌人数量较多，按主题阵营生成统一套系，并保证每个 `unit_id` 都有独立标志物。所有敌人必须至少交付 `idle_0`、`idle_1`、`move_0`、`move_1`、`attack_0`、`attack_1`、`hit_0`、`death_1`。

| 敌人组 | 代表单位 | 视觉主题 | 提示词主体 |
|--------|----------|----------|------------|
| 基础军团 | 小兵、快兵、重装兵、指挥官、攻城兽 | 红黑盔甲、邪恶军团 | `evil red black armored minion, simple helmet, glowing red eyes, readable weapon silhouette` |
| 虫族 | 钻地蠕虫、蝗虫群、地走虫、腐蚀炮虫、巨甲虫、母虫、虫族女王 | 甲壳、毒液、虫洞 | `dark insectoid enemy, chitin armor plates, acid green highlights, mandibles, casual readable shape` |
| 冰霜族 | 寒霜劫掠者、冰霜女巫、雪人冲撞兽、暴风雪精灵、冰川泰坦 | 冰甲、雪毛、蓝白光 | `frost enemy with icy armor, pale blue glow, snow particles, chunky silhouette` |
| 神庙族 | 神庙守卫、丛林狂热者、神庙祭司、复活神像、石化先知、石巨像 | 石雕、藤蔓、金绿符文 | `ancient temple enemy, stone mask, vine wraps, jade green and old gold runes` |
| 海盗海潮 | 海盗长枪兵、码头打手、咸水冲撞兵、海妖触手、潮汐战领 | 海盐、锈铁、触手 | `dark pirate sea raider enemy, rusty armor, teal brine glow, nautical weapon silhouette` |
| 机械矿场 | 发条小兵、蒸汽长矛兵、反建筑工蜂、矿车撞锤、修理机器人、钢铁巨匠 | 黄铜、蒸汽、齿轮 | `clockwork mechanical enemy, brass and black steel, glowing furnace core, readable gears` |
| 菌菇腐疫 | 孢子幼体、菌丝感染体、扭曲女巫、菌母蘑菇、腐疫吐液者、菌核之母 | 蘑菇、孢子、腐化 | `dark mushroom blight creature, spore cap, purple green fungus glow, bulbous casual shape` |
| 深渊虚空 | 虚空闪烁者、虚空奴仆、摧塔之眼、诅咒复仇者、旧日支配者、深渊领主 | 紫黑裂隙、眼、触须 | `void abyss enemy, purple black energy cracks, single glowing eye motif, eldritch but cute-readable` |
| 草原旧敌 | 哥布林、疯狂野猪、铁甲大象、草原巨人、巨型史莱姆 | 草原怪物、兽类 | `dark meadow monster, simple rounded fantasy creature, green brown palette, clear role silhouette` |
| 废土机械 | 骷髅、飞机、坦克、油罐车、机器狗、巨型机器人、无人机、超级机器人 | 红雾、钢铁、燃油 | `post-apocalyptic mechanical enemy, charcoal metal, red warning lights, sturdy readable silhouette` |

### 5.4 Boss 额外要求

Boss 必须比普通敌人更有舞台感，但不能遮挡棋盘信息。

| 要求 | 说明 |
|------|------|
| 轮廓 | 至少有一个独特外轮廓：巨角、炮臂、王冠、背旗、巨大眼球或裂隙环 |
| 色彩 | 主体保持暗色，弱点或核心用高亮色 |
| 技能前摇 | `skill_0` 必须出现明显蓄力符号 |
| 死亡 | `death_1` 必须表现崩解、爆裂或能量消散 |

Boss 提示词：

```text
dark fantasy casual tower defense boss sprite, {boss_subject}, oversized readable silhouette, unique crown or core motif, dramatic but clean, high contrast glowing weak point, 3/4 top-down view, transparent background, 192x192, no text
```

---

## 6. 技能、特效、状态与 Buff

### 6.1 技能特效规格

技能特效以 2 帧为主：`charge_0` / `impact_1`。持续技能可循环播放两帧。

| 效果 | 用途 | 提示词主体 |
|------|------|------------|
| 火焰爆发 | 火球术、火塔、灼烧 | `orange red fire explosion ring, ember particles, transparent background` |
| 箭雨落点 | 剑雨、箭塔强化 | `multiple arrow impact streaks, sharp white motion trails, transparent background` |
| 冰霜爆发 | 冰塔、暴风雪、冻结 | `blue white frost burst, ice shard circle, snow mist, transparent background` |
| 黑铁爆炸 | 炮塔、炸弹、导弹 | `dark smoke and orange blast, chunky stylized explosion, transparent background` |
| 毒雾 | 毒塔、中毒、腐蚀 | `sickly green poison cloud, bubbling droplets, soft edge transparent background` |
| 闪电链 | 电塔、眩晕 | `yellow lightning bolt chain, sharp electric arcs, transparent background` |
| 激光束 | 激光塔 | `cyan purple horizontal laser beam, bright core and soft glow, transparent background` |
| 护盾 | 紧急防护、防御 Buff | `blue magic shield bubble, hexagonal shimmer, transparent background` |
| 治疗 | 牧师、治疗泉水 | `soft golden healing particles, upward motes, circular aura, transparent background` |
| 召唤 | Boss 召唤、母虫孵化 | `purple summoning circle, runes and smoke, transparent background, no text` |

通用特效提示词：

```text
2D stylized game VFX sprite, {effect_subject}, dark fantasy casual tower defense, clean alpha edges, transparent background, high contrast, readable at small size, no text, no watermark
```

### 6.2 状态图标

| 状态 | 图标元素 |
|------|----------|
| 冻结 | 蓝色冰块包住小人剪影 |
| 减速 | 向下箭头 + 冰霜脚印 |
| 眩晕 | 黄色旋转星 + 闪电短弧 |
| 中毒 | 绿色毒滴 + 气泡 |
| 灼烧 | 红橙火苗 + 小黑烟 |
| 嘲讽 | 盾牌 + 红色感叹号形状（不含文字） |
| 无敌 | 蓝色六边形护盾 |
| 精英 | 暗金小皇冠 |
| Boss | 红黑王冠 + 燃烧核心 |

### 6.3 关间 Buff 图标

| Buff | 主视觉 | AI 提示词主体 |
|------|--------|---------------|
| 神射手 | 双箭 + 速度线 | `two crossed arrows with cyan speed trails, dark fantasy buff icon` |
| 寒冰之心 | 冰心 | `blue frozen heart crystal, frost aura, dark fantasy buff icon` |
| 烈焰之力 | 火焰拳/火心 | `burning orange flame core, ember burst, dark fantasy buff icon` |
| 钢铁防线 | 铁墙盾 | `black iron wall shield, rivets, sturdy defensive icon` |
| 快速行军 | 靴子风线 | `marching boot with green wind trail, speed buff icon` |
| 金币储备 | 钱袋金币 | `dark leather coin pouch spilling gold coins, economy buff icon` |
| 强化箭矢 | 符文箭头 | `reinforced arrowhead with blue rune glow, range buff icon` |
| 魔法涌流 | 紫色法力漩涡 | `purple mana surge spiral, arcane energy icon` |
| 双倍赏金 | 双金币 | `two gold coins with dark gold glow, bounty buff icon` |
| 不破之壁 | 巨盾裂而不碎 | `large unbroken shield with crack marks and golden glow` |
| 奥术智慧 | 魔法书 | `open arcane book with purple light, wisdom buff icon` |
| 战术大师 | 棋盘与四张卡 | `tactical board with four small cards, strategy buff icon, no text` |

Buff 图标提示词：

```text
dark fantasy casual game buff icon, {buff_subject}, centered symbol, transparent background, clean readable silhouette, 64x64, no text, no number, no frame
```

---

## 7. 场景、地格与背景

### 7.1 地格可读性

地格是战斗信息底座，复杂度必须低于单位。

| 地格 | 视觉要求 |
|------|----------|
| 可建造地 | 低饱和底色、轻微纹理、边缘清楚 |
| 路径 | 与可建造地区分明显，纹理沿路径方向延展 |
| 障碍 | 更暗、更硬、更高对比，不能像可放置地 |
| 出生点 | 敌方入口符号，不烘焙文字 |
| 基地/水晶 | 玩家核心，红色水晶高亮，但周围地面简洁 |
| 预览合法格 | 蓝绿描边或柔光覆盖，由运行时绘制优先 |
| 预览非法格 | 红色描边或暗红遮罩，由运行时绘制优先 |

地格提示词：

```text
dark fantasy casual tower defense tile texture, {theme} {tile_type}, top-down square game tile, simple readable surface, low detail, clean border readability, 128x128, no units, no text, seamless enough for grid
```

### 7.2 主题地格提示词

| 主题 | 可建造地 | 路径 | 障碍 |
|------|----------|------|------|
| 绿野仙踪 | `dark rainy grass tile with short moss and wet highlights` | `muddy brown path tile with puddles and worn footprints` | `dark wet rock and thorn bush obstacle tile` |
| 沙漠虫潮 | `dark golden sand tile with sparse cracked texture` | `packed desert road tile with worm track marks` | `sandstone rock and insect burrow obstacle tile` |
| 黑暗古堡 | `cold grey stone courtyard tile with moss cracks` | `dark slate path tile, worn gothic stone slabs` | `black ruined wall rubble obstacle tile` |
| 末日废土 | `charcoal wasteland ground tile with red ash dust` | `cracked asphalt road tile with dark red dirt` | `rusted metal debris and broken concrete obstacle tile` |
| 深渊裂隙 | `dark purple void stone tile with faint violet cracks` | `black violet rift path tile with glowing edge fissures` | `jagged abyss crystal and void rock obstacle tile` |

### 7.3 背景与装饰

背景保持暗黑氛围，但棋盘区域不得有高频细节。

背景提示词：

```text
dark fantasy casual tower defense battlefield background, {theme_scene}, wide 16:9, low contrast center area for gameplay readability, stronger atmosphere at edges, stylized hand-painted, no characters, no UI, no text, 1920x1080
```

| 主题 | 背景主体 | 装饰物 |
|------|----------|--------|
| 绿野仙踪 | 雨夜草原、远山、低云 | 橡树、灌木、野花、草丛、湿石 |
| 沙漠虫潮 | 暗金荒漠、热浪、虫洞 | 砂岩、枯骨、仙人掌、小沙丘、虫卵 |
| 黑暗古堡 | 残月古堡、雾、枯树 | 断柱、火盆、碎石、墓碑、断壁 |
| 末日废土 | 红雾废城、断裂地平线 | 报废车、油桶、管道、金属碎片、警示灯 |
| 深渊裂隙 | 紫黑虚空、漂浮岩石 | 紫晶簇、裂隙、浮石、虚空火、扭曲石碑 |

---

## 8. UI 美术需求

UI 采用 **暗黑黑铁面板 + 暗金细线 + 高亮功能色** 。UI 不能变成厚重写实 RPG 面板，必须保持休闲游戏的轻快操作感。

### 8.1 UI 全局规则

| 项 | 要求 |
|----|------|
| 字体承载 | 图片中不含文字，文字由 Canvas/DOM 绘制 |
| 面板 | 8px 以内圆角，黑铁或深蓝黑底，边缘暗金/稀有度发光 |
| 按钮 | 图标优先，文字由运行时绘制；必须有普通、悬停、按下、禁用状态 |
| 图标 | 轮廓清楚，16px 缩小时仍可识别 |
| 稀有度 | Common 白、Rare 蓝、Epic 紫、Legendary 金 |
| 警告 | 红色只用于危险、失败、不可放置，不做大面积背景 |
| 休闲感 | 保留较大触控热区，避免过密纹理和过尖锐装饰 |

### 8.2 UI 资产清单

| UI 区域 | 资产 | 美术要求 |
|---------|------|----------|
| 顶部 HUD | `ui_hud_bar`、资源徽章、分隔线 | 横向黑铁条，资源区域有小底座，不遮挡战场 |
| 资源显示 | 金币、能量、水晶、波次、倒计时图标 | 暗底高亮符号，不能依赖 emoji |
| 手牌区 | 手牌底座、空槽、拖拽高亮、选中框 | 底座轻量，不做厚重大面板；卡槽清楚 |
| 卡牌详情 | tooltip 面板、属性行底、关键词标签 | 小尺寸可读，边框跟随稀有度 |
| 建造预览 | 合法/非法落点、范围圈、路径阻挡提示 | 运行时叠加为主，图片只提供软光纹理 |
| 塔信息面板 | 升级/出售按钮、属性条、小图标 | 棋盘上浮层，不能覆盖核心战斗区域过多 |
| 暂停菜单 | 半透明遮罩、中央面板、按钮 | 暗色遮罩 + 黑铁面板，按钮大且清晰 |
| 胜利界面 | 胜利面板、星级、奖励槽、继续按钮 | 暗金庆祝但不使用烘焙文字 |
| 失败界面 | 失败面板、裂纹遮罩、重试按钮 | 红黑压迫感，避免过度恐怖 |
| 抽卡界面 | 三选四卡槽、选择光效、刷新按钮 | 卡槽突出稀有度，背景简洁 |
| Buff 选择 | Buff 卡底、稀有度框、选中光效 | 与卡牌区分，图标更大，说明区留白 |
| 选关界面 | 关卡节点、星级槽、主题背景、锁定图标 | 每关主题一眼可辨，节点可点击区域清楚 |
| 卡牌图鉴 | 搜索/筛选按钮、网格卡底、分类页签 | 信息密度高但不花，强调浏览效率 |
| 敌人图鉴 | 敌人卡底、Boss/精英标记、属性图标 | 敌人剪影优先，属性图标统一 |
| 调试面板 | 保持功能面板风格 | 可不走完整暗黑美术，只需与主 UI 不冲突 |

### 8.3 UI 提示词

面板：

```text
dark fantasy casual game UI panel, black iron and dark navy material, subtle brushed metal texture, thin antique gold border, clean 8px rounded corners, 512x512 9-slice source, transparent outside, no text, no icons
```

按钮：

```text
dark fantasy casual game UI button, {button_color} accent, black iron bevel, subtle inner glow, clean readable shape, 384x128 9-slice source, transparent outside, no text, no symbol
```

图标：

```text
dark fantasy casual game UI icon, {icon_subject}, centered flat symbol with slight hand-painted texture, high contrast, transparent background, readable at 16px, 48x48, no text, no frame
```

胜负界面装饰：

```text
dark fantasy casual game result screen ornament, {result_subject}, antique gold or crimson accent, transparent background, clean silhouette, no text, no numbers
```

选关节点：

```text
dark fantasy casual level select node, {theme} miniature portal marker, black iron ring, glowing theme color core, transparent background, readable small game UI asset, no text, no number
```

---

## 9. 生产流程

1. 先生成 UI 基础件、卡牌框、地格和 5 张背景，确定全局风格。
2. 再生成玩家单位和卡牌插画，优先覆盖玩家高频看到的资产。
3. 按敌人主题批量生成敌人单位，先普通再精英再 Boss。
4. 生成技能特效、Buff 图标、状态图标。
5. 统一后处理：去背景、裁切、缩放、调色、边缘清理。
6. 接入前做视觉验收：棋盘 100% 缩放、50% 缩放、移动中状态、UI 深色背景下可读性。

### 9.1 单资产验收标准

| 检查项 | 通过标准 |
|--------|----------|
| 轮廓 | 64px 下仍能分辨类别 |
| 色彩 | 与阵营、稀有度、元素属性一致 |
| 背景 | 透明资产无白边、无脏边 |
| 动画 | 2 帧循环不跳形、不漂移 |
| UI | 不含文字，运行时文字有足够留白 |
| 地格 | 地面复杂度低于单位，不抢焦点 |

### 9.2 批量生成变量

可用以下变量驱动批量提示词：

| 变量 | 含义 |
|------|------|
| `{asset_type}` | card / unit / fx / buff / ui / tile / decor / background |
| `{id}` | 配置 ID 或资产 ID |
| `{display_name}` | 中文显示名，仅用于人工对照，不写入图片 |
| `{subject}` | 主体描述 |
| `{theme}` | meadow / desert / castle / wasteland / abyss |
| `{main_color}` | 主强调色 |
| `{state}` | idle / move / attack / hit / death / skill / disabled |
| `{frame}` | 0 / 1 |

---

## 10. 优先级

| 优先级 | 内容 | 原因 |
|--------|------|------|
| P0 | UI 基础件、手牌、卡牌插画、玩家单位、地格 | 玩家高频看到，直接影响品质感和可玩性 |
| P1 | 技能特效、Buff 图标、状态图标、5 关背景 | 强化战斗反馈和 Roguelike 选择体验 |
| P2 | 全敌人动画帧、Boss 技能帧、图鉴资产 | 内容量大，按关卡逐批接入 |
| P3 | 场景装饰、胜负装饰、选关主题背景 | 提升完成度，不阻塞核心体验 |

---

## 11. 与旧文档的关系

`08-art-assets.md` 是历史素材清单，仍可作为具体素材命名参考。本文是本轮 **AI 美术重设计** 的权威需求，若两者冲突，以本文为准。
