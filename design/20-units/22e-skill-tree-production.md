---
title: 生产建筑科技树详设（v3.5）
status: authoritative
version: 1.2.0
last-modified: 2026-05-18
authority-for:
  - production-building-skill-tree
  - production-building-path-nodes
  - production-building-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/22a-skill-tree-tower.md
  - 20-units/22b-skill-tree-soldier.md
  - 20-units/21-unit-roster.md
  - 10-gameplay/11-economy.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.5-MAJOR-MIGRATION.md
  - v3.4-MAJOR-MIGRATION.md
---

# 生产建筑科技树详设（v3.5）

> ⚠️ **v3.5 形态级变更声明（2026-05-18）**：本文档节点设计将在 v3.5 第 2 轮全面更新（详见 [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md)）。v3.5 核心变更：
> - ~~`spCost`~~ → **`goldCost`**（技能点 SP 废弃，改用金币升级）
> - ~~路径互斥单装备~~ → **线性等级 Lv.1/Lv.2/Lv.3**
> - ~~`prerequisites`/`mutex`~~ → **删除**（获卡=自动解锁，无前置依赖）
> - 节点设计（RuleHandler 效果）本身**保留**，字段名和结构待第 2 轮更新
>
> **当前文档状态**：节点内容仍为 v3.4（spCost/paths 结构），待 v3.5 第 2 轮正式重写。

> ⭐ **本文档是 2 个生产建筑（`gold_mine` / `energy_crystal`）科技树的唯一权威详设**。所有节点 ID / 等级节点定义 / `goldCost` 占位 / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview v2.0.0](./22-skill-tree-overview.md)（v3.5 科技树总览）。

