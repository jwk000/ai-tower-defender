// ============================================================
// cards.ts — v4.0 卡牌定义（per design/03-units.md §7）
//
// 导出完整卡牌定义数组，供 HandSystem 等模块使用。
// ============================================================

import type { CardInstance } from '../systems/HandSystem.js';

// ---- 塔（10种）----

const arrowTower: CardInstance = {
  id: 'card_arrow_tower',
  name: '箭塔',
  type: 'unit',
  description: '基础单体物理输出，攻速快',
  goldCost: 70,
};

const ballistaTower: CardInstance = {
  id: 'card_ballista_tower',
  name: '弩塔',
  type: 'unit',
  description: '穿透型物理输出，箭矢直线贯穿敌人',
  goldCost: 135,
};

const cannonTower: CardInstance = {
  id: 'card_cannon_tower',
  name: '炮塔',
  type: 'unit',
  description: 'AOE物理范围伤害，溅射攻击',
  goldCost: 115,
};

const laserTower: CardInstance = {
  id: 'card_laser_tower',
  name: '激光塔',
  type: 'unit',
  description: '单体魔法持续伤害，锁敌后伤害递增',
  goldCost: 125,
};

const batTower: CardInstance = {
  id: 'card_bat_tower',
  name: '蝙蝠塔',
  type: 'unit',
  description: '召唤型，释放蝙蝠自动攻击周围敌人',
  goldCost: 115,
};

const missileTower: CardInstance = {
  id: 'card_missile_tower',
  name: '导弹塔',
  type: 'unit',
  description: '半个棋盘宽度射程的大范围伤害，战略武器',
  goldCost: 220,
};

const iceTower: CardInstance = {
  id: 'card_ice_tower',
  name: '冰塔',
  type: 'unit',
  description: '魔法控制型塔，减速并概率冰冻敌人',
  goldCost: 70,
};

const fireTower: CardInstance = {
  id: 'card_fire_tower',
  name: '火塔',
  type: 'unit',
  description: '魔法DOT型塔，灼烧造成持续伤害',
  goldCost: 80,
};

const poisonTower: CardInstance = {
  id: 'card_poison_tower',
  name: '毒塔',
  type: 'unit',
  description: '魔法DOT传染型塔，中毒可在敌人间传播',
  goldCost: 80,
};

const lightningTower: CardInstance = {
  id: 'card_lightning_tower',
  name: '电塔',
  type: 'unit',
  description: '魔法连锁攻击，5级每10秒全屏落雷优先轰击Boss/精英',
  goldCost: 110,
};

// ---- 士兵（6种）----

const shieldGuard: CardInstance = {
  id: 'card_shield_guard',
  name: '盾卫',
  type: 'unit',
  description: '高血量高防御前排，低攻击嘲讽坦克',
  goldCost: 35,
};

const swordsman: CardInstance = {
  id: 'card_swordsman',
  name: '剑士',
  type: 'unit',
  description: '近战物理输出，旋风斩对周围敌人造成范围伤害',
  goldCost: 50,
};

const archer: CardInstance = {
  id: 'card_archer',
  name: '弓手',
  type: 'unit',
  description: '超远射程低攻击，概率造成2倍/3倍暴击',
  goldCost: 35,
};

const mage: CardInstance = {
  id: 'card_mage',
  name: '法师',
  type: 'unit',
  description: '魔法AOE，附加易伤并周期释放奥术爆破',
  goldCost: 40,
};

const priest: CardInstance = {
  id: 'card_priest',
  name: '牧师',
  type: 'unit',
  description: '治疗支援，恢复我方士兵并提供少量攻击',
  goldCost: 35,
};

const assassin: CardInstance = {
  id: 'card_assassin',
  name: '刺客',
  type: 'unit',
  description: '低血高攻刺杀位，瞬移处决低血普通敌人',
  goldCost: 45,
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
  description: '困住敌人2秒，触发后5秒冷却',
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



// ---- 技能卡（5种）----

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
  description: '3×3格范围两波25点物理伤害',
  goldCost: 45,
};

