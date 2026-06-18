import type { LevelConfig, TileArtTheme, TowerType } from '../types/index.js';
import { preloadArtAtlasesById, type ImagePreloadResult } from './imageCache.js';

export interface LevelAssetPreloadReport {
  atlasIds: string[];
  results: ImagePreloadResult[];
  failed: string[];
}

const GLOBAL_BATTLE_ATLASES = [
  'player_units_01',
  'player_units_02',
  'player_units_03',
  'fx_objectives',
  'icons_common',
  'ui_common_01',
  'ui_common_02',
  'ui_common_03',
  'ui_common_04',
];

const LEVEL_ENEMY_ATLASES: Record<string, string[]> = {
  level_01: ['level_01_enemies'],
  level_02: ['level_02_enemies'],
  level_03: ['level_03_enemies_01', 'level_03_enemies_02'],
  level_04: ['level_04_enemies_01', 'level_04_enemies_02'],
  level_05: [
    'level_05_enemies_01',
    'level_05_enemies_02',
    'level_05_enemies_03',
    'level_05_enemies_04',
    'level_05_enemies_05',
  ],
};

function resolveThemeAtlas(theme: string | TileArtTheme | undefined): string {
  const normalized = (theme ?? 'meadow').toLowerCase();
  const artTheme = normalized === 'plains' ? 'meadow' : normalized;
  return `theme_${artTheme}_tiles`;
}

function resolveTowerAtlas(tower: TowerType | string): string {
  return `tower_${tower}`;
}

export function collectLevelAtlasIds(config: LevelConfig): string[] {
  const atlasIds = new Set<string>(GLOBAL_BATTLE_ATLASES);
  atlasIds.add(resolveThemeAtlas(config.map.artTheme ?? config.theme));

  for (const atlasId of LEVEL_ENEMY_ATLASES[config.id] ?? []) {
    atlasIds.add(atlasId);
  }
  for (const tower of config.availableTowers) {
    atlasIds.add(resolveTowerAtlas(tower));
  }

  return [...atlasIds];
}

export async function preloadLevelAssets(config: LevelConfig): Promise<LevelAssetPreloadReport> {
  const atlasIds = collectLevelAtlasIds(config);
  const results = await preloadArtAtlasesById(atlasIds);
  return {
    atlasIds,
    results,
    failed: results.filter((result) => !result.ok).map((result) => result.path),
  };
}
