import { describe, it, expect } from 'vitest';

import { hitTestRunResultButton, projectRunResult, RunResultPanel, type RunResultState } from '../RunResultPanel.js';

function makeStats(overrides: Partial<RunResultState['stats']> = {}): RunResultState['stats'] {
  return {
    levelsCleared: 9,
    totalLevels: 9,
    enemiesKilled: 386,
    maxSingleWaveKills: 24,
    goldSpent: 1240,
    crystalHpRemaining: 850,
    crystalHpMax: 1000,
    elapsedSeconds: 2538,
    ...overrides,
  };
}

function state(overrides: Partial<RunResultState> = {}): RunResultState {
  return {
    outcome: 'victory',
    stats: makeStats(),
    ...overrides,
  };
}

describe('projectRunResult', () => {
  it('victory header uses 🏆 emoji and gold color', () => {
    const layout = projectRunResult(state());
    expect(layout.headerLabel).toBe('🏆 Run 胜利！');
    expect(layout.headerColor).toBe(0xffd700);
  });

  it('defeat header uses 💀 emoji and dark-red color', () => {
    const layout = projectRunResult(state({ outcome: 'defeat' }));
    expect(layout.headerLabel).toBe('💀 Run 失败');
    expect(layout.headerColor).toBe(0xcc3333);
  });

  it('formats elapsed seconds as M:SS', () => {
    const layout = projectRunResult(state({ stats: makeStats({ elapsedSeconds: 65 }) }));
    const line = layout.lines.find((l) => l.label === '通关时长')!;
    expect(line.value).toBe('1:05');
  });

  it('defeat uses "本次 Run 时长" label instead of "通关时长"', () => {
    const layout = projectRunResult(state({ outcome: 'defeat', stats: makeStats({ elapsedSeconds: 120 }) }));
    expect(layout.lines.find((l) => l.label === '本次 Run 时长')).toBeDefined();
    expect(layout.lines.find((l) => l.label === '通关时长')).toBeUndefined();
  });

  it('contains all 6 base stat fields', () => {
    const layout = projectRunResult(state());
    const labels = layout.lines.map((l) => l.label);
    expect(labels).toContain('最远到达');
    expect(labels).toContain('总击杀');
    expect(labels).toContain('最大单波击杀');
    expect(labels).toContain('水晶剩余血量');
    expect(labels).toContain('共花费金币');
  });

  it('shows archetypeTag on victory when provided', () => {
    const layout = projectRunResult(state({
      stats: makeStats({ archetypeTag: '法术爆发流' }),
    }));
    expect(layout.lines.find((l) => l.label === '流派标签')?.value).toBe('法术爆发流');
  });

  it('omits archetypeTag on defeat', () => {
    const layout = projectRunResult(state({
      outcome: 'defeat',
      stats: makeStats({ archetypeTag: '法术爆发流' }),
    }));
    expect(layout.lines.find((l) => l.label === '流派标签')).toBeUndefined();
    expect(layout.lines.find((l) => l.label === '关键技能树')).toBeUndefined();
  });

  it('includes 3 resourceResetLines on victory (with "下一次 Run" line)', () => {
    const layout = projectRunResult(state());
    expect(layout.resourceResetLines.length).toBe(3);
    expect(layout.resourceResetLines[1]).toContain('金币 / 水晶 HP / 卡组状态已重置');
    expect(layout.resourceResetLines[2]).toContain('下一次 Run');
  });

  it('includes 2 resourceResetLines on defeat', () => {
    const layout = projectRunResult(state({ outcome: 'defeat' }));
    expect(layout.resourceResetLines.length).toBe(2);
  });

  it('has exactly 2 buttons: return-menu (left) and start-new-run (right)', () => {
    const layout = projectRunResult(state(), 1920, 1080);
    expect(layout.buttons.map((b) => b.id)).toEqual(['return-menu', 'start-new-run']);
    expect(layout.buttons[0]!.x).toBeLessThan(layout.buttons[1]!.x);
  });

  it('levelThemeName appears in defeat level label', () => {
    const layout = projectRunResult(state({ outcome: 'defeat', levelThemeName: '雷暴荒原', stats: makeStats({ levelsCleared: 4 }) }));
    expect(layout.lines.find((l) => l.label === '最远到达')?.value).toBe('关卡 4（雷暴荒原）');
  });
});

describe('RunResultPanel class wrapper', () => {
  it('triggers handler with action when state present', () => {
    const panel = new RunResultPanel();
    let lastAction = '';
    panel.setHandler((action) => { lastAction = action; });
    panel.refresh(state());
    panel.trigger('return-menu');
    expect(lastAction).toBe('return-menu');
    panel.trigger('start-new-run');
    expect(lastAction).toBe('start-new-run');
  });

  it('getLayout returns null before refresh, layout after refresh', () => {
    const panel = new RunResultPanel();
    expect(panel.getLayout()).toBeNull();
    panel.refresh(state());
    expect(panel.getLayout()?.headerLabel).toBe('🏆 Run 胜利！');
  });
});

describe('hitTestRunResultButton', () => {
  it('点击按钮中心返回对应 id，按钮外返回 null', () => {
    const layout = projectRunResult(state(), 1344, 576);
    const btn0 = layout.buttons[0]!;
    expect(hitTestRunResultButton(layout, btn0.x + btn0.width / 2, btn0.y + btn0.height / 2)).toBe('return-menu');
    const btn1 = layout.buttons[1]!;
    expect(hitTestRunResultButton(layout, btn1.x + btn1.width / 2, btn1.y + btn1.height / 2)).toBe('start-new-run');
    expect(hitTestRunResultButton(layout, 0, 0)).toBeNull();
  });
});
