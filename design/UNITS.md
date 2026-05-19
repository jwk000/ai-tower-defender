# Tower Defender — 单位系统

> 本文档覆盖：单位概念体系、阵营/层级、所有单位阵容（塔/兵/敌/建筑/陷阱/中立）、战斗公式骨架、技能与 Buff 系统。
> 具体数值见 [NUMBERS.md](./NUMBERS.md)。科技树升级路径见 [TECH-TREE.md](./TECH-TREE.md)。

---

## 1. 核心理念

**一切皆单位**。塔是我方单位，敌人是敌方单位，士兵是我方可移动单位，中立机关也是单位。本质相同——都有属性、行为规则、视觉表现；差别只在配置。

**一切皆卡牌**。玩家可部署的所有内容（塔/兵/陷阱/建筑/法术）都通过出卡触发。卡代表该局内一次次出现的“出牌机会”；**关外卡池中每张卡唯一，但关内同一张卡可被多次抽到并多次打出**。

**配置驱动**。单位行为由 YAML 声明：`targetSelection` / `attackMode` / `movementMode` + 生命周期 `RuleHandler`（不使用行为树）。

**节奏优先**。本作不是传统无限铺塔塔防：手牌上限 4、每 5 秒手动抽 1 张、水晶能量 2 秒回 1 且上限 10，共同把单局塔部署总量压在约 20 个以内。

---

## 2. 单位分类

| 分类 | 前缀 | 说明 |
|------|------|------|
| `Tower` | 塔 | 固定防御建筑，自动攻击 |
| `Soldier` | 兵 | 玩家操控的可移动单位，占用场面容量 |
| `Enemy` | 敌 | 沿路径进攻的单位 |
| `Building` | 建 | 生产建筑（金矿/能量水晶） |
| `Trap` | 陷 | 玩家从手牌部署的地面机关 |
| `Scene` | 景 | 关卡编辑器预置的互动机关/环境威胁（不可由卡牌部署） |
| `Neutral` | 中 | 关卡随机生成的可争夺资源点（不可由卡牌部署） |
| `Objective` | 标 | 目标点（水晶/出生点） |

> `Scene` 与 `Neutral` 的区别：`Scene` 是关卡设计师预置的主题绑定机关；`Neutral` 是随机生成的可争夺资源点。两者均不可从手牌出卡。

---

## 3. 阵营与空间层级

### 3.1 阵营

| 阵营 | 说明 |
|------|------|
| `Player` | 玩家方，攻击 Enemy |
| `Enemy` | 敌方，攻击 Player |
| `Neutral` | 中立，双方均可攻击 |

阵营判断统一使用 `isHostileTo(a, b)` API，废弃旧 `UnitTag.isEnemy` 双轨模式。

### 3.2 空间层级

| 层级 | 说明 | 典型单位 |
|------|------|----------|
| `Ground` | 地面（默认） | 塔、大多数敌人、士兵 |
| `AboveGrid` | 地表陷阱层 | 地刺 |
| `LowAir` | 低空 | 飞行敌人 |
| `BelowGrid` | 地下/封印层 | 被封印的敌人 |

- 地面单位可攻击 Ground + AboveGrid + LowAir
- 飞行单位免疫地面陷阱（AboveGrid 层）
- BelowGrid 默认不可攻击

---

## 4. 单位属性字段

| 字段类别 | 字段 | 语义 |
|---------|------|------|
| **标识** | `id` | 配置主键（snake_case） |
| | `category` | 见 §2 分类表 |
| **数值** | `hp` | 最大生命值 |
| | `atk` | 基础攻击力 |
| | `attackSpeed` | 每秒攻击次数 |
| | `range` | 攻击射程（像素） |
| | `armor` / `magicResist` | 物理护甲 / 魔法抗性 |
| | `moveSpeed` | 移动速度（像素/秒，仅可移动单位） |
| | `damageType` | `physical` / `magic` / `true` |
| | `population` | 占用场面容量（仅 Soldier） |
| | `cost` | 建造造价（金币） |
| | `killReward` | 击杀奖励（仅敌人） |
| **行为** | `attackMode` | 见 §4.1 攻击模式枚举 |
| | `targetSelection` | `nearest` / `farthest` / `weakest` / `strongest` / `type_priority` / `threat_score` |
| | `movementMode` | `follow_path` / `hold_position` / `chase_target` / `patrol` |
| | `specialEffects[]` | 见 §4.2 特殊机制枚举 |

