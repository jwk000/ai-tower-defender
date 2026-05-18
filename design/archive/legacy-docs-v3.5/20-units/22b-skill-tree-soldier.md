---
title: 士兵科技树详设（v3.5）
status: authoritative
version: 1.2.0
last-modified: 2026-05-18
authority-for:
  - soldier-skill-tree
  - soldier-path-nodes
  - soldier-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/22a-skill-tree-tower.md
  - 20-units/21-unit-roster.md
  - 20-units/23-skill-buff.md
  - 30-ai/31-soldier-ai.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.5-MAJOR-MIGRATION.md
  - v3.4-MAJOR-MIGRATION.md
---

# 士兵科技树详设（v3.5）

> ⚠️ **v3.5 形态级变更声明（2026-05-18）**：本文档节点设计将在 v3.5 第 2 轮全面更新（详见 [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md)）。v3.5 核心变更：
> - ~~`spCost`~~ → **`goldCost`**（技能点 SP 废弃，改用金币升级）
> - ~~路径互斥单装备~~ → **线性等级 Lv.1/Lv.2/Lv.3**
> - ~~`prerequisites`/`mutex`~~ → **删除**（获卡=自动解锁，无前置依赖）
> - 节点设计（RuleHandler 效果）本身**保留**，字段名和结构待第 2 轮更新

> ⭐ **本文档是 6 个士兵单位科技树的唯一权威详设**。所有节点 ID / 节点等级 / `goldCost` 字段 / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview v2.0.0](./22-skill-tree-overview.md)（v3.5 科技树总览）。

