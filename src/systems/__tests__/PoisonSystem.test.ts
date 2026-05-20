import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Health, Poison } from '../../core/components.js';
import { createPoisonSystem } from '../PoisonSystem.js';

function spawnTarget(game: Game, hp: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Health, eid);
  addComponent(game.world, Poison, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  Poison.damagePerTick[eid] = 2;
  Poison.tickInterval[eid] = 1;
  Poison.tickTimer[eid] = 1;
  Poison.duration[eid] = 4;
  return eid;
}

describe('PoisonSystem', () => {
  it('registers itself in the gameplay phase', () => {
    const sys = createPoisonSystem();
    expect(sys.phase).toBe('gameplay');
    expect(sys.name).toBe('PoisonSystem');
  });

  it('applies periodic damage until duration ends', () => {
    const game = new Game();
    game.pipeline.register(createPoisonSystem());
    const eid = spawnTarget(game, 20);

    for (let i = 0; i < 16; i += 1) game.tick(0.25);
    expect(Health.current[eid]).toBe(12);
    expect(Poison.duration[eid]).toBeCloseTo(0, 5);

    for (let i = 0; i < 4; i += 1) game.tick(0.25);
    expect(Health.current[eid]).toBe(12);
  });
});
