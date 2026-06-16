import { describe, expect, it } from 'vitest';
import { TowerType, UnitType } from '../types/index.js';
import { isSelfTargetSpell, resolveCardToEntityType } from './LayoutConstants.js';

describe('resolveCardToEntityType', () => {
  it('resolves YAML soldier card IDs to unit types', () => {
    expect(resolveCardToEntityType('swordsman_card')).toEqual({
      entityType: 'unit',
      unitType: UnitType.Swordsman,
    });
  });

  it('resolves YAML tower card IDs to tower types', () => {
    expect(resolveCardToEntityType('arrow_tower_card')).toEqual({
      entityType: 'tower',
      towerType: TowerType.Arrow,
    });
  });

  it('keeps direct unit config IDs supported', () => {
    expect(resolveCardToEntityType('swordsman')).toEqual({
      entityType: 'unit',
      unitType: UnitType.Swordsman,
    });
  });

  it('keeps full-screen damage spells drag-released on the board instead of click-cast', () => {
    expect(isSelfTargetSpell('gold_rush')).toBe(false);
    expect(isSelfTargetSpell('blizzard')).toBe(false);
    expect(isSelfTargetSpell('earthquake')).toBe(false);
  });
});
