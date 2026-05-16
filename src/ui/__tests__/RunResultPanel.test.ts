import { describe, it, expect } from 'vitest';

import { hitTestRunResultButton, projectRunResult, RunResultPanel, type RunResultState } from '../RunResultPanel.js';

function state(overrides: Partial<RunResultState> = {}): RunResultState {
  return {
    outcome: 'victory',
    sparkAwarded: 10,
    stats: {
      levelsCleared: 8,
      totalLevels: 8,
      enemiesKilled: 142,
      goldEarned: 530,
      crystalHpRemaining: 12,
      elapsedSeconds: 750,
    },
    ...overrides,
  };
}

describe('projectRunResult', () => {
  it('uses victory header + color when outcome is victory', () => {
    const layout = projectRunResult(state());
    expect(layout.headerLabel).toBe('胜利！');
    expect(layout.headerColor).toBe(0x4ec59a);
  });

  it('uses defeat header + color when outcome is defeat', () => {
    const layout = projectRunResult(state({ outcome: 'defeat' }));
    expect(layout.headerLabel).toBe('失败');
    expect(layout.headerColor).toBe(0xe06868);
  });

  it('formats elapsed seconds as M:SS', () => {
    const layout = projectRunResult(state({
      stats: { levelsCleared: 1, totalLevels: 8, enemiesKilled: 0, goldEarned: 0, crystalHpRemaining: 0, elapsedSeconds: 65 },
    }));
    const timeLine = layout.lines.find((l) => l.label === '用时')!;
    expect(timeLine.value).toBe('1:05');
  });

  it('renders all 6 stat lines in fixed order', () => {
    const layout = projectRunResult(state());
    expect(layout.lines.map((l) => l.label)).toEqual([
      '通关关卡',
      '击杀敌人',
      '获得金币',
      '水晶剩余',
      '用时',
      '获得火花',
    ]);
  });

  it('prefixes sparkAwarded value with + sign', () => {
    const layout = projectRunResult(state({ sparkAwarded: 3 }));
    expect(layout.lines.find((l) => l.label === '获得火花')!.value).toBe('+3');
  });

  it('has exactly 2 buttons: return-menu and start-new-run', () => {
    const layout = projectRunResult(state());
    expect(layout.buttons.map((b) => b.id)).toEqual(['return-menu', 'start-new-run']);
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
    expect(panel.getLayout()?.headerLabel).toBe('胜利！');
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
