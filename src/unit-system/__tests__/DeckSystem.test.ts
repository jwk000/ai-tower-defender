import { describe, expect, it } from 'vitest';

import { DeckSystem } from '../DeckSystem.js';

const STARTER_DECK = ['arrow_tower_card', 'shield_guard_card', 'spike_trap_card', 'fireball_card'] as const;
const POOL = ['arrow_tower', 'shield_guard', 'spike_trap', 'fireball', 'gold_mine'];

function makeRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const v = sequence[i % sequence.length] ?? 0;
    i += 1;
    return v;
  };
}

describe('DeckSystem', () => {
  it('builds an owned pool of the configured size by sampling the pool with the injected RNG', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 5, rng: makeRng([0, 0.25, 0.5, 0.75, 0.99]) });
    expect(deck.drawPileSize).toBe(5);
    expect(deck.discardPileSize).toBe(0);
  });

  it('drawCard returns a card copy without consuming the owned pool', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0]) });
    const expected = [...deck.previewDrawPile()];
    const first = deck.drawCard();
    expect(first).toBe(expected[0]);
    expect(deck.drawPileSize).toBe(3);
  });

  it('drawCard returns null when the owned pool is empty', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 1, rng: makeRng([0]) });
    deck.removeInstance(deck.getCardInstances()[0]!.instanceId);
    expect(deck.drawCard()).toBeNull();
  });

  it('discard is a no-op under clone draw model', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const drawn = deck.drawCard()!;
    deck.discard(drawn);
    expect(deck.discardPileSize).toBe(0);
    expect(deck.drawPileSize).toBe(3);
  });

  it('draw results are deterministic given the same RNG seed', () => {
    const deckA = new DeckSystem({
      pool: POOL,
      deckSize: 3,
      rng: makeRng([0.1, 0.3, 0.6]),
    });
    const deckB = new DeckSystem({
      pool: POOL,
      deckSize: 3,
      rng: makeRng([0.1, 0.3, 0.6]),
    });
    const seqA = [deckA.drawCard(), deckA.drawCard(), deckA.drawCard()];
    const seqB = [deckB.drawCard(), deckB.drawCard(), deckB.drawCard()];
    expect(seqA).toEqual(seqB);
  });

  it('rejects an empty pool', () => {
    expect(() => new DeckSystem({ pool: [], deckSize: 3, rng: () => 0 })).toThrow(/empty pool/i);
  });

  it('rejects a non-positive deckSize', () => {
    expect(() => new DeckSystem({ pool: POOL, deckSize: 0, rng: () => 0 })).toThrow(/deckSize/i);
  });

  it('previewDrawPile returns a copy that does not mutate the deck', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const preview = deck.previewDrawPile();
    preview.length = 0;
    expect(deck.drawPileSize).toBe(3);
  });

  it('reset rebuilds the owned pool from scratch', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.3, 0.6, 0.1, 0.4, 0.7]) });
    deck.addCard('bonus');
    deck.reset();
    expect(deck.drawPileSize).toBe(3);
    expect(deck.discardPileSize).toBe(0);
  });

  it('initWithCards can seed the exact four starter cards into owned pool for run start', () => {
    const deck = new DeckSystem({ pool: STARTER_DECK, deckSize: STARTER_DECK.length, rng: makeRng([0]) });

    deck.initWithCards(STARTER_DECK);

    expect(deck.previewDrawPile()).toEqual([...STARTER_DECK]);
    expect(deck.drawPileSize).toBe(4);
    expect(deck.discardPileSize).toBe(0);
  });

  it('addCard appends a rewarded card into owned pool with an instance id', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });

    const beforeOwned = deck.drawPileSize;
    const added = deck.addCard('reward_fireball');

    expect(added).toMatchObject({ cardId: 'reward_fireball' });
    expect(added.instanceId).toMatch(/^reward_fireball_inst_\d+$/);
    expect(deck.drawPileSize).toBe(beforeOwned + 1);
    expect(deck.getCardInstances()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: added.instanceId, cardId: 'reward_fireball' }),
      ]),
    );
  });

  it('addCard allows duplicate card ids because owned pool can contain multiple copies', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const existing = deck.previewDrawPile()[0]!;

    expect(() => deck.addCard(existing)).not.toThrow();
  });

  it('removeInstance removes a specific owned card instance without disturbing others', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });

    const first = deck.addCard('reward_fireball');
    const second = deck.addCard('reward_iceball');

    expect(deck.removeInstance(first.instanceId)).toBe(true);
    expect(deck.removeInstance(first.instanceId)).toBe(false);
    expect(deck.getCardInstances()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: first.instanceId }),
      ]),
    );
    expect(deck.getCardInstances()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: second.instanceId, cardId: 'reward_iceball' }),
      ]),
    );
  });

  it('restoreFrom preserves snapshots that contain duplicate card ids from legacy decks', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });

    expect(() => deck.restoreFrom({
      drawPile: ['arrow_tower'],
      discardPile: ['arrow_tower'],
    } as never)).not.toThrow();
  });

  it('removeInstance can delete an owned card instance by id', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const target = deck.getCardInstances()[0];

    expect(target).toBeDefined();
    expect(deck.removeInstance(target!.instanceId)).toBe(true);
    expect(deck.drawPileSize).toBe(2);
    expect(deck.getCardInstances()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: target!.instanceId }),
      ]),
    );
  });
});
