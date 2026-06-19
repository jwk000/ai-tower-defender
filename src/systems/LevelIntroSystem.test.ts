import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { TileType, type MapConfig } from '../types/index.js';
import { Sound } from '../utils/Sound.js';
import { LevelIntroSystem } from './LevelIntroSystem.js';

function createMap(): MapConfig {
  return {
    name: 'intro test',
    cols: 3,
    rows: 1,
    tileSize: 64,
    tiles: [[TileType.Spawn, TileType.Path, TileType.Base]],
    spawns: [{ id: 'spawn', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 'spawn', row: 0, col: 0, role: 'spawn' },
        { id: 'crystal', row: 0, col: 2, role: 'crystal_anchor' },
      ],
      edges: [{ from: 'spawn', to: 'crystal' }],
    },
  };
}

function createMockContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() };
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('LevelIntroSystem audio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('plays drop sound once for each tile when it lands and break sound when route tiles are revealed', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const renderer = { context: createMockContext() };
    const system = new LevelIntroSystem(renderer as never, createMap());

    system.start();
    expect(playSpy).not.toHaveBeenCalledWith('intro_tile_drop');

    const world = new TowerWorld();
    system.update(world, 1.19);
    expect(playSpy).not.toHaveBeenCalledWith('intro_tile_drop');

    system.update(world, 0.02);
    expect(playSpy.mock.calls.filter(([key]) => key === 'intro_tile_drop')).toHaveLength(3);

    system.update(world, 0.7);
    system.update(world, 0.61);
    system.update(world, 0.61);
    system.update(world, 0.51);
    system.update(world, 0.02);

    expect(playSpy).toHaveBeenCalledWith('intro_path_break');
  });
});
