import { describe, expect, it, vi } from 'vitest';
import { hasComponent } from 'bitecs';

import { createTowerWorld, type TowerWorld } from '../../core/World.js';
import { Attack, Health, Position, UnitTag, UnitCategory } from '../../core/components.js';
import { type UnitConfig } from '../../factories/UnitFactory.js';
import { CardRegistry, type CardConfig } from '../CardRegistry.js';
import { CardSpawnSystem } from '../CardSpawnSystem.js';
import { SpellCastSystem } from '../SpellCastSystem.js';

const ARROW_TOWER_UNIT: UnitConfig = {
  id: 'arrow_tower',
  category: 'Tower',
  faction: 'Player',
  stats: { hp: 100, atk: 10, attackSpeed: 1, range: 200, speed: 0 },
  visual: { shape: 'rect', color: 0x5e92f3, size: 24 },
};

const SHIELD_GUARD_UNIT: UnitConfig = {
  id: 'shield_guard',
  category: 'Soldier',
  faction: 'Player',
  stats: { hp: 350, atk: 10, attackSpeed: 0.8, range: 50, speed: 55 },
  visual: { shape: 'rect', color: 0x4dd0e1, size: 32 },
};

const ARROW_TOWER_CARD: CardConfig = {
  id: 'card_arrow_tower',
  type: 'unit',
  energyCost: 3,
  unitConfigId: 'arrow_tower',
};

const FIREBALL_CARD: CardConfig = {
  id: 'card_fireball',
  type: 'spell',
  energyCost: 4,
  spellEffectId: 'cast_fireball',
};

const SHIELD_GUARD_CARD: CardConfig = {
  id: 'shield_guard_card',
  type: 'unit',
  energyCost: 3,
  unitConfigId: 'shield_guard',
};

function makeWorld(): { world: TowerWorld; spell: ReturnType<typeof vi.fn> } {
  const world = createTowerWorld();
  const spell = vi.fn();
  world.ruleEngine.registerHandler('cast_fireball', spell);
  return { world, spell };
}

describe('CardSpawnSystem', () => {
  it('spawns a unit entity when playing a unit card', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(ARROW_TOWER_CARD);
    registry.registerUnit(ARROW_TOWER_UNIT);

    const system = new CardSpawnSystem(registry);
    const eid = system.play(world, 'card_arrow_tower', { x: 100, y: 200 });

    expect(eid).not.toBeNull();
    expect(Position.x[eid!]).toBe(100);
    expect(Position.y[eid!]).toBe(200);
    expect(hasComponent(world, UnitTag, eid!)).toBe(true);
    expect(UnitTag.category[eid!]).toBe(UnitCategory.Tower);
  });

  it('returns null when card id is unknown', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    const system = new CardSpawnSystem(registry);
    const eid = system.play(world, 'card_does_not_exist', { x: 0, y: 0 });
    expect(eid).toBeNull();
  });

  it('applies summon relic modifiers only to player soldier spawns', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(SHIELD_GUARD_CARD);
    registry.registerUnit(SHIELD_GUARD_UNIT);

    const system = new CardSpawnSystem(registry, {
      playerSoldierHpBonus: 40,
      playerSoldierAttackBonus: 6,
    });
    const eid = system.play(world, 'shield_guard_card', { x: 40, y: 60 });

    expect(eid).not.toBeNull();
    expect(UnitTag.category[eid!]).toBe(UnitCategory.Soldier);
    expect(Health.current[eid!]).toBe(390);
    expect(Health.max[eid!]).toBe(390);
    expect(Attack.damage[eid!]).toBe(16);
  });

  it('does not apply summon relic modifiers to non-soldier player spawns', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(ARROW_TOWER_CARD);
    registry.registerUnit(ARROW_TOWER_UNIT);

    const system = new CardSpawnSystem(registry, {
      playerSoldierHpBonus: 40,
      playerSoldierAttackBonus: 6,
    });
    const eid = system.play(world, 'card_arrow_tower', { x: 100, y: 200 });

    expect(eid).not.toBeNull();
    expect(UnitTag.category[eid!]).toBe(UnitCategory.Tower);
    expect(Health.current[eid!]).toBe(100);
    expect(Attack.damage[eid!]).toBe(10);
  });

  it('throws when a unit card references an unregistered unit config', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(ARROW_TOWER_CARD);
    const system = new CardSpawnSystem(registry);

    expect(() => system.play(world, 'card_arrow_tower', { x: 0, y: 0 })).toThrow(/unit config/i);
  });

  it('refuses to spawn when card type is spell (delegate to SpellCastSystem)', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(FIREBALL_CARD);
    const system = new CardSpawnSystem(registry);
    const eid = system.play(world, 'card_fireball', { x: 0, y: 0 });
    expect(eid).toBeNull();
  });
});

