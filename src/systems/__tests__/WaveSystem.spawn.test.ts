import { describe, it, expect, beforeEach } from 'vitest';
import { defineQuery } from 'bitecs';
import { WaveSystem, type SpawnEnemyOptions } from '../WaveSystem.js';
import { TowerWorld } from '../../core/World.js';
import { GamePhase, EnemyType, type WaveConfig, type MapConfig } from '../../types/index.js';
import { Position, UnitTag, Health, Elite, Visual } from '../../core/components.js';
import { RenderSystem } from '../RenderSystem.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';

const enemyQuery = defineQuery([Position, UnitTag]);
const eliteQuery = defineQuery([Position, UnitTag, Elite]);

function makeBaseMap(): Omit<MapConfig, 'spawns' | 'pathGraph'> {
  return { name: 'test', cols: 10, rows: 10, tileSize: 64, tiles: [[]] };
}

function makeSingleWave(): WaveConfig[] {
  return [{
    waveNumber: 1,
    spawnDelay: 0,
    enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
  }];
}

function makeMultiWave(): WaveConfig[] {
  return [
    { waveNumber: 1, spawnDelay: 0, enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }], reward: 50 },
    { waveNumber: 2, spawnDelay: 0, enemies: [{ enemyType: EnemyType.Boar, count: 1, spawnInterval: 0 }], reward: 80 },
    { waveNumber: 3, spawnDelay: 0, enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }], reward: 100 },
  ];
}

function findEnemyPosition(world: TowerWorld): { x: number; y: number } | null {
  const eids = enemyQuery(world.world);
  if (eids.length === 0) return null;
  const eid = eids[0]!;
  return { x: Position.x[eid]!, y: Position.y[eid]! };
}

describe('WaveSystem B.15 — spawn coords via resolveGraphFromMap (pathGraph-only)', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('pathGraph migrated from waypoints: enemy spawns at head waypoint', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const pos = findEnemyPosition(world);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(5 * 64 + 32);
    expect(pos!.y).toBe(3 * 64 + 32);
  });

  it('explicit pathGraph: enemy spawns at spawns[0]', () => {
    const world = new TowerWorld();
    const map: MapConfig = {
      ...makeBaseMap(),
      spawns: [{ id: 'spawn_main', row: 3, col: 5 }],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 3, col: 5, role: 'spawn', spawnId: 'spawn_main' },
          { id: 'n1', row: 3, col: 9, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    };
    const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const pos = findEnemyPosition(world);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(5 * 64 + 32);
    expect(pos!.y).toBe(3 * 64 + 32);
  });

  it('throws at construction when pathGraph is missing', () => {
    const world = new TowerWorld();
    const badMap = { ...makeBaseMap() } as MapConfig;
    expect(() => new WaveSystem(world, badMap, makeSingleWave(), getPhase, setPhase)).toThrow();
  });
});

// ============================================================
// v4.0: Elite spawning, difficulty scaling, wave rewards
// ============================================================

