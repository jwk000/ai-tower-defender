# 数值总览与合理性审查

> 生成时间：2026-06-17
> 数据来源：`src/config/units/*.yaml`、`src/config/levels/*.yaml`
> 计算口径：攻击 DPS = ATK × attackSpeed；塔和士兵等级按 `cost.*Growth` 逐级累加；普通击杀金币范围按 `reward.gold × 0.8 ~ 1.2` 向下取整；关卡资源汇总额外计入每波 1 只随机精英的最低/最高掉落，精英金币按基础金币 ×2 后再应用随机方差。

## 结论摘要

- 当前塔的基础 DPS 覆盖约 3 到 36，单体、AOE、控制、召唤型之间存在明显角色差异；高等级成长主要集中在后两级，形成偏后期的火力爆发。
- 士兵中盾卫明显是承伤单位，输出极低；弓手和法师生存低但射程长，符合远程单位定位，不过需要避免被突进/低空波次瞬间击杀。
- 敌人经济回报差异仍主要集中在高 HP 非 Boss 的 HP/金币比偏高；低 HP 刷钱点已通过下调哥布林、自爆类等基础金币缓解。
- 关卡资源预算应继续以保底金币核算；本表资源汇总已计入每波随机精英的金币收益，但波次敌人数仍只展示 YAML 明确配置的敌人。

## 塔：所有等级攻击/防御/血量

