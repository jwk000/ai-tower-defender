import { describe, expect, it } from 'vitest';
import { ObstacleType } from '../types/index.js';
import { decorArtPath, getDecorFrameCount, normalizeDecorType } from './decorArt.js';

describe('decorArt', () => {
  it('builds theme-scoped decoration frame paths', () => {
    expect(decorArtPath(ObstacleType.Tree, 1, 'plains')).toBe('/art/decor/decor_meadow_tree_idle_1.png');
    expect(decorArtPath(ObstacleType.Brazier, 8, 'castle')).toBe('/art/decor/decor_castle_brazier_idle_2.png');
  });

  it('normalizes legacy level decoration aliases', () => {
    expect(normalizeDecorType('crystal')).toBe(ObstacleType.CrystalObstacle);
    expect(normalizeDecorType('rift')).toBe(ObstacleType.VoidRift);
    expect(decorArtPath('crystal', 0, 'abyss')).toBe('/art/decor/decor_abyss_crystal_obstacle_idle_0.png');
    expect(decorArtPath('rift', 3, 'abyss')).toBe('/art/decor/decor_abyss_void_rift_idle_3.png');
  });

  it('keeps per-decoration frame counts for animation timing', () => {
    expect(getDecorFrameCount(ObstacleType.Rock)).toBe(1);
    expect(getDecorFrameCount(ObstacleType.PurpleFlame)).toBe(3);
    expect(getDecorFrameCount(ObstacleType.VoidRift)).toBe(4);
  });
});
