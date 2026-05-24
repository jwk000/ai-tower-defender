// Phase 0: level data to be rewritten in Phase 3
import { TileType, TowerType, LevelTheme, type LevelConfig } from '../../types/index.js';

export const LEVEL_03: LevelConfig = {
  id: 'L3_tundra',
  name: '冰原',
  theme: LevelTheme.Tundra,
  description: 'Phase 3 将重写关卡数据',
  map: { name: '冰原', cols: 21, rows: 9, tileSize: 64, tiles: [] },
  waves: [],
  startingGold: 200,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning],
  availableUnits: [],
  unlockStarsRequired: 4,
  unlockPrevLevelId: 'L2_desert',
};
