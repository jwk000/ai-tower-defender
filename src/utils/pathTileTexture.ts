import { TileType, type MapConfig, type TileArtTheme } from '../types/index.js';

const TILE_ART_THEMES: readonly TileArtTheme[] = ['meadow', 'desert', 'castle', 'wasteland', 'abyss'];

const THEME_ALIASES: Record<string, TileArtTheme> = {
  plains: 'meadow',
  meadow: 'meadow',
  forest: 'meadow',
  desert: 'desert',
  castle: 'castle',
  wasteland: 'wasteland',
  abyss: 'abyss',
};

export function isPathConnectable(tile: TileType | undefined): boolean {
  return tile === TileType.Path || tile === TileType.Spawn || tile === TileType.Base;
}

export function resolveMapArtTheme(theme?: string): TileArtTheme {
  if (!theme) return 'meadow';
  const normalized = theme.toLowerCase();
  if ((TILE_ART_THEMES as readonly string[]).includes(normalized)) {
    return normalized as TileArtTheme;
  }
  return THEME_ALIASES[normalized] ?? 'meadow';
}

export function getTileTexturePath(map: MapConfig, row: number, col: number): string | null {
  const tile = map.tiles[row]?.[col];
  if (!tile) return null;

  const theme = map.artTheme ?? resolveMapArtTheme();
  if (tile === TileType.Empty) return `/art/tiles/tile_${theme}_buildable.png`;
  if (tile === TileType.Blocked) return `/art/tiles/tile_${theme}_obstacle.png`;
  if (tile === TileType.Spawn) return `/art/tiles/tile_${theme}_path_endpoint_spawn.png`;
  if (tile === TileType.Base) return `/art/tiles/tile_${theme}_path_endpoint_crystal.png`;
  if (tile === TileType.Path) return `/art/tiles/tile_${theme}_path.png`;
  return null;
}
