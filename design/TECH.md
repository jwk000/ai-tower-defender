# TECH.md — 技术系统权威源

> **CODEGEN 标记警告**：本文档中的 `<!-- CODEGEN:*:START/END -->` 标记由 `scripts/check-doc-consistency.ts` 自动维护。**禁止手动编辑标记内的列表**；改用 `npm run check:doc:fix` 同步。

---

## 1. 技术选型

### 1.1 最终选型：PixiJS + bitecs

| 方案 | 渲染 | ECS | 选用 |
|------|------|-----|------|
| PixiJS + bitecs ✅ | PixiJS WebGL | bitecs | **已选定** |
| Canvas 2D + 自研ECS | Canvas 2D | 自研 | 废弃 |
| Canvas 2D + bitecs | Canvas 2D | bitecs | — |
| Phaser 3 | WebGL(内置) | 不兼容 | — |

**理由**：
- **bitecs**：SoA 数据导向内存布局，类型安全查询，适合大量同屏实体
- **PixiJS**：WebGL + ParticleContainer 粒子优化，Graphics API 支持几何图形
- **渐进迁移**：ECS 层和渲染层可分阶段独立验证

---

## 2. 架构设计

### 2.1 四层架构

```
配置层 (YAML/JSON) — 策划可编辑
  单位配置 / 关卡配置 / 技能Buff配置
       ↓
  配置加载 & 解析
       ↓
规则引擎 (RuleEngine) — 配置驱动调度
  · 生命周期事件分发（onDeath/onHit/onKill/…）
  · 行为规则执行（targetSelection/attackMode/movementMode）
       ↓
ECS World (bitecs)
  · 所有单位 = Entity + Components
  · 系统 = 纯函数处理组件数据
  · 查询 = 类型安全 defineQuery
       ↓
PixiJS 渲染层
  · Graphics（几何图形）
  · ParticleContainer（粒子特效）
  · Container（UI 层级管理）
```

### 2.2 目录结构

```
src/
├── main.ts                    入口 + PixiJS App + ECS World 初始化
├── core/
│   ├── World.ts               bitecs World 封装
│   ├── components.ts          所有组件 defineComponent 定义
│   ├── pipeline.ts            系统管线（注册顺序 + 依赖）
│   └── RuleEngine.ts          规则引擎
├── config/
│   ├── loader.ts              配置加载器（YAML/JSON → typed 对象）
│   ├── registry.ts            单位配置注册表
│   ├── units/                 单位配置（towers/soldiers/enemies/…）
│   └── levels/                关卡配置文件
├── systems/                   ECS 系统（纯函数）
│   ├── movementSystem.ts
│   ├── attackSystem.ts
│   ├── projectileSystem.ts
│   ├── waveSystem.ts
│   ├── healthSystem.ts
│   ├── economySystem.ts
│   ├── buildSystem.ts
│   ├── buffSystem.ts
│   ├── weatherSystem.ts
│   ├── productionSystem.ts
│   ├── trapSystem.ts
│   └── renderSystem.ts        PixiJS 渲染同步
├── render/
│   ├── Renderer.ts
│   ├── MapRenderer.ts
│   ├── EntityRenderer.ts
│   ├── ProjectileRenderer.ts
│   ├── ParticleRenderer.ts
│   └── UIRenderer.ts
├── editor/                    关卡编辑器（DEV-only）
├── debug/                     调试系统
├── save/
│   └── SaveSystem.ts
├── audio/
│   └── AudioManager.ts
└── types/
    └── index.ts
```

---

## 3. 规则引擎

### 3.1 生命周期事件接口

```typescript
interface RuleEngine {
  dispatch(event: LifecycleEvent, entity: Entity, context: EventContext): void;
}

type LifecycleEvent =
  | 'onCreate' | 'onDeath' | 'onHit' | 'onAttack'
  | 'onKill' | 'onUpgrade' | 'onDestroy' | 'onEnter' | 'onLeave';

type RuleHandler = (entity: Entity, params: RuleParams, world: World) => void;
```

### 3.2 行为规则接口（AI 路径）

> **v3.4 决策**：所有 AI（士兵四状态机、Boss、高级敌人）均走规则引擎路径，行为树整体废弃。

```typescript
interface BehaviorRule {
  targetSelection: (entity: Entity, candidates: Entity[]) => Entity | null;
  attackMode: (entity: Entity, target: Entity, dt: number) => void;
  movementMode: (entity: Entity, dt: number) => void;
}

// AI 状态字段挂在 ECS 组件上，状态转换由帧内条件检测触发
// Boss 阶段切换由 onHpThreshold / onPhaseTransition 生命周期事件触发
```