### 4.1 攻击模式枚举

| 枚举值 | 含义 |
|--------|------|
| `single_target` | 单体攻击，弹道命中主目标 |
| `aoe_splash` | 命中时对半径内造成溅射伤害 |
| `chain` | 弹跳攻击 N 个目标，每次衰减 |
| `piercing` | 贯穿路径上所有敌人 |
| `dot_aoe` | 持续对范围内敌人造成伤害 |
| `heal` | 对范围内友方恢复 HP |
| `global_aoe` | 大范围 AOE（导弹塔类） |
| `can_attack_buildings` | 修饰符，可与其它模式并存 |

### 4.2 特殊机制枚举

| 机制 | 行为 |
|------|------|
| `stun_on_hit` | 命中后眩晕（Boss 免疫） |
| `slow_on_hit` | 命中后减速（可叠层至 `maxStacks`） |
| `freeze_at_max_stacks` | 满层冰冻 |
| `burn_on_hit` | 命中后燃烧 DOT |
| `poison_on_hit` | 命中附毒 DOT |
| `lifesteal_on_hit` | 攻击吸血 |
| `weather_dependent_atk` | 攻击力随天气变动 |
| `death_explosion` | 死亡爆炸 AOE（含阵营过滤 `aoe_faction_filter`） |
| `boss_phase_transition` | 血量阈值阶段切换 |
| `boss_immune_stun` | 免疫眩晕 |
| `summon_minions` | 死亡/CD 周期召唤小兵 |
| `invulnerable` | 无敌/不可摧毁（仅特殊场景） |
| `oneshot` | 触发一次即消耗（陷阱） |
| `charges` | 可触发次数（陷阱，默认 1） |
| `area_persistent` | 存在期间持续作用的区域陷阱 |
| `path_block` | 占据 blocked tile，触发寻路重算 |
| `decoy` | 欺骗 AI 的诱饵单位 |
| `flammable_marker` | 可被火属性引燃 |
| `roll_along_path_on_death` | 死亡时沿路径滚动并伤害 |
| `friendly_damage` | 法术对己方造成伤害（自损） |
| `delayed_effect` | 法术延迟触发（读条） |
| `global_modifier` | 改变战场全局规则 |
| `return_to_hand` | 单位返回手牌 |

---

## 5. 生命周期事件

| 事件 | 触发时刻 | 典型 RuleHandler |
|------|----------|----------------|
| `onCreate` | 单位被创建 | 播放出生特效、施加初始 Buff |
| `onDeath` | HP 归零 | 爆炸伤害、掉落金币、生成子单位 |
| `onHit` | 受到伤害（每次） | 闪白反馈、触发反击 |
| `onAttack` | 发起攻击 | 生成弹道、播放音效 |
| `onKill` | 击杀另一单位 | 回血、获得 Buff |
| `onUpgrade` | 等级提升 | 解锁技能、改变视觉 |
| `onDestroy` | 非死亡移除（回收） | 返还资源 |
| `onEnter` | 踏入区域 | 触发陷阱、获得区域 Buff |
| `onLeave` | 离开区域 | 移除区域 Buff |

---

## 6. 塔阵容（7 种）

| # | 塔 ID | 战术角色 | 攻击模式 | 关键机制 | 稀有度 |
|---|-------|---------|---------|---------|-------|
| 1 | `arrow_tower` | 稳定单体输出 | `single_target` | — | Common |
| 2 | `cannon_tower` | 群体控制 | `aoe_splash` | `stun_on_hit` | Common |
| 3 | `elemental_tower` | 元素效果（默认冰） | `single_target` | `slow_on_hit`（冰）/`burn_on_hit`（火）/`poison_on_hit`（毒） | Rare |
| 4 | `lightning_tower` | 群怪清剿 | `chain` | — | Rare |
| 5 | `laser_tower` | 远程持续输出 | `piercing`（激光） | — | Epic |
| 6 | `bat_tower` | 暗夜杀手 | 群体单位 | `weather_dependent_atk`（天气增幅） | Epic |
| 7 | `missile_tower` | 战略打击 | `global_aoe` | 地格评分系统（见下方导弹塔说明） | Legendary |