| 单位 | 等级 | HP | ATK | 攻速 | DPS | 防御 | 魔抗 | 射程 | 伤害 | 建造/升级金币 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 箭塔 (arrow_tower) | L1 | 1800 | 10 | 1 | 10 | 0 | 0 | 200 | physical | 70 |
| 箭塔 (arrow_tower) | L2 | 1800 | 15 | 1 | 15 | 0 | 0 | 220 | physical | 40 |
| 箭塔 (arrow_tower) | L3 | 1800 | 33 | 1 | 33 | 0 | 0 | 260 | physical | 360 |
| 炮塔 (cannon_tower) | L1 | 2200 | 25 | 0.35 | 8.8 | 0 | 0 | 180 | physical | 115 |
| 炮塔 (cannon_tower) | L2 | 2200 | 35 | 0.35 | 12.3 | 0 | 0 | 180 | physical | 55 |
| 炮塔 (cannon_tower) | L3 | 2200 | 80 | 0.35 | 28 | 0 | 0 | 220 | physical | 620 |
| 冰塔 (ice_tower) | L1 | 1700 | 5 | 1.2 | 6 | 0 | 0 | 200 | magic | 70 |
| 冰塔 (ice_tower) | L2 | 1700 | 8 | 1.2 | 9.6 | 0 | 0 | 220 | magic | 40 |
| 冰塔 (ice_tower) | L3 | 1700 | 19 | 1.2 | 22.8 | 0 | 0 | 260 | magic | 380 |
| 电塔 (lightning_tower) | L1 | 1800 | 20 | 0.9 | 18 | 0 | 0 | 170 | magic | 110 |
| 电塔 (lightning_tower) | L2 | 1800 | 30 | 0.9 | 27 | 0 | 0 | 185 | magic | 65 |
| 电塔 (lightning_tower) | L3 | 1800 | 65 | 0.9 | 58.5 | 0 | 0 | 210 | magic | 580 |
| 电塔 (lightning_tower) | L4 | 1800 | 95 | 0.9 | 85.5 | 0 | 0 | 230 | magic | 780 |
| 电塔 (lightning_tower) | L5 | 1800 | 135 | 0.9 | 121.5 | 0 | 0 | 250 | magic | 1100 |
| 激光塔 (laser_tower) | L1 | 1500 | 6 | 0.5 | 3 | 0 | 0 | 250 | magic | 125 |
| 激光塔 (laser_tower) | L2 | 1500 | 9 | 0.5 | 4.5 | 0 | 0 | 265 | magic | 75 |
| 激光塔 (laser_tower) | L3 | 1500 | 19 | 0.5 | 9.5 | 0 | 0 | 285 | magic | 520 |
| 激光塔 (laser_tower) | L4 | 1500 | 27 | 0.5 | 13.5 | 0 | 0 | 305 | magic | 760 |
| 激光塔 (laser_tower) | L5 | 1500 | 37 | 0.5 | 18.5 | 0 | 0 | 325 | magic | 1050 |
| 蝙蝠塔 (bat_tower) | L1 | 1600 | 25 | 0.75 | 18.8 | 0 | 0 | 200 | magic | 115 |
| 蝙蝠塔 (bat_tower) | L2 | 1600 | 33 | 0.75 | 24.8 | 0 | 0 | 215 | magic | 65 |
| 蝙蝠塔 (bat_tower) | L3 | 1600 | 71 | 0.75 | 53.3 | 0 | 0 | 250 | magic | 620 |
| 弩塔 (ballista_tower) | L1 | 1900 | 45 | 0.8 | 36 | 0 | 0 | 220 | physical | 135 |
| 弩塔 (ballista_tower) | L2 | 1900 | 63 | 0.8 | 50.4 | 0 | 0 | 240 | physical | 80 |
| 弩塔 (ballista_tower) | L3 | 1900 | 151 | 0.8 | 120.8 | 0 | 0 | 280 | physical | 735 |
| 导弹塔 (missile_tower) | L1 | 2400 | 80 | 0.3 | 24 | 0 | 0 | 9999 | true | 220 |
| 导弹塔 (missile_tower) | L2 | 2400 | 110 | 0.3 | 33 | 0 | 0 | 9999 | true | 130 |
| 导弹塔 (missile_tower) | L3 | 2400 | 220 | 0.3 | 66 | 0 | 0 | 9999 | true | 980 |
| 导弹塔 (missile_tower) | L4 | 2400 | 280 | 0.3 | 84 | 0 | 0 | 9999 | true | 1400 |
| 导弹塔 (missile_tower) | L5 | 2400 | 360 | 0.3 | 108 | 0 | 0 | 9999 | true | 1850 |
| 火塔 (fire_tower) | L1 | 1650 | 12 | 1.2 | 14.4 | 0 | 0 | 150 | magic | 80 |
| 火塔 (fire_tower) | L2 | 1650 | 18 | 1.2 | 21.6 | 0 | 0 | 165 | magic | 50 |
| 火塔 (fire_tower) | L3 | 1650 | 42 | 1.2 | 50.4 | 0 | 0 | 200 | magic | 450 |
| 毒塔 (poison_tower) | L1 | 1650 | 10 | 1 | 10 | 0 | 0 | 150 | magic | 80 |
| 毒塔 (poison_tower) | L2 | 1650 | 15 | 1 | 15 | 0 | 0 | 165 | magic | 50 |
| 毒塔 (poison_tower) | L3 | 1650 | 35 | 1 | 35 | 0 | 0 | 200 | magic | 430 |

## 士兵：所有等级攻击/防御/血量

