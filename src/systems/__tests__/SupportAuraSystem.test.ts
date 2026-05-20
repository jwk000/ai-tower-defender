import { describe, expect, it } from 'vitest';
import { addComponent, hasComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Faction, FactionTeam, Health, Position, Shield, SupportAura } from '../../core/components.js';
import { createShieldSystem } from '../ShieldSystem.js';
import { createSupportAuraSystem } from '../SupportAuraSystem.js';

function spawnSupporter(game: Game, x: number, y: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Health, eid);
  addComponent(game.world, SupportAura, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Enemy;
  Health.current[eid] = 100;
  Health.max[eid] = 100;
  SupportAura.radius[eid] = 120;
  SupportAura.shieldAmount[eid] = 12;
  SupportAura.duration[eid] = 3;
  SupportAura.interval[eid] = 1;
  SupportAura.cooldownLeft[eid] = 0;
  return eid;
}

function spawnAlly(game: Game, x: number, y: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Health, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Enemy;
  Health.current[eid] = 50;
  Health.max[eid] = 50;
  return eid;
}

describe('SupportAuraSystem', () => {
  it('applies shield to nearby enemy allies', () => {
    const game = new Game();
    game.pipeline.register(createSupportAuraSystem());
    const supporter = spawnSupporter(game, 100, 100);
    const ally = spawnAlly(game, 150, 100);

    game.tick(0.1);

    expect(supporter).toBeGreaterThan(0);
    expect(hasComponent(game.world, Shield, ally)).toBe(true);
    expect(Shield.current[ally]).toBe(12);
    expect(Shield.max[ally]).toBe(12);
    expect(Shield.duration[ally]).toBe(3);
  });

  it('does not apply shield to allies outside radius', () => {
    const game = new Game();
    game.pipeline.register(createSupportAuraSystem());
    spawnSupporter(game, 100, 100);
    const ally = spawnAlly(game, 260, 100);

    game.tick(0.1);

    expect(hasComponent(game.world, Shield, ally)).toBe(false);
  });

  it('expires shield when duration ends', () => {
    const game = new Game();
    game.pipeline.register(createShieldSystem());
    const ally = spawnAlly(game, 150, 100);
    addComponent(game.world, Shield, ally);
    Shield.current[ally] = 12;
    Shield.max[ally] = 12;
    Shield.duration[ally] = 0.2;

    game.tick(0.1);
    expect(Shield.current[ally]).toBe(12);

    game.tick(0.11);
    expect(Shield.current[ally]).toBe(0);
    expect(Shield.duration[ally]).toBe(0);
  });
});
