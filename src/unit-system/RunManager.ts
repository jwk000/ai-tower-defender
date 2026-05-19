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

export type InterLevelChoice = 'shop' | 'mystic' | 'skilltree';
export type RunOutcome = 'victory' | 'defeat';

const VALID_INTER_LEVEL_CHOICES: ReadonlySet<string> = new Set(['shop', 'mystic', 'skilltree']);

const CHOICE_TO_PHASE: Readonly<Record<InterLevelChoice, RunPhase>> = {
  shop: RunPhase.Shop,
  mystic: RunPhase.Mystic,
  skilltree: RunPhase.SkillTree,
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
    this._sp = 0;
    this._crystalHp = this.initialCrystalHp;
    this._crystalHpMax = this.initialCrystalHp;
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
      return;
    }
    this._phase = RunPhase.InterLevel;
  }

  pickInterLevelChoice(choice: InterLevelChoice): void {
    if (this._phase !== RunPhase.InterLevel) {
      throw new Error(`[RunManager] illegal transition: pickInterLevelChoice from ${this._phase}`);
    }
    if (!VALID_INTER_LEVEL_CHOICES.has(choice)) {
      throw new Error(`[RunManager] unknown choice: ${choice}`);
    }
    this._phase = CHOICE_TO_PHASE[choice];
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
  }

  resetToIdle(): void {
    if (this._phase !== RunPhase.Result && this._phase !== RunPhase.LevelMap) {
      throw new Error(`[RunManager] illegal transition: resetToIdle from ${this._phase}`);
    }
    this._phase = RunPhase.Idle;
    this._currentLevel = 0;
    this._outcome = null;
    this._gold = 0;
    this._sp = 0;
    this._crystalHp = 0;
    this._crystalHpMax = 0;
    this.resetSkillTreeState();
  }

  registerCardInstance(instanceId: string, config: CardSkillTreeConfig): void {
    this._skillTree.instances.set(instanceId, {
      unitCardId: config.unitCardId,
      config,
      activeNodes: new Set(),
      equippedPath: null,
    });
  }

  getCardSkillTreeState(instanceId: string): CardSkillTreeState | null {
    return this._skillTree.instances.get(instanceId) ?? null;
  }

  activateNode(cardInstanceId: string, nodeId: string): boolean {
    this._lastSkillTreeError = null;
    const inst = this._skillTree.instances.get(cardInstanceId);
    if (!inst) {
      this._lastSkillTreeError = 'INSTANCE_NOT_FOUND';
      return false;
    }

    let foundNode: { id: string; spCost: number; prerequisites: readonly string[] } | null = null;
    for (const path of inst.config.paths) {
      const n = path.nodes.find((node) => node.id === nodeId);
      if (n) {
        foundNode = n;
        break;
      }
    }
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

    if (this._sp < foundNode.spCost) {
      this._lastSkillTreeError = 'INSUFFICIENT_SP';
      return false;
    }

    this._sp -= foundNode.spCost;
    inst.activeNodes.add(nodeId);
    return true;
  }

  equipPath(cardInstanceId: string, pathId: string | null): boolean {
    this._lastSkillTreeError = null;
    const inst = this._skillTree.instances.get(cardInstanceId);
    if (!inst) {
      this._lastSkillTreeError = 'INSTANCE_NOT_FOUND';
      return false;
    }

    if (pathId === null) {
      inst.equippedPath = null;
      return true;
    }

    const path = inst.config.paths.find((p) => p.id === pathId);
    if (!path) {
      this._lastSkillTreeError = 'PATH_NOT_FOUND';
      return false;
    }

    if (inst.equippedPath === pathId) {
      this._lastSkillTreeError = 'ALREADY_EQUIPPED';
      return false;
    }

    const hasActivatedNonBaseNode = path.nodes.some((n) => n.depth >= 2 && inst.activeNodes.has(n.id));
    if (!hasActivatedNonBaseNode) {
      this._lastSkillTreeError = 'PATH_NOT_ACTIVATABLE';
      return false;
    }

    inst.equippedPath = pathId;
    return true;
  }

  resolveCardEffects(cardInstanceId: string): SkillTreeEffect[] {
    const inst = this._skillTree.instances.get(cardInstanceId);
    if (!inst || !inst.equippedPath) return [];

    const path = inst.config.paths.find((p) => p.id === inst.equippedPath);
    if (!path) return [];

    const effects: SkillTreeEffect[] = [];
    for (const node of path.nodes) {
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

  snapshot(deckSystem: DeckSystem): RunSnapshot {
    return {
      version: 2,
      savedAt: Date.now(),
      phase: 'LevelMap',
      currentLevelIdx: this._currentLevel,
      gold: this._gold,
      skillPoints: this._sp,
      crystalHp: this._crystalHp,
      crystalHpMax: this._crystalHpMax,
      skillTree: serializeSkillTreeState(this._skillTree),
      deck: deckSystem.snapshot(),
    };
  }

  restoreFrom(snap: RunSnapshot): void {
    this._phase = RunPhase.LevelMap;
    this._currentLevel = snap.currentLevelIdx;
    this._outcome = null;
    this._gold = snap.gold;
    this._sp = snap.skillPoints;
    this._crystalHp = snap.crystalHp;
    this._crystalHpMax = snap.crystalHpMax;
    this._skillTree = createSkillTreeState();
    if ('skillTree' in snap && snap.skillTree) {
      const serialized = snap.skillTree as SerializedSkillTreeState;
      for (const entry of serialized.instances) {
        this._skillTree.instances.set(entry.instanceId, {
          unitCardId: entry.state.unitCardId,
          config: { unitCardId: entry.state.unitCardId, paths: [] },
          activeNodes: new Set(entry.state.activeNodes),
          equippedPath: entry.state.equippedPath,
        });
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
}
