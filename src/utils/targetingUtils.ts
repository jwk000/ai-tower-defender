import { hasComponent, type TowerWorld } from '../core/World.js';
import { Burrowed } from '../core/components.js';

export function isBurrowed(world: TowerWorld, eid: number): boolean {
  return hasComponent(world.world, Burrowed, eid);
}

export function canBeTargeted(world: TowerWorld, eid: number): boolean {
  return !isBurrowed(world, eid);
}

export function canReceiveCombatDamage(world: TowerWorld, eid: number): boolean {
  return !isBurrowed(world, eid);
}
