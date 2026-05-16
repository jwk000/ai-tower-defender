import { describe, it, expect } from 'vitest';

import {
  hitTestInterLevel,
  layoutInterLevel,
  resolveInterLevelChoice,
  InterLevelPanel,
  type InterLevelState,
  type InterLevelIntent,
} from '../InterLevelPanel.js';

function state(overrides: Partial<InterLevelState> = {}): InterLevelState {
  return {
    levelIndex: 3,
    nextLevel: 4,
    gold: 180,
    spAwarded: 1,
    crystalHpLost: 50,
    offers: [
      { id: 'a', kind: 'shop', title: '🏪 商店', description: '明码标价 · 补强资源' },
      { id: 'b', kind: 'mystic', title: '🌀 秘境', description: '随机事件 · 高方差' },
      { id: 'c', kind: 'skip', title: '⏭ 跳过', description: '直入下关 · 零代价' },
    ],
    ...overrides,
  };
}

describe('layoutInterLevel', () => {
  it('headerLabel shows 🏆 关卡N通过！ format', () => {
    const layout = layoutInterLevel(state({ levelIndex: 5 }), 1920, 1080);
    expect(layout.headerLabel).toBe('🏆 关卡 5 通过！');
  });

  it('rewardGoldLabel and rewardSpLabel show awarded amounts', () => {
    const layout = layoutInterLevel(state({ gold: 200, spAwarded: 2 }), 1920, 1080);
    expect(layout.rewardGoldLabel).toBe('● 金币 +200');
    expect(layout.rewardSpLabel).toBe('✦ 技能点 +2');
  });

  it('crystalLostLabel shows damage when crystalHpLost > 0', () => {
    expect(layoutInterLevel(state({ crystalHpLost: 50 }), 1920, 1080).crystalLostLabel).toBe('水晶损失 -50 HP');
    expect(layoutInterLevel(state({ crystalHpLost: 0 }), 1920, 1080).crystalLostLabel).toBe('水晶无损');
  });

  it('centers three cards horizontally with 40px gap and 280px card width', () => {
    const layout = layoutInterLevel(state(), 1920, 1080);
    expect(layout.items).toHaveLength(3);
    const totalW = 280 * 3 + 40 * 2;
    expect(layout.items[0]!.x).toBe((1920 - totalW) / 2);
    expect(layout.items[0]!.width).toBe(280);
    expect(layout.items[0]!.height).toBe(320);
  });

  it('gap between cards is 40px', () => {
    const layout = layoutInterLevel(state(), 1920, 1080);
    const gapBetween = layout.items[1]!.x - (layout.items[0]!.x + 280);
    expect(gapBetween).toBe(40);
  });
});

describe('resolveInterLevelChoice', () => {
  it('returns enter-node with kind when offerId matches shop or mystic', () => {
    expect(resolveInterLevelChoice(state(), 'a')).toEqual({
      kind: 'enter-node', offerId: 'a', node: 'shop',
    });
    expect(resolveInterLevelChoice(state(), 'b')).toEqual({
      kind: 'enter-node', offerId: 'b', node: 'mystic',
    });
  });

  it('returns skip when offer kind is skip', () => {
    expect(resolveInterLevelChoice(state(), 'c')).toEqual({ kind: 'skip' });
  });

  it('returns invalid when offerId does not exist', () => {
    expect(resolveInterLevelChoice(state(), 'nope')).toEqual({
      kind: 'invalid', reason: 'no-such-offer',
    });
  });
});

describe('InterLevelPanel class wrapper', () => {
  it('triggers handler with enter-node intent when offerId matches', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.trigger('b');
    expect(got).toEqual([{ kind: 'enter-node', offerId: 'b', node: 'mystic' }]);
  });

  it('returns skip intent for skip offer', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.trigger('c');
    expect(got).toEqual([{ kind: 'skip' }]);
  });

  it('returns invalid intent when offerId not found', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.trigger('nope');
    expect(got).toEqual([{ kind: 'invalid', reason: 'no-such-offer' }]);
  });
});

describe('hitTestInterLevel', () => {
  it('点击中心命中对应 offer', () => {
    const layout = layoutInterLevel(state(), 1344, 576);
    for (const item of layout.items) {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      expect(hitTestInterLevel(layout, cx, cy)).toBe(item.id);
    }
  });

  it('点击空白返回 null', () => {
    const layout = layoutInterLevel(state(), 1344, 576);
    expect(hitTestInterLevel(layout, 0, 0)).toBeNull();
    expect(hitTestInterLevel(layout, 1343, 575)).toBeNull();
  });

  it('点击 offer 之间的间隙返回 null', () => {
    const layout = layoutInterLevel(state(), 1344, 576);
    const first = layout.items[0]!;
    const gapX = first.x + first.width + 10;
    const cy = first.y + first.height / 2;
    expect(hitTestInterLevel(layout, gapX, cy)).toBeNull();
  });
});
