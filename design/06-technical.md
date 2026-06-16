# 06 — 技术规范

> **定位**: 实现层 — ECS架构、规则引擎、配置格式、系统管线
> **依赖**: 所有前述文档
> **被引用**: 所有文档（作为实现参考）

---

## 1. 架构总览

### 1.1 四层架构

```
┌────────────────────────────────────────────┐
│              配置层 (YAML)                   │
│  units/*.yaml  levels/*.yaml  cards/*.yaml  │
│        策划可编辑，运行时加载                  │
├────────────────────────────────────────────┤
│            规则引擎 (Runtime)                │
│  RuleEngine: 生命周期事件分发                 │
│  RuleHandlers: 行为规则处理器                 │
├────────────────────────────────────────────┤
│           ECS 系统层 (bitecs)                │
│  纯函数系统 + defineQuery + SoA 内存布局      │
├────────────────────────────────────────────┤
│         渲染层 (PixiJS WebGL)                │
│  Graphics + ParticleContainer + Container    │
└────────────────────────────────────────────┘
```

### 1.2 核心原则

1. **配置驱动**: 单位/关卡/卡牌全部通过YAML定义，不改代码即可新增
2. **纯数据组件**: bitecs组件只含数据，不含方法
3. **纯函数系统**: 系统通过query获取实体，纯函数处理
4. **规则引擎**: 生命周期事件和行为规则从配置声明，引擎统一分发
5. **SoA内存**: bitecs Structure of Arrays布局，大量实体高效

---

## 2. ECS架构 (bitecs)

### 2.1 组件定义

组件使用 `defineComponent` 定义，存储为SoA数组：

```typescript
// 示例: 位置组件
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
});

// 示例: 生命值组件
export const Health = defineComponent({
  current: Types.f32,
  max: Types.f32,
});

// 示例: 攻击组件
export const Attack = defineComponent({
  atk: Types.f32,
  attackSpeed: Types.f32,
  range: Types.f32,
  damageType: Types.ui8,     // 0=physical, 1=magic, 2=true
  attackTimer: Types.f32,
  targetEid: Types.eid,      // 当前目标实体ID
});

// 示例: 层级组件
export const Layer = defineComponent({
  value: Types.ui8,           // Grid=0, Ground=1, LowAir=2, Space=3
});
```

**核心组件清单**：

| 组件 | 用途 | 携带实体 |
|------|------|---------|
| `Position` | 坐标 | 所有 |
| `Health` | HP | 所有 |
| `Attack` | 攻击属性 | 有攻击能力 |
| `Movement` | 移动属性 | 可移动 |
| `Layer` | 逻辑层级 | 所有 |
| `Faction` | 阵营 | 所有 |
| `BuffContainer` | 挂载的Buff列表 | 所有 |
| `Renderable` | 渲染数据 | 所有可见 |
| `CardComponent` | 卡牌关联 | 由卡牌生成的单位 |
| `Elite` | 精英标记 | 精英敌人 |
| `Boss` | BOSS标记 | BOSS |
| `Trap` | 机关类型 | 机关单位 |
| `Tower` | 塔等级+升级费 | 塔 |
| `Soldier` | 士兵AI状态 | 士兵 |

### 2.2 查询

系统用 `defineQuery` 声明查询，AND逻辑匹配：

```typescript
// 有攻击能力的敌人（在攻击范围内有目标的）
const attackingEnemies = defineQuery([Attack, Faction, Position]);

// 需要渲染的地面单位
const renderableGround = defineQuery([Renderable, Position, Layer]);
```

### 2.3 实体生命周期

```typescript
// 创建
const eid = addEntity(world);
addComponent(world, Position, eid);
Position.x[eid] = 100;
Position.y[eid] = 200;

// 标记删除（不立即移除，在World.update()末尾统一清理）
addComponent(world, PendingDestroy, eid);

// 查询时需排除已标记删除的实体
```

---

## 3. 规则引擎

### 3.1 生命周期事件

| 事件 | 触发时机 | 用途 |
|------|---------|------|
| `onCreate` | 单位生成时 | 初始化特殊状态 |
| `onDeath` | HP归零时 | 触发死亡效果（分裂/爆炸/掉落） |
| `onHit` | 被攻击时 | 触发反伤/护盾 |
| `onAttack` | 发动攻击时 | 攻击附带效果 |
| `onKill` | 击杀目标时 | 击杀奖励/吸血 |
| `onEnter` | 进入攻击范围 | 触发陷阱 |
| `onLeave` | 离开攻击范围 | 解除锁定 |

### 3.2 事件分发

```typescript
// 系统检测事件
if (Health.current[eid] <= 0) {
  ruleEngine.dispatch('onDeath', eid, { killerEid: attackerEid });
}
```

### 3.3 行为规则

单位配置中声明行为规则，规则引擎在相应系统中提供决策：

| 规则类型 | 用途 | 示例 |
|---------|------|------|
| `targetSelection` | 目标选择 | `closest_to_crystal`, `lowest_hp`, `highest_threat` |
| `attackMode` | 攻击模式 | `single`, `aoe`, `chain`, `piercing` |
| `movementMode` | 移动模式 | `follow_path`, `patrol`, `chase_target` |

