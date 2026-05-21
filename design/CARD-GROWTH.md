# Tower Defender — 卡牌成长

> 当前成长系统版本：**v3.7（2026-05-21）**
> 本文档覆盖：卡牌成长总览、单卡等级上限（1-3）、金币升级、删卡经济位、各卡成长定位、遗物/词条效果复用边界。
> 具体金币数值见 [NUMBERS.md](./NUMBERS.md)。

---

## 1. 卡牌成长总览

### 1.1 核心设计原则

| 原则 | 描述 |
|------|------|
| **本 Run 闭环** | 卡牌成长状态仅本 Run 内有效，Run 结束清零 |
| **金币升级** | 节点升级花费金币（goldCost） |
| **单卡等级上限可变** | 每张卡按设计拥有 Lv.1 / Lv.2 / Lv.3 中的部分等级，**上限可为 1-3 级** |
| **获卡自动解锁** | 获卡/购卡即自动解锁该卡成长线，无需额外步骤 |
| **删卡也是成长手段** | 金币不仅用于升级，也用于删除卡、精简卡池 |
| **关内禁止升级** | 只能在关间成长，关内无升级按钮 |
|
### 1.2 已废弃机制

| 旧机制 | 当前处理 |
|-----------|-----------|
| 技能点 SP 资源 | 废弃 |
| Crystal 限制卡牌等级上限 | 废弃 |
| instanceLevel / 精炼术 | 废弃 |
| 路径互斥单装备 | 废弃 |
|
### 1.4 遗物、关卡词条、秘境词条的关系（v3.8）

虽然本篇主要描述卡牌成长，但从系统职责上，**遗物、关卡词条、秘境词条共享同一类“被动效果改写”表达方式**。

- **遗物**：通过关后奖励/事件/商店获得，通常跨多关持续
- **关卡词条**：进入关卡前随机获得，只对当前关卡持续
- **秘境词条**：由秘境事件授予，可持续当前关、下一关、后续数关或整局
- **共同点**：都应复用统一的被动效果管线，而不是各写各的逻辑分支

这意味着：
- 单位强化、能量改写、部署返还、特定标签增伤/减益等效果
- 优先作为可复用 `effectRef` / `modifier` 能力沉淀
- 再由“遗物 / 关卡词条 / 秘境词条”三种来源去挂载

---

## 2. 成长经济结构

成长金币的主要去向分为三条：
- **买新卡**：扩池，增加战术选择
- **升老卡**：把核心牌推高质量
- **删废卡**：缩池，提高关键牌命中率

这是 v3.6 的核心成长三角。

### 2.1 删卡规则

- 删除对象：当前已拥有卡池中的任意卡
- 货币：金币
- 费用：**每删 1 张，下一次费用翻倍**
- 目的：控制删卡强度，避免开局直接极致压缩卡池

### 2.2 单卡等级上限

| 卡牌类型 | 常见上限 |
|---------|---------|
| 基础功能卡 | Lv.1 或 Lv.2 |
| 主力输出卡 | Lv.2 或 Lv.3 |
| 核心 build-around 卡 | Lv.3 |

不是所有卡都需要完整 3 级成长线；设计重点是区分“过渡卡”和“核心卡”。

---

## 3. 卡牌等级体系

| 等级 | goldCost | 说明 |
|------|----------|------|
| **Lv.1**（入手默认）| 0 | 获卡即可用 |
| **Lv.2**（若存在）| TBD | 中段强化，强调效率跃迁 |
| **Lv.3**（若存在）| TBD | 高段强化，强调 build 成型 |

- 卡牌等级升级只在关间进行
- 某张卡若 `maxLevel = 1`，则不会出现升级入口
- 某张卡若 `maxLevel = 2`，则只能升到 Lv.2
- 某张卡若 `maxLevel = 3`，则拥有完整成长线
- 单卡等级设计的重点是：让“升级资源”更值得思考，而不是所有卡都机械三段成长

## 3.5 遗物系统与统一词条系统的表达

### 遗物定位

遗物是 **Run 内跨关持续的被动强化/规则改写**。它的职责不是替代卡牌成长，而是为构筑提供“方向性放大器”。

### 关卡词条定位

关卡词条是 **当前关卡有效的临时遗物式效果**。

### 秘境词条定位

秘境词条是 **由秘境事件授予的阶段性被动效果**，持续范围可短可长：
- 只持续当前关
- 只持续下一关
- 持续后续 N 关
- 或直接持续整个 Run

### 统一表达原则

遗物、关卡词条、秘境词条都应基于同一套效果描述：

