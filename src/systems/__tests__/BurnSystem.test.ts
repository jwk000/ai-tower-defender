import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Burn, Health } from '../../core/components.js';
import { createBurnSystem } from '../BurnSystem.js';

function spawnTarget(game: Game, hp: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Health, eid);
  addComponent(game.world, Burn, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  Burn.damagePerTick[eid] = 3;
  Burn.tickInterval[eid] = 1;
  Burn.tickTimer[eid] = 1;
  Burn.duration[eid] = 2.5;
  return eid;
}

describe('BurnSystem', () => {
  it('registers itself in the gameplay phase', () => {
    const sys = createBurnSystem();
    expect(sys.phase).toBe('gameplay');
    expect(sys.name).toBe('BurnSystem');
  });

  it('applies periodic damage until duration ends', () => {
    const game = new Game();
    game.pipeline.register(createBurnSystem());
    const eid = spawnTarget(game, 20);

    for (let i = 0; i < 12; i += 1) game.tick(0.25);
    expect(Health.current[eid]).toBe(14);
    expect(Burn.duration[eid]).toBeCloseTo(0, 5);

    for (let i = 0; i < 4; i += 1) game.tick(0.25);
    expect(Health.current[eid]).toBe(14);
  });
});
