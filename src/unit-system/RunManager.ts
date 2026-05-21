import type { RunSnapshot } from '../core/SaveSystem.js';
import type { DeckSystem } from './DeckSystem.js';
import {
  createSkillTreeState,
  serializeSkillTreeState,
  type CardSkillTreeConfig,
  type CardSkillTreeState,
  type SerializedSkillTreeState,
  type SkillTreeEffect,
  type SkillTreeError,
  type SkillTreeNodeConfig,
  type SkillTreeState,
} from './SkillTreeState.js';

export const RunPhase = {
  Idle: 'Idle',
  LevelMap: 'LevelMap',
  Battle: 'Battle',
  InterLevel: 'InterLevel',
  Shop: 'Shop',
  Mystic: 'Mystic',
  SkillTree: 'SkillTree',
  Result: 'Result',
} as const;
export type RunPhase = (typeof RunPhase)[keyof typeof RunPhase];
export type MapNodeKind = 'battle' | 'elite' | 'shop' | 'mystic' | 'treasure' | 'rest' | 'boss';

export interface RunRouteNode {
  readonly levelIndex: number;
  readonly kind: MapNodeKind;
}

export interface CardRewardOption {
  readonly id: string;
  readonly cardId: string;
  readonly title: string;
  readonly description: string;
}

export interface PendingCardReward {
  readonly sourceLevel: number;
  readonly options: readonly [CardRewardOption, CardRewardOption, CardRewardOption];
}

export interface GoldRewardOption {
  readonly id: string;
  readonly amount: number;
  readonly title: string;
  readonly description: string;
}

export interface PendingGoldReward {
  readonly sourceLevel: number;
  readonly options: readonly [GoldRewardOption, GoldRewardOption, GoldRewardOption];
}

export interface RelicRewardOption {
  readonly id: string;
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'economy' | 'energy' | 'summon' | 'spell' | 'defense';
}

export interface EconomyRelicDefinition {
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'economy';
  readonly startGoldBonus?: number;
  readonly levelClearGoldBonus?: number;
  readonly shopDiscountPercent?: number;
}

export interface EnergyRelicDefinition {
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'energy';
  readonly startEnergyBonus?: number;
  readonly maxEnergyBonus?: number;
  readonly regenPerSecondBonus?: number;
}

export interface SummonRelicDefinition {
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'summon';
  readonly playerSoldierHpBonus?: number;
  readonly playerSoldierAttackBonus?: number;
}

export interface SpellRelicDefinition {
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'spell';
  readonly spellExtraCastCount?: number;
}

export interface DefenseRelicDefinition {
  readonly relicId: string;
  readonly title: string;
  readonly description: string;
  readonly category: 'defense';
  readonly crystalHpMaxBonus?: number;
  readonly crystalHealAmount?: number;
}

export interface PendingRelicReward {
  readonly sourceLevel: number;
  readonly options: readonly [RelicRewardOption, RelicRewardOption, RelicRewardOption];
}

export interface UpgradeRewardOption {
  readonly id: string;
  readonly instanceId: string;
  readonly cardId: string;
  readonly title: string;
  readonly description: string;
}

export interface CardUpgradeOption {
  readonly level: number;
  readonly goldCost: number;
  readonly title: string;
  readonly description: string;
}

export interface PendingUpgradeReward {
  readonly sourceLevel: number;
  readonly options: readonly [UpgradeRewardOption, UpgradeRewardOption, UpgradeRewardOption];
}

export type InterLevelChoice = 'shop' | 'mystic';
export type RunOutcome = 'victory' | 'defeat';

const DEMO_CARD_REWARD_OPTIONS: readonly Omit<CardRewardOption, 'id'>[] = [
  { cardId: 'archer_card', title: '弓箭手', description: '召唤流基础输出位，补足前中期稳定清线。' },
  { cardId: 'shield_guard_card', title: '盾卫', description: '召唤流前排核心，负责卡线与吸收压力。' },
  { cardId: 'priest_card', title: '牧师', description: '召唤流续航核心，维持前线站场时间。' },
  { cardId: 'fireball_card', title: '火球术', description: '法术流基础爆发，适合处理中期密集敌群。' },
  { cardId: 'gold_mine_card', title: '金矿', description: '建筑流经济核心，帮助滚起后续资源优势。' },
  { cardId: 'spike_trap_card', title: '地刺', description: '陷阱流起手组件，补足路径压制与磨血。' },
  { cardId: 'arrow_tower_card', title: '箭塔卡', description: '低费稳定输出，适合补足前期站场。' },
  { cardId: 'cannon_tower_card', title: '炮塔卡', description: '范围火力更强，适合清理成群敌人。' },
  { cardId: 'ice_tower_card', title: '冰塔卡', description: '减速控场，适合拉长怪物受击时间。' },
  { cardId: 'fire_tower_card', title: '火塔卡', description: '灼烧压血，适合持续消耗高血目标。' },
  { cardId: 'poison_tower_card', title: '毒塔卡', description: '中毒磨血，适合应对长线波次。' },
  { cardId: 'lightning_tower_card', title: '电塔卡', description: '高爆发连锁火力，适合压制精英。' },
  { cardId: 'laser_tower_card', title: '激光塔卡', description: '持续穿透输出，适合后期补强。' },
  { cardId: 'crossbow_tower_card', title: '弩塔卡', description: '直线穿透输出，适合走廊型关卡。' },
  { cardId: 'bat_tower_card', title: '蝙蝠塔卡', description: '高阶召唤塔，提供更强后期上限。' },
  { cardId: 'missile_tower_card', title: '导弹塔卡', description: '战略级范围打击，适合作为后期终结手段。' },
] as const;

