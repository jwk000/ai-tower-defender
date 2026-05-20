import { describe, expect, it } from 'vitest';
import { addComponent, hasComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import {
  Burn,
  Faction,
  FactionTeam,
  Health,
  Movement,
  Poison,
  Position,
  Shield,
  SupportAura,
  Vulnerable,
} from '../../core/components.js';
import { createBurnSystem } from '../BurnSystem.js';
import { createMovementSystem } from '../MovementSystem.js';
import { createPoisonSystem } from '../PoisonSystem.js';
import { createShieldSystem } from '../ShieldSystem.js';
import { createSupportAuraSystem } from '../SupportAuraSystem.js';

function spawnEnemy(game: Game, hp: number, x = 0, y = 0): number {
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
  Movement.baseSpeed[eid] = 10;
  Movement.speed[eid] = 10;
  Movement.pathIndex[eid] = 0;
  Movement.slowMultiplier[eid] = 1;
  Movement.slowDuration[eid] = 0;

  return eid;
}

function spawnSupporter(game: Game, x = 0, y = 0): number {
  const eid = spawnEnemy(game, 20, x, y);
  addComponent(game.world, SupportAura, eid);
  SupportAura.radius[eid] = 3;
  SupportAura.shieldAmount[eid] = 6;
  SupportAura.duration[eid] = 2;
  SupportAura.interval[eid] = 5;
  SupportAura.cooldownLeft[eid] = 0;
  return eid;
}

describe('status systems integration', () => {
  it('combines slow, burn, poison, shield and vulnerable with stable duration behavior', () => {
    const game = new Game();
    game.pipeline.register(createSupportAuraSystem());
    game.pipeline.register(createShieldSystem());
    game.pipeline.register(createBurnSystem());
    game.pipeline.register(createPoisonSystem());
    game.pipeline.register(
      createMovementSystem({
        path: [
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
      }),
    );

    const supporter = spawnSupporter(game, 0, 0);
    const target = spawnEnemy(game, 20, 1, 0);

    addComponent(game.world, Burn, target);
    Burn.damagePerTick[target] = 3;
    Burn.tickInterval[target] = 1;
    Burn.tickTimer[target] = 1;
    Burn.duration[target] = 2.5;

    addComponent(game.world, Poison, target);
    Poison.damagePerTick[target] = 2;
    Poison.tickInterval[target] = 1;
    Poison.tickTimer[target] = 1;
    Poison.duration[target] = 4;

    addComponent(game.world, Vulnerable, target);
    Vulnerable.multiplier[target] = 2;
    Vulnerable.duration[target] = 3;

    Movement.slowMultiplier[target] = 0.5;
    Movement.slowDuration[target] = 2;

    game.tick(0.25);

    expect(hasComponent(game.world, Shield, target)).toBe(true);
    expect(Shield.current[target]).toBe(6);
    expect(Shield.duration[target]).toBeCloseTo(1.75, 5);
    expect(Position.x[target]).toBeCloseTo(2.25, 5);
    expect(Movement.speed[target]).toBeCloseTo(5, 5);
    expect(Movement.slowDuration[target]).toBeCloseTo(1.75, 5);

    for (let i = 0; i < 3; i += 1) game.tick(0.25);

    expect(Shield.current[target]).toBe(1);
    expect(Health.current[target]).toBe(20);
    expect(Burn.duration[target]).toBeCloseTo(1.5, 5);
    expect(Poison.duration[target]).toBeCloseTo(3, 5);
    expect(Vulnerable.duration[target]).toBeCloseTo(3, 5);
    expect(Movement.slowDuration[target]).toBeCloseTo(1, 5);
    expect(Position.x[target]).toBeCloseTo(6, 5);

    for (let i = 0; i < 4; i += 1) game.tick(0.25);

    expect(Shield.current[target]).toBe(0);
    expect(Shield.duration[target]).toBe(0);
    expect(Health.current[target]).toBe(10);
    expect(Burn.duration[target]).toBeCloseTo(0.5, 5);
    expect(Poison.duration[target]).toBeCloseTo(2, 5);
    expect(Movement.slowDuration[target]).toBeCloseTo(0, 5);
    expect(Movement.speed[target]).toBeCloseTo(5, 5);
    expect(Position.x[target]).toBeCloseTo(11, 5);

    game.tick(0.25);

    expect(Movement.speed[target]).toBeCloseTo(10, 5);
    expect(Position.x[target]).toBeCloseTo(13.5, 5);

    for (let i = 0; i < 6; i += 1) game.tick(0.25);

    expect(Health.current[target]).toBe(6);
    expect(Burn.duration[target]).toBeCloseTo(0, 5);
    expect(Poison.duration[target]).toBeCloseTo(0.25, 5);
    expect(Vulnerable.duration[target]).toBeCloseTo(3, 5);
    expect(Position.x[target]).toBeCloseTo(20, 5);

    game.tick(0.25);

    expect(Health.current[target]).toBe(2);
    expect(Poison.duration[target]).toBeCloseTo(0, 5);
    expect(Shield.current[target]).toBe(0);
    expect(Shield.duration[target]).toBe(0);

    expect(Health.current[supporter]).toBe(20);
  });
});
