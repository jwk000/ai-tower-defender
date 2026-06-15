import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { ObstacleType, TileType, WeatherType, type MapConfig } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import { DecorationSystem } from './DecorationSystem.js';
import { clearArtAtlasRegistryForTests, getLoadedImageFrame, registerArtAtlasManifest } from '../utils/imageCache.js';
import { setArtResourcesEnabled } from '../utils/artResourceSwitch.js';

class LoadedImage {
  complete = true;
  naturalWidth = 64;
  naturalHeight = 64;
  width = 64;
  height = 64;
  src = '';
  onerror: (() => void) | null = null;
}

class RendererStub {
  commands: RenderCommand[] = [];
  private gradient = { addColorStop: vi.fn() };
  context = {
    createLinearGradient: vi.fn(() => this.gradient),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };

  push(command: RenderCommand): void {
    this.commands.push(command);
  }
}

function makeMap(): MapConfig {
  return {
    name: 'decoration-test',
    cols: 1,
    rows: 1,
    tileSize: 64,
    tiles: [[TileType.Empty]],
    artTheme: 'meadow',
    obstaclePlacements: [
      { row: 0, col: 0, type: ObstacleType.Tree },
    ],
  };
}

describe('DecorationSystem', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setArtResourcesEnabled(true);
    clearArtAtlasRegistryForTests();
    DecorationSystem.introDecorAlpha = 1;
  });

  it('keeps particles but does not draw composite visuals when static decor art is available', () => {
    vi.stubGlobal('Image', LoadedImage);
    registerArtAtlasManifest({
      id: 'decor_plains',
      image: '/art/atlases/decor/plains.png',
      frames: {
        '/art/decor/decor_meadow_tree_idle_0.png': { x: 0, y: 0, w: 64, h: 64 },
        '/art/decor/decor_meadow_tree_idle_1.png': { x: 64, y: 0, w: 64, h: 64 },
      },
    });
    getLoadedImageFrame('/art/decor/decor_meadow_tree_idle_0.png');
    getLoadedImageFrame('/art/decor/decor_meadow_tree_idle_1.png');

    const renderer = new RendererStub();
    const system = new DecorationSystem(
      renderer as unknown as ConstructorParameters<typeof DecorationSystem>[0],
      makeMap(),
      () => WeatherType.Rain,
      () => false,
      1,
    );

    system.update(new TowerWorld(), 1 / 60);

    const staticDecorImages = renderer.commands.filter((cmd) => cmd.image && cmd.z === 1);
    const leafParticles = renderer.commands.filter((cmd) => cmd.color === '#9ccc65' || cmd.color === '#dce775');
    const treeCompositeVisuals = renderer.commands.filter((cmd) => cmd.color === '#5d4037' || cmd.color === '#2e7d32');

    expect(staticDecorImages).toHaveLength(1);
    expect(leafParticles.length).toBeGreaterThan(0);
    expect(treeCompositeVisuals).toHaveLength(0);
  });
});