**元素塔路径切换**：路径选择在科技树（见 TECH-TREE.md）；切换时同步 `elementType` 字段（`ice` / `fire` / `poison`），规则引擎据此决定命中附加的 DOT/Debuff。

**蝙蝠塔天气依赖**：所有天气下正常攻击，仅 ATK 倍率不同（具体倍率见 NUMBERS.md）。不再有"休眠"状态。

**导弹塔**：地格评分驱动的全场 AOE 战略打击。支持手动指挥（点击地图目标格）和托管（自动按评分选格）两种模式。射程 600px，全图覆盖。评分维度：敌人密度 + 平均剩余 HP + Boss 存在加分 + 己方单位回避惩罚。到达目标格后引爆，爆炸半径 100px，对地面+空中敌人造成真实伤害。

**废弃塔**：`poison_vine_tower`（毒藤塔）、`ballista_tower`（弩炮塔）已废弃，功能由元素塔毒系路径、炮塔狙击穿透路径承接。

---

## 7. 士兵阵容（6 种核心）

| # | 兵 ID | 战术角色 | 攻击模式 | 主动技能 | 稀有度 | 备注 |
|---|-------|---------|---------|---------|-------|------|
| 1 | `shield_guard` | 肉盾 / 阻挡 | `single_target` | **嘲讽**（强制周围敌人攻击自己，3s） | Common | 可承担前排拦截 |
| 2 | `swordsman` | 前排输出 | `single_target` | **旋风斩**（80px AOE 30 伤害） | Common | 主近战清兵 |
| 3 | `archer` | 远程 DPS | `single_target` | **狙击**（400px 单体 ATK×3） | Common | 持续远程输出 |
| 4 | `priest` | 治疗支援 | `heal` | **治疗链**（150px 范围持续回血） | Rare | **可为 0 攻单位** |
| 5 | `engineer` | 修理建造 / 功能支援 | `single_target` | **紧急修复**（修复周围建筑 50% HP） | Rare | 可偏功能化 |
| 6 | `assassin` | 近战爆发 | `single_target` | **暗杀**（瞬移到最弱敌人旁高伤） | Epic | 点杀后排 |

所有士兵：`category: Soldier`，可移动。**存在少量无攻击力或弱攻击力单位**，其价值主要来自治疗、修理、阻挡、诱导、走位等功能，而非纯输出。

---

## 8. 敌方单位阵容（20 种官方）

> v3.6 核心敌我关系：**大多数敌方单位不会主动攻击塔，主目标是沿路推进、突破防线、清理阻挡单位；只有少量特种敌人或特定机制具备打塔能力。**

| # | ID | 引入关 | 类型 | 关键机制 | 威胁优先级 |
|---|----|-------|------|---------|-----------|
| 1 | `grunt` | L1 | 普通 | 沿路径攻基地 | 低 |
| 2 | `goblin_archer` | L1 | 普通（远程） | 远程攻击 100px | 中 |
| 3 | `runner` | L1 | 普通 | 不攻击建筑，直冲基地 | 高速 |
| 4 | `wolf` | L2 | 普通 | 高速 + 群体出现 | 低 |
| 5 | `wolf_rider` | L2 | 精英 | 高速冲刺 + `can_attack_buildings` | 高 |
| 6 | `heavy` | L2 | 精英 | `can_attack_buildings`（近战） | 中 |
| 7 | `mage` | L3 | 精英 | `can_attack_buildings`（远程） | 中 |
| 8 | `poison_snake` | L3 | 普通 | 攻击带毒 5s DOT | 中 |
| 9 | `healer_priest` | L3 | 精英 | **治疗周围敌人** 100 HP/s | **最高**（优先击杀） |
| 10 | `bat_swarm` | L4 | LowAir | 飞行 + 群体 | 中（仅反空塔） |
| 11 | `wisp` | L4 | LowAir | 飞行 + 出生 3s 隐形 | 中 |
| 12 | `exploder` | L4 | 精英 | `death_explosion` + `aoe_faction_filter: [Player]` | 自杀冲锋 |
| 13 | `scattered_tentacle` | L5 | 普通 | 周期散开/聚拢 + 抗 AoE | 中 |
| 14 | `summoner_skeleton` | L6 | 精英 | 死亡召唤 3 小骷髅 | 高 |
| 15 | `shielded_warrior` | L6 | 精英 | 护盾未破时免疫伤害 | 高（必须破盾） |
| 16 | `elite_exploder` | L7 | 精英 | 强化自爆（半径 150 / 100 伤害） | 高 |
| 17 | `invisible_assassin` | L8 | 精英 | 出生 3s 内隐形 | 高 |
| 18 | `reflective_golem` | L8 | 精英 | 反弹 30% 受到伤害（反弹不循环触发） | 中 |
| 19 | `boss_commander` | 关底 | BOSS | `summon_minions` + 阶段切换 + `boss_immune_stun` | Boss |
| 20 | `abyss_lord` | L9 终战 | BOSS | 3 阶段：普通召唤 → 精英召唤 → 范围 DOT 大招 | Boss |

