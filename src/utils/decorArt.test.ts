import { describe, expect, it } from 'vitest';
import { ObstacleType } from '../types/index.js';
import {
  decorArtPath,
  getDecorFrameCount,
  getDecorParticleKind,
  getDecorVariantIndex,
  normalizeDecorType,
} from './decorArt.js';

describe('decorArt', () => {
  it('builds theme-scoped static decoration paths', () => {
    expect(decorArtPath(ObstacleType.Tree, 1, 'plains')).toBe('/art/decor/decor_meadow_tree_idle_1.png');
    expect(decorArtPath(ObstacleType.Brazier, 8, 'castle')).toBe('/art/decor/decor_castle_brazier_idle_2.png');
  });

  it('normalizes legacy level decoration aliases', () => {
    expect(normalizeDecorType('crystal')).toBe(ObstacleType.CrystalObstacle);
    expect(normalizeDecorType('rift')).toBe(ObstacleType.VoidRift);
    expect(decorArtPath('crystal', 1, 'abyss')).toBe('/art/decor/decor_abyss_crystal_obstacle_idle_1.png');
    expect(decorArtPath('rift', 3, 'abyss')).toBe('/art/decor/decor_abyss_void_rift_idle_3.png');
  });

  it('keeps generated frames as static variants and classifies runtime particles', () => {
    expect(getDecorFrameCount(ObstacleType.Rock)).toBe(1);
    expect(getDecorFrameCount(ObstacleType.Cactus)).toBe(2);
    expect(getDecorFrameCount(ObstacleType.PurpleFlame)).toBe(3);
    expect(getDecorFrameCount(ObstacleType.VoidRift)).toBe(4);
    expect(getDecorParticleKind(ObstacleType.Tree)).toBe('leaf_motes');
    expect(getDecorParticleKind(ObstacleType.Brazier)).toBe('ember_motes');
    expect(getDecorParticleKind(ObstacleType.VoidRift)).toBe('rift_sparks');
    expect(getDecorParticleKind(ObstacleType.SteamPipe)).toBe('steam_puffs');
    expect(getDecorParticleKind(ObstacleType.Rock)).toBe('none');
  });

  it('selects a stable static variant from map position', () => {
    const first = getDecorVariantIndex(ObstacleType.Cactus, 4, 7, 'desert');
    const second = getDecorVariantIndex(ObstacleType.Cactus, 4, 7, 'desert');
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(getDecorFrameCount(ObstacleType.Cactus));
    expect(getDecorVariantIndex(ObstacleType.Rock, 4, 7, 'desert')).toBe(0);
  });
});
