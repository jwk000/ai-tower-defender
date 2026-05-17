---
title: 塔科技树详设（v3.5）
status: authoritative
version: 1.3.0
last-modified: 2026-05-18
authority-for:
  - tower-skill-tree
  - tower-path-nodes
  - tower-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/21-unit-roster.md
  - 20-units/26-missile-special.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - 40-presentation/48-shop-redesign-v34.md
  - v3.5-MAJOR-MIGRATION.md
  - v3.4-MAJOR-MIGRATION.md
supersedes:
  - 20-units/22-tower-tech-tree.md（v3.1，已 deprecated）
---

# 塔科技树详设（v3.5）

> ⚠️ **v3.5 形态级变更声明（2026-05-18）**：本文档节点设计将在 v3.5 第 2 轮全面更新（详见 [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md)）。v3.5 核心变更：
> - ~~`spCost`~~ → **`goldCost`**（技能点 SP 废弃，改用金币升级）
> - ~~路径互斥单装备~~ → **线性等级 Lv.1/Lv.2/Lv.3**（每条路径深度节点合并为对应等级效果）
> - ~~`prerequisites`/`mutex`~~ → **删除**（获卡=自动解锁，无前置依赖）
> - 节点设计（RuleHandler 效果）本身**保留**，字段名和结构已按 v3.5 重写
>
> **当前文档状态**：节点内容已切换为 v3.5（goldCost/nodes 结构），保留原 v3.4 战斗效果语义。

> ⭐ **本文档是 7 个塔单位科技树的唯一权威详设**。所有节点 ID / 等级节点 / 金币单价占位 / RuleHandler 引用以本文档为准；通用骨架（线性等级、金币升级、获卡自动解锁、YAML schema）见 [22-skill-tree-overview v2.0.0](./22-skill-tree-overview.md)（v3.5 科技树总览）。

