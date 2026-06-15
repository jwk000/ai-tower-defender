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
} from '../core/components.js';
import { MovementSystem } from './MovementSystem.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';
import { GamePhase, TileType } from '../types/index.js';

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