describe('SpellCastSystem', () => {
  it('dispatches the spell effect via RuleEngine for spell cards', () => {
    const { world, spell } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(FIREBALL_CARD);

    const system = new SpellCastSystem(registry);
    const ok = system.cast(world, 'card_fireball', { x: 50, y: 75 });

    expect(ok).toBe(true);
    expect(spell).toHaveBeenCalledTimes(1);
    const callArgs = spell.mock.calls[0]!;
    expect(callArgs[1]).toMatchObject({ position: { x: 50, y: 75 } });
    expect(callArgs[2]).toBe(world);
  });

  it('dispatches extra spell casts when spell relic modifiers are present', () => {
    const { world, spell } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(FIREBALL_CARD);

    const system = new SpellCastSystem(registry, { extraCasts: 1 });
    const ok = system.cast(world, 'card_fireball', { x: 64, y: 96 });

    expect(ok).toBe(true);
    expect(spell).toHaveBeenCalledTimes(2);
    expect(spell.mock.calls[0]![1]).toMatchObject({ position: { x: 64, y: 96 }, castIndex: 0, totalCasts: 2 });
    expect(spell.mock.calls[1]![1]).toMatchObject({ position: { x: 64, y: 96 }, castIndex: 1, totalCasts: 2 });
  });

  it('returns false when card id is unknown', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    const system = new SpellCastSystem(registry);
    expect(system.cast(world, 'card_unknown', { x: 0, y: 0 })).toBe(false);
  });

  it('returns false when card type is not spell', () => {
    const { world } = makeWorld();
    const registry = new CardRegistry();
    registry.registerCard(ARROW_TOWER_CARD);
    const system = new SpellCastSystem(registry);
    expect(system.cast(world, 'card_arrow_tower', { x: 0, y: 0 })).toBe(false);
  });

  it('throws when spell handler is not registered on the rule engine', () => {
    const world = createTowerWorld();
    const registry = new CardRegistry();
    registry.registerCard(FIREBALL_CARD);
    const system = new SpellCastSystem(registry);
    expect(() => system.cast(world, 'card_fireball', { x: 0, y: 0 })).toThrow(/handler/i);
  });
});

describe('CardRegistry', () => {
  it('looks up cards by id', () => {
    const registry = new CardRegistry();
    registry.registerCard(ARROW_TOWER_CARD);
    expect(registry.getCard('card_arrow_tower')).toBe(ARROW_TOWER_CARD);
    expect(registry.getCard('missing')).toBeUndefined();
  });

  it('looks up units by id', () => {
    const registry = new CardRegistry();
    registry.registerUnit(ARROW_TOWER_UNIT);
    expect(registry.getUnit('arrow_tower')).toBe(ARROW_TOWER_UNIT);
    expect(registry.getUnit('missing')).toBeUndefined();
  });

  it('rejects duplicate card ids', () => {
    const registry = new CardRegistry();
    registry.registerCard(ARROW_TOWER_CARD);
    expect(() => registry.registerCard(ARROW_TOWER_CARD)).toThrow(/duplicate/i);
  });
});
