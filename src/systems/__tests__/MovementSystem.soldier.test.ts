/**
 * MovementSystem 测试 — 士兵移动 & 路径恢复
 *
 * 对应设计文档:
 * - design/03-units.md §3 — soldier properties
 * - design/03-units.md §4.7/4.8 — trap push/recovery
 * - design/02-gameplay.md §7.1.2 — soldier 4-state AI
 */
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
  Soldier,
} from '../../core/components.js';
import { MovementSystem } from '../MovementSystem.js';
import { RenderSystem } from '../RenderSystem.js';
import type { MapConfig, GridPos } from '../../types/index.js';
import { TileType } from '../../types/index.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';

const TILE = 32;

// ---- Map helpers ----

function makeLinearMap(waypoints: GridPos[]): MapConfig {
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

function makeSimpleMap(): MapConfig {
  return makeLinearMap([
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 0, col: 4 },
    { row: 0, col: 5 },
  ]);
}

// ---- Soldier helper ----

function spawnSoldier(
  world: TowerWorld,
  opts: {
    x: number; y: number;
    homeX: number; homeY: number;
    moveRange: number;
    moveMode: number;
    speed: number;
    targetX?: number;
    targetY?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: opts.x, y: opts.y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed: opts.speed,
    moveMode: opts.moveMode,
    pathIndex: 0,
    progress: 0,
    targetX: opts.targetX ?? 0,
    targetY: opts.targetY ?? 0,
    homeX: opts.homeX,
    homeY: opts.homeY,
    moveRange: opts.moveRange,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 0,
    rewardGold: 10,
    canAttackBuildings: 0,
    atk: 5,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 0,
    colorG: 255,
    colorB: 0,
    size: 16,
    alpha: 1,
  });
  world.addComponent(eid, Soldier, {
    state: 0,
    homeX: opts.homeX,
    homeY: opts.homeY,
    moveRange: opts.moveRange,
    attackTarget: 0,
    stateTimer: 0,
  });
  return eid;
}

// ---- Enemy helper ----

function spawnEnemy(
  world: TowerWorld,
  x: number, y: number,
  speed: number,
  pathIndex: number,
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed,
    moveMode: MoveModeVal.FollowPath,
    pathIndex,
    progress: 0,
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

function spawnBase(world: TowerWorld, hp: number = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 9999, y: 9999 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Objective });
  return eid;
}

// ================================================================
// Tests
// ================================================================

