import { beforeEach, describe, expect, it } from 'vitest';
import { defineQuery, TowerWorld } from '../core/World.js';
import {
  Health,
  Movement,
  Position,
  SpellEffect,
  SpellProjectile,
  UnitTag,
} from '../core/components.js';
import type { Renderer } from '../render/Renderer.js';
import type { RenderCommand } from '../types/index.js';
import { clearDamageObservers, registerDamageObserver } from '../utils/damageUtils.js';
import { SpellProjectileSystem } from './SpellProjectileSystem.js';

const effectQuery = defineQuery([SpellEffect, Position]);

function makeRenderer(): { renderer: Renderer; commands: RenderCommand[] } {
  const commands: RenderCommand[] = [];
  const renderer = {
    push: (cmd: RenderCommand) => commands.push(cmd),
  } as unknown as Renderer;
  return { renderer, commands };
}

function makeEnemy(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 1 });
  world.addComponent(eid, Movement, { speed: 100, currentSpeed: 100 });
  return eid;
}

function reserveEntityZero(world: TowerWorld): void {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: -999, y: -999 });
}

function makeProjectile(world: TowerWorld, spellType: number, duration: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 0, y: 0 });
  world.addComponent(eid, SpellProjectile, {
    spellType,
    targetX: 100,
    targetY: 100,
    startX: 100,
    startY: -100,
    duration,
    elapsed: 0,
    damage: 25,
    radius: 80,
    phase: 0,
  });
  return eid;
}

describe('SpellProjectileSystem', () => {
  beforeEach(() => {
    clearDamageObservers();
  });

  it('delays spell damage numbers until the impact effect frame', () => {
    const world = new TowerWorld();
    const { renderer } = makeRenderer();
    const system = new SpellProjectileSystem(renderer);
    reserveEntityZero(world);
    const enemy = makeEnemy(world, 100, 100);
    makeProjectile(world, 1, 0.5);

    let observedDamage = 0;
    registerDamageObserver((_targetId, _sourceId, actualDamage) => {
      observedDamage += actualDamage;
    });

    system.update(world, 0.25);
    expect(Health.current[enemy]).toBe(100);
    expect(observedDamage).toBe(0);

    system.update(world, 0.25);
    world.cleanupDeadEntities();
    expect(Health.current[enemy]).toBeLessThan(100);
    expect(observedDamage).toBeGreaterThan(0);
    expect(effectQuery(world.world)).toHaveLength(1);
  });

  it('renders arrow rain and blizzard with particle commands only', () => {
    const { renderer, commands } = makeRenderer();
    const world = new TowerWorld();
    const system = new SpellProjectileSystem(renderer);
    makeProjectile(world, 1, 1);
    makeProjectile(world, 2, 1);

    system.update(world, 0.4);

    expect(commands.length).toBeGreaterThan(20);
    expect(commands.some((cmd) => cmd.image)).toBe(false);
    expect(commands.some((cmd) => cmd.shape === 'arrow')).toBe(true);
    expect(commands.some((cmd) => cmd.shape === 'diamond')).toBe(true);
  });
});
