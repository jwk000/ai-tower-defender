import { describe, it, expect } from 'vitest';

import { attemptPurchase, applyPurchase, projectShopTopBar, type ShopState } from '../ShopPanel.js';

function state(overrides: Partial<ShopState> = {}): ShopState {
  return {
    gold: 100,
    sp: 5,
    energy: 5,
    energyMax: 10,
    levelIndex: 3,
    items: [
      { id: 'card_arrow', kind: 'buy-unit-card', label: '箭塔', costGold: 50, grantsCardId: 'arrow_tower', stock: 1 },
      { id: 'sp_single', kind: 'buy-skill-point', label: '技能点卡', costGold: 80, grantsSP: 1, stock: 3 },
      { id: 'sp_pack', kind: 'buy-skill-point-pack', label: '技能点限量包', costGold: 350, grantsSP: 5, stock: 1 },
      { id: 'card_shield', kind: 'buy-unit-card', label: '盾卫', costGold: 80, grantsCardId: 'shield_guard', stock: 0 },
    ],
    ...overrides,
  };
}

describe('projectShopTopBar', () => {
  it('formats title with levelIndex', () => {
    const p = projectShopTopBar(state({ levelIndex: 5 }));
    expect(p.titleLabel).toBe('🏪 商店 ─ 关 5 通过');
  });

  it('formats energy as ⚡ current/max', () => {
    const p = projectShopTopBar(state({ energy: 3, energyMax: 10 }));
    expect(p.energyLabel).toBe('⚡ 能量 3/10');
  });

  it('formats gold as ● 金币 amount', () => {
    const p = projectShopTopBar(state({ gold: 240 }));
    expect(p.goldLabel).toBe('● 金币 240');
  });

  it('formats skillPoints as ✦ 技能点 amount', () => {
    const p = projectShopTopBar(state({ sp: 7 }));
    expect(p.spLabel).toBe('✦ 技能点 7');
  });
});

describe('attemptPurchase', () => {
  it('buys a unit card: deducts gold, grants card, leaves sp unchanged', () => {
    expect(attemptPurchase(state(), 'card_arrow')).toEqual({
      kind: 'success', newGold: 50, newSp: 5, grantsCardId: 'arrow_tower', itemKind: 'buy-unit-card', itemId: 'card_arrow',
    });
  });

  it('buys skill-point single: deducts gold, grants SP', () => {
    expect(attemptPurchase(state(), 'sp_single')).toEqual({
      kind: 'success', newGold: 20, newSp: 6, grantsCardId: undefined, itemKind: 'buy-skill-point', itemId: 'sp_single',
    });
  });

  it('buys skill-point pack: deducts gold, grants 5 SP', () => {
    expect(attemptPurchase(state({ gold: 400 }), 'sp_pack')).toEqual({
      kind: 'success', newGold: 50, newSp: 10, grantsCardId: undefined, itemKind: 'buy-skill-point-pack', itemId: 'sp_pack',
    });
  });

  it('rejects with insufficient-gold when gold below cost', () => {
    expect(attemptPurchase(state({ gold: 10 }), 'card_arrow')).toEqual({
      kind: 'rejected', reason: 'insufficient-gold',
    });
  });

  it('rejects with out-of-stock for stock=0 item', () => {
    expect(attemptPurchase(state(), 'card_shield')).toEqual({
      kind: 'rejected', reason: 'out-of-stock',
    });
  });

  it('rejects with no-such-item for unknown id', () => {
    expect(attemptPurchase(state(), 'nope')).toEqual({
      kind: 'rejected', reason: 'no-such-item',
    });
  });
});

describe('applyPurchase', () => {
  it('decrements stock and updates gold/sp on success', () => {
    const { state: next, result } = applyPurchase(state(), 'sp_single');
    expect(result.kind).toBe('success');
    expect(next.gold).toBe(20);
    expect(next.sp).toBe(6);
    expect(next.items.find((i) => i.id === 'sp_single')!.stock).toBe(2);
  });

  it('returns state unchanged on rejection', () => {
    const original = state({ gold: 10 });
    const { state: next, result } = applyPurchase(original, 'card_arrow');
    expect(result.kind).toBe('rejected');
    expect(next).toBe(original);
  });
});
