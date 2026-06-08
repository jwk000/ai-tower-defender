// ============================================================
// cards.ts — v4.0 卡牌定义（per design/03-units.md §7）
//
// 导出 31 张完整卡牌的定义数组，供 HandSystem 等模块使用。
// ============================================================

import type { CardInstance } from '../systems/HandSystem.js';

// ---- 塔（10种）----

const arrowTower: CardInstance = {
  id: 'card_arrow_tower',
  name: '箭塔',
  type: 'unit',
  description: '基础单体物理输出，攻速快',
  goldCost: 40,
};

const ballistaTower: CardInstance = {
  id: 'card_ballista_tower',
  name: '弩塔',
  type: 'unit',
  description: '穿透型物理输出，箭矢直线贯穿敌人',
  goldCost: 100,
};

const cannonTower: CardInstance = {
  id: 'card_cannon_tower',
  name: '炮塔',
  type: 'unit',
  description: 'AOE物理范围伤害，溅射攻击',
  goldCost: 80,
};

const laserTower: CardInstance = {
  id: 'card_laser_tower',
  name: '激光塔',
  type: 'unit',
  description: '单体魔法持续伤害，锁敌后伤害递增',
  goldCost: 85,
};

const batTower: CardInstance = {
  id: 'card_bat_tower',
  name: '蝙蝠塔',
  type: 'unit',
  description: '召唤型，释放蝙蝠自动攻击周围敌人',
  goldCost: 80,
};

const missileTower: CardInstance = {
  id: 'card_missile_tower',
  name: '导弹塔',
  type: 'unit',
  description: '全图射程大范围伤害，战略武器',
  goldCost: 150,
};

const iceTower: CardInstance = {
  id: 'card_ice_tower',
  name: '冰塔',
  type: 'unit',
  description: '魔法控制型塔，减速并概率冰冻敌人',
  goldCost: 40,
};

const fireTower: CardInstance = {
  id: 'card_fire_tower',
  name: '火塔',
  type: 'unit',
  description: '魔法DOT型塔，灼烧造成持续伤害',
  goldCost: 55,
};

const poisonTower: CardInstance = {
  id: 'card_poison_tower',
  name: '毒塔',
  type: 'unit',
  description: '魔法DOT传染型塔，中毒可在敌人间传播',
  goldCost: 55,
};

const lightningTower: CardInstance = {
  id: 'card_lightning_tower',
  name: '电塔',
  type: 'unit',
  description: '魔法连锁攻击，闪电在敌人间弹跳',
  goldCost: 75,
};

// ---- 士兵（4种）----

const shieldGuard: CardInstance = {
  id: 'card_shield_guard',
  name: '盾卫',
  type: 'unit',
  description: '近战坦克，嘲讽范围内敌人优先攻击',
  goldCost: 50,
};

const archer: CardInstance = {
  id: 'card_archer',
  name: '弓手',
  type: 'unit',
  description: '远程物理输出，优先攻击低血量敌人',
  goldCost: 55,
};

const mage: CardInstance = {
  id: 'card_mage',
  name: '法师',
  type: 'unit',
  description: '远程魔法AOE，火球术溅射伤害',
  goldCost: 65,
};

const priest: CardInstance = {
  id: 'card_priest',
  name: '牧师',
  type: 'unit',
  description: '治疗单位，持续恢复友方HP',
  goldCost: 55,
};

const assassin: CardInstance = {
  id: 'card_assassin',
  name: '刺客',
  type: 'unit',
  description: '高爆发刺杀位，瞬移到最弱敌人旁造成高伤害',
  goldCost: 70,
};

// ---- 机关（4种）----

const spikeTrap: CardInstance = {
  id: 'card_spike_trap',
  name: '地刺',
  type: 'trap',
  description: '路径陷阱，对经过敌人造成持续伤害',
  goldCost: 30,
};

const bearTrap: CardInstance = {
  id: 'card_bear_trap',
  name: '捕兽夹',
  type: 'trap',
  description: '一次性陷阱，触发后困住敌人1秒',
  goldCost: 50,
};

const tarPit: CardInstance = {
  id: 'card_tar_pit',
  name: '焦油坑',
  type: 'trap',
  description: '路径减速，经过的地面敌人减速20%',
  goldCost: 30,
};

const boulder: CardInstance = {
  id: 'card_boulder',
  name: '巨石',
  type: 'trap',
  description: '路障，阻挡敌人前进必须被破坏',
  goldCost: 60,
};



// ---- 技能卡（4种）----

const fireball: CardInstance = {
  id: 'card_fireball',
  name: '火球术',
  type: 'spell',
  description: '2×2格范围40点魔法伤害',
  goldCost: 40,
};

