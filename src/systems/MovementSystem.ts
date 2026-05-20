import { addComponent, defineQuery, hasComponent } from 'bitecs';

import { DeadTag, Movement, Position } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export interface PathPoint {
  readonly x: number;
  readonly y: number;
}

export interface MovementSystemConfig {
  readonly path: readonly PathPoint[];
  readonly onEnemyReachedEnd?: (eid: number) => void;
}

const ARRIVAL_EPSILON = 1e-3;

export function createMovementSystem(config: MovementSystemConfig): System {
  if (config.path.length === 0) {
    throw new Error('[MovementSystem] path must contain at least one node');
  }
  const path = config.path;
  const lastIndex = path.length - 1;
  const finalNode = path[lastIndex]!;
  const query = defineQuery([Position, Movement]);
  const arrived = new Set<number>();

  return {
    name: 'MovementSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const entities = query(world);
      for (let i = 0; i < entities.length; i += 1) {
        const eid = entities[i]!;
        const baseSpeed = Movement.baseSpeed[eid] ?? Movement.speed[eid] ?? 0;
        const chargeMultiplier = Movement.chargeMultiplier[eid] ?? 1;
        const chargeDuration = Movement.chargeDuration[eid] ?? 0;
        const chargeCooldown = Movement.chargeCooldown[eid] ?? 0;
        let chargeTimer = Movement.chargeTimer[eid] ?? 0;
        let chargeCooldownLeft = Movement.chargeCooldownLeft[eid] ?? 0;
        let slowDuration = Movement.slowDuration[eid] ?? 0;
        let slowMultiplier = Movement.slowMultiplier[eid] ?? 1;

        if (chargeDuration > 0 && chargeMultiplier > 1) {
          if (chargeTimer > 0) {
            chargeTimer = Math.max(0, chargeTimer - dt);
            Movement.speed[eid] = baseSpeed * chargeMultiplier;
            if (chargeTimer === 0) {
              chargeCooldownLeft = chargeCooldown;
              Movement.speed[eid] = baseSpeed;
            }
          } else if (chargeCooldownLeft > 0) {
            chargeCooldownLeft = Math.max(0, chargeCooldownLeft - dt);
            Movement.speed[eid] = baseSpeed;
            if (chargeCooldownLeft === 0) {
              chargeTimer = chargeDuration;
              Movement.speed[eid] = baseSpeed * chargeMultiplier;
            }
          } else {
            chargeTimer = chargeDuration;
            Movement.speed[eid] = baseSpeed * chargeMultiplier;
          }
        } else {
          Movement.speed[eid] = baseSpeed;
        }

        if (slowDuration > 0) {
          slowDuration = Math.max(0, slowDuration - dt);
          Movement.speed[eid] = Movement.speed[eid]! * slowMultiplier;
          if (slowDuration === 0) {
            slowMultiplier = 1;
          }
        } else {
          slowMultiplier = 1;
        }

        Movement.slowDuration[eid] = slowDuration;
        Movement.slowMultiplier[eid] = slowMultiplier;

        Movement.chargeTimer[eid] = chargeTimer;
        Movement.chargeCooldownLeft[eid] = chargeCooldownLeft;

        if (arrived.has(eid)) {
          Position.x[eid] = finalNode.x;
          Position.y[eid] = finalNode.y;
          continue;
        }

        let targetIdx = Movement.pathIndex[eid]!;
        if (targetIdx > lastIndex) targetIdx = lastIndex;

        let budget = (Movement.speed[eid] ?? 0) * dt;
        if (budget <= 0) continue;

        while (budget > 0 && targetIdx <= lastIndex) {
          const target = path[targetIdx]!;
          const dx = target.x - Position.x[eid]!;
          const dy = target.y - Position.y[eid]!;
          const dist = Math.hypot(dx, dy);

          if (dist <= ARRIVAL_EPSILON) {
            Position.x[eid] = target.x;
            Position.y[eid] = target.y;
            if (targetIdx === lastIndex) {
              arrived.add(eid);
              world.ruleEngine.dispatch('onEnter', eid, world);
              if (!hasComponent(world, DeadTag, eid)) addComponent(world, DeadTag, eid);
              config.onEnemyReachedEnd?.(eid);
              targetIdx = lastIndex + 1;
              break;
            }
            targetIdx += 1;
            Movement.pathIndex[eid] = targetIdx;
            continue;
          }

          if (budget >= dist) {
            Position.x[eid] = target.x;
            Position.y[eid] = target.y;
            budget -= dist;
            if (targetIdx === lastIndex) {
              arrived.add(eid);
              world.ruleEngine.dispatch('onEnter', eid, world);
              if (!hasComponent(world, DeadTag, eid)) addComponent(world, DeadTag, eid);
              config.onEnemyReachedEnd?.(eid);
              targetIdx = lastIndex + 1;
              break;
            }
            targetIdx += 1;
            Movement.pathIndex[eid] = targetIdx;
          } else {
            const nx = dx / dist;
            const ny = dy / dist;
            Position.x[eid] = Position.x[eid]! + nx * budget;
            Position.y[eid] = Position.y[eid]! + ny * budget;
            Movement.vx[eid] = nx * Movement.speed[eid]!;
            Movement.vy[eid] = ny * Movement.speed[eid]!;
            budget = 0;
          }
        }
      }
    },
  };
}
