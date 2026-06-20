import { describe, it, expect, beforeEach } from 'vitest';
import { defineQuery } from 'bitecs';
import { WaveSystem, type SpawnEnemyOptions } from '../WaveSystem.js';
import { TowerWorld, hasComponent } from '../../core/World.js';
import { GamePhase, EnemyType, type WaveConfig, type MapConfig } from '../../types/index.js';
import { Position, UnitTag, Health, Elite, Visual, Boss, ExplosionEffect, Attack, DamageTypeVal, EnemyFlockMember, Layer, LayerVal, Movement } from '../../core/components.js';
import { RenderSystem } from '../RenderSystem.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';
import { ENEMY_CONFIGS, ENEMY_TYPE_BY_ID } from '../../data/gameData.js';
import { BossSystem, BossType } from '../BossSystem.js';

const enemyQuery = defineQuery([Position, UnitTag]);
const flockEnemyQuery = defineQuery([Position, UnitTag, EnemyFlockMember]);
const eliteQuery = defineQuery([Position, UnitTag, Elite]);
const bossQuery = defineQuery([Position, UnitTag, Boss]);
const explosionQuery = defineQuery([Position, ExplosionEffect, Visual]);

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

  it('reused entity id does not inherit old path progress when spawning', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const stale = world.createEntity();
    world.addComponent(stale, Movement, {
      speed: 1,
      currentSpeed: 1,
      targetX: 999,
      targetY: 999,
      pathIndex: 1,
      progress: 0.75,
      moveMode: 1,
      homeX: 999,
      homeY: 999,
      moveRange: 999,
      spawnIdx: 0,
      currentNodeIdx: 1,
      targetNodeIdx: 2,
    });
    world.destroyEntity(stale);
    world.cleanupDeadEntities();

    const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
    ws.startWave();
    ws.update(world, 0);

    const enemies = enemyQuery(world.world).filter((eid) => UnitTag.isEnemy[eid] === 1 && UnitTag.isElite[eid] !== 1);
    expect(enemies.length).toBe(1);
    const eid = enemies[0]!;
    expect(Movement.pathIndex[eid]).toBe(0);
    expect(Movement.progress[eid]).toBe(0);
    expect(Movement.currentSpeed[eid]).toBe(0);
    expect(Movement.targetX[eid]).toBe(5 * 64 + 32);
    expect(Movement.targetY[eid]).toBe(3 * 64 + 32);
    expect(Position.x[eid]).toBe(5 * 64 + 32);
    expect(Position.y[eid]).toBe(3 * 64 + 32);
  });

  it('throws at construction when pathGraph is missing', () => {
    const world = new TowerWorld();
    const badMap = { ...makeBaseMap() } as MapConfig;
    expect(() => new WaveSystem(world, badMap, makeSingleWave(), getPhase, setPhase)).toThrow();
  });
});

