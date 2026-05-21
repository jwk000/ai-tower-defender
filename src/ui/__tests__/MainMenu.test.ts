import { describe, it, expect } from 'vitest';

import { buildMainMenu, hitTestMainMenu, layoutMainMenu, MainMenu, resolveMainMenuClick, type MainMenuAction } from '../MainMenu.js';

describe('buildMainMenu', () => {
  it('always enables start-run and quit', () => {
    const buttons = buildMainMenu({});
    for (const action of ['start-run', 'quit'] as const) {
      expect(buttons.find((b) => b.action === action)!.enabled).toBe(true);
    }
  });

  it('has exactly 2 buttons', () => {
    const buttons = buildMainMenu({});
    expect(buttons.length).toBe(2);
    expect(buttons.map((b) => b.action)).toEqual(['start-run', 'quit']);
  });
});

describe('resolveMainMenuClick', () => {
  it('returns the action when button is enabled', () => {
    expect(resolveMainMenuClick({}, 'start-run')).toBe('start-run');
  });
});

describe('MainMenu class wrapper', () => {
  it('invokes handler with enabled actions', () => {
    const menu = new MainMenu({});
    const got: MainMenuAction[] = [];
    menu.setHandler((a) => got.push(a));
    menu.trigger('start-run');
    menu.trigger('quit');
    expect(got).toEqual(['start-run', 'quit']);
  });
});

describe('layoutMainMenu + hitTestMainMenu', () => {
  const VW = 1344;
  const VH = 576;

  it('layout 包含正确标题、副标题、版本号字段', () => {
    const layout = layoutMainMenu({}, VW, VH);
    expect(layout.titleLabel).toBe('Tower Defender');
    expect(layout.subtitleLabel).toBe('塔 防 守 护 者');
    expect(layout.versionLabel).toBe('v0.1');
  });

  it('按钮包含对应图标字段', () => {
    const layout = layoutMainMenu({}, VW, VH);
    expect(layout.buttons.find((b) => b.action === 'start-run')?.icon).toBe('🗡');
    expect(layout.buttons.find((b) => b.action === 'quit')?.icon).toBe('🚪');
  });

  it('layout 中心对齐 2 个按钮，宽度 320，间距 16，可命中 start-run', () => {
    const layout = layoutMainMenu({}, VW, VH);
    expect(layout.buttons.length).toBe(2);
    for (const b of layout.buttons) {
      expect(b.width).toBe(320);
      expect(b.height).toBe(56);
      expect(b.x).toBe((VW - 320) / 2);
    }
    const startBtn = layout.buttons[0]!;
    const cx = startBtn.x + startBtn.width / 2;
    const cy = startBtn.y + startBtn.height / 2;
    expect(hitTestMainMenu(layout, cx, cy)).toBe('start-run');
  });

  it('点击空白处返回 null', () => {
    const layout = layoutMainMenu({}, VW, VH);
    expect(hitTestMainMenu(layout, 0, 0)).toBeNull();
    expect(hitTestMainMenu(layout, VW - 1, VH - 1)).toBeNull();
  });

  it('可命中 quit 按钮', () => {
    const layout = layoutMainMenu({}, VW, VH);
    const quitBtn = layout.buttons.find((b) => b.action === 'quit')!;
    const cx = quitBtn.x + quitBtn.width / 2;
    const cy = quitBtn.y + quitBtn.height / 2;
    expect(hitTestMainMenu(layout, cx, cy)).toBe('quit');
  });
});
