---
title: 陷阱科技树详设（v3.5）
status: authoritative
version: 1.2.0
last-modified: 2026-05-18
authority-for:
  - trap-skill-tree
  - trap-tech-tree-nodes
  - trap-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/22a-skill-tree-tower.md
  - 20-units/22b-skill-tree-soldier.md
  - 20-units/21-unit-roster.md
  - 20-units/27-traps-spells-scene.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.5-MAJOR-MIGRATION.md
  - v3.4-MAJOR-MIGRATION.md
---

# 陷阱科技树详设（v3.5）

> ⚠️ **v3.5 形态级变更声明（2026-05-18）**：本文档节点设计将在 v3.5 第 2 轮全面更新（详见 [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md)）。v3.5 核心变更：
> - ~~`spCost`~~ → **`goldCost`**（技能点 SP 废弃，改用金币升级）
> - ~~路径互斥单装备~~ → **线性等级 Lv.1/Lv.2/Lv.3**
> - ~~`prerequisites`/`mutex`~~ → **删除**（获卡=自动解锁，无前置依赖）
> - 节点设计（RuleHandler 效果）本身**保留**，字段名和结构待第 2 轮更新
>
> **当前文档状态**：节点内容仍为 v3.4（spCost/paths 结构），待 v3.5 第 2 轮正式重写。

> ⭐ **本文档是 9 个陷阱单位科技树的唯一权威详设**。所有节点 ID / `goldCost` / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview v2.0.0](./22-skill-tree-overview.md)（v3.5 科技树总览）。