### 3.4 规则处理器

常见处理器在 `core/RuleHandlers.ts` 中注册：

| Handler | 用途 |
|---------|------|
| `deal_aoe_damage` | 范围伤害 |
| `apply_buff` | 挂载Buff |
| `spawn_unit` | 生成子单位（分裂、召唤） |
| `explode` | 死亡爆炸 |
| `chain_attack` | 连锁攻击弹跳 |
| `steal_hp` | 吸血 |
| `push_enemy` | 击退 |
| `pull_enemy` | 拉扯 |

---

## 4. 系统管线

### 4.1 8阶段拓扑排序

管线顺序不可随意调换（按数据依赖关系排序）：

```
1. PHASE_MANAGERS   — 经济管理器、波次系统、天气调度
2. PHASE_VFX        — 死亡动画、爆炸计时、弹道生命周期
3. PHASE_MODIFIERS  — Buff更新/过期/移除、治疗结算
4. PHASE_GAMEPLAY   — 移动、攻击、弹道、技能、陷阱、生产
5. PHASE_LIFECYCLE  — 生命周期事件分发(onDeath/onCreate等)、死亡检测
6. PHASE_CREATION   — 建造/部署、实体新建
7. PHASE_AI         — 行为树执行(如需)
8. PHASE_RENDER     — RenderSystem + UISystem（始终最后）
```

### 4.2 简化后的系统清单

适配新设计v4.0，系统列表比v3.1大幅简化（去掉Run/Deck/Hand/Energy/Shop/Mystic等系统）：

| 阶段 | 系统 | 职责 |
|------|------|------|
| MANAGERS | `WaveSystem` | 波次控制、敌人产出、波间/关间过渡 |
| | `EconomySystem` | 金币计算、塔升级费用扣除 |
| | `WeatherSystem` | 天气调度、粒子管理 |
| VFX | `ProjectileSystem` | 弹道飞行、碰撞检测 |
| | `ParticleSystem` | 粒子特效生命周期 |
| MODIFIERS | `BuffSystem` | Buff计时、层叠、过期、移除 |
| GAMEPLAY | `MovementSystem` | 单位沿路径移动、士兵巡逻 |
| | `AttackSystem` | 目标选择、攻击判定、伤害结算 |
| | `TrapSystem` | 机关触发逻辑（地刺/捕兽夹/水坑等） |
| | `SkillSystem` | 技能卡释放逻辑 |
| | `ProductionSystem` | 召唤物管理（蝙蝠塔等） |
| LIFECYCLE | `HealthSystem` | HP归零检测、死亡触发 |
| | `LifecycleSystem` | 规则引擎生命周期事件分发 |
| CREATION | `BuildSystem` | 拖卡部署、建造校验、单位生成 |
| AI | `AISystem` | 士兵状态机、敌人特殊AI |
| RENDER | `RenderSystem` | ECS实体→PixiJS同步 |
| | `UISystem` | HUD/手牌区/面板更新 |

---

## 5. 配置格式

### 5.1 单位配置 (YAML)

```yaml
# config/units/arrow_tower.yaml
id: arrow_tower
name: "箭塔"
category: Tower
faction: Justice
layer: Ground

stats:
  hp: 1500
  atk: 15
  attackSpeed: 2.5
  range: 180
  armor: 5
  magicResist: 0
  damageType: physical

behavior:
  attackMode: single
  targetSelection: closest_to_crystal
  projectileType: arrow

economy:
  cost: 50
  upgradeCosts: [80, 150]       # L1→L2, L2→L3
  sellRatio: 0.5

upgrades:
  - level: 2
    name: "双重箭塔"
    atk: 15
    projectileCount: 2            # 同时射出2箭
    range: 180
  - level: 3
    name: "三重箭塔"
    atk: 15
    projectileCount: 3
    range: 200

visual:
  color: "#8d6e63"
  shape: "triangle_tower"
  size: 28
```

### 5.2 关卡配置 (YAML)

```yaml
# config/levels/level_01_green_wonderland.yaml
id: level_01
name: "绿野仙踪"
unlockRequirement: null          # 初始解锁

map:
  gridSize: [21, 9]
  tileSize: 64
  crystalPosition: [2, 4]        # 水晶位置（列,行）
  spawnPoints:
    - [18, 2]                     # 出生点1（列,行）
    - [18, 6]                     # 出生点2
  path:                           # 路径格子序列
    - [18, 2]
    - [17, 2]
    # ... 完整路径
    - [3, 4]
  blocked:                        # 障碍物位置
    - [10, 2]
    # ...

weather: Rain

crystal:
  hp: 500

difficulty:
  enemyHpMult: 1.0
  enemyDmgMult: 1.0
  stageMultipliers: [0.8, 1.0, 1.3, 1.5]   # 4阶段难度

waves:
  - enemies:
      - { id: goblin, count: 8, interval: 1.5 }
    elite: { id: goblin_elite }
    reward: 20
  # ... more waves
  - enemies:
      - { id: giant_slime, count: 1, interval: 0 }
      - { id: goblin, count: 4, interval: 2 }
      - { id: boar, count: 2, interval: 2 }
    isBossWave: true
    reward: 80

cardPool:                         # 初始卡池
  - card_arrow_tower
  - card_ice_tower
  # ...

draftPool:                        # 精英3选1卡池
  - card_arrow_tower
  - card_fireball
  # ...

decorations:                      # 装饰物
  - { type: tree, positions: [[5,1], [12,7], ...] }
  - { type: bush, positions: [[8,3], ...] }
```

