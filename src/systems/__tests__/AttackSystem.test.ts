import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import {
  Attack,
  Burn,
  Faction,
  FactionTeam,
  Health,
  Movement,
  Position,
} from '../../core/components.js';
import { parseUnitConfigsFromYaml } from '../../config/loader.js';
import towersYaml from '../../config/units/towers.yaml?raw';
import { createAttackSystem } from '../AttackSystem.js';
import { createHealthSystem } from '../HealthSystem.js';
import { createLifecycleSystem } from '../LifecycleSystem.js';
import { createProjectileSystem } from '../ProjectileSystem.js';
import { createBurnSystem } from '../BurnSystem.js';

const ICE_TOWER = (() => {
  const cfg = parseUnitConfigsFromYaml(towersYaml).find((unit) => unit.id === 'ice_tower');
  if (!cfg) throw new Error('ice_tower config not found');
  return cfg;
})();

const FIRE_TOWER = (() => {
  const cfg = parseUnitConfigsFromYaml(towersYaml).find((unit) => unit.id === 'fire_tower');
  if (!cfg) throw new Error('fire_tower config not found');
  return cfg;
})();

function setupGame(): Game {
  const game = new Game();
  game.pipeline.register(createAttackSystem());
  game.pipeline.register(createProjectileSystem());
  game.pipeline.register(createBurnSystem());
  game.pipeline.register(createHealthSystem());
  game.pipeline.register(createLifecycleSystem());
  return game;
}

function spawnTower(
  game: Game,
  x: number,
  y: number,
  opts: { damage: number; range: number; cooldown: number; projectileSpeed?: number },
): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Attack, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Player;
  Attack.damage[eid] = opts.damage;
  Attack.range[eid] = opts.range;
  Attack.cooldown[eid] = opts.cooldown;
  Attack.cooldownLeft[eid] = 0;
  Attack.projectileSpeed[eid] = opts.projectileSpeed ?? 480;
  return eid;
}

function spawnEnemy(game: Game, x: number, y: number, hp: number, speed = 80): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Health, eid);
  addComponent(game.world, Movement, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Enemy;
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  Movement.speed[eid] = speed;
  Movement.baseSpeed[eid] = speed;
  Movement.pathIndex[eid] = 0;
  Movement.slowMultiplier[eid] = 1;
  Movement.slowDuration[eid] = 0;
  return eid;
}

function tickUntilProjectileHits(game: Game, maxFrames = 25): void {
  for (let i = 0; i < maxFrames; i += 1) game.tick(0.02);
}