### 8.1 关底 Boss 配对

| 关卡 | 关底 Boss | 备注 |
|------|----------|------|
| L1 | `boss_orc_chieftain` | 兽人首领（boss_commander 草原变体） |
| L2 | `boss_wolf_king` | 狼王 |
| L3 | `boss_snake_queen` | 毒蛇女王 |
| L4 | `boss_yeti` | 雪原巨人 |
| L5 | `boss_sand_worm` | 沙虫 |
| L6 | `boss_skeleton_lord` | 骷髅领主 |
| L7 | `boss_fire_elemental` | 火元素 |
| L8 | `boss_dark_knight` | 黑暗骑士 |
| L8 异界裂隙 | `old_one` | 旧日支配者 |

各关底 Boss 复用 `boss_commander` / `abyss_lord` 行为模板，仅修改数值 + 视觉。

### 8.2 关键敌方机制说明

**隐形敌**：隐形状态下不被物理塔锁定（箭塔/炮塔/导弹塔），但溅射/AOE 仍可波及。可解锁来源：电塔链击（非首目标）、激光塔高级科技树节点、弓手狙击技能、蝙蝠塔（声波探测）。

**飞行敌（LowAir）**：免疫地面陷阱（AboveGrid 层），所有塔均可攻击。

**自爆敌 AOE 阵营过滤**：`exploder` 死亡爆炸**仅伤害 Player 阵营**（塔/兵/基地），不伤害敌方友军。

**召唤型敌**：`summoner_skeleton` 死亡时召唤 3 只小骷髅，已生成的幼虫在母体死亡后继续存活。

**Boss 阶段切换**：通过 `onCondition: hp_ratio < 0.5` 触发，`fireOnce: true` 确保只触发一次，切换瞬间配合 `pause_world: 0.3s` 全局停帧强调感。

---

## 9. 生产建筑（2 种）

| 建筑 ID | 产出 | 最高等级 | 稀有度 |
|---------|------|---------|-------|
| `gold_mine` | 持续产金（金币/秒） | L3 | Common |
| `energy_crystal` | 关内资源节奏辅助 | L3 | Rare |

---

## 10. 陷阱阵容（9 种）

### 10.1 触发式陷阱（4 种）

| 陷阱 ID | 稀有度 | 关键机制 |
|---------|-------|---------|
| `spike_trap` | Common | 5 次触发后损坏；单体 30 物理伤害 |
| `landmine` | Common | 一次性 150 AOE r80 |
| `tar_pit` | Rare | -60% 移速 + 易燃；被火引燃后伤害 ×4 |
| `bear_trap` | Rare | 一次性定身 2s（精英也定，Boss 免疫）+ 承伤 +30% |

### 10.2 区域式陷阱（3 种）

| 陷阱 ID | 稀有度 | 关键机制 |
|---------|-------|---------|
| `fire_wall` | Rare | 8s 火墙 20 DPS；飞行敌免疫；可被油坑引爆 |
| `frost_mist` | Epic | 整波次持续 -40% 移速 + -25% 攻速 |
| `gravity_well` | Epic | 5s 持续拉拽（含飞行敌） |