### 3.3 已注册 RuleHandler

<!-- CODEGEN:handlers:START -->
- add_extra_target
- boost_attack_speed
- drop_gold
- return_card_to_deck
<!-- CODEGEN:handlers:END -->

---

## 4. ECS 组件与系统

### 4.1 已定义组件

<!-- CODEGEN:components:START -->
- Attack
- BossPhase
- BossTag
- Crystal
- DeadTag
- EliteTag
- Faction
- Health
- JustSpawnedTag
- Movement
- Owner
- Position
- Projectile
- SummonAura
- SupportAura
- UnitTag
- Visual
<!-- CODEGEN:components:END -->

### 4.2 已注册系统

<!-- CODEGEN:systems:START -->
- AttackSystem [gameplay]
- BossPhaseSystem [gameplay]
- CrystalSystem [gameplay]
- HealthSystem [lifecycle]
- LifecycleSystem [lifecycle]
- MovementSystem [gameplay]
- ProjectileSystem [gameplay]
- SummonAuraSystem [gameplay]
- SupportAuraSystem [gameplay]
- WaveSystem [gameplay]
<!-- CODEGEN:systems:END -->

---

## 5. 阵营语义

### 5.1 唯一真理源：`Faction.value`

```typescript
export const FactionVal = {
  Player: 0,
  Enemy: 1,
  Neutral: 2,
} as const;
```

**废弃**：`UnitTag.isEnemy`（布尔双轨已废弃，由 `Faction.value` 三元枚举替代）

### 5.2 核心 API

```typescript
// 两实体是否互为敌对阵营（Player vs Enemy = true；任一方 Neutral = false）
export function isHostileTo(world: BitecsWorld, a: number, b: number): boolean;

// 判断实体是否属于指定阵营
export function isFaction(eid: number, faction: FactionVal): boolean;

// 拉指定阵营的所有实体（封装 defineQuery 的数值字段过滤限制）
export function factionQuery(world: BitecsWorld, faction: FactionVal): readonly number[];
```

### 5.3 迁移路径（A→F）

| Phase | 内容 |
|---|---|
| A | 新建 3 个 API + 单元测试 |
| B | 数据写入侧统一同时写 Faction + UnitTag.isEnemy |
| C | 读取侧逐文件替换（按风险递减序，14 个文件） |
| D | Query 层重构（删 `enemyQuery`/`enemyTargetQuery`） |
| E | UnitTag.isEnemy 字段退役 |
| F | 去 `enemy` 硬编码命名 |

---

## 6. 存档系统（v3.1.0）

### 6.1 存档格式

```typescript
interface SaveData {
  version: string;              // "3.0.0"
  createdAt: number;
  updatedAt: number;
  checksum: string;             // CRC32 校验
  runHistory: RunHistory;
  totalPlayTimeSeconds: number;
  totalKills: number;
  totalGoldEarned: number;
  achievements: AchievementProgress;
  settings: PlayerSettings;
  ongoingRun: OngoingRun | null;  // null = 无进行中 Run
}

interface OngoingRun {
  currentLevelIdx: number;       // 1-8
  gold: number;
  crystalHp: number;
  crystalHpMax: number;
  cardPool: string[];            // 当前 Run 已拥有的唯一卡池
  cardLevels: Record<string, 1 | 2 | 3>;
  removeCardCost: number;        // 当前下一次删卡所需金币
  savedAt: number;
}
```

### 6.2 Run 进度快照（`RunSnapshot` v2）

```typescript
interface RunSnapshot {
  version: 2;
  savedAt: number;
  phase: 'LevelMap';             // 唯一合法快照相位（不存 Battle 中途状态）
  currentLevelIdx: number;
  gold: number;
  crystalHp: number;
  crystalHpMax: number;
  cardPool: string[];
  cardLevels: Record<string, 1 | 2 | 3>;
  removeCardCost: number;
  deck: {
    drawPile: string[];
    discardPile: string[];
  };
}
```

- **存储**：`localStorage` key = `td_run_v2`
- **旧 key 清理**：`td_run_v1` / `td_ongoing_run` 在 `clearRun()` 时清理

### 6.3 存档时机

| 时机 | 操作 |
|------|------|
| Run 开始 | `runHistory.totalRuns += 1` |
| 进入 LevelMap 相位（关间/商店/秘境/卡牌成长界面关闭后）| `saveProgress(RunSnapshot)` |
| Battle 中 | 不存档（防止死亡后加载存档绕过惩罚）|
| Run 失败/胜利 | 更新 RunHistory；`clearRun()` |
| 成就解锁 | 立即保存 |
| 设置变更 | 立即保存 |
| 每 60 秒 | 保存 totalPlayTimeSeconds |