| 单位 | 等级 | HP | ATK | 攻速 | DPS | 防御 | 魔抗 | 射程 | 伤害 | 建造/升级金币 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 盾卫 (shield_guard) | L1 | 520 | 4 | 0.55 | 2.2 | 70 | 25 | 50 | physical | 35 |
| 盾卫 (shield_guard) | L2 | 560 | 9 | 0.55 | 5 | 70 | 25 | 50 | physical | 40 |
| 盾卫 (shield_guard) | L3 | 620 | 17 | 0.55 | 9.4 | 70 | 25 | 50 | physical | 60 |
| 剑士 (swordsman) | L1 | 150 | 15 | 1 | 15 | 10 | 0 | 55 | physical | 50 |
| 剑士 (swordsman) | L2 | 190 | 20 | 1 | 20 | 10 | 0 | 55 | physical | 40 |
| 剑士 (swordsman) | L3 | 250 | 28 | 1 | 28 | 10 | 0 | 55 | physical | 60 |
| 弓手 (archer) | L1 | 85 | 12 | 0.8 | 9.6 | 5 | 0 | 360 | physical | 35 |
| 弓手 (archer) | L2 | 125 | 17 | 0.8 | 13.6 | 5 | 0 | 360 | physical | 40 |
| 弓手 (archer) | L3 | 185 | 25 | 0.8 | 20 | 5 | 0 | 360 | physical | 60 |
| 牧师 (priest) | L1 | 120 | 6 | 0.7 | 4.2 | 5 | 20 | 150 | physical | 35 |
| 牧师 (priest) | L2 | 160 | 11 | 0.7 | 7.7 | 5 | 20 | 150 | physical | 40 |
| 牧师 (priest) | L3 | 220 | 19 | 0.7 | 13.3 | 5 | 20 | 150 | physical | 60 |
| 刺客 (assassin) | L1 | 60 | 55 | 1.8 | 99 | 0 | 0 | 40 | physical | 45 |
| 刺客 (assassin) | L2 | 100 | 60 | 1.8 | 108 | 0 | 0 | 40 | physical | 40 |
| 刺客 (assassin) | L3 | 160 | 68 | 1.8 | 122.4 | 0 | 0 | 40 | physical | 60 |
| 法师 (mage) | L1 | 90 | 16 | 0.8 | 12.8 | 5 | 20 | 220 | magic | 40 |
| 法师 (mage) | L2 | 130 | 21 | 0.8 | 16.8 | 5 | 20 | 220 | magic | 40 |
| 法师 (mage) | L3 | 190 | 29 | 0.8 | 23.2 | 5 | 20 | 220 | magic | 60 |

## 敌人：攻击/防御/血量与掉落金币