> 🆕 **本文档为 v3.4 全新创建并在 v3.5 第 2 轮重写 schema**。v3.1 `22-tower-tech-tree` 仅覆盖塔单位，生产建筑在 v3.1 阶段无关外科技树；v3.4 引入 SP 系统后，**生产建筑首次拥有技能树**；v3.5 则进一步把原双路径分叉合并为**线性三等级科技树**，聚焦「获卡即用 + 关间金币升级」。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定（与 22a/22b/22c/22d 一致）](#2-通用约定与-22a22b22c22d-一致)
- [3. 两建筑科技树清单（概览）](#3-两建筑科技树清单概览)
- [4. 金矿 · `gold_mine`](#4-金矿--gold_mine)
- [5. 能量水晶 · `energy_crystal`](#5-能量水晶--energy_crystal)
- [6. 两建筑金币需求与流派覆盖](#6-两建筑金币需求与流派覆盖)
- [7. ~~与现有等级系统（L1/L2/L3）的边界~~（v3.5 废弃）](#7-与现有等级系统l1l2l3的边界v35-废弃)
- [8. RuleHandler 引用清单](#8-rulehandler-引用清单)
- [9. v3.5 不变式核对](#9-v35-不变式核对)
- [10. 修订历史](#10-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责生产建筑（`category: Building`）的科技树详设，每建筑一节，内容包括：

- 建筑定位（一句话功能描述 + 经济角色）
- 线性三级节点表（Lv.1 / Lv.2 / Lv.3 的效果梯度）
- v3.5 YAML 配置示例
- 节点 `effects[]` 的 RuleHandler 引用说明
- 旧 v3.4 双路径设计如何折叠为 v3.5 线性等级

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 线性等级 / `goldCost` 字段语义 | [22-skill-tree-overview §5 / §7](./22-skill-tree-overview.md) |
| `goldCost` 数值锚点 | [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) |
| RuleHandler 注册 | `src/core/RuleHandlers.ts` + [60-architecture §5.3](../60-tech/60-architecture.md) |
| 建筑基础属性（HP / 占位 / 卡稀有度）| [21-unit-roster §5.1](./21-unit-roster.md#51-生产建筑building) |
| 金矿产出数值表（L1/L2/L3 = 2.5/5/8 G/s）| [50-mda §7.2](../50-data-numerical/50-mda.md#72-金矿) |
| 能量水晶 v3.0 重命名背景与机制 | [21-unit-roster §5.1 备注](./21-unit-roster.md#51-生产建筑building) |
| 经济流向（金币用于购卡 / Crystal 升级 / 科技树升级）| [11-economy §3 / §4](../10-gameplay/11-economy.md) |

### 1.3 设计理念差异（vs 塔 / 士兵 / 陷阱 / 法术科技树）

| 维度 | 塔（22a）| 士兵（22b）| 陷阱（22c）| 法术（22d）| **生产建筑（本文档）** |
|---|---|---|---|---|---|
| 节点效果方向 | 形态切换 + 弹道机制 | 主动技能 + 普攻强化 | 触发机制 + 区域效果 | 4 维度数值 | **产出强度 + 产出模式修正** |
| v3.5 结构 | 线性 3 级 | 线性 3 级 | 线性 3 级 | 线性 3 级 | **线性 3 级** |
| 节点数量 | 3 | 3 | 3 | 3 | **3** |
| 默认解锁 | 获卡即 Lv.1 | 获卡即 Lv.1 | 获卡即 Lv.1 | 获卡即 Lv.1 | **获卡即 Lv.1** |
| 与其他系统关系 | Crystal 等级限制卡牌等级 | 同左 | 同左 | 同左 | **不改动 v3.0 重命名机制，不回退旧能量塔设计** |
| Run 内重要性 | 主输出来源 | 辅助强化 | 战场清场 | 法术枪手 | **经济流 / 法术流配套核心** |

### 1.4 阅读建议

1. 先读 [22-skill-tree-overview](./22-skill-tree-overview.md) 的 v3.5 通用骨架与 YAML schema。
2. 数值校验：所有 `goldCost` 暂记为 `TBD`，以 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 为最终真理源。
3. 迁移理解：本文档保留原 RuleHandler 意图，但把原「两条路径」改写为「线性三等级成长」。

---

## 2. 通用约定（与 22a/22b/22c/22d 一致）

### 2.1 线性三等级与 `goldCost`

| 等级 | goldCost | 说明 |
|---|---|---|
| **Lv.1** | **0** | 获卡默认可用基础形态 |
| **Lv.2** | **TBD** | 关间金币升级，继承原 depth=2 的关键强化 |
| **Lv.3** | **TBD** | 关间金币升级，继承原 depth=3 的终阶强化 |

> ⚠️ 生产建筑在 v3.5 **不再保留双路径 / `depth` / `prerequisites` / `mutex`**。所有 schema 统一为 `skillTree.nodes[]` 线性数组。

### 2.2 `effects[]` 写法（差量语义）

每个节点 `effects[]` 仅描述**相对上一等级**的差量变化。配置加载器在卡牌等级提升时合并 Lv.1 → 当前等级所有节点的 `effects[]`（与 22a-22d 一致）。

### 2.3 单建筑线性升级金币需求

- 单建筑满级 = `0 + TBD + TBD = TBD Gold`
- 2 建筑全部满级 = `2 × (0 + TBD + TBD) = TBD Gold`
- Lv.1 固定免费，Lv.2 / Lv.3 价格待 `50-mda §NEW-CRYSTAL` 填数

### 2.4 从「两条路径」折叠为「线性三等级」的规则

1. **Lv.1** 统一保留原默认节点（普通金矿 / 普通水晶）。
2. **Lv.2** 选择原双路径中更能代表该建筑核心 identity 的中段强化，作为第一段金币升级。
3. **Lv.3** 将另一条路径中的高价值机制合并进终阶节点，使线性成长仍能覆盖原「强度方向 + 模式方向」两类收益。
4. **不得删除原有效果类型**；可以把原分叉效果重组到 Lv.2 / Lv.3，但 `effects[]` RuleHandler 内容必须保留。

---

## 3. 两建筑科技树清单（概览）

| 建筑 ID | 中文名 | 经济角色 | 节点数 | Lv.1 `goldCost` | Lv.2 `goldCost` | Lv.3 `goldCost` |
|---|---|---|---|---|---|---|
| `gold_mine` | 金矿 | 持续产金（关内） | 3 | 0 | TBD | TBD |
| `energy_crystal` | 能量水晶 | 波间能量爆发 / 能量上限 | 3 | 0 | TBD | TBD |

### 3.1 共同设计模板

每建筑统一采用以下线性模板：

- **Lv.1 · 基础形态**：保留原默认产出机制
- **Lv.2 · 核心强化**：直接增强主产出轴
- **Lv.3 · 综合终阶**：把原另一条路径的代表性机制吸收入终阶，实现「强度 + 模式」双收益合流

### 3.2 v3.4 → v3.5 路径折叠摘要

| 建筑 | 原路径 A | 原路径 B | v3.5 线性折叠方式 |
|---|---|---|---|
| `gold_mine` | 高产矿脉 | 战利金脉 | Lv.2 先强化持续产金；Lv.3 合入击杀奖励与关末返还 |
| `energy_crystal` | 充能爆发 | 容量扩展 | Lv.2 先强化下波充能；Lv.3 合入能量上限与波末回流 |

---

## 4. 金矿 · `gold_mine`

**建筑定位**：持续产金；关内每秒产出固定金币（L1 = 2.5 G/s，L2 = 5 G/s，L3 = 8 G/s，详 [50-mda §7.2](../50-data-numerical/50-mda.md#72-金矿)）。v3.5 科技树只调整产出参数与附加收益，不改造建筑基础等级。

### 4.1 线性等级图

```
Lv.1 普通金矿（默认 G/s 产出）
  └── Lv.2 高产金矿（产出速率强化）
        └── Lv.3 富矿脉（持续产金终阶 + 战利/关末返还并入）
```

### 4.2 等级详表

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通金矿 | 0 | 默认 G/s 产出 |
| **Lv.2** | 高产金矿 | TBD | 产出速率 +30% |
| **Lv.3** | 富矿脉 | TBD | 再追加产出速率至总约 1.6× + 每 10s 额外 +20G + 80px 内敌人死亡额外 +4G + 关结束时按累计产出额外 +20% 返还 |

### 4.3 YAML 配置（v3.5 schema）

```yaml
gold_mine:
  id: gold_mine
  name: 金矿
  category: Building
  skillTree:
    nodes:
      - id: gold_mine_lv1
        name: 金矿 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: gold_mine_lv2
        name: 金矿 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_production_rate
            resource: gold
            value: 1.3                  # G/s 产出 +30%
      - id: gold_mine_lv3
        name: 金矿 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_production_rate
            resource: gold
            value: 1.23                 # 与 Lv.2 累乘后约 1.6×
          - rule: add_periodic_bonus
            resource: gold
            period: 10
            amount: 20                  # 每 10s 额外 +20G
          - rule: add_kill_bonus_nearby
            radius: 80
            resource: gold
            amount: 4                   # 吸收原战利/财富诅咒终阶收益
          - rule: add_level_end_bonus
            resource: gold
            ratio: 0.2                  # 关结束时累计产出 +20% 返还
```

### 4.4 设计说明

- **Lv.2 先保留原高产矿脉主轴**：`mul_production_rate` 仍是金矿最直观、最稳定的第一段升级收益。
- **Lv.3 吸收原双路径终值**：在不保留路径互斥的前提下，把原「富矿脉」与「财富诅咒」两侧的高价值收益合并到终阶，确保线性升级后仍保有经济流的峰值回报。
- **不删除任何原 RuleHandler 类型**：`mul_production_rate` / `add_periodic_bonus` / `add_kill_bonus_nearby` / `add_level_end_bonus` 全部保留，只是从路径分叉改为等级递进。
- **与建筑等级系统解耦**：这里的倍率与事件奖励作用于产出结果，不改变 L1/L2/L3 建筑基础档位定义。

---

## 5. 能量水晶 · `energy_crystal`

**建筑定位**：波间能量爆发（v3.0 重命名自 `energy_tower`，旧版「每秒持续产能」已废弃）。当前机制为「**下波开始 +3 E**」或「**+1 能量上限**」所衍生的增强形态。v3.5 科技树只增强这两个机制，**绝不回退**到 v3.0 前的旧能量塔设计。

### 5.1 线性等级图

```
Lv.1 普通水晶（默认下波 +3 E / 基础容量机制）
  └── Lv.2 高能水晶（强化下波充能）
        └── Lv.3 共鸣水晶（充能爆发 + 能量上限 + 波末回流综合终阶）
```

### 5.2 等级详表

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通水晶 | 0 | 默认下波 +3 E / 基础容量机制 |
| **Lv.2** | 高能水晶 | TBD | 下波开始额外 +2 E（总 +5 E） |
| **Lv.3** | 共鸣水晶 | TBD | 再追加下波 +2 E（总 +7 E）+ 每死亡 5 个敌人额外 +1 E + 能量上限额外 +2 + 波结束按本水晶提供的上限增量等额回流即时能量 |

### 5.3 YAML 配置（v3.5 schema）

```yaml
energy_crystal:
  id: energy_crystal
  name: 能量水晶
  category: Building
  skillTree:
    nodes:
      - id: energy_crystal_lv1
        name: 能量水晶 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: energy_crystal_lv2
        name: 能量水晶 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_wave_start_energy
            value: 2                    # 下波 +3 默认 → +5 总
      - id: energy_crystal_lv3
        name: 能量水晶 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_wave_start_energy
            value: 2                    # 累加 → +7 总
          - rule: add_kill_bonus_global
            period: 5
            resource: energy
            amount: 1
          - rule: add_energy_cap
            value: 2                    # 吸收原大容量/共鸣路径的终阶容量收益
          - rule: add_wave_end_energy_reflow
            ratio: 1.0                  # 波结束时按本水晶提供的上限增量等额回流
```

### 5.4 设计说明

- **Lv.2 先强化爆发主轴**：对法术流而言，下波额外能量是最直接、最容易感知的升级收益，因此保留原「充能爆发」路径的中段节点作为 Lv.2。
- **Lv.3 合并容量扩展路径**：终阶同时给出更高波前充能、击杀联动、能量上限、波末回流，覆盖原两路径的代表性终局收益。
- **严守 v3.0 重命名机制**：全文不引入任何「每秒持续产能」语义，也不出现 `mul_production_rate` 作用于 `energy` 的回退设计。
- **effects[] 只做增益，不改默认机制来源**：默认下波 +3 E 与基础容量机制依然来自建筑本体；科技树节点仅提供差量叠加。

---

## 6. 两建筑金币需求与流派覆盖

### 6.1 各建筑金币需求矩阵

| 建筑 | Lv.2 `goldCost` | Lv.3 `goldCost` | 满级总投入 |
|---|---|---|---|
| `gold_mine` | TBD | TBD | TBD |
| `energy_crystal` | TBD | TBD | TBD |

**统一格式**：2 建筑均为 **3 节点线性升级**（Lv.1 免费，Lv.2 / Lv.3 金币价格待 50-mda 填数）。

### 6.2 单 Run 金币预算策略示范（数值待 50-mda 填入）

| 策略 | 金币分配 | 建筑投入 | 适合玩法 |
|---|---|---|---|
| **纯塔流** | 0 G 投生产科技树 | 保持 Lv.1 | 全部金币留给购卡 / Crystal 升级 / 其他核心卡 |
| **轻经济流** | 金矿升 Lv.2 | 1 次升级 | 先拿稳定产金加速，再把主金币轴投入前线 |
| **重经济流** | 金矿升 Lv.3 | 2 次升级 | 持续产金 + 击杀奖励 + 关末返还全开 |
| **法术流配套** | 水晶升 Lv.2 或 Lv.3 | 1-2 次升级 | 强化波前能量与中途回流，支撑高能耗法术 |
| **双经济轴** | 两建筑都升到高等级 | 2 建筑协同 | 金币产能与能量爆发同步拉高，适合长线运营 Run |

### 6.3 设计意图

- **生产建筑不是自动必点项**：v3.5 改为金币升级后，它与购卡、Crystal 升级共享同一资源轴，竞争会更直观。
- **线性升级降低理解成本**：玩家不再需要理解「高产矿脉 vs 战利金脉」之类路径互斥，只需要判断「这张生产卡要不要升到更高等级」。
- **原流派意图仍被保留**：经济流仍可通过金矿 Lv.3 成型；法术流仍可通过能量水晶 Lv.2 / Lv.3 获得高能量爆发。

---

## 7. ~~与现有等级系统（L1/L2/L3）的边界~~（v3.5 废弃）

> ⛔ **v3.5 废弃：`instanceLevel` 已废弃，本节不再适用。**
>
> 本节原用于说明 v3.4「技能树路径」与另一套等级/实例强化系统的正交边界。v3.5 已将路径结构重写为线性等级科技树，并整体废弃 `instanceLevel` 语义；因此本节保留为废弃标记，仅供历史回溯，不再作为当前实现约束。

~~### 7.1 双层系统并存~~

~~v3.4 曾把生产建筑拆成「关内金币等级系统」与「关外技能树系统」两层；v3.5 不再使用这套表述作为本文档核心边界说明。~~

~~### 7.2 正交关键点（铁律）~~

~~原「禁止技能树改等级 / 禁止跳级 / 禁止路径绑定等级」等规则，已被 v3.5 通用 schema、获卡自动解锁机制与 `instanceLevel` 废弃声明吸收，不再单独维护本节。~~

~~### 7.3 effects[] 黑名单（v3.4 强约束）~~

~~以下黑名单保留其历史参考意义，但不再以本节为当前权威来源：`set_level`、`add_level`、`mul_level_cost`、`set_production_rate`、`enable_continuous_energy_production`。~~

~~### 7.4 与 instanceLevel 的关系~~

~~本条已整体失效：v3.5 中 `instanceLevel` 已废弃，本节不再适用。~~

---

## 8. RuleHandler 引用清单

本文档共引用以下 RuleHandler（注册在 `src/core/RuleHandlers.ts`，详 [60-architecture §5.3](../60-tech/60-architecture.md)）：

### 8.1 产出强度类

| RuleHandler | 用途 | 引用建筑（等级） |
|---|---|---|
| `mul_production_rate` | 持续产出倍率（按资源类型）| 金矿（Lv.2 / Lv.3） |
| `add_periodic_bonus` | 定时事件额外产出 | 金矿（Lv.3） |

### 8.2 能量水晶专用

| RuleHandler | 用途 | 引用建筑（等级） |
|---|---|---|
| `add_wave_start_energy` | 下波开始时额外能量（差量）| 能量水晶（Lv.2 / Lv.3） |
| `add_energy_cap` | 能量上限增量 | 能量水晶（Lv.3） |
| `add_wave_end_energy_reflow` | 波结束时把上限增量转化为即时能量 | 能量水晶（Lv.3） |

### 8.3 击杀联动类

| RuleHandler | 用途 | 引用建筑（等级） |
|---|---|---|
| `add_kill_bonus_nearby` | 局部范围内击杀附加资源 | 金矿（Lv.3） |
| `add_kill_bonus_global` | 全图击杀计数附加资源 | 能量水晶（Lv.3） |

### 8.4 关卡周期类

| RuleHandler | 用途 | 引用建筑（等级） |
|---|---|---|
| `add_level_end_bonus` | 关结束时按累计产出比例返还 | 金矿（Lv.3） |

### 8.5 RuleHandler 实现要点（指引 src 实现，非本文档权威）

- `mul_production_rate` 必须按资源类型 dispatch（gold / energy）；本文档仅允许其对金矿金币产出轴生效。
- `add_wave_start_energy` 在 WaveSystem 进入 `WaveBreak → 下一波 Battle 起始` 时触发，差量值与默认水晶 +3 E 累加。
- `add_energy_cap` 修改的是 EconomySystem 内 `energyCap` 上限值，**注意：水晶被摧毁时上限增量应回收**。
- `add_kill_bonus_nearby` 与 `add_kill_bonus_global` 都挂在 LifecycleSystem 的 `onDeath` 事件上，差别仅在范围判定。
- `add_level_end_bonus` 在 GamePhase 切到 `Victory` 时触发，按本建筑本关累计产出 × `ratio` 一次性发放（应避免重复发放）。
- `add_wave_end_energy_reflow` 在 WaveSystem 切到 `WaveBreak` 时触发，把本建筑当前提供的能量上限增量（不含其他来源）作为即时能量入账。

---

## 9. v3.5 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 技能点 SP 词汇废弃 | [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md) | ✅ 正文已统一改为金币 / `goldCost` / 线性等级术语 |
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ Lv.2 / Lv.3 `goldCost` 全部使用 `TBD`，不私持数值 |
| v3.5 YAML schema 统一 | [22-skill-tree-overview §7](./22-skill-tree-overview.md#7-yaml-配置-schema) | ✅ 2 建筑 YAML 全部改为 `skillTree.nodes[]` + `level` + `goldCost` |
| 路径互斥废弃 | [22-skill-tree-overview §2 / §5](./22-skill-tree-overview.md) | ✅ 全文不再出现 `paths` / `mutex` / `prerequisites` schema |
| Lv.1 默认免费 | [22-skill-tree-overview §5.2](./22-skill-tree-overview.md#52-节点等级与金币单价50-mda-new-crystal-锚点) | ✅ 两建筑 Lv.1 节点 `goldCost: 0` |
| effects[] RuleHandler 内容不删除 | 本任务约束 | ✅ 原 7 个 RuleHandler 均保留在新线性等级节点中 |
| 能量水晶 v3.0 重命名机制不回退 | [21-unit-roster §5.1](./21-unit-roster.md#51-生产建筑building) | ✅ 全文 0 处引入「每秒持续产能」或等价回退设计 |
| §7 正交铁律废弃 | [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md) | ✅ 已显式标记「⛔ v3.5 废弃：instanceLevel 已废弃，本节不再适用」 |

---

## 10. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.2.0 | 2026-05-18 | refactor | **v3.5 第 2 轮 schema 升级**：将 2 个生产建筑从 v3.4 `skillTree.paths[].nodes[]` 重写为 v3.5 `skillTree.nodes[]` 线性三级科技树；统一 `spCost` → `goldCost`（Lv.1=0，Lv.2/Lv.3=TBD）；删除 `depth` / `prerequisites` / `mutex` 术语；重写概览表、通用约定、金币预算段落；保留全部原 RuleHandler 效果；并将 §7「与等级系统 L1/L2/L3 正交铁律」整节标记为 **v3.5 废弃**。 |
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 5 份创建**：生产建筑技能树详设权威。10 章覆盖：文档定位 / 通用约定 / 两建筑技能树清单 / 2 建筑详设（金矿 / 能量水晶）/ SP 总需求矩阵 / 与等级系统 L1/L2/L3 边界（§7 双层正交铁律 + effects[] 黑名单）/ RuleHandler 引用清单（7 个新增）/ v3.4 10 项不变式核对（含建筑专用 2 项）。**v3.4 全新创建（无 v3.1 蓝本）**：v3.1 阶段生产建筑无关外科技树，v3.4 引入 SP 系统后建筑首次拥有技能树。统一模板：每建筑 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP），路径分叉模板为"强化产出强度 vs 切换产出模式"。金矿路径 = 高产矿脉 + 战利金脉；能量水晶路径 = 充能爆发 + 容量扩展（严守 v3.0 重命名机制，不回退到"每秒持续产能"）。 |
