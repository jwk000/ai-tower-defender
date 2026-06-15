import { describe, expect, it } from 'vitest';
import { defineQuery } from 'bitecs';
import { TowerWorld, type System } from './World.js';
import { Position } from './components.js';

const positionQuery = defineQuery([Position]);

describe('TowerWorld.clearEntities', () => {
  it('清空实体但保留系统和 runContext', () => {
    const world = new TowerWorld();
    const system: System = {
      name: 'TestSystem',
      update: () => {},
    };
    world.registerSystem(system);
    world.attachRunContext({ marker: 'battle' });

    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 12, y: 34 });

    expect(positionQuery(world.world)).toContain(eid);

    world.clearEntities();

    expect(positionQuery(world.world)).toHaveLength(0);
    expect(world.systems).toEqual([system]);
    expect(world.runContext).toEqual({ marker: 'battle' });
  });
});