### 10.3 占路式陷阱（2 种）

| 陷阱 ID | 稀有度 | 关键机制 |
|---------|-------|---------|
| `boulder` | Common | 800 HP；敌人优先攻击；死亡后沿路径滚动 1 格造 150 伤害 |
| `decoy_dummy` | Rare | 200 HP，伪装成箭塔骗刺客类敌人 |

---

## 11. 中立资源点（4 种）

关卡随机生成，不可从手牌部署：

| 单位 ID | HP | 关键机制 |
|---------|-----|---------|
| `gold_chest` | 30 | 击破后奖励 50-100 金币；敌人击破获得"贪婪" buff (+15% 移速) |
| `healing_spring` | 200（**可摧毁**） | r120 内每秒 +5 HP，双方受益；摧毁后光环消失 |
| `mana_crystal` | 150 | 玩家击破返还 5E；敌人击破让该波敌方能量法术 ×2 |
| `ancient_altar` | 300 | 每 20s 为随机敌方或我方单位附加 1 个临时战场 Buff（本波） |

---

## 12. 场景中立单位（7 种，关卡预置）

关卡编辑器预置，不可从手牌部署：

### 12.1 场景互动机关（4 种）

| 单位 ID | 主题限定 | 触发 | 效果 |
|---------|---------|------|------|
| `explosive_barrel` | 高压工业/终战主题 | 点击/敌人触碰/链锁 | r100 AOE 200 物理；可连锁 |
| `boulder_perch` | 极地暴雪要塞/异界裂隙 | 点击或塔射击 | 沿路径滚落 3 格，单体 150 |
| `falling_icicle` | 雪山 | 攻击或重力周期 | 单格 80 + 冰冻 1.5s |
| `geyser` | 沼泽 | 每 15s 自动喷发 | r80 击退 + 2s 击飞（无伤害） |

### 12.2 环境威胁（3 种）

| 单位 ID | 主题限定 | HP | 机制 |
|---------|---------|-----|------|
| `tombstone` | 废墟/终战 | 200 | 第 3 波起每波概率裂开复活敌人；玩家可主动粉碎 |
| `vine_overgrowth` | 沼泽/林地 | 80 | 缠绕邻塔每 5s -5% HP；可击破清除 |
| `cursed_shrine` | 深渊 | 300 | r150 内所有塔 -30% 攻速；可击破消除 |

---

## 13. 卡牌目录

### 13.1 单位/建筑/陷阱卡

| 卡 ID | 类型 | 稀有度 | 引用 UnitConfig |
|-------|------|--------|----------------|
| `arrow_tower_card` | 建筑卡 | Common | `arrow_tower` |
| `cannon_tower_card` | 建筑卡 | Common | `cannon_tower` |
| `elemental_tower_card` | 建筑卡 | Rare | `elemental_tower` |
| `lightning_tower_card` | 建筑卡 | Rare | `lightning_tower` |
| `laser_tower_card` | 建筑卡 | Epic | `laser_tower` |
| `bat_tower_card` | 建筑卡 | Epic | `bat_tower` |
| `missile_tower_card` | 建筑卡 | Legendary | `missile_tower` |
| `gold_mine_card` | 建筑卡 | Common | `gold_mine` |
| `energy_crystal_card` | 建筑卡 | Rare | `energy_crystal` |
| `spike_trap_card` | 陷阱卡 | Common | `spike_trap` |
| `shield_guard_card` | 单位卡 | Common | `shield_guard` |
| `swordsman_card` | 单位卡 | Common | `swordsman` |
| `archer_card` | 单位卡 | Common | `archer` |
| `priest_card` | 单位卡 | Rare | `priest` |
| `engineer_card` | 单位卡 | Rare | `engineer` |
| `assassin_card` | 单位卡 | Epic | `assassin` |

### 13.2 法术卡（14 张）

