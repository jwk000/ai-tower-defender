import { defineQuery } from 'bitecs';

import { Health, Poison } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createPoisonSystem(): System {
  const query = defineQuery([Poison, Health]);

  return {
    name: 'PoisonSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const entities = query(world);

      for (let i = 0; i < entities.length; i += 1) {
        const eid = entities[i]!;
        if (Health.current[eid]! <= 0) continue;

        let duration = Poison.duration[eid] ?? 0;
        let tickTimer = Poison.tickTimer[eid] ?? 0;
        const tickInterval = Poison.tickInterval[eid] ?? 1;
        const damagePerTick = Poison.damagePerTick[eid] ?? 0;

        if (duration <= 0 || tickInterval <= 0 || damagePerTick <= 0) {
          Poison.duration[eid] = 0;
          continue;
        }

        tickTimer -= dt;

        while (tickTimer <= 0 && duration > 0 && Health.current[eid]! > 0) {
          Health.current[eid] = Health.current[eid]! - Math.round(damagePerTick);
          tickTimer += tickInterval;
        }

        duration = Math.max(0, duration - dt);
        if (duration === 0) {
          tickTimer = tickInterval;
        }

        Poison.duration[eid] = duration;
        Poison.tickTimer[eid] = tickTimer;
      }
    },
  };
}