const DEMO_GOLD_REWARD_AMOUNTS = [30, 50, 80] as const;

const DEMO_RELIC_REWARD_OPTIONS: readonly Omit<RelicRewardOption, 'id'>[] = [
  { relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币，帮助更快启动构筑。', category: 'economy' },
  { relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1，让前期开局更顺手。', category: 'energy' },
  { relicId: 'merchant_contract', title: '商会契约', description: '商店商品统一 8 折，购买关键卡更从容。', category: 'economy' },
  { relicId: 'arcane_reservoir', title: '奥术蓄能池', description: '下场战斗能量上限 +2，容纳更高爆发。', category: 'energy' },
  { relicId: 'golden_hoard', title: '鎏金秘藏', description: '每次过关额外获得 25 金币，持续滚起经济优势。', category: 'economy' },
  { relicId: 'flowing_focus', title: '流光沙漏', description: '下场战斗能量回复 +0.25/秒，节奏更平滑。', category: 'energy' },
  { relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40，前线更稳。', category: 'summon' },
  { relicId: 'drill_sergeant_whistle', title: '教官口哨', description: '我方士兵召唤物攻击 +6，清线更快。', category: 'summon' },
  { relicId: 'field_rations', title: '战地口粮', description: '我方士兵召唤物生命 +25 且攻击 +4，综合强化站场。', category: 'summon' },
  { relicId: 'ember_seal', title: '余烬印记', description: '法术额外结算 1 次，爆发更高。', category: 'spell' },
  { relicId: 'echo_scroll', title: '回响卷轴', description: '法术额外结算 1 次，适合滚雪球法术流。', category: 'spell' },
  { relicId: 'storm_codex', title: '风暴法典', description: '法术额外结算 1 次，连续清线更稳定。', category: 'spell' },
  { relicId: 'bulwark_core', title: '壁垒核心', description: '水晶上限 +4，并立刻修复 4 点水晶耐久。', category: 'defense' },
  { relicId: 'repair_resin', title: '修复树脂', description: '立刻修复 6 点水晶耐久，帮你稳住残血防线。', category: 'defense' },
  { relicId: 'sanctified_shell', title: '圣护外壳', description: '水晶上限 +2，并立刻修复 2 点水晶耐久。', category: 'defense' },
] as const;

const ECONOMY_RELIC_DEFINITIONS: Readonly<Record<string, EconomyRelicDefinition>> = {
  coin_purse: {
    relicId: 'coin_purse',
    title: '钱袋',
    description: '开局额外获得 80 金币，帮助更快启动构筑。',
    category: 'economy',
    startGoldBonus: 80,
  },
  merchant_contract: {
    relicId: 'merchant_contract',
    title: '商会契约',
    description: '商店商品统一 8 折，购买关键卡更从容。',
    category: 'economy',
    shopDiscountPercent: 20,
  },
  golden_hoard: {
    relicId: 'golden_hoard',
    title: '鎏金秘藏',
    description: '每次过关额外获得 25 金币，持续滚起经济优势。',
    category: 'economy',
    levelClearGoldBonus: 25,
  },
} as const;

const ENERGY_RELIC_DEFINITIONS: Readonly<Record<string, EnergyRelicDefinition>> = {
  mana_orb: {
    relicId: 'mana_orb',
    title: '法力宝珠',
    description: '下场战斗初始能量 +1，让前期开局更顺手。',
    category: 'energy',
    startEnergyBonus: 1,
  },
  arcane_reservoir: {
    relicId: 'arcane_reservoir',
    title: '奥术蓄能池',
    description: '下场战斗能量上限 +2，容纳更高爆发。',
    category: 'energy',
    maxEnergyBonus: 2,
  },
  flowing_focus: {
    relicId: 'flowing_focus',
    title: '流光沙漏',
    description: '下场战斗能量回复 +0.25/秒，节奏更平滑。',
    category: 'energy',
    regenPerSecondBonus: 0.25,
  },
} as const;

const SUMMON_RELIC_DEFINITIONS: Readonly<Record<string, SummonRelicDefinition>> = {
  war_banner: {
    relicId: 'war_banner',
    title: '战旗',
    description: '我方士兵召唤物生命 +40，前线更稳。',
    category: 'summon',
    playerSoldierHpBonus: 40,
  },
  drill_sergeant_whistle: {
    relicId: 'drill_sergeant_whistle',
    title: '教官口哨',
    description: '我方士兵召唤物攻击 +6，清线更快。',
    category: 'summon',
    playerSoldierAttackBonus: 6,
  },
  field_rations: {
    relicId: 'field_rations',
    title: '战地口粮',
    description: '我方士兵召唤物生命 +25 且攻击 +4，综合强化站场。',
    category: 'summon',
    playerSoldierHpBonus: 25,
    playerSoldierAttackBonus: 4,
  },
} as const;

const SPELL_RELIC_DEFINITIONS: Readonly<Record<string, SpellRelicDefinition>> = {
  ember_seal: {
    relicId: 'ember_seal',
    title: '余烬印记',
    description: '法术额外结算 1 次，爆发更高。',
    category: 'spell',
    spellExtraCastCount: 1,
  },
  echo_scroll: {
    relicId: 'echo_scroll',
    title: '回响卷轴',
    description: '法术额外结算 1 次，适合滚雪球法术流。',
    category: 'spell',
    spellExtraCastCount: 1,
  },
  storm_codex: {
    relicId: 'storm_codex',
    title: '风暴法典',
    description: '法术额外结算 1 次，连续清线更稳定。',
    category: 'spell',
    spellExtraCastCount: 1,
  },
} as const;

const DEFENSE_RELIC_DEFINITIONS: Readonly<Record<string, DefenseRelicDefinition>> = {
  bulwark_core: {
    relicId: 'bulwark_core',
    title: '壁垒核心',
    description: '水晶上限 +4，并立刻修复 4 点水晶耐久。',
    category: 'defense',
    crystalHpMaxBonus: 4,
    crystalHealAmount: 4,
  },
  repair_resin: {
    relicId: 'repair_resin',
    title: '修复树脂',
    description: '立刻修复 6 点水晶耐久，帮你稳住残血防线。',
    category: 'defense',
    crystalHealAmount: 6,
  },
  sanctified_shell: {
    relicId: 'sanctified_shell',
    title: '圣护外壳',
    description: '水晶上限 +2，并立刻修复 2 点水晶耐久。',
    category: 'defense',
    crystalHpMaxBonus: 2,
    crystalHealAmount: 2,
  },
} as const;

const DEMO_CARD_UPGRADES: Readonly<Record<string, readonly CardUpgradeOption[]>> = {
  fireball_card: [
    { level: 2, goldCost: 60, title: '火球术 Lv.2', description: '伤害提升到 120，半径扩大到 90。' },
    { level: 3, goldCost: 90, title: '火球术 Lv.3', description: '伤害提升到 155，半径扩大到 100。' },
  ],
  gold_mine_card: [
    { level: 2, goldCost: 70, title: '金矿 Lv.2', description: '产金效率提升，滚雪球更快。' },
    { level: 3, goldCost: 110, title: '金矿 Lv.3', description: '进一步强化经济产出，适合建筑流后期成型。' },
  ],
  spike_trap_card: [
    { level: 2, goldCost: 45, title: '地刺 Lv.2', description: '伤害提升，补足前中期路径压制。' },
    { level: 3, goldCost: 75, title: '地刺 Lv.3', description: '进一步强化陷阱磨血能力，适合长线关卡。' },
  ],
} as const;

const CORE_UPGRADE_CARD_PRIORITY: readonly string[] = [
  'archer_card',
  'shield_guard_card',
  'priest_card',
  'fireball_card',
  'gold_mine_card',
  'spike_trap_card',
] as const;

const VALID_INTER_LEVEL_CHOICES: ReadonlySet<string> = new Set(['shop', 'mystic']);

const CHOICE_TO_PHASE: Readonly<Record<InterLevelChoice, RunPhase>> = {
  shop: RunPhase.Shop,
  mystic: RunPhase.Mystic,
};

function buildDefaultRoute(totalLevels: number): readonly MapNodeKind[] {
  if (totalLevels === 1) return ['boss'];
  const base: MapNodeKind[] = ['battle', 'elite', 'shop', 'mystic', 'treasure', 'rest'];
  const route: MapNodeKind[] = [];
  for (let i = 0; i < totalLevels - 1; i += 1) {
    route.push(base[i % base.length]!);
  }
  route.push('boss');
  return route;
}

export interface RunManagerConfig {
  readonly totalLevels: number;
  readonly route?: readonly MapNodeKind[];
  readonly initialGold?: number;
  readonly initialCrystalHp?: number;
}

export class RunManager {
  private _phase: RunPhase = RunPhase.Idle;
  private _currentLevel = 0;
  private _outcome: RunOutcome | null = null;
  private readonly totalLevels: number;
  private readonly route: readonly MapNodeKind[];

  private readonly initialGold: number;
  private readonly initialCrystalHp: number;
  private _gold = 0;
  private _sp = 0;
  private _crystalHp = 0;
  private _crystalHpMax = 0;

  private _skillTree: SkillTreeState = createSkillTreeState();
  private _lastSkillTreeError: SkillTreeError | null = null;
  private _legacyUnlockedNodes: Set<string> = new Set();
  private _pendingCardReward: PendingCardReward | null = null;
  private _pendingGoldReward: PendingGoldReward | null = null;
  private _pendingRelicReward: PendingRelicReward | null = null;
  private _pendingUpgradeReward: PendingUpgradeReward | null = null;
  private _relics: RelicRewardOption[] = [];

  constructor(config: RunManagerConfig) {
    if (!Number.isInteger(config.totalLevels) || config.totalLevels < 1) {
      throw new Error(`[RunManager] totalLevels must be a positive integer, got ${config.totalLevels}`);
    }
    this.totalLevels = config.totalLevels;
    this.route = config.route ?? buildDefaultRoute(config.totalLevels);
    if (this.route.length !== this.totalLevels) {
      throw new Error(`[RunManager] route length ${this.route.length} must match totalLevels ${this.totalLevels}`);
    }
    this.initialGold = config.initialGold ?? 200;
    this.initialCrystalHp = config.initialCrystalHp ?? 20;
  }

  get phase(): RunPhase {
    return this._phase;
  }

  get currentLevel(): number {
    return this._currentLevel;
  }

  get outcome(): RunOutcome | null {
    return this._outcome;
  }

  get gold(): number {
    return this._gold;
  }

  get sp(): number {
    return this._sp;
  }

  get crystalHp(): number {
    return this._crystalHp;
  }

  get crystalHpMax(): number {
    return this._crystalHpMax;
  }

  get progress(): number {
    if (this._phase === RunPhase.Idle) return 0;
    return Math.min(1, this._currentLevel / this.totalLevels);
  }

  getRouteNode(levelIndex: number): RunRouteNode {
    if (!Number.isInteger(levelIndex) || levelIndex < 1 || levelIndex > this.totalLevels) {
      throw new Error(`[RunManager] invalid levelIndex ${levelIndex}`);
    }
    return {
      levelIndex,
      kind: this.route[levelIndex - 1]!,
    };
  }

  getRoute(): readonly RunRouteNode[] {
    return this.route.map((kind, index) => ({
      levelIndex: index + 1,
      kind,
    }));
  }

  get currentNodeKind(): MapNodeKind | null {
    if (this._currentLevel < 1 || this._currentLevel > this.totalLevels) return null;
    return this.route[this._currentLevel - 1] ?? null;
  }

  get lastSkillTreeError(): SkillTreeError | null {
    return this._lastSkillTreeError;
  }

  get pendingCardReward(): PendingCardReward | null {
    return this._pendingCardReward;
  }

  get pendingGoldReward(): PendingGoldReward | null {
    return this._pendingGoldReward;
  }

  get pendingRelicReward(): PendingRelicReward | null {
    return this._pendingRelicReward;
  }

  get pendingUpgradeReward(): PendingUpgradeReward | null {
    return this._pendingUpgradeReward;
  }

  get relics(): readonly RelicRewardOption[] {
    return this._relics;
  }

  getStartGoldBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (ECONOMY_RELIC_DEFINITIONS[relic.relicId]?.startGoldBonus ?? 0), 0);
  }

  getLevelClearGoldBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (ECONOMY_RELIC_DEFINITIONS[relic.relicId]?.levelClearGoldBonus ?? 0), 0);
  }

  getShopDiscountPercentFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (ECONOMY_RELIC_DEFINITIONS[relic.relicId]?.shopDiscountPercent ?? 0), 0);
  }

  getStartEnergyBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (ENERGY_RELIC_DEFINITIONS[relic.relicId]?.startEnergyBonus ?? 0), 0);
  }

  getMaxEnergyBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (ENERGY_RELIC_DEFINITIONS[relic.relicId]?.maxEnergyBonus ?? 0), 0);
  }

  getEnergyRegenBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (ENERGY_RELIC_DEFINITIONS[relic.relicId]?.regenPerSecondBonus ?? 0), 0);
  }

  getPlayerSoldierHpBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (SUMMON_RELIC_DEFINITIONS[relic.relicId]?.playerSoldierHpBonus ?? 0), 0);
  }

  getPlayerSoldierAttackBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (SUMMON_RELIC_DEFINITIONS[relic.relicId]?.playerSoldierAttackBonus ?? 0), 0);
  }

  getSpellExtraCastCountFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (SPELL_RELIC_DEFINITIONS[relic.relicId]?.spellExtraCastCount ?? 0), 0);
  }

  getCrystalHpMaxBonusFromRelics(): number {
    return this._relics.reduce((total, relic) => total + (DEFENSE_RELIC_DEFINITIONS[relic.relicId]?.crystalHpMaxBonus ?? 0), 0);
  }

  applyShopDiscount(baseCost: number): number {
    if (!Number.isFinite(baseCost) || baseCost < 0) {
      throw new Error(`[RunManager] applyShopDiscount requires non-negative finite baseCost, got ${baseCost}`);
    }
    const discountPercent = this.getShopDiscountPercentFromRelics();
    if (discountPercent <= 0) return Math.floor(baseCost);
    const multiplier = Math.max(0, 100 - discountPercent) / 100;
    return Math.max(0, Math.floor(baseCost * multiplier));
  }

  addGold(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] addGold requires non-negative amount, got ${amount}`);
    this._gold += amount;
  }

  spendGold(amount: number): boolean {
    if (amount < 0) throw new Error(`[RunManager] spendGold requires non-negative amount, got ${amount}`);
    if (this._gold < amount) return false;
    this._gold -= amount;
    return true;
  }

  grantSp(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] grantSp requires non-negative amount, got ${amount}`);
    this._sp += amount;
  }

  spendSp(amount: number): boolean {
    if (amount < 0) throw new Error(`[RunManager] spendSp requires non-negative amount, got ${amount}`);
    if (this._sp < amount) return false;
    this._sp -= amount;
    return true;
  }

  damageCrystal(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] damageCrystal requires non-negative amount, got ${amount}`);
    this._crystalHp = Math.max(0, this._crystalHp - amount);
  }

  healCrystal(amount: number): void {
    if (amount < 0) throw new Error(`[RunManager] healCrystal requires non-negative amount, got ${amount}`);
    this._crystalHp = Math.min(this._crystalHpMax, this._crystalHp + amount);
  }

  startRun(): void {
    if (this._phase !== RunPhase.Idle) {
      throw new Error(`[RunManager] illegal transition: startRun from ${this._phase}`);
    }
    this._phase = RunPhase.LevelMap;
    this._currentLevel = 1;
    this._outcome = null;
    this._gold = this.initialGold;
    this._crystalHp = this.initialCrystalHp;
    this._crystalHpMax = this.initialCrystalHp;
    this._pendingCardReward = null;
    this._pendingGoldReward = null;
    this._pendingRelicReward = null;
    this._pendingUpgradeReward = null;
    this._relics = [];
  }

  enterBattle(): void {
    if (this._phase !== RunPhase.LevelMap) {
      throw new Error(`[RunManager] illegal transition: enterBattle from ${this._phase}`);
    }
    this._phase = RunPhase.Battle;
  }

  returnToLevelMap(): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: returnToLevelMap from ${this._phase}`);
    }
    if (this._pendingCardReward) {
      throw new Error('[RunManager] cannot returnToLevelMap while card reward is pending');
    }
    if (this._pendingGoldReward) {
      throw new Error('[RunManager] cannot returnToLevelMap while gold reward is pending');
    }
    if (this._pendingRelicReward) {
      throw new Error('[RunManager] cannot returnToLevelMap while relic reward is pending');
    }
    if (this._pendingUpgradeReward) {
      throw new Error('[RunManager] cannot returnToLevelMap while upgrade reward is pending');
    }
    this._currentLevel += 1;
    this._phase = RunPhase.LevelMap;
  }

  completeLevel(): void {
    if (this._phase !== RunPhase.Battle) {
      throw new Error(`[RunManager] illegal transition: completeLevel from ${this._phase}`);
    }
    if (this._currentLevel >= this.totalLevels) {
      this._phase = RunPhase.Result;
      this._outcome = 'victory';
      this._pendingCardReward = null;
      this._pendingGoldReward = null;
      this._pendingRelicReward = null;
      this._pendingUpgradeReward = null;
      return;
    }
    this._phase = RunPhase.InterLevel;
    this._pendingCardReward = {
      sourceLevel: this._currentLevel,
      options: this.buildDemoCardRewardOptions(),
    };
    this._pendingGoldReward = {
      sourceLevel: this._currentLevel,
      options: this.buildDemoGoldRewardOptions(),
    };
    this._pendingRelicReward = {
      sourceLevel: this._currentLevel,
      options: this.buildDemoRelicRewardOptions(),
    };
    this._pendingUpgradeReward = null;
  }

  pickInterLevelChoice(choice: InterLevelChoice): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: pickInterLevelChoice from ${this._phase}`);
    }
    if (this._pendingCardReward) {
      throw new Error('[RunManager] cannot pick inter-level branch while card reward is pending');
    }
    if (this._pendingGoldReward) {
      throw new Error('[RunManager] cannot pick inter-level branch while gold reward is pending');
    }
    if (this._pendingRelicReward) {
      throw new Error('[RunManager] cannot pick inter-level branch while relic reward is pending');
    }
    if (this._pendingUpgradeReward) {
      throw new Error('[RunManager] cannot pick inter-level branch while upgrade reward is pending');
    }
    if (!VALID_INTER_LEVEL_CHOICES.has(choice)) {
      throw new Error(`[RunManager] unknown choice: ${choice}`);
    }
    this._phase = CHOICE_TO_PHASE[choice];
  }

  setPendingCardReward(reward: PendingCardReward): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: setPendingCardReward from ${this._phase}`);
    }
    this._pendingCardReward = reward;
  }

  setPendingGoldReward(reward: PendingGoldReward): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: setPendingGoldReward from ${this._phase}`);
    }
    this._pendingGoldReward = reward;
  }

  setPendingRelicReward(reward: PendingRelicReward): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: setPendingRelicReward from ${this._phase}`);
    }
    this._pendingRelicReward = reward;
  }

  setPendingUpgradeReward(reward: PendingUpgradeReward): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: setPendingUpgradeReward from ${this._phase}`);
    }
    this._pendingUpgradeReward = reward;
  }

  claimCardReward(optionId: string): CardRewardOption {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: claimCardReward from ${this._phase}`);
    }
    if (!this._pendingCardReward) {
      throw new Error('[RunManager] no pending card reward');
    }
    const option = this._pendingCardReward.options.find((entry) => entry.id === optionId);
    if (!option) {
      throw new Error(`[RunManager] unknown card reward option: ${optionId}`);
    }
    this._pendingCardReward = null;
    return option;
  }

  registerClaimedCardReward(instanceId: string, cardId: string): void {
    const upgrades = this.getCardUpgradeOptions(cardId);
    if (upgrades.length > 0) {
      this.registerCardLevelTrack(instanceId, cardId, upgrades);
    }
  }

  claimGoldReward(optionId: string): GoldRewardOption {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: claimGoldReward from ${this._phase}`);
    }
    if (!this._pendingGoldReward) {
      throw new Error('[RunManager] no pending gold reward');
    }
    const option = this._pendingGoldReward.options.find((entry) => entry.id === optionId);
    if (!option) {
      throw new Error(`[RunManager] unknown gold reward option: ${optionId}`);
    }
    this._gold += option.amount;
    this._pendingGoldReward = null;
    return option;
  }

  claimRelicReward(optionId: string): RelicRewardOption {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: claimRelicReward from ${this._phase}`);
    }
    if (!this._pendingRelicReward) {
      throw new Error('[RunManager] no pending relic reward');
    }
    const option = this._pendingRelicReward.options.find((entry) => entry.id === optionId);
    if (!option) {
      throw new Error(`[RunManager] unknown relic reward option: ${optionId}`);
    }
    this._relics = [...this._relics, option];
    this.applyRelicImmediateEffects(option);
    this._pendingRelicReward = null;
    return option;
  }

  claimUpgradeReward(optionId: string): UpgradeRewardOption {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: claimUpgradeReward from ${this._phase}`);
    }
    if (!this._pendingUpgradeReward) {
      throw new Error('[RunManager] no pending upgrade reward');
    }
    const option = this._pendingUpgradeReward.options.find((entry) => entry.id === optionId);
    if (!option) {
      throw new Error(`[RunManager] unknown upgrade reward option: ${optionId}`);
    }
    if (!this.applyUpgradeReward(option.instanceId)) {
      const reason = this._lastSkillTreeError ?? 'unknown';
      throw new Error(`[RunManager] failed to apply upgrade reward for ${option.instanceId}: ${reason}`);
    }
    this._pendingUpgradeReward = null;
    return option;
  }

  closeShop(): void {
    if (this._phase !== RunPhase.Shop) {
      throw new Error(`[RunManager] illegal transition: closeShop from ${this._phase}`);
    }
    this._currentLevel += 1;
    this._phase = RunPhase.LevelMap;
  }

  closeMystic(): void {
    if (this._phase !== RunPhase.Mystic) {
      throw new Error(`[RunManager] illegal transition: closeMystic from ${this._phase}`);
    }
    this._currentLevel += 1;
    this._phase = RunPhase.LevelMap;
  }

  closeSkillTree(): void {
    if (this._phase !== RunPhase.SkillTree) {
      throw new Error(`[RunManager] illegal transition: closeSkillTree from ${this._phase}`);
    }
    this._currentLevel += 1;
    this._phase = RunPhase.LevelMap;
  }

  failRun(): void {
    if (this._phase !== RunPhase.Battle) {
      throw new Error(`[RunManager] illegal transition: failRun from ${this._phase}`);
    }
    this._phase = RunPhase.Result;
    this._outcome = 'defeat';
    this._pendingCardReward = null;
    this._pendingGoldReward = null;
    this._pendingRelicReward = null;
    this._pendingUpgradeReward = null;
  }

  resetToIdle(): void {
    if (this._phase !== RunPhase.Result && this._phase !== RunPhase.LevelMap) {
      throw new Error(`[RunManager] illegal transition: resetToIdle from ${this._phase}`);
    }
    this._phase = RunPhase.Idle;
    this._currentLevel = 0;
    this._outcome = null;
    this._gold = 0;
    this._crystalHp = 0;
    this._crystalHpMax = 0;
    this._pendingCardReward = null;
    this._pendingGoldReward = null;
    this._pendingRelicReward = null;
    this._pendingUpgradeReward = null;
    this._relics = [];
    this.resetSkillTreeState();
  }

  registerCardInstance(instanceId: string, config: CardSkillTreeConfig): void {
    const activeNodes = new Set<string>();
    const baseNode = config.nodes.find((node) => node.level === 1) ?? config.nodes[0];
    if (baseNode) {
      activeNodes.add(baseNode.id);
    }
    this._skillTree.instances.set(instanceId, {
      unitCardId: config.unitCardId,
      config,
      activeNodes,
    });
  }

  registerCardLevelTrack(instanceId: string, cardId: string, upgrades: readonly CardUpgradeOption[]): void {
    if (upgrades.length === 0) return;
    const nodes = [
      { id: `${cardId}_lv1`, name: `${cardId} Lv.1`, level: 1, goldCost: 0, prerequisites: [], effects: [] },
      ...upgrades.map((upgrade) => ({
        id: `${cardId}_lv${upgrade.level}`,
        name: upgrade.title,
        level: upgrade.level,
        goldCost: upgrade.goldCost,
        prerequisites: [`${cardId}_lv${upgrade.level - 1}`],
        effects: [],
      })),
    ];
    this.registerCardInstance(instanceId, { unitCardId: cardId, nodes });
  }

  getCardSkillTreeState(instanceId: string): CardSkillTreeState | null {
    return this._skillTree.instances.get(instanceId) ?? null;
  }

  ensureCardInstanceConfig(instanceId: string, config: CardSkillTreeConfig): void {
    const state = this._skillTree.instances.get(instanceId);
    if (!state) {
      this.registerCardInstance(instanceId, config);
      return;
    }
    if (state.config.nodes.length > 0) return;
    this._skillTree.instances.set(instanceId, {
      unitCardId: state.unitCardId,
      config,
      activeNodes: new Set(state.activeNodes),
    });
  }

  removeCardInstance(instanceId: string): void {
    this._skillTree.instances.delete(instanceId);
    if (this._pendingUpgradeReward) {
      const remainingOptions = this._pendingUpgradeReward.options.filter((option) => option.instanceId !== instanceId);
      this._pendingUpgradeReward = remainingOptions.length === 3
        ? this._pendingUpgradeReward
        : null;
    }
  }

  clearPendingUpgradeReward(): void {
    this._pendingUpgradeReward = null;
  }

  activateNode(cardInstanceId: string, nodeId: string): boolean {
    this._lastSkillTreeError = null;
    const inst = this._skillTree.instances.get(cardInstanceId);
    if (!inst) {
      this._lastSkillTreeError = 'INSTANCE_NOT_FOUND';
      return false;
    }

    const foundNode = inst.config.nodes.find((node) => node.id === nodeId) ?? null;
    if (!foundNode) {
      this._lastSkillTreeError = 'NODE_NOT_FOUND';
      return false;
    }

    if (inst.activeNodes.has(nodeId)) {
      this._lastSkillTreeError = 'NODE_ALREADY_ACTIVE';
      return false;
    }

    for (const prereq of foundNode.prerequisites) {
      if (!inst.activeNodes.has(prereq)) {
        this._lastSkillTreeError = 'PREREQUISITE_NOT_MET';
        return false;
      }
    }

    if (this._gold < foundNode.goldCost) {
      this._lastSkillTreeError = 'INSUFFICIENT_GOLD';
      return false;
    }

    this._gold -= foundNode.goldCost;
    inst.activeNodes.add(nodeId);
    return true;
  }

  resolveCardEffects(cardInstanceId: string): SkillTreeEffect[] {
    const inst = this._skillTree.instances.get(cardInstanceId);
    if (!inst) return [];

    const effects: SkillTreeEffect[] = [];
    for (const node of inst.config.nodes) {
      if (inst.activeNodes.has(node.id)) {
        effects.push(...node.effects);
      }
    }
    return effects;
  }

  resetSkillTreeState(): void {
    this._skillTree = createSkillTreeState();
    this._legacyUnlockedNodes = new Set();
    this._lastSkillTreeError = null;
  }

  upgradeCardInstance(instanceId: string): boolean {
    const state = this._skillTree.instances.get(instanceId);
    if (!state) {
      this._lastSkillTreeError = 'INSTANCE_NOT_FOUND';
      return false;
    }
    const nextNode = this.findNextUpgradeNode(state);
    if (!nextNode) {
      this._lastSkillTreeError = 'NODE_ALREADY_ACTIVE';
      return false;
    }
    return this.activateNode(instanceId, nextNode.id);
  }

  getNextUpgradeNode(instanceId: string): SkillTreeNodeConfig | null {
    const state = this._skillTree.instances.get(instanceId);
    if (!state) return null;
    return this.findNextUpgradeNode(state);
  }

  getCardLevel(instanceId: string): number {
    const state = this._skillTree.instances.get(instanceId);
    if (!state) return 1;
    const activeLevels = state.config.nodes
      .filter((node) => state.activeNodes.has(node.id))
      .map((node) => node.level);
    return activeLevels.length > 0 ? Math.max(...activeLevels) : 1;
  }

  snapshot(deckSystem: DeckSystem): RunSnapshot {
    return {
      version: 5,
      savedAt: Date.now(),
      phase: this._phase === RunPhase.InterLevel ? 'InterLevel' : 'LevelMap',
      currentLevelIdx: this._currentLevel,
      gold: this._gold,
      crystalHp: this._crystalHp,
      crystalHpMax: this._crystalHpMax,
      pendingCardReward: this._pendingCardReward,
      pendingGoldReward: this._pendingGoldReward,
      pendingRelicReward: this._pendingRelicReward,
      pendingUpgradeReward: this._pendingUpgradeReward,
      relics: [...this._relics],
      cardLevels: this.buildCardLevelSnapshot(),
      deck: deckSystem.snapshot(),
    };
  }

  restoreFrom(snap: RunSnapshot, resolveSkillTreeConfig?: (unitCardId: string) => CardSkillTreeConfig | null): void {
    this._phase = snap.phase === 'InterLevel' ? RunPhase.InterLevel : RunPhase.LevelMap;
    this._currentLevel = snap.currentLevelIdx;
    this._outcome = null;
    this._gold = snap.gold;
    this._crystalHp = snap.crystalHp;
    this._crystalHpMax = snap.crystalHpMax;
    this._pendingCardReward = 'pendingCardReward' in snap ? snap.pendingCardReward : null;
    this._pendingGoldReward = 'pendingGoldReward' in snap ? snap.pendingGoldReward : null;
    this._pendingRelicReward = 'pendingRelicReward' in snap ? snap.pendingRelicReward : null;
    this._pendingUpgradeReward = 'pendingUpgradeReward' in snap ? snap.pendingUpgradeReward : null;
    this._relics = 'relics' in snap ? [...snap.relics] : [];
    this.resetSkillTreeState();

    if (!resolveSkillTreeConfig) return;
    for (const [index, cardLevel] of snap.cardLevels.entries()) {
      const config = resolveSkillTreeConfig(cardLevel.cardId);
      if (!config) continue;
      const instanceId = `${cardLevel.cardId}_${index}`;
      this.registerCardInstance(instanceId, config);
      for (const node of config.nodes
        .filter((entry) => entry.level > 1 && entry.level <= cardLevel.level)
        .sort((a, b) => a.level - b.level)) {
        const state = this._skillTree.instances.get(instanceId);
        if (!state) break;
        state.activeNodes.add(node.id);
      }
    }
  }

  hasSkillNode(nodeId: string): boolean {
    if (this._legacyUnlockedNodes.has(nodeId)) return true;
    for (const inst of this._skillTree.instances.values()) {
      if (inst.activeNodes.has(nodeId)) return true;
    }
    return false;
  }

  unlockSkillNode(nodeId: string): void {
    this._legacyUnlockedNodes.add(nodeId);
    for (const inst of this._skillTree.instances.values()) {
      inst.activeNodes.add(nodeId);
    }
  }

  get skillTreeState(): ReadonlySet<string> {
    const all = new Set<string>(this._legacyUnlockedNodes);
    for (const inst of this._skillTree.instances.values()) {
      for (const n of inst.activeNodes) all.add(n);
    }
    return all;
  }

  private buildCardLevelSnapshot(): { cardId: string; level: number }[] {
    const result: { cardId: string; level: number }[] = [];
    for (const state of this._skillTree.instances.values()) {
      const activeLevels = state.config.nodes
        .filter((node) => state.activeNodes.has(node.id))
        .map((node) => node.level);
      result.push({
        cardId: state.unitCardId,
        level: activeLevels.length > 0 ? Math.max(...activeLevels) : 1,
      });
    }
    return result;
  }

  private findNextUpgradeNode(state: CardSkillTreeState): SkillTreeNodeConfig | null {
    return state.config.nodes
      .filter((node) => !state.activeNodes.has(node.id))
      .sort((a, b) => a.level - b.level)[0] ?? null;
  }

  buildUpgradeRewardOptions(cardInstances: readonly { instanceId: string; cardId: string }[]): readonly [UpgradeRewardOption, UpgradeRewardOption, UpgradeRewardOption] | null {
    const eligible = cardInstances
      .map((instance) => {
        const nextNode = this.getNextUpgradeNode(instance.instanceId);
        if (!nextNode) return null;
        return {
          id: `${instance.instanceId}_${nextNode.level}`,
          instanceId: instance.instanceId,
          cardId: instance.cardId,
          title: nextNode.name,
          description: `升级到 Lv.${nextNode.level}`,
          nextLevel: nextNode.level,
        };
      })
      .filter((option): option is UpgradeRewardOption & { nextLevel: number } => option !== null);
    if (eligible.length < 3) return null;

    const priority = eligible.filter((option) => CORE_UPGRADE_CARD_PRIORITY.includes(option.cardId));
    const fallback = eligible.filter((option) => !CORE_UPGRADE_CARD_PRIORITY.includes(option.cardId));
    const ranked = [...priority, ...fallback]
      .sort((a, b) => {
        const aPriority = CORE_UPGRADE_CARD_PRIORITY.indexOf(a.cardId);
        const bPriority = CORE_UPGRADE_CARD_PRIORITY.indexOf(b.cardId);
        if (aPriority !== -1 || bPriority !== -1) {
          if (aPriority === -1) return 1;
          if (bPriority === -1) return -1;
          if (aPriority !== bPriority) return aPriority - bPriority;
        }
        if (a.nextLevel !== b.nextLevel) return a.nextLevel - b.nextLevel;
        return a.instanceId.localeCompare(b.instanceId);
      })
      .slice(0, 3)
      .map(({ nextLevel, ...option }) => option);

    if (ranked.length !== 3) return null;
    return ranked as [UpgradeRewardOption, UpgradeRewardOption, UpgradeRewardOption];
  }

  getCardUpgradeOptions(cardId: string): readonly CardUpgradeOption[] {
    return DEMO_CARD_UPGRADES[cardId] ?? [];
  }

  private applyUpgradeReward(instanceId: string): boolean {
    this._lastSkillTreeError = null;
    const state = this._skillTree.instances.get(instanceId);
    if (!state) {
      this._lastSkillTreeError = 'INSTANCE_NOT_FOUND';
      return false;
    }
    const nextNode = this.findNextUpgradeNode(state);
    if (!nextNode) {
      this._lastSkillTreeError = 'NODE_ALREADY_ACTIVE';
      return false;
    }
    for (const prereq of nextNode.prerequisites) {
      if (!state.activeNodes.has(prereq)) {
        this._lastSkillTreeError = 'PREREQUISITE_NOT_MET';
        return false;
      }
    }
    state.activeNodes.add(nextNode.id);
    return true;
  }

  private applyRelicImmediateEffects(relic: RelicRewardOption): void {
    const definition = ECONOMY_RELIC_DEFINITIONS[relic.relicId];
    if (definition?.startGoldBonus && definition.startGoldBonus > 0) {
      this.addGold(definition.startGoldBonus);
    }

    const defenseDefinition = DEFENSE_RELIC_DEFINITIONS[relic.relicId];
    if (!defenseDefinition) return;
    if (defenseDefinition.crystalHpMaxBonus && defenseDefinition.crystalHpMaxBonus > 0) {
      this._crystalHpMax += defenseDefinition.crystalHpMaxBonus;
    }
    if (defenseDefinition.crystalHealAmount && defenseDefinition.crystalHealAmount > 0) {
      this.healCrystal(defenseDefinition.crystalHealAmount);
    }
  }

  private buildDemoCardRewardOptions(): readonly [CardRewardOption, CardRewardOption, CardRewardOption] {
    const ownedCardIds = new Set<string>();
    for (const instance of this._skillTree.instances.values()) {
      ownedCardIds.add(instance.config.unitCardId.endsWith('_card') ? instance.config.unitCardId : `${instance.config.unitCardId}_card`);
    }
    const available = DEMO_CARD_REWARD_OPTIONS.filter((option) => !ownedCardIds.has(option.cardId));
    if (available.length < 3) {
      throw new Error('[RunManager] not enough unique card rewards remaining');
    }
    const startIndex = ((this._currentLevel - 1) * 2) % available.length;
    const options = [0, 1, 2].map((offset) => {
      const base = available[(startIndex + offset) % available.length]!;
      return {
        id: `reward-${this._currentLevel}-${offset + 1}`,
        cardId: base.cardId,
        title: base.title,
        description: base.description,
      };
    });
    return options as [CardRewardOption, CardRewardOption, CardRewardOption];
  }

  private buildDemoRelicRewardOptions(): readonly [RelicRewardOption, RelicRewardOption, RelicRewardOption] {
    const ownedRelicIds = new Set(this._relics.map((relic) => relic.relicId));
    const available = DEMO_RELIC_REWARD_OPTIONS.filter((option) => !ownedRelicIds.has(option.relicId));
    if (available.length < 3) {
      throw new Error('[RunManager] not enough unique relic rewards remaining');
    }
    const startIndex = Math.max(0, this._currentLevel - 1) % available.length;
    const options = [0, 1, 2].map((offset) => {
      const base = available[(startIndex + offset) % available.length]!;
      return {
        id: `relic-${this._currentLevel}-${offset + 1}`,
        relicId: base.relicId,
        title: base.title,
        description: base.description,
        category: base.category,
      };
    });
    return options as [RelicRewardOption, RelicRewardOption, RelicRewardOption];
  }

  private buildDemoGoldRewardOptions(): readonly [GoldRewardOption, GoldRewardOption, GoldRewardOption] {
    const amountBias = Math.max(0, this._currentLevel - 1) * 5;
    const relicBonus = this.getLevelClearGoldBonusFromRelics();
    const options = DEMO_GOLD_REWARD_AMOUNTS.map((baseAmount, index) => {
      const amount = baseAmount + amountBias + relicBonus;
      return {
        id: `gold-${this._currentLevel}-${index + 1}`,
        amount,
        title: `${amount} 金币`,
        description: `立刻获得 ${amount} 金币，为下一个节点补充资源。`,
      };
    });
    return options as [GoldRewardOption, GoldRewardOption, GoldRewardOption];
  }
}
