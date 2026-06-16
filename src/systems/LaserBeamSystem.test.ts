import { beforeEach, describe, expect, it, vi } from 'vitest';
import { entityExists } from '../core/World.js';
import { TowerWorld } from '../core/World.js';
import { Attack, DamageTypeVal, Faction, FactionVal, Health, LaserBeam, Layer, LayerVal, Position, Visual } from '../core/components.js';
import { LaserBeamSystem } from './LaserBeamSystem.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';

vi.mock('../utils/damageUtils.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('光束伤害从50%开始，并在2秒内提升到最大攻击力', () => {
    const world = new TowerWorld();
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Layer, { value: LayerVal.Ground });
    world.addComponent(towerId, Attack, {
      damage: 20,
      attackSpeed: 0.5,
      range: 250,
      alertRange: 500,
      damageType: DamageTypeVal.Magic,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      isRanged: 1,
      canTargetLowAir: 1,
    });

    const targetId = world.createEntity();
    world.addComponent(targetId, Position, { x: 100, y: 0 });
    world.addComponent(targetId, Faction, { value: FactionVal.Evil });
    world.addComponent(targetId, Layer, { value: LayerVal.Ground });
    world.addComponent(targetId, Health, { current: 1000, max: 1000, armor: 0, magicResist: 0 });
    world.addComponent(targetId, Visual, { shape: 0, colorR: 255, colorG: 255, colorB: 255, size: 20, alpha: 1, hitFlashTimer: 0 });

    const beamId = world.createEntity();
    world.addComponent(beamId, LaserBeam, {
      sourceId: towerId,
      targetId,
      damage: 10,
      maxDamage: 20,
      duration: 5,
      elapsed: 0,
    });

    world.registerSystem(new LaserBeamSystem(mockRenderer() as any));

    const damageMock = vi.mocked(applyDamageToTarget);

    world.update(0.25);
    expect(damageMock).toHaveBeenCalledTimes(1);
    expect(damageMock.mock.calls[0]![1]).toBe(targetId);
    expect(damageMock.mock.calls[0]![2]).toBeCloseTo(10.16015625);

    world.update(1.75);
    expect(damageMock.mock.calls.at(-1)![1]).toBe(targetId);
    expect(damageMock.mock.calls.at(-1)![2]).toBeCloseTo(20);
  });
});