```typescript
interface PassiveEffectRef {
  id: string
  targetTags?: string[]
  modifiers?: Array<{
    stat: string
    op: 'add' | 'mul' | 'set'
    value: number
  }>
  triggers?: string[]
}
```

来源只区分：

```typescript
interface PassiveSource {
  sourceType: 'relic' | 'level_modifier' | 'sanctum_modifier'
  sourceId: string
  activeScope: 'run' | 'current_level' | 'next_level' | 'next_n_levels'
}
```

设计约束：
- **不要**为了关卡词条或秘境词条再发明一套新 DSL
- **不要**让同一效果在遗物和不同词条来源里各写一份逻辑
- 应优先沉淀可复用 effect，再由不同来源挂载

---

### 4. 七塔成长详设（元素分拆 + 新弩塔）

### 4.1 塔主动技能（关内手动触发，无能量消耗）

| 塔 | 主动技能 | 效果 | CD |
|---|---------|------|-----|
| 箭塔 | **齐射** | 立即向射程内所有敌人各发 1 支箭 | 12s |
| 炮塔 | **精准轰炸** | 对当前目标发射高爆炮弹（伤害 ×2.5，AOE 半径 ×1.5）| 15s |
| 冰塔 | **寒霜爆发** | 圆形寒霜爆炸 r80：群体冻结 2s | 18s |
| 火塔 | **烈焰爆发** | 圆形火焰爆炸 r80：群体灼烧 | 18s |
| 毒塔 | **毒雾爆发** | 圆形毒雾爆炸 r80：群体中毒并扩散 | 18s |
| 电塔 | **过载放电** | 对场上所有敌人 1 跳链式闪电（普攻 60%，无限跳）| 20s |
| 激光塔 | **全功率聚焦** | 对当前锁定目标持续 2s 超载照射，聚焦倍率额外提高 | 16s |
| 弩塔 | **穿云重弩** | 朝当前目标方向发射一枚强化弩箭，贯穿整条直线并伤害沿途所有敌人 | 16s |
| 蝙蝠塔 | **召唤蝠群** | 召唤 3 只临时幽灵蝙蝠（HP 极低，存活 8s，追杀敌人）| 14s |
| 导弹塔 | **饱和打击** | 立即发射 3 枚导弹锁定场上 HP 最高的 3 个敌人 | 25s |

### 4.2 箭塔 `arrow_tower`

**定位**：物理单体远程，基础经济友好型。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 普通箭塔单发 |
| Lv.2 | TBD | 弹丸数 +1；攻击间隔 ×0.4、单发伤害 ×0.5 |
| Lv.3 | TBD | 再 +1 弹丸（共 3 发）；命中附加灼烧 DOT |

YAML effects 引用：`add_projectile_count` / `mul_attack_interval` / `mul_atk` / `add_burning_on_hit`

### 4.3 炮塔 `cannon_tower`

**定位**：物理 AOE 范围伤害，主清杂兵。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 普通炮塔 AOE |
| Lv.2 | TBD | 命中按概率眩晕；**或**攻击间隔 ×2、射程 ×1.5、攻击 ×2.5 切换为单体模式 |
| Lv.3 | TBD | 命中击退；**或**弹道贯穿 ≤2 目标 |

YAML effects 引用：`add_stun_on_hit` / `mul_attack_interval` / `mul_range` / `mul_atk` / `set_attack_mode` / `add_knockback_on_hit` / `add_pierce`

### 4.4 冰塔 `ice_tower`

**定位**：控制塔，负责减速与冰冻。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 命中叠加减速；满层冻结 |
| Lv.2 | TBD | 减速层数更稳定，冻结阈值降低 |
| Lv.3 | TBD | 冰冻结束触发碎裂伤害 |

YAML effects 引用：`slow_on_hit` / `freeze_at_max_stacks` / `add_shatter_on_freeze_end`

### 4.5 火塔 `fire_tower`

**定位**：持续灼烧，负责清杂与压血线。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 命中附加灼烧 DOT |
| Lv.2 | TBD | 灼烧持续时间/层数提升 |
| Lv.3 | TBD | 灼烧可向邻近目标扩散 |

YAML effects 引用：`burn_on_hit` / `mul_burn_duration` / `add_burn_spread`

### 4.6 毒塔 `poison_tower`

**定位**：叠毒削弱，负责持续磨血。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 命中附加中毒 DOT |
| Lv.2 | TBD | 中毒伤害与持续时间提升 |
| Lv.3 | TBD | 中毒传播，并附带削弱效果 |

