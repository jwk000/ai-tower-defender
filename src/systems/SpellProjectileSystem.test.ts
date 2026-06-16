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
import { RenderSystem } from './RenderSystem.js';
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

function makeAlly(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 0 });
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

  it('earthquake damages every enemy once per second and jitters board tiles', () => {
    const { renderer, commands } = makeRenderer();
    const world = new TowerWorld();
    const system = new SpellProjectileSystem(renderer);
    reserveEntityZero(world);
    RenderSystem.sceneOffsetX = 100;
    RenderSystem.sceneOffsetY = 80;
    RenderSystem.sceneW = 640;
    RenderSystem.sceneH = 384;

    const enemyA = makeEnemy(world, 120, 100);
    Health.current[enemyA] = 350;
    Health.max[enemyA] = 350;
    const enemyB = makeEnemy(world, 700, 430);
    Health.current[enemyB] = 350;
    Health.max[enemyB] = 350;
    const ally = makeAlly(world, 300, 220);

    system.spawnGlobalEffect(world, 4, 100, 3);

    system.update(world, 0.5);
    expect(Health.current[enemyA]).toBe(350);
    expect(Health.current[enemyB]).toBe(350);
    expect(Health.current[ally]).toBe(100);

    system.update(world, 0.5);
    expect(Health.current[enemyA]).toBe(250);
    expect(Health.current[enemyB]).toBe(250);
    expect(Health.current[ally]).toBe(100);
    expect(RenderSystem.tileJitter.intensity).toBeGreaterThan(0);
    expect(commands.some((cmd) => cmd.shape === 'rect' && cmd.color === '#1b0f0a')).toBe(true);

    system.update(world, 1.0);
    expect(Health.current[enemyA]).toBe(150);
    expect(Health.current[enemyB]).toBe(150);

    system.update(world, 1.0);
    expect(Health.current[enemyA]).toBe(50);
    expect(Health.current[enemyB]).toBe(50);
    expect(Health.current[ally]).toBe(100);
  });

  it('blizzard is a 5-second global spell that damages all enemies once and slows them', () => {
    const { renderer, commands } = makeRenderer();
    const world = new TowerWorld();
    const system = new SpellProjectileSystem(renderer);
    reserveEntityZero(world);
    RenderSystem.sceneOffsetX = 100;
    RenderSystem.sceneOffsetY = 80;
    RenderSystem.sceneW = 640;
    RenderSystem.sceneH = 384;

    const enemyA = makeEnemy(world, 120, 100);
    const enemyB = makeEnemy(world, 700, 430);
    const ally = makeAlly(world, 300, 220);

    system.spawnGlobalEffect(world, 2, 45, 5);

    system.update(world, 0.1);
    expect(Health.current[enemyA]).toBe(55);
    expect(Health.current[enemyB]).toBe(55);
    expect(Health.current[ally]).toBe(100);
    expect(Movement.speed[enemyA]).toBe(70);
    expect(Movement.speed[enemyB]).toBe(70);
    expect(effectQuery(world.world)).toHaveLength(1);
    expect(commands.some((cmd) => cmd.shape === 'rect' && cmd.color === '#90caf9')).toBe(true);

    system.update(world, 2.4);
    expect(Health.current[enemyA]).toBe(55);
    expect(Health.current[enemyB]).toBe(55);
    expect(effectQuery(world.world)).toHaveLength(1);

    system.update(world, 2.5);
    world.cleanupDeadEntities();
    expect(effectQuery(world.world)).toHaveLength(0);
  });
});
