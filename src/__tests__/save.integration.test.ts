import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeckSystem } from '../unit-system/DeckSystem.js';
import { RunManager, RunPhase } from '../unit-system/RunManager.js';
import { SaveSystem, type RunSnapshot, type RunSnapshotV2 } from '../core/SaveSystem.js';

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
  it('captures current run resources and restores them', () => {
    const mgr = makeManager();
    const deck = makeDeck();
    mgr.startRun();
    mgr.addGold(50);
    mgr.damageCrystal(3);

    const snap = mgr.snapshot(deck);
    expect(snap.version).toBe(4);
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

describe('SaveSystem save / load round-trip', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('hasSavedRun returns false before any save', () => {
    expect(SaveSystem.hasSavedRun()).toBe(false);
  });

  it('saves and loads a RunSnapshot round-trip', () => {
    const snap: RunSnapshot = {
      version: 4,
      savedAt: 1000,
      phase: 'LevelMap',
      currentLevelIdx: 3,
      gold: 220,
      crystalHp: 15,
      crystalHpMax: 20,
      pendingCardReward: null,
      pendingGoldReward: null,
      pendingUpgradeReward: null,
      cardLevels: [],
      deck: { drawPile: ['c1', 'c2'], discardPile: ['c3'] },
    };

    SaveSystem.saveRun(snap);
    expect(SaveSystem.hasSavedRun()).toBe(true);
    expect(localStorage.getItem('td_run_v4')).not.toContain('skillPoints');
    expect(localStorage.getItem('td_run_v4')).not.toContain('skillTree');

    const loaded = SaveSystem.loadRun();
    expect(loaded).toEqual(snap);
  });

  it('loadRun returns null for unknown version', () => {
    localStorage.setItem('td_run_v4', JSON.stringify({ version: 99, phase: 'LevelMap' }));
    expect(SaveSystem.loadRun()).toBeNull();
  });

  it('loadRun migrates v2 save to v4 format', () => {
    const v2Save: RunSnapshotV2 = {
      version: 2,
      savedAt: 999,
      phase: 'LevelMap',
      currentLevelIdx: 2,
      gold: 100,
      skillPoints: 3,
      crystalHp: 18,
      crystalHpMax: 20,
      skillTree: { instances: [] },
      pendingCardReward: null,
      pendingGoldReward: null,
      pendingUpgradeReward: null,
      deck: { drawPile: ['c1'], discardPile: [] },
    };
    localStorage.setItem('td_run_v2', JSON.stringify(v2Save));
    const loaded = SaveSystem.loadRun();
    expect(loaded?.version).toBe(4);
    expect(loaded?.gold).toBe(100);
    expect(loaded?.crystalHp).toBe(18);
    expect(loaded).not.toBeNull();
    expect('skillPoints' in loaded!).toBe(false);
    expect('skillTree' in loaded!).toBe(false);
  });

  it('loadRun migrates v1 save to v4 format', () => {
    const v1Save = {
      version: 1,
      savedAt: 999,
      phase: 'LevelMap',
      currentLevelIdx: 2,
      gold: 100,
      skillPoints: 3,
      crystalHp: 18,
      crystalHpMax: 20,
      skillTreeUnlocked: ['node_a', 'node_b'],
      deck: { drawPile: ['c1'], discardPile: [] },
    };
    localStorage.setItem('td_run_v1', JSON.stringify(v1Save));
    const loaded = SaveSystem.loadRun();
    expect(loaded?.version).toBe(4);
    expect(loaded?.gold).toBe(100);
    expect(loaded?.crystalHp).toBe(18);
    expect(loaded).not.toBeNull();
    expect('skillPoints' in loaded!).toBe(false);
    expect('skillTreeUnlocked' in loaded!).toBe(false);
  });

  it('RunManager restoreFrom keeps migrated save free of legacy SP', () => {
    const v2Save: RunSnapshotV2 = {
      version: 2,
      savedAt: 999,
      phase: 'InterLevel',
      currentLevelIdx: 3,
      gold: 145,
      skillPoints: 9,
      crystalHp: 16,
      crystalHpMax: 20,
      skillTree: { instances: [{ id: 'legacy-node' }] },
      pendingCardReward: null,
      pendingGoldReward: null,
      pendingUpgradeReward: null,
      deck: { drawPile: ['c1', 'c2'], discardPile: ['c3'] },
    };
    localStorage.setItem('td_run_v2', JSON.stringify(v2Save));

    const loaded = SaveSystem.loadRun()!;
    const mgr = makeManager(4);
    mgr.restoreFrom(loaded);

    expect(mgr.phase).toBe(RunPhase.InterLevel);
    expect(mgr.currentLevel).toBe(3);
    expect(mgr.gold).toBe(145);
    expect(mgr.crystalHp).toBe(16);
  });

  it('clearRun removes save and legacy keys', () => {
    localStorage.setItem('td_run_v4', '{}');
    localStorage.setItem('td_run_v3', '{}');
    localStorage.setItem('td_run_v2', '{}');
    localStorage.setItem('td_run_v1', '{}');
    localStorage.setItem('td_ongoing_run', '{}');
    SaveSystem.clearRun();
    expect(localStorage.getItem('td_run_v4')).toBeNull();
    expect(localStorage.getItem('td_run_v3')).toBeNull();
    expect(localStorage.getItem('td_run_v2')).toBeNull();
    expect(localStorage.getItem('td_run_v1')).toBeNull();
    expect(localStorage.getItem('td_ongoing_run')).toBeNull();
  });
});

describe('Full save → restore flow: RunManager + DeckSystem', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('restores run state and deck piles after save/load without恢复旧 SP', () => {
    const mgr = makeManager(4);
    const deck = makeDeck(['c1', 'c2', 'c3'], 3);
    mgr.startRun();
    mgr.addGold(60);
    deck.drawCard();
    deck.discard('c1');

    const snap = mgr.snapshot(deck);
    expect('skillPoints' in snap).toBe(false);
    expect('skillTree' in snap).toBe(false);
    SaveSystem.saveRun(snap);

    const loaded = SaveSystem.loadRun()!;
    const mgr2 = makeManager(4);
    const deck2 = makeDeck(['c1', 'c2', 'c3'], 3);
    mgr2.restoreFrom(loaded);
    deck2.restoreFrom(loaded.deck);

    expect(mgr2.phase).toBe(RunPhase.LevelMap);
    expect(mgr2.gold).toBe(160);
    expect(deck2.snapshot()).toEqual(deck.snapshot());
  });
});
