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

describe('SaveSystem legacy migration / cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  it('hasSavedRun returns false before any legacy save exists', () => {
    expect(SaveSystem.hasSavedRun()).toBe(false);
  });

  it('hasSavedRun returns true when a legacy in-progress run key exists', () => {
    localStorage.setItem('td_run_v5', JSON.stringify({ version: 5 }));
    expect(SaveSystem.hasSavedRun()).toBe(true);
  });

  it('loadRun returns null for unknown version', () => {
    localStorage.setItem('td_run_v6', JSON.stringify({ version: 99, phase: 'LevelMap' }));
    expect(SaveSystem.loadRun()).toBeNull();
  });

  it('loadRun migrates v4 save to v6 format', () => {
    localStorage.setItem('td_run_v4', JSON.stringify({
      version: 4,
      savedAt: 888,
      phase: 'InterLevel',
      currentLevelIdx: 2,
      gold: 120,
      crystalHp: 17,
      crystalHpMax: 20,
      pendingCardReward: null,
      pendingGoldReward: null,
      pendingUpgradeReward: null,
      cardLevels: [],
      deck: { drawPile: ['c1'], discardPile: [] },
    }));
    const loaded = SaveSystem.loadRun();
    expect(loaded?.version).toBe(6);
    expect(loaded?.pendingRelicReward).toBeNull();
    expect(loaded?.relics).toEqual([]);
    expect(loaded?.passiveSources).toEqual([]);
  });

  it('loadRun migrates v2 save to v6 format', () => {
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
    expect(loaded?.version).toBe(6);
    expect(loaded?.gold).toBe(100);
    expect(loaded?.crystalHp).toBe(18);
    expect(loaded?.pendingRelicReward).toBeNull();
    expect(loaded?.relics).toEqual([]);
    expect(loaded?.passiveSources).toEqual([]);
    expect(loaded).not.toBeNull();
    expect('skillPoints' in loaded!).toBe(false);
    expect('skillTree' in loaded!).toBe(false);
  });

  it('loadRun migrates v1 save to v6 format', () => {
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
    expect(loaded?.version).toBe(6);
    expect(loaded?.gold).toBe(100);
    expect(loaded?.crystalHp).toBe(18);
    expect(loaded?.pendingRelicReward).toBeNull();
    expect(loaded?.relics).toEqual([]);
    expect(loaded?.passiveSources).toEqual([]);
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

  it('clearRun removes save and legacy keys', () => {
    localStorage.setItem('td_run_v6', '{}');
    localStorage.setItem('td_run_v4', '{}');
    localStorage.setItem('td_run_v3', '{}');
    localStorage.setItem('td_run_v2', '{}');
    localStorage.setItem('td_run_v1', '{}');
    localStorage.setItem('td_ongoing_run', '{}');
    SaveSystem.clearRun();
    expect(localStorage.getItem('td_run_v6')).toBeNull();
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