describe('WaveSystem v4.0 — elite enemy spawning', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('elite is spawned after regular enemies with Elite component and enhanced stats', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 2, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();

    // Process all spawning — need enough ticks for 2 regular + 1 elite
    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    // Query elite entities
    const elites = eliteQuery(world.world);
    expect(elites.length).toBe(1);

    const eliteEid = elites[0]!;
    // Verify Elite component data
    expect(Elite.hpMultiplier[eliteEid]).toBe(2.0);
    expect(Elite.atkMultiplier[eliteEid]).toBe(1.5);
    expect(Elite.visualScale[eliteEid]).toBeCloseTo(1.2, 2);
    expect(Elite.cardOptions[eliteEid]).toBe(3);

    // Verify UnitTag.isElite
    expect(UnitTag.isElite[eliteEid]).toBe(1);

    // Verify enhanced HP (Goblin base HP=18, ×2.0 elite × difficulty multiplier)
    // Wave 1/1 → ratio=0, stage 开局 hpMult=0.8
    // elite HP = 18 * 2.0 * 0.8 = 28.8 → 29 (rounded)
    expect(Health.max[eliteEid]).toBe(29);
    expect(Health.current[eliteEid]).toBe(29);

    // Verify enhanced ATK (Goblin base ATK=8, ×1.5 elite × 0.8 difficulty = 9.6 → 10 rounded)
    expect(UnitTag.atk[eliteEid]).toBe(10);

    // Verify gold visual (elite gets gold color #FFD700 = R:255 G:215 B:0)
    expect(Visual.colorR[eliteEid]).toBe(255);
    expect(Visual.colorG[eliteEid]).toBe(215);
    expect(Visual.colorB[eliteEid]).toBe(0);

    // Verify enlarged size (Goblin radius=16, base size=32, ×1.2 = 38.4 → 38)
    expect(Visual.size[eliteEid]).toBeCloseTo(38.4, 0);
  });

  it('elite kill triggers onEliteKilled callback', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    let eliteKilledCalled = false;
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase, undefined, undefined, undefined, () => {
      eliteKilledCalled = true;
    });
    ws.startWave();

    // Spawn all enemies
    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    // Find elite and kill it
    const elites = eliteQuery(world.world);
    expect(elites.length).toBe(1);
    const eliteEid = elites[0]!;
    Health.current[eliteEid] = 0;

    // One more update to detect the kill
    ws.update(world, 0.1);

    expect(eliteKilledCalled).toBe(true);
  });

  it('onEliteKilled fires only once per elite', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    let callCount = 0;
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase, undefined, undefined, undefined, () => {
      callCount++;
    });
    ws.startWave();

    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    const elites = eliteQuery(world.world);
    expect(elites.length).toBe(1);
    const eliteEid = elites[0]!;
    Health.current[eliteEid] = 0;

    // Multiple updates — should only fire once
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    expect(callCount).toBe(1);
  });

  it('only one elite spawned per wave', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 10, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();

    // Run many updates — only 1 elite should spawn
    for (let i = 0; i < 50; i++) ws.update(world, 0.1);

    const elites = eliteQuery(world.world);
    expect(elites.length).toBe(1);
  });
});

describe('WaveSystem v4.0 — difficulty scaling', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('开局 stage: ratio < 0.2 → hpMult=0.8, atkMult=0.8', () => {
    const result = WaveSystem.getDifficultyMultiplier(0, 5);
    expect(result.hpMult).toBe(0.8);
    expect(result.atkMult).toBe(0.8);
  });

  it('建设 stage: 0.2 ≤ ratio < 0.5 → hpMult=1.0, atkMult=1.0', () => {
    const result = WaveSystem.getDifficultyMultiplier(1, 5); // 0.2
    expect(result.hpMult).toBe(1.0);
    expect(result.atkMult).toBe(1.0);

    const result2 = WaveSystem.getDifficultyMultiplier(2, 5); // 0.4
    expect(result2.hpMult).toBe(1.0);
    expect(result2.atkMult).toBe(1.0);
  });

  it('压力 stage: 0.5 ≤ ratio < 0.8 → hpMult=1.3, atkMult=1.3', () => {
    const result = WaveSystem.getDifficultyMultiplier(2, 4); // 0.5
    expect(result.hpMult).toBe(1.3);
    expect(result.atkMult).toBe(1.3);
  });

  it('高潮 stage: ratio ≥ 0.8 → hpMult=1.5, atkMult=1.5', () => {
    const result = WaveSystem.getDifficultyMultiplier(4, 5); // 0.8
    expect(result.hpMult).toBe(1.5);
    expect(result.atkMult).toBe(1.5);

    const result2 = WaveSystem.getDifficultyMultiplier(4, 4); // 1.0
    expect(result2.hpMult).toBe(1.5);
    expect(result2.atkMult).toBe(1.5);
  });

  it('difficulty applied to regular enemy spawn', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const waves = makeSingleWave(); // wave 1/1 → ratio=0, 开局 stage

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();

    // Spawn 1 regular goblin (difficulty ratio=0, 开局 hpMult=0.8, atkMult=0.8)
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    // Get the non-elite enemy
    const allEnemies = enemyQuery(world.world);
    // First enemy (eid=0) is regular, second (eid=1) is elite
    const regularEid = allEnemies[0]!;
    expect(UnitTag.isElite[regularEid]).toBe(0);
    // Goblin base HP=18, ×0.8 = 14.4 → 14 (rounded)
    expect(Health.max[regularEid]).toBe(14);
    // Goblin base ATK=8, ×0.8 = 6.4 → 6 (floored)
    expect(UnitTag.atk[regularEid]).toBe(6);
  });
});

