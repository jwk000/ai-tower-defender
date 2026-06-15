import { describe, expect, it } from 'vitest';
import { entityExists } from '../core/World.js';
import { TowerWorld } from '../core/World.js';
import { Faction, FactionVal, Health, LaserBeam, Position, Visual } from '../core/components.js';
import { LaserBeamSystem } from './LaserBeamSystem.js';

function mockRenderer() {
  return {
    context: {
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
      set globalAlpha(_value: number) {},
      set strokeStyle(_value: string) {},
      set lineWidth(_value: number) {},
      set lineCap(_value: CanvasLineCap) {},
    },
  };
}

describe('LaserBeamSystem', () => {
  it('目标死亡时立即销毁光束，不保留残留线', () => {
    const world = new TowerWorld();
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });

    const targetId = world.createEntity();
    world.addComponent(targetId, Position, { x: 100, y: 0 });
    world.addComponent(targetId, Health, { current: 0, max: 100, armor: 0, magicResist: 0 });
    world.addComponent(targetId, Visual, { shape: 0, colorR: 255, colorG: 255, colorB: 255, size: 20, alpha: 1, hitFlashTimer: 0 });

    const beamId = world.createEntity();
    world.addComponent(beamId, LaserBeam, {
      sourceId: towerId,
      targetId,
      damage: 1,
      maxDamage: 6,
      duration: 5,
      elapsed: 0,
    });
    world.registerSystem(new LaserBeamSystem(mockRenderer() as any));

    world.update(0.01);

    expect(entityExists(world.world, beamId)).toBe(false);
  });
});
