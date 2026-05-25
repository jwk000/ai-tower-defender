// ============================================================
// buffs.ts — v4.0 关间Buff定义（per design/04-levels.md §8）
//
// 导出 12 个完整 Buff 定义，供 InterLevelBuffSystem 等模块使用。
// ============================================================

import type { BuffOption } from '../systems/InterLevelBuffSystem.js';

// ---- 普通 Buff（6个）----

/** 神射手：箭塔+弩塔攻速+15% */
const sharpshooter: BuffOption = {
  id: 'buff_sharpshooter',
  name: '神射手',
  description: '箭塔+弩塔攻速+15%',
  rarity: 'common',
  effect: { type: 'attack_speed', value: 0.15, target: 'arrow_ballista' },
};

/** 寒冰之心：冰塔减速效果+10% */
const iceHeart: BuffOption = {
  id: 'buff_ice_heart',
  name: '寒冰之心',
  description: '冰塔减速效果+10%',
  rarity: 'common',
  effect: { type: 'slow_effect', value: 0.10, target: 'ice_tower' },
};

/** 烈焰之力：火塔灼烧DOT+3/s */
const flamePower: BuffOption = {
  id: 'buff_flame_power',
  name: '烈焰之力',
  description: '火塔灼烧DOT+3/s',
  rarity: 'common',
  effect: { type: 'dot_damage', value: 3, target: 'fire_tower' },
};

/** 钢铁防线：水晶HP上限+100 */
const ironWall: BuffOption = {
  id: 'buff_iron_wall',
  name: '钢铁防线',
  description: '水晶HP上限+100',
  rarity: 'common',
  effect: { type: 'crystal_hp', value: 100 },
};

/** 快速行军：所有士兵移速+20% */
const quickMarch: BuffOption = {
  id: 'buff_quick_march',
  name: '快速行军',
  description: '所有士兵移速+20%',
  rarity: 'common',
  effect: { type: 'move_speed', value: 0.20, target: 'soldiers' },
};

/** 金币储备：下一关初始金币+50 */
const goldReserve: BuffOption = {
  id: 'buff_gold_reserve',
  name: '金币储备',
  description: '下一关初始金币+50',
  rarity: 'common',
  effect: { type: 'starting_gold', value: 50 },
};

// ---- 稀有 Buff（4个）----

/** 强化箭矢：所有塔射程+10% */
const reinforcedArrow: BuffOption = {
  id: 'buff_reinforced_arrow',
  name: '强化箭矢',
  description: '所有塔射程+10%',
  rarity: 'rare',
  effect: { type: 'range', value: 0.10, target: 'all_towers' },
};

/** 魔法涌流：所有魔法塔ATK+20% */
const magicSurge: BuffOption = {
  id: 'buff_magic_surge',
  name: '魔法涌流',
  description: '所有魔法塔ATK+20%',
  rarity: 'rare',
  effect: { type: 'atk', value: 0.20, target: 'magic_towers' },
};

/** 双倍赏金：所有敌人击杀金币×1.5 */
const doubleBounty: BuffOption = {
  id: 'buff_double_bounty',
  name: '双倍赏金',
  description: '所有敌人击杀金币×1.5',
  rarity: 'rare',
  effect: { type: 'gold_multiplier', value: 0.5 },
};

/** 不破之壁：水晶HP上限+200 */
const unbreakableWall: BuffOption = {
  id: 'buff_unbreakable_wall',
  name: '不破之壁',
  description: '水晶HP上限+200',
  rarity: 'rare',
  effect: { type: 'crystal_hp', value: 200 },
};

// ---- 史诗 Buff（2个）----

/** 奥术智慧：手牌上限+1（本Run内） */
const arcaneWisdom: BuffOption = {
  id: 'buff_arcane_wisdom',
  name: '奥术智慧',
  description: '手牌上限+1（本Run内）',
  rarity: 'epic',
  effect: { type: 'hand_size', value: 1 },
};

/** 战术大师：3选1抽卡改为4选1 */
const tacticalMaster: BuffOption = {
  id: 'buff_tactical_master',
  name: '战术大师',
  description: '3选1抽卡改为4选1',
  rarity: 'epic',
  effect: { type: 'draft_options', value: 1 },
};

// ============================================================
// 导出
// ============================================================

/** 全部 12 个关间 Buff */
export const ALL_BUFFS: BuffOption[] = [
  sharpshooter,
  iceHeart,
  flamePower,
  ironWall,
  quickMarch,
  goldReserve,
  reinforcedArrow,
  magicSurge,
  doubleBounty,
  unbreakableWall,
  arcaneWisdom,
  tacticalMaster,
];
