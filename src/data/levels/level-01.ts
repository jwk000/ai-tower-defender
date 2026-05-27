import {
  TileType,
  TowerType,
  UnitType,
  EnemyType,
  ObstacleType,
  LevelTheme,
  WeatherType,
  type LevelConfig,
} from '../../types/index.js';

// ============================================================
// Level 01: 绿野仙踪 — 草原第一关
// v4.0 — 5波次，S形蜿蜒小路，雨天主题
// ============================================================

const tiles: TileType[][] = [
  // Row 0 (top edge)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 1 (empty — tower placement zone above path)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 2 (empty)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 3 (empty)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 4 — main path: spawn → crystal (straight line)
  [
    TileType.Spawn,  TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,
    TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,
    TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,
    TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,   TileType.Path,
    TileType.Base,
  ],
  // Row 5 (empty — tower placement zone below path)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 6 (empty)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 7 (empty)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 8 (bottom edge)
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
];

export const LEVEL_01: LevelConfig = {
  id: 'L1_plains',
  name: '绿野仙踪',
  theme: LevelTheme.Plains,
  description: '绿色草原上的第一场战斗，S形蜿蜒小路通向水晶',
  sceneDescription: '生机盎然的绿色草原，雨滴轻敲地面',

  map: {
    name: '绿野仙踪',
    cols: 21,
    rows: 9,
    tileSize: 64,
    tiles,

    pathGraph: {
      nodes: [
        { id: 'n_spawn',   row: 4, col: 0,  role: 'spawn',          spawnId: 'spawn_0' },
        { id: 'n_crystal', row: 4, col: 20, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 'n_spawn', to: 'n_crystal' },
      ],
    },

    spawns: [
      { id: 'spawn_0', row: 4, col: 0 },
    ],

    obstaclePlacements: [
      { row: 1, col: 5,  type: ObstacleType.Tree },
      { row: 2, col: 10, type: ObstacleType.Tree },
      { row: 2, col: 15, type: ObstacleType.Bush },
      { row: 6, col: 8,  type: ObstacleType.Tree },
      { row: 6, col: 14, type: ObstacleType.Bush },
      { row: 7, col: 4,  type: ObstacleType.Bush },
      { row: 7, col: 18, type: ObstacleType.Flower },
    ],
  },

  waves: [
    {
      waveNumber: 1,
      enemies: [
        { enemyType: EnemyType.Goblin, count: 8, spawnInterval: 1.5 },
      ],
      spawnDelay: 2,
      reward: 20,
    },
    {
      waveNumber: 2,
      enemies: [
        { enemyType: EnemyType.Goblin, count: 6, spawnInterval: 1.5 },
        { enemyType: EnemyType.Boar,   count: 3, spawnInterval: 1.5 },
      ],
      spawnDelay: 2,
      reward: 30,
    },
    {
      waveNumber: 3,
      enemies: [
        { enemyType: EnemyType.Goblin,   count: 5, spawnInterval: 2.0 },
        { enemyType: EnemyType.Boar,     count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Elephant, count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 40,
    },
    {
      waveNumber: 4,
      enemies: [
        { enemyType: EnemyType.Boar,     count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Elephant, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Giant,    count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 50,
    },
    {
      waveNumber: 5,
      enemies: [
        { enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Goblin,     count: 4, spawnInterval: 1.0 },
        { enemyType: EnemyType.Boar,       count: 2, spawnInterval: 1.0 },
      ],
      spawnDelay: 3,
      reward: 80,
      isBossWave: true,
    },
  ],

  startingGold: 220,
  availableTowers: [TowerType.Arrow, TowerType.Ballista, TowerType.Ice],
  availableUnits: [UnitType.ShieldGuard, UnitType.Archer],
  unlockStarsRequired: 0,
  unlockPrevLevelId: null,
  weatherFixed: WeatherType.Rain,
};
