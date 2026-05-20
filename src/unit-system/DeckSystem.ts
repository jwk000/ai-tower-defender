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

export interface AddedDeckCard {
  readonly cardId: string;
  readonly instanceId: string;
  readonly pile: 'discard';
}

export interface DeckSnapshot {
  readonly drawPile: string[];
  readonly discardPile: string[];
  readonly drawPileInstances?: string[];
  readonly discardPileInstances?: string[];
}

function ensureUniqueCardIds(cardIds: readonly string[], source: string): void {
  const seen = new Set<string>();
  for (const cardId of cardIds) {
    if (seen.has(cardId)) {
      throw new Error(`[DeckSystem] duplicate cardId "${cardId}" in ${source}`);
    }
    seen.add(cardId);
  }
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

  addCard(cardId: string): AddedDeckCard {
    if (this.hasCard(cardId)) {
      throw new Error(`[DeckSystem] duplicate cardId "${cardId}" already exists in deck`);
    }
    const instanceId = this.allocateInstance(cardId);
    this.discardPile.push(cardId);
    this.discardPileInstances.push(instanceId);
    return { cardId, instanceId, pile: 'discard' };
  }

  removeInstance(instanceId: string): boolean {
    const drawIndex = this.drawPileInstances.indexOf(instanceId);
    if (drawIndex >= 0) {
      this.drawPile.splice(drawIndex, 1);
      this.drawPileInstances.splice(drawIndex, 1);
      this.instanceCardMap.delete(instanceId);
      return true;
    }

    const discardIndex = this.discardPileInstances.indexOf(instanceId);
    if (discardIndex >= 0) {
      this.discardPile.splice(discardIndex, 1);
      this.discardPileInstances.splice(discardIndex, 1);
      this.instanceCardMap.delete(instanceId);
      return true;
    }

    return false;
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

  initWithCards(cards: readonly string[]): void {
    if (cards.length === 0) {
      throw new Error('[DeckSystem] initWithCards: cards must not be empty');
    }
    ensureUniqueCardIds(cards, 'initWithCards');
    this.drawPile = [];
    this.drawPileInstances = [];
    this.discardPile = [];
    this.discardPileInstances = [];
    for (const cardId of cards) {
      this.drawPile.push(cardId);
      this.drawPileInstances.push(this.allocateInstance(cardId));
    }
  }

  reset(): void {
    this.discardPile = [];
    this.discardPileInstances = [];
    this.buildDeck();
  }

  snapshot(): DeckSnapshot {
    return {
      drawPile: [...this.drawPile],
      discardPile: [...this.discardPile],
      drawPileInstances: [...this.drawPileInstances],
      discardPileInstances: [...this.discardPileInstances],
    };
  }

  restoreFrom(snap: DeckSnapshot): void {
    this.drawPile = [...snap.drawPile];
    this.discardPile = [...snap.discardPile];
    this.drawPileInstances = this.restoreInstances(this.drawPile, snap.drawPileInstances);
    this.discardPileInstances = this.restoreInstances(this.discardPile, snap.discardPileInstances);
    this.rebaseInstanceCounter();
  }

  private hasCard(cardId: string): boolean {
    return this.drawPile.includes(cardId) || this.discardPile.includes(cardId);
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

  private restoreInstances(cards: readonly string[], savedInstances: readonly string[] | undefined): string[] {
    if (savedInstances && savedInstances.length === cards.length) {
      for (let i = 0; i < cards.length; i += 1) {
        this.instanceCardMap.set(savedInstances[i]!, cards[i]!);
      }
      return [...savedInstances];
    }
    return cards.map((cardId) => this.allocateInstance(cardId));
  }

  private rebaseInstanceCounter(): void {
    const allInstances = [...this.drawPileInstances, ...this.discardPileInstances];
    let maxCounter = this.instanceCounter;
    for (const instanceId of allInstances) {
      const match = instanceId.match(/_inst_(\d+)$/);
      if (!match) continue;
      maxCounter = Math.max(maxCounter, Number(match[1]));
    }
    this.instanceCounter = maxCounter;
  }
}
