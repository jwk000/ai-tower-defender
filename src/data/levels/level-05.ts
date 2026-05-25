// Level 05: 深渊裂隙 (Abyss Rift) — Final boss level with triple spawn converging paths
import {
  TileType,
  TowerType,
  LevelTheme,
  EnemyType,
  UnitType,
  WeatherType,
  ObstacleType,
  type LevelConfig,
} from '../../types/index.js';

const { Empty, Path, Blocked, Base, Spawn } = TileType;

const EMPTY = Empty;
const PATH = Path;
const BLOCKED = Blocked;
const BASE = Base;
const SPAWN = Spawn;

const TILES: TileType[][] = [
  // row 0 (top edge — safe zones + blocked obstacles)
  [
    EMPTY, EMPTY, EMPTY, BLOCKED, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    BLOCKED, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, BLOCKED, EMPTY, EMPTY,
    EMPTY,
  ],
  // row 1 (top spawn + path leftward)
  [
    EMPTY, BLOCKED, EMPTY, EMPTY, EMPTY,
    BLOCKED, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    PATH, PATH, PATH, PATH, PATH,
    SPAWN,
  ],
  // row 2 (top path — diagonal transition down)
  [
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    PATH, PATH, PATH, PATH, PATH,
    PATH, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY,
  ],
  // row 3 (top path — final approach to merge)
  [
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, PATH, PATH, PATH, PATH,
    PATH, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY,
  ],
  // row 4 (mid spawn + merged path → crystal at col 0)
  [
    BASE, PATH, PATH, PATH, PATH,
    PATH, PATH, PATH, PATH, PATH,
    PATH, PATH, PATH, PATH, PATH,
    PATH, PATH, PATH, PATH, PATH,
    SPAWN,
  ],
  // row 5 (bot path — rising from below to merge)
  [
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, PATH, PATH, PATH, PATH,
    PATH, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY,
  ],
  // row 6 (bot path — diagonal transition up)
  [
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    PATH, PATH, PATH, PATH, PATH,
    PATH, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY,
  ],
  // row 7 (bot spawn + path leftward)
  [
    EMPTY, BLOCKED, EMPTY, EMPTY, EMPTY,
    BLOCKED, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    PATH, PATH, PATH, PATH, PATH,
    SPAWN,
  ],
  // row 8 (bottom edge — safe zones + blocked obstacles)
  [
    EMPTY, EMPTY, EMPTY, EMPTY, BLOCKED,
    EMPTY, EMPTY, EMPTY, EMPTY, EMPTY,
    EMPTY, BLOCKED, EMPTY, EMPTY, EMPTY,
    EMPTY, EMPTY, EMPTY, BLOCKED, EMPTY,
    EMPTY,
  ],
];

const SPAWNS = [
  { id: 'spawn_top', row: 1, col: 20 },
  { id: 'spawn_mid', row: 4, col: 20 },
  { id: 'spawn_bot', row: 7, col: 20 },
];

const PATH_GRAPH = {
  nodes: [
    { id: 'n_spawn_top',  row: 1, col: 20, role: 'spawn' as const,          spawnId: 'spawn_top' },
    { id: 'n_top_16',     row: 1, col: 16, role: 'waypoint' as const },
    { id: 'n_top_12',     row: 2, col: 12, role: 'waypoint' as const },
    { id: 'n_top_8',      row: 3, col: 8,  role: 'waypoint' as const },
    { id: 'n_spawn_mid',  row: 4, col: 20, role: 'spawn' as const,          spawnId: 'spawn_mid' },
    { id: 'n_mid_16',     row: 4, col: 16, role: 'waypoint' as const },
    { id: 'n_mid_12',     row: 4, col: 12, role: 'waypoint' as const },
    { id: 'n_mid_8',      row: 4, col: 8,  role: 'waypoint' as const },
    { id: 'n_spawn_bot',  row: 7, col: 20, role: 'spawn' as const,          spawnId: 'spawn_bot' },
    { id: 'n_bot_16',     row: 7, col: 16, role: 'waypoint' as const },
    { id: 'n_bot_12',     row: 6, col: 12, role: 'waypoint' as const },
    { id: 'n_bot_8',      row: 5, col: 8,  role: 'waypoint' as const },
    { id: 'n_merge',      row: 4, col: 6,  role: 'waypoint' as const },
    { id: 'n_crystal',    row: 4, col: 0,  role: 'crystal_anchor' as const },
  ],
  edges: [
    // Top path
    { from: 'n_spawn_top', to: 'n_top_16' },
    { from: 'n_top_16',    to: 'n_top_12' },
    { from: 'n_top_12',    to: 'n_top_8' },
    { from: 'n_top_8',     to: 'n_merge' },
    // Mid path
    { from: 'n_spawn_mid', to: 'n_mid_16' },
    { from: 'n_mid_16',    to: 'n_mid_12' },
    { from: 'n_mid_12',    to: 'n_mid_8' },
    { from: 'n_mid_8',     to: 'n_merge' },
    // Bot path
    { from: 'n_spawn_bot', to: 'n_bot_16' },
    { from: 'n_bot_16',    to: 'n_bot_12' },
    { from: 'n_bot_12',    to: 'n_bot_8' },
    { from: 'n_bot_8',     to: 'n_merge' },
    // Merged → Crystal
    { from: 'n_merge',     to: 'n_crystal' },
  ],
};

