import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineQuery, hasComponent, TowerWorld } from '../core/World.js';
import {
  Health,
  Movement,
  Position,
  ScreenShake,
  SpellEffect,
  SpellProjectile,
  Soldier,
  Tower,
  UnitTag,
} from '../core/components.js';
import type { Renderer } from '../render/Renderer.js';
import type { RenderCommand } from '../types/index.js';
import { clearDamageObservers, registerDamageObserver } from '../utils/damageUtils.js';
import { Sound } from '../utils/Sound.js';
import { RenderSystem } from './RenderSystem.js';
import { SpellProjectileSystem } from './SpellProjectileSystem.js';

const effectQuery = defineQuery([SpellEffect, Position]);
const shakeQuery = defineQuery([ScreenShake]);

function makeRenderer(): { renderer: Renderer; commands: RenderCommand[] } {
  const commands: RenderCommand[] = [];
  const renderer = {
    push: (cmd: RenderCommand) => commands.push(cmd),
  } as unknown as Renderer;
  return { renderer, commands };
}

function makeEnemy(world: TowerWorld, x: number, y: number, hp = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 1 });
  world.addComponent(eid, Movement, { speed: 100, currentSpeed: 100 });
  return eid;
}

function makeAllySoldier(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 0 });
  world.addComponent(eid, Movement, { speed: 100, currentSpeed: 100 });
  world.addComponent(eid, Soldier, {
    state: 0,
    homeX: x,
    homeY: y,
    moveRange: 100,
    attackTarget: 0,
    stateTimer: 0,
  });
  return eid;
}

