---
title: 科技树总览（v3.5）
status: authoritative
version: 2.0.0
last-modified: 2026-05-18
authority-for:
  - tech-tree-overview
  - tech-tree-node-structure
  - tech-tree-card-level-system
  - tech-tree-crystal-upgrade
  - tech-tree-gold-economy-binding
  - tech-tree-yaml-schema
  - tech-tree-ui-sketch
  - card-pool-ui
supersedes:
  - 22-skill-tree-overview v1.2.0（v3.4 技能树通用骨架；v3.5 重写为科技树总览，废弃 SP/路径互斥/instanceLevel）
  - 22-tower-tech-tree.md（v3.1，2026-05-15 deprecated）
cross-refs:
  - 10-gameplay/10-roguelike-loop.md      # v3.0.0 单 Run 闭环权威（v3.5）
  - 10-gameplay/11-economy.md             # v4.0.0 二资源轴（能量/金币）
  - 40-presentation/48-shop-redesign-v34.md   # 商店 + Crystal 升级入口（待 v3.5 更新）
  - 50-data-numerical/50-mda.md           # 数值真理源（§NEW-CRYSTAL Crystal 升级 + 卡牌升级费用）
  - 20-units/22a-skill-tree-tower.md      # 7 塔详设（待 v3.5 更新：spCost→goldCost）
  - 20-units/22b-skill-tree-soldier.md    # 6 士兵详设（待 v3.5 更新）
  - 20-units/22c-skill-tree-trap.md       # 9 陷阱详设（待 v3.5 更新）
  - 20-units/22d-skill-tree-spell.md      # 14 法术参数树（待 v3.5 更新，删精炼术）
  - 20-units/22e-skill-tree-production.md # 生产建筑详设（待 v3.5 更新）
  - 60-tech/61-save-system.md             # 待 v3.5 更新：crystalLevel 字段
  - v3.5-MAJOR-MIGRATION.md
  - v3.4-MAJOR-MIGRATION.md
---

# 科技树总览（v3.5）

> **v3.5 形态级新机制权威**：本文档定义 v3.5 科技树系统的**通用骨架** —— Crystal 升级机制、卡牌等级体系、节点金币解锁/升级规则、YAML schema、RunManager 接口、UI 草图。
>
> **v3.5 核心变更**（原 v3.4 技能树 → v3.5 科技树）：
> - ~~技能点 SP~~ → **金币（goldCost）** 驱动节点升级
> - ~~路径互斥单装备~~ → **线性等级成长**（Lv1 / Lv2 / Lv3，等同原 depth=1/2/3 节点效果）
> - ~~instanceLevel / 精炼术~~ → **整套废弃**（[v3.5-MAJOR-MIGRATION §6](../v3.5-MAJOR-MIGRATION.md)）
> - ✅ 新增 **Crystal 升级**：防御 Crystal 花金币升 Lv1→Lv3，提升人口上限 + 卡牌等级上限
> - ✅ **获卡=自动解锁科技树节点**（商店购卡 / 关卡奖励卡 → 该卡节点直接可用，无前置依赖图）
>
> **数值锚点**：所有金币升级费用、Crystal 费用统一来自 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位)。本文档**只描述字段语义、机制骨架、设计原则**，不持有具体数值。
>
> **单位详设**：本文档**不**描述具体单位的节点效果，请阅读：
> - 7 塔 → [22a-skill-tree-tower](./22a-skill-tree-tower.md)
> - 6 士兵 → [22b-skill-tree-soldier](./22b-skill-tree-soldier.md)
> - 9 陷阱 → [22c-skill-tree-trap](./22c-skill-tree-trap.md)
> - 14 法术 → [22d-skill-tree-spell](./22d-skill-tree-spell.md)
> - 2 生产建筑 → [22e-skill-tree-production](./22e-skill-tree-production.md)

---

## 目录

