import { describe, it, expect } from 'vitest';

import {
  buildLevelNodes,
  hitTestLevelMap,
  layoutLevelMap,
  LevelMapPanel,
  type LevelMapState,
} from '../LevelMapPanel.js';

function state(overrides: Partial<LevelMapState> = {}): LevelMapState {
  return {
    totalLevels: 9,
    currentLevelIdx: 4,
    gold: 240,
    crystalHp: 850,
    crystalHpMax: 1000,
    runIndex: 1,
    ...overrides,
  };
}

describe('buildLevelNodes', () => {
  it('marks nodes before currentLevelIdx as completed', () => {
    const nodes = buildLevelNodes(state({ currentLevelIdx: 4 }));
    expect(nodes[0]!.status).toBe('completed');
    expect(nodes[1]!.status).toBe('completed');
    expect(nodes[2]!.status).toBe('completed');
  });

  it('marks currentLevelIdx node as current', () => {
    const nodes = buildLevelNodes(state({ currentLevelIdx: 4 }));
    expect(nodes[3]!.status).toBe('current');
  });

  it('marks nodes after currentLevelIdx as locked', () => {
    const nodes = buildLevelNodes(state({ currentLevelIdx: 4 }));
    expect(nodes[4]!.status).toBe('locked');
    expect(nodes[8]!.status).toBe('locked');
  });

  it('last node is boss', () => {
    const nodes = buildLevelNodes(state({ totalLevels: 9 }));
    expect(nodes[8]!.isBoss).toBe(true);
    expect(nodes[0]!.isBoss).toBe(false);
  });
});

describe('layoutLevelMap', () => {
  it('produces 9 nodes at wave-line positions (first and third are lower row)', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.nodes).toHaveLength(9);
    const n1 = layout.nodes[0]!;
    const n2 = layout.nodes[1]!;
    expect(n1.y).toBeGreaterThan(n2.y);
  });

  it('boss node is larger than normal nodes', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    const bossNode = layout.nodes[8]!;
    const normalNode = layout.nodes[0]!;
    expect(bossNode.width).toBeGreaterThan(normalNode.width);
  });

  it('node labels use 关N for normal, 终战 for boss', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.nodes[0]!.label).toBe('关1');
    expect(layout.nodes[8]!.label).toBe('终战');
  });

  it('titleLabel contains run index', () => {
    const layout = layoutLevelMap(state({ runIndex: 3 }), 1920, 1080);
    expect(layout.titleLabel).toBe('⚔ 长征路线 — Run #3');
  });

  it('crystalLabel and goldLabel format correctly', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.crystalLabel).toBe('💎 HP 850/1000');
    expect(layout.goldLabel).toBe('● 金币 240');
  });

  it('deckBtn label is 📚 卡池', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.deckBtn.label).toBe('📚 卡池');
  });

  it('backBtn label is ESC 退出', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.backBtn.label).toBe('ESC 退出');
  });

  it('challengeBtn label reflects currentLevelIdx', () => {
    const layout = layoutLevelMap(state({ currentLevelIdx: 5 }), 1920, 1080);
    expect(layout.challengeBtn.label).toBe('挑战关卡 5');
  });
});

describe('hitTestLevelMap', () => {
  it('点击 challengeBtn 中心返回 challenge', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    const btn = layout.challengeBtn;
    expect(hitTestLevelMap(layout, btn.x + btn.width / 2, btn.y + btn.height / 2)).toBe('challenge');
  });

  it('点击 deckBtn 中心返回 view-deck', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    const btn = layout.deckBtn;
    expect(hitTestLevelMap(layout, btn.x + btn.width / 2, btn.y + btn.height / 2)).toBe('view-deck');
  });

  it('点击 backBtn 中心返回 back-to-menu', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    const btn = layout.backBtn;
    expect(hitTestLevelMap(layout, btn.x + btn.width / 2, btn.y + btn.height / 2)).toBe('back-to-menu');
  });

  it('点击空白处返回 null', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(hitTestLevelMap(layout, 0, 0)).toBeNull();
  });
});

describe('LevelMapPanel class wrapper', () => {
  it('triggers handler with correct action', () => {
    const panel = new LevelMapPanel();
    const actions: string[] = [];
    panel.setHandler((a) => actions.push(a));
    panel.refresh(state());
    panel.trigger('challenge');
    panel.trigger('view-deck');
    expect(actions).toEqual(['challenge', 'view-deck']);
  });

  it('does not trigger when no state set', () => {
    const panel = new LevelMapPanel();
    let called = false;
    panel.setHandler(() => { called = true; });
    panel.trigger('challenge');
    expect(called).toBe(false);
  });
});
