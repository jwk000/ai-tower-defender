export interface DeckSystemConfig {
  readonly pool: readonly string[];
  readonly deckSize: number;
  readonly rng: () => number;
}

export interface CardInstance {
  readonly instanceId: string;
  readonly cardId: string;
}

export interface AddedDeckCard {
  readonly cardId: string;
  readonly instanceId: string;
}

export interface DeckSnapshot {
  readonly ownedCards: string[];
}

export class DeckSystem {
  private readonly pool: readonly string[];
  private readonly deckSize: number;
  private readonly rng: () => number;
  private ownedCards: CardInstance[] = [];
  private instanceCounter = 0;

  constructor(config: DeckSystemConfig) {
    if (config.pool.length === 0) {
      throw new Error('[DeckSystem] empty pool');
    }
    if (!Number.isInteger(config.deckSize) || config.deckSize <= 0) {
      throw new Error(`[DeckSystem] deckSize must be a positive integer, got ${config.deckSize}`);
    }
    this.pool = config.pool;
    this.deckSize = config.deckSize;
    this.rng = config.rng;
    this.buildDeck();
  }

  get drawPileSize(): number {
    return this.ownedCards.length;
  }

  get discardPileSize(): number {
    return 0;
  }

  drawCard(): string | null {
    if (this.ownedCards.length === 0) return null;
    const idx = Math.floor(this.rng() * this.ownedCards.length);
    const safeIdx = idx < this.ownedCards.length ? idx : this.ownedCards.length - 1;
    return this.ownedCards[safeIdx]?.cardId ?? null;
  }

  discard(_card: string): void {
    // 复制抽卡模型下，弃牌不影响卡池拥有列表。
  }

  addCard(cardId: string): AddedDeckCard {
    const instanceId = this.allocateInstance(cardId);
    this.ownedCards.push({ cardId, instanceId });
    return { cardId, instanceId };
  }

  removeInstance(instanceId: string): boolean {
    const index = this.ownedCards.findIndex((entry) => entry.instanceId === instanceId);
    if (index < 0) return false;
    this.ownedCards.splice(index, 1);
    return true;
  }

  previewDrawPile(): string[] {
    return this.ownedCards.map((entry) => entry.cardId);
  }

  getCardInstances(): CardInstance[] {
    return this.ownedCards.map((entry) => ({ ...entry }));
  }

  initWithCards(cards: readonly string[]): void {
    if (cards.length === 0) {
      throw new Error('[DeckSystem] initWithCards: cards must not be empty');
    }
    this.ownedCards = [];
    for (const cardId of cards) {
      this.ownedCards.push({ cardId, instanceId: this.allocateInstance(cardId) });
    }
  }

  reset(): void {
    this.buildDeck();
  }

  snapshot(): DeckSnapshot {
    return {
      ownedCards: this.ownedCards.map((entry) => entry.cardId),
    };
  }

  restoreFrom(snap: DeckSnapshot): void {
    if ('ownedCards' in snap && Array.isArray(snap.ownedCards)) {
      this.ownedCards = snap.ownedCards.map((cardId) => ({ cardId, instanceId: this.allocateInstance(cardId) }));
      return;
    }
    const legacyDrawPile = 'drawPile' in snap && Array.isArray((snap as unknown as { drawPile?: string[] }).drawPile)
      ? (snap as unknown as { drawPile: string[] }).drawPile
      : [];
    const legacyDiscardPile = 'discardPile' in snap && Array.isArray((snap as unknown as { discardPile?: string[] }).discardPile)
      ? (snap as unknown as { discardPile: string[] }).discardPile
      : [];
    this.ownedCards = [...legacyDrawPile, ...legacyDiscardPile].map((cardId) => ({ cardId, instanceId: this.allocateInstance(cardId) }));
  }

  private allocateInstance(cardId: string): string {
    this.instanceCounter += 1;
    return `${cardId}_inst_${this.instanceCounter}`;
  }

  private buildDeck(): void {
    this.ownedCards = [];
    for (let i = 0; i < this.deckSize; i += 1) {
      const idx = Math.floor(this.rng() * this.pool.length);
      const safeIdx = idx < this.pool.length ? idx : this.pool.length - 1;
      const cardId = this.pool[safeIdx]!;
      this.ownedCards.push({ cardId, instanceId: this.allocateInstance(cardId) });
    }
  }
}
