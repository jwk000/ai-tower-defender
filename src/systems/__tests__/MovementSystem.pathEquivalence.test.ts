import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../../core/World.js';
import {
  Position,
  Health,
  Movement,
  UnitTag,
  MoveModeVal,
  Visual,
  Category,
  CategoryVal,
} from '../../core/components.js';
import { MovementSystem } from '../MovementSystem.js';
import { getMovingEnemyBreathScale, getUnitSpriteArtFacesLeft, getUnitSpriteScaleX, RenderSystem } from '../RenderSystem.js';
import type { MapConfig, GridPos } from '../../types/index.js';
import { TileType } from '../../types/index.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';

const TILE = 32;

function makeMapWithPath(waypoints: GridPos[]): MapConfig {
  const maxRow = waypoints.reduce((m, p) => Math.max(m, p.row), 0) + 1;
  const maxCol = waypoints.reduce((m, p) => Math.max(m, p.col), 0) + 1;
  const tiles: TileType[][] = [];
  for (let r = 0; r < maxRow; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < maxCol; c++) row.push(TileType.Path);
    tiles.push(row);
  }
  const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath: waypoints });
  return {
    name: 'test',
    cols: maxCol,
    rows: maxRow,
    tileSize: TILE,
    tiles,
    pathGraph,
    spawns,
  };
}

function spawnEnemy(world: TowerWorld, x: number, y: number, speed: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed,
    moveMode: MoveModeVal.FollowPath,
    pathIndex: 0,
    progress: 0,
    spawnIdx: 0,
    currentNodeIdx: 0,
    targetNodeIdx: 1,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 10,
    canAttackBuildings: 0,
    atk: 1,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 255,
    colorG: 0,
    colorB: 0,
    size: 16,
    alpha: 1,
  });
  return eid;
}

function spawnBase(world: TowerWorld, hp: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 9999, y: 9999 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Objective });
  return eid;
}

interface SimSnapshot {
  x: number;
  y: number;
  pathIndex: number;
  currentNodeIdx: number;
  progress: number;
}

function runSim(map: MapConfig, head: GridPos, ticks: number, dt: number): {
  positions: SimSnapshot[];
  baseHp: number;
} {
  RenderSystem.sceneOffsetX = 0;
  RenderSystem.sceneOffsetY = 0;
  const world = new TowerWorld();
  const sys = new MovementSystem(map);
  const startX = head.col * TILE + TILE / 2;
  const startY = head.row * TILE + TILE / 2;
  const eid = spawnEnemy(world, startX, startY, 80);
  const baseId = spawnBase(world, 100);
  const positions: SimSnapshot[] = [];
  for (let i = 0; i < ticks; i++) {
    sys.update(world, dt);
    positions.push({
      x: Position.x[eid] ?? -1,
      y: Position.y[eid] ?? -1,
      pathIndex: Movement.pathIndex[eid] ?? -1,
      currentNodeIdx: Movement.pathIndex[eid] ?? -1,
      progress: Movement.progress[eid] ?? -1,
    });
  }
  return { positions, baseHp: Health.current[baseId] ?? -1 };
}