> 🛑 **本文档蓝本式继承 v3.1 [22-tower-tech-tree §4](./22-tower-tech-tree.md#4-七塔完整科技树) 七塔节点设计**，节点能力描述与 RuleHandler 语义完整保留；仅将 v3.4 的多路径 / `spCost` / `prerequisites` 结构迁移为 v3.5 的线性等级 / `goldCost` / 自动解锁结构（金币占位统一锚定 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位)）。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定](#2-通用约定)
- [3. 七塔主动技能（关内手动触发）](#3-七塔主动技能关内手动触发) ← **v3.4 节奏优化新增**
- [4. 七塔科技树清单（概览）](#4-七塔科技树清单概览)
- [5. 箭塔 · `arrow_tower`](#5-箭塔--arrow_tower)
- [6. 炮塔 · `cannon_tower`](#6-炮塔--cannon_tower)
- [7. 元素塔 · `elemental_tower`（原冰塔）](#7-元素塔--elemental_tower原冰塔)
- [8. 电塔 · `lightning_tower`](#8-电塔--lightning_tower)
- [9. 激光塔 · `laser_tower`](#9-激光塔--laser_tower)
- [10. 蝙蝠塔 · `bat_tower`](#10-蝙蝠塔--bat_tower)
- [11. 导弹塔 · `missile_tower`](#11-导弹塔--missile_tower)
- [12. 七塔科技树升级费用与流派覆盖](#12-七塔科技树升级费用与流派覆盖)
- [13. RuleHandler 引用清单](#13-rulehandler-引用清单)
- [14. v3.5 不变式核对](#14-v35-不变式核对)
- [15. 修订历史](#15-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责塔单位（`category: tower`）的科技树详设，每塔一节，内容包括：

- 塔定位（一句话功能描述）
- 等级表（Lv.1 / Lv.2 / Lv.3 的节点梯度、节点能力、形态名）
- YAML 配置示例（完整 `skillTree` 字段示例，可直接 copy 到 `config/units/towers.yaml`）
- 节点 effects[] 的 RuleHandler 引用说明
- 线性升级下的特殊机制（如元素塔分支语义如何并入等级、导弹塔同坐标多发射）

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 线性等级 / 金币升级 / 关内禁止升级 | [22-skill-tree-overview](./22-skill-tree-overview.md)（通用骨架）|
| 金币数值 / Crystal 升级费用 / 卡牌升级费用 | [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) |
| RuleHandler 注册表 / 实现 | `src/core/RuleHandlers.ts` + [60-architecture §5.3](../60-tech/60-architecture.md) |
| 塔单位基础属性（HP / ATK / range / interval） | [21-unit-roster §2](./21-unit-roster.md) |
| 塔实例临时强化（instanceLevel）| [23-skill-buff §7](./23-skill-buff.md) |
| 导弹塔地格评分逻辑 | [26-missile-special](./26-missile-special.md) |
| 蝙蝠塔天气依赖逻辑 | [21-unit-roster §2.2 蝙蝠塔](./21-unit-roster.md#蝙蝠塔bat_tower天气依赖) + [14-weather](../10-gameplay/14-weather.md) |

### 1.3 阅读建议

1. **第一次读**：先读 [22-skill-tree-overview](./22-skill-tree-overview.md) 通用骨架（§5 节点结构 + §6 获卡与节点解锁 + §7 YAML schema）→ 再读本文档某塔节点设计。
2. **数值校验**：所有 `goldCost` 必须锚定 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位)；当前除 Lv.1 固定 `0` 外，其余统一记为 `TBD`，待 50-mda 回填。
3. **配置落地**：本文档 YAML 示例可直接 copy 到 `config/units/towers.yaml`，但具体单位基础属性（baseStats）以 [21-unit-roster](./21-unit-roster.md) 为准。

---

## 2. 通用约定

### 2.1 线性等级与金币升级

| 卡牌等级 | goldCost | 说明 |
|---|---|---|
| **Lv.1**（获卡默认） | **0** | 单位卡进入卡池即可用，无需额外付费 |
| **Lv.2**（进阶） | **TBD** | 金币升级解锁进阶效果，受 Crystal Lv.2 上限约束 |
| **Lv.3**（高阶） | **TBD** | 金币升级解锁高阶效果，受 Crystal Lv.3 上限约束 |

> ⚠️ **本文档全部 `goldCost` 以 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 为唯一锚点**。在数值未定稿前，Lv.2 / Lv.3 一律填写 `TBD`，**严禁本文档自行补数值**。

### 2.2 effects[] 写法（差量语义）

每个节点 `effects[]` 是 RuleHandler 引用数组，**只描述相对上一等级（level-1）的差量变化**。

```yaml
- id: arrow_tower_lv2
  name: 箭塔 Lv.2
  level: 2
  goldCost: TBD
  effects:
    - rule: add_projectile_count  # 弹丸数 +1（差量）
      value: 1
```

配置加载器在卡牌升级时合并所有已激活等级节点的 `effects[]`，生成单位最终运行时属性（详 [22-overview §5.3](./22-skill-tree-overview.md#53-节点效果effects-数组)）。

### 2.3 线性三等级

每塔统一采用 **Lv.1 → Lv.2 → Lv.3** 线性成长：

- 获卡即自动拥有 Lv.1 形态
- Lv.2 / Lv.3 只在关间消耗金币升级，关内禁止升级（详 [22-overview §4.4](./22-skill-tree-overview.md#44-关内禁止升级)）
- 原 v3.4 的多路径流派语义，统一折叠进对应等级节点的 `effects[]` 与说明文字中

### 2.4 等级图例

每塔节标题下使用统一图例：

```
{单位名} Lv.1 ●────Lv.2 ○────Lv.3 ○
```

- ● = 获卡默认可用（Lv.1 / goldCost=0）
- ○ = 待升级节点
- 金币价格统一见 `goldCost`

---

## 3. 七塔主动技能（关内手动触发）

> **v3.4 节奏优化新增（2026-05-17）**：每座塔拥有 1 个可关内手动触发的主动技能，不消耗能量，各塔独立 CD。这是「建议 D」的落地——给玩家在出卡之外提供持续的微操决策点，填充「能量不足时的等待窗口」。
>
> **主动技能规则边界**（与 [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止升级) 一致）：
> - 无论当前卡牌等级是 Lv.1 / Lv.2 / Lv.3，主动技能始终可用（与科技树等级正交）
> - 点击场上的塔实体即可触发；触发时塔有高亮闪光视觉反馈
> - **不消耗能量**（为玩家提供零成本决策点）
> - CD 期间按钮变灰，倒计时显示在塔头顶
> - 数值（CD、效果量）权威见 [50-mda §12.4](../50-data-numerical/50-mda.md#124-塔主动技能-cd--效果数值)

### 3.1 七塔主动技能一览

| 塔 | 主动技能名 | 效果 | CD |
|---|---|---|---|
| 箭塔 `arrow_tower` | **齐射** | 立即向射程内所有敌人各发射 1 支箭（单次 AoE 弹雨，伤害同普通攻击）| 12s |
| 炮塔 `cannon_tower` | **精准轰炸** | 对当前目标立即发射 1 枚高爆炮弹（伤害 × 2.5，AoE 半径 × 1.5）| 15s |
| 元素塔 `elemental_tower` | **元素爆发** | 以塔为中心释放圆形元素爆炸（半径 80px），效果随当前元素形态：冰→群体冻结 2s / 火→群体灼烧 DOT / 毒→群体中毒传播 | 18s |
| 电塔 `lightning_tower` | **过载放电** | 立即对场上所有敌人释放 1 跳链式闪电（伤害为普通攻击的 60%，穿透无限跳数）| 20s |
| 激光塔 `laser_tower` | **全功率扫射** | 激光旋转 360° 扫射一圈，持续 2s，期间伤害 × 1.5 | 16s |
| 蝙蝠塔 `bat_tower` | **召唤蝠群** | 召唤 3 只临时幽灵蝙蝠（HP 极低，存活 8s，沿路径追杀敌人）| 14s |
| 导弹塔 `missile_tower` | **饱和打击** | 立即发射 3 枚导弹（自动分散锁定场上 HP 最高的 3 个敌人，按 26-missile-special 地格评分选点）| 25s |

### 3.2 YAML schema（主动技能字段）

每个塔 YAML 在顶层新增 `activeSkill` 字段：

```yaml
arrow_tower:
  id: arrow_tower
  name: 箭塔
  category: tower
  activeSkill:
    id: arrow_volley
    name: 齐射
    cdSeconds: 12                    # 冷却时间（秒），数值权威 50-mda §12.4
    triggerType: manual              # manual = 玩家点击触发
    effects:
      - rule: fire_at_all_in_range   # 向范围内所有目标各发 1 支箭
        damageRatio: 1.0             # 伤害倍率（相对于普通攻击）
  skillTree:
    nodes: [ ... ]                   # 科技树等级节点（v3.5）
```

> **RuleHandler 引用**：`fire_at_all_in_range` / `instant_aoe_hit` / `temp_summon_unit` / `multi_missile_strike` 等主动技能专用 Handler 需在 `src/core/RuleHandlers.ts` 注册（[60-architecture §5.3](../60-tech/60-architecture.md)）。

---

## 4. 七塔科技树清单（概览）

| 塔 ID | 中文名 | 等级节点数 | Lv.1 | Lv.2 | Lv.3 | 备注 |
|---|---|---|---|---|---|---|
| `arrow_tower` | 箭塔 | 3 | 基础单发 | 多重射击 + 高频火力并入 | 三重齐射 + 灼烧并入 | 物理单体远程，经济友好 |
| `cannon_tower` | 炮塔 | 3 | 基础 AOE | 重炮控制 + 狙击模式并入 | 击退 + 贯穿并入 | 物理 AOE / 单发高伤混合 |
| `elemental_tower` | 元素塔（原冰塔）| 3 | 冰系基础 | 冰冻 / 火焰 / 巫毒语义并入 | 霜冻 / 真火 / 病毒高阶并入 | 控制 / 元素效果 |
| `lightning_tower` | 电塔 | 3 | 1 次弹跳 | 2 次弹跳 | 3 次弹跳 + 全屏闪电并入 | 原 depth=4 效果折叠进 Lv.3 |
| `laser_tower` | 激光塔 | 3 | 1 道激光 | 扇形覆盖 + 稳压锁定并入 | 多光束 + 蓄能聚焦并入 | 聚焦 / 持续输出 |
| `bat_tower` | 蝙蝠塔 | 3 | 3 蝙蝠 | 4 蝙蝠 + ATK↑ | 5 蝙蝠 + 进一步 ATK↑ | 群体单位，天气依赖 |
| `missile_tower` | 导弹塔 | 3 | 单发导弹 | 双联齐射 + 温压灼烧并入 | 集束导弹 + 核弹强化并入 | 战略大射程打击 |

### 4.1 关键结构解读

- **每塔固定 3 个等级节点**：Lv.1 默认拥有，Lv.2 / Lv.3 通过金币升级。
- **原多路径流派不删除**：其差量 RuleHandler 被合并到对应等级节点中，并在说明文字中保留流派语义。
- **电塔特例**：原 depth=4「闪电塔」效果并入 Lv.3，因此依然完整保留终极爆点设计。

### 4.2 单 Run 金币分配视角

- v3.5 的核心选择不再是“点哪条路径”，而是 **买卡 / 升 Crystal / 升某张卡到 Lv.2 或 Lv.3**。
- 由于 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 仍为 TBD，本文档只锁定结构，不锁定具体金币预算。
- 设计意图保持不变：玩家仍需在“广撒网扩阵容”和“深耕核心塔等级”之间做取舍。

---

## 5. 箭塔 · `arrow_tower`

**塔定位**：物理单体远程，基础经济友好型。

### 5.1 等级图

```
箭塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 5.2 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 箭塔 Lv.1 | 0 | 普通箭塔单发；默认基础形态 |
| **Lv.2** | 箭塔 Lv.2 | TBD | **多重射击方向**：弹丸数 +1；**高频火力方向**：攻击间隔 ×0.4、单发伤害 ×0.5 |
| **Lv.3** | 箭塔 Lv.3 | TBD | **多重射击方向**：再 +1 弹丸（共三发）；**高频火力方向**：命中附加灼烧 DOT |

### 5.3 YAML 配置

```yaml
arrow_tower:
  id: arrow_tower
  name: 箭塔
  category: tower
  # baseStats 见 21-unit-roster §2.1
  skillTree:
    nodes:
      - id: arrow_tower_lv1
        name: 箭塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: arrow_tower_lv2
        name: 箭塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_projectile_count
            value: 1
          - rule: mul_attack_interval
            value: 0.4
          - rule: mul_atk
            value: 0.5
      - id: arrow_tower_lv3
        name: 箭塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_projectile_count
            value: 1
          - rule: add_burning_on_hit
            duration: 2.0
            tickRatio: 0.2
```

### 5.4 设计说明

- 原两条路径的“质 vs 量”取舍改为**同一张卡线性成长中的双轴强化**：Lv.2 同时获得分裂箭与连弩特性，Lv.3 再叠加三重箭与灼烧补强。
- 原“攻速↑伤害↓”组合依旧保留，作用是让箭塔输出曲线更稳定，而非单纯堆高峰值。
- 灼烧 DOT 仍限定为命中后的附加持续伤害，不把箭塔改造成纯 AOE 塔。

---

## 6. 炮塔 · `cannon_tower`

**塔定位**：物理 AOE 范围伤害，主清杂兵。

### 6.1 等级图

```
炮塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 6.2 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 炮塔 Lv.1 | 0 | 普通炮塔，AOE 范围伤害 |
| **Lv.2** | 炮塔 Lv.2 | TBD | **控场 AOE 方向**：命中按概率眩晕；**狙击穿透方向**：攻击间隔 ×2、射程 ×1.5、攻击 ×2.5、切换为单体模式 |
| **Lv.3** | 炮塔 Lv.3 | TBD | **控场 AOE 方向**：命中击退；**狙击穿透方向**：弹道贯穿 ≤2 目标 |

### 6.3 YAML 配置

```yaml
cannon_tower:
  id: cannon_tower
  name: 炮塔
  category: tower
  skillTree:
    nodes:
      - id: cannon_tower_lv1
        name: 炮塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: cannon_tower_lv2
        name: 炮塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_stun_on_hit
            probability: 0.3
            duration: 0.5
          - rule: mul_attack_interval
            value: 2.0
          - rule: mul_range
            value: 1.5
          - rule: mul_atk
            value: 2.5
          - rule: set_attack_mode
            mode: single_target
      - id: cannon_tower_lv3
        name: 炮塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_knockback_on_hit
            distance: 60
          - rule: add_pierce
            maxTargets: 2
```

### 6.4 设计说明

- 原路径 1 的 AOE 控场与原路径 2 的单体狙击，被合并为**先重炮控场、后战术精修**的线性成长。
- `set_attack_mode: single_target` 仍保留，说明 Lv.2 起炮塔已具备“狙击化”行为分支，只是作为成长阶段的一部分而非二选一分叉。
- Lv.3 同时拿到击退与贯穿，强化“高质量单发炮击”的存在感，并延续旧版弩炮塔的核心遗产。

---

## 7. 元素塔 · `elemental_tower`（原冰塔）

**塔定位**：控制 / 元素效果。v3.5 不再保留三路径分叉，但保留冰 / 火 / 毒三种元素成长语义。

### 7.1 改名说明

- 旧"冰塔"（`ice_tower`）→ **元素塔**（`elemental_tower`）。
- 默认形态 = **元素塔 · 冰**，沿用旧冰塔的减速效果，保证兼容。
- v3.5 不再通过路径切换元素，而是把火 / 毒分支效果折叠到更高等级中。
### 7.2 等级图

```
元素塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 7.3 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 元素塔 Lv.1 | 0 | 默认冰属性；命中减速 |
| **Lv.2** | 元素塔 Lv.2 | TBD | 冰系代表能力：概率冰冻；并入火系代表能力：切换火元素 + 灼烧 + 移除减速 |
| **Lv.3** | 元素塔 Lv.3 | TBD | 并入毒系高阶能力：切换毒元素 + 中毒传染；同时保留霜冻 Debuff 与真火击杀回能 |

### 7.4 YAML 配置

```yaml
elemental_tower:
  id: elemental_tower
  name: 元素塔
  category: tower
  elementType: ice
  skillTree:
    nodes:
      - id: elemental_tower_lv1
        name: 元素塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: elemental_tower_lv2
        name: 元素塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_freeze_on_hit
            probability: 0.25
            duration: 1.0
          - rule: set_element_type
            element: fire
          - rule: add_burning_on_hit
            duration: 3.0
            tickRatio: 0.25
          - rule: remove_slow_on_hit
      - id: elemental_tower_lv3
        name: 元素塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: set_element_type
            element: poison
          - rule: add_poison_on_hit
            duration: 4.0
            tickRatio: 0.2
          - rule: add_atk_debuff_on_hit
            value: -0.3
            duration: 3.0
          - rule: add_energy_on_kill
            probability: 0.2
            amount: 1
          - rule: add_poison_contagion
            maxJumps: 3
            radius: 80
            damageDecay: 0.5
```

### 7.5 元素塔机制说明

- 元素塔仍保留“冰 / 火 / 毒”三套成长语义，但不再要求玩家做路径互斥选择，而是随等级逐步吃到更多元素能力。
- 真火塔的“额外能量”按击杀点结算，每次结算独立 roll，不与卡牌本身的能量回收冲突。
- 病毒塔承接旧版 **毒藤塔** 的传染机制（毒藤塔已废弃，见 [22-tower-tech-tree §8](./22-tower-tech-tree.md#8-废弃单位清单)）。
- 若实现侧需要区分当前主元素，可在 UI / 配置注释中标记“当前展示元素”，但不再恢复 v3.4 的路径互斥结构。

---

## 8. 电塔 · `lightning_tower`

**塔定位**：链式弹跳，群体压制。原 v3.4 的第 4 深度终极节点在 v3.5 并入 Lv.3。

### 8.1 等级图

```
电塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 8.2 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 电塔 Lv.1 | 0 | 默认 1 次弹跳 |
| **Lv.2** | 电塔 Lv.2 | TBD | 弹跳次数 +1 → 共 2 次 |
| **Lv.3** | 电塔 Lv.3 | TBD | 再 +1 弹跳 → 共 3 次；并入原第 4 深度的 **全屏闪电** 终极效果 |

### 8.3 YAML 配置

```yaml
lightning_tower:
  id: lightning_tower
  name: 电塔
  category: tower
  skillTree:
    nodes:
      - id: lightning_tower_lv1
        name: 电塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: lightning_tower_lv2
        name: 电塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_chain_bounce
            value: 1
      - id: lightning_tower_lv3
        name: 电塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_chain_bounce
            value: 1
          - rule: add_global_strike
            probability: 0.15
            cooldown: 10.0
            damageMul: 1.5
            targetCount: -1
```

### 8.4 全屏闪电规则

- **触发逻辑**：每次普通攻击后掷骰，CD 内不可重复触发。
- **目标**：随机敌人池（不限阵营/状态/位置），单次伤害独立计算。
- **定位**：末期 panic button，**不是清屏 AI 必胜键**。
- **数值**（概率、CD、倍率）以 [50-mda](../50-data-numerical/50-mda.md) 为准。

### 8.5 线性设计因素

- 电塔的变量仍内嵌在链式弹跳次数 + 末位全屏闪电，足够策略深度，**无需额外分支**。
- 原第 4 深度的“闪电塔”并入 Lv.3，是本次迁移唯一的 4→3 等级折叠特例。
- 金币数值待 50-mda §NEW-CRYSTAL 回填；本文档只锁定“Lv.3 保留终极爆点”这一结构要求。

---

## 9. 激光塔 · `laser_tower`

**塔定位**：聚焦 / 持续输出。

### 9.1 等级图

```
激光塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 9.2 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 激光塔 Lv.1 | 0 | 普通激光塔（1 道激光） |
| **Lv.2** | 激光塔 Lv.2 | TBD | **扇形覆盖方向**：激光道数 +1；**蓄能聚焦方向**：持续锁单体 |
| **Lv.3** | 激光塔 Lv.3 | TBD | **扇形覆盖方向**：再 +1 激光并降低攻击间隔；**蓄能聚焦方向**：持续锁同一目标越久伤害越高 |

### 9.3 YAML 配置

```yaml
laser_tower:
  id: laser_tower
  name: 激光塔
  category: tower
  skillTree:
    nodes:
      - id: laser_tower_lv1
        name: 激光塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: laser_tower_lv2
        name: 激光塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_beam_count
            value: 1
          - rule: set_target_lock
            mode: persistent
      - id: laser_tower_lv3
        name: 激光塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_beam_count
            value: 1
          - rule: mul_attack_interval
            value: 0.7
          - rule: add_charge_damage
            rampPerSecond: 0.5
            maxMul: 5.0
            resetOnTargetChange: true
```

### 9.4 设计说明

- 原路径 1 = 广覆盖，原路径 2 = 单体高烈度；v3.5 将其合并为“先加光束、再补蓄能”的复合成长曲线。
- 充能激光塔（原方案命名“特变激光塔”）继续沿用更直白的“充能激光塔”语义。
- 蓄能机制依然需要 `ChargeBuffComponent` 跟踪锁定目标 + 锁定时长，目标切换 / 死亡触发 `resetCharge`（详 `src/systems/AttackSystem.ts` 实现）。

---

## 10. 蝙蝠塔 · `bat_tower`

**塔定位**：群体单位类塔，受天气影响。

### 10.1 等级图

```
蝙蝠塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 10.2 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 蝙蝠塔 Lv.1 | 0 | 默认 3 蝙蝠 |
| **Lv.2** | 蝙蝠塔 Lv.2 | TBD | 蝙蝠数 +1 → 共 4；单蝙蝠 ATK ×1.2 |
| **Lv.3** | 蝙蝠塔 Lv.3 | TBD | 再 +1 蝙蝠 → 共 5；单蝙蝠 ATK 再 ×1.2 |

### 10.3 YAML 配置

```yaml
bat_tower:
  id: bat_tower
  name: 蝙蝠塔
  category: tower
  skillTree:
    nodes:
      - id: bat_tower_lv1
        name: 蝙蝠塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: bat_tower_lv2
        name: 蝙蝠塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_bat_count
            value: 1
          - rule: mul_atk
            value: 1.2
      - id: bat_tower_lv3
        name: 蝙蝠塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_bat_count
            value: 1
          - rule: mul_atk
            value: 1.2
```

### 10.4 蝙蝠塔机制说明

- 所有节点沿用 [21-unit-roster §2.2 蝙蝠塔天气依赖](./21-unit-roster.md#蝙蝠塔bat_tower天气依赖) 的 `weather_dependent_atk` 天气影响。
- 蝙蝠塔的主要变量来自天气系统（5 种天气 × 多种状态），已经具备策略深度，因此 v3.5 继续保持线性成长即可。
- 节点 2/3 的"+蝙蝠数"通过 `add_bat_count` RuleHandler 直接修改单位生成数量（详 [20-unit-system §蝙蝠生成](./20-unit-system.md)）。

---

## 11. 导弹塔 · `missile_tower`

**塔定位**：战略大射程打击（600px）。**v1.2 起目标选择默认为「手动指挥」**（玩家点击塔拖动指示器手动选目标），可右键塔切换为「托管」走原地格评分系统。两种模式与本节科技树等级正交——无论 Lv.1 还是 Lv.3，都既可手动也可托管。详见 [26-missile-special](./26-missile-special.md)（特别是 §3 双模式状态机 + §9 交互速查）。

### 11.1 等级图

```
导弹塔 Lv.1 ●────Lv.2 ○────Lv.3 ○
```

### 11.2 等级详表

| 等级 | 名称 | goldCost | 能力（差量） |
|---|---|---|---|
| **Lv.1** | 导弹塔 Lv.1 | 0 | 普通导弹塔（单发） |
| **Lv.2** | 导弹塔 Lv.2 | TBD | **双联齐射方向**：同一地格同时发射 2 枚导弹、单发伤害 ×0.6；**战略弹头方向**：爆炸范围内附加灼烧 DOT |
| **Lv.3** | 导弹塔 Lv.3 | TBD | **双联齐射方向**：再 +1 导弹、单发伤害再 ×0.7；**战略弹头方向**：爆炸范围 ×1.6、爆炸伤害 ×1.4 |

### 11.3 YAML 配置

```yaml
missile_tower:
  id: missile_tower
  name: 导弹塔
  category: tower
  skillTree:
    nodes:
      - id: missile_tower_lv1
        name: 导弹塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: missile_tower_lv2
        name: 导弹塔 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_missile_count
            value: 1
          - rule: mul_atk
            value: 0.6
          - rule: add_burning_on_explosion
            duration: 3.0
            tickRatio: 0.25
      - id: missile_tower_lv3
        name: 导弹塔 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_missile_count
            value: 1
          - rule: mul_atk
            value: 0.7
          - rule: mul_explosion_radius
            value: 1.6
          - rule: mul_atk
            value: 1.4
```

### 11.4 同坐标多发射机制说明

- **评分逻辑（选哪个地格）不变**，复用 [26-missile-special](./26-missile-special.md) 地格评分。
- **同坐标多发射**：`ProjectileSystem` 在选定地格后，按节点数量循环 N 次发射相同弹道，弹道之间错开极短延迟（视觉区分用，伤害互独立）。
- 总伤害 ≈ 单发 × N，但单发 < 普通导弹塔单发伤害（数值进 [50-mda](../50-data-numerical/50-mda.md)）。
- **实现优势**：复用现有评分流水线，比"打多个地格"简单；视觉效果更冲击。

### 11.5 战略弹头说明

- 原路径 2 = 战略弹头方向，强化单次爆炸的烈度与范围（伤害质而非量）。
- 温压弹塔通过 `add_burning_on_explosion` 给爆炸范围内所有敌人附加灼烧 DOT，是 v3.4 中唯一"爆炸 + DOT"双效塔节点。
- 核弹塔通过 `mul_explosion_radius` × 1.6 + `mul_atk` × 1.4，对比其中阶温压强化，本质是"伤害 + 范围"的总量级提升。

---

## 12. 七塔科技树升级费用与流派覆盖

### 12.1 各塔 goldCost 总需求矩阵

| 塔 | Lv.1 | Lv.2 | Lv.3 | 总升级费用 |
|---|---|---|---|---|
| `arrow_tower` | 0 | TBD | TBD | TBD |
| `cannon_tower` | 0 | TBD | TBD | TBD |
| `elemental_tower` | 0 | TBD | TBD | TBD |
| `lightning_tower` | 0 | TBD | TBD | TBD |
| `laser_tower` | 0 | TBD | TBD | TBD |
| `bat_tower` | 0 | TBD | TBD | TBD |
| `missile_tower` | 0 | TBD | TBD | TBD |

### 12.2 单 Run 金币预算策略示范

在 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 尚未填入具体数值前，本文档只描述结构化策略：

| 策略 | goldCost 分配 | 满级塔数 | 适合玩法 |
|---|---|---|---|
| **广撒网** | 多张卡先停留在 Lv.1 / Lv.2，保留金币给买卡与功能卡 | 多个 Lv.2 塔 | 测试多种塔的协同 / 防御阵容多样性 |
| **深耕核心塔** | 先升 Crystal，再把 1-2 张主力塔推到 Lv.3 | 少量 Lv.3 核心塔 | 主力塔最大化 |
| **元素复合流** | 优先把元素塔升到 Lv.3，再围绕其补控制 / 爆发牌 | 1 个元素核心 + 若干辅助 | 极致元素流派 |
| **终极电塔** | 尽快把电塔升到 Lv.3，保留全屏闪电爆点 | 1 个终极电塔 + 若干 Lv.1/Lv.2 支援 | 末期 panic button |

### 12.3 金币流量对设计的反馈

- v3.5 的核心决策三角变为：**塔选择 + Crystal 升级 + 卡牌等级预算**。
- 本文档不再持有任何固定金币总量；若实测出现升级过快或过慢，应回头调整 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 与 [11-economy](../10-gameplay/11-economy.md) 的金币流量，而**不能**在此文档私自改 `goldCost`。
- 设计目标保持不变：玩家不能在单 Run 内无脑把全部核心塔都升满，必须在“扩阵容”和“深升级”之间取舍。

---

## 13. RuleHandler 引用清单

本文档共引用以下 RuleHandler（注册在 `src/core/RuleHandlers.ts`，详 [60-architecture §5.3](../60-tech/60-architecture.md)）：

### 13.1 数值修改类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `mul_atk` | 攻击力倍率 | 箭塔（连弩）/ 炮塔（狙击）/ 蝙蝠塔（中高）/ 导弹塔（双联/核弹）|
| `mul_attack_interval` | 攻击间隔倍率 | 箭塔（连弩）/ 炮塔（狙击）/ 激光塔（高级）|
| `mul_range` | 射程倍率 | 炮塔（狙击）|
| `mul_explosion_radius` | 爆炸半径倍率 | 导弹塔（核弹）|

### 13.2 弹丸/单位数量类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `add_projectile_count` | 弹丸数 +N | 箭塔（双重/三重）|
| `add_beam_count` | 激光道数 +N | 激光塔（中级/高级）|
| `add_chain_bounce` | 弹跳次数 +N | 电塔（热电/核电）|
| `add_bat_count` | 蝙蝠数 +N | 蝙蝠塔（中级/高级）|
| `add_missile_count` | 同坐标导弹数 +N | 导弹塔（双联/集束）|

### 13.3 命中/击杀效果类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `add_burning_on_hit` | 命中附加灼烧 DOT | 箭塔（连弩火箭）/ 元素塔（火焰）|
| `add_freeze_on_hit` | 命中按概率冰冻硬控 | 元素塔（冰冻）|
| `add_poison_on_hit` | 命中附加中毒 DOT | 元素塔（巫毒）|
| `add_poison_contagion` | 中毒传染 | 元素塔（病毒）|
| `add_stun_on_hit` | 命中按概率眩晕 | 炮塔（重炮）|
| `add_knockback_on_hit` | 命中击退 | 炮塔（超级）|
| `add_atk_debuff_on_hit` | 命中目标 ATK Debuff | 元素塔（霜冻）|
| `add_pierce` | 弹道贯穿 | 炮塔（战术）|
| `add_burning_on_explosion` | 爆炸范围内附加灼烧 | 导弹塔（温压）|
| `add_energy_on_kill` | 击杀按概率 +能量 | 元素塔（真火）|
| `add_global_strike` | 概率触发全屏闪电 | 电塔（闪电）|

### 13.4 行为模式切换类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `set_attack_mode` | 切换攻击模式（single / aoe）| 炮塔（狙击）|
| `set_target_lock` | 切换目标锁定模式 | 激光塔（稳压）|
| `set_element_type` | 切换元素属性 | 元素塔（火焰/巫毒）|
| `remove_slow_on_hit` | 移除命中减速效果 | 元素塔（火焰/巫毒）|

### 13.5 蓄能/递增类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `add_charge_damage` | 蓄能伤害递增 | 激光塔（充能）|

**新增 RuleHandler 数量**：本文档共需新增 19 个 RuleHandler（其中 4 个继承 v3.1 22-tower-tech-tree，15 个本文档新增或重命名）。具体注册由代码改造阶段完成（详 [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) 第 4 轮）。

---

## 14. v3.5 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片 / 技能点词汇彻底废弃 | [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md) | ✅ 全文已切换为金币 / goldCost 术语，不再以旧资源作为节点升级货币 |
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「meta 进度」「跨 Run」作为塔升级状态描述 |
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 所有 `goldCost` 仅使用 `0` 或 `TBD`，等待 §NEW-CRYSTAL 回填 |
| 线性等级结构 | [22-skill-tree-overview §5](./22-skill-tree-overview.md#5-节点结构v35) | ✅ 全部塔统一为 `nodes[]` + `level` + `goldCost`，无 `paths` / `depth` |
| 获卡即默认形态 | [22-skill-tree-overview §6](./22-skill-tree-overview.md#6-获卡与节点解锁) | ✅ 全部 Lv.1 节点 `goldCost: 0` |
| 删除 prerequisites / mutex | [22-skill-tree-overview §2](./22-skill-tree-overview.md#2-v34--v35-迁移说明) | ✅ 全文 YAML 不再出现 `prerequisites` / `mutex` |
| 关内禁止升级 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止升级) | ✅ 全文未引入关内科技树升级或切换路径描述 |
| 与 instanceLevel 正交 | [22-skill-tree-overview §1.2](./22-skill-tree-overview.md#12-核心原则) | ✅ 全文 effects[] 0 处 `add_instance_level` RuleHandler 引用 |

---

## 15. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.3.0 | 2026-05-18 | refactor | **v3.5 第 2 轮节点重写**：`design/20-units/22a-skill-tree-tower.md` 全文从 v3.4 `paths/depth/spCost/prerequisites` schema 迁移到 v3.5 `nodes/level/goldCost` schema；7 塔 YAML 全部改写为线性 Lv.1/Lv.2/Lv.3；电塔原 depth=4「闪电塔」效果并入 Lv.3；§2/§4/§12/§14 术语同步切换为金币 / 科技树 / 自动解锁。 |
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 2 份创建**：塔技能树详设权威。14 章覆盖：文档定位 / 通用约定 / 七塔技能树清单 / 7 个塔（箭塔 2 路径 / 炮塔 2 路径 / 元素塔 3 路径 / 电塔 1 路径 4 节点 / 激光塔 2 路径 / 蝙蝠塔 1 路径 / 导弹塔 2 路径）/ 七塔 SP 总需求矩阵 / RuleHandler 引用清单（19 个）/ v3.4 8 项不变式核对。**蓝本式继承 v3.1 [22-tower-tech-tree §4](./22-tower-tech-tree.md#4-七塔完整科技树)**，节点 ID / 名称 / 形态梯度完整保留；字段重命名（`shardCost`→`spCost`、`techTree`→`skillTree`）+ SP 单价命中 50-mda §17.3 锚点（0/6/10/15）+ depth=1 起点 spCost=0。 |
| 1.1.0 | 2026-05-17 | feat | **新增 §3 七塔主动技能**（节奏优化建议 D 落地）：每塔 1 个关内手动触发主动技能，不消耗能量，各塔独立 CD（12-25s）；新增 §3.1 七塔主动技能一览表 + §3.2 YAML schema（`activeSkill` 字段）；原 §3-§14 顺移为 §4-§15；7 项主动技能设计（齐射/精准轰炸/元素爆发/过载放电/全功率扫射/召唤蝠群/饱和打击）；新增 4 个 RuleHandler 引用（`fire_at_all_in_range` / `instant_aoe_hit` / `temp_summon_unit` / `multi_missile_strike`）。 |
