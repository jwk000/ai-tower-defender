import { describe, expect, it } from 'vitest';

import { RunManager, RunPhase, type MapNodeKind } from '../RunManager.js';
import type { CardSkillTreeConfig } from '../SkillTreeState.js';

function makeManager(totalLevels = 1, route?: readonly MapNodeKind[]): RunManager {
  return new RunManager({ totalLevels, route });
}

const TEST_SKILL_TREE: CardSkillTreeConfig = {
  unitCardId: 'arrow_tower',
  nodes: [
    { id: 'arrow_lv1', name: '箭塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
    { id: 'arrow_lv2', name: '箭塔 Lv.2', level: 2, goldCost: 0, prerequisites: ['arrow_lv1'], effects: [] },
    { id: 'arrow_lv3', name: '箭塔 Lv.3', level: 3, goldCost: 0, prerequisites: ['arrow_lv2'], effects: [] },
  ],
};

describe('RunManager state machine', () => {
  it('starts in Idle phase with no active level', () => {
    const run = makeManager();
    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
  });

  it('startRun transitions Idle -> LevelMap and sets level to 1', () => {
    const run = makeManager();
    run.startRun();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(1);
  });

  it('exposes route nodes and current node kind', () => {
    const route = ['battle', 'elite', 'shop', 'mystic', 'treasure', 'rest', 'boss'] as const;
    const run = makeManager(route.length, route);
    run.startRun();
    expect(run.currentNodeKind).toBe('battle');
    expect(run.getRouteNode(2)).toEqual({ levelIndex: 2, kind: 'elite' });
    expect(run.getRoute().map((node) => node.kind)).toEqual(route);
  });

  it('enterBattle transitions LevelMap -> Battle', () => {
    const run = makeManager();
    run.startRun();
    run.enterBattle();
    expect(run.phase).toBe(RunPhase.Battle);
  });

  it('rejects startRun when not in Idle', () => {
    const run = makeManager();
    run.startRun();
    expect(() => run.startRun()).toThrow(/illegal transition/i);
  });

  it('completeLevel from Battle with more levels remaining transitions to InterLevel', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.InterLevel);
    expect(run.currentLevel).toBe(1);
    expect(run.pendingCardReward?.options).toHaveLength(3);
  });

  it('completeLevel from Battle on final level transitions to Result with Victory outcome', () => {
    const run = makeManager(1);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('victory');
  });

  it('pickInterLevelChoice("shop") transitions InterLevel -> Shop without advancing level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.pickInterLevelChoice('shop');
    expect(run.phase).toBe(RunPhase.Shop);
    expect(run.currentLevel).toBe(1);
  });

  it('pickInterLevelChoice("mystic") transitions InterLevel -> Mystic without advancing level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.pickInterLevelChoice('mystic');
    expect(run.phase).toBe(RunPhase.Mystic);
    expect(run.currentLevel).toBe(1);
  });

  it('closeShop transitions Shop -> LevelMap and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.pickInterLevelChoice('shop');
    run.closeShop();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('closeMystic transitions Mystic -> LevelMap and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.pickInterLevelChoice('mystic');
    run.closeMystic();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('returnToLevelMap transitions InterLevel -> LevelMap and advances level (skip path)', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.InterLevel);
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.returnToLevelMap();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('rejects returnToLevelMap when not in InterLevel', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.returnToLevelMap()).toThrow(/illegal transition/i);
  });

  it('rejects closeShop when not in Shop', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.closeShop()).toThrow(/illegal transition/i);
  });

  it('rejects closeMystic when not in Mystic', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.closeMystic()).toThrow(/illegal transition/i);
  });

  it('failRun from Battle transitions to Result with Defeat outcome', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.failRun();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('defeat');
  });

  it('rejects completeLevel when not in Battle', () => {
    const run = makeManager();
    expect(() => run.completeLevel()).toThrow(/illegal transition/i);
  });

  it('rejects pickInterLevelChoice when not in InterLevel', () => {
    const run = makeManager();
    run.startRun();
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/illegal transition/i);
  });

  it('rejects pickInterLevelChoice with unknown choice value', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    expect(() => run.pickInterLevelChoice('teleport' as unknown as 'shop')).toThrow(/unknown choice/i);
  });

  it('stores and resolves pending card reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options).toHaveLength(3);
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/card reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/card reward is pending/i);
    const chosen = run.pendingCardReward!.options[1]!;
    expect(run.claimCardReward(chosen.id)).toEqual(chosen);
    expect(run.pendingCardReward).toBeNull();
  });

  it('stores and resolves pending gold reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);

    expect(run.pendingGoldReward?.options).toHaveLength(3);
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/gold reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/gold reward is pending/i);
    const goldBefore = run.gold;
    const chosen = run.pendingGoldReward!.options[1]!;
    expect(run.claimGoldReward(chosen.id)).toEqual(chosen);
    expect(run.gold).toBe(goldBefore + chosen.amount);
    expect(run.pendingGoldReward).toBeNull();
  });

  it('rotates reward starters across summon, spell, and building trap archetypes', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'archer_card',
      'shield_guard_card',
      'priest_card',
    ]);

    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'priest_card',
      'fireball_card',
      'gold_mine_card',
    ]);
  });

  it('stores and resolves pending upgrade reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'arrow_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.pickInterLevelChoice('shop')).toThrow(/upgrade reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/upgrade reward is pending/i);
    expect(run.getCardLevel('arrow_b')).toBe(1);

    const chosen = run.pendingUpgradeReward!.options[1]!;
    expect(run.claimUpgradeReward(chosen.id)).toEqual(chosen);
    expect(run.pendingUpgradeReward).toBeNull();
    expect(run.getCardLevel('arrow_b')).toBe(2);
  });

  it('claimUpgradeReward rejects unknown option ids', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'arrow_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.claimUpgradeReward('missing')).toThrow(/unknown upgrade reward option/i);
  });

  it('claimUpgradeReward fails loudly when target instance is missing', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'missing_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'missing_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'missing_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.claimUpgradeReward('u1')).toThrow(/INSTANCE_NOT_FOUND/i);
  });

  it('claimUpgradeReward fails loudly when no next upgrade is available', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.activateNode('arrow_a', 'arrow_lv2');
    run.activateNode('arrow_a', 'arrow_lv3');
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'arrow_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '已满级' },
        { id: 'u2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.claimUpgradeReward('u1')).toThrow(/NODE_ALREADY_ACTIVE/i);
  });

  it('resetToIdle from Result returns to Idle and clears level/outcome', () => {
    const run = makeManager(1);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    run.resetToIdle();
    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
    expect(run.outcome).toBeNull();
  });

  it('rejects resetToIdle when not in Result', () => {
    const run = makeManager();
    expect(() => run.resetToIdle()).toThrow(/illegal transition/i);
  });
});