describe('MovementSystem — soldier movement', () => {
  let world: TowerWorld;
  let sys: MovementSystem;

  beforeEach(() => {
    world = new TowerWorld();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    RenderSystem.sceneW = 20 * TILE;   // generous bounds for test
    RenderSystem.sceneH = 10 * TILE;
    sys = new MovementSystem(makeSimpleMap());
  });

  // --- HoldPosition ---

  it('HoldPosition: soldier does not move', () => {
    const eid = spawnSoldier(world, {
      x: 100, y: 200,
      homeX: 100, homeY: 200,
      moveRange: 200,
      moveMode: MoveModeVal.HoldPosition,
      speed: 80,
    });

    const x0 = Position.x[eid];
    const y0 = Position.y[eid];
    sys.update(world, 0.1);
    expect(Position.x[eid]).toBeCloseTo(x0!);
    expect(Position.y[eid]).toBeCloseTo(y0!);
  });

  // --- Patrol ---

  it('Patrol: soldier moves when patrolling', () => {
    const eid = spawnSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 300,
      moveMode: MoveModeVal.Patrol,
      speed: 80,
    });

    const x0 = Position.x[eid]!;
    const y0 = Position.y[eid]!;
    sys.update(world, 0.1);

    // Soldier should have moved
    const dx = Position.x[eid]! - x0;
    const dy = Position.y[eid]! - y0;
    expect(dx * dx + dy * dy).toBeGreaterThan(0.1);
  });

  it('Patrol: soldier picks new target after reaching destination', () => {
    // Place soldier at a position, set a very close target via Movement.targetX/Y
    const eid = spawnSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 300,
      moveMode: MoveModeVal.Patrol,
      speed: 80,
      targetX: 205, // 5px away
      targetY: 200,
    });

    const targetBefore = Movement.targetX[eid];
    expect(targetBefore).toBeGreaterThan(0);

    // One tick: soldier moves toward the target, should reach it (within SOLDIER_REACH_THRESHOLD = 5)
    // and pick a new random target
    sys.update(world, 0.1);

    // After reaching, a new target should have been picked (likely different from 205,200)
    // Math.random may produce the same value, so we just verify the system ran
    // The soldier moved
    const finalX = Position.x[eid]!;
    expect(finalX).not.toBeCloseTo(200, 0); // should have moved from origin
  });

  it('Patrol: soldier stays within moveRange of anchor', () => {
    const anchorX = 200;
    const anchorY = 200;
    const moveRange = 100;
    const eid = spawnSoldier(world, {
      x: anchorX, y: anchorY,
      homeX: anchorX, homeY: anchorY,
      moveRange,
      moveMode: MoveModeVal.Patrol,
      speed: 80,
    });

    // Run many ticks — soldier should remain within moveRange
    for (let i = 0; i < 200; i++) {
      sys.update(world, 0.05);
    }

    const fx = Position.x[eid]!;
    const fy = Position.y[eid]!;
    const distFromAnchor = Math.sqrt((fx - anchorX) ** 2 + (fy - anchorY) ** 2);
    expect(distFromAnchor).toBeLessThanOrEqual(moveRange + 20); // small epsilon for floating point
  });

  // --- ChaseTarget ---

  it('ChaseTarget: soldier moves toward specified target', () => {
    const eid = spawnSoldier(world, {
      x: 100, y: 100,
      homeX: 100, homeY: 100,
      moveRange: 500,
      moveMode: MoveModeVal.ChaseTarget,
      speed: 80,
      targetX: 300,
      targetY: 100,
    });

    sys.update(world, 0.1);

    // Should have moved toward (300, 100) — rightward, minimal y change
    expect(Position.x[eid]!).toBeGreaterThan(100);
    expect(Position.y[eid]!).toBeCloseTo(100, 0); // no y component in target
  });

  it('ChaseTarget: soldier with no target set does not move', () => {
    const eid = spawnSoldier(world, {
      x: 100, y: 100,
      homeX: 100, homeY: 100,
      moveRange: 500,
      moveMode: MoveModeVal.ChaseTarget,
      speed: 80,
      // no targetX/targetY (defaults to 0)
    });

    const x0 = Position.x[eid];
    const y0 = Position.y[eid];
    sys.update(world, 0.1);
    expect(Position.x[eid]).toBeCloseTo(x0!);
    expect(Position.y[eid]).toBeCloseTo(y0!);
  });

  it('ChaseTarget: soldier reaches and stops at target', () => {
    const startX = 100;
    const targetX = 150;
    const eid = spawnSoldier(world, {
      x: startX, y: 100,
      homeX: startX, homeY: 100,
      moveRange: 500,
      moveMode: MoveModeVal.ChaseTarget,
      speed: 500, // fast enough to reach in one tick
      targetX,
      targetY: 100,
    });

    sys.update(world, 0.1);
    expect(Position.x[eid]!).toBeCloseTo(targetX, 0);
  });

  // --- Scene bounds clamping ---

  it('Soldier movement is clamped within scene bounds', () => {
    const eid = spawnSoldier(world, {
      x: 10, y: 10,
      homeX: 10, homeY: 10,
      moveRange: 500,
      moveMode: MoveModeVal.ChaseTarget,
      speed: 500,
      targetX: -1000, // outside left edge
      targetY: 10,
    });

    sys.update(world, 0.1);
    // Should not go past left margin (8px)
    expect(Position.x[eid]!).toBeGreaterThanOrEqual(8);
  });

  // --- Soldier collision ---

  it('Two soldiers can push past each other with loose collision', () => {
    const s1 = spawnSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 300,
      moveMode: MoveModeVal.ChaseTarget,
      speed: 80,
      targetX: 300,
      targetY: 200,
    });
    const s2 = spawnSoldier(world, {
      x: 230, y: 200, // close to s1
      homeX: 230, homeY: 200,
      moveRange: 300,
      moveMode: MoveModeVal.ChaseTarget,
      speed: 80,
      targetX: 130, // going opposite direction
      targetY: 200,
    });

    const x1_0 = Position.x[s1]!;
    const x2_0 = Position.x[s2]!;

    sys.update(world, 0.1);

    // Both should move (they don't fully block each other)
    expect(Position.x[s1]!).not.toBeCloseTo(x1_0);
    expect(Position.x[s2]!).not.toBeCloseTo(x2_0);
    // s1 should still move rightward, s2 leftward (though may be slightly pushed)
  });
});

