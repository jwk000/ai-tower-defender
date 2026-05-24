// Phase 0: level data to be rewritten in Phase 3
import { TileType, TowerType, LevelTheme, type LevelConfig } from '../../types/index.js';

export const LEVEL_01: LevelConfig = {
  id: 'L1_plains',
  name: '平原',
  theme: LevelTheme.Plains,
  description: 'Phase 3 将重写关卡数据',
  map: { name: '平原', cols: 21, rows: 9, tileSize: 64, tiles: [] },
  waves: [],
  startingGold: 220,
  availableTowers: [TowerType.Arrow, TowerType.Cannon],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: null,
};
