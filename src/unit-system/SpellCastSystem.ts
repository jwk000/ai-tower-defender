import type { TowerWorld } from '../core/World.js';
import type { CardRegistry } from './CardRegistry.js';

export interface SpellCastPosition {
  readonly x: number;
  readonly y: number;
}

export interface SpellCastModifiers {
  readonly extraCasts?: number;
}

export class SpellCastSystem {
  constructor(
    private readonly registry: CardRegistry,
    private readonly modifiers: SpellCastModifiers = {},
  ) {}

  cast(world: TowerWorld, cardId: string, position: SpellCastPosition): boolean {
    const card = this.registry.getCard(cardId);
    if (!card) return false;
    if (card.type !== 'spell') return false;

    if (!card.spellEffectId) {
      throw new Error(`[SpellCastSystem] card "${cardId}" has no spellEffectId`);
    }
    const handler = world.ruleEngine.getHandler(card.spellEffectId);
    if (!handler) {
      throw new Error(`[SpellCastSystem] handler "${card.spellEffectId}" not registered`);
    }
    const totalCasts = 1 + Math.max(0, this.modifiers.extraCasts ?? 0);
    for (let castIndex = 0; castIndex < totalCasts; castIndex += 1) {
      handler(-1, { position, castIndex, totalCasts }, world);
    }
    return true;
  }
}