const blizzard: CardInstance = {
  id: 'card_blizzard',
  name: '暴风雪',
  type: 'spell',
  description: '全屏暴风雪45点伤害并减速，持续5秒',
  goldCost: 90,
};

const bomb: CardInstance = {
  id: 'card_bomb',
  name: '炸弹',
  type: 'spell',
  description: '2×2格范围80点伤害，放置后2秒爆炸',
  goldCost: 60,
};

const earthquake: CardInstance = {
  id: 'card_earthquake',
  name: '大地裂变',
  type: 'spell',
  description: '全棋盘震动，3秒内每秒对所有敌人造成100点物理伤害',
  goldCost: 140,
};

// ---- 自施法技能卡（经济）----

const goldRush: CardInstance = {
  id: 'card_gold_rush',
  name: '淘金热',
  type: 'spell',
  description: '立即获得80金币',
  goldCost: 20,
};

const upgradeShieldGuard: CardInstance = {
  id: 'card_upgrade_shield_guard',
  name: '盾卫升级卡',
  type: 'spell',
  description: '本场战斗所有盾卫等级+1，后续部署也生效',
  goldCost: 80,
};

const upgradeSwordsman: CardInstance = {
  id: 'card_upgrade_swordsman',
  name: '剑士升级卡',
  type: 'spell',
  description: '本场战斗所有剑士等级+1，后续部署也生效',
  goldCost: 80,
};

const upgradeArcher: CardInstance = {
  id: 'card_upgrade_archer',
  name: '弓箭手升级卡',
  type: 'spell',
  description: '本场战斗所有弓箭手等级+1，后续部署也生效',
  goldCost: 80,
};

const upgradePriest: CardInstance = {
  id: 'card_upgrade_priest',
  name: '牧师升级卡',
  type: 'spell',
  description: '本场战斗所有牧师等级+1，后续部署也生效',
  goldCost: 80,
};

const upgradeAssassin: CardInstance = {
  id: 'card_upgrade_assassin',
  name: '刺客升级卡',
  type: 'spell',
  description: '本场战斗所有刺客等级+1，后续部署也生效',
  goldCost: 95,
};

const upgradeMage: CardInstance = {
  id: 'card_upgrade_mage',
  name: '法师升级卡',
  type: 'spell',
  description: '本场战斗所有法师等级+1，后续部署也生效',
  goldCost: 80,
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
  swordsman,
  archer,
  mage,
  priest,
  assassin,
  spikeTrap,
  bearTrap,
  tarPit,
  boulder,
];

/** 所有技能卡（含自施法经济卡） */
export const SPELL_CARDS: CardInstance[] = [
  fireball,
  arrowRain,
  blizzard,
  bomb,
  earthquake,
  goldRush,
  upgradeShieldGuard,
  upgradeSwordsman,
  upgradeArcher,
  upgradePriest,
  upgradeAssassin,
  upgradeMage,
];

/** 全部卡牌 */
export const ALL_CARDS: CardInstance[] = [
  ...UNIT_CARDS,
  ...SPELL_CARDS,
];

// ============================================================
// 关卡卡池（per design/03-units.md §7.1-7.3 主题归属）
// ============================================================

/** 第1关卡池：绿野仙踪（箭塔系列 + 冰塔 + 初始单位） */
export const LEVEL_1_CARD_POOL: CardInstance[] = [
  arrowTower,
  iceTower,
  shieldGuard,
  swordsman,
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
  swordsman,
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
  swordsman,
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
  swordsman,
  archer,
  mage,
  assassin,
];

/** 第5关卡池：深渊裂隙（全部卡牌可用） */
export const LEVEL_5_CARD_POOL: CardInstance[] = [...ALL_CARDS];

/** 完整抽卡池（单位卡 + 技能卡） */
export const FULL_DRAFT_POOL: CardInstance[] = [
  ...UNIT_CARDS,
  ...SPELL_CARDS,
];
