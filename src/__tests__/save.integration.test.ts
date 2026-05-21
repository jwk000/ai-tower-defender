import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeckSystem } from '../unit-system/DeckSystem.js';
import { RunManager, RunPhase } from '../unit-system/RunManager.js';
import { SaveSystem, type RunSnapshot } from '../core/SaveSystem.js';

function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

function makeDeck(pool = ['a', 'b', 'c'], deckSize = 3): DeckSystem {
  return new DeckSystem({ pool, deckSize, rng: () => 0 });
}

const STARTER_DECK = ['arrow_tower_card', 'shield_guard_card', 'spike_trap_card', 'fireball_card'] as const;

function bootstrapStarterDeck(deck: DeckSystem, runManager: RunManager): void {
  deck.initWithCards(STARTER_DECK);
  for (const instance of deck.getCardInstances()) {
    const unitCardId = instance.cardId.endsWith('_card') ? instance.cardId.slice(0, -'_card'.length) : instance.cardId;
    runManager.registerCardInstance(instance.instanceId, { unitCardId, nodes: [] });
  }
}

function makeManager(totalLevels = 3): RunManager {
  return new RunManager({ totalLevels, initialGold: 100, initialCrystalHp: 20 });
}

describe('DeckSystem snapshot / restoreFrom', () => {
  it('captures current piles and restores them exactly', () => {
    const deck = makeDeck(['x', 'y', 'z'], 3);
    deck.drawCard();
    deck.discard('x');

    const snap = deck.snapshot();
    expect(snap.drawPile.length).toBe(2);
    expect(snap.discardPile).toEqual(['x']);

    const deck2 = makeDeck(['x', 'y', 'z'], 3);
    deck2.restoreFrom(snap);
    expect(deck2.snapshot()).toEqual(snap);
  });

  it('restoreFrom does not share references with snapshot', () => {
    const deck = makeDeck();
    const snap = deck.snapshot();
    deck.drawCard();
    expect(snap.drawPile.length).toBe(3);
  });

  it('save / restore preserves unique deck without duplicates', () => {
    const deck = makeDeck(['arrow_tower_card', 'shield_guard_card', 'fireball_card', 'cannon_tower_card'], 4);
    deck.initWithCards(['arrow_tower_card', 'shield_guard_card', 'fireball_card', 'cannon_tower_card']);

    const snap = deck.snapshot();
    const restored = makeDeck(['arrow_tower_card', 'shield_guard_card', 'fireball_card', 'cannon_tower_card'], 4);
    restored.restoreFrom(snap);

    expect(restored.snapshot()).toEqual(snap);
  });
});

describe('RunManager snapshot / restoreFrom', () => {
  it('starter deck instances must be registered to show up in deck view state', () => {
    const mgr = makeManager(3);
    const deck = makeDeck([...STARTER_DECK], STARTER_DECK.length);

    deck.initWithCards(STARTER_DECK);
    expect(deck.getCardInstances().length).toBe(4);
    expect(deck.getCardInstances().map((entry) => entry.cardId)).toEqual([...STARTER_DECK]);
    expect(deck.getCardInstances().every((entry) => mgr.getCardLevel(entry.instanceId) === 1)).toBe(true);

    bootstrapStarterDeck(deck, mgr);
    expect(deck.getCardInstances().every((entry) => mgr.getCardLevel(entry.instanceId) === 1)).toBe(true);
  });

  it('captures current run resources and restores them', () => {
    const mgr = makeManager();
    const deck = makeDeck();
    mgr.startRun();
    mgr.addGold(50);
    mgr.damageCrystal(3);

    const snap = mgr.snapshot(deck);
    expect(snap.version).toBe(6);
    expect(snap.phase).toBe('LevelMap');
    expect(snap.currentLevelIdx).toBe(1);
    expect(snap.gold).toBe(150);
    expect(snap.crystalHp).toBe(17);
    expect(snap.crystalHpMax).toBe(20);

    const mgr2 = makeManager();
    mgr2.restoreFrom(snap);
    expect(mgr2.phase).toBe(RunPhase.LevelMap);
    expect(mgr2.currentLevel).toBe(1);
    expect(mgr2.gold).toBe(150);
    expect(mgr2.crystalHp).toBe(17);
  });

  it('restoreFrom preserves InterLevel phase for pending reward resume', () => {
    const mgr = makeManager(5);
    mgr.startRun();
    mgr.enterBattle();
    mgr.completeLevel();
    const snap = mgr.snapshot(makeDeck());

    const mgr2 = makeManager(5);
    mgr2.restoreFrom(snap);
    expect(mgr2.phase).toBe(RunPhase.InterLevel);
  });
});

