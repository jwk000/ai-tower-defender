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
  // Row 1 — spawn_a enters here, path runs left toward col 5
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Spawn,
  ],
  // Row 2 — spawn_b enters here, path runs left toward col 5
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Path,    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Spawn,
  ],
  // Row 3 — S-bend: path goes RIGHT from col 5 to col 16
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Path,    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Path,    TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 4 — vertical column connecting row 3→5 at col 16
  [
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Path,    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty, TileType.Empty, TileType.Path,    TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 5 — final leftward sprint to the crystal at col 0
  [
    TileType.Base,    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,    TileType.Path,
    TileType.Path,    TileType.Path,    TileType.Empty, TileType.Empty, TileType.Empty,
    TileType.Empty,
  ],
  // Row 6 (empty — tower placement zone below path)
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
        { id: 'n_spawn_a',  row: 1, col: 20, role: 'spawn',          spawnId: 'spawn_a' },
        { id: 'n_spawn_b',  row: 2, col: 20, role: 'spawn',          spawnId: 'spawn_b' },
        { id: 'n_turn1_a',  row: 1, col: 5,  role: 'waypoint' },
        { id: 'n_merge',    row: 2, col: 5,  role: 'waypoint' },
        { id: 'n_s_right',  row: 3, col: 16, role: 'waypoint' },
        { id: 'n_s_down',   row: 5, col: 16, role: 'waypoint' },
        { id: 'n_crystal',  row: 5, col: 0,  role: 'crystal_anchor' },
      ],
      edges: [
        { from: 'n_spawn_a',  to: 'n_turn1_a',  weight: 15 },
        { from: 'n_spawn_b',  to: 'n_merge',     weight: 15 },
        { from: 'n_turn1_a',  to: 'n_merge',     weight: 1 },
        { from: 'n_merge',    to: 'n_s_right',    weight: 12 },
        { from: 'n_s_right',  to: 'n_s_down',     weight: 2 },
        { from: 'n_s_down',   to: 'n_crystal',   weight: 16 },
      ],
    },

    spawns: [
      { id: 'spawn_a', row: 1, col: 20 },
      { id: 'spawn_b', row: 2, col: 20 },
    ],

    obstaclePlacements: [
      { row: 0, col: 5,  type: ObstacleType.Tree },
      { row: 2, col: 8,  type: ObstacleType.Tree },
      { row: 2, col: 10, type: ObstacleType.Bush },
      { row: 3, col: 8,  type: ObstacleType.Bush },
      { row: 3, col: 12, type: ObstacleType.Tree },
      { row: 4, col: 10, type: ObstacleType.Tree },
      { row: 4, col: 14, type: ObstacleType.Bush },
      { row: 6, col: 5,  type: ObstacleType.Tree },
      { row: 7, col: 16, type: ObstacleType.Bush },
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
