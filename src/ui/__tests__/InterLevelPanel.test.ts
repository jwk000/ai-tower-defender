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
    mode: 'branch',
    levelIndex: 3,
    nextLevel: 4,
    gold: 180,
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

  it('rewardGoldLabel shows awarded amount', () => {
    const layout = layoutInterLevel(state({ gold: 200 }), 1920, 1080);
    expect(layout.rewardGoldLabel).toBe('● 金币 +200');
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

  it('returns claim-card-reward when panel is in card reward mode', () => {
    expect(resolveInterLevelChoice(state({
      mode: 'card-reward',
      cardRewards: [
        { id: 'r1', cardId: 'arrow_tower_card', title: '箭塔卡', description: '稳健输出' },
        { id: 'r2', cardId: 'fireball_card', title: '火球术', description: '法术爆发' },
        { id: 'r3', cardId: 'shield_guard_card', title: '盾卫卡', description: '前排阻挡' },
      ],
    }), 'r2')).toEqual({
      kind: 'claim-card-reward', rewardId: 'r2', cardId: 'fireball_card',
    });
  });

  it('returns claim-gold-reward when panel is in gold reward mode', () => {
    expect(resolveInterLevelChoice(state({
      mode: 'gold-reward',
      goldRewards: [
        { id: 'g1', amount: 30, title: '30 金币', description: '小额补给' },
        { id: 'g2', amount: 50, title: '50 金币', description: '标准补给' },
        { id: 'g3', amount: 80, title: '80 金币', description: '大额补给' },
      ],
    }), 'g3')).toEqual({
      kind: 'claim-gold-reward', rewardId: 'g3', amount: 80,
    });
  });

  it('returns claim-upgrade-reward when panel is in upgrade reward mode', () => {
    expect(resolveInterLevelChoice(state({
      mode: 'upgrade-reward',
      upgradeRewards: [
        { id: 'u1', instanceId: 'arrow_1', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_2', cardId: 'cannon_tower_card', title: '炮塔 Lv.2', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_3', cardId: 'shield_guard_card', title: '盾卫 Lv.2', description: '升级到 Lv.2' },
      ],
    }), 'u2')).toEqual({
      kind: 'claim-upgrade-reward', rewardId: 'u2', instanceId: 'arrow_2', cardId: 'cannon_tower_card',
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

  it('returns card reward intent in reward mode', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state({
      mode: 'card-reward',
      cardRewards: [
        { id: 'r1', cardId: 'arrow_tower_card', title: '箭塔卡', description: '稳健输出' },
        { id: 'r2', cardId: 'fireball_card', title: '火球术', description: '法术爆发' },
        { id: 'r3', cardId: 'shield_guard_card', title: '盾卫卡', description: '前排阻挡' },
      ],
    }));
    panel.trigger('r3');
    expect(got).toEqual([{ kind: 'claim-card-reward', rewardId: 'r3', cardId: 'shield_guard_card' }]);
  });

  it('returns gold reward intent in gold reward mode', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state({
      mode: 'gold-reward',
      goldRewards: [
        { id: 'g1', amount: 30, title: '30 金币', description: '小额补给' },
        { id: 'g2', amount: 50, title: '50 金币', description: '标准补给' },
        { id: 'g3', amount: 80, title: '80 金币', description: '大额补给' },
      ],
    }));
    panel.trigger('g2');
    expect(got).toEqual([{ kind: 'claim-gold-reward', rewardId: 'g2', amount: 50 }]);
  });

  it('returns upgrade reward intent in upgrade reward mode', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state({
      mode: 'upgrade-reward',
      upgradeRewards: [
        { id: 'u1', instanceId: 'arrow_1', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_2', cardId: 'cannon_tower_card', title: '炮塔 Lv.2', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_3', cardId: 'shield_guard_card', title: '盾卫 Lv.2', description: '升级到 Lv.2' },
      ],
    }));
    panel.trigger('u1');
    expect(got).toEqual([{ kind: 'claim-upgrade-reward', rewardId: 'u1', instanceId: 'arrow_1', cardId: 'arrow_tower_card' }]);
  });
});

describe('card reward layout', () => {
  it('uses reward header and reward cards in card reward mode', () => {
    const layout = layoutInterLevel(state({
      mode: 'card-reward',
      cardRewards: [
        { id: 'r1', cardId: 'arrow_tower_card', title: '箭塔卡', description: '稳健输出' },
        { id: 'r2', cardId: 'fireball_card', title: '火球术', description: '法术爆发' },
        { id: 'r3', cardId: 'shield_guard_card', title: '盾卫卡', description: '前排阻挡' },
      ],
    }), 1920, 1080);

    expect(layout.headerLabel).toBe('🃏 选择 1 张新卡牌');
    expect(layout.items.map((item) => item.title)).toEqual(['箭塔卡', '火球术', '盾卫卡']);
  });

  it('uses gold reward header and gold reward cards in gold reward mode', () => {
    const layout = layoutInterLevel(state({
      mode: 'gold-reward',
      goldRewards: [
        { id: 'g1', amount: 30, title: '30 金币', description: '小额补给' },
        { id: 'g2', amount: 50, title: '50 金币', description: '标准补给' },
        { id: 'g3', amount: 80, title: '80 金币', description: '大额补给' },
      ],
    }), 1920, 1080);

    expect(layout.headerLabel).toBe('💰 选择 1 份金币奖励');
    expect(layout.items.map((item) => item.title)).toEqual(['30 金币', '50 金币', '80 金币']);
  });

  it('uses upgrade reward header and upgrade reward cards in upgrade reward mode', () => {
    const layout = layoutInterLevel(state({
      mode: 'upgrade-reward',
      upgradeRewards: [
        { id: 'u1', instanceId: 'arrow_1', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_2', cardId: 'cannon_tower_card', title: '炮塔 Lv.2', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_3', cardId: 'shield_guard_card', title: '盾卫 Lv.2', description: '升级到 Lv.2' },
      ],
    }), 1920, 1080);

    expect(layout.headerLabel).toBe('⬆ 选择 1 张卡牌升级');
    expect(layout.items.map((item) => item.title)).toEqual(['箭塔 Lv.2', '炮塔 Lv.2', '盾卫 Lv.2']);
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
