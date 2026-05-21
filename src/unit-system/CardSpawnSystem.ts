import { spawnUnit, type SpawnUnitMeta } from '../factories/UnitFactory.js';
import type { TowerWorld } from '../core/World.js';
import type { CardRegistry } from './CardRegistry.js';

const SPAWNABLE_CARD_TYPES = new Set(['unit', 'trap', 'production']);

export interface SpawnPosition {
  readonly x: number;
  readonly y: number;
}

export interface CardSpawnModifiers {
  readonly playerSoldierHpBonus?: number;
  readonly playerSoldierAttackBonus?: number;
}

export class CardSpawnSystem {
  constructor(
    private readonly registry: CardRegistry,
    private readonly modifiers: CardSpawnModifiers = {},
  ) {}

  play(world: TowerWorld, cardId: string, position: SpawnPosition): number | null {
    const card = this.registry.getCard(cardId);
    if (!card) return null;
    if (!SPAWNABLE_CARD_TYPES.has(card.type)) return null;

    if (!card.unitConfigId) {
      throw new Error(`[CardSpawnSystem] card "${cardId}" has no unitConfigId`);
    }
    const unit = this.registry.getUnit(card.unitConfigId);
    if (!unit) {
      throw new Error(`[CardSpawnSystem] unit config "${card.unitConfigId}" not registered`);
    }
    return spawnUnit(world, unit, position, {
      sourceCardId: cardId,
      playerSoldierHpBonus: this.modifiers.playerSoldierHpBonus,
      playerSoldierAttackBonus: this.modifiers.playerSoldierAttackBonus,
    } satisfies SpawnUnitMeta);
  }
}
