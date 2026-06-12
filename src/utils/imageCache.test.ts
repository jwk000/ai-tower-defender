import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearArtAtlasRegistryForTests,
  drawLoadedImage,
  getLoadedImageFrame,
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
});
