import { describe, expect, it } from 'vitest';

import { RunManager, RunPhase, type MapNodeKind } from '../RunManager.js';

function makeManager(totalLevels = 1, route?: readonly MapNodeKind[]): RunManager {
  return new RunManager({ totalLevels, route });
}

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
    run.pickInterLevelChoice('shop');
    expect(run.phase).toBe(RunPhase.Shop);
    expect(run.currentLevel).toBe(1);
  });

  it('pickInterLevelChoice("mystic") transitions InterLevel -> Mystic without advancing level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.pickInterLevelChoice('mystic');
    expect(run.phase).toBe(RunPhase.Mystic);
    expect(run.currentLevel).toBe(1);
  });

  it('pickInterLevelChoice("skilltree") transitions InterLevel -> SkillTree without advancing level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.pickInterLevelChoice('skilltree');
    expect(run.phase).toBe(RunPhase.SkillTree);
    expect(run.currentLevel).toBe(1);
  });

  it('closeShop transitions Shop -> LevelMap and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
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
    run.pickInterLevelChoice('mystic');
    run.closeMystic();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('closeSkillTree transitions SkillTree -> LevelMap and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.pickInterLevelChoice('skilltree');
    run.closeSkillTree();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('returnToLevelMap transitions InterLevel -> LevelMap and advances level (skip path)', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.InterLevel);
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

  it('rejects closeSkillTree when not in SkillTree', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.closeSkillTree()).toThrow(/illegal transition/i);
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
    expect(() => run.pickInterLevelChoice('teleport' as unknown as 'shop')).toThrow(/unknown choice/i);
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