const arrowRain: CardInstance = {
  id: 'card_arrow_rain',
  name: '剑雨',
  type: 'spell',
  description: '3×3格范围25点物理伤害',
  goldCost: 45,
};

const blizzard: CardInstance = {
  id: 'card_blizzard',
  name: '暴风雪',
  type: 'spell',
  description: '3×3格范围减速，持续5秒',
  goldCost: 55,
};

const bomb: CardInstance = {
  id: 'card_bomb',
  name: '炸弹',
  type: 'spell',
  description: '2×2格范围80点伤害，放置后2秒爆炸',
  goldCost: 60,
};

// ---- 奥术卡（5种）----

const emergencyShield: CardInstance = {
  id: 'card_emergency_shield',
  name: '紧急防护',
  type: 'arcane',
  description: '水晶10秒内无敌',
  goldCost: 50,
};

const arrowBoost: CardInstance = {
  id: 'card_arrow_boost',
  name: '箭术精通',
  type: 'arcane',
  description: '本关箭塔和弩塔ATK+20%',
  goldCost: 60,
};

const shieldBoost: CardInstance = {
  id: 'card_shield_boost',
  name: '坚韧守护',
  type: 'arcane',
  description: '本关所有盾卫HP+30%',
  goldCost: 55,
};

const goldRush: CardInstance = {
  id: 'card_gold_rush',
  name: '淘金热',
  type: 'arcane',
  description: '立即获得80金币',
  goldCost: 20,
};

const speedBoost: CardInstance = {
  id: 'card_speed_boost',
  name: '疾风步',
  type: 'arcane',
  description: '本关所有士兵移速+25%',
  goldCost: 50,
};

// ============================================================
// 已分类导出
// ============================================================

/** 所有 18 张单位卡（塔 + 士兵 + 机关） */
export const UNIT_CARDS: CardInstance[] = [
  arrowTower,
  ballistaTower,
  cannonTower,
  laserTower,
  batTower,
  missileTower,
  iceTower,
  fireTower,
  poisonTower,
  lightningTower,
  shieldGuard,
  archer,
  mage,
  priest,
  assassin,
  spikeTrap,
  bearTrap,
  tarPit,
  boulder,
];

/** 所有 4 张技能卡 */
export const SPELL_CARDS: CardInstance[] = [fireball, arrowRain, blizzard, bomb];

/** 所有 5 张奥术卡 */
export const ARCANE_CARDS: CardInstance[] = [
  emergencyShield,
  arrowBoost,
  shieldBoost,
  goldRush,
  speedBoost,
];

/** 全部 27 张卡牌 */
export const ALL_CARDS: CardInstance[] = [
  ...UNIT_CARDS,
  ...SPELL_CARDS,
  ... ARCANE_CARDS,
];

// ============================================================
// 关卡卡池（per design/03-units.md §7.1-7.3 主题归属）
// ============================================================

/** 第1关卡池：绿野仙踪（箭塔系列 + 冰塔 + 初始单位） */
export const LEVEL_1_CARD_POOL: CardInstance[] = [
  arrowTower,
  iceTower,
  shieldGuard,
  archer,
  spikeTrap,
  bearTrap,
  fireball,
];

/** 第2关卡池：沙漠虫潮（炮塔 + 火/毒 + 远程 + 减速） */
export const LEVEL_2_CARD_POOL: CardInstance[] = [
  cannonTower,
  fireTower,
  poisonTower,
  archer,
  mage,
  tarPit,
  fireball,
];

/** 第3关卡池：黑暗古堡（激光 + 蝙蝠 + 盾 + 牧师 + 刺客 + 控制） */
export const LEVEL_3_CARD_POOL: CardInstance[] = [
  arrowTower,
  laserTower,
  batTower,
  shieldGuard,
  mage,
  priest,
  assassin,
  bearTrap,
];

/** 第4关卡池：末日废土（导弹 + 闪电 + 炮塔 + 冰塔 + 远程 + 刺客） */
export const LEVEL_4_CARD_POOL: CardInstance[] = [
  missileTower,
  lightningTower,
  cannonTower,
  iceTower,
  archer,
  mage,
  assassin,
];

/** 第5关卡池：深渊裂隙（全部卡牌可用） */
export const LEVEL_5_CARD_POOL: CardInstance[] = [...ALL_CARDS];

/** 完整抽卡池（单位卡 + 技能卡，不含奥术卡 — 奥术卡为即时效果不参与抽卡） */
export const FULL_DRAFT_POOL: CardInstance[] = [
  ...UNIT_CARDS,
  ...SPELL_CARDS,
];
