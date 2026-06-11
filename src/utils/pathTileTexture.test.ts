import { describe, expect, it } from 'vitest';
import { TileType, type MapConfig } from '../types/index.js';
import { getTileTexturePath, getTileTexturePathForType, isPathConnectable, resolveMapArtTheme } from './pathTileTexture.js';

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

  it('uses a directionless path texture for straight paths', () => {
    const horizontal = makeMap([[
      TileType.Spawn,
      TileType.Path,
      TileType.Base,
    ]]);
    expect(getTileTexturePath(horizontal, 0, 1)).toBe('/art/tiles/tile_meadow_path.png');

    const vertical = makeMap([
      [TileType.Spawn],
      [TileType.Path],
      [TileType.Base],
    ]);
    expect(getTileTexturePath(vertical, 1, 0)).toBe('/art/tiles/tile_meadow_path.png');
  });

  it('uses a directionless path texture for corners, tees and crosses', () => {
    expect(getTileTexturePath(makeMap([
      [TileType.Empty, TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Empty, TileType.Empty],
    ]), 1, 1)).toBe('/art/tiles/tile_meadow_path.png');

    expect(getTileTexturePath(makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('/art/tiles/tile_meadow_path.png');

    expect(getTileTexturePath(makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('/art/tiles/tile_meadow_path.png');

    expect(getTileTexturePath(makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('/art/tiles/tile_meadow_path.png');

    expect(getTileTexturePath(makeMap([
      [TileType.Empty, TileType.Path, TileType.Empty],
      [TileType.Path, TileType.Path, TileType.Path],
      [TileType.Empty, TileType.Path, TileType.Empty],
    ]), 1, 1)).toBe('/art/tiles/tile_meadow_path.png');
  });

  it('returns endpoint and tile texture paths with the map art theme', () => {
    const map = makeMap([[
      TileType.Spawn,
      TileType.Path,
      TileType.Base,
      TileType.Empty,
      TileType.Blocked,
    ]], 'abyss');

    expect(getTileTexturePath(map, 0, 0)).toBe('/art/tiles/tile_abyss_path_endpoint_spawn.png');
    expect(getTileTexturePath(map, 0, 1)).toBe('/art/tiles/tile_abyss_path.png');
    expect(getTileTexturePath(map, 0, 2)).toBe('/art/tiles/tile_abyss_path_endpoint_crystal.png');
    expect(getTileTexturePath(map, 0, 3)).toBe('/art/tiles/tile_abyss_buildable.png');
    expect(getTileTexturePath(map, 0, 4)).toBe('/art/tiles/tile_abyss_obstacle.png');
  });

  it('returns tile texture paths directly from a tile type and theme', () => {
    expect(getTileTexturePathForType(TileType.Empty, 'desert')).toBe('/art/tiles/tile_desert_buildable.png');
    expect(getTileTexturePathForType(TileType.Path, 'castle')).toBe('/art/tiles/tile_castle_path.png');
    expect(getTileTexturePathForType(TileType.Spawn, 'wasteland')).toBe('/art/tiles/tile_wasteland_path_endpoint_spawn.png');
    expect(getTileTexturePathForType(TileType.Base, 'abyss')).toBe('/art/tiles/tile_abyss_path_endpoint_crystal.png');
    expect(getTileTexturePathForType(TileType.Blocked, 'plains')).toBe('/art/tiles/tile_meadow_obstacle.png');
  });

  it('falls back to the base path texture for an isolated path tile', () => {
    const map = makeMap([[TileType.Path]], 'castle');
    expect(getTileTexturePath(map, 0, 0)).toBe('/art/tiles/tile_castle_path.png');
  });
});
