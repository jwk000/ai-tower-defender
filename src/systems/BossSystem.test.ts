/**
 * BossSystem 测试 — 5种BOSS机制全量测试
 *
 * 对应设计文档:
 * - design/03-units.md §6 (BOSS)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TowerWorld, defineQuery, hasComponent } from '../core/World.js';
import type { System } from '../core/World.js';
import {
  Position, Health, Boss, Faction, FactionVal,
  Attack, UnitTag, Visual, Category, CategoryVal, Movement,
  Tower, TargetingMark, EnemySkillParticleEffect, EnemySkillParticleEffectVal,
  MoveModeVal, DamageTypeVal, ShapeVal, Layer, LayerVal,
} from '../core/components.js';
import { BossSystem, BossType } from './BossSystem.js';
import { HealthSystem } from './HealthSystem.js';
import { MovementSystem } from './MovementSystem.js';
import { GamePhase } from '../types/index.js';
import { ENEMY_ID_BY_TYPE, MAP_01 } from '../data/gameData.js';
import { EnemyType } from '../types/index.js';

// ============================================================
// Queries for tests
// ============================================================

const allHealthQuery = defineQuery([Health]);
const allPositionedQuery = defineQuery([Position]);
const bossQuery = defineQuery([Boss]);
const skillParticleQuery = defineQuery([EnemySkillParticleEffect]);
const GIANT_SLIME_UNIT_TYPE_NUM = 19;

// ============================================================
// Test helpers
// ============================================================

function makeBoss(
  world: TowerWorld,
  bossType: number,
  overrides: {
    hp?: number;
    maxHp?: number;
    atk?: number;
    x?: number; y?: number;
    faction?: number;
    splitCount?: number;
    spawnTimer?: number;
    abilityTimer?: number;
    phase?: number;
  } = {},
): number {
  const eid = world.createEntity();
  const maxHp = overrides.maxHp ?? overrides.hp ?? 1000;
  world.addComponent(eid, Position, { x: overrides.x ?? 500, y: overrides.y ?? 300 });
  world.addComponent(eid, Health, {
    current: overrides.hp ?? maxHp,
    max: maxHp,
    armor: 10,
    magicResist: 5,
  });
  world.addComponent(eid, Boss, {
    bossType,
    phase: overrides.phase ?? 1,
    phase2HpRatio: 0.5,
    transitionTimer: 0,
    abilityTimer: overrides.abilityTimer ?? 0,
    spawnTimer: overrides.spawnTimer ?? 0,
    splitCount: overrides.splitCount ?? 0,
    immuneToTowers: 0,
  });
  world.addComponent(eid, Faction, { value: overrides.faction ?? FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isBoss: 1, atk: overrides.atk ?? 20 });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle, colorR: 200, colorG: 0, colorB: 0,
    size: 40, alpha: 1, facing: 1,
  });
  world.addComponent(eid, Attack, {
    damage: overrides.atk ?? 20,
    attackSpeed: 0.5,
    range: 50,
    damageType: DamageTypeVal.Physical,
    isRanged: 0,
    alertRange: 200,
    cooldownTimer: 0,
    targetId: 0,
    targetSelection: 0,
    attackMode: 0,
    splashRadius: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    drainPercent: 0,
  });
  world.setDisplayName(eid, 'Boss');
  return eid;
}

function makeTower(world: TowerWorld, x: number, y: number, hp: number = 200): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 5, magicResist: 5 });
  world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 50 });
  world.addComponent(eid, Faction, { value: FactionVal.Justice });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Rect, colorR: 100, colorG: 100, colorB: 200,
    size: 20, alpha: 1, facing: 1,
  });
  world.setDisplayName(eid, 'Tower');
  return eid;
}

function makeEnemy(world: TowerWorld, x: number, y: number, hp: number = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, { isEnemy: 1, atk: 10 });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle, colorR: 200, colorG: 100, colorB: 100,
    size: 12, alpha: 1, facing: 1,
  });
  world.setDisplayName(eid, 'Enemy');
  return eid;
}

/** Count alive entities (Health.current > 0) with the given component */
function countAliveWithBoss(world: TowerWorld): number {
  const all = bossQuery(world.world);
  let count = 0;
  for (const eid of all) {
    if (Health.current[eid] !== undefined && Health.current[eid]! > 0) {
      count++;
    }
  }
  return count;
}

