import { ObstacleType, type TileArtTheme } from '../types/index.js';
import { resolveMapArtTheme } from './pathTileTexture.js';

const DECOR_TYPE_ALIASES: Partial<Record<string, ObstacleType>> = {
  crystal: ObstacleType.CrystalObstacle,
  rift: ObstacleType.VoidRift,
};

export type DecorParticleKind = 'none' | 'leaf_motes' | 'ember_motes' | 'rift_sparks' | 'steam_puffs';

const DECOR_VARIANT_COUNTS: Partial<Record<ObstacleType, number>> = {
  [ObstacleType.Tree]: 2,
  [ObstacleType.Bush]: 2,
  [ObstacleType.Flower]: 2,
  [ObstacleType.Cactus]: 2,
  [ObstacleType.TunnelEntrance]: 3,
  [ObstacleType.TunnelExit]: 3,
  [ObstacleType.Brazier]: 3,
  [ObstacleType.DeadTree]: 2,
  [ObstacleType.ScorchedTree]: 2,
  [ObstacleType.LavaVent]: 4,
  [ObstacleType.FloatingRock]: 2,
  [ObstacleType.PurpleFlame]: 3,
  [ObstacleType.CrystalObstacle]: 2,
  [ObstacleType.VoidRift]: 4,
  [ObstacleType.RealityWarp]: 4,
};

const LEAF_DECORS = new Set<ObstacleType>([
  ObstacleType.Tree,
  ObstacleType.Bush,
  ObstacleType.Flower,
  ObstacleType.Cactus,
  ObstacleType.SnowTree,
  ObstacleType.ScorchedTree,
  ObstacleType.DeadTree,
  ObstacleType.VineOvergrowth,
  ObstacleType.MushroomCluster,
  ObstacleType.HyphalRoot,
]);

const EMBER_DECORS = new Set<ObstacleType>([
  ObstacleType.Brazier,
  ObstacleType.LavaVent,
  ObstacleType.PurpleFlame,
  ObstacleType.TunnelEntrance,
  ObstacleType.TunnelExit,
  ObstacleType.MoldSpawner,
  ObstacleType.CorruptedObelisk,
]);

const RIFT_DECORS = new Set<ObstacleType>([
  ObstacleType.VoidRift,
  ObstacleType.RealityWarp,
  ObstacleType.CrystalObstacle,
  ObstacleType.FloatingRock,
  ObstacleType.IceCrystal,
  ObstacleType.SporePod,
  ObstacleType.AlienPillar,
]);

const STEAM_DECORS = new Set<ObstacleType>([
  ObstacleType.SteamPipe,
  ObstacleType.GearDecoration,
  ObstacleType.ConveyorBelt,
  ObstacleType.Car,
]);

export function normalizeDecorType(type: ObstacleType | string): ObstacleType | null {
  if (Object.values(ObstacleType).includes(type as ObstacleType)) {
    return type as ObstacleType;
  }
  return DECOR_TYPE_ALIASES[type] ?? null;
}

export function getDecorFrameCount(type: ObstacleType | string): number {
  const normalizedType = normalizeDecorType(type);
  if (!normalizedType) return 1;
  return DECOR_VARIANT_COUNTS[normalizedType] ?? 1;
}

export function getDecorParticleKind(type: ObstacleType | string): DecorParticleKind {
  const normalizedType = normalizeDecorType(type);
  if (!normalizedType) return 'none';
  if (LEAF_DECORS.has(normalizedType)) return 'leaf_motes';
  if (EMBER_DECORS.has(normalizedType)) return 'ember_motes';
  if (RIFT_DECORS.has(normalizedType)) return 'rift_sparks';
  if (STEAM_DECORS.has(normalizedType)) return 'steam_puffs';
  return 'none';
}

export function decorArtPath(
  type: ObstacleType | string,
  variant = 0,
  theme?: string | TileArtTheme,
): string | null {
  const normalizedType = normalizeDecorType(type);
  if (!normalizedType) return null;
  const resolvedTheme = resolveMapArtTheme(theme);
  const frameCount = getDecorFrameCount(normalizedType);
  const safeVariant = Math.max(0, Math.min(Math.floor(variant), frameCount - 1));
  return `/art/decor/decor_${resolvedTheme}_${normalizedType}_idle_${safeVariant}.png`;
}

export function getDecorVariantIndex(
  type: ObstacleType | string,
  row: number,
  col: number,
  theme?: string | TileArtTheme,
): number {
  const normalizedType = normalizeDecorType(type);
  const frameCount = getDecorFrameCount(type);
  if (!normalizedType || frameCount <= 1) return 0;
  const resolvedTheme = resolveMapArtTheme(theme);
  const seed = `${resolvedTheme}:${normalizedType}:${row}:${col}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % frameCount;
}