| 单位 | HP | ATK | 攻速 | DPS | 防御 | 魔抗 | 速度 | 射程 | 金币基准 | 掉落范围 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 小兵 (grunt) | 50 | 5 | 0.4 | 2 | 0 | 0 | 80 | 32 | 10 | 8-12 |
| 快兵 (runner) | 30 | 5 | 0 | 0 | 0 | 0 | 150 | 0 | 5 | 4-6 |
| 重装兵 (heavy) | 200 | 15 | 0.35 | 5.3 | 80 | 15 | 35 | 32 | 20 | 16-24 |
| 法师 (mage) | 80 | 25 | 0.3 | 7.5 | 10 | 60 | 55 | 250 | 15 | 12-18 |
| 自爆虫 (exploder) | 40 | 10 | 0 | 0 | 0 | 0 | 90 | 0 | 8 | 6-9 |
| 指挥官 (boss_commander) | 800 | 30 | 0.7 | 21 | 60 | 40 | 40 | 100 | 100 | 80-120 |
| 攻城兽 (boss_beast) | 1000 | 40 | 0.5 | 20 | 80 | 20 | 35 | 80 | 120 | 96-144 |
| 钻地蠕虫 (e_burrow_worm) | 70 | 8 | 0.4 | 3.2 | 0 | 0 | 90 | 32 | 12 | 9-14 |
| 蝗虫群 (e_locust_swarm) | 25 | 3 | 0.5 | 1.5 | 0 | 0 | 110 | 32 | 6 | 4-7 |
| 地走虫 (e_ground_skitter) | 40 | 6 | 0.4 | 2.4 | 0 | 0 | 160 | 32 | 8 | 6-9 |
| 腐蚀炮虫 (e_acid_artillery) | 100 | 22 | 0.3 | 6.6 | 5 | 40 | 50 | 260 | 22 | 17-26 |
| 巨甲虫 (e_giant_beetle) | 320 | 14 | 0.3 | 4.2 | 90 | 20 | 35 | 32 | 28 | 22-33 |
| 母虫 (e_queen_mother) | 700 | 28 | 0.8 | 22.4 | 50 | 30 | 40 | 80 | 110 | 88-132 |
| 寒霜劫掠者 (e_frost_marauder) | 400 | 18 | 0.35 | 6.3 | 80 | 30 | 50 | 32 | 30 | 24-36 |
| 冰霜女巫 (e_ice_witch) | 180 | 24 | 0.3 | 7.2 | 10 | 70 | 55 | 240 | 26 | 20-31 |
| 雪人冲撞兽 (e_yeti_charger) | 280 | 30 | 0.25 | 7.5 | 60 | 15 | 80 | 32 | 32 | 25-38 |
| 暴风雪精灵 (e_blizzard_sprite) | 90 | 12 | 0.4 | 4.8 | 5 | 55 | 70 | 220 | 18 | 14-21 |
| 冰川泰坦 (e_glacier_titan) | 1200 | 35 | 0.25 | 8.8 | 100 | 40 | 25 | 48 | 150 | 120-180 |
| 蛮族战士 (e_kraal_grunt) | 60 | 6 | 0.4 | 2.4 | 5 | 0 | 80 | 32 | 11 | 8-13 |
| 雪人幼崽 (e_yeti_runt) | 70 | 6 | 0.4 | 2.4 | 10 | 0 | 70 | 32 | 12 | 9-14 |
| 寒霜枪手 (e_frost_lancer) | 130 | 18 | 0.35 | 6.3 | 15 | 5 | 75 | 60 | 18 | 14-21 |
| 鲜血诡术师 (e_blood_trickster) | 150 | 12 | 0.35 | 4.2 | 30 | 35 | 70 | 32 | 24 | 19-28 |
| 哥布林 (goblin) | 18 | 8 | 0.4 | 3.2 | 3 | 0 | 45 | 30 | 4 | 3-4 |
| 疯狂野猪 (boar) | 60 | 12 | 0.6 | 7.2 | 0 | 0 | 80 | 30 | 8 | 6-9 |
| 铁甲大象 (elephant) | 300 | 15 | 0.3 | 4.5 | 25 | 5 | 20 | 40 | 20 | 16-24 |
| 草原巨人 (giant) | 400 | 30 | 0.25 | 7.5 | 15 | 10 | 15 | 60 | 30 | 24-36 |
| 沙漠黑虫 (desert_beetle) | 40 | 6 | 0.6 | 3.6 | 2 | 0 | 35 | 20 | 3 | 2-3 |
| 钻地甲虫 (burrow_beetle) | 120 | 15 | 0.4 | 6 | 10 | 0 | 40 | 30 | 12 | 9-14 |
| 吸血蝗虫 (locust) | 30 | 10 | 0.4 | 4 | 0 | 0 | 25 | 30 | 4 | 3-4 |
| 自爆甲虫 (bomb_beetle) | 50 | 80 | 0 | 0 | 0 | 0 | 50 | 60 | 10 | 8-12 |
| 狼人 (werewolf) | 150 | 20 | 0.6 | 12 | 8 | 5 | 55 | 40 | 12 | 9-14 |
| 吸血蝙蝠 (vampire_bat) | 40 | 8 | 0.5 | 4 | 0 | 5 | 60 | 40 | 5 | 4-6 |
| 巫师 (wizard) | 100 | 25 | 0.4 | 10 | 5 | 20 | 30 | 180 | 15 | 12-18 |
| 黑暗牧师 (dark_priest) | 120 | 1 | 0 | 0 | 10 | 15 | 25 | 150 | 18 | 14-21 |
| 弗兰肯斯坦 (frankenstein) | 500 | 35 | 0.3 | 10.5 | 20 | 10 | 20 | 50 | 30 | 24-36 |
| 骷髅 (skeleton) | 60 | 8 | 1 | 8 | 0 | 0 | 50 | 30 | 5 | 4-6 |
| 飞机 (plane) | 80 | 15 | 0.4 | 6 | 5 | 5 | 70 | 60 | 10 | 8-12 |
| 坦克 (tank) | 350 | 40 | 0.25 | 10 | 35 | 5 | 15 | 80 | 25 | 20-30 |
| 油罐车 (oil_truck) | 150 | 5 | 1 | 5 | 10 | 0 | 35 | 30 | 18 | 14-21 |
| 机器狗 (robot_dog) | 50 | 10 | 0.8 | 8 | 5 | 0 | 80 | 25 | 6 | 4-7 |
| 巨型机器人 (giant_robot) | 600 | 50 | 0.2 | 10 | 40 | 10 | 10 | 100 | 40 | 32-48 |
| 无人机 (drone) | 30 | 8 | 0.6 | 4.8 | 0 | 5 | 65 | 50 | 4 | 3-4 |

