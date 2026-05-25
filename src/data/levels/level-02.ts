// 关卡 2：沙漠虫潮 — v4.0 完整关卡数据
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
import type { SpawnPoint, PathGraph } from '../../level/graph/types.js';

// ---- 地图布局 (21×9) ----
// 路径：右侧出生点(row4,col20) → 左行到 col12 → 上行到 row2 → 左行到 col0 水晶
// E=Empty  P=Path  B=Blocked  X=Base(Crystal)  S=Spawn

const T = TileType;

const tiles: TileType[][] = [
  // row 0
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 1
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Blocked,T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 2 — 水晶在左端 (col0), 路径向东到 col12
  [T.Base,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 3 — 路径在 col12 转弯, 两侧有岩石/仙人掌
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Path,   T.Blocked,T.Blocked,T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 4 — 主横向走廊, col20 出生点
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Blocked,T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Path,   T.Spawn],
  // row 5
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Blocked,T.Blocked,T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 6
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 7
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
  // row 8
  [T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty, T.Empty],
];

const spawns: SpawnPoint[] = [
  { id: 'spawn_main', row: 4, col: 20 },
];

const pathGraph: PathGraph = {
  nodes: [
    { id: 'n_spawn',  row: 4, col: 20, role: 'spawn',         spawnId: 'spawn_main' },
    { id: 'n_turn1',  row: 4, col: 12, role: 'waypoint' },
    { id: 'n_turn2',  row: 2, col: 12, role: 'waypoint' },
    { id: 'n_crystal', row: 2, col: 0,  role: 'crystal_anchor' },
  ],
  edges: [
    { from: 'n_spawn',   to: 'n_turn1' },
    { from: 'n_turn1',   to: 'n_turn2' },
    { from: 'n_turn2',   to: 'n_crystal' },
  ],
};

const obstaclePlacements = [
  { row: 1, col: 12, type: ObstacleType.Rock },
  { row: 3, col: 13, type: ObstacleType.Cactus },
  { row: 3, col: 14, type: ObstacleType.Rock },
  { row: 4, col: 11, type: ObstacleType.Cactus },
  { row: 5, col: 12, type: ObstacleType.Rock },
  { row: 5, col: 13, type: ObstacleType.Cactus },
];

// ---- 波次配置 (6波) ----

const waves = [
  // Wave 1 — 黑虫潮
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.DesertBeetle, count: 12, spawnInterval: 1.0 }],
    spawnDelay: 2,
    reward: 25,
  },
  // Wave 2 — 钻地甲虫登场
  {
    waveNumber: 2,
    enemies: [
      { enemyType: EnemyType.DesertBeetle, count: 8, spawnInterval: 1.5 },
      { enemyType: EnemyType.BurrowBeetle, count: 3, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
    reward: 35,
  },
  // Wave 3 — 蝗虫（低空）登场
  {
    waveNumber: 3,
    enemies: [
      { enemyType: EnemyType.DesertBeetle, count: 8, spawnInterval: 1.5 },
      { enemyType: EnemyType.BurrowBeetle, count: 3, spawnInterval: 1.5 },
      { enemyType: EnemyType.Locust, count: 5, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
    reward: 45,
  },
  // Wave 4 — 自爆甲虫登场
  {
    waveNumber: 4,
    enemies: [
      { enemyType: EnemyType.DesertBeetle, count: 10, spawnInterval: 1.5 },
      { enemyType: EnemyType.BurrowBeetle, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Locust, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.BombBeetle, count: 3, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
    reward: 55,
  },
  // Wave 5 — 虫群总攻
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.DesertBeetle, count: 12, spawnInterval: 1.5 },
      { enemyType: EnemyType.BurrowBeetle, count: 5, spawnInterval: 1.5 },
      { enemyType: EnemyType.Locust, count: 6, spawnInterval: 1.5 },
      { enemyType: EnemyType.BombBeetle, count: 4, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
    reward: 65,
  },
  // Wave 6 — BOSS 虫族女王
  {
    waveNumber: 6,
    enemies: [
      { enemyType: EnemyType.QueenBeetle, count: 1, spawnInterval: 3.0 },
      { enemyType: EnemyType.DesertBeetle, count: 8, spawnInterval: 1.0 },
      { enemyType: EnemyType.BombBeetle, count: 3, spawnInterval: 1.0 },
    ],
    spawnDelay: 3,
    reward: 100,
    isBossWave: true,
  },
];

// ---- 关卡配置 ----

export const LEVEL_02: LevelConfig = {
  id: 'L2_desert',
  name: '沙漠虫潮',
  theme: LevelTheme.Desert,
  description: '烈日下的沙漠战场，虫群从L形弯道涌入',
  sceneDescription: '黄色沙漠，烈日炎炎，热浪扭曲空气',
  map: {
    name: '沙漠虫潮',
    cols: 21,
    rows: 9,
    tileSize: 64,
    tiles,
    spawns,
    pathGraph,
    sceneDescription: '黄色沙漠，烈日炎炎，热浪扭曲空气',
    obstaclePlacements,
  },
  waves,
  startingGold: 200,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Fire, TowerType.Poison],
  availableUnits: [UnitType.Archer, UnitType.Mage],
  unlockStarsRequired: 2,
  unlockPrevLevelId: 'L1_plains',
  weatherFixed: WeatherType.Sunny,
};
