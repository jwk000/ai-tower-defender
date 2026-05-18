# Tower Defender — 科技树

> 本文档覆盖：科技树总览（v3.5）、Crystal 升级机制、卡牌等级体系、7 塔 / 6 士兵 / 9 陷阱 / 14 法术 / 2 生产建筑的等级节点设计、导弹塔特殊机制、RunManager 接口。
> 具体金币数值见 [NUMBERS.md](./NUMBERS.md)。陷阱/法术详细设计见本文档 §5-§7。

---

## 1. 科技树总览

### 1.1 核心设计原则

| 原则 | 描述 |
|------|------|
| **本 Run 闭环** | 科技树状态仅本 Run 内有效，Run 结束清零 |
| **金币升级** | 节点升级花费金币（goldCost），不使用技能点 SP |
| **线性等级** | Lv.1 / Lv.2 / Lv.3，废弃路径互斥 |
| **获卡自动解锁** | 获卡/购卡即自动解锁该卡科技树节点，无需额外步骤 |
| **Crystal 双控制器** | Crystal 等级同时决定人口上限和卡牌等级上限 |
| **关内禁止升级** | 只能在关间节点升级，关内无「升级」按钮 |

### 1.2 废弃机制

| v3.4 机制 | v3.5 处理 |
|-----------|-----------|
| 技能点 SP 资源 | 整套废弃，改为金币 |
| 路径互斥单装备 | 废弃，改为线性 Lv1-3 |
| instanceLevel / 精炼术 | 整套废弃 |
| 前置节点 prerequisites | 废弃（线性升级无前置依赖图）|
| 商店金币→SP 兑换 | 废弃 |

### 1.3 RunManager 接口

```typescript
interface RunManager {
  crystalLevel: 1 | 2 | 3           // Crystal 当前等级
  techTreeState: TechTreeState       // 本 Run 科技树状态
}

interface TechTreeState {
  instances: Record<string, CardTechTreeState>  // key = cardInstanceId
}

interface CardTechTreeState {
  unitCardId: string        // 卡种类 ID（如 'arrow_tower'）
  cardLevel: 1 | 2 | 3     // 当前卡牌等级
}
```

---

## 2. Crystal 升级机制

Crystal（防御水晶）是玩家 Run 内的防御核心：
- **HP 资源**：Crystal HP 降至 0 则 Run 失败
- **升级目标**：关间花金币升 Lv1→Lv2→Lv3

| Crystal 等级 | 人口上限 | 卡牌等级上限 |
|------------|---------|------------|
| **Lv.1**（Run 初始）| TBD | 1（只能用 Lv1 卡牌效果）|
| **Lv.2** | TBD | 2（可升卡牌到 Lv2）|
| **Lv.3** | TBD | 3（可升卡牌到 Lv3）|

**升级规则**：
- 仅关间可升级，单向（不可降级），Run 结束清零
- 升级后立即生效（人口上限 + 卡牌等级上限同步提升）

**金币分配策略三角**：
```
金币 G
 ├──→ Crystal 升级（提升人口上限 + 卡牌等级上限）
 ├──→ 卡牌升级（提升特定卡牌效果，受 Crystal 上限约束）
 ├──→ 商店买卡（扩池，自动解锁科技树节点）
 └──→ 其他功能卡（能量瓶/水晶修复/手牌刷新）
```

---

## 3. 卡牌等级体系

| 等级 | goldCost | 说明 |
|------|----------|------|
| **Lv.1**（入手默认）| 0 | 获卡即可用，零门槛 |
| **Lv.2**（进阶）| TBD | 需 Crystal Lv.2 上限解锁 |
| **Lv.3**（高阶）| TBD | 需 Crystal Lv.3 上限解锁 |

- 卡牌等级升级只在关间进行
- 卡牌等级本身**不改变 energyCost（人口占用）**
- 每升一级，激活对应 depth 节点的 effects[]（差量叠加）
- 节点 effects[] 差量语义：只描述相对上一等级的增量变化

---

## 4. 七塔科技树详设

### 4.1 塔主动技能（关内手动触发，无能量消耗）

