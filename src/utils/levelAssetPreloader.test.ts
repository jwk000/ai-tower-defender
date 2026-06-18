import { describe, expect, it } from 'vitest';
import { LEVELS } from '../data/levels/index.js';
import { collectLevelAtlasIds } from './levelAssetPreloader.js';

describe('levelAssetPreloader', () => {
  it('collects the current level enemy shards, theme, towers, and shared battle atlases', () => {
    const level = LEVELS[4]!;

    const atlasIds = collectLevelAtlasIds(level);

    expect(atlasIds).toEqual(expect.arrayContaining([
      'level_05_enemies_01',
      'level_05_enemies_02',
      'level_05_enemies_03',
      'level_05_enemies_04',
      'level_05_enemies_05',
      'theme_abyss_tiles',
      'tower_arrow',
      'tower_missile',
      'player_units_01',
      'fx_objectives',
      'ui_common_01',
    ]));
    expect(atlasIds).not.toContain('level_01_enemies');
    expect(atlasIds).not.toContain('level_04_enemies_01');
  });
});