function makeAllyTower(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 0 });
  world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 50 });
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
    vi.restoreAllMocks();
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

    system.update(world, 0.49);
    expect(Health.current[enemy]).toBe(100);
    expect(observedDamage).toBe(0);

    system.update(world, 0.01);
    world.cleanupDeadEntities();
    expect(Health.current[enemy]).toBe(100);
    expect(observedDamage).toBe(0);
    expect(effectQuery(world.world)).toHaveLength(1);

    system.update(world, 0.23);
    expect(Health.current[enemy]).toBe(100);
    expect(observedDamage).toBe(0);

    system.update(world, 0.01);
    expect(Health.current[enemy]).toBeLessThan(100);
    expect(observedDamage).toBeGreaterThan(0);
    expect(effectQuery(world.world)).toHaveLength(1);
  });

  it('arrow rain deals two 25-damage waves that kill low-air small enemies', () => {
    const world = new TowerWorld();
    const { renderer } = makeRenderer();
    const system = new SpellProjectileSystem(renderer);
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    reserveEntityZero(world);
    const vampireBat = makeEnemy(world, 100, 100, 40);
    const drone = makeEnemy(world, 130, 100, 30);
    const sturdyEnemy = makeEnemy(world, 155, 100, 80);
    makeProjectile(world, 1, 0.5);

    const damageEvents: Array<{ targetId: number; actualDamage: number }> = [];
    registerDamageObserver((targetId, _sourceId, actualDamage) => {
      damageEvents.push({ targetId, actualDamage });
    });

    system.update(world, 0.49);
    expect(Health.current[vampireBat]).toBe(40);
    expect(Health.current[drone]).toBe(30);
    expect(playSpy).not.toHaveBeenCalledWith('skill_arrow_rain');

    system.update(world, 0.01);
    world.cleanupDeadEntities();
    expect(Health.current[vampireBat]).toBe(40);
    expect(Health.current[drone]).toBe(30);
    expect(damageEvents).toHaveLength(0);
    expect(playSpy).not.toHaveBeenCalledWith('skill_arrow_rain');

    system.update(world, 0.24);
    expect(Health.current[vampireBat]).toBe(15);
    expect(Health.current[drone]).toBe(5);
    expect(Health.current[sturdyEnemy]).toBe(55);
    expect(damageEvents.filter((event) => event.targetId === vampireBat)).toHaveLength(1);
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).toHaveBeenLastCalledWith('skill_arrow_rain');

    system.update(world, 0.45);
    world.cleanupDeadEntities();
    expect(Health.current[vampireBat]).toBeLessThanOrEqual(0);
    expect(Health.current[drone]).toBeLessThanOrEqual(0);
    expect(Health.current[sturdyEnemy]).toBe(30);
    expect(damageEvents.filter((event) => event.targetId === vampireBat)).toHaveLength(2);
    expect(damageEvents.filter((event) => event.targetId === drone)).toHaveLength(2);
    expect(damageEvents.filter((event) => event.targetId === sturdyEnemy)).toHaveLength(2);
    expect(playSpy).toHaveBeenCalledTimes(2);
    expect(playSpy).toHaveBeenLastCalledWith('skill_arrow_rain');
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

  it('renders arrow rain as slim red diagonal arrows with trails in both waves', () => {
    const { renderer, commands } = makeRenderer();
    const world = new TowerWorld();
    const system = new SpellProjectileSystem(renderer);
    makeProjectile(world, 1, 0.5);

    system.update(world, 0.4);
    const fallingArrows = commands.filter((cmd) => cmd.shape === 'arrow' && cmd.color === '#d32f2f');
    expect(fallingArrows.length).toBeGreaterThan(0);
    expect(fallingArrows.every((cmd) => cmd.arrowShaftWidthRatio === 0.08)).toBe(true);
    expect(fallingArrows.every((cmd) => cmd.arrowHeadWidthRatio === 0.26)).toBe(true);
    expect(fallingArrows.every((cmd) => cmd.arrowLengthScale === 1.45)).toBe(true);
    expect(fallingArrows.every((cmd) => (cmd.targetX ?? cmd.x) > cmd.x && (cmd.targetY ?? cmd.y) > cmd.y)).toBe(true);
    expect(commands.some((cmd) => (
      cmd.shape === 'rect' &&
      cmd.color === '#ffcdd2' &&
      cmd.alpha !== undefined &&
      cmd.alpha < 0.3
    ))).toBe(true);

    commands.length = 0;
    system.update(world, 0.1);
    world.cleanupDeadEntities();
    system.update(world, 0.1);
    const firstWaveArrows = commands.filter((cmd) => cmd.shape === 'arrow' && cmd.color === '#d32f2f');
    expect(firstWaveArrows.length).toBeGreaterThan(0);

    commands.length = 0;
    system.update(world, 0.45);
    const secondWaveArrows = commands.filter((cmd) => cmd.shape === 'arrow' && cmd.color === '#d32f2f');
    expect(secondWaveArrows.length).toBeGreaterThan(0);
    expect(secondWaveArrows.every((cmd) => (cmd.targetX ?? cmd.x) > cmd.x && (cmd.targetY ?? cmd.y) > cmd.y)).toBe(true);
  });

  it('earthquake damages all units once per second, lightly jitters tiles, and triggers sustained shake audio', () => {
    const { renderer, commands } = makeRenderer();
    const world = new TowerWorld();
    const system = new SpellProjectileSystem(renderer);
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
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
    const ally = makeAllySoldier(world, 300, 220);
    Health.current[ally] = 350;
    Health.max[ally] = 350;

    system.spawnGlobalEffect(world, 4, 100, 3);
    const shakeId = shakeQuery(world.world)[0]!;
    expect(ScreenShake.intensity[shakeId]).toBe(12);
    expect(ScreenShake.duration[shakeId]).toBe(3);
    expect(ScreenShake.frequency[shakeId]).toBe(20);
    expect(playSpy).toHaveBeenCalledWith('skill_earthquake');

    system.update(world, 0.5);
    expect(Health.current[enemyA]).toBe(350);
    expect(Health.current[enemyB]).toBe(350);
    expect(Health.current[ally]).toBe(350);

    system.update(world, 0.5);
    expect(Health.current[enemyA]).toBe(250);
    expect(Health.current[enemyB]).toBe(250);
    expect(Health.current[ally]).toBe(250);
    expect(RenderSystem.tileJitter.intensity).toBeGreaterThan(0);
    expect(RenderSystem.tileJitter.intensity).toBeLessThanOrEqual(6.1);
    expect(commands.some((cmd) => cmd.shape === 'rect' && cmd.color === '#1b0f0a')).toBe(true);

    system.update(world, 1.0);
    expect(Health.current[enemyA]).toBe(150);
    expect(Health.current[enemyB]).toBe(150);
    expect(Health.current[ally]).toBe(150);

    system.update(world, 1.0);
    expect(Health.current[enemyA]).toBe(50);
    expect(Health.current[enemyB]).toBe(50);
    expect(Health.current[ally]).toBe(50);
  });

  it('blizzard is a 5-second left-to-right global spell that damages enemies and allied soldiers once per second without damaging towers', () => {
    const { renderer, commands } = makeRenderer();
    const world = new TowerWorld();
    const system = new SpellProjectileSystem(renderer);
    reserveEntityZero(world);
    RenderSystem.sceneOffsetX = 100;
    RenderSystem.sceneOffsetY = 80;
    RenderSystem.sceneW = 640;
    RenderSystem.sceneH = 384;

    const enemyA = makeEnemy(world, 120, 100, 300);
    const enemyB = makeEnemy(world, 700, 430, 300);
    const allySoldier = makeAllySoldier(world, 300, 220);
    const allyTower = makeAllyTower(world, 340, 220);
    const enemyAStartX = Position.x[enemyA]!;
    const enemyBStartX = Position.x[enemyB]!;
    const allyStartX = Position.x[allySoldier]!;

    system.spawnGlobalEffect(world, 2, 45, 5);

    system.update(world, 0.1);
    expect(Health.current[enemyA]).toBe(255);
    expect(Health.current[enemyB]).toBe(255);
    expect(Health.current[allySoldier]).toBe(55);
    expect(Health.current[allyTower]).toBe(100);
    expect(Position.x[enemyA]).toBe(enemyAStartX);
    expect(Position.x[enemyB]).toBe(enemyBStartX);
    expect(Position.x[allySoldier]).toBe(allyStartX);
    expect(effectQuery(world.world)).toHaveLength(1);
    expect(commands.some((cmd) => cmd.shape === 'rect' && cmd.color === '#90caf9')).toBe(true);
    expect(commands.filter((cmd) => (
      (cmd.shape === 'circle' || cmd.shape === 'diamond') &&
      cmd.x >= RenderSystem.sceneOffsetX &&
      cmd.x <= RenderSystem.sceneOffsetX + RenderSystem.sceneW &&
      cmd.y >= RenderSystem.sceneOffsetY &&
      cmd.y <= RenderSystem.sceneOffsetY + RenderSystem.sceneH
    )).length).toBeGreaterThanOrEqual(48);
    expect(commands.filter((cmd) => (
      cmd.shape === 'rect' &&
      cmd.color === '#e1f5fe' &&
      cmd.rotation === 0
    )).length).toBeGreaterThanOrEqual(12);
    expect(commands.filter((cmd) => (
      cmd.shape === 'diamond' &&
      cmd.size >= 9 &&
      cmd.alpha !== undefined &&
      cmd.alpha >= 0.45 &&
      (cmd.color === '#ffffff' || cmd.color === '#e3f2fd')
    )).length).toBeGreaterThanOrEqual(40);
    expect(commands.filter((cmd) => (
      cmd.shape === 'rect' &&
      cmd.color === '#ffffff' &&
      cmd.h === 2 &&
      cmd.size >= 16
    )).length).toBeGreaterThanOrEqual(40);

    commands.length = 0;
    system.update(world, 0.9);
    expect(Health.current[enemyA]).toBe(210);
    expect(Health.current[enemyB]).toBe(210);
    expect(Health.current[allySoldier]).toBe(10);
    expect(Health.current[allyTower]).toBe(100);
    expect(Position.x[enemyA]).toBe(enemyAStartX);
    expect(Position.x[enemyB]).toBe(enemyBStartX);
    expect(effectQuery(world.world)).toHaveLength(1);

    system.update(world, 1.0);
    expect(Health.current[enemyA]).toBe(165);
    expect(Health.current[enemyB]).toBe(165);
    expect(Health.current[allySoldier]).toBe(-35);
    expect(Health.current[allyTower]).toBe(100);
    expect(Position.x[enemyA]).toBe(enemyAStartX);
    expect(Position.x[enemyB]).toBe(enemyBStartX);
    expect(effectQuery(world.world)).toHaveLength(1);
    expect(commands.some((cmd) => cmd.shape === 'circle' || cmd.shape === 'diamond')).toBe(true);

    system.update(world, 3.0);
    world.cleanupDeadEntities();
    expect(Health.current[enemyA]).toBe(75);
    expect(Health.current[enemyB]).toBe(75);
    expect(Health.current[allySoldier]).toBe(-35);
    expect(Health.current[allyTower]).toBe(100);
    expect(effectQuery(world.world)).toHaveLength(0);
  });
});
