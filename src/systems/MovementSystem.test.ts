/**
 * MovementSystem 测试 — 基地伤害（敌人到达终点）
 *
 * 对应设计文档:
 * - design/05-combat-system.md 战斗系统
 * - design/14-acceptance-criteria.md ★2 = 基地 HP ≥ 80%（基地必须可受伤）
 *
 * 验收背景: 用户反馈"小兵攻击基地基地不掉血"。
 * 根因: onReachEnd 原实现 `Attack.damage[eid] ?? 10` —— bitecs TypedArray
 * 在未添加 Attack 组件时返回 0（数组默认值），而非 undefined，导致 fallback
 * 永远不会触发，无 Attack 组件的小兵到达终点造成 0 伤害。
 *
 * 修复: 在 UnitTag 中存储敌人 atk，onReachEnd 从 UnitTag.atk 取伤害值。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { defineQuery } from '../core/components.js';
import {
  Position,
  Health,
  Movement,
  UnitTag,
  MoveModeVal,
  Visual,
  Attack,
  DamageTypeVal,
  Category,
  CategoryVal,
  Boss,
  Tower,
  Faction,
  FactionVal,
  Layer,
  LayerVal,
  EnemyFlockMember,
  Burrowed,
  Trap,
  TrapTypeVal,
  Soldier,
  Projectile,
  EnemySkillParticleEffect,
  EnemySkillParticleEffectVal,
} from '../core/components.js';
import { MovementSystem } from './MovementSystem.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';
import { EnemyType, GamePhase, TileType } from '../types/index.js';
import { ENEMY_ID_BY_TYPE } from '../data/gameData.js';

const projectileQuery = defineQuery([Projectile]);
const skillParticleQuery = defineQuery([Position, EnemySkillParticleEffect]);

const TILE = 32;

function makeMap(): MapConfig {
  return {
    name: 'test',
    cols: 2,
    rows: 1,
    tileSize: TILE,
    tiles: [[TileType.Spawn, TileType.Base]],
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'e', row: 0, col: 1, role: 'crystal_anchor' },
      ],
      edges: [{ from: 's', to: 'e' }],
    },
  };
}

function makeFourTileMap(): MapConfig {
  return {
    name: 'burrow-test',
    cols: 4,
    rows: 1,
    tileSize: TILE,
    tiles: [[TileType.Spawn, TileType.Path, TileType.Path, TileType.Base]],
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'p1', row: 0, col: 1, role: 'waypoint' },
        { id: 'p2', row: 0, col: 2, role: 'waypoint' },
        { id: 'e', row: 0, col: 3, role: 'crystal_anchor' },
      ],
      edges: [
        { from: 's', to: 'p1' },
        { from: 'p1', to: 'p2' },
        { from: 'p2', to: 'e' },
      ],
    },
  };
}

function makeBoulder(world: TowerWorld, col: number, hp: number = 200): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: col * TILE + TILE / 2, y: TILE / 2 });
  world.addComponent(eid, Health, { current: hp, max: 200, armor: 20, magicResist: 0 });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 120,
    colorG: 144,
    colorB: 156,
    size: 40,
    alpha: 1,
    attackAnimTimer: 0,
    attackAnimDuration: 0,
  });
  world.addComponent(eid, Trap, {
    damagePerSecond: 0,
    radius: 0,
    cooldown: 0,
    cooldownTimer: 0,
    animTimer: 0,
    animDuration: 0.4,
    triggerCount: 0,
    maxTriggers: 0,
    trapType: TrapTypeVal.Boulder,
    direction: 0,
    stunDuration: 0,
    damage: 0,
  });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  return eid;
}

function makeBoulderAt(world: TowerWorld, x: number, hp: number = 200): number {
  const eid = makeBoulder(world, 1, hp);
  Position.x[eid] = x;
  return eid;
}

function makePathEnemy(
  world: TowerWorld,
  opts: { speed?: number; atk?: number; attackRange?: number; layer?: number; size?: number; attackSpeed?: number; unitTypeNum?: number } = {},
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: TILE / 2, y: TILE / 2 });
  world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed: opts.speed ?? TILE,
    currentSpeed: opts.speed ?? TILE,
    moveMode: MoveModeVal.FollowPath,
    pathIndex: 0,
    progress: 0,
    spawnIdx: 0,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 0,
    canAttackBuildings: 1,
    atk: opts.atk ?? 12,
    unitTypeNum: opts.unitTypeNum ?? 0,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 200,
    colorG: 0,
    colorB: 0,
    size: opts.size ?? 24,
    alpha: 1,
    attackAnimTimer: 0,
    attackAnimDuration: 0.45,
  });
  world.addComponent(eid, Attack, {
    damage: opts.atk ?? 12,
    attackSpeed: opts.attackSpeed ?? 1,
    range: opts.attackRange ?? 48,
    damageType: DamageTypeVal.Physical,
    cooldownTimer: 0,
    targetId: 0,
  });
  world.addComponent(eid, Layer, { value: opts.layer ?? LayerVal.Ground });
  return eid;
}

function makeBase(world: TowerWorld, hp: number = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 0, y: 0 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Objective });
  return eid;
}

function makeTower(world: TowerWorld, hp: number = 80): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100, y: 100 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 50 });
  world.addComponent(eid, Faction, { value: FactionVal.Justice });
  world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });
  return eid;
}

function makeSoldier(world: TowerWorld, x: number, y: number, hp: number = 80): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed: 0,
    currentSpeed: 0,
    moveMode: MoveModeVal.HoldPosition,
    targetX: x,
    targetY: y,
  });
  world.addComponent(eid, UnitTag, { isEnemy: 0, rewardGold: 0, canAttackBuildings: 0, atk: 10 });
  world.addComponent(eid, Soldier, {
    role: 1,
    aggroRadius: 120,
    leashRadius: 180,
    attackTarget: 0,
    state: 0,
    homeX: x,
    homeY: y,
  });
  world.addComponent(eid, Faction, { value: FactionVal.Justice });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  return eid;
}

function makeQueenWorm(world: TowerWorld): number {
  const queen = makePathEnemy(world, {
    speed: 20,
    atk: 30,
    attackRange: 80,
    attackSpeed: 0.6,
    size: 76,
  });
  UnitTag.isBoss[queen] = 1;
  world.addComponent(queen, Boss, { bossType: 1, phase: 1, phase2HpRatio: 0.5, immuneToTowers: 1 });
  Visual.attackAnimDuration[queen] = 0.9;
  return queen;
}

function makeEnemyAtEnd(
  world: TowerWorld,
  opts: { atk: number; withAttackComponent?: boolean; isBoss?: boolean; initialAttackAnimDuration?: number },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: TILE + TILE / 2, y: TILE / 2 });
  world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed: 50,
    moveMode: MoveModeVal.FollowPath,
    pathIndex: 1,
    progress: 0,
    spawnIdx: 0,
    currentNodeIdx: 1,
    targetNodeIdx: 0xffff,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 10,
    canAttackBuildings: 0,
    atk: opts.atk,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 255,
    colorG: 0,
    colorB: 0,
    size: 16,
    alpha: 1,
    attackAnimTimer: 0,
    attackAnimDuration: opts.initialAttackAnimDuration ?? 0,
  });
  if (opts.withAttackComponent) {
    world.addComponent(eid, Attack, {
      damage: opts.atk,
      attackSpeed: 1,
      range: 0,
      damageType: DamageTypeVal.Physical,
    });
  }
  if (opts.isBoss) {
    world.addComponent(eid, Boss, {
      bossType: 0xff,
      phase: 1,
      phase2HpRatio: 0.5,
      selfDestructTimer: -1,
    });
  }
  return eid;
}

describe('MovementSystem — 基地伤害（onReachEnd）', () => {
  let world: TowerWorld;
  let system: MovementSystem;

  beforeEach(() => {
    world = new TowerWorld();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    system = new MovementSystem(makeMap());
  });

  it('Grunt 类敌人（无 Attack 组件）到达基地必须扣血', () => {
    const base = makeBase(world, 100);
    const enemy = makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);

    expect(
      Health.current[base],
      '基地必须受到伤害 — Grunt 无 Attack 组件时不能被 bitecs TypedArray 默认 0 值蒙混',
    ).toBeLessThan(100);
    world.cleanupDeadEntities();
  });

  it('Grunt 到达基地的伤害来源于 UnitTag.atk（=5），而非默认 fallback 10', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base], '伤害值应等于配置 atk=5').toBe(95);
  });

  it('带 Attack 组件的敌人到达基地，仍以 UnitTag.atk 为伤害来源（数据源唯一）', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 12, withAttackComponent: true });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(88);
  });

  it('LowAir 鸟群敌人靠近最后路径点时会结算基地伤害', () => {
    const base = makeBase(world, 100);
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: TILE + TILE / 2 - 4, y: TILE / 2 });
    world.addComponent(enemy, Health, { current: 30, max: 30, armor: 0, magicResist: 0 });
    world.addComponent(enemy, Movement, {
      speed: 50,
      moveMode: MoveModeVal.FollowPath,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
    });
    world.addComponent(enemy, UnitTag, {
      isEnemy: 1,
      rewardGold: 4,
      canAttackBuildings: 0,
      atk: 8,
    });
    world.addComponent(enemy, Visual, {
      shape: 1,
      colorR: 120,
      colorG: 120,
      colorB: 255,
      size: 12,
      alpha: 1,
      attackAnimTimer: 0,
      attackAnimDuration: 0,
    });
    world.addComponent(enemy, EnemyFlockMember, {
      flockId: 1,
      memberIndex: 0,
      groupSize: 4,
      velocityX: 0,
      velocityY: 0,
      anchorOffsetX: 0,
      anchorOffsetY: 0,
    });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(92);
    expect(Movement.progress[enemy]).toBe(-1);
  });

  it('LowAir 鸟群敌人靠近带偏移的编队目标点时会推进路径索引', () => {
    makeBase(world, 100);
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: TILE + TILE / 2 + 24, y: TILE / 2 });
    world.addComponent(enemy, Health, { current: 30, max: 30, armor: 0, magicResist: 0 });
    world.addComponent(enemy, Movement, {
      speed: 50,
      moveMode: MoveModeVal.FollowPath,
      pathIndex: 0,
      progress: 0.9,
      spawnIdx: 0,
    });
    world.addComponent(enemy, UnitTag, {
      isEnemy: 1,
      rewardGold: 4,
      canAttackBuildings: 0,
      atk: 8,
    });
    world.addComponent(enemy, Visual, {
      shape: 1,
      colorR: 120,
      colorG: 120,
      colorB: 255,
      size: 12,
      alpha: 1,
      attackAnimTimer: 0,
      attackAnimDuration: 0,
    });
    world.addComponent(enemy, EnemyFlockMember, {
      flockId: 1,
      memberIndex: 1,
      groupSize: 4,
      velocityX: 0,
      velocityY: 0,
      anchorOffsetX: 24,
      anchorOffsetY: 0,
    });

    system.update(world, 0.016);

    expect(Movement.pathIndex[enemy]).toBe(1);
    expect(Movement.progress[enemy]).toBe(-1);
  });

  it('真实刷怪的初始 attackAnimDuration > 0 时，到达水晶第一帧仍会扣血', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 7, initialAttackAnimDuration: 0.45 });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(93);
  });

  it('敌人到达水晶后的攻击动画期间不会重复扣血', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 5, initialAttackAnimDuration: 0.45 });

    system.update(world, 0.016);
    system.update(world, 0.2);

    expect(Health.current[base]).toBe(95);
  });

  it('多个敌人同帧到达，基地累计扣血', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(85);
  });

  it('基地 HP 不会被扣成负数', () => {
    const base = makeBase(world, 3);
    makeEnemyAtEnd(world, { atk: 100, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(0);
  });

  it('水晶 HP 被扣到 0 时立即判定游戏失败', () => {
    makeBase(world, 5);
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });
    let phase = GamePhase.Battle;
    const setPhase = (next: GamePhase): void => { phase = next; };
    const baseDestroyedSystem = new MovementSystem(makeMap(), setPhase);

    baseDestroyedSystem.update(world, 0.016);

    expect(phase).toBe(GamePhase.Defeat);
  });

  it('到达终点的敌人被销毁（攻击动画完成后）', () => {
    makeBase(world, 100);
    const enemy = makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    // 首个 frame：敌人到达终点，触发攻击动画，伤害已生效但敌人尚未销毁
    system.update(world, 0.016);
    expect(Visual.attackAnimTimer[enemy], 'attackAnimTimer 应 > 0').toBeGreaterThan(0);
    expect(Visual.attackAnimDuration[enemy], 'attackAnimDuration 应 > 0').toBeGreaterThan(0);
    expect(world.hasComponent(enemy, Position), '动画中仍存活').toBe(true);

    // 第 2 帧：衰减攻击动画计时器
    system.update(world, 0.5); // 大于 0.4s，确保计时器衰减到 <= 0
    // 第 3 帧：动画计时器 <= 0，触发销毁逻辑
    system.update(world, 0.016);
    world.cleanupDeadEntities();
    expect(world.hasComponent(enemy, Position), '动画完成后应被销毁').toBe(false);
  });

  it('敌人自身（带 UnitTag.isEnemy=1+Health）不会因 baseQuery 命中而被自伤', () => {
    const base = makeBase(world, 100);
    const enemy = makeEnemyAtEnd(world, { atk: 50, withAttackComponent: false });
    const enemyHp0 = Health.current[enemy];

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(50);
    expect(Health.current[enemy], '敌人不应被自己的到达伤害击中').toBe(enemyHp0);
  });

  it('友方塔/建筑（Category != Objective）不会因 baseQuery 命中而被基地伤害误伤', () => {
    const base = makeBase(world, 100);
    const tower = makeTower(world, 80);
    const towerHp0 = Health.current[tower];
    makeEnemyAtEnd(world, { atk: 30, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base], '基地正常扣血').toBe(70);
    expect(Health.current[tower], '塔不应因敌人到达基地而掉血').toBe(towerHp0);
  });

  it('Boss 普攻塔时停步并保证约3次可摧毁一座塔', () => {
    const tower = makeTower(world, 300);
    const boss = world.createEntity();
    world.addComponent(boss, Position, { x: 90, y: 100 });
    world.addComponent(boss, Health, { current: 1000, max: 1000, armor: 0, magicResist: 0 });
    world.addComponent(boss, Movement, {
      speed: 30,
      currentSpeed: 30,
      moveMode: MoveModeVal.FollowPath,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
    });
    world.addComponent(boss, UnitTag, { isEnemy: 1, isBoss: 1, atk: 20 });
    world.addComponent(boss, Visual, {
      shape: 1,
      colorR: 200,
      colorG: 0,
      colorB: 0,
      size: 80,
      alpha: 1,
      attackAnimTimer: 0,
      attackAnimDuration: 0.9,
    });
    world.addComponent(boss, Attack, {
      damage: 20,
      attackSpeed: 1,
      range: 40,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
    });
    world.addComponent(boss, Boss, { bossType: 0xff, phase: 1, phase2HpRatio: 0.5, selfDestructTimer: -1 });

    system.update(world, 0.016);

    expect(Health.current[tower]).toBe(200);
    expect(Visual.attackAnimTimer[boss]).toBeCloseTo(0.9);
    expect(Movement.currentSpeed[boss]).toBe(0);
  });

  it('普通敌人普攻玩家单位时会播放攻击动作但继续沿路径移动', () => {
    const tower = makeTower(world, 80);
    Position.x[tower] = 20;
    Position.y[tower] = 16;
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: TILE / 2, y: TILE / 2 });
    world.addComponent(enemy, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
    world.addComponent(enemy, Movement, {
      speed: 30,
      currentSpeed: 30,
      moveMode: MoveModeVal.FollowPath,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
    });
    world.addComponent(enemy, UnitTag, { isEnemy: 1, isBoss: 0, atk: 12 });
    world.addComponent(enemy, Category, { value: CategoryVal.Enemy });
    world.addComponent(enemy, Visual, {
      shape: 1,
      colorR: 200,
      colorG: 0,
      colorB: 0,
      size: 24,
      alpha: 1,
      attackAnimTimer: 0,
      attackAnimDuration: 0.45,
    });
    world.addComponent(enemy, Attack, {
      damage: 12,
      attackSpeed: 1,
      range: 40,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
    });

    const longPathSystem = new MovementSystem(makeFourTileMap());
    longPathSystem.update(world, 0.016);

    expect(Health.current[tower]).toBe(68);
    expect(Visual.attackAnimTimer[enemy]).toBeCloseTo(0.45);
    expect(Movement.currentSpeed[enemy]).toBeGreaterThan(0);
    expect(Movement.progress[enemy]).toBeGreaterThan(0);
  });

  it('虫族女王攻击盾卫时播放攻击动作并停步', () => {
    const shieldGuard = world.createEntity();
    world.addComponent(shieldGuard, Position, { x: 80, y: 16 });
    world.addComponent(shieldGuard, Health, { current: 300, max: 300, armor: 0, magicResist: 0 });
    world.addComponent(shieldGuard, Category, { value: CategoryVal.Soldier });
    world.addComponent(shieldGuard, UnitTag, { isEnemy: 0, unitTypeNum: 0, atk: 0 });
    world.addComponent(shieldGuard, Movement, {
      speed: 0,
      currentSpeed: 0,
      moveMode: MoveModeVal.PlayerDirected,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
      targetX: 80,
      targetY: 16,
      homeX: 80,
      homeY: 16,
      moveRange: 0,
    });
    world.addComponent(shieldGuard, Soldier, {
      state: 0,
      homeX: 80,
      homeY: 16,
      moveRange: 0,
      attackTarget: 0,
      stateTimer: 0,
    });
    world.addComponent(shieldGuard, Faction, { value: FactionVal.Justice });
    world.addComponent(shieldGuard, Layer, { value: LayerVal.Ground });
    world.addComponent(shieldGuard, Visual, {
      shape: 1,
      colorR: 80,
      colorG: 120,
      colorB: 220,
      size: 32,
      alpha: 1,
      facing: 1,
      attackAnimTimer: 0,
      attackAnimDuration: 0.35,
    });

    const queen = world.createEntity();
    world.addComponent(queen, Position, { x: TILE / 2, y: TILE / 2 });
    world.addComponent(queen, Health, { current: 1000, max: 1000, armor: 15, magicResist: 20 });
    world.addComponent(queen, Movement, {
      speed: 20,
      currentSpeed: 20,
      moveMode: MoveModeVal.FollowPath,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
    });
    world.addComponent(queen, UnitTag, { isEnemy: 1, isBoss: 1, atk: 30 });
    world.addComponent(queen, Category, { value: CategoryVal.Enemy });
    world.addComponent(queen, Faction, { value: FactionVal.Evil });
    world.addComponent(queen, Layer, { value: LayerVal.Ground });
    world.addComponent(queen, Visual, {
      shape: 1,
      colorR: 230,
      colorG: 81,
      colorB: 0,
      size: 136.8,
      alpha: 1,
      facing: 1,
      attackAnimTimer: 0,
      attackAnimDuration: 0.9,
    });
    world.addComponent(queen, Attack, {
      damage: 30,
      attackSpeed: 0.6,
      range: 80,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
    });
    world.addComponent(queen, Boss, { bossType: 1, phase: 1, phase2HpRatio: 0.5, immuneToTowers: 1 });

    const longPathSystem = new MovementSystem(makeFourTileMap());
    longPathSystem.update(world, 0.016);

    expect(Attack.targetId[queen]).toBe(shieldGuard);
    expect(projectileQuery(world.world).length).toBe(1);
    expect(Visual.attackAnimTimer[queen]).toBeCloseTo(0.9);
    expect(Movement.currentSpeed[queen]).toBe(0);
  });

  it('Boss 到达水晶后立即判定失败', () => {
    makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 5, isBoss: true });
    let phase = GamePhase.Battle;
    const setPhase = (next: GamePhase): void => { phase = next; };
    const bossReachSystem = new MovementSystem(makeMap(), setPhase);

    bossReachSystem.update(world, 0.016);

    expect(phase).toBe(GamePhase.Defeat);
  });
});

describe('MovementSystem — 巨石阻挡', () => {
  let world: TowerWorld;
  let system: MovementSystem;

  beforeEach(() => {
    world = new TowerWorld();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    system = new MovementSystem(makeFourTileMap());
  });

  it('存活巨石会阻挡地面敌人沿路径前进，并成为攻击目标', () => {
    const boulder = makeBoulder(world, 1, 200);
    const enemy = makePathEnemy(world, { speed: TILE, atk: 12, attackRange: 48 });

    system.update(world, 1);

    expect(Position.x[enemy]).toBe(TILE / 2);
    expect(Movement.progress[enemy]).toBe(0);
    expect(Movement.currentSpeed[enemy]).toBe(0);
    expect(Attack.targetId[enemy]).toBe(boulder);
    expect(Visual.attackAnimTimer[enemy]).toBeCloseTo(0.45);
    expect(Health.current[boulder]).toBe(190);
  });

  it('机器狗被巨石接触阻挡时，即使中心距超过攻击范围也会攻击巨石', () => {
    const boulder = makeBoulderAt(world, 50, 200);
    const robotDog = makePathEnemy(world, {
      speed: 80,
      atk: 10,
      attackRange: 25,
      attackSpeed: 2,
      size: 28,
    });

    system.update(world, 0.25);

    expect(Position.x[robotDog]).toBe(TILE / 2);
    expect(Movement.progress[robotDog]).toBe(0);
    expect(Movement.currentSpeed[robotDog]).toBe(0);
    expect(Attack.targetId[robotDog]).toBe(boulder);
    expect(Visual.attackAnimTimer[robotDog]).toBeCloseTo(0.45);
    expect(Health.current[boulder]).toBeCloseTo(191.666, 2);
  });

  it('敌人有效攻击距离至少为1格，可以攻击配置射程外但1格内的目标', () => {
    const tower = makeTower(world, 100);
    Position.x[tower] = 46;
    Position.y[tower] = TILE / 2;
    const enemy = makePathEnemy(world, {
      speed: 0,
      atk: 12,
      attackRange: 20,
      size: 24,
    });

    system.update(world, 0.1);

    expect(Attack.targetId[enemy]).toBe(tower);
    expect(Health.current[tower]).toBeLessThan(100);
  });

  it('虫族女王遇到塔后必须锁定攻击该塔直到杀死', () => {
    const tower = makeTower(world, 100);
    Position.x[tower] = 46;
    Position.y[tower] = TILE / 2;
    const queen = makeQueenWorm(world);

    system.update(world, 0.1);
    const firstHp = Health.current[tower];

    const closerSoldier = makeSoldier(world, 20, TILE / 2, 100);
    Attack.cooldownTimer[queen] = 0;
    system.update(world, 0.1);
    const projectiles = projectileQuery(world.world);
    const latestProjectile = projectiles[projectiles.length - 1]!;

    expect(Attack.targetId[queen]).toBe(tower);
    expect(Health.current[tower]).toBe(firstHp);
    expect(Projectile.targetId[latestProjectile]).toBe(tower);
    expect(Health.current[closerSoldier]).toBe(100);

    Health.current[tower] = 0;
    Attack.cooldownTimer[queen] = 0;
    Visual.attackAnimTimer[queen] = 0;
    system.update(world, 0.1);

    expect(Attack.targetId[queen]).toBe(closerSoldier);
  });

  it('虫族女王遇到我方士兵后必须锁定攻击该兵直到杀死', () => {
    const soldier = makeSoldier(world, 46, TILE / 2, 100);
    const queen = makeQueenWorm(world);

    system.update(world, 0.1);
    const firstHp = Health.current[soldier];

    const closerTower = makeTower(world, 100);
    Position.x[closerTower] = 20;
    Position.y[closerTower] = TILE / 2;
    Attack.cooldownTimer[queen] = 0;
    system.update(world, 0.1);
    const projectiles = projectileQuery(world.world);
    const latestProjectile = projectiles[projectiles.length - 1]!;

    expect(Attack.targetId[queen]).toBe(soldier);
    expect(Health.current[soldier]).toBe(firstHp);
    expect(Projectile.targetId[latestProjectile]).toBe(soldier);
    expect(Health.current[closerTower]).toBe(100);

    Health.current[soldier] = 0;
    Attack.cooldownTimer[queen] = 0;
    Visual.attackAnimTimer[queen] = 0;
    system.update(world, 0.1);

    expect(Attack.targetId[queen]).toBe(closerTower);
  });

  it('巨石被破坏后，地面敌人可以继续前进', () => {
    makeBoulder(world, 1, 0);
    const enemy = makePathEnemy(world, { speed: TILE, atk: 12 });

    system.update(world, 1);

    expect(Position.x[enemy]).toBe((1 * TILE) + TILE / 2);
    expect(Movement.pathIndex[enemy]).toBe(1);
    expect(Movement.currentSpeed[enemy]).toBeGreaterThan(0);
  });

  it('低空敌人不受地面巨石阻挡', () => {
    makeBoulder(world, 1, 200);
    const enemy = makePathEnemy(world, { speed: TILE, atk: 12, layer: LayerVal.LowAir });

    system.update(world, 1);

    expect(Position.x[enemy]).toBe((1 * TILE) + TILE / 2);
    expect(Movement.pathIndex[enemy]).toBe(1);
    expect(Movement.currentSpeed[enemy]).toBeGreaterThan(0);
  });

  it('疯狂野猪沿路径移动时生成冲刺拖尾粒子', () => {
    const enemy = makePathEnemy(world, {
      speed: TILE,
      unitTypeNum: ENEMY_ID_BY_TYPE[EnemyType.Boar],
    });

    system.update(world, 0.25);

    const particles = skillParticleQuery(world.world);
    expect(particles.length).toBe(1);
    const particle = particles[0]!;
    expect(EnemySkillParticleEffect.effectType[particle]).toBe(EnemySkillParticleEffectVal.Charge);
    expect(EnemySkillParticleEffect.targetX[particle]).toBeCloseTo(Position.x[enemy]!, 4);
    expect(EnemySkillParticleEffect.targetY[particle]).toBeCloseTo(Position.y[enemy]!, 4);
  });

  it('非野猪地面敌人移动时不生成冲刺拖尾粒子', () => {
    makePathEnemy(world, {
      speed: TILE,
      unitTypeNum: ENEMY_ID_BY_TYPE[EnemyType.Goblin],
    });

    system.update(world, 0.25);

    expect(skillParticleQuery(world.world).length).toBe(0);
  });
});

describe('MovementSystem — 钻地潜行', () => {
  it('潜地敌人前进3格后钻出并恢复本体显示', () => {
    const world = new TowerWorld();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    const system = new MovementSystem(makeFourTileMap());
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: TILE / 2, y: TILE / 2 });
    world.addComponent(enemy, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
    world.addComponent(enemy, Movement, {
      speed: TILE * 3,
      currentSpeed: TILE * 3,
      moveMode: MoveModeVal.FollowPath,
      pathIndex: 0,
      progress: 0,
      spawnIdx: 0,
      currentNodeIdx: 0,
      targetNodeIdx: 0xffff,
    });
    world.addComponent(enemy, UnitTag, { isEnemy: 1, rewardGold: 0, canAttackBuildings: 0, atk: 0 });
    world.addComponent(enemy, Visual, {
      shape: 1,
      colorR: 120,
      colorG: 80,
      colorB: 50,
      size: 24,
      alpha: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0,
    });
    world.addComponent(enemy, Burrowed, {
      distanceRemaining: 3,
      trailEmitTimer: 0,
      originalAlpha: 1,
      originalLayer: LayerVal.Ground,
    });
    world.addComponent(enemy, Layer, { value: LayerVal.BelowGrid });

    system.update(world, 1);
    system.update(world, 1);
    system.update(world, 1);

    expect(world.hasComponent(enemy, Burrowed)).toBe(false);
    expect(Visual.alpha[enemy]).toBe(1);
    expect(Layer.value[enemy]).toBe(LayerVal.Ground);
    expect(Movement.pathIndex[enemy]).toBe(3);
  });
});