> 🆕 **本文档为 v3.5 节点重写版**。v3.1 阶段陷阱无科技树；v3.4 曾采用 2 路径技能树。v3.5 将其统一重构为**线性三等级**，保留原 RuleHandler 语义，并把旧双路径在 Lv.2 / Lv.3 的效果合并为单线成长包。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定](#2-通用约定)
- [3. 九陷阱科技树清单（概览）](#3-九陷阱科技树清单概览)
- [4. 触发式陷阱（4 种）](#4-触发式陷阱4-种)
  - [4.1 尖刺陷阱 · `spike_trap`](#41-尖刺陷阱--spike_trap)
  - [4.2 地雷 · `landmine`](#42-地雷--landmine)
  - [4.3 焦油坑 · `tar_pit`](#43-焦油坑--tar_pit)
  - [4.4 捕兽夹 · `bear_trap`](#44-捕兽夹--bear_trap)
- [5. 区域式陷阱（3 种）](#5-区域式陷阱3-种)
  - [5.1 火墙 · `fire_wall`](#51-火墙--fire_wall)
  - [5.2 寒霜雾 · `frost_mist`](#52-寒霜雾--frost_mist)
  - [5.3 引力井 · `gravity_well`](#53-引力井--gravity_well)
- [6. 占路式陷阱（2 种）](#6-占路式陷阱2-种)
  - [6.1 巨石 · `boulder`](#61-巨石--boulder)
  - [6.2 诱饵假人 · `decoy_dummy`](#62-诱饵假人--decoy_dummy)
- [7. 九陷阱金币需求与流派覆盖](#7-九陷阱金币需求与流派覆盖)
- [8. RuleHandler 引用清单](#8-rulehandler-引用清单)
- [9. v3.5 不变式核对](#9-v35-不变式核对)
- [10. 修订历史](#10-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责陷阱单位（`category: Trap`）的科技树详设，每陷阱一节，内容包括：

- 陷阱定位 + 占位类型（trap_path / 多格区域 / blocked tile）
- 线性 3 级节点表（Lv.1 / Lv.2 / Lv.3）
- YAML 配置示例
- RuleHandler 引用说明

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 线性等级 / `goldCost` 字段语义 | [22-skill-tree-overview](./22-skill-tree-overview.md) |
| 陷阱机制（触发条件 / DOT 公式 / AOE 形状）| [27-traps-spells-scene §2](./27-traps-spells-scene.md#2-陷阱障碍trap--obstacle)|
| 陷阱基础属性（HP / 触发次数 / 伤害）| [21-unit-roster §5.2](./21-unit-roster.md#52-陷阱阵容trap9-种) + [50-mda §21.1](../50-data-numerical/50-mda.md)|
| 陷阱升级金币数值 | [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) |
| 陷阱配额（5/关 / 3/关 / 2/关）| [21-unit-roster §5.2](./21-unit-roster.md)|

### 1.3 设计理念（vs 塔/士兵科技树）

| 维度 | 塔 22a | 士兵 22b | 陷阱（本文档）|
|---|---|---|---|
| 旧设计来源 | 形态切换 | 主动技能强化 | **耐久向 vs 烈度向双路径** |
| v3.5 节点形态 | 线性等级 | 线性等级 | **统一 Lv.1 / Lv.2 / Lv.3** |
| Lv.2 / Lv.3 语义 | 进阶强化 | 进阶强化 | **合并旧双路径代表性效果** |
| 设计简化原因 | — | — | **陷阱机制本身较简单**（一次性 / 周期触发），适合线性三等级表达 |

---

## 2. 通用约定

### 2.1 goldCost 约定（同 22a / 22b v3.5）

| level | goldCost |
|---|---|
| 1 | 0（起点）|
| 2 | TBD |
| 3 | TBD |

### 2.2 统一节点模板

每陷阱统一采用 **线性三等级**：

- **Lv.1**：基础可用形态；`goldCost: 0`；保留默认效果。
- **Lv.2**：合并旧 `depth=2` 的代表性强化，通常同时覆盖旧双路径的第一层提升。
- **Lv.3**：合并旧 `depth=3` 的高阶强化，保留原顶点 RuleHandler 作为终阶升级包。

### 2.3 单陷阱金币需求表达

- 单陷阱统一为 3 节点：Lv.1（0）→ Lv.2（TBD）→ Lv.3（TBD）
- 具体金币数值统一由 [50-mda §NEW-CRYSTAL](../50-data-numerical/50-mda.md#new-crystal-科技树数值占位) 持有，本文档**不再内嵌固定数值**。
- **设计意图**：玩家单 Run 内对陷阱的金币投入应聚焦少数关键点位，而非把所有陷阱都升到满级。

---

## 3. 九陷阱科技树清单（概览）

| 陷阱 ID | 中文名 | 占位类型 | 触发方式 | 引入关 | Lv.2 主题 | Lv.3 主题 |
|---|---|---|---|---|---|---|
| `spike_trap` | 尖刺陷阱 | trap_path | 触发式 | L1 | 加固耐久 + 重伤毒刺 | 永固尖刺 + 剧毒尖刺 |
| `landmine` | 地雷 | trap_path | 一次性 | L2 | 加宽爆区 + 重型装药 | 集束击退 + 烈焰灼烧 |
| `tar_pit` | 焦油坑 | trap_path | 区域 | L3 | 黏稠减速 + 浓缩易燃 | 永恒焦油 + 火油扩散 |
| `bear_trap` | 捕兽夹 | trap_path | 一次性 | L4 | 定身延长 + 锋利咬伤 | 钢铁承伤 + 致命中毒 |
| `fire_wall` | 火墙 | 3 trap_path | 区域 | L3 | 持久火墙 + 高温强化 | 不灭火墙 + 烈焰风暴 |
| `frost_mist` | 寒霜雾 | 5×3 区域 | 区域 | L4 | 范围扩展 + 严寒减益 | 永冻领域 + 绝对零度 |
| `gravity_well` | 引力井 | r100 区域 | 区域 | L5 | 延时引力场 + 强化拉拽 | 持久引力场 + 黑洞 DOT |
| `boulder` | 巨石 | blocked tile | 占路式 | L2 | 加固血量 + 重型滚动 | 钢铁巨石 + 滚石冲撞 |
| `decoy_dummy` | 诱饵假人 | 空地 | 占路式 | L4 | 加固假人 + 精装伪装 | 钢铁假人 + 反击爆炸 |

---

## 4. 触发式陷阱（4 种）

### 4.1 尖刺陷阱 · `spike_trap`

**陷阱定位**：基础触发式陷阱，5 次触发后损坏；单体物理伤害。

#### 4.1.1 节点图（线性）

```
Lv.1 普通尖刺 ●─── Lv.2 加固重伤尖刺 ○─── Lv.3 永固剧毒尖刺 ○
```

#### 4.1.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通尖刺 | 0 | 基础形态（5 次触发） |
| 2 | 加固重伤尖刺 | TBD | 触发次数 +3；伤害 ×1.5 |
| 3 | 永固剧毒尖刺 | TBD | 触发次数再 +5；附加中毒 DOT 3s |

#### 4.1.3 YAML 配置

```yaml
spike_trap:
  skillTree:
    nodes:
      - id: spike_trap_lv1
        name: 尖刺陷阱 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: spike_trap_lv2
        name: 尖刺陷阱 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_trap_charges
            value: 3
          - rule: mul_trap_damage
            value: 1.5
      - id: spike_trap_lv3
        name: 尖刺陷阱 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_trap_charges
            value: 5
          - rule: add_poison_on_trigger
            duration: 3.0
            tickRatio: 0.2
```

### 4.2 地雷 · `landmine`

**陷阱定位**：一次性 AOE 触发陷阱，r80 半径 150 伤害。

#### 4.2.1 节点图（线性）

```
Lv.1 普通地雷 ●─── Lv.2 加宽重型地雷 ○─── Lv.3 集束烈焰地雷 ○
```

#### 4.2.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通地雷 | 0 | 基础形态（r80 / 一次性爆炸） |
| 2 | 加宽重型地雷 | TBD | 半径 ×1.2；伤害 ×1.5 |
| 3 | 集束烈焰地雷 | TBD | 半径再 ×1.3；触发附加击退 30px；附加灼烧 DOT 4s |

#### 4.2.3 YAML 配置

```yaml
landmine:
  skillTree:
    nodes:
      - id: landmine_lv1
        name: 地雷 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: landmine_lv2
        name: 地雷 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_trap_radius
            value: 1.2
          - rule: mul_trap_damage
            value: 1.5
      - id: landmine_lv3
        name: 地雷 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_trap_radius
            value: 1.3
          - rule: add_knockback_on_trigger
            distance: 30
          - rule: add_burning_on_trigger
            duration: 4.0
            tickRatio: 0.25
```

### 4.3 焦油坑 · `tar_pit`

**陷阱定位**：触发式减速陷阱 + 易燃属性（可被火属性引燃）。

#### 4.3.1 节点图（线性）

```
Lv.1 普通焦油坑 ●─── Lv.2 加深浓缩焦油 ○─── Lv.3 永恒火油焦油 ○
```

#### 4.3.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通焦油坑 | 0 | 基础形态（-60% 移速 / 可被引燃） |
| 2 | 加深浓缩焦油 | TBD | 减速量 +0.1；持续时间 ×1.5；引爆伤害 ×1.25 |
| 3 | 永恒火油焦油 | TBD | 减速量再 +0.1；持续时间改为整波；引爆时 AOE 扩散 r100 |

#### 4.3.3 YAML 配置

```yaml
tar_pit:
  skillTree:
    nodes:
      - id: tar_pit_lv1
        name: 焦油坑 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: tar_pit_lv2
        name: 焦油坑 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_slow_amount
            value: 0.1
          - rule: mul_trap_duration
            value: 1.5
          - rule: mul_ignite_damage
            value: 1.25
      - id: tar_pit_lv3
        name: 焦油坑 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_slow_amount
            value: 0.1
          - rule: set_trap_duration
            duration: wave
          - rule: add_aoe_on_ignite
            radius: 100
            damageRatio: 1.0
```

### 4.4 捕兽夹 · `bear_trap`

**陷阱定位**：一次性定身陷阱（精英也定，Boss 免疫）+ 承伤 +30%。

#### 4.4.1 节点图（线性）

```
Lv.1 普通捕兽夹 ●─── Lv.2 加重锋利捕兽夹 ○─── Lv.3 钢铁致命捕兽夹 ○
```

#### 4.4.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通捕兽夹 | 0 | 基础形态（定身 2s + 承伤 +30%） |
| 2 | 加重锋利捕兽夹 | TBD | 定身时长 +1s；咬伤瞬间伤害 ×1.5 |
| 3 | 钢铁致命捕兽夹 | TBD | 定身时长再 +1s；承伤 +0.2；附加中毒 DOT 5s |

#### 4.4.3 YAML 配置

```yaml
bear_trap:
  skillTree:
    nodes:
      - id: bear_trap_lv1
        name: 捕兽夹 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: bear_trap_lv2
        name: 捕兽夹 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_root_duration
            value: 1.0
          - rule: mul_trap_damage
            value: 1.5
      - id: bear_trap_lv3
        name: 捕兽夹 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_root_duration
            value: 1.0
          - rule: add_vulnerability
            value: 0.2
          - rule: add_poison_on_trigger
            duration: 5.0
            tickRatio: 0.15
```

---

## 5. 区域式陷阱（3 种）

### 5.1 火墙 · `fire_wall`

**陷阱定位**：区域式火墙，8s 持续 20 DPS；飞行敌免疫；可被油坑引爆。

#### 5.1.1 节点图（线性）

```
Lv.1 普通火墙 ●─── Lv.2 持久高温火墙 ○─── Lv.3 不灭烈焰风暴 ○
```

#### 5.1.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通火墙 | 0 | 基础形态（8s 持续 / 20 DPS） |
| 2 | 持久高温火墙 | TBD | 持续时间 ×1.5；DPS ×1.5 |
| 3 | 不灭烈焰风暴 | TBD | 持续时间再 ×1.33；DPS 再 ×1.5；宽度 +1 单元 |

#### 5.1.3 YAML 配置

```yaml
fire_wall:
  skillTree:
    nodes:
      - id: fire_wall_lv1
        name: 火墙 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: fire_wall_lv2
        name: 火墙 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_trap_duration
            value: 1.5
          - rule: mul_trap_dps
            value: 1.5
      - id: fire_wall_lv3
        name: 火墙 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_trap_duration
            value: 1.33
          - rule: mul_trap_dps
            value: 1.5
          - rule: add_trap_width
            value: 1
```

### 5.2 寒霜雾 · `frost_mist`

**陷阱定位**：5×3 trap_path 区域 + 整波持续 -40% 移速 -25% 攻速。

#### 5.2.1 节点图（线性）

```
Lv.1 普通寒霜雾 ●─── Lv.2 加密严寒寒霜雾 ○─── Lv.3 永冻绝对零度 ○
```

#### 5.2.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通寒霜雾 | 0 | 基础形态（5×3 / -40% 移速 / -25% 攻速） |
| 2 | 加密严寒寒霜雾 | TBD | 区域高度 +1；减速量 +0.15；攻速减益 +0.1 |
| 3 | 永冻绝对零度 | TBD | 区域高度再 +1；减速量再 +0.15；攻速减益再 +0.15；5% 概率冰冻 1s |

#### 5.2.3 YAML 配置

```yaml
frost_mist:
  skillTree:
    nodes:
      - id: frost_mist_lv1
        name: 寒霜雾 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: frost_mist_lv2
        name: 寒霜雾 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_trap_height
            value: 1
          - rule: add_slow_amount
            value: 0.15
          - rule: add_atk_speed_debuff
            value: 0.1
      - id: frost_mist_lv3
        name: 寒霜雾 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_trap_height
            value: 1
          - rule: add_slow_amount
            value: 0.15
          - rule: add_atk_speed_debuff
            value: 0.15
          - rule: add_freeze_chance
            probability: 0.05
            duration: 1.0
```

### 5.3 引力井 · `gravity_well`

**陷阱定位**：r100 区域 + 5s 持续拉拽（含飞行敌）。

#### 5.3.1 节点图（线性）

```
Lv.1 普通引力井 ●─── Lv.2 加长强化引力井 ○─── Lv.3 持久黑洞引力井 ○
```

#### 5.3.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通引力井 | 0 | 基础形态（5s 持续拉拽） |
| 2 | 加长强化引力井 | TBD | 持续时间 +2s；拉拽速度 ×1.5 |
| 3 | 持久黑洞引力井 | TBD | 持续时间再 +3s；拉拽速度再 ×1.33；区域内每秒 5% 最大 HP DOT |

#### 5.3.3 YAML 配置

```yaml
gravity_well:
  skillTree:
    nodes:
      - id: gravity_well_lv1
        name: 引力井 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: gravity_well_lv2
        name: 引力井 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: add_trap_duration
            value: 2.0
          - rule: mul_pull_speed
            value: 1.5
      - id: gravity_well_lv3
        name: 引力井 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: add_trap_duration
            value: 3.0
          - rule: mul_pull_speed
            value: 1.33
          - rule: add_dot_in_zone
            ratio: 0.05
```

---

## 6. 占路式陷阱（2 种）

### 6.1 巨石 · `boulder`

**陷阱定位**：800 HP 占路 + 死亡沿路径滚动 1 格造成 150 伤害。

#### 6.1.1 节点图（线性）

```
Lv.1 普通巨石 ●─── Lv.2 加固重型巨石 ○─── Lv.3 钢铁滚石冲撞 ○
```

#### 6.1.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通巨石 | 0 | 基础形态（800 HP / 滚动 1 格） |
| 2 | 加固重型巨石 | TBD | 最大 HP ×1.3；滚动距离 +1 格 |
| 3 | 钢铁滚石冲撞 | TBD | 最大 HP 再 ×1.3；滚动距离再 +1 格；滚动伤害 ×1.5 |

#### 6.1.3 YAML 配置

```yaml
boulder:
  skillTree:
    nodes:
      - id: boulder_lv1
        name: 巨石 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: boulder_lv2
        name: 巨石 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_max_hp
            value: 1.3
          - rule: add_roll_distance
            value: 1
      - id: boulder_lv3
        name: 巨石 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_max_hp
            value: 1.3
          - rule: add_roll_distance
            value: 1
          - rule: mul_roll_damage
            value: 1.5
```

### 6.2 诱饵假人 · `decoy_dummy`

**陷阱定位**：200 HP 空地占位 + 伪装成箭塔骗刺客类敌人。

#### 6.2.1 节点图（线性）

```
Lv.1 普通假人 ●─── Lv.2 加固精装假人 ○─── Lv.3 钢铁反击假人 ○
```

#### 6.2.2 节点详表

| level | 节点名 | goldCost | 效果摘要 |
|---|---|---|---|
| 1 | 普通假人 | 0 | 基础形态（200 HP / 伪装占位） |
| 2 | 加固精装假人 | TBD | 最大 HP ×1.5；吸引半径 ×1.5 |
| 3 | 钢铁反击假人 | TBD | 最大 HP 再 ×1.5；死亡时对 80px 半径敌人造成 100 伤害 |

#### 6.2.3 YAML 配置

```yaml
decoy_dummy:
  skillTree:
    nodes:
      - id: decoy_dummy_lv1
        name: 诱饵假人 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: decoy_dummy_lv2
        name: 诱饵假人 Lv.2
        level: 2
        goldCost: TBD
        effects:
          - rule: mul_max_hp
            value: 1.5
          - rule: mul_attract_radius
            value: 1.5
      - id: decoy_dummy_lv3
        name: 诱饵假人 Lv.3
        level: 3
        goldCost: TBD
        effects:
          - rule: mul_max_hp
            value: 1.5
          - rule: add_death_explosion
            radius: 80
            damage: 100
            factionFilter: [Enemy]
```

---

## 7. 九陷阱金币需求与流派覆盖

### 7.1 goldCost 需求矩阵

| 陷阱 | Lv.2 `goldCost` | Lv.3 `goldCost` | 满级总需求 |
|---|---|---|---|
| `spike_trap` | TBD | TBD | TBD + TBD |
| `landmine` | TBD | TBD | TBD + TBD |
| `tar_pit` | TBD | TBD | TBD + TBD |
| `bear_trap` | TBD | TBD | TBD + TBD |
| `fire_wall` | TBD | TBD | TBD + TBD |
| `frost_mist` | TBD | TBD | TBD + TBD |
| `gravity_well` | TBD | TBD | TBD + TBD |
| `boulder` | TBD | TBD | TBD + TBD |
| `decoy_dummy` | TBD | TBD | TBD + TBD |

**统一格式**：所有 9 陷阱均为线性 3 节点（Lv.1 / Lv.2 / Lv.3）。

### 7.2 单 Run 金币预算策略示范

| 策略 | 金币分配 | 升级陷阱数 | 适合玩法 |
|---|---|---|---|
| **2-3 个关键陷阱升 Lv.2** | 若干 `TBD` × 2-3 | 2-3 个陷阱 | 配合塔阵线 |
| **1 个核心陷阱直冲 Lv.3** | `TBD + TBD` | 1 个关键陷阱 | 卡死关键路口 |
| **不投陷阱** | 0 金币 | 0 | 纯塔流 / 士兵流 |

### 7.3 设计意图

- 陷阱的一次性 / 周期触发本质决定其金币投入优先级通常低于核心塔与士兵。
- 设计预期：玩家单 Run 内会把金币集中投在少量关键陷阱，而不是全图平均升级。
- 9 陷阱均采用统一线性模板，方便 UI 直接展示 Lv.1 / Lv.2 / Lv.3 升级序列。

---

## 8. RuleHandler 引用清单

### 8.1 通用数值类（继承自 22a / 22b）

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_max_hp` | 最大 HP 倍率 | boulder（Lv.2 / Lv.3）/ decoy_dummy（Lv.2 / Lv.3）|
| `mul_trap_damage` | 陷阱伤害倍率 | spike_trap（Lv.2）/ landmine（Lv.2）/ bear_trap（Lv.2）|

### 8.2 触发次数 / 持续时间类

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `add_trap_charges` | 陷阱触发次数 +N | spike_trap（Lv.2 / Lv.3）|
| `mul_trap_duration` | 陷阱持续时间倍率 | tar_pit（Lv.2）/ fire_wall（Lv.2 / Lv.3）|
| `add_trap_duration` | 陷阱持续时间 +N 秒 | gravity_well（Lv.2 / Lv.3）|
| `set_trap_duration` | 设置陷阱持续模式 | tar_pit（Lv.3，`duration=wave`）|

### 8.3 范围 / 形状类

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_trap_radius` | 陷阱半径倍率 | landmine（Lv.2 / Lv.3）|
| `add_trap_width` | 陷阱宽度 +N 单元 | fire_wall（Lv.3）|
| `add_trap_height` | 陷阱区域高度 +N 单元 | frost_mist（Lv.2 / Lv.3）|

### 8.4 触发附加效果类

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `add_poison_on_trigger` | 触发附加中毒 DOT | spike_trap（Lv.3）/ bear_trap（Lv.3）|
| `add_burning_on_trigger` | 触发附加灼烧 DOT | landmine（Lv.3）|
| `add_knockback_on_trigger` | 触发附加击退 | landmine（Lv.3）|
| `add_root_duration` | 定身时长 +N 秒 | bear_trap（Lv.2 / Lv.3）|
| `add_vulnerability` | 承伤倍率 +N | bear_trap（Lv.3）|
| `add_freeze_chance` | 概率冰冻 | frost_mist（Lv.3）|
| `add_slow_amount` | 减速量 +N（绝对值）| frost_mist（Lv.2 / Lv.3）/ tar_pit（Lv.2 / Lv.3）|
| `add_atk_speed_debuff` | 攻速减益 +N | frost_mist（Lv.2 / Lv.3）|

### 8.5 引力井专用

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_pull_speed` | 拉拽速度倍率 | gravity_well（Lv.2 / Lv.3）|
| `add_dot_in_zone` | 区域内每秒 N% 最大 HP DOT | gravity_well（Lv.3）|

### 8.6 火墙 / 焦油坑专用

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_trap_dps` | 陷阱 DPS 倍率 | fire_wall（Lv.2 / Lv.3）|
| `mul_ignite_damage` | 引爆伤害倍率 | tar_pit（Lv.2）|
| `add_aoe_on_ignite` | 引爆时 AOE 扩散 | tar_pit（Lv.3）|

### 8.7 占路式专用

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `add_roll_distance` | 滚动距离 +N 格 | boulder（Lv.2 / Lv.3）|
| `mul_roll_damage` | 滚动伤害倍率 | boulder（Lv.3）|
| `mul_attract_radius` | 吸引半径倍率 | decoy_dummy（Lv.2）|
| `add_death_explosion` | 死亡 AOE 爆炸 | decoy_dummy（Lv.3）|

**RuleHandler 覆盖说明**：本文档保留原 9 陷阱的全部效果语义；v3.5 仅重写节点结构与术语，不删除任何既有 `effects[]` 规则内容。

---

## 9. v3.5 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 技能点 SP 词汇废弃 | [v3.5-MAJOR-MIGRATION](../v3.5-MAJOR-MIGRATION.md) | ✅ 正文已统一改为金币 / `goldCost` |
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ Lv.2 / Lv.3 费用统一写 `TBD`，不内嵌具体金币数值 |
| 节点结构采用线性三等级 | [22-skill-tree-overview §7](./22-skill-tree-overview.md#7-yaml-配置-schema) | ✅ 全 9 陷阱均为 `skillTree.nodes[]` + `level=1/2/3` |
| Lv.1 默认可用 | [22-skill-tree-overview §5.2](./22-skill-tree-overview.md#52-节点等级与金币单价50-mda-new-crystal-锚点) | ✅ 全部 Lv.1 节点 `goldCost: 0` |
| 无前置依赖图 | [22-skill-tree-overview §2.2](./22-skill-tree-overview.md#22-废弃机制总结) | ✅ 全文已删除 `prerequisites` / `mutex` / 路径互斥表述 |
| 获卡自动解锁 | [22-skill-tree-overview §6](./22-skill-tree-overview.md#6-获卡与节点解锁) | ✅ 本文档未引入额外解锁条件 |
| 关内禁止升级 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止升级) | ✅ 全文未引入关内升级描述 |
| 与 instanceLevel 正交 | [v3.5-MAJOR-MIGRATION §6](../v3.5-MAJOR-MIGRATION.md) | ✅ 全文 `effects[]` 0 处 `add_instance_level` 引用 |

---

## 10. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.2.0 | 2026-05-18 | refactor | **v3.5 第 2 轮节点重写**：9 个陷阱 YAML 全量从 `skillTree.paths[]` 升级为 `skillTree.nodes[]` 线性 3 级 schema；统一 `depth`→`level`、`spCost`→`goldCost`、删除 `prerequisites` / `mutex`；所有概览表、节点表、章节标题和正文术语改为金币 / Lv.1-Lv.3 / 获卡自动解锁。 |
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 4 份创建**：陷阱技能树详设权威。10 章覆盖：文档定位 / 通用约定 / 九陷阱技能树清单 / 4 触发式陷阱（spike_trap / landmine / tar_pit / bear_trap）+ 3 区域式陷阱（fire_wall / frost_mist / gravity_well）+ 2 占路式陷阱（boulder / decoy_dummy）/ SP 总需求矩阵 / RuleHandler 引用清单（26 个）/ v3.4 8 项不变式核对。**v3.4 全新创建（无 v3.1 蓝本）**。统一模板：每陷阱 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP），路径分叉为"耐久向 vs 烈度向"。 |
