import { defineQuery } from 'bitecs';

import { Shield } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createShieldSystem(): System {
  const query = defineQuery([Shield]);

  return {
    name: 'ShieldSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const entities = query(world);

      for (let i = 0; i < entities.length; i += 1) {
        const eid = entities[i]!;
        const duration = Math.max(0, (Shield.duration[eid] ?? 0) - dt);
        Shield.duration[eid] = duration;
        if (duration > 0) continue;
        Shield.current[eid] = 0;
      }
    },
  };
}