/** Count alive entities with any Health > 0 */
function countAliveEntities(world: TowerWorld): number {
  const all = allHealthQuery(world.world);
  let count = 0;
  for (const eid of all) {
    if (Health.current[eid]! > 0) {
      count++;
    }
  }
  return count;
}

/** Count alive entities with UnitTag.isEnemy === 1 */
function countAliveEnemies(world: TowerWorld): number {
  const all = allHealthQuery(world.world);
  let count = 0;
  for (const eid of all) {
    if (Health.current[eid]! > 0 && UnitTag.isEnemy[eid] === 1) {
      count++;
    }
  }
  return count;
}

function getAliveNonBossChaosEnemies(world: TowerWorld, boss: number): number[] {
  return allHealthQuery(world.world).filter((eid) => (
    eid !== boss &&
    Health.current[eid] !== undefined &&
    Health.current[eid]! > 0 &&
    Faction.value[eid] === FactionVal.Chaos &&
    UnitTag.isEnemy[eid] === 1
  ));
}

function distanceBetween(a: number, b: number): number {
  const dx = (Position.x[a] ?? 0) - (Position.x[b] ?? 0);
  const dy = (Position.y[a] ?? 0) - (Position.y[b] ?? 0);
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================
// GiantSlime (0) — Split Skill
// ============================================================

describe('BossSystem — GiantSlime (分裂技能)', () => {
  let world: TowerWorld;
  let system: BossSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new BossSystem();
  });

  it('巨型史莱姆被打空血后先分裂为2个中型子Boss', () => {
    const boss = makeBoss(world, BossType.GiantSlime, {
      hp: 800, maxHp: 800, splitCount: 0,
    });

    const initialCount = countAliveWithBoss(world);
    expect(initialCount).toBe(1);

    // Kill the boss
    Health.current[boss] = 0;
    system.update(world, 0);
    world.cleanupDeadEntities();

    const bossesAfter = bossQuery(world.world);
    expect(bossesAfter.length).toBe(2);
    for (const eid of bossesAfter) {
      expect(Boss.bossType[eid]).toBe(BossType.GiantSlime);
      expect(Boss.splitCount[eid]).toBe(1);
      expect(Health.max[eid]).toBe(200);
      expect(Attack.damage[eid]).toBe(15);
      expect(Visual.size[eid]).toBe(86);
      expect(Movement.speed[eid]).toBe(20);
    }
  });

  it('中型史莱姆被打空血后继续分裂为2个小型子Boss', () => {
    const boss = makeBoss(world, BossType.GiantSlime, {
      hp: 200, maxHp: 200, splitCount: 1,
    });

    Health.current[boss] = 0;
    system.update(world, 0);
    world.cleanupDeadEntities();

    const bossesAfter = bossQuery(world.world);
    expect(bossesAfter.length).toBe(2);
    for (const eid of bossesAfter) {
      expect(Boss.splitCount[eid]).toBe(2);
      expect(Health.max[eid]).toBe(80);
      expect(Attack.damage[eid]).toBe(12);
      expect(Visual.size[eid]).toBe(58);
      expect(Movement.speed[eid]).toBe(28);
    }
  });

  it('史莱姆分裂层级满足体型递减、血量递减、速度递增', () => {
    const giant = makeBoss(world, BossType.GiantSlime, {
      hp: 800,
      maxHp: 800,
      splitCount: 0,
    });
    Visual.size[giant] = 126;
    Movement.speed[giant] = 15;

    Health.current[giant] = 0;
    system.update(world, 0);
    world.cleanupDeadEntities();

    const medium = bossQuery(world.world)[0]!;
    expect(Visual.size[medium]).toBeLessThan(Visual.size[giant]!);
    expect(Health.max[medium]).toBeLessThan(Health.max[giant]!);
    expect(Movement.speed[medium]).toBeGreaterThan(Movement.speed[giant]!);

    Health.current[medium] = 0;
    system.update(world, 0);
    world.cleanupDeadEntities();

    const small = bossQuery(world.world).find((eid) => Boss.splitCount[eid] === 2)!;
    expect(Visual.size[small]).toBeLessThan(Visual.size[medium]!);
    expect(Health.max[small]).toBeLessThan(Health.max[medium]!);
    expect(Movement.speed[small]).toBeGreaterThan(Movement.speed[medium]!);
  });

  it('小型史莱姆死亡才是真正死亡，不再分裂', () => {
    const boss = makeBoss(world, BossType.GiantSlime, {
      hp: 80, maxHp: 80, splitCount: 2, // small slime
    });

    // Kill the small slime
    Health.current[boss] = 0;
    system.update(world, 0);
    world.cleanupDeadEntities();

    const bossesAfter = bossQuery(world.world);
    // BossSystem不再分裂小型史莱姆；真正死亡由LifecycleSystem处理。
    expect(bossesAfter.length).toBe(1);
  });

  it('在主循环管线中应先于生命周期死亡判定完成非最终分裂', () => {
    const boss = makeBoss(world, BossType.GiantSlime, {
      hp: 800, maxHp: 800, splitCount: 0,
    });

    world.registerSystem(system);

    Health.current[boss] = 0;
    world.update(0.016);

    const bossesAfter = bossQuery(world.world);
    expect(bossesAfter.length).toBe(2);
    for (const eid of bossesAfter) {
      expect(Boss.splitCount[eid]).toBe(1);
      expect(Health.current[eid]).toBe(200);
      expect(world.getDisplayName(eid)).toBe('中型史莱姆');
    }
  });

  it('分裂子史莱姆沿用史莱姆单位类型，并从父体附近路径继续移动', () => {
    const movementSystem = new MovementSystem(MAP_01);
    const parentX = 6 * MAP_01.tileSize + MAP_01.tileSize / 2;
    const parentY = 4 * MAP_01.tileSize + MAP_01.tileSize / 2;
    const boss = makeBoss(world, BossType.GiantSlime, {
      hp: 800,
      maxHp: 800,
      splitCount: 0,
      x: parentX,
      y: parentY,
    });

    Health.current[boss] = 0;
    system.update(world, 0);
    world.cleanupDeadEntities();

    const bossesAfter = bossQuery(world.world);
    expect(bossesAfter.length).toBe(2);
    for (const eid of bossesAfter) {
      expect(UnitTag.unitTypeNum[eid]).toBe(GIANT_SLIME_UNIT_TYPE_NUM);
      expect(Movement.spawnIdx[eid]).toBe(0);
      expect(Movement.pathIndex[eid]).not.toBe(0);
      expect(Movement.progress[eid]).toBeGreaterThan(0);
      expect(Position.x[eid]).toBe(parentX);
      expect(Position.y[eid]).toBe(parentY);
    }

    movementSystem.update(world, 0.016);

    for (const eid of bossesAfter) {
      expect(Position.x[eid]).toBeGreaterThan(parentX);
      expect(Position.x[eid]).toBeLessThan(parentX + 2);
      expect(Position.y[eid]).toBe(parentY);
    }
  });

  it('后置伤害系统把史莱姆打到0血时，HealthSystem不应抢先清理分裂层级', () => {
    const boss = makeBoss(world, BossType.GiantSlime, {
      hp: 800, maxHp: 800, splitCount: 0,
    });
    let killedCount = 0;
    let lateDamageApplied = false;
    const lateDamageSystem: System = {
      name: 'LateDamageSystem',
      update: () => {
        if (!lateDamageApplied) {
          lateDamageApplied = true;
          Health.current[boss] = 0;
        }
      },
    };

    world.registerSystem(system);
    world.registerSystem(lateDamageSystem);
    world.registerSystem(new HealthSystem(
      () => GamePhase.Battle,
      () => {},
      () => { killedCount += 1; },
    ));

    world.update(0.016);

    expect(killedCount).toBe(0);
    expect(bossQuery(world.world)).toContain(boss);
    expect(Health.current[boss]).toBe(0);

    world.update(0.016);

    const bossesAfter = bossQuery(world.world);
    expect(bossesAfter).not.toContain(boss);
    expect(bossesAfter.length).toBe(2);
    expect(killedCount).toBe(0);
    for (const eid of bossesAfter) {
      expect(Boss.bossType[eid]).toBe(BossType.GiantSlime);
      expect(Boss.splitCount[eid]).toBe(1);
      expect(Health.current[eid]).toBe(200);
    }
  });
});