describe('MovementSystem B.12a — path equivalence after linearizeForLegacy refactor', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('straight 3-waypoint path: enemy reaches final waypoint at expected y', () => {
    const path: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 5 },
      { row: 0, col: 10 },
    ];
    const map = makeMapWithPath(path);
    const { positions } = runSim(map, path[0]!, 80, 0.1);
    const maxIndex = positions.reduce((m, p) => Math.max(m, p.pathIndex), 0);
    expect(maxIndex).toBe(path.length - 1);
    const atFinal = positions.find((p) => p.pathIndex === path.length - 1)!;
    expect(atFinal.y).toBeCloseTo(0 * TILE + TILE / 2, 2);
  });

  it('L-shaped path: enemy follows corner correctly', () => {
    const path: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 5 },
      { row: 3, col: 5 },
    ];
    const map = makeMapWithPath(path);
    const { positions } = runSim(map, path[0]!, 100, 0.1);
    const maxIndex = positions.reduce((m, p) => Math.max(m, p.pathIndex), 0);
    expect(maxIndex).toBe(path.length - 1);
    const atFinal = positions.find((p) => p.pathIndex === path.length - 1)!;
    expect(atFinal.x).toBeCloseTo(5 * TILE + TILE / 2, 2);
    expect(atFinal.y).toBeCloseTo(3 * TILE + TILE / 2, 2);
  });

  it('turning from vertical path into left segment flips enemy facing on the turn frame', () => {
    const path: GridPos[] = [
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 0 },
    ];
    const map = makeMapWithPath(path);
    const world = new TowerWorld();
    const sys = new MovementSystem(map);
    const eid = spawnEnemy(world, path[0]!.col * TILE + TILE / 2, path[0]!.row * TILE + TILE / 2, TILE);
    Visual.facing[eid] = 1;

    sys.update(world, 1);

    expect(Movement.pathIndex[eid]).toBe(1);
    expect(Visual.facing[eid]).toBe(-1);
  });

  it('left-facing enemy sprite art mirrors to match runtime movement facing', () => {
    expect(getUnitSpriteScaleX(1, true)).toBe(-1);
    expect(getUnitSpriteScaleX(-1, true)).toBe(1);
    expect(getUnitSpriteScaleX(1, false)).toBe(1);
    expect(getUnitSpriteScaleX(-1, false)).toBe(-1);
  });

  it('boss sprite art uses the same left-facing source mapping as normal enemies', () => {
    expect(getUnitSpriteArtFacesLeft(true, false)).toBe(true);
    expect(getUnitSpriteArtFacesLeft(true, true)).toBe(true);
    expect(getUnitSpriteScaleX(1, getUnitSpriteArtFacesLeft(true, true))).toBe(-1);
    expect(getUnitSpriteScaleX(-1, getUnitSpriteArtFacesLeft(true, true))).toBe(1);
  });

  it('swordsman and mage player sprites are mirrored from left-facing source art', () => {
    expect(getUnitSpriteArtFacesLeft(false, false, 'swordsman')).toBe(true);
    expect(getUnitSpriteArtFacesLeft(false, false, 'mage')).toBe(true);
    expect(getUnitSpriteArtFacesLeft(false, false, 'archer')).toBe(false);
    expect(getUnitSpriteScaleX(1, getUnitSpriteArtFacesLeft(false, false, 'swordsman'))).toBe(-1);
    expect(getUnitSpriteScaleX(1, getUnitSpriteArtFacesLeft(false, false, 'mage'))).toBe(-1);
  });

  it('turning from vertical path into right segment flips enemy facing on the turn frame', () => {
    const path: GridPos[] = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ];
    const map = makeMapWithPath(path);
    const world = new TowerWorld();
    const sys = new MovementSystem(map);
    const eid = spawnEnemy(world, path[0]!.col * TILE + TILE / 2, path[0]!.row * TILE + TILE / 2, TILE);
    Visual.facing[eid] = -1;

    sys.update(world, 1);

    expect(Movement.pathIndex[eid]).toBe(1);
    expect(Visual.facing[eid]).toBe(1);
  });

  it('moving enemy advances breath phase even on vertical path segments', () => {
    const path: GridPos[] = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ];
    const map = makeMapWithPath(path);
    const world = new TowerWorld();
    const sys = new MovementSystem(map);
    const eid = spawnEnemy(world, path[0]!.col * TILE + TILE / 2, path[0]!.row * TILE + TILE / 2, TILE / 2);
    Visual.breathPhase[eid] = 0;

    sys.update(world, 0.5);

    expect(Position.y[eid]).toBeGreaterThan(path[0]!.row * TILE + TILE / 2);
    expect(Visual.breathPhase[eid]).toBeGreaterThan(0);
    expect(Movement.currentSpeed[eid]).toBeGreaterThan(0);
  });

  it('moving enemy breath scale uses exactly two scale frames only while active', () => {
    expect(getMovingEnemyBreathScale(0, true)).toBeCloseTo(1.04, 5);
    expect(getMovingEnemyBreathScale(Math.PI + 0.01, true)).toBe(1);
    expect(getMovingEnemyBreathScale(0, false)).toBe(1);
  });

  it('zigzag 6-waypoint path: enemy passes through every intermediate waypoint index', () => {
    const path: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 4 },
      { row: 3, col: 4 },
      { row: 3, col: 8 },
      { row: 6, col: 8 },
      { row: 6, col: 12 },
    ];
    const map = makeMapWithPath(path);
    const { positions } = runSim(map, path[0]!, 300, 0.1);
    const reachedIndices = new Set(positions.map((p) => p.pathIndex));
    for (let i = 0; i < path.length; i++) {
      expect(reachedIndices.has(i)).toBe(true);
    }
  });

  it('reaches end and damages base (equivalence with legacy reach-end behavior)', () => {
    const path: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ];
    const map = makeMapWithPath(path);
    const { baseHp } = runSim(map, path[0]!, 100, 0.1);
    expect(baseHp).toBeLessThan(100);
  });
});
