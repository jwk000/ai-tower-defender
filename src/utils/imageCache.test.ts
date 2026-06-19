import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearArtAtlasRegistryForTests,
  drawLoadedCardFrameMask,
  drawLoadedImage,
  getLoadedImageFrame,
  isArtAtlasIndexLoaded,
  preloadArtAtlasIndex,
  preloadArtAtlasesById,
  registerArtAtlasManifest,
} from './imageCache.js';
import { setArtResourcesEnabled } from './artResourceSwitch.js';

class LoadedImage {
  complete = true;
  naturalWidth = 512;
  naturalHeight = 512;
  width = 512;
  height = 512;
  src = '';
  onerror: (() => void) | null = null;
}

describe('imageCache atlas loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setArtResourcesEnabled(true);
    clearArtAtlasRegistryForTests();
  });

  it('returns atlas frame metadata when path is declared by a manifest', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);
    registerArtAtlasManifest({
      id: 'level_01_units',
      image: '/art/atlases/level_01_units.png',
      frames: {
        '/art/units/unit_enemy_goblin_idle_0.png': { x: 12, y: 24, w: 96, h: 96 },
      },
    });

    expect(getLoadedImageFrame('/art/units/unit_enemy_goblin_idle_0.png')).toBeNull();
    const frame = getLoadedImageFrame('/art/units/unit_enemy_goblin_idle_0.png');

    expect(frame).toEqual(expect.objectContaining({
      atlasId: 'level_01_units',
      source: { x: 12, y: 24, w: 96, h: 96 },
      width: 96,
      height: 96,
    }));
    expect(frame?.image).toBeInstanceOf(LoadedImage);
  });

  it('preserves source dimensions for tightly-cropped frames stored in padded atlas slots', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);
    registerArtAtlasManifest({
      id: 'fx_objectives',
      image: '/art/atlases/global/fx_objectives.png',
      frames: {
        '/art/fx/fx_missile_projectile.png': { x: 1292, y: 260, w: 256, h: 256, sourceW: 256, sourceH: 84 },
      },
    });

    expect(getLoadedImageFrame('/art/fx/fx_missile_projectile.png')).toBeNull();
    const frame = getLoadedImageFrame('/art/fx/fx_missile_projectile.png');

    expect(frame).toEqual(expect.objectContaining({
      atlasId: 'fx_objectives',
      source: { x: 1292, y: 260, w: 256, h: 256 },
      width: 256,
      height: 84,
    }));
  });

  it('falls back to a standalone image when no atlas frame matches', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);

    expect(getLoadedImageFrame('/art/cards/card_arrow_tower.png')).toBeNull();
    const frame = getLoadedImageFrame('/art/cards/card_arrow_tower.png');

    expect(frame).toEqual(expect.objectContaining({
      source: null,
      width: 512,
      height: 512,
      path: '/art/cards/card_arrow_tower.png',
    }));
  });

  it('drawLoadedImage uses atlas source rect when available', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);
    registerArtAtlasManifest({
      id: 'ui_shared',
      image: '/art/atlases/ui_shared.png',
      frames: {
        '/art/ui/ui_button_green.png': { x: 8, y: 16, w: 128, h: 48 },
      },
    });

    getLoadedImageFrame('/art/ui/ui_button_green.png');
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;

    expect(drawLoadedImage(ctx, '/art/ui/ui_button_green.png', 10, 20, 100, 40)).toBe(true);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.any(LoadedImage),
      8,
      16,
      128,
      48,
      10,
      20,
      100,
      40,
    );
  });

  it('drawLoadedCardFrameMask draws an offscreen masked card frame from atlas frames', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);
    const offscreenDrawImage = vi.fn();
    const offscreenFill = vi.fn();
    const offscreenCtx = {
      drawImage: offscreenDrawImage,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: offscreenFill,
      globalCompositeOperation: 'source-over',
      fillStyle: '',
    };
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') return {};
        return { width: 0, height: 0, getContext: () => offscreenCtx };
      },
    });
    registerArtAtlasManifest({
      id: 'ui_shared',
      image: '/art/atlases/ui_shared.png',
      frames: {
        '/art/ui/ui_card_frame_epic.png': { x: 8, y: 16, w: 1024, h: 1536 },
      },
    });

    getLoadedImageFrame('/art/ui/ui_card_frame_epic.png');
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;

    expect(drawLoadedCardFrameMask(ctx, '/art/ui/ui_card_frame_epic.png', 10, 20, 120, 168)).toBe(true);
    expect(offscreenDrawImage).toHaveBeenCalledWith(
      expect.any(LoadedImage),
      8,
      16,
      1024,
      1536,
      0,
      0,
      1024,
      1536,
    );
    expect(offscreenFill).toHaveBeenCalledTimes(3);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.objectContaining({ __cardFrameMask: true }),
      10,
      20,
      120,
      168,
    );
  });

  it('returns null when art resources are disabled', () => {
    vi.stubGlobal('Image', LoadedImage);
    vi.stubGlobal('fetch', undefined);
    registerArtAtlasManifest({
      id: 'level_01_units',
      image: '/art/atlases/level_01_units.png',
      frames: {
        '/art/units/unit_enemy_goblin_idle_0.png': { x: 12, y: 24, w: 96, h: 96 },
      },
    });

    setArtResourcesEnabled(false);

    expect(getLoadedImageFrame('/art/units/unit_enemy_goblin_idle_0.png')).toBeNull();
  });

  it('preloads the atlas index and resolves later frame requests through it', async () => {
    vi.stubGlobal('Image', LoadedImage);
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        atlases: [
          {
            id: 'generated_units',
            image: '/art/atlases/units/generated_units.png',
            frames: {
              '/art/units/unit_enemy_boar_idle_0.png': { x: 256, y: 512, w: 256, h: 256 },
            },
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetch);

    await preloadArtAtlasIndex();

    expect(fetch).toHaveBeenCalledWith('/art/atlases/index.json');
    expect(isArtAtlasIndexLoaded()).toBe(true);
    expect(getLoadedImageFrame('/art/units/unit_enemy_boar_idle_0.png')).toBeNull();
    const frame = getLoadedImageFrame('/art/units/unit_enemy_boar_idle_0.png');

    expect(frame).toEqual(expect.objectContaining({
      atlasId: 'generated_units',
      source: { x: 256, y: 512, w: 256, h: 256 },
    }));
  });

  it('preloads only requested atlas images by id', async () => {
    vi.stubGlobal('Image', LoadedImage);
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        atlases: [
          { id: 'level_01_enemies', image: '/art/atlases/levels/level_01_enemies.png', frames: {} },
          { id: 'level_02_enemies', image: '/art/atlases/levels/level_02_enemies.png', frames: {} },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetch);

    const results = await preloadArtAtlasesById(['level_02_enemies']);

    expect(results).toEqual([{ path: '/art/atlases/levels/level_02_enemies.png', ok: true }]);
  });
});
