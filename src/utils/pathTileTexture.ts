import { TileType, type MapConfig, type TileArtTheme } from '../types/index.js';

type Direction = 'n' | 'e' | 's' | 'w';
type ConnectorId =
  | 'straight_h'
  | 'straight_v'
  | 'corner_ne'
  | 'corner_es'
  | 'corner_sw'
  | 'corner_wn'
  | 'tee_n'
  | 'tee_e'
  | 'tee_s'
  | 'tee_w'
  | 'cross'
  | 'path';

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

function hasConnection(map: MapConfig, row: number, col: number, direction: Direction): boolean {
  const nr = row + (direction === 'n' ? -1 : direction === 's' ? 1 : 0);
  const nc = col + (direction === 'w' ? -1 : direction === 'e' ? 1 : 0);
  if (nr < 0 || nr >= map.rows || nc < 0 || nc >= map.cols) return false;
  return isPathConnectable(map.tiles[nr]?.[nc]);
}

export function getPathConnectorId(map: MapConfig, row: number, col: number): ConnectorId {
  const n = hasConnection(map, row, col, 'n');
  const e = hasConnection(map, row, col, 'e');
  const s = hasConnection(map, row, col, 's');
  const w = hasConnection(map, row, col, 'w');
  const count = Number(n) + Number(e) + Number(s) + Number(w);

  if (count >= 4) return 'cross';
  if (count === 3) {
    if (!n) return 'tee_n';
    if (!e) return 'tee_e';
    if (!s) return 'tee_s';
    return 'tee_w';
  }
  if (count === 2) {
    if (w && e) return 'straight_h';
    if (n && s) return 'straight_v';
    if (n && e) return 'corner_ne';
    if (e && s) return 'corner_es';
    if (s && w) return 'corner_sw';
    if (w && n) return 'corner_wn';
  }
  if (n || s) return 'straight_v';
  if (e || w) return 'straight_h';
  return 'path';
}

export function getTileTexturePath(map: MapConfig, row: number, col: number): string | null {
  const tile = map.tiles[row]?.[col];
  if (!tile) return null;

  const theme = map.artTheme ?? resolveMapArtTheme();
  if (tile === TileType.Empty) return `/art/tiles/tile_${theme}_buildable.png`;
  if (tile === TileType.Blocked) return `/art/tiles/tile_${theme}_obstacle.png`;
  if (tile === TileType.Spawn) return `/art/tiles/tile_${theme}_path_endpoint_spawn.png`;
  if (tile === TileType.Base) return `/art/tiles/tile_${theme}_path_endpoint_crystal.png`;
  if (tile === TileType.Path) {
    const connectorId = getPathConnectorId(map, row, col);
    if (connectorId === 'path') return `/art/tiles/tile_${theme}_path.png`;
    return `/art/tiles/tile_${theme}_path_${connectorId}.png`;
  }
  return null;
}
