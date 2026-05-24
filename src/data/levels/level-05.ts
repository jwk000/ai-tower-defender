// Phase 0: level data to be rewritten in Phase 3
import { TileType, TowerType, LevelTheme, type LevelConfig } from '../../types/index.js';

export const LEVEL_05: LevelConfig = {
  id: 'L5_castle',
  name: '城堡',
  theme: LevelTheme.Castle,
  description: 'Phase 3 将重写关卡数据',
  map: { name: '城堡', cols: 21, rows: 9, tileSize: 64, tiles: [] },
  waves: [],
  startingGold: 180,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning, TowerType.Laser, TowerType.Missile],
  availableUnits: [],
  unlockStarsRequired: 8,
  unlockPrevLevelId: 'L4_volcano',
};