## 其他单位/陷阱

| 单位 | 类别 | HP | ATK | 攻速 | 攻击DPS | 防御 | 魔抗 | 陷阱DPS | 单次伤害 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 尖刺陷阱 (spike_trap) | Trap | 1 | 0 | 0 | 0 | 0 | 0 | 0 | - |
| 地刺 (spike_trap) | Trap | 99999 | 0 | 0 | 0 | 0 | 0 | 3 | - |
| 捕兽夹 (bear_trap) | Trap | 99999 | 0 | 0 | 0 | 0 | 0 | 0 | 20 |
| 焦油坑 (tar_pit) | Trap | 99999 | 0 | 0 | 0 | 0 | 0 | 0 | - |
| 巨石 (boulder) | Trap | 200 | 0 | 0 | 0 | 20 | 0 | 0 | - |
| 基地 (base) | Objective | 100 | 0 | 0 | 0 | 0 | 0 | 0 | - |
| 出生点 (spawn_point) | Objective | -1 | 0 | 0 | 0 | 0 | 0 | 0 | - |
| 治疗泉水 (healing_spring) | Neutral | -1 | 0 | 0 | 0 | 0 | 0 | 0 | - |
| 金币宝箱 (gold_chest) | Neutral | 30 | 0 | 0 | 0 | 20 | 0 | 0 | - |

## 法术/持续伤害 DPS

| 来源 | 效果 | DPS | 持续 | 半径 |
| --- | --- | --- | --- | --- |
| 腐疫吐液者 (e_blight_spitter) | create_poison_pool | 30 | 3 | 40 |
| 火塔 (fire_tower) | dot | 5 | 3 | - |
| 火塔 (fire_tower) | dot | 8 | - | - |
| 毒塔 (poison_tower) | dot | 4 | 5 | - |
| 毒塔 (poison_tower) | dot | 6 | - | - |
| 地刺 (spike_trap) | SpikeTrap | 3 | - | 32 |

## 波次敌人数量