// ============================================================
// QueenWorm (1) — tower immunity + minion spawning
// ============================================================

describe('BossSystem — QueenWorm (虫族女王)', () => {
  let world: TowerWorld;
  let system: BossSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new BossSystem();
  });

  it('虫族女王设置塔免疫标记', () => {
    const boss = makeBoss(world, BossType.QueenWorm, { hp: 1000 });
    system.update(world, 0);
    expect(Boss.immuneToTowers[boss]).toBe(1);
  });

  it('每10秒召唤5只随机虫族单位', () => {
    const boss = makeBoss(world, BossType.QueenWorm, {
      hp: 1000, spawnTimer: 9.9,
    });
    const initialEnemyCount = countAliveEnemies(world);

    // Tick just past 10s
    system.update(world, 0.2);

    const enemyCountAfter = countAliveEnemies(world);
    expect(enemyCountAfter - initialEnemyCount).toBe(5);

    expect(Boss.spawnTimer[boss]).toBeLessThan(1);
  });

  it('召唤的随机虫族单位在BOSS周围随机位置', () => {
    const boss = makeBoss(world, BossType.QueenWorm, {
      hp: 1000, spawnTimer: 10, x: 500, y: 300,
    });
    system.update(world, 0.1);

    const allHealth = allHealthQuery(world.world);
    for (const eid of allHealth) {
      if (eid === boss) continue;
      if (Health.current[eid]! <= 0) continue;
      if (UnitTag.isEnemy[eid] !== 1) continue;

      const ex = Position.x[eid] ?? 0;
      const ey = Position.y[eid] ?? 0;
      const dx = ex - 500;
      const dy = ey - 300;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Should be within 70px (40 + 30 random)
      expect(dist).toBeLessThanOrEqual(70);
      expect(dist).toBeGreaterThanOrEqual(30);
    }
  });

  it('召唤单位来自虫族单位池', () => {
    const boss = makeBoss(world, BossType.QueenWorm, {
      hp: 1000, spawnTimer: 10,
    });
    system.update(world, 0.1);

    const allowedNames = new Set(['沙漠黑虫', '钻地甲虫', '吸血蝗虫', '自爆甲虫']);
    const summons = allHealthQuery(world.world).filter((eid) => eid !== boss && UnitTag.isEnemy[eid] === 1);
    expect(summons.length).toBe(5);
    for (const eid of summons) {
      expect(allowedNames.has(world.getDisplayName(eid) ?? '')).toBe(true);
    }
  });

  it('召唤单位写入真实敌人类型，避免渲染退回哥布林形象', () => {
    const boss = makeBoss(world, BossType.QueenWorm, {
      hp: 1000, spawnTimer: 10,
    });
    system.update(world, 0.1);

    const allowedTypeNums = new Set([
      ENEMY_ID_BY_TYPE[EnemyType.DesertBeetle],
      ENEMY_ID_BY_TYPE[EnemyType.BurrowBeetle],
      ENEMY_ID_BY_TYPE[EnemyType.Locust],
      ENEMY_ID_BY_TYPE[EnemyType.BombBeetle],
    ]);
    const goblinTypeNum = ENEMY_ID_BY_TYPE[EnemyType.Goblin];
    const summons = allHealthQuery(world.world).filter((eid) => eid !== boss && UnitTag.isEnemy[eid] === 1);

    expect(summons.length).toBe(5);
    for (const eid of summons) {
      expect(allowedTypeNums.has(UnitTag.unitTypeNum[eid]!)).toBe(true);
      expect(UnitTag.unitTypeNum[eid]).not.toBe(goblinTypeNum);
      expect(Visual.attackAnimDuration[eid]).toBeGreaterThan(0);
    }
  });

  it('释放虫群孵化时创建Boss技能提示飘字', () => {
    const announcementMock = {
      show: vi.fn(),
    };
    system = new BossSystem(announcementMock as unknown as ConstructorParameters<typeof BossSystem>[0]);
    makeBoss(world, BossType.QueenWorm, { hp: 1000, spawnTimer: 10 });

    system.update(world, 0.1);

    expect(announcementMock.show).toHaveBeenCalledWith(
      world,
      '虫群孵化',
      '每10秒在女王周围召唤5只随机虫族单位；塔仍无法锁定女王',
      10,
    );
  });
});

