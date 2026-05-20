import type { DeckSystem } from './DeckSystem.js';

export interface HandSystemConfig {
  readonly maxSize: number;
}

export type DrawResult =
  | { readonly ok: true; readonly cardId: string }
  | { readonly ok: false; readonly reason: 'full-hand' | 'empty-deck' };

export class HandSystem {
  private readonly maxSize: number;
  private hand: string[] = [];
  private lastDrawWasManual = false;

  constructor(config: HandSystemConfig) {
    if (!Number.isInteger(config.maxSize) || config.maxSize <= 0) {
      throw new Error(`[HandSystem] maxSize must be a positive integer, got ${config.maxSize}`);
    }
    this.maxSize = config.maxSize;
  }

  get size(): number {
    return this.hand.length;
  }

  get cards(): string[] {
    return [...this.hand];
  }

  drawTo(deck: DeckSystem): void {
    while (this.hand.length < this.maxSize) {
      const card = deck.drawCard();
      if (card === null) return;
      this.hand.push(card);
    }
    this.lastDrawWasManual = false;
  }

  drawOne(deck: DeckSystem): DrawResult {
    if (this.hand.length >= this.maxSize) {
      return { ok: false, reason: 'full-hand' };
    }
    const card = deck.drawCard();
    if (card === null) {
      return { ok: false, reason: 'empty-deck' };
    }
    this.hand.push(card);
    this.lastDrawWasManual = true;
    return { ok: true, cardId: card };
  }

  discardFromHand(index: number, deck: DeckSystem): string | null {
    const removed = this.playCard(index);
    if (removed !== null) {
      deck.discard(removed);
    }
    return removed;
  }

  playCard(index: number): string | null {
    if (index < 0 || index >= this.hand.length) return null;
    const [removed] = this.hand.splice(index, 1);
    return removed ?? null;
  }

  clear(): void {
    this.hand = [];
    this.lastDrawWasManual = false;
  }
}
