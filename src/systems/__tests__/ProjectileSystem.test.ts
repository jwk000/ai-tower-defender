import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Faction, FactionTeam, Health, Position, Shield } from '../../core/components.js';
import { createHealthSystem } from '../HealthSystem.js';
import { createProjectileSystem, spawnProjectile } from '../ProjectileSystem.js';

function spawnUnit(game: Game, x: number, y: number, hp: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Health, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Enemy;
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  return eid;
}

describe('ProjectileSystem shield regression', () => {
  it('consumes shield before health', () => {
    const game = new Game();
    game.pipeline.register(createProjectileSystem());
    game.pipeline.register(createHealthSystem());
    const source = spawnUnit(game, 0, 0, 1);
    const target = spawnUnit(game, 10, 0, 20);
    addComponent(game.world, Shield, target);
    Shield.current[target] = 12;
    Shield.max[target] = 12;
    Shield.duration[target] = 3;

    spawnProjectile(game.world, { sourceEid: source, targetEid: target, damage: 10, speed: 1000 });
    game.tick(0.02);

    expect(Shield.current[target]).toBe(2);
    expect(Health.current[target]).toBe(20);
  });

  it('passes overflow damage through to health after shield breaks', () => {
    const game = new Game();
    game.pipeline.register(createProjectileSystem());
    game.pipeline.register(createHealthSystem());
    const source = spawnUnit(game, 0, 0, 1);
    const target = spawnUnit(game, 10, 0, 20);
    addComponent(game.world, Shield, target);
    Shield.current[target] = 5;
    Shield.max[target] = 5;
    Shield.duration[target] = 3;

    spawnProjectile(game.world, { sourceEid: source, targetEid: target, damage: 10, speed: 1000 });
    game.tick(0.02);

    expect(Shield.current[target]).toBe(0);
    expect(Shield.duration[target]).toBe(0);
    expect(Health.current[target]).toBe(15);
  });
});
