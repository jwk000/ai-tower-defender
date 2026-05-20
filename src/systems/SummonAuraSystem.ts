import { addComponent, defineQuery } from 'bitecs';

import {
  Faction,
  FactionTeam,
  Health,
  Position,
  SummonAura,
  UnitCategory,
  UnitTag,
  Visual,
  VisualShape,
} from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createSummonAuraSystem(): System {
  const summonerQuery = defineQuery([Position, SummonAura, Faction, Health]);
  const enemyQuery = defineQuery([Faction, UnitTag, Health]);

  return {
    name: 'SummonAuraSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const summoners = summonerQuery(world);
      const enemies = enemyQuery(world);

      for (let i = 0; i < summoners.length; i += 1) {
        const eid = summoners[i]!;
        if (Health.current[eid]! <= 0) continue;

        const nextCooldown = Math.max(0, (SummonAura.cooldownLeft[eid] ?? 0) - dt);
        SummonAura.cooldownLeft[eid] = nextCooldown;
        if (nextCooldown > 0) continue;

        const team = Faction.team[eid]!;
        if (team !== FactionTeam.Enemy) continue;
        if (SummonAura.summonUnitKind[eid] !== 1) continue;

        let liveAllies = 0;
        for (let j = 0; j < enemies.length; j += 1) {
          const target = enemies[j]!;
          if (target === eid) continue;
          if (Faction.team[target] !== team) continue;
          if (Health.current[target]! <= 0) continue;
          if (UnitTag.category[target] !== UnitCategory.Enemy) continue;
          liveAllies += 1;
        }

        if (liveAllies >= 6) {
          SummonAura.cooldownLeft[eid] = Math.min(SummonAura.interval[eid]!, dt);
          continue;
        }

        const summon = world.addEntity();
        addComponent(world, Position, summon);
        Position.x[summon] = Position.x[eid]! + (SummonAura.radius[eid] ?? 0);
        Position.y[summon] = Position.y[eid]!;

        addComponent(world, Health, summon);
        Health.current[summon] = 30;
        Health.max[summon] = 30;

        addComponent(world, Faction, summon);
        Faction.team[summon] = FactionTeam.Enemy;

        addComponent(world, UnitTag, summon);
        UnitTag.category[summon] = UnitCategory.Enemy;

        addComponent(world, Visual, summon);
        Visual.shape[summon] = VisualShape.Circle;
        Visual.color[summon] = 0xef5350;
        Visual.size[summon] = 24;

        SummonAura.cooldownLeft[eid] = SummonAura.interval[eid]!;
      }
    },
  };
}
