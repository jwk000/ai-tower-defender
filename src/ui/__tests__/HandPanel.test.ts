import { describe, it, expect } from 'vitest';

import { hitTestDrawButton, hitTestHandSlot, layoutHand, resolveDropIntent, HandPanel, type HandState, type PlayCardIntent } from '../HandPanel.js';

function state(overrides: Partial<HandState> = {}): HandState {
  return {
    energy: 3,
    energyMax: 10,
    cards: [
      { slot: 0, cardId: 'arrow_tower', cost: 2, playable: true },
      { slot: 1, cardId: 'shield_guard', cost: 3, playable: true },
      { slot: 2, cardId: 'fireball', cost: 5, playable: false },
      { slot: 3, cardId: 'gold_mine', cost: 4, playable: true },
    ],
    ...overrides,
  };
}

describe('layoutHand', () => {
  it('centers current cards within a 4-slot hand area, offset 130px from viewport bottom', () => {
    const layout = layoutHand(state(), 1920, 1080);
    expect(layout.slots).toHaveLength(4);
    const totalWidth = 4 * 120 + 3 * 16;
    expect(layout.slots[0]!.x).toBe((1920 - totalWidth) / 2);
    expect(layout.slots[0]!.y).toBe(1080 - 168 - 130);
  });

  it('positions a partial hand from the left edge of the 4-slot area', () => {
    const layout = layoutHand(state({
      cards: [
        { slot: 0, cardId: 'arrow_tower', cost: 2, playable: true },
        { slot: 1, cardId: 'shield_guard', cost: 3, playable: true },
      ],
    }), 1920, 1080);
    const fullAreaStartX = (1920 - (4 * 120 + 3 * 16)) / 2;
    expect(layout.slots[0]!.x).toBe(fullAreaStartX);
    expect(layout.slots[1]!.x).toBe(fullAreaStartX + 120 + 16);
  });

  it('energyLabel format is ◇ current/max', () => {
    const layout = layoutHand(state({ energy: 3, energyMax: 10 }), 1920, 1080);
    expect(layout.energyLabel).toBe('◇ 3/10');
  });

  it('drawLabel shows ready by default', () => {
    const layout = layoutHand(state(), 1920, 1080);
    expect(layout.drawLabel).toBe('抽卡');
  });

  it('drawLabel shows cooldown/full-hand/reroll states', () => {
    expect(layoutHand(state({ drawState: 'cooldown', drawCooldownSeconds: 4.25 }), 1920, 1080).drawLabel).toBe('冷却 4.3s');
    expect(layoutHand(state({ drawState: 'full-hand' }), 1920, 1080).drawLabel).toBe('手牌已满');
    expect(layoutHand(state({ drawState: 'reroll' }), 1920, 1080).drawLabel).toBe('可重抽');
  });

  it('draw button is placed to the right of hand panel and only enabled for ready/reroll', () => {
    const readyLayout = layoutHand(state({ drawState: 'ready' }), 1920, 1080);
    expect(readyLayout.drawButton).toEqual({ x: 1272, y: 844, width: 132, height: 44, enabled: true });

    const cooldownLayout = layoutHand(state({ drawState: 'cooldown' }), 1920, 1080);
    expect(cooldownLayout.drawButton.enabled).toBe(false);

    const rerollLayout = layoutHand(state({ drawState: 'reroll' }), 1920, 1080);
    expect(rerollLayout.drawButton.enabled).toBe(true);
  });

  it('slot dimensions are 120×168 with 16px gap', () => {
    const layout = layoutHand(state(), 1920, 1080);
    expect(layout.slots[0]!.width).toBe(120);
    expect(layout.slots[0]!.height).toBe(168);
    const gap = layout.slots[1]!.x - (layout.slots[0]!.x + 120);
    expect(gap).toBe(16);
  });

  it('caps at 4 cards even when more are provided', () => {
    const moreState = state({
      cards: [
        { slot: 0, cardId: 'a', cost: 1, playable: true },
        { slot: 1, cardId: 'b', cost: 2, playable: true },
        { slot: 2, cardId: 'c', cost: 3, playable: true },
        { slot: 3, cardId: 'd', cost: 4, playable: true },
        { slot: 4, cardId: 'e', cost: 5, playable: true },
      ],
    });
    expect(layoutHand(moreState, 1920, 1080).slots).toHaveLength(4);
  });

  it('propagates playable flag and cost into slot rect', () => {
    const layout = layoutHand(state(), 1920, 1080);
    expect(layout.slots[2]!.playable).toBe(false);
    expect(layout.slots[2]!.cost).toBe(5);
    expect(layout.slots[2]!.cardId).toBe('fireball');
  });
});

