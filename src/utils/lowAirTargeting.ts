import { TowerType, UnitType } from '../types/index.js';

export const LOW_AIR_TOWER_TYPES = new Set<TowerType>([
  TowerType.Arrow,
  TowerType.Ballista,
  TowerType.Laser,
  TowerType.Bat,
  TowerType.Lightning,
  TowerType.Ice,
  TowerType.Fire,
  TowerType.Poison,
]);

export const LOW_AIR_SOLDIER_TYPES = new Set<UnitType>([
  UnitType.Archer,
  UnitType.Mage,
]);

export const LOW_AIR_COUNTER_CARD_IDS = new Set<string>([
  'card_arrow_tower',
  'card_ballista_tower',
  'card_laser_tower',
  'card_bat_tower',
  'card_lightning_tower',
  'card_ice_tower',
  'card_fire_tower',
  'card_poison_tower',
  'card_archer',
  'card_mage',
]);

export function towerCanTargetLowAir(towerType: TowerType): boolean {
  return LOW_AIR_TOWER_TYPES.has(towerType);
}

export function soldierCanTargetLowAir(unitType: UnitType): boolean {
  return LOW_AIR_SOLDIER_TYPES.has(unitType);
}

export function cardCanCounterLowAir(cardId: string): boolean {
  return LOW_AIR_COUNTER_CARD_IDS.has(cardId);
}