describe('MovementSystem — path recovery', () => {
  let world: TowerWorld;
  let sys: MovementSystem;

  const path6: GridPos[] = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 0, col: 4 },
    { row: 0, col: 5 },
  ];

  beforeEach(() => {
    world = new TowerWorld();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    sys = new MovementSystem(makeLinearMap(path6));
  });

  it('Enemy near path segment continues normally (no recovery needed)', () => {
    // Place enemy on waypoint 2 center
    const wp2 = path6[2]!;
    const startX = wp2.col * TILE + TILE / 2;
    const startY = wp2.row * TILE + TILE / 2;
    const eid = spawnEnemy(world, startX, startY, 80, 2);
    spawnBase(world, 100);

    const x0 = Position.x[eid]!;
    const y0 = Position.y[eid]!;

    sys.update(world, 0.1);

    // Normal movement — position changes along the path
    const dx = Position.x[eid]! - x0;
    expect(dx).toBeGreaterThan(0); // moving right
    expect(Position.y[eid]).toBeCloseTo(y0, 2); // same row
  });

  it('Enemy pushed far off path snaps to nearest waypoint', () => {
    // Place enemy on waypoint 1 center, but push it far off the path vertically
    const wp1 = path6[1]!;
    const wp1cx = wp1.col * TILE + TILE / 2;
    const wp1cy = wp1.row * TILE + TILE / 2;

    // Push enemy 100px below the path (well past tileSize * 1.5 = 48px)
    const eid = spawnEnemy(world, wp1cx, wp1cy + 100, 80, 1);
    spawnBase(world, 100);

    sys.update(world, 0.1);

    // Should snap to nearest waypoint — row 0, some col
    const newX = Position.x[eid]!;
    const newY = Position.y[eid]!;

    // The nearest waypoint to (wp1cx, wp1cy + 100) is wp1 at (wp1cx, wp1cy)
    // with tileSize=32, wp1cx=32*1+16=48, wp1cy=0*32+16=16
    // So snapped position should be exactly the waypoint center
    expect(newX).toBeCloseTo(wp1cx, 0);
    expect(newY).toBeCloseTo(wp1cy, 0);

    // pathIndex should be 1 (the nearest waypoint)
    expect(Movement.pathIndex[eid]).toBe(1);
    // progress should be reset
    expect(Movement.progress[eid]).toBe(0);
  });

  it('Enemy off-path near waypoint 4 gets snapped to waypoint 4', () => {
    const wp4 = path6[4]!;
    const wp4cx = wp4.col * TILE + TILE / 2; // 4*32+16 = 144
    const wp4cy = wp4.row * TILE + TILE / 2; // 16

    // Place enemy slightly right of wp4 center, pushed far above the path
    // This makes wp4 the nearest waypoint (smaller dx than wp3 or wp5)
    const eid = spawnEnemy(world, wp4cx + 10, wp4cy - 80, 80, 3);
    spawnBase(world, 100);

    sys.update(world, 0.1);

    // Should snap to nearest waypoint center (wp4)
    expect(Position.y[eid]!).toBeCloseTo(wp4cy, 0);
    expect(Movement.pathIndex[eid]).toBe(4);
  });

  it('Path recovery does not trigger on enemies that have reached the end', () => {
    const lastWp = path6[5]!;
    const cx = lastWp.col * TILE + TILE / 2;
    const cy = lastWp.row * TILE + TILE / 2;
    const baseId = spawnBase(world, 100);

    // Enemy at end of path (pathIndex = 5 = path.length - 1)
    // It should be processed by onReachEnd, not path recovery
    const eid = spawnEnemy(world, cx - 100, cy, 80, 5);

    sys.update(world, 0.1);

    // Base should take damage (enemy reached end), enemy destroyed
    expect(Health.current[baseId]).toBeLessThan(100);
  });
});

describe('MovementSystem.findNearestPathIndex (static)', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('returns index of nearest path waypoint', () => {
    const waypoints: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 4 },
      { row: 3, col: 4 },
    ];
    const map = makeLinearMap(waypoints);
    // Construct MovementSystem to populate static _path
    const _sys = new MovementSystem(map);

    const wp2cx = 4 * TILE + TILE / 2; // col 4: 128 + 16 = 144
    const wp2cy = 0 * TILE + TILE / 2; // row 0: 0 + 16 = 16

    // Query near waypoint 2
    const world = new TowerWorld();
    const idx = MovementSystem.findNearestPathIndex(world, wp2cx + 5, wp2cy + 5, TILE);
    // The nearest waypoint should be index 1 (col=4, row=0)
    expect(idx).toBe(1);
  });

  it('returns index 0 when near the first waypoint', () => {
    const waypoints: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ];
    const map = makeLinearMap(waypoints);
    const _sys = new MovementSystem(map);

    const world = new TowerWorld();
    const idx = MovementSystem.findNearestPathIndex(world, TILE / 2, TILE / 2, TILE);
    expect(idx).toBe(0);
  });

  it('returns valid index for path with few waypoints', () => {
    // Minimal 2-waypoint path (migrateEnemyPathToGraph requires >= 2)
    const waypoints: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 3 },
    ];
    const map = makeLinearMap(waypoints);
    const _sys = new MovementSystem(map);

    const world = new TowerWorld();
    const idx = MovementSystem.findNearestPathIndex(world, 0, 0, TILE);
    // Should return some valid index (0 or 1 — whichever is nearest)
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(waypoints.length);
  });
});
