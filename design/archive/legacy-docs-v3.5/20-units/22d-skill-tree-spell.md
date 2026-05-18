---
title: 法术卡科技树详设（v3.5）
status: authoritative
version: 1.2.0
last-modified: 2026-05-18
authority-for:
  - spell-skill-tree
  - spell-path-nodes
  - spell-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/23-skill-buff.md
  - 20-units/21-unit-roster.md
  - 20-units/27-traps-spells-scene.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.5-MAJOR-MIGRATION.md
  - v3.4-MAJOR-MIGRATION.md
---

# 法术卡科技树详设（v3.5）

> ⚠️ **v3.5 形态级变更声明（2026-05-18）**：本文档节点设计将在 v3.5 第 2 轮全面更新（详见 [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md)）。v3.5 核心变更：
> - ~~`spCost`~~ → **`goldCost`**（技能点 SP 废弃，改用金币升级）
> - ~~路径互斥单装备~~ → **线性等级 Lv.1/Lv.2/Lv.3**
> - ~~`prerequisites`/`mutex`~~ → **删除**（获卡=自动解锁，无前置依赖）
> - ~~`精炼术 (refining)` 法术卡和 `instanceLevel` 机制~~ → **整套废弃删除**（[v3.5-MAJOR-MIGRATION §6](../v3.5-MAJOR-MIGRATION.md)）
> - ~~`§9 与 instanceLevel 正交边界铁律`~~ → **整节废弃**（instanceLevel 不再存在）
> - 其余节点设计（RuleHandler 效果）本身**保留**，字段名和结构待第 2 轮更新
>
> **当前文档状态**：节点内容仍为 v3.4（spCost/paths 结构 + 精炼术节点），待 v3.5 第 2 轮正式重写。

> ⭐ **本文档是 14 张法术卡科技树的唯一权威详设**。所有节点 ID / `goldCost` / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview v2.0.0](./22-skill-tree-overview.md)（v3.5 科技树总览）。