| 关卡 | 波次 | 敌人 | 数量 | 波次奖励 | Boss波 |
| --- | --- | --- | --- | --- | --- |
| 绿野仙踪 (level_01) | 1 | goblin×8 | 8 | 25 |  |
| 绿野仙踪 (level_01) | 2 | goblin×6, boar×3 | 9 | 40 |  |
| 绿野仙踪 (level_01) | 3 | goblin×5, boar×3, elephant×1 | 9 | 60 |  |
| 绿野仙踪 (level_01) | 4 | boar×4, elephant×2, giant×1 | 7 | 75 |  |
| 绿野仙踪 (level_01) | 5 | giant_slime×1, goblin×3, boar×1 | 5 | 110 | 是 |
| 沙漠虫潮 (level_02) | 1 | desert_beetle×6, burrow_beetle×3 | 9 | 35 |  |
| 沙漠虫潮 (level_02) | 2 | desert_beetle×8, burrow_beetle×3 | 11 | 50 |  |
| 沙漠虫潮 (level_02) | 3 | desert_beetle×8, burrow_beetle×3, locust×5 | 16 | 65 |  |
| 沙漠虫潮 (level_02) | 4 | desert_beetle×8, locust×3, bomb_beetle×2 | 13 | 85 |  |
| 沙漠虫潮 (level_02) | 5 | desert_beetle×10, locust×4, bomb_beetle×3 | 17 | 105 |  |
| 沙漠虫潮 (level_02) | 6 | queen_beetle×1, desert_beetle×7, bomb_beetle×2 | 10 | 150 | 是 |
| 黑暗古堡 (level_03) | 1 | werewolf×3, vampire_bat×2, werewolf×3, vampire_bat×2 | 10 | 45 |  |
| 黑暗古堡 (level_03) | 2 | werewolf×3, wizard×2, werewolf×3, vampire_bat×2 | 10 | 60 |  |
| 黑暗古堡 (level_03) | 3 | werewolf×3, vampire_bat×2, wizard×1, werewolf×3, vampire_bat×2, dark_priest×1 | 12 | 75 |  |
| 黑暗古堡 (level_03) | 4 | werewolf×3, wizard×2, dark_priest×1, werewolf×3, vampire_bat×2, wizard×2 | 13 | 90 |  |
| 黑暗古堡 (level_03) | 5 | werewolf×3, vampire_bat×2, frankenstein×1, werewolf×3, wizard×2, dark_priest×1 | 12 | 110 |  |
| 黑暗古堡 (level_03) | 6 | werewolf×3, wizard×2, dark_priest×1, werewolf×3, vampire_bat×3, frankenstein×1 | 13 | 125 |  |
| 黑暗古堡 (level_03) | 7 | lucifer×1, vampire_bat×3, werewolf×4, wizard×2, dark_priest×1 | 11 | 180 | 是 |
| 末日废土 (level_04) | 1 | robot_dog×2, drone×2, robot_dog×2, drone×2, robot_dog×2, drone×2 | 12 | 55 |  |
| 末日废土 (level_04) | 2 | robot_dog×3, plane×2, robot_dog×3, drone×2, robot_dog×3, drone×2 | 15 | 75 |  |
| 末日废土 (level_04) | 3 | robot_dog×2, drone×2, oil_truck×1, robot_dog×2, plane×2, robot_dog×2, tank×1 | 12 | 95 |  |
| 末日废土 (level_04) | 4 | robot_dog×2, plane×2, oil_truck×1, robot_dog×2, drone×2, tank×1, robot_dog×2, drone×2, oil_truck×1 | 15 | 115 |  |
| 末日废土 (level_04) | 5 | robot_dog×2, drone×2, oil_truck×1, tank×1, robot_dog×2, plane×2, tank×1, robot_dog×2, drone×2, oil_truck×1 | 16 | 135 |  |
| 末日废土 (level_04) | 6 | robot_dog×2, drone×2, tank×1, giant_robot×1, robot_dog×2, plane×2, oil_truck×1, robot_dog×2, drone×2, tank×1 | 16 | 160 |  |
| 末日废土 (level_04) | 7 | robot_dog×3, drone×2, oil_truck×2, robot_dog×3, plane×2, giant_robot×1, robot_dog×3, tank×1, giant_robot×1 | 18 | 190 |  |
| 末日废土 (level_04) | 8 | robot_dog×3, tank×1, super_robot×1, drone×3, plane×2, oil_truck×2 | 12 | 260 | 是 |
| 深渊裂隙 (level_05) | 1 | goblin×3, desert_beetle×2, goblin×3, boar×2, desert_beetle×3, goblin×2, boar×3, desert_beetle×2 | 20 | 70 |  |
| 深渊裂隙 (level_05) | 2 | goblin×3, burrow_beetle×2, boar×3, locust×2, desert_beetle×3, vampire_bat×2, goblin×3, werewolf×2 | 20 | 90 |  |
| 深渊裂隙 (level_05) | 3 | goblin×2, locust×2, wizard×1, boar×2, burrow_beetle×2, dark_priest×1, desert_beetle×2, vampire_bat×2, drone×1, werewolf×2, bomb_beetle×2 | 19 | 110 |  |
| 深渊裂隙 (level_05) | 4 | elephant×2, burrow_beetle×2, robot_dog×3, drone×2, giant×2, locust×2, desert_beetle×3, dark_priest×2 | 18 | 135 |  |
| 深渊裂隙 (level_05) | 5 | giant_slime×1, goblin×3, boar×3, burrow_beetle×2, desert_beetle×3, vampire_bat×2, werewolf×3, wizard×1 | 18 | 170 | 是 |
| 深渊裂隙 (level_05) | 6 | robot_dog×3, bomb_beetle×2, frankenstein×1, goblin×3, dark_priest×1, oil_truck×1, desert_beetle×3, drone×2, giant×2, wizard×2 | 20 | 155 |  |
| 深渊裂隙 (level_05) | 7 | queen_beetle×1, locust×3, goblin×3, burrow_beetle×2, desert_beetle×3, vampire_bat×2, werewolf×3, bomb_beetle×2 | 19 | 210 | 是 |
| 深渊裂隙 (level_05) | 8 | robot_dog×3, tank×1, desert_beetle×3, plane×2, goblin×3, oil_truck×2, giant×2, giant_robot×1 | 17 | 175 |  |
| 深渊裂隙 (level_05) | 9 | lucifer×1, werewolf×2, vampire_bat×2, goblin×4, wizard×2, robot_dog×3, dark_priest×1, desert_beetle×4, frankenstein×1 | 20 | 240 | 是 |
| 深渊裂隙 (level_05) | 10 | goblin×2, werewolf×2, robot_dog×2, tank×1, desert_beetle×2, burrow_beetle×2, oil_truck×1, boar×2, locust×2, drone×2, giant×2, bomb_beetle×2 | 22 | 205 |  |
| 深渊裂隙 (level_05) | 11 | super_robot×1, tank×1, drone×2, robot_dog×3, giant_robot×1, desert_beetle×3, oil_truck×2, werewolf×3, plane×2 | 18 | 280 | 是 |
| 深渊裂隙 (level_05) | 12 | abyss_lord×1, giant×2, frankenstein×1, robot_dog×3, giant_robot×1, desert_beetle×3, tank×1, werewolf×3, wizard×2 | 17 | 380 | 是 |