const OBSTACLES = [
  // Pillars (floating rocks) along top edge
  { type: ObstacleType.Pillar, row: 0, col: 3 },
  { type: ObstacleType.Pillar, row: 0, col: 10 },
  { type: ObstacleType.Pillar, row: 0, col: 17 },
  // Pillars along bottom edge
  { type: ObstacleType.Pillar, row: 8, col: 4 },
  { type: ObstacleType.Pillar, row: 8, col: 11 },
  { type: ObstacleType.Pillar, row: 8, col: 18 },
  // Braziers (purple flames) at corners
  { type: ObstacleType.Brazier, row: 0, col: 1 },
  { type: ObstacleType.Brazier, row: 0, col: 15 },
  { type: ObstacleType.Brazier, row: 8, col: 1 },
  { type: ObstacleType.Brazier, row: 8, col: 15 },
];

const ALL_TOWERS = [
  TowerType.Arrow,
  TowerType.Ballista,
  TowerType.Cannon,
  TowerType.Laser,
  TowerType.Bat,
  TowerType.Missile,
  TowerType.Ice,
  TowerType.Fire,
  TowerType.Poison,
  TowerType.Lightning,
];

const ALL_UNITS = [
  UnitType.ShieldGuard,
  UnitType.Archer,
  UnitType.Mage,
  UnitType.Priest,
];

export const LEVEL_05: LevelConfig = {
  id: 'L5_abyss',
  name: '深渊裂隙',
  theme: LevelTheme.Castle,
  description: '最终挑战——深渊裂隙，三个出生点同时进攻，十二波极限考验',
  sceneDescription: '深渊地下，黑暗压迫，紫色火焰跃动',
  map: {
    name: '深渊裂隙',
    cols: 21,
    rows: 9,
    tileSize: 64,
    tiles: TILES,
    spawns: SPAWNS,
    pathGraph: PATH_GRAPH,
    obstaclePlacements: OBSTACLES,
  },
  waves: [
    {
      waveNumber: 1,
      enemies: [
        { enemyType: EnemyType.Goblin,      count: 6, spawnInterval: 1.5 },
        { enemyType: EnemyType.DesertBeetle, count: 8, spawnInterval: 1.0 },
      ],
      spawnDelay: 2,
      reward: 40,
      spawnPointIndex: 0,
    },
    {
      waveNumber: 2,
      enemies: [
        { enemyType: EnemyType.Boar,         count: 4, spawnInterval: 1.5 },
        { enemyType: EnemyType.BurrowBeetle, count: 3, spawnInterval: 1.5 },
        { enemyType: EnemyType.Werewolf,     count: 3, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 50,
      spawnPointIndex: 0,
    },
    {
      waveNumber: 3,
      enemies: [
        { enemyType: EnemyType.Elephant,   count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Locust,     count: 5, spawnInterval: 1.5 },
        { enemyType: EnemyType.VampireBat, count: 5, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 60,
      spawnPointIndex: 1,
    },
    {
      waveNumber: 4,
      enemies: [
        { enemyType: EnemyType.Giant,    count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Wizard,   count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.RobotDog, count: 6, spawnInterval: 1.5 },
      ],
      spawnDelay: 2,
      reward: 70,
    },
    {
      waveNumber: 5,
      enemies: [
        { enemyType: EnemyType.GiantSlime,   count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.DesertBeetle, count: 6, spawnInterval: 1.0 },
      ],
      spawnDelay: 3,
      reward: 100,
      isBossWave: true,
    },
    {
      waveNumber: 6,
      enemies: [
        { enemyType: EnemyType.BombBeetle,    count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Priest,        count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone,         count: 5, spawnInterval: 1.5 },
        { enemyType: EnemyType.Frankenstein,  count: 1, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 80,
    },
    {
      waveNumber: 7,
      enemies: [
        { enemyType: EnemyType.QueenBeetle, count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Locust,      count: 8, spawnInterval: 1.0 },
      ],
      spawnDelay: 3,
      reward: 120,
      isBossWave: true,
    },
    {
      waveNumber: 8,
      enemies: [
        { enemyType: EnemyType.Tank,       count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Plane,      count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.OilTruck,   count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.GiantRobot, count: 1, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 90,
    },
    {
      waveNumber: 9,
      enemies: [
        { enemyType: EnemyType.Lucifer,  count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Werewolf, count: 4, spawnInterval: 1.5 },
        { enemyType: EnemyType.Wizard,   count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 3,
      reward: 140,
      isBossWave: true,
    },
    {
      waveNumber: 10,
      enemies: [
        { enemyType: EnemyType.Goblin,       count: 4, spawnInterval: 1.0 },
        { enemyType: EnemyType.Boar,         count: 3, spawnInterval: 1.0 },
        { enemyType: EnemyType.Werewolf,     count: 2, spawnInterval: 1.0 },
        { enemyType: EnemyType.RobotDog,     count: 3, spawnInterval: 1.0 },
        { enemyType: EnemyType.DesertBeetle, count: 3, spawnInterval: 1.0 },
      ],
      spawnDelay: 2,
      reward: 100,
    },
    {
      waveNumber: 11,
      enemies: [
        { enemyType: EnemyType.SuperRobot, count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Tank,       count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone,      count: 6, spawnInterval: 1.0 },
      ],
      spawnDelay: 3,
      reward: 160,
      isBossWave: true,
    },
    {
      waveNumber: 12,
      enemies: [
        { enemyType: EnemyType.AbyssLord, count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Goblin,    count: 3, spawnInterval: 1.0 },
        { enemyType: EnemyType.Werewolf,  count: 2, spawnInterval: 1.0 },
        { enemyType: EnemyType.RobotDog,  count: 3, spawnInterval: 1.0 },
      ],
      spawnDelay: 3,
      reward: 250,
      isBossWave: true,
    },
  ],
  startingGold: 180,
  availableTowers: ALL_TOWERS,
  availableUnits: ALL_UNITS,
  unlockStarsRequired: 8,
  unlockPrevLevelId: 'L4_wasteland',
  weatherFixed: WeatherType.Night,
};