describe('WaveSystem v4.0 — wave rewards', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('onWaveReward callback fires with correct gold amount', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    let rewardGold = 0;
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
      reward: 75,
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase, undefined, undefined, (gold) => {
      rewardGold = gold;
    });
    ws.startWave();

    // Spawn and kill all enemies (regular + elite)
    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    // Kill all enemies to complete wave
    const allEnemies = enemyQuery(world.world);
    for (const eid of allEnemies) {
      Health.current[eid] = 0;
    }

    // Process completion
    ws.update(world, 0.1);

    expect(rewardGold).toBe(75);
  });

  it('onWaveReward not called when wave has no reward', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    let rewardCalled = false;
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
      // no reward field
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase, undefined, undefined, () => {
      rewardCalled = true;
    });
    ws.startWave();

    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    const allEnemies = enemyQuery(world.world);
    for (const eid of allEnemies) {
      Health.current[eid] = 0;
    }
    ws.update(world, 0.1);

    expect(rewardCalled).toBe(false);
  });
});

describe('WaveSystem v4.0 — multiple spawn points', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('uses specified spawnPointIndex from wave config', () => {
    const world = new TowerWorld();
    const map: MapConfig = {
      ...makeBaseMap(),
      spawns: [
        { id: 'spawn_a', row: 2, col: 5 },
        { id: 'spawn_b', row: 4, col: 5 },
      ],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 2, col: 5, role: 'spawn', spawnId: 'spawn_a' },
          { id: 'n1', row: 4, col: 5, role: 'spawn', spawnId: 'spawn_b' },
          { id: 'n2', row: 3, col: 9, role: 'crystal_anchor' },
        ],
        edges: [
          { from: 'n0', to: 'n2' },
          { from: 'n1', to: 'n2' },
        ],
      },
    };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
      spawnPointIndex: 1, // use spawn_b (second spawn point)
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const pos = findEnemyPosition(world);
    expect(pos).not.toBeNull();
    // spawn_b is at col=5, row=4
    expect(pos!.x).toBe(5 * 64 + 32);
    expect(pos!.y).toBe(4 * 64 + 32);
  });

  it('distributes enemies across spawns when spawnPointIndex is -1', () => {
    const world = new TowerWorld();
    const map: MapConfig = {
      ...makeBaseMap(),
      spawns: [
        { id: 'spawn_a', row: 2, col: 0 },
        { id: 'spawn_b', row: 4, col: 0 },
      ],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 2, col: 0, role: 'spawn', spawnId: 'spawn_a' },
          { id: 'n1', row: 4, col: 0, role: 'spawn', spawnId: 'spawn_b' },
          { id: 'n2', row: 3, col: 9, role: 'crystal_anchor' },
        ],
        edges: [
          { from: 'n0', to: 'n2' },
          { from: 'n1', to: 'n2' },
        ],
      },
    };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [
        { enemyType: EnemyType.Goblin, count: 2, spawnInterval: 0 },
      ],
      spawnPointIndex: -1,
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 10; i++) ws.update(world, 0.1);

    // All enemies (regular + elite) should be spread
    const allEnemies = enemyQuery(world.world);
    expect(allEnemies.length).toBeGreaterThanOrEqual(2);

    // Collect unique spawn rows
    const rows = new Set<number>();
    for (const eid of allEnemies) {
      rows.add(Position.y[eid]!);
    }
    // Should have enemies at both row 2 and row 4 (different spawns)
    expect(rows.has(2 * 64 + 32)).toBe(true);
    expect(rows.has(4 * 64 + 32)).toBe(true);
  });
});
