import { hasComponent } from 'bitecs';

import { Health, Shield, Vulnerable } from '../core/components.js';
import type { TowerWorld } from '../core/World.js';

export function applyDamage(world: TowerWorld, target: number, damage: number): void {
  let damageLeft = damage;
  if (hasComponent(world, Shield, target) && Shield.current[target]! > 0) {
    const absorbed = Math.min(Shield.current[target]!, damageLeft);
    Shield.current[target] = Shield.current[target]! - absorbed;
    damageLeft -= absorbed;
    if (Shield.current[target]! <= 0) {
      Shield.current[target] = 0;
      Shield.duration[target] = 0;
    }
  }

  if (damageLeft <= 0) {
    return;
  }

  if (hasComponent(world, Vulnerable, target) && Vulnerable.duration[target]! > 0) {
    const multiplier = Vulnerable.multiplier[target] ?? 1;
    damageLeft = Math.round(damageLeft * Math.max(1, multiplier));
  }

  Health.current[target] = Health.current[target]! - damageLeft;
}