describe('WaveSystem — LowAir flock spawning', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('吸血蝗虫每个配置 count 生成一群4-7个 LowAir 鸟群成员', () => {
    const oldRandom = Math.random;
    Math.random = () => 0;
    try {
      const world = new TowerWorld();
      const { pathGraph, spawns } = migrateEnemyPathToGraph({
        enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
      });
      const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
      const waves: WaveConfig[] = [{
        waveNumber: 1,
        spawnDelay: 0,
        enemies: [{ enemyType: EnemyType.Locust, count: 1, spawnInterval: 0 }],
      }];

      const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
      ws.startWave();
      ws.update(world, 0.1);

      const enemies = enemyQuery(world.world).filter((eid) => UnitTag.isEnemy[eid] === 1 && UnitTag.isElite[eid] !== 1);
      const flockEnemies = flockEnemyQuery(world.world);
      expect(enemies.length).toBe(4);
      expect(flockEnemies.length).toBe(4);

      const flockId = EnemyFlockMember.flockId[flockEnemies[0]!];
      for (let i = 0; i < flockEnemies.length; i++) {
        const eid = flockEnemies[i]!;
        expect(EnemyFlockMember.flockId[eid]).toBe(flockId);
        expect(EnemyFlockMember.groupSize[eid]).toBe(4);
        expect(EnemyFlockMember.memberIndex[eid]).toBe(i);
        expect(Layer.value[eid]).toBe(LayerVal.LowAir);
      }
    } finally {
      Math.random = oldRandom;
    }
  });

  it('吸血蝙蝠和无人机也使用群体出生，普通敌人仍单个出生', () => {
    const oldRandom = Math.random;
    Math.random = () => 0;
    try {
      const world = new TowerWorld();
      const { pathGraph, spawns } = migrateEnemyPathToGraph({
        enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
      });
      const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
      const waves: WaveConfig[] = [{
        waveNumber: 1,
        spawnDelay: 0,
        enemies: [
          { enemyType: EnemyType.VampireBat, count: 1, spawnInterval: 0 },
          { enemyType: EnemyType.Drone, count: 1, spawnInterval: 0 },
          { enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 },
        ],
      }];

      const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
      ws.startWave();
      ws.update(world, 0.1);
      ws.update(world, 0.1);
      ws.update(world, 0.1);

      const enemies = enemyQuery(world.world).filter((eid) => UnitTag.isEnemy[eid] === 1 && UnitTag.isElite[eid] !== 1);
      const flockEnemies = flockEnemyQuery(world.world);
      expect(enemies.length).toBe(9);
      expect(flockEnemies.length).toBe(8);
    } finally {
      Math.random = oldRandom;
    }
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
    expect(UnitTag.rewardGold[eliteEid]).toBe(ENEMY_CONFIGS[EnemyType.Goblin]!.rewardGold * 2);

    // Verify gold visual (elite gets gold color #FFD700 = R:255 G:215 B:0)
    expect(Visual.colorR[eliteEid]).toBe(255);
    expect(Visual.colorG[eliteEid]).toBe(215);
    expect(Visual.colorB[eliteEid]).toBe(0);

    // Verify enlarged size (Goblin radius=16, base size=32, ×1.2 = 38.4 → 38)
    expect(Visual.size[eliteEid]).toBeCloseTo(38.4, 0);
  });

  it('spawned elite has Elite component and UnitTag.isElite = 1', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();

    // Spawn all enemies (including elite)
    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    const elites = eliteQuery(world.world);
    expect(elites.length).toBe(1);
    const eliteEid = elites[0]!;

    // 验证精英标记正确设置
    expect(UnitTag.isElite[eliteEid]).toBe(1);
    expect(Elite.cardOptions[eliteEid]).toBe(3);
    expect(Elite.hpMultiplier[eliteEid]).toBe(2.0);
    expect(Elite.atkMultiplier[eliteEid]).toBe(1.5);
  });

  it('黑暗牧师写入正确敌人类型编号，避免场景贴图回退成哥布林', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      enemies: [{ enemyType: EnemyType.DarkPriest, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();

    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    const regularDarkPriest = enemyQuery(world.world).find((eid) => UnitTag.isEnemy[eid] === 1 && UnitTag.isElite[eid] !== 1);
    expect(regularDarkPriest).not.toBeUndefined();
    expect(ENEMY_TYPE_BY_ID[UnitTag.unitTypeNum[regularDarkPriest!]!]).toBe(EnemyType.DarkPriest);
    expect(world.getDisplayName(regularDarkPriest!)).toBe('黑暗牧师');
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

  it('Boss 波不会把最终 Boss 作为随机精英再次生成', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      enemies: [
        { enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 0 },
        { enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 },
      ],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();

    for (let i = 0; i < 20; i++) ws.update(world, 0.1);

    const bosses = bossQuery(world.world);
    const elites = eliteQuery(world.world);
    expect(bosses.length).toBe(1);
    expect(world.getDisplayName(bosses[0]!)).toBe('巨型史莱姆');
    expect(elites.length).toBe(1);
    expect(world.getDisplayName(elites[0]!)).toBe('精英 哥布林');
  });

  it('Boss 出场尺寸为70-180px并触发红色飘字回调和出场冲击环', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const spawnedBosses: Array<{ name: string; x: number; y: number }> = [];

    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      enemies: [{ enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(
      world,
      map,
      waves,
      getPhase,
      setPhase,
      undefined,
      undefined,
      undefined,
      (boss) => spawnedBosses.push({ name: boss.name, x: boss.x, y: boss.y }),
    );
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const bosses = bossQuery(world.world);
    expect(bosses.length).toBe(1);
    const boss = bosses[0]!;
    expect(Visual.size[boss]).toBeGreaterThanOrEqual(70);
    expect(Visual.size[boss]).toBeLessThanOrEqual(180);
    expect(spawnedBosses).toEqual([
      expect.objectContaining({ name: '巨型史莱姆' }),
    ]);
    expect(explosionQuery(world.world).length).toBeGreaterThan(0);
  });

  it('生成所有Boss时挂载专用Boss类型，避免退化成数据驱动Boss', () => {
    const cases: Array<[EnemyType, number]> = [
      [EnemyType.GiantSlime, BossType.GiantSlime],
      [EnemyType.QueenBeetle, BossType.QueenWorm],
      [EnemyType.Lucifer, BossType.Lucifer],
      [EnemyType.SuperRobot, BossType.SuperRobot],
      [EnemyType.AbyssLord, BossType.AbyssLord],
    ];

    for (const [enemyType, expectedBossType] of cases) {
      const world = new TowerWorld();
      const { pathGraph, spawns } = migrateEnemyPathToGraph({
        enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
      });
      const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
      const waves: WaveConfig[] = [{
        waveNumber: 1,
        spawnDelay: 0,
        isBossWave: true,
        enemies: [{ enemyType, count: 1, spawnInterval: 0 }],
      }];

      const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
      ws.startWave();
      for (let i = 0; i < 5; i++) ws.update(world, 0.1);

      const bosses = bossQuery(world.world);
      expect(bosses.length).toBe(1);
      expect(Boss.bossType[bosses[0]!]).toBe(expectedBossType);
    }
  });

  it('生成巨型史莱姆后血量归零可分裂', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      enemies: [{ enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const bosses = bossQuery(world.world);
    expect(bosses.length).toBe(1);
    const slime = bosses[0]!;
    expect(Boss.bossType[slime]).toBe(BossType.GiantSlime);
    expect(Boss.splitCount[slime]).toBe(0);
    expect(Health.max[slime]).toBe(640);
    expect(Movement.speed[slime]).toBe(15);
    expect(Visual.size[slime]).toBe(126);

    Health.current[slime] = 0;
    new BossSystem().update(world, 0.016);
    world.cleanupDeadEntities();

    const children = bossQuery(world.world);
    expect(children.length).toBe(2);
    for (const child of children) {
      expect(Boss.bossType[child]).toBe(BossType.GiantSlime);
      expect(Boss.splitCount[child]).toBe(1);
      expect(Health.current[child]).toBe(200);
      expect(Health.max[child]).toBeLessThan(Health.max[slime]!);
      expect(Movement.speed[child]).toBeGreaterThan(Movement.speed[slime]!);
      expect(Visual.size[child]).toBeLessThan(Visual.size[slime]!);
    }
  });

  it('调试跳波会直接进入最后一波并按正常流程生成 Boss', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [
      { waveNumber: 1, spawnDelay: 0, enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }] },
      { waveNumber: 2, spawnDelay: 0, isBossWave: true, enemies: [{ enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 0 }] },
    ];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);

    expect(ws.skipToFinalWave()).toBe(true);
    expect(ws.currentWave).toBe(2);
    expect(ws.currentIsBossWave).toBe(true);
    expect(phase).toBe(GamePhase.Battle);

    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const bosses = bossQuery(world.world);
    expect(bosses.length).toBe(1);
    expect(world.getDisplayName(bosses[0]!)).toBe('巨型史莱姆');
  });

  it('Boss 存活且首轮出怪结束后，会按配置定时补充金币敌人', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      bossReinforcements: {
        interval: 1,
        maxAliveNonBoss: 10,
        groups: [{ enemyType: EnemyType.Goblin, count: 2, spawnInterval: 0 }],
      },
      enemies: [{ enemyType: EnemyType.Lucifer, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();
    ws.update(world, 0);
    ws.update(world, 1);

    const bosses = bossQuery(world.world);
    const nonBossEnemies = enemyQuery(world.world)
      .filter((eid) => UnitTag.isEnemy[eid] === 1 && !bosses.includes(eid));
    expect(bosses.length).toBe(1);
    expect(nonBossEnemies.length).toBe(2);
    for (const eid of nonBossEnemies) {
      expect(world.getDisplayName(eid)).toBe('哥布林');
      expect(UnitTag.rewardGold[eid]).toBe(ENEMY_CONFIGS[EnemyType.Goblin]!.rewardGold);
    }
  });

  it('Boss 补怪未显式配置 groups 时，复用 Boss 波里的非 Boss 敌人', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      bossReinforcements: { interval: 1, maxAliveNonBoss: 1 },
      enemies: [
        { enemyType: EnemyType.Lucifer, count: 1, spawnInterval: 0 },
        { enemyType: EnemyType.Boar, count: 1, spawnInterval: 0 },
      ],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.startWave();
    ws.update(world, 0);
    ws.update(world, 0);

    for (const eid of enemyQuery(world.world)) {
      if (!hasComponent(world.world, Boss, eid)) Health.current[eid] = 0;
    }

    ws.update(world, 1);

    const liveNonBossEnemies = enemyQuery(world.world)
      .filter((eid) => UnitTag.isEnemy[eid] === 1 && Health.current[eid]! > 0 && !hasComponent(world.world, Boss, eid));
    expect(liveNonBossEnemies.length).toBe(1);
    expect(world.getDisplayName(liveNonBossEnemies[0]!)).toBe('疯狂野猪');
  });

  it('最终 Boss 死亡后停止补怪并进入胜利', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      bossReinforcements: {
        interval: 1,
        maxAliveNonBoss: 10,
        groups: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
      },
      enemies: [{ enemyType: EnemyType.Lucifer, count: 1, spawnInterval: 0 }],
    }];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.setWaveInterval(1);
    ws.startWave();
    ws.update(world, 0);

    const [boss] = bossQuery(world.world);
    expect(boss).toBeDefined();
    Health.current[boss!] = 0;
    ws.update(world, 1);

    const liveNonBossEnemies = enemyQuery(world.world)
      .filter((eid) => UnitTag.isEnemy[eid] === 1 && Health.current[eid]! > 0 && !hasComponent(world.world, Boss, eid));
    expect(liveNonBossEnemies.length).toBe(0);
    expect(phase).toBe(GamePhase.Victory);
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

  it('敌人配置攻击力为 0 时，生成实体的 UnitTag.atk 兜底为 1', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const oldAtk = ENEMY_CONFIGS[EnemyType.Goblin]!.atk;
    ENEMY_CONFIGS[EnemyType.Goblin]!.atk = 0;

    try {
      const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
      ws.startWave();
      for (let i = 0; i < 5; i++) ws.update(world, 0.1);

      const allEnemies = enemyQuery(world.world);
      const regularEid = allEnemies.find((eid) => UnitTag.isElite[eid] === 0)!;
      expect(UnitTag.atk[regularEid]).toBe(1);
    } finally {
      ENEMY_CONFIGS[EnemyType.Goblin]!.atk = oldAtk;
    }
  });

  it('敌人攻击伤害类型来自配置，不固定为物理伤害', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const oldDamageType = ENEMY_CONFIGS[EnemyType.Wizard]!.damageType;
    ENEMY_CONFIGS[EnemyType.Wizard]!.damageType = 'magic';

    try {
      const waves: WaveConfig[] = [{
        waveNumber: 1,
        spawnDelay: 0,
        enemies: [{ enemyType: EnemyType.Wizard, count: 1, spawnInterval: 0 }],
      }];
      const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
      ws.startWave();
      for (let i = 0; i < 5; i++) ws.update(world, 0.1);

      const allEnemies = enemyQuery(world.world);
      const regularEid = allEnemies.find((eid) => UnitTag.isElite[eid] === 0)!;
      expect(Attack.damageType[regularEid]).toBe(DamageTypeVal.Magic);
    } finally {
      ENEMY_CONFIGS[EnemyType.Wizard]!.damageType = oldDamageType;
    }
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

  it('onWaveReward callback fires with correct gold amount after a non-final wave', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };

    let rewardGold = 0;
    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelay: 0,
        enemies: [{ enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 }],
        reward: 75,
      },
      {
        waveNumber: 2,
        spawnDelay: 0,
        enemies: [{ enemyType: EnemyType.AbyssLord, count: 1, spawnInterval: 0 }],
      },
    ];

    const ws = new WaveSystem(world, map, waves, getPhase, setPhase, undefined, undefined, (gold) => {
      rewardGold = gold;
    });
    // v5.0: set short interval so timer triggers within test timeframe
    ws.setWaveInterval(0.5);
    ws.startWave();

    for (let i = 0; i < 5; i++) ws.update(world, 0.1);
    const enemies = enemyQuery(world.world);
    for (const eid of enemies) {
      Health.current[eid] = 0;
    }

    // v5.0: run enough updates for waveInterval timer to expire
    // Note: 10 × 0.1 = 0.9999... (floating point), so we need 11 iterations for >= 1.0
    for (let i = 0; i < 11; i++) {
      ws.update(world, 0.1);
    }

    // After 11 × 0.1 = 1.1s, waveInterval (clamped to 1) has elapsed.
    // Non-final wave completion should enter wave break and fire reward callback.
    expect(phase).toBe(GamePhase.WaveBreak);
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
    // v5.0: set short interval so timer triggers within test timeframe
    ws.setWaveInterval(0.5);
    ws.startWave();

    for (let i = 0; i < 5; i++) ws.update(world, 0.1);
    const enemies = enemyQuery(world.world);
    for (const eid of enemies) {
      Health.current[eid] = 0;
    }

    for (let i = 0; i < 11; i++) ws.update(world, 0.1);

    expect(rewardCalled).toBe(false);
  });

  it('非最终波还在等待出怪时，不会丢弃当前波直接进入下一波', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [
      {
        waveNumber: 1,
        spawnDelay: 30,
        enemies: [
          { enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 },
          { enemyType: EnemyType.Boar, count: 1, spawnInterval: 0 },
        ],
      },
      {
        waveNumber: 2,
        spawnDelay: 0,
        enemies: [{ enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 0 }],
      },
    ];
    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.setWaveInterval(1);
    ws.startWave();

    for (let i = 0; i < 12; i++) ws.update(world, 0.1);

    expect(phase).toBe(GamePhase.Battle);
    expect(ws.currentWave).toBe(1);
    expect(enemyQuery(world.world).length).toBe(0);

    for (let i = 0; i < 12; i++) ws.update(world, 0.1);
    expect(ws.currentWave).toBe(1);
    expect(enemyQuery(world.world).length).toBe(0);

    for (let i = 0; i < 300; i++) ws.update(world, 0.1);
    expect(ws.currentWave).toBe(2);
    expect(phase).toBe(GamePhase.WaveBreak);
    expect(enemyQuery(world.world).length).toBeGreaterThanOrEqual(2);
  });

  it('最后一波出怪结束后，最终 Boss 存活时不能直接胜利', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves = makeSingleWave();
    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.setWaveInterval(1);
    ws.startWave();

    for (let i = 0; i < 12; i++) ws.update(world, 0.1);

    expect(phase).toBe(GamePhase.Battle);
  });

  it('最后一波还在等待出怪时，空场也不能直接胜利', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 30,
      isBossWave: true,
      enemies: [{ enemyType: EnemyType.AbyssLord, count: 1, spawnInterval: 0 }],
    }];
    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.setWaveInterval(1);
    ws.startWave();

    for (let i = 0; i < 12; i++) ws.update(world, 0.1);

    expect(phase).toBe(GamePhase.Battle);
    expect(bossQuery(world.world).length).toBe(0);
  });

  it('最后一波非 Boss 敌人死亡但最终 Boss 存活时不能判定胜利', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      enemies: [
        { enemyType: EnemyType.AbyssLord, count: 1, spawnInterval: 0 },
        { enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 },
      ],
    }];
    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.setWaveInterval(1);
    ws.startWave();

    for (let i = 0; i < 5; i++) ws.update(world, 0.1);
    const enemies = enemyQuery(world.world);
    for (const eid of enemies) {
      if (!hasComponent(world.world, Boss, eid)) Health.current[eid] = 0;
    }
    ws.update(world, 1.0);

    expect(phase).toBe(GamePhase.Battle);
  });

  it('最终 Boss 真正死亡后判定胜利，即使仍有非 Boss 敌人存活', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      enemies: [
        { enemyType: EnemyType.AbyssLord, count: 1, spawnInterval: 0 },
        { enemyType: EnemyType.Goblin, count: 1, spawnInterval: 0 },
      ],
    }];
    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    ws.setWaveInterval(1);
    ws.startWave();

    for (let i = 0; i < 5; i++) ws.update(world, 0.1);
    const [boss] = bossQuery(world.world);
    expect(boss).toBeDefined();
    Health.current[boss!] = 0;
    ws.update(world, 0.1);

    expect(phase).toBe(GamePhase.Victory);
  });

  it('最后一波巨型史莱姆归零待分裂时不能判定胜利', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const waves: WaveConfig[] = [{
      waveNumber: 1,
      spawnDelay: 0,
      isBossWave: true,
      enemies: [{ enemyType: EnemyType.GiantSlime, count: 1, spawnInterval: 0 }],
    }];
    const ws = new WaveSystem(world, map, waves, getPhase, setPhase);
    const bossSystem = new BossSystem();
    ws.setWaveInterval(1);
    ws.startWave();

    for (let i = 0; i < 5; i++) ws.update(world, 0.1);
    const [slime] = bossQuery(world.world);
    expect(slime).toBeDefined();
    expect(Boss.bossType[slime!]).toBe(BossType.GiantSlime);

    Health.current[slime!] = 0;
    ws.update(world, 1.0);

    expect(phase).toBe(GamePhase.Battle);

    bossSystem.update(world, 0.016);
    world.cleanupDeadEntities();
    ws.update(world, 0.1);

    const bossesAfter = bossQuery(world.world);
    expect(bossesAfter.length).toBe(2);
    expect(phase).toBe(GamePhase.Battle);
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