> 🆕 **本文档为 v3.5 第 2 轮正式重写版本**。v3.4 的双路径分叉（主动技能强化 vs 普攻/行为强化）现统一收敛为**线性三等级成长**：Lv.1 提供基础形态，Lv.2 聚焦核心强化，Lv.3 合并高阶战斗特性。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定（v3.5 线性等级制）](#2-通用约定v35-线性等级制)
- [3. 六士兵科技树清单（概览）](#3-六士兵科技树清单概览)
- [4. 盾卫 · `shield_guard`](#4-盾卫--shield_guard)
- [5. 剑士 · `swordsman`](#5-剑士--swordsman)
- [6. 弓手 · `archer`](#6-弓手--archer)
- [7. 牧师 · `priest`](#7-牧师--priest)
- [8. 工程师 · `engineer`](#8-工程师--engineer)
- [9. 刺客 · `assassin`](#9-刺客--assassin)
- [10. 六士兵金币需求与流派覆盖](#10-六士兵金币需求与流派覆盖)
- [11. RuleHandler 引用清单](#11-rulehandler-引用清单)
- [12. v3.5 不变式核对](#12-v35-不变式核对)
- [13. 修订历史](#13-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责士兵单位（`category: Soldier`）的科技树详设，每士兵一节，内容包括：

- 士兵定位（一句话功能描述 + 战术身份）
- 线性三级节点表（Lv.1 / Lv.2 / Lv.3）
- v3.5 YAML 配置示例
- 节点 `effects[]` 的 RuleHandler 引用说明
- 与主动技能的关联说明（详 [23-skill-buff](./23-skill-buff.md)）

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / `goldCost` 字段语义 / 线性等级骨架 | [22-skill-tree-overview](./22-skill-tree-overview.md) |
| 金币数值锚点 | [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) |
| RuleHandler 注册 | `src/core/RuleHandlers.ts` + [60-architecture §5.3](../60-tech/60-architecture.md) |
| 士兵基础属性（HP / ATK / 速度 / 人口）| [21-unit-roster §3](./21-unit-roster.md) |
| 士兵 AI 行为（三圈模型 / 四状态机）| [31-soldier-ai](../30-ai/31-soldier-ai.md) |
| 士兵主动技能数值（伤害 / 治疗量 / CD）| [23-skill-buff](./23-skill-buff.md) + [50-mda §5](../50-data-numerical/50-mda.md) |

### 1.3 设计理念差异（vs 塔科技树）

| 维度 | 塔科技树（22a）| 士兵科技树（本文档）|
|---|---|---|
| 节点效果方向 | 形态切换（外观 + 弹道 + 战斗机制）| **主动技能强化 + AI 行为微调** |
| 成长结构 | 线性三级 | **线性三级** |
| 节点数量 | 单卡 3 级 | **单卡 3 级** |
| 视觉变化 | 显著（双重箭塔 / 充能激光塔等）| **较弱**（小幅外观差异 + 特效附加）|
| Run 内重要性 | 主输出来源，金币重投 | **辅助强化**，单 Run 内点 1-2 个士兵已足够 |

---

## 2. 通用约定（v3.5 线性等级制）

### 2.1 节点等级与金币字段

| 节点等级 | goldCost | 说明 |
|---|---|---|
| **Lv.1** | **0** | 单位卡入手默认形态 |
| **Lv.2** | **TBD** | 核心强化节点 |
| **Lv.3** | **TBD** | 高阶收束节点 |

> ⚠️ 具体金币数值统一由 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 定义。本文档只定义字段和效果语义，不持有具体价格。

### 2.2 `effects[]` 写法（差量语义）

每个节点 `effects[]` 仅描述**相对上一等级**新增或覆盖的差量变化。配置加载器在卡牌升至对应等级时，累积应用 Lv.1 → 当前等级的全部 `effects[]`。

### 2.3 线性三级体系的合并原则

- v3.4 原双路径效果在 v3.5 合并为**单一线性 3 级体系**。
- Lv.2 负责放入该士兵**最具代表性的核心成长**。
- Lv.3 负责吸收剩余高阶战斗效果，允许一个节点同时承载多个 RuleHandler。
- 合并后**不删除任何已有战斗效果 RuleHandler**，只改变节点归属和结构表达。

### 2.4 与主动技能的关系

每个士兵都有一个由 [23-skill-buff](./23-skill-buff.md) 定义的**主动技能**（如盾卫嘲讽、剑士旋风斩、牧师治疗链等）。本文档的节点效果分两类：

| 节点效果类 | 说明 | 示例 |
|---|---|---|
| **强化主动技能** | 提升主动技能数值 / 范围 / CD / 附加机制 | 嘲讽范围扩大 / 旋风斩击退 / 治疗链跳数增加 |
| **强化普攻 / 行为** | 提升基础攻击或 AI 行为参数 | 弓手攻速提升 / 工程师维护光环 / 刺客中毒续航 |

### 2.5 获卡即用与关内禁止升级

- 获卡后默认可使用 **Lv.1** 形态。
- 卡牌升级只在关间发生；关内**不出现升级按钮**。
- 本文档全部节点均符合 [22-skill-tree-overview](./22-skill-tree-overview.md) 的 v3.5 线性等级约束。

---

## 3. 六士兵科技树清单（概览）

| 士兵 ID | 中文名 | 战术角色 | 节点数 | Lv.1 goldCost | Lv.2 goldCost | Lv.3 goldCost |
|---|---|---|---|---|---|---|
| `shield_guard` | 盾卫 | 肉盾 | 3 | 0 | TBD | TBD |
| `swordsman` | 剑士 | 前排输出 | 3 | 0 | TBD | TBD |
| `archer` | 弓手 | 远程 DPS | 3 | 0 | TBD | TBD |
| `priest` | 牧师 | 治疗支援 | 3 | 0 | TBD | TBD |
| `engineer` | 工程师 | 修理建造 | 3 | 0 | TBD | TBD |
| `assassin` | 刺客 | 近战爆发 | 3 | 0 | TBD | TBD |

### 3.1 共同设计模板

每个士兵统一采用以下线性模板：

- **Lv.1**：基础单位形态，保留原默认能力。
- **Lv.2**：最能代表该士兵玩法的中阶强化。
- **Lv.3**：整合主动技能强化 + 普攻/生存/行为强化的高阶终点。

### 3.2 合并策略说明

v3.4 的“主动技能强化 vs 普攻/行为强化”不再表现为两条互斥路径，而是转化为：

1. 先在 Lv.2 突出单位招牌玩法；
2. 再在 Lv.3 补齐剩余高价值效果；
3. 让玩家理解为“升级这张士兵卡”，而不是“给士兵选分支”。

---

## 4. 盾卫 · `shield_guard`

**士兵定位**：肉盾，吸引仇恨 + 抗伤；主动技能「嘲讽」让范围内敌人优先攻击自己。

### 4.1 等级概览

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通盾卫 | 0 | 基础肉盾，默认嘲讽 |
| **Lv.2** | 嘲讽盾卫 | TBD | 嘲讽范围扩大 + 最大 HP 提升 |
| **Lv.3** | 圣盾壁垒 | TBD | 嘲讽期间减伤 + 进一步增 HP + 免疫击退/眩晕 |

### 4.2 YAML 配置

```yaml
shield_guard:
  id: shield_guard
  name: 盾卫
  category: Soldier
  skillTree:
    nodes:
      - id: shield_guard_lv1
        name: 盾卫 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: shield_guard_lv2
        name: 盾卫 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_skill_range
            skillId: taunt
            value: 1.5
          - rule: mul_max_hp
            value: 1.3
      - id: shield_guard_lv3
        name: 盾卫 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_skill_buff
            skillId: taunt
            buffId: damage_reduction_20
            duration: same_as_skill
          - rule: mul_max_hp
            value: 1.23                     # 累加 → 共 1.6×
          - rule: add_cc_immunity
            effects: [knockback, stun]
```

### 4.3 设计说明

- Lv.2 先建立“更会拉仇恨、也更能扛”的核心识别。
- Lv.3 吸收 v3.4 两条路径的终点收益：嘲讽期减伤 + 终局硬控免疫。
- `add_cc_immunity` 保留为 v3.4 新增 RuleHandler，继续作为高阶肉盾身份锚点。

---

## 5. 剑士 · `swordsman`

**士兵定位**：前排输出；主动技能「旋风斩」AOE 范围伤害。

### 5.1 等级概览

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通剑士 | 0 | 基础近战输出，默认旋风斩 |
| **Lv.2** | 旋风剑士 | TBD | 旋风斩范围扩大 + 周期性普攻溅射 |
| **Lv.3** | 飓风战将 | TBD | 旋风斩附带击退 + 普攻暴击终结 |

### 5.2 YAML 配置

```yaml
swordsman:
  id: swordsman
  name: 剑士
  category: Soldier
  skillTree:
    nodes:
      - id: swordsman_lv1
        name: 剑士 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: swordsman_lv2
        name: 剑士 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_skill_range
            skillId: whirlwind
            value: 1.4
          - rule: add_aoe_on_attack
            period: 2
            radius: 50
            damageRatio: 0.25
      - id: swordsman_lv3
        name: 剑士 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_skill_effect
            skillId: whirlwind
            effect: knockback
            distance: 30
          - rule: add_crit_chance
            probability: 0.15
            multiplier: 2.0
```

### 5.3 设计说明

- Lv.2 让剑士同时具备更强 AOE 主动与更稳定的日常清杂能力。
- Lv.3 合并“控制终点”和“单点击杀终点”，让剑士从清线者升级为前排收割者。
- `add_aoe_on_attack` 仍保留其“士兵层级首次引入 AOE 普攻”的定位。

---

## 6. 弓手 · `archer`

**士兵定位**：远程 DPS；主动技能「狙击」高单体伤害。

### 6.1 等级概览

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通弓手 | 0 | 基础远程输出，默认狙击 |
| **Lv.2** | 神射弓手 | TBD | 狙击伤害提高 + 速射姿态成型 |
| **Lv.3** | 箭雨处决者 | TBD | 狙击附带处决 + 周期性范围箭雨 |

### 6.2 YAML 配置

```yaml
archer:
  id: archer
  name: 弓手
  category: Soldier
  skillTree:
    nodes:
      - id: archer_lv1
        name: 弓手 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: archer_lv2
        name: 弓手 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_skill_damage
            skillId: snipe
            value: 1.5
          - rule: mul_attack_interval
            value: 0.7
          - rule: mul_atk
            value: 0.85
      - id: archer_lv3
        name: 弓手 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_skill_execute
            skillId: snipe
            hpThreshold: 0.3                # 命中 HP < 30% 直接处决
          - rule: add_aoe_on_attack
            period: 5
            radius: 80
            damageRatio: 0.6
```

### 6.3 设计说明

- Lv.2 先做“高频输出 + 狙击变疼”的核心识别，兼顾单点与持续火力。
- Lv.3 再补上 v3.4 两条终点特性：处决与箭雨清场。
- 速射仍保留“攻速上升但单发伤害下调”的设计，以维持输出风格区分。

---

## 7. 牧师 · `priest`

**士兵定位**：治疗支援；主动技能「治疗链」。

### 7.1 等级概览

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通牧师 | 0 | 基础治疗链支援 |
| **Lv.2** | 慈悲牧师 | TBD | 治疗链跳数增加 + 普攻附带治疗 |
| **Lv.3** | 神圣审判者 | TBD | 每跳额外恢复最大生命 + 治疗链可转为对敌伤害 |

### 7.2 YAML 配置

```yaml
priest:
  id: priest
  name: 牧师
  category: Soldier
  skillTree:
    nodes:
      - id: priest_lv1
        name: 牧师 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: priest_lv2
        name: 牧师 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_skill_chain
            skillId: heal_chain
            value: 1
          - rule: add_attack_heal
            friendlyHealRatio: 0.3
      - id: priest_lv3
        name: 牧师 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_skill_bonus_heal
            skillId: heal_chain
            ratio: 0.05
          - rule: add_skill_damage_mode
            skillId: heal_chain
            enemyDamageRatio: 0.8
```

### 7.3 设计说明

- Lv.2 先把牧师确立为“更能铺开治疗覆盖面”的支援核心。
- Lv.3 再加入 v3.4 的高阶转换：治疗链既能更强治疗，也可在必要时转为对敌输出。
- “治疗 → 伤害”的模式切换继续保留为牧师高等级独特卖点。

---

## 8. 工程师 · `engineer`

**士兵定位**：修理建造；主动技能「紧急修复」单次大量恢复友方建筑/塔。

### 8.1 等级概览

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通工程师 | 0 | 基础修理与紧急修复 |
| **Lv.2** | 急救工程师 | TBD | 紧急修复更强 + 建筑维护光环上线 |
| **Lv.3** | 守护工匠 | TBD | 紧急修复冷却减半 + 光环扩大并附带减伤 |

### 8.2 YAML 配置

```yaml
engineer:
  id: engineer
  name: 工程师
  category: Soldier
  skillTree:
    nodes:
      - id: engineer_lv1
        name: 工程师 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: engineer_lv2
        name: 工程师 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_skill_heal
            skillId: emergency_repair
            value: 1.5
          - rule: add_aura
            radius: 80
            target: building
            effect: regen_per_second
            ratio: 0.01                     # 每秒 +1% 最大 HP
      - id: engineer_lv3
        name: 工程师 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_skill_cooldown
            skillId: emergency_repair
            value: 0.5                      # CD 减半
          - rule: mul_aura_radius
            value: 1.5
          - rule: add_aura_effect
            target: building
            effect: damage_reduction
            value: 0.1
```

### 8.3 设计说明

- Lv.2 先建立工程师的双身份：主动抢修 + 被动维护。
- Lv.3 合并高频抢修与阵地减伤，让工程师成为长期防线的基础设施放大器。
- `add_aura` / `mul_aura_radius` / `add_aura_effect` 仍作为该士兵最鲜明的系统特征保留。

---

## 9. 刺客 · `assassin`

**士兵定位**：近战爆发；主动技能「暗杀」瞬移 + 高伤害单次斩击。

### 9.1 等级概览

| 等级 | 名称 | goldCost | 效果摘要 |
|---|---|---|---|
| **Lv.1** | 普通刺客 | 0 | 基础暗杀爆发 |
| **Lv.2** | 影毒刺客 | TBD | 暗杀冷却降低 + 普攻附带中毒 |
| **Lv.3** | 暗影使者 | TBD | 暗杀击杀重置冷却 + 中毒击杀回血 |

### 9.2 YAML 配置

```yaml
assassin:
  id: assassin
  name: 刺客
  category: Soldier
  skillTree:
    nodes:
      - id: assassin_lv1
        name: 刺客 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: assassin_lv2
        name: 刺客 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_skill_cooldown
            skillId: assassinate
            value: 0.7
          - rule: add_poison_on_hit
            duration: 3.0
            tickRatio: 0.2
      - id: assassin_lv3
        name: 刺客 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_skill_reset_on_kill
            skillId: assassinate
          - rule: add_heal_on_poison_kill
            healRatio: 0.2                  # 中毒目标被击杀时刺客 +20% 最大 HP
```

### 9.3 设计说明

- Lv.2 先建立“更频繁暗杀 + DOT 压血”的刺客核心节奏。
- Lv.3 再把爆发链和续航链合并：击杀刷新技能，中毒收割补血。
- `add_heal_on_poison_kill` 继续保留为中毒联动收益的关键 RuleHandler。

---

## 10. 六士兵金币需求与流派覆盖

### 10.1 各士兵金币需求矩阵

| 士兵 | Lv.1 | Lv.2 | Lv.3 |
|---|---|---|---|
| `shield_guard` | 0 | TBD | TBD |
| `swordsman` | 0 | TBD | TBD |
| `archer` | 0 | TBD | TBD |
| `priest` | 0 | TBD | TBD |
| `engineer` | 0 | TBD | TBD |
| `assassin` | 0 | TBD | TBD |

**统一格式**：所有 6 士兵均为 **线性 3 节点**（Lv.1=0，Lv.2=TBD，Lv.3=TBD），不再区分路径总价。

### 10.2 单 Run 金币预算策略示范

| 策略 | 金币分配方式 | 等级结果 | 适合玩法 |
|---|---|---|---|
| **广覆盖补强** | 先给 2-3 个士兵升 Lv.2 | 多个功能位同时成型 | 多面手士兵阵 |
| **单核心拉满** | 集中把 1 个士兵升到 Lv.3 | 一个战术角色完成闭环 | 单士兵卡位深化 |
| **士兵只保底** | 士兵维持 Lv.1，金币主要投塔/Crystal | 士兵只承担基础功能 | 纯塔流 / 高塔流 |

### 10.3 设计意图

- **士兵不是金币主投方向**：它们依然是辅助强化位，不应压过塔与 Crystal 的主成长地位。
- **线性升级减少理解门槛**：玩家只需判断“这张士兵卡值不值得继续升”。
- 士兵科技树的主要价值仍是：**让士兵流玩法可行，但不强迫玩家重投士兵。**

---

## 11. RuleHandler 引用清单

本文档共引用以下 RuleHandler（注册在 `src/core/RuleHandlers.ts`，详 [60-architecture §5.3](../60-tech/60-architecture.md)）：

### 11.1 数值修改类（继承自 22a / 通用）

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `mul_atk` | 攻击力倍率 | 弓手（Lv.2）|
| `mul_attack_interval` | 攻击间隔倍率 | 弓手（Lv.2）|
| `mul_max_hp` | 最大 HP 倍率 | 盾卫（Lv.2 / Lv.3）|
| `add_poison_on_hit` | 命中附加中毒 DOT | 刺客（Lv.2）|

### 11.2 主动技能强化类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `mul_skill_range` | 主动技能范围倍率 | 盾卫（Lv.2）/ 剑士（Lv.2）|
| `mul_skill_damage` | 主动技能伤害倍率 | 弓手（Lv.2）|
| `mul_skill_heal` | 主动技能治疗量倍率 | 工程师（Lv.2）|
| `mul_skill_cooldown` | 主动技能 CD 倍率 | 工程师（Lv.3）/ 刺客（Lv.2）|
| `add_skill_buff` | 主动技能附加 Buff | 盾卫（Lv.3）|
| `add_skill_effect` | 主动技能附加效果（击退/眩晕等）| 剑士（Lv.3）|
| `add_skill_chain` | 主动技能链跳数 +N | 牧师（Lv.2）|
| `add_skill_bonus_heal` | 主动技能额外治疗 | 牧师（Lv.3）|
| `add_skill_execute` | 主动技能附加处决（HP 阈值秒杀）| 弓手（Lv.3）|
| `add_skill_damage_mode` | 主动技能对敌方变伤害模式 | 牧师（Lv.3）|
| `add_skill_reset_on_kill` | 主动技能击杀重置 CD | 刺客（Lv.3）|

### 11.3 普攻 / 行为类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `add_aoe_on_attack` | 周期性普攻 AOE | 剑士（Lv.2）/ 弓手（Lv.3）|
| `add_crit_chance` | 普攻暴击概率 + 倍率 | 剑士（Lv.3）|
| `add_attack_heal` | 普攻附加治疗友军 | 牧师（Lv.2）|

### 11.4 光环 / Buff 类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `add_aura` | 光环效果（半径 + 目标 + 效果）| 工程师（Lv.2）|
| `mul_aura_radius` | 光环范围倍率 | 工程师（Lv.3）|
| `add_aura_effect` | 光环新增效果 | 工程师（Lv.3）|
| `add_cc_immunity` | CC 免疫列表 | 盾卫（Lv.3）|

### 11.5 死亡 / 击杀触发类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `add_heal_on_poison_kill` | 中毒目标被击杀时回血 | 刺客（Lv.3）|

**RuleHandler 保留情况**：v3.4 原有战斗效果 RuleHandler 全部保留，仅从“双路径分布”改为“线性等级分布”。

---

## 12. v3.5 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片词汇彻底废弃 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文 0 处「火花碎片」「shard」「shardCost」「碎片」 |
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「跨 Run」「meta 进度」 |
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 全部升级价格写为 `goldCost` 语义字段，具体数值一律 TBD |
| Lv.1 初始免费 | [22-skill-tree-overview §5.2](./22-skill-tree-overview.md#52-节点等级与金币单价50-mda-new-crystal-锚点) | ✅ 全 6 士兵 Lv.1 节点 `goldCost: 0` |
| 线性三等级成长 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-卡牌等级体系) | ✅ 全文已删除路径互斥表述，统一改为 Lv.1/Lv.2/Lv.3 |
| 获卡即用，无前置依赖图 | [22-skill-tree-overview §6](./22-skill-tree-overview.md#6-获卡与节点解锁) | ✅ 全部 YAML 已删除 `prerequisites` / `mutex` |
| 关内禁止升级 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止升级) | ✅ 全文 0 处“关内升级”正向设计 |
| 与 instanceLevel 正交 | [v3.5-MAJOR-MIGRATION §6](../v3.5-MAJOR-MIGRATION.md) | ✅ 全文 `effects[]` 0 处 `add_instance_level` 引用 |

---

## 13. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.2.0 | 2026-05-18 | refactor | **v3.5 第 2 轮重写**：6 个士兵 YAML 全量升级到 `skillTree.nodes[]` 线性三级 schema；`spCost` 全部改为 `goldCost`；删除 `paths` / `depth` / `prerequisites` / `mutex`；正文表格、概览、术语与不变式全面切换到 v3.5 科技树表达；保留全部既有战斗效果 RuleHandler，并将原双路径效果收敛为 Lv.1/Lv.2/Lv.3 线性成长。 |
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 3 份创建**：士兵技能树详设权威。13 章覆盖：文档定位 / 通用约定 / 六士兵技能树清单 / 6 士兵详设（盾卫 / 剑士 / 弓手 / 牧师 / 工程师 / 刺客）/ 六士兵 SP 总需求矩阵 / RuleHandler 引用清单（17 个）/ v3.4 8 项不变式核对。**v3.4 全新创建（无 v3.1 蓝本）**：v3.1 阶段士兵无关外科技树，v3.4 引入 SP 系统后士兵首次拥有技能树。统一模板：每士兵 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP），路径分叉模板为"强化主动技能 vs 强化普攻/行为"。 |