YAML effects 引用：`poison_on_hit` / `mul_poison_duration` / `add_poison_contagion` / `add_atk_debuff_on_hit`

### 4.7 电塔 `lightning_tower`

**定位**：链式弹跳，群体压制。Lv.3 并入原终极全屏闪电。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 默认 1 次弹跳 |
| Lv.2 | TBD | 弹跳次数 +1（共 2 次）|
| Lv.3 | TBD | 再 +1 弹跳（共 3 次）；概率触发**全屏闪电**（全场随机敌人，普攻 ×1.5，CD 10s）|

YAML effects 引用：`add_chain_bounce` / `add_global_strike`

### 4.8 激光塔 `laser_tower`

**定位**：聚焦 / 持续输出。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 普通激光塔；持续锁定单体 |
| Lv.2 | TBD | 锁定同一目标时伤害开始逐段爬升 |
| Lv.3 | TBD | 聚焦上限更高；换目标重置；满聚焦时附带破隐/灼穿效果 |

YAML effects 引用：`set_target_lock` / `add_charge_damage` / `set_charge_reset_on_target_change` / `add_reveal_on_full_charge`

### 4.9 弩塔 `crossbow_tower`

**定位**：直线穿透物理输出。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 对第一个目标发射弩箭，直线贯穿到棋盘边缘 |
| Lv.2 | TBD | 弩箭宽度或伤害提升，更适合清走廊敌群 |
| Lv.3 | TBD | 贯穿路径附带破甲/流血效果 |

YAML effects 引用：`piercing` / `set_projectile_to_board_edge` / `mul_pierce_width` / `add_armor_break_on_hit`

### 4.10 蝙蝠塔 `bat_tower`

**定位**：群体单位类塔，受天气影响（`weather_dependent_atk`）。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 默认 3 蝙蝠 |
| Lv.2 | TBD | 蝙蝠数 +1（共 4）；单蝙蝠 ATK ×1.2 |
| Lv.3 | TBD | 再 +1（共 5）；单蝙蝠 ATK 再 ×1.2 |

YAML effects 引用：`add_bat_count` / `mul_atk`

### 4.10 导弹塔 `missile_tower`

**定位**：战略大射程（600px）打击，手动指挥 + 托管双模式。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 单发导弹 |
| Lv.2 | TBD | 同一地格同发 2 枚、单发伤害 ×0.6；爆炸附加灼烧 DOT |
| Lv.3 | TBD | 再 +1 导弹（共 3）、单发伤害再 ×0.7；爆炸范围 ×1.6、爆炸伤害 ×1.4 |

**双模式**：
- **手动指挥**（默认）：玩家点击塔 → 拖动指示器 → 指定目标格 → 发射
- **托管**：自动按地格评分选格（右键塔切换）

**地格评分系统**（托管模式）：
1. 枚举所有路径地格（`path` 类型 tile）
2. 计分 = 地格上当前敌人数量 × 权重 + 附近格敌人溅射预期 + Boss 在射程内加分 - 己方单位在爆炸半径内扣分
3. 选得分最高格为目标；导弹飞向目标格中心，到达后引爆（r100，真实伤害）

YAML effects 引用：`add_missile_count` / `mul_atk` / `add_burning_on_explosion` / `mul_explosion_radius`

---

## 5. 六士兵成长详设

### 5.1 士兵成长总览

| 士兵 ID | Lv.1 | Lv.2 | Lv.3 |
|---------|------|------|------|
| `shield_guard` | 嘲讽基础 | 嘲讽范围 + 护甲↑ | 嘲讽 + 反伤被动 |
| `swordsman` | 旋风斩基础 | 范围 + 伤害↑ | 范围再扩 + 击退 |
| `archer` | 狙击基础 | 射程 + 伤害↑ | 多目标狙击 |
| `priest` | 治疗链基础 | 治疗量↑ + 范围↑ | 全场治疗爆发 |
| `engineer` | 紧急修复基础 | 修复量↑ + 范围↑ | 修复 + 被动回血 |
| `assassin` | 暗杀基础 | 伤害↑ + 隐身 | 多次传送 |

各士兵获卡即 Lv.1，goldCost 见 NUMBERS.md（TBD）。

---

## 6. 九陷阱成长详设

### 6.1 陷阱成长总览

