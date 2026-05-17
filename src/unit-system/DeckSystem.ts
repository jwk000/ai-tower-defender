export interface DeckSystemConfig {
  readonly pool: readonly string[];
  readonly deckSize: number;
  readonly rng: () => number;
}

export interface CardInstance {
  readonly instanceId: string;
  readonly cardId: string;
  readonly pile: 'draw' | 'discard' | 'hand';
}

export class DeckSystem {
  private readonly pool: readonly string[];
  private readonly deckSize: number;
  private readonly rng: () => number;
  private drawPile: string[] = [];
  private discardPile: string[] = [];
  private instanceCounter = 0;
  private drawPileInstances: string[] = [];
  private discardPileInstances: string[] = [];
  private readonly instanceCardMap: Map<string, string> = new Map();

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
    return this.drawPile.length;
  }

  get discardPileSize(): number {
    return this.discardPile.length;
  }

  drawCard(): string | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.reshuffle();
    }
    this.drawPileInstances.shift();
    return this.drawPile.shift() ?? null;
  }

  discard(card: string): void {
    this.discardPile.push(card);
    const instId = this.allocateInstance(card);
    this.discardPileInstances.push(instId);
  }

  previewDrawPile(): string[] {
    return [...this.drawPile];
  }

  getCardInstances(): CardInstance[] {
    const result: CardInstance[] = [];
    for (let i = 0; i < this.drawPile.length; i += 1) {
      const cardId = this.drawPile[i]!;
      const instanceId = this.drawPileInstances[i] ?? this.allocateInstance(cardId);
      result.push({ instanceId, cardId, pile: 'draw' });
    }
    for (let i = 0; i < this.discardPile.length; i += 1) {
      const cardId = this.discardPile[i]!;
      const instanceId = this.discardPileInstances[i] ?? this.allocateInstance(cardId);
      result.push({ instanceId, cardId, pile: 'discard' });
    }
    return result;
  }

  reset(): void {
    this.discardPile = [];
    this.discardPileInstances = [];
    this.buildDeck();
  }

  snapshot(): { drawPile: string[]; discardPile: string[] } {
    return { drawPile: [...this.drawPile], discardPile: [...this.discardPile] };
  }

  restoreFrom(snap: { drawPile: string[]; discardPile: string[] }): void {
    this.drawPile = [...snap.drawPile];
    this.discardPile = [...snap.discardPile];
    this.drawPileInstances = this.drawPile.map((c) => this.allocateInstance(c));
    this.discardPileInstances = this.discardPile.map((c) => this.allocateInstance(c));
  }

  private allocateInstance(cardId: string): string {
    this.instanceCounter += 1;
    const id = `${cardId}_inst_${this.instanceCounter}`;
    this.instanceCardMap.set(id, cardId);
    return id;
  }

  private buildDeck(): void {
    this.drawPile = [];
    this.drawPileInstances = [];
    for (let i = 0; i < this.deckSize; i += 1) {
      const idx = Math.floor(this.rng() * this.pool.length);
      const safeIdx = idx < this.pool.length ? idx : this.pool.length - 1;
      const cardId = this.pool[safeIdx]!;
      this.drawPile.push(cardId);
      this.drawPileInstances.push(this.allocateInstance(cardId));
    }
  }

  private reshuffle(): void {
    const arr = this.discardPile;
    const instArr = this.discardPileInstances;
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      const safeJ = j <= i ? j : i;
      const tmp = arr[i]!;
      arr[i] = arr[safeJ]!;
      arr[safeJ] = tmp;
      const tmpInst = instArr[i]!;
      instArr[i] = instArr[safeJ]!;
      instArr[safeJ] = tmpInst;
    }
    this.drawPile = arr;
    this.drawPileInstances = instArr;
    this.discardPile = [];
    this.discardPileInstances = [];
  }
}
