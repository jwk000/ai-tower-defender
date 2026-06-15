import { describe, expect, it } from 'vitest';

import { TowerWorld, defineQuery } from '../core/World.js';
import {
  DamageNumber,
  DamageNumberStyle,
  Health,
  Position,
} from '../core/components.js';
import { DamageNumberSystem } from './DamageNumberSystem.js';

const damageNumberQuery = defineQuery([Position, DamageNumber]);

describe('DamageNumberSystem', () => {
  function createTarget(world: TowerWorld, hp: number): number {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 120, y: 180 });
    world.addComponent(eid, Health, {
      current: hp,
      max: 100,
      armor: 0,
      magicResist: 0,
    });
    return eid;
  }

  it('目标仍存活时生成伤害飘字', () => {
    const world = new TowerWorld();
    const system = new DamageNumberSystem();
    const target = createTarget(world, 50);

    system.spawnAtTarget(world, target, 12, DamageNumberStyle.Physical);

    const entities = damageNumberQuery(world.world);
    expect(entities).toHaveLength(1);
    expect(DamageNumber.value[entities[0]!]).toBe(12);
  });

  it('目标已死亡时不再生成新的伤害飘字', () => {
    const world = new TowerWorld();
    const system = new DamageNumberSystem();
    const target = createTarget(world, 0);

    system.spawnAtTarget(world, target, 12, DamageNumberStyle.Physical);

    expect(damageNumberQuery(world.world)).toHaveLength(0);
  });

  it('目标已经清理后不再生成新的伤害飘字', () => {
    const world = new TowerWorld();
    const system = new DamageNumberSystem();
    const target = createTarget(world, 50);
    world.destroyEntity(target);
    world.cleanupDeadEntities();

    system.spawnAtTarget(world, target, 12, DamageNumberStyle.Physical);

    expect(damageNumberQuery(world.world)).toHaveLength(0);
  });
});