| 陷阱 ID | Lv.1 | Lv.2 | Lv.3 |
|---------|------|------|------|
| `spike_trap` | 5 次触发 | 触发次数 + 伤害↑ | 触发后滞留效果 |
| `landmine` | 一次性 AOE | 伤害↑ + 范围↑ | 二次引爆 |
| `tar_pit` | 减速 + 易燃 | 减速叠加 | 易燃倍率↑ |
| `bear_trap` | 定身 2s | 定身时间↑ + 承伤↑ | 群体定身 |
| `fire_wall` | 8s 火墙 | 持续时间↑ + DPS↑ | 溅射扩展 |
| `frost_mist` | 减速减攻速 | 效果量↑ | 全波次覆盖↑ |
| `gravity_well` | 5s 拉拽 | 持续时间↑ | 含飞行+吸伤 |
| `boulder` | 800 HP 路障 | HP↑ + 滚动伤害↑ | 多次滚动 |
| `decoy_dummy` | 200 HP 诱饵 | HP↑ + 更像塔 | 死亡爆炸 |

---

## 7. 十四法术成长详设

### 7.1 法术成长总览

法术卡成长升级提升效果量（伤害/范围/CD/持续时间四维度），不改变法术的基础机制类型。

| 法术 | Lv.2 | Lv.3 |
|------|------|------|
| `fireball_spell` | 伤害 + 范围↑ | 燃烧 DOT |
| `meteor_spell` | 溅射比↑ | 目标数↑ |
| `chain_lightning_spell` | 弹射次数 +1 | 弹射次数再 +1 |
| `purification_spell` | 额外回血↑ | 全场净化 |
| `freeze_all_spell` | 冻结时间↑ | 带伤害 |
| `slow_spell` | 减速量↑ | 持续时间↑ |
| `arrow_rain_spell` | DPS↑ | 范围↑ |
| `tornado_spell` | 持续时间↑ | 伤害↑ |
| `heal_pulse_spell` | 治疗量↑ | 过量治疗转护盾 |
| `divine_protection_spell` | 保护次数↑ | 覆盖全波次 |
| `rally_horn_spell` | 持续时间↑ | 效果量↑ |
| `summon_skeletons_spell` | 骷髅数 +2 | 骷髅 ATK↑ |
| `time_dilation_spell` | 持续时间↑ | 减速量↑ |
| `tactical_retreat_spell` | 能量返还↑ | 可选多个目标 |

> 注：instanceLevel / 精炼术已在 v3.5 整套废弃，不存在关内临时法术升级机制。

---

## 8. 两生产建筑成长详设

| 建筑 ID | Lv.1 | Lv.2 | Lv.3 |
|---------|------|------|------|
| `gold_mine` | 基础产金 | 产金速率↑ | 产金速率再↑ + 关间奖励↑ |
| `energy_crystal` | 关内额外获得 +3 水晶能量 | 关内额外获得 +4 水晶能量 | 关内额外获得 +5 水晶能量 |

---

## 9. YAML Schema（完整塔示例）

```yaml
arrow_tower:
  id: arrow_tower
  name: 箭塔
  category: tower
  baseStats:           # 数值见 NUMBERS.md
    hp: 100
    atk: 20
    range: 200
    attackInterval: 1.0
  activeSkill:
    id: arrow_volley
    name: 齐射
    cdSeconds: 12
    triggerType: manual
    effects:
      - rule: fire_at_all_in_range
        damageRatio: 1.0
  growth:
    nodes:
      - id: arrow_tower_lv1
        name: 箭塔 Lv.1
        level: 1
        goldCost: 0
        effects: []
      - id: arrow_tower_lv2
        name: 箭塔 Lv.2
        level: 2
        goldCost: TBD          # 见 NUMBERS.md §NEW-CRYSTAL
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

**废弃字段**：`paths[]`（多路径）、`spCost`（SP 费用）、`prerequisites`（前置依赖）、`mutex`（路径互斥）——v3.5 全部删除。

---

## 10. 单 Run 金币分配策略

| 策略 | 分配方向 | 适合玩法 |
|------|---------|---------|
| **广撒网** | 多卡 Lv.1/Lv.2，保留金币买卡与功能卡 | 多元阵容协同 |
| **深耕核心卡** | 先把 1-2 张主力卡推到 Lv.3，再补关键辅助 | 核心卡成型 |
| **元素复合流** | 冰塔 / 火塔 / 毒塔 共同升高等级 + 补控制/爆发辅助牌 | 极致元素异常流派 |
| **终极电塔** | 尽快电塔 Lv.3（全屏闪电爆点）| 末期 panic button |

设计目标：玩家不能在单 Run 内无脑把全部核心塔都升满，必须在「扩阵容」和「深升级」之间取舍。
