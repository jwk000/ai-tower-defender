import type { MapConfig } from '../types/index.js';

export function getMinimumAttackRange(map?: Pick<MapConfig, 'tileSize'>): number {
  return Math.max(0, map?.tileSize ?? 0);
}

export function clampAttackRangeToTile(range: number, map?: Pick<MapConfig, 'tileSize'>): number {
  const minRange = getMinimumAttackRange(map);
  if (minRange <= 0) return range;
  return Math.max(range, minRange);
}
