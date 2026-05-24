// Phase 0: level data to be rewritten in Phase 3
import { TileType, TowerType, LevelTheme, type LevelConfig } from '../../types/index.js';

export const LEVEL_02: LevelConfig = {
  id: 'L2_desert',
  name: '沙漠',
  theme: LevelTheme.Desert,
  description: 'Phase 3 将重写关卡数据',
  map: { name: '沙漠', cols: 21, rows: 9, tileSize: 64, tiles: [] },
  waves: [],
  startingGold: 200,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Ice],
  availableUnits: [],
  unlockStarsRequired: 2,
  unlockPrevLevelId: 'L1_plains',
};