// ============================================================
// Lucifer (2) — summon skeletons + enrage
// ============================================================

describe('BossSystem — Lucifer (路西法)', () => {
  let world: TowerWorld;
  let system: BossSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new BossSystem();
  });

  it('每10秒召唤3个骷髅', () => {
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 1200, maxHp: 1200, spawnTimer: 9.9, faction: FactionVal.Chaos,
    });
    const initialCount = countAliveEnemies(world);

    system.update(world, 0.2);

    const newCount = countAliveEnemies(world);
    expect(newCount - initialCount).toBe(3);

    // Verify skeletons are Chaos faction
    const allHealth = allHealthQuery(world.world);
    let skeletonCount = 0;
    for (const eid of allHealth) {
      if (eid === boss) continue;
      if (Health.current[eid]! <= 0) continue;
      if (Faction.value[eid] === FactionVal.Chaos && UnitTag.isEnemy[eid] === 1) {
        skeletonCount++;
      }
    }
    expect(skeletonCount).toBe(3);
  });

  it('召唤骷髅分散落位且视觉尺寸放大2倍', () => {
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 1200, maxHp: 1200, spawnTimer: 10, x: 500, y: 300,
      faction: FactionVal.Chaos,
    });

    system.update(world, 0.1);

    const skeletons = getAliveNonBossChaosEnemies(world, boss);
    expect(skeletons).toHaveLength(3);
    for (const skeleton of skeletons) {
      expect(Visual.size[skeleton]).toBe(28);
      expect(distanceBetween(skeleton, boss)).toBeGreaterThanOrEqual(96);
    }
    for (let i = 0; i < skeletons.length; i++) {
      for (let j = i + 1; j < skeletons.length; j++) {
        expect(distanceBetween(skeletons[i]!, skeletons[j]!)).toBeGreaterThan(130);
      }
    }
  });

  it('召唤骷髅时在每个落点播放地下钻出尘土特效', () => {
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 1200, maxHp: 1200, spawnTimer: 10, x: 500, y: 300,
      faction: FactionVal.Chaos,
    });

    system.update(world, 0.1);

    const dustEffects = skillParticleQuery(world.world).filter((eid) => (
      EnemySkillParticleEffect.effectType[eid] === EnemySkillParticleEffectVal.BurrowTrail
    ));
    expect(dustEffects).toHaveLength(3);
    for (const effect of dustEffects) {
      expect(EnemySkillParticleEffect.radius[effect]).toBeGreaterThanOrEqual(46);
      expect(EnemySkillParticleEffect.colorR[effect]).toBe(38);
      expect(EnemySkillParticleEffect.colorG[effect]).toBe(34);
      expect(EnemySkillParticleEffect.colorB[effect]).toBe(30);
    }
  });

  it('召唤骷髅移动后不会瞬移回出生口', () => {
    const movement = new MovementSystem(MAP_01, () => GamePhase.Battle);
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 1200, maxHp: 1200, spawnTimer: 10, x: 500, y: 300,
      faction: FactionVal.Chaos,
    });

    system.update(world, 0.1);

    const skeletons = getAliveNonBossChaosEnemies(world, boss);
    expect(skeletons).toHaveLength(3);
    const spawnPositions = skeletons.map((eid) => ({
      eid,
      x: Position.x[eid] ?? 0,
      y: Position.y[eid] ?? 0,
    }));
    const spawn = MAP_01.spawns![0]!;
    const spawnEntranceX = spawn.col * MAP_01.tileSize + MAP_01.tileSize / 2;
    const spawnEntranceY = spawn.row * MAP_01.tileSize + MAP_01.tileSize / 2;

    movement.update(world, 0.1);

    for (const { eid, x, y } of spawnPositions) {
      expect(distanceBetween(eid, boss)).toBeGreaterThan(70);
      expect(Math.hypot((Position.x[eid] ?? 0) - x, (Position.y[eid] ?? 0) - y)).toBeLessThan(20);
      expect(Math.hypot((Position.x[eid] ?? 0) - spawnEntranceX, (Position.y[eid] ?? 0) - spawnEntranceY)).toBeGreaterThan(120);
    }
  });

  it('场上骷髅数达到上限(12)时不继续召唤', () => {
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 1200, maxHp: 1200, spawnTimer: 10, x: 500, y: 300,
      faction: FactionVal.Chaos,
    });

    // Pre-spawn 12 skeleton-like entities
    for (let i = 0; i < 12; i++) {
      const eid = world.createEntity();
      world.addComponent(eid, Position, { x: 500 + i * 10, y: 300 });
      world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
      world.addComponent(eid, Faction, { value: FactionVal.Chaos });
      world.addComponent(eid, Category, { value: CategoryVal.Enemy });
      world.addComponent(eid, UnitTag, { isEnemy: 1, atk: 8 });
    }

    const initialEnemyCount = countAliveEnemies(world);
    // 12 skeletons + 1 boss = 13
    expect(initialEnemyCount).toBe(13);

    system.update(world, 0.1);

    // No additional skeletons should spawn (cap reached)
    const finalEnemyCount = countAliveEnemies(world);
    expect(finalEnemyCount).toBe(13);
  });

  it('HP低于30%时进入暴怒：ATK+50%，召唤间隔缩短至5秒', () => {
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 300, maxHp: 1200, atk: 40, spawnTimer: 5, // < 30% HP
      faction: FactionVal.Chaos,
    });

    const initialAtk = Attack.damage[boss];

    system.update(world, 0.1);

    // ATK should increase by 50%
    expect(Attack.damage[boss]).toBe(Math.round(initialAtk! * 1.5));
    // transitionTimer marked as enraged
    expect(Boss.transitionTimer[boss]).toBe(1);

    // With spawnTimer at 5s, should spawn skeletons (enrage interval = 5s)
    const allHealth = allHealthQuery(world.world);
    let skeletonCount = 0;
    for (const eid of allHealth) {
      if (eid === boss) continue;
      if (Health.current[eid]! <= 0) continue;
      if (Faction.value[eid] === FactionVal.Chaos && UnitTag.isEnemy[eid] === 1) {
        skeletonCount++;
      }
    }
    expect(skeletonCount).toBe(3);
  });

  it('召唤施法时停步2秒，施法结束后继续移动', () => {
    const boss = makeBoss(world, BossType.Lucifer, {
      hp: 1200, maxHp: 1200, spawnTimer: 10, x: 0, y: 96,
      faction: FactionVal.Chaos,
    });
    world.addComponent(boss, Movement, {
      speed: 64,
      currentSpeed: 64,
      moveMode: MoveModeVal.FollowPath,
      targetX: 0,
      targetY: 96,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
      homeX: 0,
      homeY: 96,
      moveRange: 0,
    });
    const movement = new MovementSystem(MAP_01, () => GamePhase.Battle);

    system.update(world, 0.1);
    expect(Boss.abilityTimer[boss]).toBeLessThan(0);

    const xAfterSummon = Position.x[boss];
    const yAfterSummon = Position.y[boss];
    movement.update(world, 1);
    expect(Position.x[boss]).toBe(xAfterSummon);
    expect(Position.y[boss]).toBe(yAfterSummon);
    expect(Movement.currentSpeed[boss]).toBe(0);

    system.update(world, 2);
    movement.update(world, 0.5);
    expect(Boss.abilityTimer[boss]).toBeGreaterThanOrEqual(0);
    expect(Movement.currentSpeed[boss]).toBeGreaterThan(0);
  });
});