## 关卡资源汇总

| 关卡 | 波数 | YAML敌人数 | 初始金币 | 保底总金币 | 最高总金币 |
| --- | --- | --- | --- | --- | --- |
| 绿野仙踪 (level_01) | 5 | 38 | 170 | 720 | 830 |
| 沙漠虫潮 (level_02) | 6 | 76 | 230 | 1011 | 1161 |
| 黑暗古堡 (level_03) | 7 | 81 | 290 | 1745 | 2150 |
| 末日废土 (level_04) | 8 | 116 | 350 | 2282 | 2742 |
| 深渊裂隙 (level_05) | 12 | 228 | 430 | 4302 | 5149 |

## 不合理或需确认的数值点

- 冰塔 L1 基础 DPS 仅 6，若没有控制或持续伤害补偿，前期击杀反馈偏弱。
- 激光塔 L1 基础 DPS 仅 3，若没有控制或持续伤害补偿，前期击杀反馈偏弱。
- 盾卫 是高防御前排但 DPS 只有 2.2，定位合理；需要避免关卡强制依赖它输出。
- 弓手 生存值偏低（HP 85, 防御 5），高压波次中需要靠射程或治疗保护。
- 刺客 生存值偏低（HP 60, 防御 0），高压波次中需要靠射程或治疗保护。
- 法师 生存值偏低（HP 90, 防御 5），高压波次中需要靠射程或治疗保护。
- 快兵 配置 ATK 5 但 attackSpeed=0 且 attackMode=single_target，需要确认是否应通过自爆/技能造成伤害。
- 自爆虫 配置 ATK 10 但 attackSpeed=0 且 attackMode=single_target，需要确认是否应通过自爆/技能造成伤害。
- 自爆甲虫 配置 ATK 80 但 attackSpeed=0 且 attackMode=single_target，需要确认是否应通过自爆/技能造成伤害。

## 调整建议

- 优先把“HP/金币比”作为敌人经济手感指标：普通肉盾可高于杂兵，但非 Boss 长时间战斗不宜长期超过 35，否则容易形成拖时无收益。
- 对低 DPS 控制塔和坦克士兵，应在关卡卡池中明确配套输出来源，避免玩家抽到防守组件却缺少击杀能力。
- 对 Boss 波预算需要同时看 YAML 敌人和随机精英；若实测压力偏高，应先调精英倍率或波次奖励，而不是只看 YAML 数量。
- 法术/陷阱的持续伤害项目前分布较少，后续如果扩充 DOT/地面效果，建议统一配置为显式 DPS、持续时间、半径，便于和塔 DPS 横向对比。
