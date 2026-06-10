import { describe, expect, it } from 'vitest';
import { TileType, type MapConfig } from '../types/index.js';
import { getPathConnectorId, getTileTexturePath, isPathConnectable, resolveMapArtTheme } from './pathTileTexture.js';

function makeMap(tiles: TileType[][], artTheme: MapConfig['artTheme'] = 'meadow'): MapConfig {
  return {
    name: 'test',
    cols: tiles[0]?.length ?? 0,
    rows: tiles.length,
    tileSize: 64,
    tiles,
    artTheme,
  };
}

describe('pathTileTexture', () => {
  it('treats path, spawn and base as connectable tiles', () => {
    expect(isPathConnectable(TileType.Path)).toBe(true);
    expect(isPathConnectable(TileType.Spawn)).toBe(true);
    expect(isPathConnectable(TileType.Base)).toBe(true);
    expect(isPathConnectable(TileType.Empty)).toBe(false);
    expect(isPathConnectable(TileType.Blocked)).toBe(false);
  });

  it('resolves runtime art themes and plains alias', () => {
    expect(resolveMapArtTheme('plains')).toBe('meadow');
    expect(resolveMapArtTheme('desert')).toBe('desert');
    expect(resolveMapArtTheme('unknown')).toBe('meadow');
  });

  it('selects straight path connectors', () => {
    const horizontal = makeMap([[
      TileType.Spawn,
      TileType.Path,
      TileType.Base,
    ]]);
    expect(getPathConnectorId(horizontal, 0, 1)).toBe('straight_h');

    const vertical = makeMap([
      [TileType.Spawn],
      [TileType.Path],
      [TileType.Base],
    ]);
    expect(getPathConnectorId(vertical, 1, 0)).toBe('straight_v');
  });

  it('selects all corner connectors from neighboring path directions', () => {
    expect(getPathConnectorId(makeMap([
      [TileType.Empty, TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Empty, TileType.Empty],
    ]), 1, 1)).toBe('corner_ne');

    expect(getPathConnectorId(makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('corner_es');

    expect(getPathConnectorId(makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('corner_sw');

    expect(getPathConnectorId(makeMap([
      [TileType.Empty, TileType.Path, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Empty, TileType.Empty],
    ]), 1, 1)).toBe('corner_wn');
  });

  it('selects tee and cross connectors', () => {
    expect(getPathConnectorId(makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('tee_n');

    expect(getPathConnectorId(makeMap([
      [TileType.Empty, TileType.Path, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('cross');
  });

  it('returns endpoint and connector texture paths with the map art theme', () => {
    const map = makeMap([[
      TileType.Spawn,
      TileType.Path,
      TileType.Base,
      TileType.Empty,
      TileType.Blocked,
    ]], 'abyss');

    expect(getTileTexturePath(map, 0, 0)).toBe('/art/tiles/tile_abyss_path_endpoint_spawn.png');
    expect(getTileTexturePath(map, 0, 1)).toBe('/art/tiles/tile_abyss_path_straight_h.png');
    expect(getTileTexturePath(map, 0, 2)).toBe('/art/tiles/tile_abyss_path_endpoint_crystal.png');
    expect(getTileTexturePath(map, 0, 3)).toBe('/art/tiles/tile_abyss_buildable.png');
    expect(getTileTexturePath(map, 0, 4)).toBe('/art/tiles/tile_abyss_obstacle.png');
  });

  it('falls back to the base path texture for an isolated path tile', () => {
    const map = makeMap([[TileType.Path]], 'castle');
    expect(getTileTexturePath(map, 0, 0)).toBe('/art/tiles/tile_castle_path.png');
  });
});
