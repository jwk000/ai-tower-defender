import { describe, expect, it } from 'vitest';

import { DeckSystem } from '../DeckSystem.js';
import { HandSystem } from '../HandSystem.js';

const POOL = ['arrow_tower', 'shield_guard', 'spike_trap', 'fireball', 'gold_mine'];

function makeDeck(deckSize = 8): DeckSystem {
  let seed = 0;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return new DeckSystem({ pool: POOL, deckSize, rng });
}

describe('HandSystem', () => {
  it('starts empty', () => {
    const hand = new HandSystem({ maxSize: 4 });
    expect(hand.size).toBe(0);
    expect(hand.cards).toEqual([]);
  });

  it('drawTo fills the hand to maxSize from the deck', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
  });

  it('drawOne keeps owned card pool unchanged because draw clones from pool', () => {
    const deck = makeDeck(4);
    const before = deck.drawPileSize;
    const hand = new HandSystem({ maxSize: 4 });

    const result = hand.drawOne(deck);

    expect(result.ok).toBe(true);
    expect(hand.size).toBe(1);
    expect(deck.drawPileSize).toBe(before);
  });

  it('drawTo keeps filling hand while owned card pool remains unchanged', () => {
    const deck = makeDeck(2);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
    expect(deck.drawPileSize).toBe(2);
  });

  it('drawOne rejects when hand is already full', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    expect(hand.drawOne(deck)).toEqual({ ok: false, reason: 'full-hand' });
  });

  it('discardFromHand removes the chosen card and does not change owned card pool', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const beforeOwned = deck.drawPileSize;
    const beforeDiscard = deck.discardPileSize;
    const removed = hand.discardFromHand(0, deck);
    expect(removed).not.toBeNull();
    expect(hand.size).toBe(3);
    expect(deck.drawPileSize).toBe(beforeOwned);
    expect(deck.discardPileSize).toBe(beforeDiscard);
  });

  it('playCard with out-of-range index returns null', () => {
    const hand = new HandSystem({ maxSize: 4 });
    expect(hand.playCard(0)).toBeNull();
    expect(hand.playCard(-1)).toBeNull();
  });

  it('when hand is full, drawTo routes overflow cards into the deck discard', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const before = deck.discardPileSize;

    hand.drawTo(deck);
    expect(deck.discardPileSize).toBe(before);
    expect(hand.size).toBe(4);
  });

  it('rejects non-positive maxSize', () => {
    expect(() => new HandSystem({ maxSize: 0 })).toThrow(/maxSize/i);
  });

  it('cards getter returns a defensive copy', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const snapshot = hand.cards;
    snapshot.length = 0;
    expect(hand.size).toBe(4);
  });

  it('clear empties the hand without touching the deck', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const drawBefore = deck.drawPileSize;
    const discardBefore = deck.discardPileSize;

    hand.clear();
    expect(hand.size).toBe(0);
    expect(deck.drawPileSize).toBe(drawBefore);
    expect(deck.discardPileSize).toBe(discardBefore);
  });
});