- [1. 设计目标与核心原则](#1-设计目标与核心原则)
- [2. v3.4 → v3.5 迁移说明](#2-v34--v35-迁移说明)
- [3. Crystal 升级机制](#3-crystal-升级机制)
- [4. 卡牌等级体系](#4-卡牌等级体系)
- [5. 节点结构（v3.5）](#5-节点结构v35)
- [6. 获卡与节点解锁](#6-获卡与节点解锁)
- [7. YAML 配置 Schema](#7-yaml-配置-schema)
- [8. RunManager 接口](#8-runmanager-接口)
- [9. UI 草图（科技树面板）](#9-ui-草图科技树面板)
- [10. 验收清单](#10-验收清单)
- [11. v3.5 不变式核对](#11-v35-不变式核对)
- [12. 影响文档清单](#12-影响文档清单)
- [13. 修订历史](#13-修订历史)

---

## 1. 设计目标与核心原则

### 1.1 设计目标

1. **本 Run 临时持有** —— 科技树状态**仅本 Run 内有效**，Run 结束清零，与 v3.5「单 Run 闭环」原则一致（[10-roguelike-loop §11 INV-01](../10-gameplay/10-roguelike-loop.md)）。
2. **流派成型感** —— 通过金币分配在 Crystal 升级 vs 卡牌升级之间做策略取舍，形成每 Run 独特的阵容风格。
3. **线性等级成长，消除路径困惑** —— 废弃路径互斥机制，改为 Lv1/Lv2/Lv3 线性成长。玩家直觉：「升级这张卡」而非「选择哪条路径」。
4. **获卡即解锁，零门槛使用** —— 商店购卡或关卡奖励卡一旦进入卡池，该卡的科技树节点立即可用（无需额外解锁步骤）。
5. **Crystal 是人口与等级的双控制器** —— Crystal 等级同时决定人口上限和卡牌等级上限，形成双向成长约束。
6. **配置驱动** —— 节点结构、效果差量、金币单价全部 YAML 化，策划可改不动代码。

### 1.2 核心原则

| 原则 | 描述 | 锁定方文档 |
|---|---|---|
| **本 Run 闭环** | 科技树状态在 `RunManager.techTreeState` 内存中，Run 结束清零 | [61-save-system](../60-tech/61-save-system.md)（待 v3.5 更新）|
| **金币单价驱动** | 节点升级花费 goldCost（金币），不再使用 SP | 本文档 §5 + [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md) |
| **线性等级上限** | 卡牌最高 Lv.3，受 Crystal 等级约束（Crystal Lv.N → 卡牌最高 Lv.N）| 本文档 §4 |
| **获卡自动解锁** | 进入卡池 → 该卡科技树节点自动可用，无需消耗金币"解锁" | 本文档 §6 |
| **Crystal 控制上限** | Crystal Lv.1/2/3 分别对应卡牌等级上限 1/2/3 和不同人口上限 | 本文档 §3 |
| **关内禁止升级** | 关内不出现「升级卡牌」按钮，仅关后/关间金币消耗 | 本文档 §4.4 |
| **instanceLevel 废弃** | 不再存在 instanceLevel / 精炼术机制 | [v3.5-MAJOR-MIGRATION §6](../v3.5-MAJOR-MIGRATION.md) |

---

## 2. v3.4 → v3.5 迁移说明

### 2.1 字段映射

| v3.4 字段 | v3.5 字段 | 迁移方式 |
|---|---|---|
| `nodes[].spCost` | `nodes[].goldCost` | 重命名（金币替代 SP）|
| `nodes[].id` / `name` / `effects[]` | 保持不变 | 节点设计完整继承 |
| `skillTree.paths[].nodes[]` | `skillTree.nodes[]`（线性数组）| 结构简化：废弃多路径设计 |
| `paths[].mutex` | **删除** | 路径互斥废弃 |
| `RunManager.skillPoints` | **删除** | SP 资源废弃 |
| `RunManager.skillTreeState` | `RunManager.techTreeState` | 重命名 + 结构调整 |
| `CardSkillTreeState.equippedPath` | **删除** | 路径互斥废弃 |
| `CardSkillTreeState.activeNodes` → | `CardTechTreeState.cardLevel` | 简化为等级整数 |

### 2.2 废弃机制总结

| v3.4 机制 | v3.5 处理 |
|---|---|
| 技能点 SP 资源 | **整套废弃**（货币改为金币）|
| 路径互斥单装备 | **废弃**（改为线性等级 Lv1-3）|
| instanceLevel / 精炼术 | **整套废弃**（23-skill-buff §7 整节删除）|
| 装备切换（0 SP 成本） | **废弃**（无路径互斥，不需要切换）|
| 前置节点 prerequisites | **废弃**（线性等级直接升，无前置依赖图）|
| 关卡通关 SP 奖励 | **废弃**（改为关后 3 选 1 节点奖励）|
| 商店金币→SP 兑换 | **废弃**（删除兑换槽）|

### 2.3 单位详设映射（待 v3.5 更新）

| 文档 | v3.4 状态 | v3.5 待处理 |
|---|---|---|
| [22a 塔](./22a-skill-tree-tower.md) | 7 塔 × 多路径 × spCost | spCost→goldCost，路径合并为线性 Lv1/2/3 效果 |
| [22b 士兵](./22b-skill-tree-soldier.md) | 6 士兵 × 2 路径 | 同上 |
| [22c 陷阱](./22c-skill-tree-trap.md) | 9 陷阱 × 2 路径 | 同上 |
| [22d 法术](./22d-skill-tree-spell.md) | 14 法术 × 4 参数路径 + 精炼术 | spCost→goldCost + 删精炼术 refining 节点 |
| [22e 生产](./22e-skill-tree-production.md) | 2 建筑 × 2 路径 | 同上 |

---

## 3. Crystal 升级机制

### 3.1 Crystal 是什么

**Crystal（防御水晶）** 是每 Run 开始时玩家拥有的防御核心建筑，同时也是：
1. **HP 资源**：Crystal HP 降至 0 则 Run 结束（失败）
2. **升级目标**：可在关间花金币升级 Lv1→Lv2→Lv3，提升战斗上限

### 3.2 Crystal 等级效果

| Crystal 等级 | 人口上限 | 卡牌等级上限 | 含义 |
|------------|---------|------------|------|
| **Lv.1（Run 初始）** | TBD | **1**（只能用 Lv1 卡牌效果）| 基础形态 |
| **Lv.2** | TBD（比 Lv1 更高）| **2**（可升级卡牌到 Lv2）| 强化形态 |
| **Lv.3** | TBD（比 Lv2 更高）| **3**（可升级卡牌到 Lv3）| 巅峰形态 |

> **TBD**：具体人口上限数值和升级费用（金币）在 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 中定义，待 50-mda 更新。

### 3.3 Crystal 升级规则

| 维度 | 规则 |
|------|------|
| **升级时机** | 仅关间节点可升级（商店内或专属 Crystal 升级选项），关内不可升级 |
| **升级方向** | 单向，Lv1 → Lv2 → Lv3，不可降级 |
| **单 Run 上限** | 最多从 Lv1 升到 Lv3（2 次升级） |
| **效果生效** | 升级后立即生效（人口上限提升 + 卡牌等级上限提升）|
| **Run 结束** | Crystal 等级随 Run 结束清零，下一 Run 从 Lv1 开始 |

### 3.4 Crystal 升级与金币分配策略

Crystal 升级与卡牌升级竞争同一金币资源，形成核心策略取舍：

```
金币 G
 ├──→ Crystal 升级（提升人口上限 + 卡牌等级上限）
 ├──→ 卡牌升级（提升特定卡牌效果等级，受 Crystal 上限约束）
 ├──→ 商店买卡（扩池，自动解锁科技树节点）
 └──→ 其他功能卡（能量瓶 / 水晶修复 / 手牌刷新）
```

**设计意图**：先升 Crystal 才能解锁高等级卡牌上限，但 Crystal 升级费用高。玩家需决策：「先扩阵容宽度（买卡）vs 先提升深度（Crystal 升级）vs 直接升核心卡」。

---

## 4. 卡牌等级体系

### 4.1 卡牌等级基本规则

| 维度 | 规则 |
|------|------|
| **等级范围** | Lv.1 / Lv.2 / Lv.3（三级）|
| **初始等级** | 每张卡进入卡池时为 Lv.1 |
| **升级货币** | 金币（goldCost，见 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md)）|
| **等级上限** | = 当前 Crystal 等级（Crystal Lv.2 → 卡牌最高升 Lv.2）|
| **升级时机** | 仅关间节点可升级，关内不可升级 |
| **效果叠加** | 每升一级，激活对应 depth 节点的 effects[]（差量叠加）|

### 4.2 卡牌等级 vs 原 depth 节点对应关系

v3.5 卡牌等级体系直接继承 v3.4 各 depth 层的效果设计：

| v3.5 卡牌等级 | 对应原 v3.4 节点 | 效果累积 |
|------------|----------------|---------|
| **Lv.1**（初始）| 原 depth=1 节点效果 | 基础特性 |
| **Lv.2** | 原 depth=1 + depth=2 节点效果 | 进阶特性 |
| **Lv.3** | 原 depth=1 + depth=2 + depth=3 节点效果 | 高阶特性 |

> **注**：22a-22e 中的多路径节点设计在 v3.5 更新时会合并/简化为线性三级效果。具体单位的每级效果描述见 22a-22e（待 v3.5 更新）。

### 4.3 卡牌等级与人口占用的关系

**卡牌等级本身不改变 energyCost（人口占用数）**。高等级卡只是效果更强，不增加部署成本。这确保玩家「升级核心卡」不会额外压缩人口空间。

### 4.4 关内禁止升级

- 关内**不出现「升级卡牌」按钮**。
- 玩家在关内仅可「放置单位 / 移除单位 / 施放法术」。
- 此规则保证关内战术节奏不被 meta 决策打断，符合 v3.5「分层清晰」原则。

---

## 5. 节点结构（v3.5）

### 5.1 节点是卡牌等级的效果载体

v3.5 节点语义变为「升到某等级时激活哪些效果」，不再承载「路径分叉 + SP 选择」的语义。

每个节点包含：
- `id`（字符串，全局唯一）
- `name`（中文显示名）
- `level`（对应卡牌等级，1-3；替代原 `depth` 字段）
- `goldCost`（升到此等级花费的金币；替代原 `spCost` 字段）
- `effects[]`（节点效果数组，描述「相对于上一等级新增/覆盖的差量」，由规则引擎 dispatch handler 实现）

### 5.2 节点等级与金币单价（50-mda §NEW-CRYSTAL 锚点）

| 卡牌等级 | 金币单价 | 设计意图 |
|---|---|---|
| **Lv.1**（入手默认）| 0 G（自动获得）| 获卡即可用基础效果，零门槛 |
| **Lv.2**（进阶）| TBD（50-mda §NEW-CRYSTAL）| 核心强化，需要 Crystal Lv.2 解锁上限 |
| **Lv.3**（高阶）| TBD（50-mda §NEW-CRYSTAL）| 终极强化，需要 Crystal Lv.3 解锁上限 |

> **TBD**：具体金币单价在 50-mda §NEW-CRYSTAL 中定义，待 50-mda 更新。

### 5.3 节点效果（effects 数组）

与 v3.4 机制相同：每个节点 `effects[]` 是规则引擎 RuleHandler 引用数组，差量语义（relative to 上一等级）。

```yaml
effects:
  - rule: add_projectile_count       # RuleHandler 名
    value: 1
  - rule: mul_attack_interval
    value: 0.4
```

### 5.4 节点效果类型枚举（与 v3.4 相同）

| 类型 | 例子 RuleHandler | 应用场景 |
|---|---|---|
| **数值修饰** | `add_atk` / `mul_attack_interval` / `add_range` / `add_hp_max` | 数值加成 |
| **形态切换** | `set_form_id` / `set_element_type` / `set_visual` | 改变单位形态/元素属性 |
| **能力新增** | `add_projectile_count` / `add_burning_on_hit` / `add_chain_jump` | 新增主动/被动能力 |
| **特殊机制** | `trigger_screen_lightning_with_cd` / `add_focus_charge` | 单单位特化机制 |

### 5.5 节点效果的局限（边界）

- 节点效果**只能修改单位静态属性 / 注入行为规则**，不能修改全局规则（如金币奖励倍率、能量上限）
- 节点效果**不能跨单位生效**（不能 A 塔的节点 buff B 塔）
- ~~节点效果不允许出现 `add_instance_level` handler~~ → v3.5 instanceLevel 整套废弃，此规则不再需要

---

## 6. 获卡与节点解锁

### 6.1 获卡=自动解锁科技树节点（无前置依赖）

**v3.5 的核心设计简化**：卡牌科技树节点**不需要额外金币"解锁"步骤**。

| 获卡途径 | 节点解锁结果 |
|---------|------------|
| 商店购卡（花金币买卡） | 该卡进入卡池，该卡科技树所有节点**立即可用**（可升级）|
| 关卡通关 3 选 1 奖励卡 | 同上 |
| 秘境事件奖励卡 | 同上 |
| Run 开局起手卡 | 同上 |

**「可用」的含义**：
- 节点可被升级（花金币升级该卡到 Lv2/Lv3）
- 无需任何前置节点满足（无前置依赖图）
- 唯一约束：受 Crystal 等级上限（Crystal Lv.1 时，即使你有金币也不能升到 Lv2/Lv3）

### 6.2 无前置依赖图（简化认知）

v3.5 废弃了 v3.4 的 `prerequisites` 字段（前置节点依赖）：

- **v3.4**：点亮 depth=3 节点必须先点亮 depth=1 + depth=2 → 有依赖图
- **v3.5**：升级到 Lv.3 必须先升 Lv.1 → Lv.2（线性，但唯一约束是 Crystal 等级上限）

玩家心智模型：「我的 Crystal 升到 Lv2 了，现在可以把这张核心塔卡升到 Lv2。」

### 6.3 金币「买卡」vs「升级卡」的设计边界

| 操作 | 金币消耗 | 效果 |
|------|---------|------|
| 商店购买新卡 | 购买价格（50-mda §14） | 卡进入卡池（Lv1 免费）|
| 升级已有卡 Lv1→Lv2 | goldCost Lv2（50-mda §NEW-CRYSTAL）| 该卡牌效果增强 |
| 升级已有卡 Lv2→Lv3 | goldCost Lv3（50-mda §NEW-CRYSTAL）| 该卡牌效果进一步增强 |

---

## 7. YAML 配置 Schema

### 7.1 单位 YAML 中的 `skillTree` 字段（v3.5 更新版）

```yaml
arrow_tower:
  id: arrow_tower
  name: 箭塔
  category: tower
  baseStats:
    hp: 100
    atk: 20
    range: 200
    attackInterval: 1.0
  skillTree:
    nodes:
      - id: arrow_lv1
        name: 箭塔 Lv.1
        level: 1                 # 对应卡牌等级（替代 depth）
        goldCost: 0              # 入手自动获得，无需花金币
        effects: []              # Lv.1 即基础形态，差量为空
      - id: arrow_lv2
        name: 箭塔 Lv.2
        level: 2
        goldCost: 80             # 示例值，具体见 50-mda §NEW-CRYSTAL
        effects:
          - rule: add_projectile_count
            value: 1             # 新增 1 发投射物（总 2 发）
          - rule: mul_attack_interval
            value: 0.9           # 攻速微提升
      - id: arrow_lv3
        name: 箭塔 Lv.3
        level: 3
        goldCost: 180            # 示例值，具体见 50-mda §NEW-CRYSTAL
        effects:
          - rule: add_projectile_count
            value: 1             # 再增 1 发（总 3 发）
          - rule: add_burning_on_hit
            duration: 2.0
            tickRatio: 0.15
```

### 7.2 关键字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `skillTree.nodes[]` | 数组 | 是 | 该单位所有等级节点（1-3 个，对应 Lv1/2/3）|
| `nodes[].id` | string | 是 | 节点全局唯一 ID |
| `nodes[].name` | string | 是 | 中文显示名 |
| `nodes[].level` | int | 是 | 卡牌等级（1-3，替代 depth）|
| `nodes[].goldCost` | int | 是 | 升到此等级花费金币（Lv1=0，Lv2/Lv3 见 50-mda）|
| `nodes[].effects` | object[] | 否 | RuleHandler 引用数组（差量语义）|

> **废弃字段**：`paths[]`（多路径）、`spCost`（SP 费用）、`prerequisites`（前置依赖）、`mutex`（路径互斥）——这些 v3.4 字段在 v3.5 全部删除。

### 7.3 Lv.1 goldCost = 0 的设计意图

- 获卡=进入卡池=Lv.1 效果立即生效，无需额外付费
- 玩家从 Lv.1 开始决策「是否值得花金币升到 Lv.2」
- 金币全部投入「真正的等级提升」

---

## 8. RunManager 接口

### 8.1 RunManager.techTreeState 数据结构

> **v3.5 实例级科技树**：科技树状态以**卡牌实例 ID（cardInstanceId）** 为 key，同一种类的两张箭塔卡各自独立。

```typescript
interface RunManager {
  crystalLevel: 1 | 2 | 3          // Crystal 当前等级（v3.5 新增，替代 skillPoints）
  techTreeState: TechTreeState      // 本 Run 科技树状态（v3.5：替代 skillTreeState）
  // ... 其他字段
}

interface TechTreeState {
  // key = cardInstanceId（每张卡在本 Run 内的唯一实例 ID）
  instances: Record<string, CardTechTreeState>
}

interface CardTechTreeState {
  unitCardId: string               // 对应的卡种类 ID（如 'arrow_tower'）
  cardLevel: 1 | 2 | 3            // 当前卡牌等级（替代 activeNodes Set）
}
```

**v3.4 → v3.5 接口变更**：

| v3.4 字段 | v3.5 字段 | 变更原因 |
|---|---|---|
| `skillPoints: number` | **删除** | SP 废弃 |
| `skillTreeState` | `techTreeState` | 重命名 |
| `CardSkillTreeState.activeNodes: Set<string>` | `CardTechTreeState.cardLevel: 1\|2\|3` | 线性等级简化 |
| `CardSkillTreeState.equippedPath: string\|null` | **删除** | 路径互斥废弃 |

**实例 ID 生命周期**（与 v3.4 相同）：
- 卡牌进入卡池时分配唯一 `cardInstanceId`
- 卡牌战场被击杀 → 实例状态**保留**（关内死亡不清零升级投入）
- Run 结束 → `resetTechTreeState()` 清零

### 8.2 核心接口

```typescript
class RunManager {
  // 升级卡牌（花金币）
  // 返回 false：金币不足 / 未找到实例 / 已达 Crystal 等级上限 / 已在最高级
  upgradeCard(cardInstanceId: string): boolean

  // Crystal 升级（花金币）
  // 返回 false：金币不足 / 已 Lv.3
  upgradeCrystal(): boolean

  // 查询该卡实例当前生效的 effects（Lv.1 到当前等级所有节点差量合并）
  resolveCardEffects(cardInstanceId: string): Effect[]

  // Run 结束清零（[10-roguelike-loop §6](../10-gameplay/10-roguelike-loop.md)）
  resetTechTreeState(): void
}
```

### 8.3 边界检查

`upgradeCard(cardInstanceId)` 的失败条件：

| 失败原因 | 错误码 |
|---|---|
| 金币不足 | `INSUFFICIENT_GOLD` |
| cardInstanceId 不存在 | `INSTANCE_NOT_FOUND` |
| 已达 Crystal 等级上限（如 Crystal Lv.1，卡已 Lv.1，无法升 Lv.2）| `CRYSTAL_LEVEL_CAP` |
| 卡已达 Lv.3（最高级）| `ALREADY_MAX_LEVEL` |

---

## 9. UI 草图（科技树面板）

### 9.1 入口

玩家通过**关后路线图屏幕上的「科技树」按钮**进入科技树面板，与 3 选 1 路径（商店/秘境/跳过）平行，**不消耗节点机会**，可自由进入、规划、退出。

### 9.2 科技树面板布局（左右分栏一体式）

```
全屏 1920×1080：

┌─────────────────────────────────────────────────────────────────────┐
│  🔬 科技树 — 关 4 通关后        💎 Crystal Lv.2    💰 金币: 320 G   │
├──────────────────────────┬──────────────────────────────────────────┤
│                          │                                           │
│  本 Run 卡池             │  🏹 箭塔 #1                              │
│  ──────────              │  ─────────────────────────────────        │
│                          │  当前等级：Lv.2 ★★☆                       │
│  🏹 塔                   │  等级上限：Lv.2（Crystal Lv.2 限制）       │
│  ┌────┐ ┌────┐ ┌────┐    │                                           │
│  │箭塔│ │炮塔│ │电塔│    │  Lv.1 ✓ 普通箭塔（已获得）                │
│  │★★☆ │ │★☆☆ │ │★★☆ │    │    ↓                                      │
│  └────┘ └────┘ └────┘    │  Lv.2 ✓ 双重箭塔（已升级）                │
│  [选中，蓝色高亮]         │    效果：+1 发投射物（总 2 发）            │
│                          │    ↓                                      │
│  ⚔ 士兵                  │  Lv.3 🔒 三重箭塔（需 Crystal Lv.3）       │
│  ┌────┐ ┌────┐            │    效果：+1 发（总 3 发）+ 灼烧           │
│  │盾卫│ │剑士│            │    花费：180 G（🔒 Crystal 未达 Lv.3）    │
│  │★☆☆ │ │★★☆ │            │                                           │
│  └────┘ └────┘            │                                           │
│                          │  ─────────────────────────────────        │
│  💥 法术（无等级系统）     │  [升级到 Lv.3]（灰色/禁用）              │
│  ─────────────           │                                           │
│  🛠 陷阱                  │                                           │
│  ⚙ 生产                  │  💎 Crystal Lv.2 → Lv.3：[X G]（升级）   │
│                          │                                           │
├──────────────────────────┴──────────────────────────────────────────┤
│  💰 金币: 320 G    💎 Crystal Lv.2（卡牌最高等级：Lv.2）   [关闭]   │
└─────────────────────────────────────────────────────────────────────┘
```

**布局说明**：

| 区域 | 占屏宽 | 内容 |
|---|---|---|
| 顶栏 | 100% × 50px | 标题 + Crystal 当前等级 + 金币余额 |
| 左栏（卡池列表）| 30% × ~970px | 本 Run 卡池所有卡牌实例，按类别分组 |
| 右栏（卡牌详情）| 70% × ~970px | 选中卡的等级进度条 + 升级按钮 |
| 底栏 | 100% × 50px | 金币余额 + Crystal 等级 + 关闭按钮 |

### 9.3 视觉规范

| 元素 | 视觉处理 |
|---|---|
| 选中卡（左栏）| 高亮边框（主题蓝色）|
| 卡牌等级标识 | ★☆☆ / ★★☆ / ★★★（实心/空心星，当前等级实心）|
| 已解锁等级节点 | 绿色勾 ✓ + 效果文字展示 |
| 可升级等级（金币够 + Crystal 够）| 高亮按钮 [升级到 LvX - Y G] |
| 受 Crystal 等级限制的节点 | 🔒 锁图标 + 灰色 + 「需 Crystal Lv.X」提示 |
| Crystal 升级按钮（底部）| 始终显示，Crystal 已 Lv.3 则灰色 |

### 9.4 交互流程

1. 进入界面 → 展示本 Run 卡池所有卡牌（左栏），按类别分组
2. **默认选中第一张卡**，右侧显示该卡等级进度
3. 点击左栏某卡 → 右栏实时切换为该卡信息（无页面跳转）
4. 右栏显示 Lv.1/Lv.2/Lv.3 三个节点状态（已获得/可升级/锁定）
5. 点击「升级到 Lv.X」→ 扣金币，节点高亮，卡牌等级提升
6. Crystal 升级按钮（右栏底部/底栏）→ 花金币升 Crystal，解锁更高卡牌等级上限
7. 底栏点击「关闭」→ 返回关后路线图

---

## 10. 验收清单

### 10.1 Crystal 升级

- [ ] Crystal 初始 Lv.1，关间消耗金币升级
- [ ] Crystal Lv.1/2/3 对应不同人口上限（50-mda §NEW-CRYSTAL）
- [ ] Crystal 等级 = 当前 Run 内卡牌等级上限
- [ ] Run 结束 Crystal 等级清零（回到 Lv.1）
- [ ] 关内不可升级 Crystal

### 10.2 卡牌等级

- [ ] 卡牌等级 Lv.1/2/3 线性升级，不可跳级
- [ ] 升级消耗金币（goldCost），数值见 50-mda §NEW-CRYSTAL
- [ ] 卡牌等级受 Crystal 等级约束（Crystal Lv.2 → 卡最高 Lv.2）
- [ ] Lv.1 节点 goldCost = 0，入手自动获得
- [ ] 关内不可升级卡牌等级

### 10.3 节点解锁

- [ ] 获卡（商店/奖励）→ 该卡 Lv.1 节点自动可用，无需额外操作
- [ ] 无 prerequisites 前置依赖检查（废弃）
- [ ] 无路径互斥机制（废弃）

### 10.4 废弃机制不再出现

- [ ] 代码中不存在 `skillPoints` / `spCost` 相关逻辑
- [ ] 代码中不存在 `instanceLevel` / `精炼术 refining` 相关逻辑
- [ ] 代码中不存在 `equippedPath` / `mutex` 相关逻辑
- [ ] YAML 中不存在 `paths[]` 多路径结构（已迁移为线性 `nodes[]`）

### 10.5 UI

- [ ] 科技树面板左右分栏，左栏卡池列表 + 右栏卡牌等级详情
- [ ] 卡牌等级显示 ★☆☆ / ★★☆ / ★★★
- [ ] Crystal 等级上限约束在 UI 可见（🔒 图标）
- [ ] Crystal 升级按钮可用（金币足够 + 未达 Lv.3）

---

## 11. v3.5 不变式核对

| 不变式 | 来源 | 本文档核对 |
|---|---|---|
| INV-01 单 Run 闭环 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ 科技树状态本 Run 临时，Run 结束清零 |
| INV-11 人口持续占用 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ Crystal 等级控制人口上限，升级才能扩容 |
| INV-12 instanceLevel 不存在 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ instanceLevel 废弃，本文档不含此机制 |
| INV-13 关外卡池每种唯一 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ 获卡=唯一一张（与等级升级体系正交）|
| Crystal Lv = 卡牌等级上限 | 本文档 §3.2 | ✅ 机制核心约束 |
| 获卡=自动解锁 | 本文档 §6.1 | ✅ 无前置依赖图 |
| 关内禁止升级 | 本文档 §4.4 | ✅ 升级仅关间 |
| 火花碎片词汇禁用 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文不含"火花碎片"/"shard" |
| SP/技能点词汇禁用 | [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md) | ✅ 全文不含"技能点 SP"（仅作为废弃历史对照）|

---

## 12. 影响文档清单

### 12.1 本文档接替关系

| 旧文档 | 接替方式 |
|---|---|
| [22-skill-tree-overview v1.2.0（v3.4 技能树）](./22-skill-tree-overview.md) | 本文档 v2.0.0（v3.5 科技树总览）整文重写接替 |
| [22-tower-tech-tree v3.1（deprecated）](./22-tower-tech-tree.md) | 同上 |

### 12.2 待更新的下游文档（v3.5 第 2 轮）

| 文档 | 待处理 |
|---|---|
| [22a-22e 详设文档](./22a-skill-tree-tower.md) | spCost→goldCost，路径合并为线性等级，删精炼术（22d）|
| [23-skill-buff §7](./23-skill-buff.md) | instanceLevel 整节删除 |
| [48-shop-redesign](../40-presentation/48-shop-redesign-v34.md) | 删 SP 槽，可能新增 Crystal 升级入口 |
| [61-save-system](../60-tech/61-save-system.md) | skillPoints→crystalLevel，skillTreeState→techTreeState |

---

## 13. 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | v3.4 第 3 轮 | v3.4 技能树通用骨架创建（13 章）|
| 1.1.0 | 2026-05-16 | — | 实例级技能树 + 卡池 UI 入口 |
| 1.2.0 | 2026-05-17 | — | 卡池界面改为左右分栏一体式 |
| 2.0.0 | 2026-05-18 | v3.5 第 1 轮 | **整文重写**：技能树总览→科技树总览；废弃 SP/路径互斥/instanceLevel；新增 Crystal 升级机制（§3）；卡牌等级体系（§4）线性 Lv1-3 替代多路径；YAML schema 更新（paths→nodes，spCost→goldCost，删 prerequisites/mutex）；RunManager 接口更新（skillPoints→crystalLevel，skillTreeState→techTreeState，CardSkillTreeState.cardLevel）；UI 草图重写（等级进度条 + Crystal 升级按钮）；不变式更新（删 INV-03/04/08，增 INV-11/12/13）；影响文档清单更新 |