describe('resolveDropIntent', () => {
  it('returns play intent when dropping a playable card outside hand zone', () => {
    const intent = resolveDropIntent(state(), 0, 500, 400, 1080);
    expect(intent).toEqual({ kind: 'play', slot: 0, cardId: 'arrow_tower', targetX: 500, targetY: 400 });
  });

  it('cancels with not-playable when card is not playable', () => {
    const intent = resolveDropIntent(state(), 2, 500, 400, 1080);
    expect(intent).toEqual({ kind: 'cancel', reason: 'not-playable' });
  });

  it('cancels with over-hand-zone when dropping into hand zone (bottom 180px)', () => {
    const intent = resolveDropIntent(state(), 0, 500, 1080 - 180 + 1, 1080);
    expect(intent).toEqual({ kind: 'cancel', reason: 'over-hand-zone' });
  });

  it('cancels with no-such-slot when slot index does not exist', () => {
    const intent = resolveDropIntent(state(), 99, 500, 400, 1080);
    expect(intent).toEqual({ kind: 'cancel', reason: 'no-such-slot' });
  });
});

describe('HandPanel class wrapper', () => {
  it('invokes handler with play intent when drop is outside hand zone', () => {
    const panel = new HandPanel({ viewportWidth: 1920, viewportHeight: 1080 });
    const got: PlayCardIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.trigger(0, 500, 400);
    expect(got).toEqual([{ kind: 'play', slot: 0, cardId: 'arrow_tower', targetX: 500, targetY: 400 }]);
  });

  it('getLayout reflects refreshed state', () => {
    const panel = new HandPanel({ viewportWidth: 1920, viewportHeight: 1080 });
    panel.refresh(state());
    expect(panel.getLayout().slots).toHaveLength(4);
  });
});

describe('hitTestHandSlot', () => {
  it('点击 draw button 区域命中抽卡按钮', () => {
    const layout = layoutHand(state({ drawState: 'ready' }), 1344, 576);
    expect(hitTestDrawButton(layout, layout.drawButton.x + 10, layout.drawButton.y + 10)).toBe(true);
    expect(hitTestDrawButton(layout, layout.drawButton.x - 1, layout.drawButton.y)).toBe(false);
  });

  it('冷却时点击区域仍命中，但按钮 disabled 由上层拦截', () => {
    const layout = layoutHand(state({ drawState: 'cooldown' }), 1344, 576);
    expect(hitTestDrawButton(layout, layout.drawButton.x + 10, layout.drawButton.y + 10)).toBe(true);
    expect(layout.drawButton.enabled).toBe(false);
  });

  it('点击 slot 中心命中对应 slot 编号', () => {
    const layout = layoutHand(state(), 1344, 576);
    for (const slot of layout.slots) {
      const cx = slot.x + slot.width / 2;
      const cy = slot.y + slot.height / 2;
      expect(hitTestHandSlot(layout, cx, cy)).toBe(slot.slot);
    }
  });

  it('点击 hand zone 之外返回 null', () => {
    const layout = layoutHand(state(), 1344, 576);
    expect(hitTestHandSlot(layout, 0, layout.slots[0]!.y)).toBeNull();
    expect(hitTestHandSlot(layout, 1343, layout.slots[0]!.y)).toBeNull();
  });
});
