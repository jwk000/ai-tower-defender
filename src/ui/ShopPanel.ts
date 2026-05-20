export type ShopItemKind = 'buy-unit-card' | 'restore-crystal-hp' | 'recycle-card';

export interface ShopItem {
  readonly id: string;
  readonly kind: ShopItemKind;
  readonly label: string;
  readonly costGold: number;
  readonly grantsCardId?: string;
  readonly healCrystalPercent?: number;
  readonly stock: number;
}

export interface ShopState {
  readonly gold: number;
  readonly energy: number;
  readonly energyMax: number;
  readonly levelIndex: number;
  readonly items: readonly ShopItem[];
}

export interface ShopTopBarProjection {
  readonly titleLabel: string;
  readonly energyLabel: string;
  readonly goldLabel: string;
}

export function projectShopTopBar(state: ShopState): ShopTopBarProjection {
  return {
    titleLabel: `🏪 商店 ─ 关 ${state.levelIndex} 通过`,
    energyLabel: `⚡ 能量 ${state.energy}/${state.energyMax}`,
    goldLabel: `● 金币 ${state.gold}`,
  };
}

export type PurchaseResult =
  | { readonly kind: 'success'; readonly newGold: number; readonly grantsCardId?: string; readonly itemKind: ShopItemKind; readonly itemId: string }
  | { readonly kind: 'rejected'; readonly reason: 'no-such-item' | 'out-of-stock' | 'insufficient-gold' };

export function attemptPurchase(state: ShopState, itemId: string): PurchaseResult {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return { kind: 'rejected', reason: 'no-such-item' };
  if (item.stock <= 0) return { kind: 'rejected', reason: 'out-of-stock' };
  if (state.gold < item.costGold) return { kind: 'rejected', reason: 'insufficient-gold' };
  return {
    kind: 'success',
    newGold: state.gold - item.costGold,
    grantsCardId: item.grantsCardId,
    itemKind: item.kind,
    itemId,
  };
}

export function applyPurchase(state: ShopState, itemId: string): { state: ShopState; result: PurchaseResult } {
  const result = attemptPurchase(state, itemId);
  if (result.kind !== 'success') return { state, result };
  return {
    state: {
      ...state,
      gold: result.newGold,
      items: state.items.map((i) => (i.id === itemId ? { ...i, stock: i.stock - 1 } : i)),
    },
    result,
  };
}

export type ShopHandler = (intent: ShopIntent) => void;

export type ShopIntent =
  | { readonly kind: 'purchase'; readonly itemId: string; readonly result: PurchaseResult }
  | { readonly kind: 'close' };

export class ShopPanel {
  private state: ShopState | null = null;
  private handler: ShopHandler | null = null;

  setHandler(handler: ShopHandler): void {
    this.handler = handler;
  }

  refresh(state: ShopState): void {
    this.state = state;
  }

  triggerPurchase(itemId: string): void {
    if (!this.state) return;
    const result = attemptPurchase(this.state, itemId);
    this.handler?.({ kind: 'purchase', itemId, result });
  }

  triggerClose(): void {
    this.handler?.({ kind: 'close' });
  }
}
