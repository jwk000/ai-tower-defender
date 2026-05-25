import { TileType, TowerType, UnitType, EnemyType, ObstacleType, LevelTheme, WeatherType, type LevelConfig } from '../../types/index.js';

const E = TileType.Empty;
const P = TileType.Path;
const B = TileType.Blocked;

const tiles: TileType[][] = [
  // Row 0: spawn at col 1, path right to col 5
  [E, P, P, P, P, P, E, B, E, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 1: path vertical (col 5), blocked at bends
  [E, E, E, E, B, P, E, E, B, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 2: path right to col 8
  [E, E, E, E, E, P, P, P, P, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 3: path vertical (col 8), blocked inner corner
  [E, E, E, E, E, E, E, B, P, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 4: path vertical (col 8), blocked inner corner
  [E, E, E, E, E, E, E, B, P, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 5: path left to col 4, blocked near left turn
  [E, E, E, B, P, P, P, P, P, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 6: path vertical (col 4)
  [E, E, E, E, P, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E],
  // Row 7: path right to col 18, blocked near exit
  [E, E, E, E, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, B, E],
  // Row 8: path to crystal at col 20, blocked near exit
  [E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, E, B, P, P, P],
];

export const LEVEL_03: LevelConfig = {
  id: 'L3_castle',
  name: '黑暗古堡',
  theme: LevelTheme.Castle,
  description: '暗夜笼罩的古堡，多弯折的走廊隐藏着黑暗力量',
  sceneDescription: '森林古堡，暗夜笼罩，雾气弥漫',
  map: {
    name: '黑暗古堡',
    cols: 21,
    rows: 9,
    tileSize: 64,
    tiles,
    spawns: [{ id: 'spawn_main', row: 0, col: 1 }],
    pathGraph: {
      nodes: [
        { id: 'n1', row: 0, col: 1, role: 'spawn', spawnId: 'spawn_main' },
        { id: 'n2', row: 0, col: 5, role: 'waypoint' },
        { id: 'n3', row: 2, col: 5, role: 'waypoint' },
        { id: 'n4', row: 2, col: 8, role: 'waypoint' },
        { id: 'n5', row: 5, col: 8, role: 'waypoint' },
        { id: 'n6', row: 5, col: 4, role: 'waypoint' },
        { id: 'n7', row: 7, col: 4, role: 'waypoint' },
        { id: 'n8', row: 7, col: 18, role: 'waypoint' },
        { id: 'n9', row: 8, col: 20, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
        { from: 'n4', to: 'n5' },
        { from: 'n5', to: 'n6' },
        { from: 'n6', to: 'n7' },
        { from: 'n7', to: 'n8' },
        { from: 'n8', to: 'n9' },
      ],
    },
    obstaclePlacements: [
      { row: 1, col: 4, type: ObstacleType.Pillar },
      { row: 0, col: 7, type: ObstacleType.Rubble },
      { row: 1, col: 8, type: ObstacleType.Pillar },
      { row: 3, col: 7, type: ObstacleType.Rubble },
      { row: 4, col: 7, type: ObstacleType.Pillar },
      { row: 5, col: 3, type: ObstacleType.Rubble },
      { row: 7, col: 19, type: ObstacleType.Pillar },
      { row: 8, col: 17, type: ObstacleType.Rubble },
    ],
  },
  waves: [
    {
      waveNumber: 1,
      enemies: [{ enemyType: EnemyType.Werewolf, count: 6, spawnInterval: 2.0 }],
      spawnDelay: 2,
      reward: 30,
    },
    {
      waveNumber: 2,
      enemies: [
        { enemyType: EnemyType.Werewolf, count: 5, spawnInterval: 2.0 },
        { enemyType: EnemyType.VampireBat, count: 5, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 40,
    },
    {
      waveNumber: 3,
      enemies: [
        { enemyType: EnemyType.Werewolf, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.VampireBat, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Wizard, count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 50,
    },
    {
      waveNumber: 4,
      enemies: [
        { enemyType: EnemyType.Werewolf, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.VampireBat, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Wizard, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Priest, count: 1, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 60,
    },
    {
      waveNumber: 5,
      enemies: [
        { enemyType: EnemyType.Werewolf, count: 3, spawnInterval: 2.5 },
        { enemyType: EnemyType.VampireBat, count: 3, spawnInterval: 2.5 },
        { enemyType: EnemyType.Wizard, count: 2, spawnInterval: 2.5 },
        { enemyType: EnemyType.Priest, count: 1, spawnInterval: 2.5 },
        { enemyType: EnemyType.Frankenstein, count: 1, spawnInterval: 2.5 },
      ],
      spawnDelay: 2,
      reward: 70,
    },
    {
      waveNumber: 6,
      enemies: [
        { enemyType: EnemyType.Werewolf, count: 5, spawnInterval: 2.0 },
        { enemyType: EnemyType.VampireBat, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Wizard, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Priest, count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 80,
    },
    {
      waveNumber: 7,
      enemies: [
        { enemyType: EnemyType.Lucifer, count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Werewolf, count: 3, spawnInterval: 1.5 },
        { enemyType: EnemyType.Priest, count: 2, spawnInterval: 1.5 },
      ],
      spawnDelay: 3,
      isBossWave: true,
      reward: 120,
    },
  ],
  startingGold: 200,
  availableTowers: [TowerType.Arrow, TowerType.Laser, TowerType.Bat],
  availableUnits: [UnitType.ShieldGuard, UnitType.Archer, UnitType.Mage, UnitType.Priest],
  unlockStarsRequired: 4,
  unlockPrevLevelId: 'L2_desert',
  weatherFixed: WeatherType.Night,
};