// ============================================================
// SuperRobot (3) — missile bombardment
// ============================================================

describe('BossSystem — SuperRobot (超级机器人)', () => {
  let world: TowerWorld;
  let system: BossSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new BossSystem();
  });

  it('首次10秒后进入警告阶段(phase=1)，创建TargetingMark', () => {
    // Create towers for targeting
    makeTower(world, 500, 300, 200);
    makeTower(world, 520, 310, 200); // close to first tower (dense area)

    makeBoss(world, BossType.SuperRobot, {
      hp: 2000, maxHp: 2000, abilityTimer: 9.9, phase: 0,
    });

    system.update(world, 0.2); // abilityTimer: 9.9 + 0.2 = 10.1 → should fire

    // Check that targeting mark was created (TargetingMark entity has no Health component)
    let markFound = false;
    const allEntities = allPositionedQuery(world.world);
    for (const eid of allEntities) {
      if (hasComponent(world.world, TargetingMark, eid)) {
        markFound = true;
        break;
      }
    }
    expect(markFound).toBe(true);
  });

  it('12秒后导弹爆炸，伤害密集区域内的塔', () => {
    // Create towers: 2 close (dense area) + 1 far
    const tower1 = makeTower(world, 500, 300, 200);
    const tower2 = makeTower(world, 530, 310, 200); // within 192px
    const tower3 = makeTower(world, 800, 300, 200); // far away (outside blast)

    // Boss in warning phase, 0.1s from detonation (abilityTimer=1.9 + 0.2 = 2.1 >= 2)
    const boss = makeBoss(world, BossType.SuperRobot, {
      hp: 2000, maxHp: 2000, abilityTimer: 1.9, phase: 1,
    });

    // Tick to trigger detonation
    system.update(world, 0.2);

    // Tower1 and Tower2 should take damage (they're in the dense cluster)
    // Tower3 should NOT take damage (far away)
    expect(Health.current[tower1]).toBeLessThan(200);
    expect(Health.current[tower2]).toBeLessThan(200);
    expect(Health.current[tower3]).toBe(200); // unharmed
  });

  it('没有塔时不发射导弹', () => {
    const boss = makeBoss(world, BossType.SuperRobot, {
      hp: 2000, maxHp: 2000, abilityTimer: 10, phase: 0,
    });

    system.update(world, 0.1);

    // No targeting mark should exist
    let markFound = false;
    const allEntities = allPositionedQuery(world.world);
    for (const eid of allEntities) {
      if (hasComponent(world.world, TargetingMark, eid)) {
        markFound = true;
        break;
      }
    }
    expect(markFound).toBe(false);
    // abilityTimer should reset
    expect(Boss.abilityTimer[boss]).toBe(0);
  });
});