> 🆕 **v3.5 重写原则**：原 v3.4 的 43 条参数路径已全部折叠为 **14 张卡 × 线性 3 级节点**。每张法术卡的 Lv.1 / Lv.2 / Lv.3 分别承接原 depth=1 / depth=2 / depth=3 的代表性效果，并将同 depth 的相关参数强化合并到同一节点中。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定](#2-通用约定)
- [3. 法术分类与线性三等级总览](#3-法术分类与线性三等级总览)
- [4. 即时打击型法术（4 张）](#4-即时打击型法术4-张)
  - [4.1 火球术 · `fireball_spell`](#41-火球术--fireball_spell)
  - [4.2 陨石术 · `meteor_spell`](#42-陨石术--meteor_spell)
  - [4.3 闪电链 · `chain_lightning_spell`](#43-闪电链--chain_lightning_spell)
  - [4.4 净化术 · `purification_spell`](#44-净化术--purification_spell)
- [5. 区域控制型法术（4 张）](#5-区域控制型法术4-张)
  - [5.1 全屏冰冻 · `freeze_all_spell`](#51-全屏冰冻--freeze_all_spell)
  - [5.2 减速术 · `slow_spell`](#52-减速术--slow_spell)
  - [5.3 箭雨术 · `arrow_rain_spell`](#53-箭雨术--arrow_rain_spell)
  - [5.4 龙卷术 · `tornado_spell`](#54-龙卷术--tornado_spell)
- [6. 增益持续型法术（3 张）](#6-增益持续型法术3-张)
  - [6.1 治疗脉冲 · `heal_pulse_spell`](#61-治疗脉冲--heal_pulse_spell)
  - [6.2 神圣庇护 · `divine_protection_spell`](#62-神圣庇护--divine_protection_spell)
  - [6.3 集结号 · `rally_horn_spell`](#63-集结号--rally_horn_spell)
- [7. 战略召唤/全局型法术（3 张）](#7-战略召唤全局型法术3-张)
  - [7.1 召唤骷髅 · `summon_skeletons_spell`](#71-召唤骷髅--summon_skeletons_spell)
  - [7.2 时间膨胀 · `time_dilation_spell`](#72-时间膨胀--time_dilation_spell)
  - [7.3 战术撤退 · `tactical_retreat_spell`](#73-战术撤退--tactical_retreat_spell)
- [8. 14 法术金币总需求与流派覆盖](#8-14-法术金币总需求与流派覆盖)
- [9. RuleHandler 引用清单](#9-rulehandler-引用清单)
- [10. v3.5 不变式核对](#10-v35-不变式核对)
- [11. 修订历史](#11-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责法术卡（`type: spell`）的科技树详设。v3.5 法术科技树设计核心：

- 每张法术卡只保留 **1 条线性三等级成长链**：Lv.1 / Lv.2 / Lv.3
- 每级节点仍以 `effects[]` 描述差量效果，沿用 RuleHandler 机制
- 原 v3.4 的伤害 / 范围 / CD / 持续时间等参数路径，统一折叠进对应等级节点

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 金币升级骨架 / Crystal 等级上限 | [22-skill-tree-overview](./22-skill-tree-overview.md) |
| 法术效果机制（伤害类型 / AOE 形状 / DOT 公式）| [27-traps-spells-scene §3](./27-traps-spells-scene.md#3-法术spell) |
| 法术基础数值（伤害 / 能量 / 范围 / 持续时间初始值）| [50-mda §21.2](../50-data-numerical/50-mda.md) + [21-unit-roster §7.2](./21-unit-roster.md#72-法术卡spelleffect-驱动14-张4-子分类) |
| 法术能量成本 | [21-unit-roster §7.2](./21-unit-roster.md#72-法术卡spelleffect-驱动14-张4-子分类) + [50-mda](../50-data-numerical/50-mda.md) |
| ~~法术 `instanceLevel`（关内“精炼术”提升）~~ | **⛔ v3.5 废弃** |

### 1.3 设计理念

| 维度 | 塔 22a / 士兵 22b / 陷阱 22c | 法术 22d（本文档） |
|---|---|---|
| 成长主线 | 线性等级 Lv.1/Lv.2/Lv.3 | **线性等级 Lv.1/Lv.2/Lv.3** |
| 每卡节点数 | 3 | **3** |
| 差量语义 | 升一级追加一层效果 | **升一级合并激活该层代表性法术参数强化** |
| 设计原因 | 消除路径互斥与前置依赖 | **保留原参数设计价值，同时简化玩家决策心智** |

### 1.4 v3.4 → v3.5 法术迁移原则

1. 原 `skillTree.paths[].nodes[]` 全部迁为 `skillTree.nodes[]`。
2. 原 depth=1/2/3 的效果分层保留，但改以 `level=1/2/3` 表达。
3. 同一张法术卡在同一 depth 的多个参数路径效果，合并进同一等级节点。
4. `spCost` 一律迁为 `goldCost`：Lv.1 固定 `0`，Lv.2 / Lv.3 统一 `TBD`，由 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 锁定。

---

## 2. 通用约定

### 2.1 金币单价锚点

同 22-skill-tree-overview §5.2：

- `level: 1` → `goldCost: 0`
- `level: 2` → `goldCost: TBD`
- `level: 3` → `goldCost: TBD`

### 2.2 线性三等级总需求

| 等级 | goldCost | 含义 |
|---|---|---|
| Lv.1 | 0 | 获卡即用基础效果 |
| Lv.2 | TBD | 中阶强化，合并原 depth=2 关键参数增量 |
| Lv.3 | TBD | 高阶强化，合并原 depth=3 关键参数增量 |

### 2.3 `effects[]` 差量语义

每节点 `effects[]` 仍只描述**相对上一等级新增的差量变化**。例如：

- Lv.2 只写原 depth=2 对应增量
- Lv.3 只写原 depth=3 对应增量
- 运行时效果为 Lv.1 + Lv.2 + Lv.3 逐层叠加

### 2.4 与法术能量成本的关系

科技树节点**不修改法术能量成本**。所有等级强化都聚焦在法术效果本身，不降低能量成本，避免侵入经济与手牌平衡层。

---

## 3. 法术分类与线性三等级总览

### 3.1 14 法术等级聚焦总览

| 法术 ID | 分类 | Lv.1 基础效果 | Lv.2 代表性强化 | Lv.3 代表性强化 |
|---|---|---|---|---|
| `fireball_spell` | 即时打击 | 火焰伤害 + AOE + 灼烧 | 伤害/范围/CD/灼烧同步强化 | 全维度再强化 |
| `meteor_spell` | 即时打击 | 高爆发单点 + 溅射 | 伤害/范围/CD 同步强化 | 伤害/CD 再强化并补强溅射 |
| `chain_lightning_spell` | 即时打击 | 初始伤害 + 3 跳 | 伤害/跳数/CD 同步强化 | 伤害衰减优化 + 更多链跳 |
| `purification_spell` | 即时打击 | 单体净化 + 治疗 | 群体净化 + CD 缩短 | 更多目标 + 治疗翻倍 |
| `freeze_all_spell` | 区域控制 | 全屏冰冻 | 覆盖飞行敌 + 延时 + CD 缩短 | 对免疫单位附加部分效果 |
| `slow_spell` | 区域控制 | 区域减速 | 减速量/范围/CD/时长同步强化 | 全维度再强化 |
| `arrow_rain_spell` | 区域控制 | 持续区域物理伤害 | DPS/范围/CD/时长同步强化 | 全维度再强化 |
| `tornado_spell` | 区域控制 | 推进伤害 + 击退 | DPS/宽度/CD/时长同步强化 | 全维度再强化 |
| `heal_pulse_spell` | 增益持续 | 全体治疗 | 治疗量/CD/HoT 化同步强化 | 更高治疗 + 更长 HoT |
| `divine_protection_spell` | 增益持续 | 秒杀保护 | 保护次数/CD/持续波数同步强化 | 更高次数与更长跨波持续 |
| `rally_horn_spell` | 增益持续 | 全体攻速/移速 Buff | 光环强度/CD/时长同步强化 | 更高移速/攻速与更长时长 |
| `summon_skeletons_spell` | 战略召唤 | 召唤骷髅 | 数量/CD/跨波保留同步强化 | 更多数量 + 复活概率 |
| `time_dilation_spell` | 战略全局 | 全场减速时间流 | CD 缩短 + 时长提升 | 更短 CD + 更长时长 |
| `tactical_retreat_spell` | 战略全局 | 单位回手 + 60% 返还能量 | 更高返还 + 更短 CD | 满额回收倾向 |

### 3.2 节点总数

- 法术卡总数：**14**
- 每卡节点数：**3**
- 节点总数：**42**

### 3.3 等级命名规范

统一采用：

- `{法术名} Lv.1`
- `{法术名} Lv.2`
- `{法术名} Lv.3`

节点 ID 统一采用：

- `{spellId}_lv1`
- `{spellId}_lv2`
- `{spellId}_lv3`

---

## 4. 即时打击型法术（4 张）

### 4.1 火球术 · `fireball_spell`

**法术定位**：Common 即时打击，目标区域火焰伤害并附带灼烧。v3.5 将原伤害 / 范围 / 冷却 / 灼烧持续四条路径折叠为线性三等级成长。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础火球 |
| Lv.2 | TBD | 伤害 ×1.4、半径 ×1.3、CD ×0.75、灼烧 +2s |
| Lv.3 | TBD | 再次提升伤害/半径/CD，灼烧再 +3s |

```yaml
fireball_spell:
  skillTree:
    nodes:
      - id: fireball_spell_lv1
        name: 火球术 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: fireball_spell_lv2
        name: 火球术 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_damage
            value: 1.4
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_burning_duration
            value: 2.0
      - id: fireball_spell_lv3
        name: 火球术 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_damage
            value: 1.4
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_burning_duration
            value: 3.0
```

### 4.2 陨石术 · `meteor_spell`

**法术定位**：Epic 即时打击，高爆发单点 + 溅射。v3.5 折叠原伤害 / 范围 / 冷却三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础陨石 |
| Lv.2 | TBD | 伤害 ×1.3、溅射范围 ×1.3、CD ×0.75 |
| Lv.3 | TBD | 再次提升伤害/范围/CD，并将溅射比例 +0.2、额外连射 1 颗 |

```yaml
meteor_spell:
  skillTree:
    nodes:
      - id: meteor_spell_lv1
        name: 陨石术 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: meteor_spell_lv2
        name: 陨石术 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_damage
            value: 1.3
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
      - id: meteor_spell_lv3
        name: 陨石术 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_damage
            value: 1.3
          - rule: add_splash_ratio
            value: 0.2
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_extra_cast
            count: 1
```

### 4.3 闪电链 · `chain_lightning_spell`

**法术定位**：Rare 即时打击，单体雷击并持续弹射。v3.5 折叠原伤害 / 链跳 / 冷却三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础闪电链 |
| Lv.2 | TBD | 伤害 ×1.3、链跳 +1、CD ×0.75 |
| Lv.3 | TBD | 再次提升伤害、链跳再 +2、衰减改为 0.15、CD 再缩短 |

```yaml
chain_lightning_spell:
  skillTree:
    nodes:
      - id: chain_lightning_spell_lv1
        name: 闪电链 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: chain_lightning_spell_lv2
        name: 闪电链 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_damage
            value: 1.3
          - rule: add_chain_jumps
            value: 1
          - rule: mul_spell_cooldown
            value: 0.75
      - id: chain_lightning_spell_lv3
        name: 闪电链 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_damage
            value: 1.3
          - rule: set_chain_decay
            value: 0.15
          - rule: add_chain_jumps
            value: 2
          - rule: mul_spell_cooldown
            value: 0.75
```

### 4.4 净化术 · `purification_spell`

**法术定位**：Rare 即时净化，移除我方 Debuff 并治疗。v3.5 折叠原范围 / 冷却两条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 单体净化 |
| Lv.2 | TBD | 目标数设为 3，CD ×0.75 |
| Lv.3 | TBD | 目标数设为 6、治疗量 ×2、CD 再缩短 |

```yaml
purification_spell:
  skillTree:
    nodes:
      - id: purification_spell_lv1
        name: 净化术 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: purification_spell_lv2
        name: 净化术 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: set_target_count
            value: 3
          - rule: mul_spell_cooldown
            value: 0.75
      - id: purification_spell_lv3
        name: 净化术 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: set_target_count
            value: 6
          - rule: mul_spell_heal
            value: 2.0
          - rule: mul_spell_cooldown
            value: 0.75
```

---

## 5. 区域控制型法术（4 张）

### 5.1 全屏冰冻 · `freeze_all_spell`

**法术定位**：Epic 区域控制，全屏冰冻。v3.5 折叠原范围 / 持续时间 / 冷却三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础全屏冰冻 |
| Lv.2 | TBD | 影响飞行敌、持续 +1s、CD ×0.75 |
| Lv.3 | TBD | 对免疫单位附加 50% 减速、持续再 +2s、CD 再缩短 |

```yaml
freeze_all_spell:
  skillTree:
    nodes:
      - id: freeze_all_spell_lv1
        name: 全屏冰冻 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: freeze_all_spell_lv2
        name: 全屏冰冻 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_target_filter
            layer: LowAir
          - rule: add_spell_duration
            value: 1.0
          - rule: mul_spell_cooldown
            value: 0.75
      - id: freeze_all_spell_lv3
        name: 全屏冰冻 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_partial_effect_on_immune
            slowRatio: 0.5
          - rule: add_spell_duration
            value: 2.0
          - rule: mul_spell_cooldown
            value: 0.75
```

### 5.2 减速术 · `slow_spell`

**法术定位**：Common 区域控制，区域减速。v3.5 折叠原减速量 / 范围 / 冷却 / 持续时间四条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础减速 |
| Lv.2 | TBD | 减速量 +0.1、半径 ×1.3、CD ×0.75、持续 +2s |
| Lv.3 | TBD | 减速量再 +0.15、半径再 ×1.3、CD 再缩短、持续再 +3s |

```yaml
slow_spell:
  skillTree:
    nodes:
      - id: slow_spell_lv1
        name: 减速术 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: slow_spell_lv2
        name: 减速术 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_slow_amount
            value: 0.1
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 2.0
      - id: slow_spell_lv3
        name: 减速术 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_slow_amount
            value: 0.15
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 3.0
```

### 5.3 箭雨术 · `arrow_rain_spell`

**法术定位**：Rare 区域控制，持续区域物理伤害。v3.5 折叠原伤害 / 范围 / 冷却 / 持续时间四条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础箭雨 |
| Lv.2 | TBD | DPS ×1.3、半径 ×1.3、CD ×0.75、持续 +2s |
| Lv.3 | TBD | 再次提升 DPS/范围/CD，持续再 +3s |

```yaml
arrow_rain_spell:
  skillTree:
    nodes:
      - id: arrow_rain_spell_lv1
        name: 箭雨术 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: arrow_rain_spell_lv2
        name: 箭雨术 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_dps
            value: 1.3
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 2.0
      - id: arrow_rain_spell_lv3
        name: 箭雨术 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_dps
            value: 1.3
          - rule: mul_spell_radius
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 3.0
```

### 5.4 龙卷术 · `tornado_spell`

**法术定位**：Epic 区域控制，沿路径推进并击退。v3.5 折叠原伤害 / 宽度 / 冷却 / 持续时间四条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础龙卷 |
| Lv.2 | TBD | DPS ×1.3、路径宽度 +1、CD ×0.75、持续 +2s |
| Lv.3 | TBD | 再次提升 DPS、路径宽度再 +2、CD 再缩短、持续再 +3s |

```yaml
tornado_spell:
  skillTree:
    nodes:
      - id: tornado_spell_lv1
        name: 龙卷术 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: tornado_spell_lv2
        name: 龙卷术 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_dps
            value: 1.3
          - rule: add_path_width
            value: 1
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 2.0
      - id: tornado_spell_lv3
        name: 龙卷术 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_dps
            value: 1.3
          - rule: add_path_width
            value: 2
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 3.0
```

---

## 6. 增益持续型法术（3 张）

### 6.1 治疗脉冲 · `heal_pulse_spell`

**法术定位**：Rare 增益持续，全体治疗。v3.5 折叠原治疗量 / 冷却 / 持续时间三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础治疗脉冲 |
| Lv.2 | TBD | 治疗量 ×1.3、CD ×0.75、转换为 3s HoT |
| Lv.3 | TBD | 再次提升治疗量与 CD，并追加 HoT 时长 +2s |

```yaml
heal_pulse_spell:
  skillTree:
    nodes:
      - id: heal_pulse_spell_lv1
        name: 治疗脉冲 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: heal_pulse_spell_lv2
        name: 治疗脉冲 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_heal
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: convert_to_hot
            duration: 3.0
      - id: heal_pulse_spell_lv3
        name: 治疗脉冲 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_heal
            value: 1.3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 2.0
```

### 6.2 神圣庇护 · `divine_protection_spell`

**法术定位**：Legendary 增益持续，提供水晶秒杀保护。v3.5 折叠原次数 / 冷却 / 持续波数三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础神圣庇护 |
| Lv.2 | TBD | 保护次数 +2、CD ×0.75、持续波数 +1 |
| Lv.3 | TBD | 保护次数再 +3、CD 再缩短、持续波数再 +2 |

```yaml
divine_protection_spell:
  skillTree:
    nodes:
      - id: divine_protection_spell_lv1
        name: 神圣庇护 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: divine_protection_spell_lv2
        name: 神圣庇护 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_protection_charges
            value: 2
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_protection_waves
            value: 1
      - id: divine_protection_spell_lv3
        name: 神圣庇护 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_protection_charges
            value: 3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_protection_waves
            value: 2
```

### 6.3 集结号 · `rally_horn_spell`

**法术定位**：Rare 增益持续，全体攻速/移速 Buff。v3.5 折叠原光环效果 / 冷却 / 持续时间三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础集结号 |
| Lv.2 | TBD | 友方移速 Buff +0.05、CD ×0.75、持续 +5s |
| Lv.3 | TBD | 友方移速再 +0.1、攻速 Buff +0.1、CD 再缩短、持续再 +10s |

```yaml
rally_horn_spell:
  skillTree:
    nodes:
      - id: rally_horn_spell_lv1
        name: 集结号 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: rally_horn_spell_lv2
        name: 集结号 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_move_speed_buff
            value: 0.05
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 5.0
      - id: rally_horn_spell_lv3
        name: 集结号 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_move_speed_buff
            value: 0.1
          - rule: add_atk_speed_buff
            value: 0.1
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 10.0
```

---

## 7. 战略召唤/全局型法术（3 张）

### 7.1 召唤骷髅 · `summon_skeletons_spell`

**法术定位**：Legendary 战略召唤，召唤骷髅军团。v3.5 折叠原数量 / 冷却 / 生存时长三条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础召唤骷髅 |
| Lv.2 | TBD | 召唤数 +2、CD ×0.75、启用跨波保留 |
| Lv.3 | TBD | 召唤数再 +3、CD 再缩短、死亡获得 50% 复活概率 |

```yaml
summon_skeletons_spell:
  skillTree:
    nodes:
      - id: summon_skeletons_spell_lv1
        name: 召唤骷髅 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: summon_skeletons_spell_lv2
        name: 召唤骷髅 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_summon_count
            value: 2
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: enable_cross_wave_persistence
      - id: summon_skeletons_spell_lv3
        name: 召唤骷髅 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_summon_count
            value: 3
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_resurrection_chance
            value: 0.5
```

### 7.2 时间膨胀 · `time_dilation_spell`

**法术定位**：Legendary 战略全局，令敌方时间流速下降。v3.5 折叠原冷却 / 持续时间两条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础时间膨胀 |
| Lv.2 | TBD | CD ×0.75、持续 +3s |
| Lv.3 | TBD | CD 再缩短、持续再 +5s |

```yaml
time_dilation_spell:
  skillTree:
    nodes:
      - id: time_dilation_spell_lv1
        name: 时间膨胀 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: time_dilation_spell_lv2
        name: 时间膨胀 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 3.0
      - id: time_dilation_spell_lv3
        name: 时间膨胀 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_spell_cooldown
            value: 0.75
          - rule: add_spell_duration
            value: 5.0
```

### 7.3 战术撤退 · `tactical_retreat_spell`

**法术定位**：Common 战略全局，让我方单位回手并返还能量。v3.5 折叠原返还能量 / 冷却两条路径。

| 等级 | goldCost | 强化摘要 |
|---|---|---|
| Lv.1 | 0 | 基础战术撤退 |
| Lv.2 | TBD | 返还能量比例 +0.15、CD ×0.75 |
| Lv.3 | TBD | 返还能量比例再 +0.25、CD 再缩短 |

```yaml
tactical_retreat_spell:
  skillTree:
    nodes:
      - id: tactical_retreat_spell_lv1
        name: 战术撤退 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: tactical_retreat_spell_lv2
        name: 战术撤退 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_energy_refund_ratio
            value: 0.15
          - rule: mul_spell_cooldown
            value: 0.75
      - id: tactical_retreat_spell_lv3
        name: 战术撤退 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_energy_refund_ratio
            value: 0.25
          - rule: mul_spell_cooldown
            value: 0.75
```

---

## 8. 14 法术金币总需求与流派覆盖

### 8.1 金币总需求矩阵

| 法术 ID | 节点数 | Lv.1 goldCost | Lv.2 goldCost | Lv.3 goldCost | 满级总金币 |
|---|---|---|---|---|---|
| `fireball_spell` | 3 | 0 | TBD | TBD | TBD |
| `meteor_spell` | 3 | 0 | TBD | TBD | TBD |
| `chain_lightning_spell` | 3 | 0 | TBD | TBD | TBD |
| `purification_spell` | 3 | 0 | TBD | TBD | TBD |
| `freeze_all_spell` | 3 | 0 | TBD | TBD | TBD |
| `slow_spell` | 3 | 0 | TBD | TBD | TBD |
| `arrow_rain_spell` | 3 | 0 | TBD | TBD | TBD |
| `tornado_spell` | 3 | 0 | TBD | TBD | TBD |
| `heal_pulse_spell` | 3 | 0 | TBD | TBD | TBD |
| `divine_protection_spell` | 3 | 0 | TBD | TBD | TBD |
| `rally_horn_spell` | 3 | 0 | TBD | TBD | TBD |
| `summon_skeletons_spell` | 3 | 0 | TBD | TBD | TBD |
| `time_dilation_spell` | 3 | 0 | TBD | TBD | TBD |
| `tactical_retreat_spell` | 3 | 0 | TBD | TBD | TBD |
| **合计** | **42** | **0** | **TBD** | **TBD** | **TBD** |

### 8.2 单 Run 金币预算策略示范

| 策略 | 金币分配 | 适合玩法 |
|---|---|---|
| **单核法术冲级流** | 优先把 1 张核心法术升到 Lv.3 | 依赖单卡决定战局的 Boss / 终战构筑 |
| **双法术均衡流** | 2 张法术先后升到 Lv.2 | 主力输出 + 控制 / 治疗双核配合 |
| **功能法术补位流** | 保留 Lv.1 基础可用，金币优先投塔/兵/Crystal | 法术只承担应急与功能性覆盖 |

### 8.3 设计意图

- 法术科技树从“多路径深耕”改为“**整卡升阶**”，降低认知门槛。
- 法术仍保留原参数差异化，只是把玩家决策从“选路径”改为“是否继续升这张卡”。
- 法术与塔 / 士兵 / 陷阱 / Crystal 共享金币预算，形成 v3.5 统一关间经济抉择。

---

## 9. RuleHandler 引用清单

### 9.1 通用法术维度类

| RuleHandler | 用途 | 引用法术 |
|---|---|---|
| `mul_spell_damage` | 法术伤害倍率 | fireball / meteor / chain_lightning |
| `mul_spell_radius` | 法术半径倍率 | fireball / meteor / slow / arrow_rain |
| `mul_spell_cooldown` | 法术 CD 倍率 | 14 张法术均可引用 |
| `mul_spell_dps` | 法术 DPS 倍率 | arrow_rain / tornado |
| `mul_spell_heal` | 法术治疗量倍率 | purification / heal_pulse |
| `add_spell_duration` | 法术持续时间 +N 秒 | freeze_all / slow / arrow_rain / tornado / heal_pulse / rally_horn / time_dilation |

### 9.2 即时打击型专用

| RuleHandler | 用途 | 引用法术 |
|---|---|---|
| `add_burning_duration` | 灼烧 DOT 持续时长 | fireball |
| `add_splash_ratio` | 溅射比例 | meteor |
| `add_extra_cast` | 额外连射次数 | meteor |
| `add_chain_jumps` | 链跳数 +N | chain_lightning |
| `set_chain_decay` | 链伤害衰减率 | chain_lightning |
| `set_target_count` | 设置目标数量 | purification |

### 9.3 区域控制型专用

| RuleHandler | 用途 | 引用法术 |
|---|---|---|
| `add_target_filter` | 目标过滤器附加（如飞行敌） | freeze_all |
| `add_partial_effect_on_immune` | 对免疫单位生效部分效果 | freeze_all |
| `add_slow_amount` | 减速量 +N | slow_spell |
| `add_path_width` | 路径覆盖宽度 +N | tornado |

### 9.4 增益持续型专用

| RuleHandler | 用途 | 引用法术 |
|---|---|---|
| `convert_to_hot` | 转换为 HoT 治疗模式 | heal_pulse |
| `add_protection_charges` | 保护次数 +N | divine_protection |
| `add_protection_waves` | 保护持续波数 +N | divine_protection |
| `add_move_speed_buff` | 移速 Buff +N | rally_horn |
| `add_atk_speed_buff` | 攻速 Buff +N | rally_horn |

### 9.5 战略召唤/全局型专用

| RuleHandler | 用途 | 引用法术 |
|---|---|---|
| `add_summon_count` | 召唤数量 +N | summon_skeletons |
| `enable_cross_wave_persistence` | 启用跨波保留 | summon_skeletons |
| `add_resurrection_chance` | 死亡复活概率 | summon_skeletons |
| `add_energy_refund_ratio` | 能量返还比例 +N | tactical_retreat |

**RuleHandler 总量**：沿用原设计，共 23 个（含共享项）。v3.5 仅迁移 schema，不删除 `effects[]` 内容。

---

## 10. v3.5 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 技能点 SP 资源废弃 | [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md) | ✅ 正文与表格统一改为金币 / `goldCost` |
| 线性三等级成长 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-卡牌等级体系) | ✅ 全 14 张法术均为 `nodes[Lv.1/Lv.2/Lv.3]` |
| 获卡自动解锁 Lv.1 | [22-skill-tree-overview §6](./22-skill-tree-overview.md#6-获卡与节点解锁) | ✅ 全部 Lv.1 节点 `goldCost: 0` |
| Lv.2 / Lv.3 金币单价由数值真理源锁定 | [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) | ✅ 全文统一使用 `TBD`，不私持数值 |
| 前置依赖图废弃 | [22-skill-tree-overview §2.1](./22-skill-tree-overview.md#21-字段映射) | ✅ 全文无 `prerequisites` |
| 路径互斥废弃 | [22-skill-tree-overview §2.2](./22-skill-tree-overview.md#22-废弃机制总结) | ✅ 全文无 `paths` / `mutex` 语义 |
| `instanceLevel` 废弃 | [v3.5-MAJOR-MIGRATION §6](../v3.5-MAJOR-MIGRATION.md) | ✅ ~~§9 正交铁律~~ 已删除；正文不再把法术成长与 `instanceLevel` 绑定 |
| 法术能量成本不可由科技树修改 | 本文档 §2.4 | ✅ 全文 `effects[]` 未引入能量成本下降类规则 |

---

## 11. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.2.0 | 2026-05-18 | refactor | **v3.5 第 2 轮重写**：14 张法术卡 YAML 全量从 `skillTree.paths[].nodes[]` 迁移到 `skillTree.nodes[]` 线性三等级 schema；`spCost` 全量改为 `goldCost`；原 43 条参数路径折叠为 14 张卡 × 3 等级；删除 `prerequisites` / 路径互斥语义；废弃 §9 `instanceLevel` 正交铁律整节。 |
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 5 份创建**：法术卡技能树详设权威。12 章覆盖：文档定位 / 通用约定 / 法术分类与路径维度选择（4 维度池）/ 4 即时打击型法术（fireball / meteor / chain_lightning / purification）+ 4 区域控制型法术（freeze_all / slow / arrow_rain / tornado）+ 3 增益持续型法术（heal_pulse / divine_protection / rally_horn）+ 3 战略召唤型法术（summon_skeletons / time_dilation / tactical_retreat）/ SP 总需求矩阵 / 与 instanceLevel 正交边界铁律 / RuleHandler 引用清单（23 个）/ v3.4 9 项不变式核对。**v3.4 全新创建（无 v3.1 蓝本）**。**用户决策（弹性 2-4 路径）**：14 法术按机制相关性弹性选择 2-4 路径，避免 168 节点膨胀；总计 43 路径 / 129 节点。 |