### 5.3 卡牌配置 (YAML)

```yaml
# config/cards/card_arrow_tower.yaml
id: card_arrow_tower
name: "箭塔"
type: UnitCard
unitId: arrow_tower               # 关联的单位配置
rarity: Common
theme: green_wonderland
description: "基础单体物理输出，攻速快"
```

---

## 6. 代码组织

```
src/
  main.ts                    # 入口：装配PixiJS + bitecs World + 管线
  core/
    Game.ts                  # 主循环 + 协调器
    World.ts                 # bitecs World封装
    components.ts            # 所有defineComponent定义
    pipeline.ts              # 系统管线（8阶段）
    RuleEngine.ts            # 规则引擎
    RuleHandlers.ts          # 规则处理器
  config/
    loader.ts                # YAML加载器
    registry.ts              # 配置注册表
    units/                   # 单位YAML
    levels/                  # 关卡YAML
    cards/                   # 卡牌YAML
  systems/
    WaveSystem.ts            # 波次管理
    EconomySystem.ts         # 金币经济
    MovementSystem.ts        # 移动
    AttackSystem.ts          # 攻击
    ProjectileSystem.ts      # 弹道
    HealthSystem.ts          # 生命/死亡
    BuffSystem.ts            # Buff
    TrapSystem.ts            # 机关
    SkillSystem.ts           # 技能卡
    BuildSystem.ts           # 建造部署
    AISystem.ts              # AI状态机
    RenderSystem.ts          # ECS→PixiJS同步
    UISystem.ts              # HUD/面板
    WeatherSystem.ts         # 天气
    ParticleSystem.ts        # 粒子
    LifecycleSystem.ts       # 生命周期事件
  ai/
    BehaviorTree.ts          # 行为树引擎(预留)
    SoldierAI.ts             # 士兵四状态机
  render/
    Renderer.ts              # 渲染器主控
    MapRenderer.ts           # 地图网格
    EntityRenderer.ts        # 单位渲染
    ProjectileRenderer.ts    # 弹道
    ParticleRenderer.ts      # 粒子
    UIRenderer.ts            # UI渲染
  ui/
    HandZone.ts              # 手牌区
    CardPanel.ts             # 3选1面板
    UpgradePanel.ts          # 升级/出售浮窗
    BuffPanel.ts             # 关间Buff选择
    HUD.ts                   # 顶部信息条
  input/
    InputManager.ts          # 事件队列+每帧flush
    DragHandler.ts           # 拖卡交互
  types/
    index.ts                 # 类型定义、枚举
  utils/
    random.ts                # PRNG
```

---

## 7. 构建与测试

### 7.1 命令

```bash
npm run dev          # 开发服务器 (localhost:3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # 仅类型检查
npm test             # vitest 测试
npm run release      # clean + typecheck + build
```

### 7.2 TypeScript 配置要点

- `strict: true`
- `noUncheckedIndexedAccess: true` — 数组下标返回 `T | undefined`
- 导入使用 `.js` 后缀（Vite bundler模式要求）
- 路径别名: `@/`, `@core/`, `@systems/`, `@render/`, `@ui/`, `@input/`, `@utils/`, `@types/`

### 7.3 测试策略

| 类型 | 覆盖 | 工具 |
|------|------|------|
| 单元测试 | 战斗公式、经济计算、Buff系统、PRNG | Vitest |
| 集成测试 | 系统间交互（拖卡→部署→战斗） | Vitest |
| E2E测试 | 完整关卡流程 | Playwright |
| 性能 | 60fps保持 | 手动 |

---

## 8. 实施优先级

### Phase 1 — MVP（可玩最小版本）

- [ ] 第1关完整可玩（5波+精英3选1+塔升级）
- [ ] 核心ECS系统：Movement, Attack, Health, Build, Wave
- [ ] 基础渲染：地图网格+单位几何体+弹道+手牌区
- [ ] 4张初始手牌+拖卡部署
- [ ] 1-2种塔的完整升级路径
- [ ] 精英3选1面板

### Phase 2 — 内容扩展

- [ ] 全部5关+5个BOSS
- [ ] 10种塔+全部升级路径
- [ ] 4种士兵+8种机关
- [ ] 全部技能卡
- [ ] Buff系统
- [ ] 天气视觉+场景装饰
- [ ] 关间Buff选择

### Phase 3 — 打磨

- [ ] 音效系统
- [ ] 粒子特效完善
- [ ] UI动效（卡牌悬浮/拖拽/面板过渡）
- [ ] 响应式布局（1280×720 ~ 2560×1440）
- [ ] 性能优化（ParticleContainer、脏标记渲染）
- [ ] 数值平衡调优
