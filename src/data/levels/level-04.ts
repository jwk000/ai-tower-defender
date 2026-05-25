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
import type { PathNode, PathEdge, PathGraph, SpawnPoint } from '../../level/graph/types.js';

// ============================================================
// Level 4 — 末日废土 (Fork-Merge Path Layout)
// ============================================================

const E = TileType.Empty;
const P = TileType.Path;
const B = TileType.Blocked;
const S = TileType.Spawn;
const Ba = TileType.Base;

const tiles: TileType[][] = [
  // row 0
  [E, E, E, E,  E, E, E, E,  E, E, E, E,  E, E, E, E,  E, E, E, E,  E],
  // row 1
  [E, E, E, E,  B, E, E, E,  E, E, E, E,  E, E, E, E,  E, E, E, E,  E],
  // row 2 — Path A: upper fork, goes left from spawn at col 20 → col 14
  [E, E, E, E,  E, E, E, E,  E, E, E, E,  B, P, P, P,  P, P, P, P,  S],
  // row 3 — connector from upper fork to merge point
  [E, E, E, E,  E, E, E, E,  E, E, B, B,  E, P, E, E,  E, E, E, E,  E],
  // row 4 — merged main path east→west + crystal at col 0
  [Ba, P, P, P,  P, P, P, P,  P, P, P, P,  P, P, E, E,  E, E, E, E,  E],
  // row 5 — connector from lower fork to merge point
  [E, E, E, E,  E, E, E, E,  E, E, B, B,  E, P, E, E,  E, E, E, E,  E],
  // row 6 — Path B: lower fork, goes left from spawn at col 20 → col 14
  [E, E, E, E,  E, E, E, E,  E, E, E, E,  B, P, P, P,  P, P, P, P,  S],
  // row 7
  [E, E, E, E,  B, E, E, E,  E, E, E, E,  E, E, E, E,  E, E, E, E,  E],
  // row 8
  [E, E, E, E,  E, E, E, E,  E, E, E, E,  E, E, E, E,  E, E, E, E,  E],
];

const nodes: PathNode[] = [
  { id: 'spawn_upper', row: 2, col: 20, role: 'spawn', spawnId: 'spawn_upper' },
  { id: 'spawn_lower', row: 6, col: 20, role: 'spawn', spawnId: 'spawn_lower' },
  { id: 'fork_upper', row: 2, col: 14, role: 'branch' },
  { id: 'fork_lower', row: 6, col: 14, role: 'branch' },
  { id: 'merge', row: 4, col: 10, role: 'branch' },
  { id: 'way_1', row: 4, col: 6, role: 'waypoint' },
  { id: 'way_2', row: 4, col: 2, role: 'waypoint' },
  { id: 'crystal', row: 4, col: 0, role: 'crystal_anchor' },
];

const edges: PathEdge[] = [
  { from: 'spawn_upper', to: 'fork_upper' },
  { from: 'spawn_lower', to: 'fork_lower' },
  { from: 'fork_upper', to: 'merge' },
  { from: 'fork_lower', to: 'merge' },
  { from: 'merge', to: 'way_1' },
  { from: 'way_1', to: 'way_2' },
  { from: 'way_2', to: 'crystal' },
];

const pathGraph: PathGraph = { nodes, edges };

const spawns: SpawnPoint[] = [
  { id: 'spawn_upper', row: 2, col: 20, name: '上方出生点' },
  { id: 'spawn_lower', row: 6, col: 20, name: '下方出生点' },
];

const obstaclePlacements = [
  { row: 1, col: 4, type: ObstacleType.VolcanicRock },
  { row: 7, col: 4, type: ObstacleType.VolcanicRock },
  { row: 3, col: 10, type: ObstacleType.ScorchedTree },
  { row: 5, col: 10, type: ObstacleType.ScorchedTree },
  { row: 3, col: 11, type: ObstacleType.LavaVent },
  { row: 5, col: 11, type: ObstacleType.VolcanicRock },
  { row: 2, col: 12, type: ObstacleType.LavaVent },
  { row: 6, col: 12, type: ObstacleType.ScorchedTree },
];

export const LEVEL_04: LevelConfig = {
  id: 'L4_wasteland',
  name: '末日废土',
  theme: LevelTheme.Volcano,
  description: '浓雾弥漫的废弃都市，路径分叉考验多线防御',
  sceneDescription: '废弃城市，浓雾弥漫，机械残骸散落',
  map: {
    name: '末日废土',
    cols: 21,
    rows: 9,
    tileSize: 64,
    tiles,
    spawns,
    pathGraph,
    obstaclePlacements,
  },
  waves: [
    {
      waveNumber: 1,
      enemies: [{ enemyType: EnemyType.RobotDog, count: 8, spawnInterval: 1.5 }],
      spawnDelay: 2,
      reward: 35,
    },
    {
      waveNumber: 2,
      enemies: [
        { enemyType: EnemyType.RobotDog, count: 6, spawnInterval: 1.5 },
        { enemyType: EnemyType.Drone, count: 5, spawnInterval: 1.5 },
      ],
      spawnDelay: 2,
      reward: 45,
    },
    {
      waveNumber: 3,
      enemies: [
        { enemyType: EnemyType.RobotDog, count: 5, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Plane, count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 55,
    },
    {
      waveNumber: 4,
      enemies: [
        { enemyType: EnemyType.RobotDog, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Plane, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.OilTruck, count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 65,
    },
    {
      waveNumber: 5,
      enemies: [
        { enemyType: EnemyType.RobotDog, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Plane, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.OilTruck, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Tank, count: 1, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 75,
    },
    {
      waveNumber: 6,
      enemies: [
        { enemyType: EnemyType.RobotDog, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Plane, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.OilTruck, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.Tank, count: 2, spawnInterval: 2.0 },
        { enemyType: EnemyType.GiantRobot, count: 1, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 85,
    },
    {
      waveNumber: 7,
      enemies: [
        { enemyType: EnemyType.RobotDog, count: 5, spawnInterval: 2.0 },
        { enemyType: EnemyType.Drone, count: 4, spawnInterval: 2.0 },
        { enemyType: EnemyType.Plane, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.OilTruck, count: 3, spawnInterval: 2.0 },
        { enemyType: EnemyType.Tank, count: 2, spawnInterval: 2.0 },
      ],
      spawnDelay: 2,
      reward: 95,
    },
    {
      waveNumber: 8,
      enemies: [
        { enemyType: EnemyType.SuperRobot, count: 1, spawnInterval: 3.0 },
        { enemyType: EnemyType.Drone, count: 5, spawnInterval: 1.0 },
        { enemyType: EnemyType.Tank, count: 2, spawnInterval: 1.5 },
      ],
      spawnDelay: 3,
      reward: 150,
      isBossWave: true,
    },
  ],
  startingGold: 180,
  availableTowers: [TowerType.Missile, TowerType.Lightning, TowerType.Cannon, TowerType.Ice],
  availableUnits: [UnitType.Archer, UnitType.Mage],
  unlockStarsRequired: 6,
  unlockPrevLevelId: 'L3_castle',
  weatherFixed: WeatherType.Fog,
};