#### 即时打击型（4 张）
| 卡 ID | 稀有度 | 能量 | 效果 |
|-------|--------|------|------|
| `fireball_spell` | Common | 3 | 目标区域 r80 范围 80 火焰伤害 |
| `meteor_spell` | Epic | 6 | 单格 300 火焰 + r80 30% 溅射 |
| `chain_lightning_spell` | Rare | 4 | 单体 100 雷电，弹射 3 次（每次 -25%） |
| `purification_spell` | Rare | 3 | 移除我方一个单位所有 Debuff + 回 30 HP |

#### 区域控制型（4 张）
| 卡 ID | 稀有度 | 能量 | 效果 |
|-------|--------|------|------|
| `freeze_all_spell` | Epic | 5 | 全屏敌人冰冻 2s |
| `slow_spell` | Common | 2 | 目标区域敌人 -50% 移速，3s |
| `arrow_rain_spell` | Rare | 4 | 目标区域 5s 内每秒 30 物理 |
| `tornado_spell` | Epic | 5 | 龙卷沿路径移动 5s，每秒推 40px + 击退 + 20 物理 |

#### 增益持续型（3 张）
| 卡 ID | 稀有度 | 能量 | 效果 | 跨波保留 |
|-------|--------|------|------|---------|
| `heal_pulse_spell` | Rare | 3 | 我方全场 HP +100 | ❌ |
| `divine_protection_spell` | Legendary | 7 | 水晶本波额外承受 N 次秒杀不扣 HP | ✅ |
| `rally_horn_spell` | Rare | 3 | 我方全体 +25% 攻速 + 10% 移速，15s | ❌ |

#### 战略召唤/全局型（3 张）
| 卡 ID | 稀有度 | 能量 | 效果 |
|-------|--------|------|------|
| `summon_skeletons_spell` | Legendary | 6 | 召唤 5 个骷髅（30 HP / 8 ATK） |
| `time_dilation_spell` | Legendary | 8 | 全场敌人 50% 时间流速 8s（己方正常） |
| `tactical_retreat_spell` | Common | 1 | 选中我方单位返回手牌，退回 60% 能量 |

### 13.3 完整卡池规模

| 稀有度 | 卡数 |
|--------|------|
| Common | 16 |
| Rare | 13 |
| Epic | 9 |
| Legendary | 5 |
| **总计** | **43** |

获卡/购卡后进入卡池（关外每种 1 张上限），获卡=自动解锁对应卡牌成长线。

---

## 14. 战斗公式骨架

### 14.1 伤害公式

```
物理伤害 = ATK × (1 - 护甲 / (护甲 + K_armor))
魔法伤害 = ATK × (1 - 魔抗 / (魔抗 + K_magicResist))
真实伤害 = ATK  （无视护甲与魔抗）

最终伤害 = 基础伤害 × (1 + 伤害加成%) × (1 - 伤害减免%) × 暴击倍率
```

- `K_armor` / `K_magicResist`：减伤常数（当前 = 100，见 NUMBERS.md）
- 减伤永远 < 100%，不会出现零伤
- 伤害下限保护：最终伤害不低于 1

### 14.2 攻速公式

```
实际攻击间隔 = 基础攻击间隔 / (1 + 攻速加成%)
```

攻速加成上限 200%（即最高 3 倍攻速），防止帧爆炸。

### 14.3 移速公式

```
实际移速 = 基础移速 × (1 + 移速加成%) × (1 - 总减速%)
最低移速 = 基础移速 × MOVE_SPEED_FLOOR（当前 20%）
```

**减速叠加规则**：
1. **同类来源**（如多个冰塔减速）：取 max，不相加
2. **不同来源**（如冰塔 + 雪天 + 嘲讽）：相加
3. **跨类总减速上限**：`SLOW_TOTAL_CAP`（当前 80%）
4. `freeze` / `stun` 走独立通道，直接令移速为 0

```ts
const sameClassMax = groupBy(slows, "class").map(g => max(g.values));
const totalSlow = min(sum(sameClassMax), SLOW_TOTAL_CAP);
const actualSpeed = baseSpeed * (1 + boost) * (1 - totalSlow);
return max(actualSpeed, baseSpeed * MOVE_SPEED_FLOOR);
```

### 14.4 控制机制

**眩晕（Stun）**：移速 = 0 + 攻击禁用 + 技能禁用；金色闪烁；Boss 免疫；递减返还（同目标 3s 内多次眩晕，第 N 次有效时长 = 基础 × max(0.2, 1 - 0.3×(N-1))）

