// Phase 0: level data to be rewritten in Phase 3
import { TileType, TowerType, LevelTheme, type LevelConfig } from '../../types/index.js';

export const LEVEL_04: LevelConfig = {
  id: 'L4_volcano',
  name: '火山',
  theme: LevelTheme.Volcano,
  description: 'Phase 3 将重写关卡数据',
  map: { name: '火山', cols: 21, rows: 9, tileSize: 64, tiles: [] },
  waves: [],
  startingGold: 180,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning, TowerType.Laser],
  availableUnits: [],
  unlockStarsRequired: 6,
  unlockPrevLevelId: 'L3_tundra',
};