describe('SaveSystem latest-only behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('hasSavedRun returns false before any current save exists', () => {
    expect(SaveSystem.hasSavedRun()).toBe(false);
  });

  it('hasSavedRun returns true when current save key exists', () => {
    localStorage.setItem('td_run_v6', JSON.stringify({ version: 6 }));
    expect(SaveSystem.hasSavedRun()).toBe(true);
  });

  it('saves and loads a RunSnapshot round-trip', () => {
    const snap: RunSnapshot = {
      version: 6,
      savedAt: 1000,
      phase: 'LevelMap',
      currentLevelIdx: 3,
      gold: 220,
      crystalHp: 15,
      crystalHpMax: 20,
      pendingCardReward: null,
      pendingGoldReward: null,
      pendingRelicReward: null,
      pendingUpgradeReward: null,
      relics: [],
      passiveSources: [],
      cardLevels: [],
      deck: { drawPile: ['c1', 'c2'], discardPile: ['c3'] },
    };

    SaveSystem.saveRun(snap);
    expect(SaveSystem.hasSavedRun()).toBe(true);
    expect(localStorage.getItem('td_run_v6')).not.toContain('skillPoints');
    expect(localStorage.getItem('td_run_v6')).not.toContain('skillTree');

    const loaded = SaveSystem.loadRun();
    expect(loaded).toEqual(snap);
  });

  it('loadRun returns null for unknown version', () => {
    localStorage.setItem('td_run_v6', JSON.stringify({ version: 99, phase: 'LevelMap' }));
    expect(SaveSystem.loadRun()).toBeNull();
  });

  it('ignores old-version save payloads instead of migrating them', () => {
    localStorage.setItem('td_run_v6', JSON.stringify({ version: 5, phase: 'LevelMap' }));
    expect(SaveSystem.loadRun()).toBeNull();
  });

  it('snapshot / restore preserves passive sources for relics', () => {
    const mgr = makeManager(3);
    mgr.startRun();
    mgr.enterBattle();
    mgr.completeLevel();
    mgr.claimCardReward(mgr.pendingCardReward!.options[0]!.id);
    mgr.claimGoldReward(mgr.pendingGoldReward!.options[0]!.id);
    mgr.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
        { id: 'relic_2', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_3', relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40。', category: 'summon' },
      ],
    });
    mgr.claimRelicReward('relic_1');

    const snap = mgr.snapshot(makeDeck());
    expect(snap.passiveSources).toEqual([
      {
        sourceId: 'mana_orb',
        sourceType: 'relic',
        name: '法力宝珠',
        description: '下场战斗初始能量 +1。',
        activeScope: 'run',
        effectRefs: ['mana_orb'],
        grantedAtLevel: 1,
        category: 'energy',
      },
    ]);

    const mgr2 = makeManager(3);
    mgr2.restoreFrom(snap);
    expect(mgr2.passiveSources).toEqual(snap.passiveSources);
    expect(mgr2.getStartEnergyBonusFromRelics()).toBe(1);
  });

  it('clearRun removes the current save key', () => {
    localStorage.setItem('td_run_v6', '{}');
    SaveSystem.clearRun();
    expect(localStorage.getItem('td_run_v6')).toBeNull();
  });
});

describe('Full save → restore flow: RunManager + DeckSystem', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('restores run state and deck piles directly from snapshot without persisting new in-progress saves', () => {
    const mgr = makeManager(4);
    const deck = makeDeck(['c1', 'c2', 'c3'], 3);
    mgr.startRun();
    mgr.addGold(60);
    deck.drawCard();
    deck.discard('c1');

    const snap: RunSnapshot = mgr.snapshot(deck);
    expect('skillPoints' in snap).toBe(false);
    expect('skillTree' in snap).toBe(false);

    const mgr2 = makeManager(4);
    const deck2 = makeDeck(['c1', 'c2', 'c3'], 3);
    mgr2.restoreFrom(snap);
    deck2.restoreFrom(snap.deck);

    expect(mgr2.phase).toBe(RunPhase.LevelMap);
    expect(mgr2.currentLevel).toBe(1);
    expect(mgr2.gold).toBe(160);
    expect(deck2.snapshot()).toEqual(deck.snapshot());
  });
});