describe('AttackSystem (projectile-based)', () => {
  it('registers itself in the gameplay phase', () => {
    const sys = createAttackSystem();
    expect(sys.phase).toBe('gameplay');
    expect(sys.name).toBe('AttackSystem');
  });

  it('fires a projectile at the nearest enemy in range, resetting cooldown immediately', () => {
    const game = setupGame();
    const tower = spawnTower(game, 100, 100, { damage: 25, range: 200, cooldown: 1 });
    const near = spawnEnemy(game, 150, 100, 100);
    const far = spawnEnemy(game, 150, 250, 100);

    game.tick(0.05);
    expect(Attack.cooldownLeft[tower]).toBeGreaterThan(0.9);

    tickUntilProjectileHits(game);
    expect(Health.current[near]).toBe(75);
    expect(Health.current[far]).toBe(100);
  });

  it('does not fire when no enemy is in range', () => {
    const game = setupGame();
    const tower = spawnTower(game, 0, 0, { damage: 25, range: 100, cooldown: 1 });
    const outOfRange = spawnEnemy(game, 200, 0, 100);

    tickUntilProjectileHits(game);

    expect(Health.current[outOfRange]).toBe(100);
    expect(Attack.cooldownLeft[tower]).toBe(0);
  });

  it('does not target friendly units', () => {
    const game = setupGame();
    spawnTower(game, 0, 0, { damage: 25, range: 500, cooldown: 1 });
    const friendly = game.world.addEntity();
    addComponent(game.world, Position, friendly);
    addComponent(game.world, Faction, friendly);
    addComponent(game.world, Health, friendly);
    Position.x[friendly] = 50;
    Position.y[friendly] = 0;
    Faction.team[friendly] = FactionTeam.Player;
    Health.current[friendly] = 100;
    Health.max[friendly] = 100;

    tickUntilProjectileHits(game);

    expect(Health.current[friendly]).toBe(100);
  });

  it('counts cooldown down by dt across frames after firing', () => {
    const game = setupGame();
    const tower = spawnTower(game, 0, 0, { damage: 10, range: 500, cooldown: 1 });
    spawnEnemy(game, 50, 0, 100);

    game.tick(0.05);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(1, 5);

    game.tick(0.25);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(0.75, 5);

    game.tick(0.25);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(0.5, 5);
  });

  it('cannot fire again while on cooldown', () => {
    const game = setupGame();
    const tower = spawnTower(game, 0, 0, { damage: 30, range: 500, cooldown: 2 });
    const enemy = spawnEnemy(game, 50, 0, 1000);

    tickUntilProjectileHits(game);
    expect(Health.current[enemy]).toBe(970);
    expect(Attack.cooldownLeft[tower]).toBeGreaterThan(0);

    const hpBeforeIdle = Health.current[enemy];
    for (let i = 0; i < 5; i += 1) game.tick(0.2);
    expect(Health.current[enemy]).toBe(hpBeforeIdle);
  });

  it('fires again once cooldown elapses', () => {
    const game = setupGame();
    spawnTower(game, 0, 0, { damage: 25, range: 500, cooldown: 0.5 });
    const enemy = spawnEnemy(game, 50, 0, 10000);

    for (let i = 0; i < 4; i += 1) game.tick(0.05);
    expect(Health.current[enemy]).toBe(9975);

    for (let i = 0; i < 20; i += 1) game.tick(0.05);
    expect(Health.current[enemy]).toBeLessThan(9975);
  });

  it('switches to a new target when the current one dies', () => {
    const game = setupGame();
    spawnTower(game, 0, 0, { damage: 100, range: 500, cooldown: 0.5 });
    const enemyA = spawnEnemy(game, 30, 0, 50);
    const enemyB = spawnEnemy(game, 60, 0, 100);

    for (let i = 0; i < 10; i += 1) game.tick(0.05);
    expect(Health.current[enemyA]).toBeLessThanOrEqual(0);

    for (let i = 0; i < 30; i += 1) game.tick(0.05);
    expect(Health.current[enemyB]).toBeLessThanOrEqual(0);
  });

  it('picks the closest among multiple enemies in range', () => {
    const game = setupGame();
    spawnTower(game, 100, 100, { damage: 10, range: 500, cooldown: 1 });
    const farther = spawnEnemy(game, 300, 100, 100);
    const closest = spawnEnemy(game, 130, 100, 100);
    const mid = spawnEnemy(game, 200, 100, 100);

    tickUntilProjectileHits(game);

    expect(Health.current[closest]).toBe(90);
    expect(Health.current[mid]).toBe(100);
    expect(Health.current[farther]).toBe(100);
  });

  it('ignores already-dead enemies when picking targets', () => {
    const game = setupGame();
    spawnTower(game, 0, 0, { damage: 10, range: 500, cooldown: 1 });
    const corpse = spawnEnemy(game, 30, 0, 0);
    Health.current[corpse] = 0;
    const alive = spawnEnemy(game, 60, 0, 100);

    tickUntilProjectileHits(game);

    expect(Health.current[alive]).toBe(90);
  });

  it('applies ice tower slow from config to moving enemies', () => {
    const game = setupGame();
    spawnTower(game, 100, 100, {
      damage: ICE_TOWER.stats.atk,
      range: ICE_TOWER.stats.range,
      cooldown: 1 / ICE_TOWER.stats.attackSpeed,
    });
    const enemy = spawnEnemy(game, 130, 100, 100, 80);

    game.tick(0.05);

    expect(Movement.slowMultiplier[enemy]).toBeCloseTo(0.75, 5);
    expect(Movement.slowDuration[enemy]).toBeCloseTo(3, 5);
  });

  it('applies fire tower burn from config to enemies over time', () => {
    const game = setupGame();
    spawnTower(game, 100, 100, {
      damage: FIRE_TOWER.stats.atk,
      range: FIRE_TOWER.stats.range,
      cooldown: 1 / FIRE_TOWER.stats.attackSpeed,
    });
    const enemy = spawnEnemy(game, 130, 100, 100, 80);

    game.tick(0.05);

    expect(Burn.duration[enemy]).toBeCloseTo(2.95, 5);
    expect(Burn.damagePerTick[enemy]).toBeCloseTo(2.5, 5);

    for (let i = 0; i < 50; i += 1) game.tick(0.02);
    expect(Health.current[enemy]).toBe(87);
  });

  it('hits 2 targets simultaneously when extraTargets=1', () => {
    const game = setupGame();
    const tower = spawnTower(game, 100, 100, { damage: 10, range: 500, cooldown: 1 });
    Attack.extraTargets[tower] = 1;
    const near = spawnEnemy(game, 130, 100, 100);
    const mid = spawnEnemy(game, 200, 100, 100);
    const far = spawnEnemy(game, 400, 100, 100);

    tickUntilProjectileHits(game);

    expect(Health.current[near]).toBe(90);
    expect(Health.current[mid]).toBe(90);
    expect(Health.current[far]).toBe(100);
  });

  it('hits only 1 target when extraTargets=0 (default)', () => {
    const game = setupGame();
    const tower = spawnTower(game, 100, 100, { damage: 10, range: 500, cooldown: 1 });
    const near = spawnEnemy(game, 130, 100, 100);
    const mid = spawnEnemy(game, 200, 100, 100);

    tickUntilProjectileHits(game);

    expect(Health.current[near]).toBe(90);
    expect(Health.current[mid]).toBe(100);
    expect(Attack.extraTargets[tower]).toBe(0);
  });
});
