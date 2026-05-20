import { defineQuery, addComponent, hasComponent } from 'bitecs';
import { parseUnitConfigsFromYaml } from '../config/loader.js';
import towersYaml from '../config/units/towers.yaml?raw';
import { Attack, Burn, Faction, Health, Movement, Poison, Position } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';
import { spawnProjectile } from './ProjectileSystem.js';

const DEFAULT_PROJECTILE_SPEED = 480;

const ICE_TOWER_CONFIG = (() => {
  const cfg = parseUnitConfigsFromYaml(towersYaml).find((unit) => unit.id === 'ice_tower');
  if (!cfg) {
    throw new Error('[AttackSystem] ice_tower config not found');
  }
  const onHitRule = cfg.lifecycle?.onHit?.find((rule) => rule.handler === 'apply_slow');
  const slowPercent = Number(onHitRule?.params?.slowPercent ?? 0);
  const duration = Number(onHitRule?.params?.duration ?? 0);
  return {
    damage: cfg.stats.atk,
    range: cfg.stats.range,
    slowMultiplier: Math.max(0, 1 - slowPercent / 100),
    slowDuration: duration,
  };
})();

const FIRE_TOWER_CONFIG = (() => {
  const cfg = parseUnitConfigsFromYaml(towersYaml).find((unit) => unit.id === 'fire_tower');
  if (!cfg) {
    throw new Error('[AttackSystem] fire_tower config not found');
  }
  const onHitRule = cfg.lifecycle?.onHit?.find((rule) => rule.handler === 'apply_burn');
  const duration = Number(onHitRule?.params?.duration ?? 0);
  const tickRatio = Number(onHitRule?.params?.tickRatio ?? 0);
  return {
    damage: cfg.stats.atk,
    range: cfg.stats.range,
    duration,
    tickInterval: 1,
    damagePerTick: cfg.stats.atk * tickRatio,
  };
})();

const POISON_TOWER_CONFIG = (() => {
  const cfg = parseUnitConfigsFromYaml(towersYaml).find((unit) => unit.id === 'poison_tower');
  if (!cfg) {
    throw new Error('[AttackSystem] poison_tower config not found');
  }
  const onHitRule = cfg.lifecycle?.onHit?.find((rule) => rule.handler === 'apply_poison');
  const duration = Number(onHitRule?.params?.duration ?? 0);
  const tickRatio = Number(onHitRule?.params?.tickRatio ?? 0);
  return {
    damage: cfg.stats.atk,
    range: cfg.stats.range,
    duration,
    tickInterval: 1,
    damagePerTick: cfg.stats.atk * tickRatio,
  };
})();

export function createAttackSystem(): System {
  const attackerQuery = defineQuery([Position, Faction, Attack]);
  const targetQuery = defineQuery([Position, Faction, Health]);

  return {
    name: 'AttackSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const attackers = attackerQuery(world);
      const candidates = targetQuery(world);

      for (let i = 0; i < attackers.length; i += 1) {
        const attacker = attackers[i]!;
        const cd = Attack.cooldownLeft[attacker]! - dt;
        Attack.cooldownLeft[attacker] = cd > 0 ? cd : 0;

        if (Attack.cooldownLeft[attacker]! > 0) continue;

        const ax = Position.x[attacker]!;
        const ay = Position.y[attacker]!;
        const range = Attack.range[attacker]!;
        const rangeSq = range * range;
        const myTeam = Faction.team[attacker]!;
        const maxTargets = 1 + (Attack.extraTargets[attacker] ?? 0);

        const inRange: Array<{ eid: number; distSq: number }> = [];
        for (let j = 0; j < candidates.length; j += 1) {
          const cand = candidates[j]!;
          if (cand === attacker) continue;
          if (Faction.team[cand] === myTeam) continue;
          if (Health.current[cand]! <= 0) continue;

          const dx = Position.x[cand]! - ax;
          const dy = Position.y[cand]! - ay;
          const distSq = dx * dx + dy * dy;
          if (distSq > rangeSq) continue;
          inRange.push({ eid: cand, distSq });
        }

        if (inRange.length === 0) continue;

        inRange.sort((a, b) => a.distSq - b.distSq);
        const hitCount = Math.min(maxTargets, inRange.length);
        const speed = Attack.projectileSpeed[attacker]! || DEFAULT_PROJECTILE_SPEED;

        for (let t = 0; t < hitCount; t += 1) {
          const targetEid = inRange[t]!.eid;
          spawnProjectile(world, {
            sourceEid: attacker,
            targetEid,
            damage: Attack.damage[attacker]!,
            speed,
          });

          if (Movement.baseSpeed[attacker]! > 0) {
            continue;
          }

          if (Attack.projectileSpeed[attacker]! > 0 && range > 0 && Attack.damage[attacker]! > 0) {
            const isIceTower =
              Math.abs(range - ICE_TOWER_CONFIG.range) < 1e-3 &&
              Attack.damage[attacker] === ICE_TOWER_CONFIG.damage;
            if (isIceTower && Movement.baseSpeed[targetEid]! > 0) {
              Movement.slowMultiplier[targetEid] = ICE_TOWER_CONFIG.slowMultiplier;
              Movement.slowDuration[targetEid] = Math.max(
                Movement.slowDuration[targetEid] ?? 0,
                ICE_TOWER_CONFIG.slowDuration,
              );
            }

            const isFireTower =
              Math.abs(range - FIRE_TOWER_CONFIG.range) < 1e-3 &&
              Attack.damage[attacker] === FIRE_TOWER_CONFIG.damage;
            if (isFireTower) {
              if (!hasComponent(world, Burn, targetEid)) {
                addComponent(world, Burn, targetEid);
              }
              Burn.damagePerTick[targetEid] = FIRE_TOWER_CONFIG.damagePerTick;
              Burn.tickInterval[targetEid] = FIRE_TOWER_CONFIG.tickInterval;
              Burn.tickTimer[targetEid] = FIRE_TOWER_CONFIG.tickInterval;
              Burn.duration[targetEid] = Math.max(Burn.duration[targetEid] ?? 0, FIRE_TOWER_CONFIG.duration);
            }

            const isPoisonTower =
              Math.abs(range - POISON_TOWER_CONFIG.range) < 1e-3 &&
              Attack.damage[attacker] === POISON_TOWER_CONFIG.damage;
            if (isPoisonTower) {
              if (!hasComponent(world, Poison, targetEid)) {
                addComponent(world, Poison, targetEid);
              }
              Poison.damagePerTick[targetEid] = POISON_TOWER_CONFIG.damagePerTick;
              Poison.tickInterval[targetEid] = POISON_TOWER_CONFIG.tickInterval;
              Poison.tickTimer[targetEid] = POISON_TOWER_CONFIG.tickInterval;
              Poison.duration[targetEid] = Math.max(Poison.duration[targetEid] ?? 0, POISON_TOWER_CONFIG.duration);
            }
          }
        }

        Attack.cooldownLeft[attacker] = Attack.cooldown[attacker]!;
      }
    },
  };
}