| 塔 | 主动技能 | 效果 | CD |
|---|---------|------|-----|
| 箭塔 | **齐射** | 立即向射程内所有敌人各发 1 支箭 | 12s |
| 炮塔 | **精准轰炸** | 对当前目标发射高爆炮弹（伤害 ×2.5，AOE 半径 ×1.5）| 15s |
| 元素塔 | **元素爆发** | 圆形元素爆炸 r80：冰→群体冻结 2s / 火→群体灼烧 / 毒→群体中毒传播 | 18s |
| 电塔 | **过载放电** | 对场上所有敌人 1 跳链式闪电（普攻 60%，无限跳）| 20s |
| 激光塔 | **全功率扫射** | 激光旋转 360° 扫射 2s，期间伤害 ×1.5 | 16s |
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

### 4.4 元素塔 `elemental_tower`（原冰塔）

**定位**：控制 / 元素效果。默认冰形态，高级等级并入火/毒元素能力。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 默认冰属性；命中减速 |
| Lv.2 | TBD | 冰系：概率冰冻；火系：切换火元素 + 灼烧 + 移除减速 |
| Lv.3 | TBD | 毒系：切换毒元素 + 中毒传染；霜冻 Debuff + 真火击杀回能 |

YAML effects 引用：`add_freeze_on_hit` / `set_element_type` / `add_burning_on_hit` / `remove_slow_on_hit` / `add_poison_on_hit` / `add_atk_debuff_on_hit` / `add_energy_on_kill` / `add_poison_contagion`

### 4.5 电塔 `lightning_tower`

**定位**：链式弹跳，群体压制。Lv.3 并入原终极全屏闪电。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 默认 1 次弹跳 |
| Lv.2 | TBD | 弹跳次数 +1（共 2 次）|
| Lv.3 | TBD | 再 +1 弹跳（共 3 次）；概率触发**全屏闪电**（全场随机敌人，普攻 ×1.5，CD 10s）|

YAML effects 引用：`add_chain_bounce` / `add_global_strike`

### 4.6 激光塔 `laser_tower`

**定位**：聚焦 / 持续输出。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 普通激光塔（1 道激光）|
| Lv.2 | TBD | 激光道数 +1；持续锁定单体 |
| Lv.3 | TBD | 再 +1 激光；降低攻击间隔；持续锁同一目标越久伤害越高（上限 ×5.0，目标切换重置）|

YAML effects 引用：`add_beam_count` / `set_target_lock` / `mul_attack_interval` / `add_charge_damage`

### 4.7 蝙蝠塔 `bat_tower`

**定位**：群体单位类塔，受天气影响（`weather_dependent_atk`）。

| 等级 | goldCost | 能力（差量）|
|------|----------|------------|
| Lv.1 | 0 | 默认 3 蝙蝠 |
| Lv.2 | TBD | 蝙蝠数 +1（共 4）；单蝙蝠 ATK ×1.2 |
| Lv.3 | TBD | 再 +1（共 5）；单蝙蝠 ATK 再 ×1.2 |

YAML effects 引用：`add_bat_count` / `mul_atk`

### 4.8 导弹塔 `missile_tower`

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

## 5. 六士兵科技树详设

### 5.1 士兵科技树总览

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

## 6. 九陷阱科技树详设

### 6.1 陷阱科技树总览

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

## 7. 十四法术科技树详设

### 7.1 法术科技树总览

法术卡科技树升级提升效果量（伤害/范围/CD/持续时间四维度），不改变法术的基础机制类型。

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

## 8. 两生产建筑科技树详设

| 建筑 ID | Lv.1 | Lv.2 | Lv.3 |
|---------|------|------|------|
| `gold_mine` | 基础产金 | 产金速率↑ | 产金速率再↑ + 关间奖励↑ |
| `energy_crystal` | +3E/波 | +4E/波 或 +1能量上限 | +5E/波 + 额外上限 |

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
| **深耕核心塔** | 先升 Crystal，再把 1-2 张主力塔推到 Lv.3 | 主力塔最大化 |
| **元素复合流** | 元素塔升 Lv.3 + 补控制/爆发辅助牌 | 极致元素流派 |
| **终极电塔** | 尽快电塔 Lv.3（全屏闪电爆点）| 末期 panic button |

设计目标：玩家不能在单 Run 内无脑把全部核心塔都升满，必须在「扩阵容」和「深升级」之间取舍。
