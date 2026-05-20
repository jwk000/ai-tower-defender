import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Health, Shield, Vulnerable } from '../../core/components.js';
import { applyDamage } from '../damage.js';

function spawnTarget(game: Game, hp: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Health, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  return eid;
}

describe('damage vulnerable regression', () => {
  it('amplifies incoming damage when target is vulnerable', () => {
    const game = new Game();
    const target = spawnTarget(game, 20);
    addComponent(game.world, Vulnerable, target);
    Vulnerable.multiplier[target] = 1.5;
    Vulnerable.duration[target] = 2;

    applyDamage(game.world, target, 10);

    expect(Health.current[target]).toBe(5);
  });

  it('still consumes shield before vulnerable health damage', () => {
    const game = new Game();
    const target = spawnTarget(game, 20);
    addComponent(game.world, Shield, target);
    Shield.current[target] = 8;
    Shield.max[target] = 8;
    Shield.duration[target] = 3;
    addComponent(game.world, Vulnerable, target);
    Vulnerable.multiplier[target] = 2;
    Vulnerable.duration[target] = 2;

    applyDamage(game.world, target, 10);

    expect(Shield.current[target]).toBe(0);
    expect(Health.current[target]).toBe(16);
  });
});
