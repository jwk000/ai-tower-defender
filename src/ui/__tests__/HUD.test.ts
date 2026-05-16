import { describe, it, expect } from 'vitest';

import { projectHUD, type RunState } from '../HUD.js';

function state(overrides: Partial<RunState> = {}): RunState {
  return {
    gold: 100,
    crystalHp: 1000,
    crystalHpMax: 1000,
    waveIndex: 1,
    waveTotal: 5,
    phase: 'deployment',
    energy: 5,
    energyMax: 10,
    sp: 0,
    runLevel: 1,
    runTotalLevels: 9,
    enemyCount: 0,
    ...overrides,
  };
}

describe('projectHUD', () => {
  it('formats energy as ◇ current/max', () => {
    const p = projectHUD(state({ energy: 5, energyMax: 10 }));
    expect(p.energy).toBe('◇ 5/10');
  });

  it('formats gold as ● amount', () => {
    const p = projectHUD(state({ gold: 250 }));
    expect(p.gold).toBe('● 250');
  });

  it('formats wave as ⚑ index/total', () => {
    const p = projectHUD(state({ waveIndex: 3, waveTotal: 8 }));
    expect(p.wave).toBe('⚑ 3/8');
  });

  it('formats enemy count as ☠ count', () => {
    const p = projectHUD(state({ enemyCount: 12 }));
    expect(p.enemy).toBe('☠ 12');
  });

  it('formats crystal as 💎 hp/max', () => {
    const p = projectHUD(state({ crystalHp: 850, crystalHpMax: 1000 }));
    expect(p.crystal).toBe('💎 850/1000');
  });

  it('formats runProgress as Run level/total', () => {
    const p = projectHUD(state({ runLevel: 3, runTotalLevels: 9 }));
    expect(p.runProgress).toBe('Run 3/9');
  });

  it('triggers crystalLowAlarm when ratio drops below 30%', () => {
    expect(projectHUD(state({ crystalHp: 300, crystalHpMax: 1000 })).crystalLowAlarm).toBe(false);
    expect(projectHUD(state({ crystalHp: 299, crystalHpMax: 1000 })).crystalLowAlarm).toBe(true);
  });

  it('suppresses crystalLowAlarm when crystal is dead (hp=0)', () => {
    expect(projectHUD(state({ crystalHp: 0, crystalHpMax: 1000 })).crystalLowAlarm).toBe(false);
  });

  it('maps each phase enum to Chinese label', () => {
    expect(projectHUD(state({ phase: 'deployment' })).phaseLabel).toBe('部署阶段');
    expect(projectHUD(state({ phase: 'battle' })).phaseLabel).toBe('战斗中');
    expect(projectHUD(state({ phase: 'wave-break' })).phaseLabel).toBe('波次间歇');
    expect(projectHUD(state({ phase: 'victory' })).phaseLabel).toBe('胜利');
    expect(projectHUD(state({ phase: 'defeat' })).phaseLabel).toBe('失败');
  });
});