### 6.4 损坏恢复

```typescript
// 保存时 CRC32 校验
save(data): data.checksum = crc32(JSON.stringify(data without checksum))

// 读取时验证
load(): if checksum mismatch → recoverFromBackup()
```

备份优先级：当前 → session → daily → 版本备份 → 默认值

### 6.5 已删除字段（累计）

| 字段 | 废弃版本 | 原因 |
|------|---------|------|
| `sparkShards` | v3.0 | 火花碎片彻底废弃 |
| `cardCollection` | v3.0 | 所有卡开局即解锁 |
| `permanentUpgrades` | v3.0 | 无关外永久升级 |
| `RunHistory.totalSparkShardsEarned` | v3.0 | 无碎片资源 |
| `levels` / `endless` | v2.0 | 独立关卡/无尽取消 |
| `OngoingRun.skillPoints` | v3.5 | SP 资源废弃 |
| `OngoingRun.crystalLevel` | v3.6 | Crystal 升级体系废弃 |
| `OngoingRun.techTreeState` | v3.6 | 旧卡牌成长状态结构收束为按卡记录的 `cardLevels` |
| `OngoingRun.deckCardIds` | v3.6 | 重命名并语义收束为 `cardPool` |
| `RunSnapshot.skillPoints` | v3.5 | SP 资源废弃 |
| `RunSnapshot.crystalLevel` | v3.6 | Crystal 升级体系废弃 |
| `RunSnapshot.techTreeState` | v3.6 | 旧卡牌成长状态结构收束为按卡记录的 `cardLevels` |
| `RunSnapshot.skillTreeUnlocked` | v3.5 | 已废弃；相关成长状态统一并入按卡记录的 `cardLevels` |

### 6.6 流派识别（本会话荣誉）

| 流派 | 识别规则 |
|------|---------|
| 近战墙流 | 近战单位卡 > 卡池 50% |
| 法术爆发流 | 法术卡 > 卡池 40% |
| 生产抗压流 | 生产建筑 ≥ 3 张 |
| 远程压制流 | 远程塔 > 卡池 40% |
| 混合均衡流 | 其余兜底 |

---

## 7. 调试系统（v1.0）

### 7.1 架构