// ============================================================
// AbyssLord (4) — annihilation + heal
// ============================================================

describe('BossSystem — AbyssLord (深渊领主)', () => {
  let world: TowerWorld;
  let system: BossSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new BossSystem();
  });

  it('每5秒吞噬周围150px内所有单位', () => {
    const boss = makeBoss(world, BossType.AbyssLord, {
      hp: 3000, maxHp: 3000, abilityTimer: 4.9, x: 500, y: 300,
    });

    // Create entities within 150px
    makeEnemy(world, 520, 310, 100);   // ~22px away
    makeTower(world, 550, 350, 200);   // ~70px away
    makeEnemy(world, 450, 280, 100);   // ~53px away

    // Create entities outside 150px
    makeEnemy(world, 700, 300, 100);   // ~200px away (safe)

    const initialAlive = countAliveEntities(world);
    // boss + 3 close + 1 far = 5 alive

    system.update(world, 0.2);

    // Only the far entity (700,300) and boss should survive
    const aliveAfter = countAliveEntities(world);
    expect(aliveAfter).toBe(2); // boss + far enemy

    // Verify far enemy is still alive
    const allHealth = allHealthQuery(world.world);
    let farEnemyFound = false;
    for (const eid of allHealth) {
      if (Health.current[eid]! > 0 && Position.x[eid] === 700) {
        farEnemyFound = true;
        break;
      }
    }
    expect(farEnemyFound).toBe(true);
  });

  it('每吞噬一个单位回复2%最大HP', () => {
    const boss = makeBoss(world, BossType.AbyssLord, {
      hp: 2000, maxHp: 3000, abilityTimer: 5, x: 500, y: 300,
    });

    // Create 2 entities within 150px
    makeEnemy(world, 520, 310, 100);
    makeEnemy(world, 510, 300, 100);

    system.update(world, 0.1);

    // 2 kills → heal 2% * 2 = 4% of 3000 = 120 HP
    // Expected HP: 2000 + 120 = 2120
    expect(Health.current[boss]).toBe(2120);
  });

  it('不吞噬其他BOSS和基地', () => {
    const boss = makeBoss(world, BossType.AbyssLord, {
      hp: 2000, maxHp: 3000, abilityTimer: 5, x: 500, y: 300,
    });

    // Create another boss within 150px
    const otherBoss = makeBoss(world, BossType.GiantSlime, {
      hp: 800, maxHp: 800, x: 550, y: 350, splitCount: 0,
    });

    // Create an objective (crystal) within 150px
    const crystal = world.createEntity();
    world.addComponent(crystal, Position, { x: 480, y: 320 });
    world.addComponent(crystal, Health, { current: 500, max: 500, armor: 0, magicResist: 0 });
    world.addComponent(crystal, Category, { value: CategoryVal.Objective });
    world.addComponent(crystal, Faction, { value: FactionVal.Neutral });

    // Create a regular enemy
    makeEnemy(world, 520, 310, 100);

    system.update(world, 0.1);

    // other boss should survive
    expect(Health.current[otherBoss]).toBeGreaterThan(0);
    // crystal should survive
    expect(Health.current[crystal]).toBeGreaterThan(0);
    // regular enemy destroyed
    // Heal: 1 kill → 2% of 3000 = 60 HP
    expect(Health.current[boss]).toBe(2060);
  });

  it('不吞噬自身', () => {
    const boss = makeBoss(world, BossType.AbyssLord, {
      hp: 3000, maxHp: 3000, abilityTimer: 5, x: 500, y: 300,
    });

    system.update(world, 0.1);

    // Boss should still be alive (not self-destroyed)
    expect(Health.current[boss]).toBeGreaterThan(0);
  });
});
