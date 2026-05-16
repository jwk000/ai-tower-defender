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
});

describe('RunManager snapshot / restoreFrom', () => {
  it('captures all run resources and restores them', () => {
    const mgr = makeManager();
    const deck = makeDeck();
    mgr.startRun();
    mgr.addGold(50);
    mgr.grantSp(5);
    mgr.damageCrystal(3);
    mgr.unlockSkillNode('node_a');

    const snap = mgr.snapshot(deck);
    expect(snap.version).toBe(1);
    expect(snap.phase).toBe('LevelMap');
    expect(snap.currentLevelIdx).toBe(1);
    expect(snap.gold).toBe(150);
    expect(snap.skillPoints).toBe(5);
    expect(snap.crystalHp).toBe(17);
    expect(snap.crystalHpMax).toBe(20);
    expect(snap.skillTreeUnlocked).toEqual(['node_a']);
  });

  it('restoreFrom sets phase to LevelMap and restores all fields', () => {
    const mgr = makeManager(5);
    mgr.startRun();
    mgr.addGold(80);
    mgr.unlockSkillNode('n1');
    mgr.unlockSkillNode('n2');
    const deck = makeDeck();
    const snap = mgr.snapshot(deck);

    const mgr2 = makeManager(5);
    mgr2.restoreFrom(snap);
    expect(mgr2.phase).toBe(RunPhase.LevelMap);
    expect(mgr2.currentLevel).toBe(1);
    expect(mgr2.gold).toBe(180);
    expect(mgr2.skillTreeState.has('n1')).toBe(true);
    expect(mgr2.skillTreeState.has('n2')).toBe(true);
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
      version: 1,
      savedAt: 1000,
      phase: 'LevelMap',
      currentLevelIdx: 3,
      gold: 220,
      skillPoints: 4,
      crystalHp: 15,
      crystalHpMax: 20,
      skillTreeUnlocked: ['atk_up'],
      deck: { drawPile: ['c1', 'c2'], discardPile: ['c3'] },
    };

    SaveSystem.saveRun(snap);
    expect(SaveSystem.hasSavedRun()).toBe(true);

    const loaded = SaveSystem.loadRun();
    expect(loaded).toEqual(snap);
  });

  it('loadRun returns null for unknown version', () => {
    localStorage.setItem('td_run_v1', JSON.stringify({ version: 99, phase: 'LevelMap' }));
    expect(SaveSystem.loadRun()).toBeNull();
  });

  it('clearRun removes save and legacy key', () => {
    localStorage.setItem('td_run_v1', '{}');
    localStorage.setItem('td_ongoing_run', '{}');
    SaveSystem.clearRun();
    expect(localStorage.getItem('td_run_v1')).toBeNull();
    expect(localStorage.getItem('td_ongoing_run')).toBeNull();
  });
});

describe('Full save → restore flow: RunManager + DeckSystem', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('restores run state and deck piles after save/load', () => {
    const mgr = makeManager(4);
    const deck = makeDeck(['c1', 'c2', 'c3'], 3);
    mgr.startRun();
    mgr.addGold(60);
    mgr.grantSp(2);
    deck.drawCard();
    deck.discard('c1');

    const snap = mgr.snapshot(deck);
    SaveSystem.saveRun(snap);

    const loaded = SaveSystem.loadRun()!;
    const mgr2 = makeManager(4);
    const deck2 = makeDeck(['c1', 'c2', 'c3'], 3);
    mgr2.restoreFrom(loaded);
    deck2.restoreFrom(loaded.deck);

    expect(mgr2.phase).toBe(RunPhase.LevelMap);
    expect(mgr2.gold).toBe(160);
    expect(mgr2.sp).toBe(2);
    expect(deck2.snapshot()).toEqual(deck.snapshot());
  });
});
