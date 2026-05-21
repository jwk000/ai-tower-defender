import { describe, it, expect } from 'vitest';

import {
  buildLevelNodes,
  formatLevelDescription,
  hitTestLevelMap,
  layoutLevelMap,
  LevelMapPanel,
  type LevelMapState,
} from '../LevelMapPanel.js';

function state(overrides: Partial<LevelMapState> = {}): LevelMapState {
  return {
    totalLevels: 7,
    currentLevelIdx: 4,
    gold: 240,
    crystalHp: 850,
    crystalHpMax: 1000,
    runIndex: 1,
    levelMetas: [
      {
        name: '平原入口',
        description: '第一场正面遭遇战',
        waveCount: 3,
        kind: 'battle',
        enemyPreview: [
          { enemyId: 'grunt', name: '小兵', count: 4, isBoss: false, isElite: false },
          { enemyId: 'runner', name: '快兵', count: 2, isBoss: false, isElite: false },
        ],
      },
      { name: '督战官', description: '精英敌人压阵', waveCount: 4, kind: 'elite' },
      { name: '流动商队', description: '补充卡牌与资源', waveCount: 0, kind: 'shop' },
      {
        name: '古树低语',
        description: '随机事件与代价，同时也是一段很长的说明文本，用来验证路线图当前关卡主卡描述会自动换行并在必要时截断。',
        waveCount: 0,
        kind: 'mystic',
        enemyPreview: [
          { enemyId: 'mage', name: '法师', count: 2, isBoss: false, isElite: true },
          { enemyId: 'heavy', name: '重装兵', count: 3, isBoss: false, isElite: true },
          { enemyId: 'runner', name: '快兵', count: 5, isBoss: false, isElite: false },
        ],
      },
      { name: '遗失补给', description: '开启宝箱获取奖励', waveCount: 0, kind: 'treasure' },
      { name: '临时营地', description: '短暂休整恢复状态', waveCount: 0, kind: 'rest' },
      { name: '魔王前线', description: '最终决战', waveCount: 5, kind: 'boss' },
    ],
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
    expect(nodes[6]!.status).toBe('locked');
  });

  it('derives node kinds from levelMetas', () => {
    const nodes = buildLevelNodes(state());
    expect(nodes.map((node) => node.kind)).toEqual(['battle', 'elite', 'shop', 'mystic', 'treasure', 'rest', 'boss']);
  });

  it('last node is boss', () => {
    const nodes = buildLevelNodes(state());
    expect(nodes[6]!.isBoss).toBe(true);
    expect(nodes[0]!.isBoss).toBe(false);
  });
});

describe('layoutLevelMap', () => {
  it('produces nodes inside bottom timeline band', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.nodes).toHaveLength(7);
    for (const node of layout.nodes) {
      expect(node.y).toBeGreaterThan(layout.mainCard.y + layout.mainCard.height);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.timeline.y + layout.timeline.height + 8);
    }
  });

  it('current node is larger than normal nodes', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.nodes[3]!.width).toBeGreaterThan(layout.nodes[0]!.width);
  });

  it('boss node is larger than normal nodes', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    const bossNode = layout.nodes[6]!;
    const normalNode = layout.nodes[0]!;
    expect(bossNode.width).toBeGreaterThan(normalNode.width);
  });

  it('node labels reflect node kinds', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.nodes[0]!.label).toBe('普通战 1');
    expect(layout.nodes[1]!.label).toBe('精英战 2');
    expect(layout.nodes[2]!.label).toBe('商店');
    expect(layout.nodes[3]!.label).toBe('事件');
    expect(layout.nodes[4]!.label).toBe('宝箱');
    expect(layout.nodes[5]!.label).toBe('休整');
    expect(layout.nodes[6]!.label).toBe('终战');
  });

  it('titleLabel contains run index', () => {
    const layout = layoutLevelMap(state({ runIndex: 3 }), 1920, 1080);
    expect(layout.titleLabel).toBe('⚔ 长征路线 · Run #3');
  });

  it('provides mainCard and enemyCard areas', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.mainCard.width).toBeGreaterThan(layout.enemyCard.width);
    expect(layout.mainCard.y).toBeLessThan(layout.timeline.y);
    expect(layout.enemyCard.x).toBeGreaterThan(layout.mainCard.x);
  });

  it('exposes enemy preview from current level meta', () => {
    const layout = layoutLevelMap(state(), 1920, 1080);
    expect(layout.enemyPreview.map((entry) => entry.name)).toEqual(['法师', '重装兵', '快兵']);
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

  it('challengeBtn label reflects current node kind', () => {
    const layout = layoutLevelMap(state({ currentLevelIdx: 5 }), 1920, 1080);
    expect(layout.challengeBtn.label).toBe('进入 宝箱');
  });
});

describe('formatLevelDescription', () => {
  it('truncates very long descriptions with ellipsis', () => {
    const text = '这是一段非常长非常长的关卡描述，用于验证主卡中的说明文本会被限制长度，并在超过上限时自动追加省略号，避免撑破布局。同时它还会继续补充双线压力、快兵穿线、爆炸怪突袭以及建议先检查卡池等额外信息。';
    const formatted = formatLevelDescription(text);
    expect(formatted.endsWith('…')).toBe(true);
    expect(formatted.length).toBeLessThanOrEqual(84);
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
