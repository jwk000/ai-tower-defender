import { defineQuery } from 'bitecs';

import { Attack, BossPhase, BossTag, Health, Visual } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createBossPhaseSystem(): System {
  const bossQuery = defineQuery([BossTag, BossPhase, Health, Visual, Attack]);

  return {
    name: 'BossPhaseSystem',
    phase: 'gameplay',
    update(world: TowerWorld): void {
      const bosses = bossQuery(world);
      for (let i = 0; i < bosses.length; i += 1) {
        const eid = bosses[i]!;
        if (Health.current[eid]! <= 0) continue;

        const hp = Health.current[eid]!;
        const maxHp = Health.max[eid]!;
        const currentPhase = BossPhase.value[eid]!;
        const ratio = maxHp > 0 ? hp / maxHp : 0;

        if (currentPhase === 1 && ratio < 0.66) {
          BossPhase.value[eid] = 2;
          Health.max[eid] = 4500;
          if (Health.current[eid]! > 4500) {
            Health.current[eid] = 4500;
          }
          Attack.damage[eid] = 110;
          Attack.range[eid] = 180;
          Attack.cooldown[eid] = 1 / 0.8;
          if (Attack.cooldownLeft[eid]! > Attack.cooldown[eid]!) {
            Attack.cooldownLeft[eid] = Attack.cooldown[eid]!;
          }
          Visual.color[eid] = 0x1e88e5;
        }

        if ((BossPhase.value[eid] === 2 || BossPhase.value[eid] === 1) && ratio < 0.33) {
          BossPhase.value[eid] = 3;
          Health.max[eid] = 3000;
          if (Health.current[eid]! > 3000) {
            Health.current[eid] = 3000;
          }
          Attack.damage[eid] = 180;
          Attack.range[eid] = 64;
          Attack.cooldown[eid] = 1 / 1.4;
          if (Attack.cooldownLeft[eid]! > Attack.cooldown[eid]!) {
            Attack.cooldownLeft[eid] = Attack.cooldown[eid]!;
          }
          Visual.color[eid] = 0xc62828;
        }
      }
    },
  };
}