- **DebugManager**：在 `TowerDefenderGame` 构造函数中创建，与游戏同生命周期
- **调试按钮（🔧）**：DOM 固定定位浮动按钮，全界面持续可见
- **快捷键**：反引号 `` ` `` 切换 / `Escape` 收起

### 7.2 功能按钮（v1.0）

| 序号 | 功能 | 适用界面 |
|------|------|---------|
| 1 | 一键通关（全关 3 星）| 全部 |
| 2 | 金币 +99999 | 仅战斗中（非战斗时置灰）|
| 3 | 查看行为树（单位 BT 弹窗）| 全部 |

### 7.3 面板形态

- 右侧抽屉式 DOM 面板，宽 360px
- 仅显示纵向功能按钮列表，无 Tab

### 7.4 文件清单

| 文件 | 操作 |
|------|------|
| `src/debug/DebugManager.ts` | 修改：注入 EconomyProvider + LevelSelectRefresh 回调 |
| `src/debug/DebugPanel.ts` | 重写：抽屉面板只渲染功能按钮列表 |
| `src/debug/BehaviorTreeWindow.ts` | 新建：独立行为树查看弹窗 |
| `src/debug/index.ts` | 修改：仅导出 DebugManager + BehaviorTreeRenderer |
| `src/debug/DebugConsole.ts` | 删除 |
| `src/debug/LogMonitor.ts` | 删除 |
| `src/debug/BehaviorTreeViewer.ts` | 删除（被 BehaviorTreeWindow 取代）|

---

## 8. 关卡编辑器（v1.0）

### 8.1 形态

- **DEV-only**：`import.meta.env.DEV` 守卫，生产构建完全剥离
- **游戏内全屏覆盖层**：共享 PixiJS App，暂停主游戏循环
- **UI 框架**：Preact（~3KB gzip，DEV-only）
- **入口**：调试面板按钮 + `F2` 热键
- **目标**：编辑 → 保存 → 试玩 ≤ 3 秒

### 8.2 YAML 数据流

```
编辑器编辑（内存态 EditorState）
  ↓ Ctrl+S
  schema.parse() 强校验
  ↓
  yamlSerializer.stringify()
  ↓
  PUT /__editor/levels/:id （Vite dev 插件）
  ↓
  fs.writeFile(tmp) + fs.rename 原子替换
  ↓
  src/config/levels/*.yaml（唯一事实来源）
```

### 8.3 多生成口 + 图模型（DAG）

路径模型从"拐点折线数组"升级为**节点 + 有向加权边的 DAG**：

| 节点角色 | 含义 |
|---------|------|
| `spawn` | 敌人生成口（绑定 spawnId）|
| `waypoint` | 中间拐点 |
| `branch` | 分支点（出度 ≥ 2，按权重随机选边）|
| `portal` | 传送门（teleportTo 瞬移目标节点）|
| `crystal_anchor` | 水晶终点 |

分支随机使用 `waveRandom` 确定性 PRNG 流，保证 Replay 可复现。

### 8.4 图不变量（13条，编辑器强制维护）

| # | 不变量 |
|---|--------|
| I1 | 每个 `spawn` tile 对应一条 `spawns[]` + `role='spawn'` 节点 |
| I2 | `spawns[i]` 位置 tile 必须是 `spawn` 类型 |
| I3 | 节点 id 关卡内唯一 |
| I4 | `role='spawn'` 节点必须有有效 `spawnId` |
| I5 | `role='portal'` 节点必须有合法 `teleportTo` |
| I6 | 从任一 spawn 出发可达至少一个 `crystal_anchor` |
| I7 | 不可形成环路（portal 跳转不计入环检测） |
| I8 | 同一节点出边权重和 > 0，权重为非负整数 |
| I9 | 相邻节点（沿图边）必须同行或同列 |
| I10 | 边经过的 tile 必须是 path/spawn/crystal 类型 |
| I11 | `waves[].enemies[].spawnId` 若指定，必须存在于 `spawns[].id` |
| I12 | 至少 1 个 spawn、1 个 crystal_anchor、1 条边 |
| I13 | 非 `crystal_anchor` 节点至少有 1 条出边 |

### 8.5 Vite 插件 API

```
GET  /__editor/levels         列出所有关卡 YAML
GET  /__editor/levels/:id     读取单个 YAML
PUT  /__editor/levels/:id     写入单个 YAML（原子替换）
POST /__editor/levels/:id/dup 复制关卡
DELETE /__editor/levels/:id   删除关卡（备份到 .editor-trash/）
```

路径安全：`:id` 严格白名单正则 `^[a-z0-9_-]+$`，禁止 `../` 穿越。

### 8.6 实施路线图（A→F）

| Phase | 内容 | 周期 |
|-------|------|------|
| A | 骨架：Vite 插件 + 入口 + 关卡列表只读显示 | 1-2 天 |
| B | 地图与图编辑工具集 + 渲染层 | 4-5 天 |
| C | 表单编辑（元数据/波次/随机池/难度）| 2 天 |
| D | Zod 校验 + 关卡迁移 + 运行时图遍历重构 | 3 天 |
| E | 试玩流程（Game.startBattleWithConfig）| 1 天 |
| F | 撤销/重做 + 新建/复制/删除 | 1 天 |

### 8.7 现有关卡 YAML 迁移（一次性）

旧 `enemyPath: GridPos[]` → 线性图（每拐点 = waypoint，首节点 = spawn，末节点 = crystal_anchor）。迁移后旧字段删除，行为完全一致。

---

## 9. 文档一致性工具

### 9.1 自动同步命令

```bash
npm run check:doc        # 检查模式：差异则 exit 1（pre-commit 自动触发）
npm run check:doc:fix    # 修复模式：把代码列表同步写回本文档 CODEGEN 块
npm run check:all        # typecheck + check:doc（L3 任务提交前必跑）
```

### 9.2 pre-commit hook

`.husky/pre-commit` 自动执行 `typecheck + check:doc`，两道门都过才允许提交。文档与代码不一致时 commit 被拦截 → 运行 `npm run check:doc:fix` 后重新提交。

### 9.3 新增 ECS 组件 Checklist

1. `src/core/components.ts` — `defineComponent` 定义新组件
2. `src/systems/*.ts` — `defineQuery` 引用新组件
3. 挂载/移除逻辑（`factories/` 或对应系统）
4. **运行 `npm run check:doc:fix`**，commit message 注明"已同步 architecture.md"

---

## 10. 性能目标

| 指标 | 目标 |
|------|------|
| 帧率（常规）| 60fps 稳定 |
| 帧率（低端设备）| 30fps |
| 同屏实体 | 200+ |
| 同屏粒子 | 500+ |
| 装饰层渲染时间 | ≤ 2ms |
| 关卡编辑器（production bundle）| 0 字节（完全剥离）|
