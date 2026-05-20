import { defineQuery } from 'bitecs';

import { Faction, FactionTeam, Health, Position, SupportAura } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createSupportAuraSystem(): System {
  const supportQuery = defineQuery([Position, SupportAura, Faction, Health]);
  const allyQuery = defineQuery([Position, Faction, Health]);

  return {
    name: 'SupportAuraSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const supporters = supportQuery(world);
      const allies = allyQuery(world);

      for (let i = 0; i < supporters.length; i += 1) {
        const eid = supporters[i]!;
        if (Health.current[eid]! <= 0) continue;

        const nextCooldown = Math.max(0, (SupportAura.cooldownLeft[eid] ?? 0) - dt);
        SupportAura.cooldownLeft[eid] = nextCooldown;
        if (nextCooldown > 0) continue;

        const team = Faction.team[eid]!;
        const radius = SupportAura.radius[eid]!;
        const radiusSq = radius * radius;
        const healAmount = SupportAura.healAmount[eid]!;

        let healed = false;
        for (let j = 0; j < allies.length; j += 1) {
          const target = allies[j]!;
          if (target === eid) continue;
          if (Faction.team[target] !== team) continue;
          if (team !== FactionTeam.Enemy) continue;
          if (Health.current[target]! <= 0) continue;
          if (Health.current[target]! >= Health.max[target]!) continue;

          const dx = Position.x[target]! - Position.x[eid]!;
          const dy = Position.y[target]! - Position.y[eid]!;
          if (dx * dx + dy * dy > radiusSq) continue;

          Health.current[target] = Math.min(Health.max[target]!, Health.current[target]! + healAmount);
          healed = true;
        }

        SupportAura.cooldownLeft[eid] = healed
          ? SupportAura.interval[eid]!
          : Math.min(SupportAura.interval[eid]!, dt);
      }
    },
  };
}
