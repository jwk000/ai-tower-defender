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

export interface UpgradeRewardOption {
  readonly id: string;
  readonly instanceId: string;
  readonly cardId: string;
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
  private _pendingUpgradeReward: PendingUpgradeReward | null = null;

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

  get pendingUpgradeReward(): PendingUpgradeReward | null {
    return this._pendingUpgradeReward;
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
    this._pendingUpgradeReward = null;
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
    this._pendingUpgradeReward = null;
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
      version: 3,
      savedAt: Date.now(),
      phase: this._phase === RunPhase.InterLevel ? 'InterLevel' : 'LevelMap',
      currentLevelIdx: this._currentLevel,
      gold: this._gold,
      crystalHp: this._crystalHp,
      crystalHpMax: this._crystalHpMax,
      pendingCardReward: this._pendingCardReward,
      pendingGoldReward: this._pendingGoldReward,
      pendingUpgradeReward: this._pendingUpgradeReward,
      deck: deckSystem.snapshot(),
    };
  }

  restoreFrom(snap: RunSnapshot, resolveSkillTreeConfig?: (unitCardId: string) => CardSkillTreeConfig | null): void {
    void resolveSkillTreeConfig;
    this._phase = snap.phase === 'InterLevel' ? RunPhase.InterLevel : RunPhase.LevelMap;
    this._currentLevel = snap.currentLevelIdx;
    this._outcome = null;
    this._gold = snap.gold;
    this._crystalHp = snap.crystalHp;
    this._crystalHpMax = snap.crystalHpMax;
    this._pendingCardReward = 'pendingCardReward' in snap ? snap.pendingCardReward : null;
    this._pendingGoldReward = 'pendingGoldReward' in snap ? snap.pendingGoldReward : null;
    this._pendingUpgradeReward = 'pendingUpgradeReward' in snap ? snap.pendingUpgradeReward : null;
    this.resetSkillTreeState();
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

  private findNextUpgradeNode(state: CardSkillTreeState): SkillTreeNodeConfig | null {
    return state.config.nodes.find((node) => !state.activeNodes.has(node.id)) ?? null;
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

  private buildDemoGoldRewardOptions(): readonly [GoldRewardOption, GoldRewardOption, GoldRewardOption] {
    const amountBias = Math.max(0, this._currentLevel - 1) * 5;
    const options = DEMO_GOLD_REWARD_AMOUNTS.map((baseAmount, index) => {
      const amount = baseAmount + amountBias;
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