**冰冻（Freeze）**：`slow_on_hit` 满层后触发；与眩晕等价（移速 0 + 攻击禁用）；走独立通道；Boss 免疫

**嘲讽（Taunt）**：盾卫主动技能；范围内敌人强制切换目标为发起者 + 降低部分移速；Boss 不可被嘲讽

### 14.5 弹道规范

- 攻击通过弹道实体表达，**非即时伤害**
- 弹道颜色与单位主色一致
- 弹道未命中处理：

| 攻击模式 | 命中规则 |
|---------|---------|
| `single_target` | 目标已死 → 选最近敌人替代，否则销毁 |
| `aoe_splash` | 落点固定，命中范围内所有敌人 |
| `chain` | 每跳重新选最近未被链击过的敌人 |
| `piercing` | 沿固定方向至最大射程，命中线上敌人 |
| `global_aoe` | 飞向预计算地格中心，到达后引爆 |

### 14.6 血条规范

- 高度 3px，位于单位中心上方 -14px
- 颜色：`>60%` → 绿 `#4CAF50`；`30-60%` → 黄 `#FFC107`；`<30%` → 红 `#F44336`
- 受击闪白：100ms 白色叠加
- Boss 血条：独立顶部全屏宽 UI

---

## 15. 技能与 Buff 系统

### 15.1 技能类型

| 类型 | 触发方式 |
|------|----------|
| 主动技能 | 玩家点击释放 + CD + 能量消耗 |
| 被动技能 | 始终自动生效（由卡牌等级提供） |
| 光环技能 | 持续作用于范围内单位 |
| 条件技能 | 满足条件自动触发（如 Boss 血量 <50% 切换阶段） |

### 15.2 Buff 规则

- **同名 Buff**：刷新持续时间，层数叠加（不超过 `maxStacks`）
- **永久 Buff**：`duration = -1`，不被计时清除
- **来源追踪**：记录 `sourceId`，来源死亡时相关 Buff 处理
- **全局上限**：单个实体同时最多 8 种不同 Buff（超出按 LRU 淘汰最旧，玩家技能 Buff 优先保留）
- **头顶图标**：最多显示 3 个（控制 > 减益 > 增益）

### 15.3 Buff 优先级（多类冲突）

| 优先级 | 类别 | 处理 |
|--------|------|------|
| 1（最高） | 控制类（眩晕/冰冻/定身） | 直接生效，覆盖一切 |
| 2 | 减益类（减速/减甲） | 按叠加规则处理 |
| 3 | 增益类（增速/加甲） | 按叠加规则处理 |

### 15.4 士兵主动技能参数

| 技能 | 所属 | CD | 能量 | 范围 | 效果 |
|------|------|-----|------|------|------|
| 嘲讽 | 盾卫 | 8s | 20 | 120px | 强制周围敌人攻击自己，持续 3s |
| 旋风斩 | 剑士 | 6s | 15 | 80px | AOE 30 物理伤害 |
| 狙击 | 弓手 | 10s | 25 | 400px | 单体 ATK×3 |
| 治疗链 | 祭司 | 5s | 10 | 150px | 范围持续回血 |
| 紧急修复 | 工程师 | 12s | 20 | 100px | 修复周围建筑 50% HP |
| 暗杀 | 刺客 | 8s | 30 | 300px | 瞬移到最弱敌人旁高伤 |

---

## 16. 敌方 AI 优先级

敌人沿路径行进时，评估范围内有高优先级目标则停下攻击，脱离范围后恢复 `follow_path`：

```typescript
interface EnemyTargetPriority {
  filter: {
    category?: 'Tower' | 'Soldier' | 'Building' | 'Trap' | 'Objective';
    tags?: string[];
    threat?: 'high' | 'medium' | 'low';
  };
  weight: number;  // 0-100，越高越优先
}
```

- 评估范围：`engagementRange`（默认 80px），脱离范围：`disengagementRange`（默认 120px）
- 多目标同时匹配 → 按 weight 加权随机选择（防止扎堆）
- `healer_priest` 等高威胁目标会在 `enemyTargetPriority` 中标记最高权重
