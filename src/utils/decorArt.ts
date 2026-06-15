import { ObstacleType, type TileArtTheme } from '../types/index.js';
import { resolveMapArtTheme } from './pathTileTexture.js';

const DECOR_TYPE_ALIASES: Partial<Record<string, ObstacleType>> = {
  crystal: ObstacleType.CrystalObstacle,
  rift: ObstacleType.VoidRift,
};

const DECOR_FRAME_COUNTS: Record<ObstacleType, number> = {
  [ObstacleType.Tree]: 2,
  [ObstacleType.Bush]: 2,
  [ObstacleType.Flower]: 2,
  [ObstacleType.Rock]: 1,
  [ObstacleType.Cactus]: 2,
  [ObstacleType.Bones]: 1,
  [ObstacleType.IceCrystal]: 2,
  [ObstacleType.SnowTree]: 2,
  [ObstacleType.FrozenRock]: 1,
  [ObstacleType.LavaVent]: 4,
  [ObstacleType.ScorchedTree]: 2,
  [ObstacleType.VolcanicRock]: 1,
  [ObstacleType.Pillar]: 1,
  [ObstacleType.Brazier]: 3,
  [ObstacleType.Rubble]: 1,
  [ObstacleType.SandDune]: 1,
  [ObstacleType.TunnelEntrance]: 3,
  [ObstacleType.TunnelExit]: 3,
  [ObstacleType.IcePillar]: 1,
  [ObstacleType.SnowPile]: 2,
  [ObstacleType.IceTile]: 1,
  [ObstacleType.TemplePillar]: 1,
  [ObstacleType.AncientStatue]: 1,
  [ObstacleType.VineOvergrowth]: 2,
  [ObstacleType.ShipWreck]: 1,
  [ObstacleType.DockCrate]: 1,
  [ObstacleType.Buoy]: 3,
  [ObstacleType.TideShoal]: 2,
  [ObstacleType.ConveyorBelt]: 3,
  [ObstacleType.GearDecoration]: 3,
  [ObstacleType.SteamPipe]: 3,
  [ObstacleType.CoalPile]: 1,
  [ObstacleType.MushroomCluster]: 2,
  [ObstacleType.SporePod]: 3,
  [ObstacleType.MoldSpawner]: 3,
  [ObstacleType.HyphalRoot]: 2,
  [ObstacleType.AlienPillar]: 2,
  [ObstacleType.CorruptedObelisk]: 3,
  [ObstacleType.VoidRift]: 4,
  [ObstacleType.RealityWarp]: 4,
  [ObstacleType.DeadTree]: 2,
  [ObstacleType.Wall]: 1,
  [ObstacleType.Car]: 1,
  [ObstacleType.FloatingRock]: 2,
  [ObstacleType.PurpleFlame]: 3,
  [ObstacleType.CrystalObstacle]: 2,
};

export function normalizeDecorType(type: ObstacleType | string): ObstacleType | null {
  if (Object.values(ObstacleType).includes(type as ObstacleType)) {
    return type as ObstacleType;
  }
  return DECOR_TYPE_ALIASES[type] ?? null;
}

export function getDecorFrameCount(type: ObstacleType | string): number {
  const normalizedType = normalizeDecorType(type);
  if (!normalizedType) return 1;
  return DECOR_FRAME_COUNTS[normalizedType] ?? 1;
}

export function decorArtPath(
  type: ObstacleType | string,
  frame: number,
  theme?: string | TileArtTheme,
): string | null {
  const normalizedType = normalizeDecorType(type);
  if (!normalizedType) return null;
  const resolvedTheme = resolveMapArtTheme(theme);
  const frameCount = getDecorFrameCount(normalizedType);
  const safeFrame = Math.max(0, Math.min(frameCount - 1, Math.floor(frame)));
  return `/art/decor/decor_${resolvedTheme}_${normalizedType}_idle_${safeFrame}.png`;
}
