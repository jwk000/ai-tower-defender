/**
 * SoldierAISystem 测试 — 士兵 4 状态机 AI
 *
 * 对应设计文档:
 * - design/02-gameplay.md §7.1.2 — soldier 4-state AI
 * - design/03-units.md §3 — soldier stats (alert_range, attack_range, moveRange)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TowerWorld, defineQuery } from '../core/World.js';
import {
  Position,
  Health,
  Movement,
  Soldier as SoldierComp,
  Attack,
  Faction,
  FactionVal,
  UnitTag,
  Visual,
  MoveModeVal,
  Stunned,
  Frozen,
  Category,
  CategoryVal,
  Projectile,
} from '../core/components.js';
import { SoldierAISystem } from './SoldierAISystem.js';
import { UNIT_ID_BY_TYPE } from '../data/gameData.js';
import { UnitType } from '../types/index.js';
import { clearAllBuffs, getBuffs } from './BuffSystem.js';
import { Sound } from '../utils/Sound.js';

// ============================================================
// Helpers
// ============================================================

const STATE_IDLE = 0;
const STATE_ALERT = 1;
const STATE_COMBAT = 2;
const STATE_RETURNING = 3;

const projectileQuery = defineQuery([Projectile]);

function makeSoldier(
  world: TowerWorld,
  opts: {
    x: number;
    y: number;
    homeX: number;
    homeY: number;
    moveRange: number;
    attackRange: number;
    alertRange?: number;
    speed?: number;
    faction?: number;
    initialAttackTarget?: number;
    visualSize?: number;
    facing?: number;
    unitTypeNum?: number;
    damage?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: opts.x, y: opts.y });
  world.addComponent(eid, Health, {
    current: 100, max: 100, armor: 5, magicResist: 5,
  });
  world.addComponent(eid, Movement, {
    speed: opts.speed ?? 80,
    currentSpeed: opts.speed ?? 80,
    moveMode: MoveModeVal.HoldPosition,
    pathIndex: 0,
    progress: 0,
    targetX: 0,
    targetY: 0,
    homeX: opts.homeX,
    homeY: opts.homeY,
    moveRange: opts.moveRange,
  });
  world.addComponent(eid, SoldierComp, {
    state: STATE_IDLE,
    homeX: opts.homeX,
    homeY: opts.homeY,
    moveRange: opts.moveRange,
    attackTarget: opts.initialAttackTarget ?? 0,
    stateTimer: 0,
  });
  world.addComponent(eid, Attack, {
    damage: opts.damage ?? 25,
    attackSpeed: 1.0,
    range: opts.attackRange,
    alertRange: opts.alertRange ?? 0,
    damageType: 0,
    cooldownTimer: 0,
    targetId: 0,
    targetSelection: 0,
    attackMode: 0,
    isRanged: 0,
    splashRadius: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    drainPercent: 0,
    tauntCapacity: 0,
    attackerCount: 0,
  });
  world.addComponent(eid, Faction, { value: opts.faction ?? FactionVal.Justice });
  world.addComponent(eid, UnitTag, {
    isEnemy: 0,
    isBoss: 0,
    isRanged: 0,
    canAttackBuildings: 0,
    rewardGold: 0,
    rewardEnergy: 0,
    popCost: 1,
    cost: 50,
    atk: opts.damage ?? 25,
    level: 1,
    maxLevel: 3,
    totalInvested: 50,
    unitTypeNum: opts.unitTypeNum ?? 0,
  });
  world.addComponent(eid, Category, { value: CategoryVal.Soldier });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 0,
    colorG: 255,
    colorB: 0,
    size: opts.visualSize ?? 32,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
    facing: opts.facing ?? 1,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0,
    partsId: 0,
  });
  return eid;
}

function makeEnemy(
  world: TowerWorld,
  opts: {
    x: number;
    y: number;
    hp?: number;
    faction?: number;
    visualSize?: number;
    isBoss?: number;
    isElite?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: opts.x, y: opts.y });
  world.addComponent(eid, Health, {
    current: opts.hp ?? 60,
    max: opts.hp ?? 60,
    armor: 0,
    magicResist: 0,
  });
  world.addComponent(eid, Faction, { value: opts.faction ?? FactionVal.Evil });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    isBoss: opts.isBoss ?? 0,
    isRanged: 0,
    canAttackBuildings: 0,
    rewardGold: 10,
    rewardEnergy: 0,
    popCost: 0,
    cost: 0,
    atk: 10,
    level: 1,
    maxLevel: 1,
    totalInvested: 0,
    unitTypeNum: 0,
    isElite: opts.isElite ?? 0,
  });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 255,
    colorG: 0,
    colorB: 0,
    size: opts.visualSize ?? 32,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
    facing: -1,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0,
    partsId: 0,
  });
  return eid;
}

function makeTower(
  world: TowerWorld,
  opts: {
    x: number;
    y: number;
    hp?: number;
    faction?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: opts.x, y: opts.y });
  world.addComponent(eid, Health, {
    current: opts.hp ?? 100,
    max: 200,
    armor: 0,
    magicResist: 0,
  });
  world.addComponent(eid, Faction, { value: opts.faction ?? FactionVal.Justice });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  return eid;
}

// ============================================================
// Tests: IDLE State
// ============================================================

describe('SoldierAISystem — IDLE state', () => {
  let world: TowerWorld;
  let system: SoldierAISystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new SoldierAISystem();
  });

  it('soldier stays IDLE and sets Patrol moveMode when no enemies around', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 100,
      attackRange: 40,
      alertRange: 80,
    });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.Patrol);
  });

  it('soldier transitions from IDLE to ALERT when enemy within alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 80,
    });

    // Enemy at (230, 200) — distance = 30px, within 80px alert_range
    const enemy = makeEnemy(world, { x: 230, y: 200 });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
    // Target should be set to enemy position
    expect(Movement.targetX[soldier]).toBeCloseTo(230, 0);
    expect(Movement.targetY[soldier]).toBeCloseTo(200, 0);
  });

  it('soldier does NOT spot enemy outside alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 80,
    });

    // Enemy at (300, 200) — distance = 100px, outside 80px alert_range
    makeEnemy(world, { x: 300, y: 200 });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
    expect(SoldierComp.attackTarget[soldier]).toBe(0);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.Patrol);
  });

  it('soldier uses attackRange * 1.5 as fallback alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 50,
      alertRange: 0, // no explicit alertRange → default = attackRange * 1.5 = 75
    });

    // Enemy at (260, 200) — distance = 60px, within 75px
    const enemy = makeEnemy(world, { x: 260, y: 200 });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy);
  });

  it('soldier uses Soldier.moveRange as last-resort alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 120,
      attackRange: 0, // no attack range at all
      alertRange: 0,
    });

    // Enemy at (300, 200) — distance = 100px, within 120px moveRange fallback
    const enemy = makeEnemy(world, { x: 300, y: 200 });

    system.update(world, 0.016);

    // The soldier query requires Attack component, and we have Attack with range=0.
    // getAlertRange falls through: alertRange=0 → attackRange*1.5=0 → moveRange=120
    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy);
  });

  it('soldier picks nearest enemy when multiple are in range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    // Far enemy: at (300, 200) — 100px
    const farEnemy = makeEnemy(world, { x: 300, y: 200 });
    // Near enemy: at (250, 200) — 50px
    const nearEnemy = makeEnemy(world, { x: 250, y: 200 });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    // Should target the CLOSER enemy
    expect(SoldierComp.attackTarget[soldier]).toBe(nearEnemy);
  });
});

// ============================================================
// Tests: ALERT State
// ============================================================

describe('SoldierAISystem — ALERT state', () => {
  let world: TowerWorld;
  let system: SoldierAISystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new SoldierAISystem();
  });

  it('soldier in ALERT transitions to COMBAT when within attack_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 220, y: 200 }); // dist = 20, within attackRange=40

    // Manually set to ALERT
    SoldierComp.state[soldier] = STATE_ALERT;
    SoldierComp.attackTarget[soldier] = enemy;

    // Frame 1: ALERT handler detects enemy in range → transitions to COMBAT
    // (moveMode still ChaseTarget from ALERT handler)
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_COMBAT);

    // Frame 2: COMBAT handler now runs → sets HoldPosition
    system.update(world, 0.016);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.HoldPosition);
  });

  it('soldier in ALERT chases the target (sets ChaseTarget mode)', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 20,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 300, y: 200 }); // dist = 100, within alertRange but not attackRange

    SoldierComp.state[soldier] = STATE_ALERT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
    // Target should be enemy position
    expect(Movement.targetX[soldier]).toBeCloseTo(300, 0);
    expect(Movement.targetY[soldier]).toBeCloseTo(200, 0);
    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT); // still chasing
  });

  it('soldier in ALERT transitions to RETURNING when target dies', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 300, y: 200 });

    // Kill the enemy
    Health.current[enemy] = 0;

    SoldierComp.state[soldier] = STATE_ALERT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
    expect(SoldierComp.attackTarget[soldier]).toBe(0);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
    // Target should be set to home
    expect(Movement.targetX[soldier]).toBe(200);
    expect(Movement.targetY[soldier]).toBe(200);
  });

  it('soldier in ALERT transitions to RETURNING when target moves out of alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 50,
    });
    // Enemy outside 50px alert_range — 70px away
    const enemy = makeEnemy(world, { x: 270, y: 200 });

    SoldierComp.state[soldier] = STATE_ALERT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
    expect(SoldierComp.attackTarget[soldier]).toBe(0);
  });

  it('soldier in ALERT switches to a new enemy when current target invalid but another in range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const deadTarget = makeEnemy(world, { x: 300, y: 200 });
    const newTarget = makeEnemy(world, { x: 220, y: 200 }); // within range

    // Kill first target
    Health.current[deadTarget] = 0;

    SoldierComp.state[soldier] = STATE_ALERT;
    SoldierComp.attackTarget[soldier] = deadTarget;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT); // stays in ALERT
    expect(SoldierComp.attackTarget[soldier]).toBe(newTarget); // switched
    expect(Movement.targetX[soldier]).toBeCloseTo(220, 0);
  });

  it('soldier does NOT react to non-hostile factions', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    // Neutral unit — not hostile
    makeEnemy(world, { x: 220, y: 200, faction: FactionVal.Neutral });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
  });

  it('soldier reacts to Chaos faction as hostile', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const chaosEnemy = makeEnemy(world, { x: 220, y: 200, faction: FactionVal.Chaos });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.attackTarget[soldier]).toBe(chaosEnemy);
  });

  it('soldier returns to RETURNING when too far from home', () => {
    // Place soldier far from home in ALERT state
    const soldier = makeSoldier(world, {
      x: 350, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 100, // home is 150px away, exceeds moveRange
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 370, y: 200 });

    SoldierComp.state[soldier] = STATE_ALERT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
    expect(SoldierComp.attackTarget[soldier]).toBe(0);
  });
});

// ============================================================
// Tests: COMBAT State
// ============================================================

describe('SoldierAISystem — COMBAT state', () => {
  let world: TowerWorld;
  let system: SoldierAISystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new SoldierAISystem();
  });

  it('soldier in COMBAT sets HoldPosition moveMode', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 220, y: 200 }); // within attackRange

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.HoldPosition);
    expect(SoldierComp.state[soldier]).toBe(STATE_COMBAT); // stays in combat
  });

  it('士兵有效攻击距离至少为1格，可以攻击配置射程外但1格内的目标', () => {
    system = new SoldierAISystem({ tileSize: 32 });
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 20,
      alertRange: 150,
      damage: 25,
    });
    const enemy = makeEnemy(world, { x: 230, y: 200, hp: 100 });

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_COMBAT);
    expect(Attack.targetId[soldier]).toBe(enemy);
    expect(Health.current[enemy]).toBeLessThan(100);
  });

  it('soldier in COMBAT faces toward target', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
      facing: -1,
    });
    // Enemy to the right
    const enemy = makeEnemy(world, { x: 230, y: 200 });

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(Visual.facing[soldier]).toBe(1); // facing right
  });

  it('soldier in COMBAT faces left when target is to the left', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
      facing: 1,
    });
    const enemy = makeEnemy(world, { x: 170, y: 200 }); // enemy to the left

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(Visual.facing[soldier]).toBe(-1); // facing left
  });

  it('soldier in COMBAT transitions to RETURNING when target dies', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 220, y: 200 });

    // Kill the enemy
    Health.current[enemy] = 0;

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
    expect(SoldierComp.attackTarget[soldier]).toBe(0);
  });

  it('soldier in COMBAT transitions to ALERT when target leaves attack_range but stays in alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    // Enemy at distance 80px — outside attack_range(40) but within alert_range(150)
    const enemy = makeEnemy(world, { x: 280, y: 200 });

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy); // same target
  });

  it('soldier in COMBAT sets Attack.targetId', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 220, y: 200 });

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(Attack.targetId[soldier]).toBe(enemy);
  });

  it('soldier returns to RETURNING when too far from home in COMBAT', () => {
    const soldier = makeSoldier(world, {
      x: 350, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 100,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 360, y: 200 });

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
  });
});

// ============================================================
// Tests: Differentiated soldier mechanics
// ============================================================

describe('SoldierAISystem — differentiated soldier mechanics', () => {
  let world: TowerWorld;
  let system: SoldierAISystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new SoldierAISystem();
    clearAllBuffs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAllBuffs();
  });

  it('刺客瞬移并处决血量低于10%的普通敌人，但不处决精英', () => {
    const assassin = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 50,
      alertRange: 320,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Assassin],
      damage: 55,
    });
    const normalEnemy = makeEnemy(world, { x: 230, y: 200, hp: 100 });
    Health.current[normalEnemy] = 9;

    SoldierComp.state[assassin] = STATE_COMBAT;
    SoldierComp.attackTarget[assassin] = normalEnemy;

    system.update(world, 0.016);

    expect(Health.current[normalEnemy]).toBeLessThanOrEqual(0);
    expect(Position.x[assassin]).toBeCloseTo(206, 0);
    expect(Position.y[assassin]).toBe(200);

    const eliteEnemy = makeEnemy(world, { x: 240, y: 200, hp: 100, isElite: 1 });
    Health.current[eliteEnemy] = 9;
    Health.armor[eliteEnemy] = 1000;
    Attack.cooldownTimer[assassin] = 0;
    SoldierComp.attackTarget[assassin] = eliteEnemy;

    system.update(world, 0.016);

    expect(Health.current[eliteEnemy]).toBeGreaterThan(0);
  });

  it('弓手远程攻击会把x3暴击伤害写入投射物', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const archer = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 360,
      alertRange: 420,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Archer],
      damage: 12,
    });
    const enemy = makeEnemy(world, { x: 260, y: 200, hp: 100 });

    SoldierComp.state[archer] = STATE_COMBAT;
    SoldierComp.attackTarget[archer] = enemy;

    system.update(world, 0.016);

    const projectiles = projectileQuery(world.world);
    expect(projectiles).toHaveLength(1);
    expect(Projectile.damage[projectiles[0]!]).toBe(36);
  });

  it('弓手远程攻击会触发攻击动作计时器', () => {
    const archer = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 360,
      alertRange: 420,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Archer],
      damage: 12,
    });
    const enemy = makeEnemy(world, { x: 260, y: 200, hp: 100 });

    SoldierComp.state[archer] = STATE_COMBAT;
    SoldierComp.attackTarget[archer] = enemy;

    system.update(world, 0.016);

    expect(Visual.attackAnimDuration[archer]).toBeGreaterThan(0);
    expect(Visual.attackAnimTimer[archer]).toBe(Visual.attackAnimDuration[archer]);
  });

  it('士兵实际出手时播放攻击音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const swordsman = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 55,
      alertRange: 160,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Swordsman],
      damage: 15,
    });
    const enemy = makeEnemy(world, { x: 230, y: 200, hp: 100 });

    SoldierComp.state[swordsman] = STATE_COMBAT;
    SoldierComp.attackTarget[swordsman] = enemy;

    system.update(world, 0.016);

    expect(playSpy).toHaveBeenCalledWith('soldier_attack');
  });

  it('法师和牧师实际出手时复用魔法攻击音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const mage = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 220,
      alertRange: 320,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Mage],
      damage: 16,
    });
    const enemy = makeEnemy(world, { x: 260, y: 200, hp: 100 });

    SoldierComp.state[mage] = STATE_COMBAT;
    SoldierComp.attackTarget[mage] = enemy;

    system.update(world, 0.016);

    expect(playSpy).toHaveBeenCalledWith('mage_attack');
  });

  it('牧师每1秒治疗我方士兵，并保留少量攻击能力', () => {
    const priest = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 150,
      alertRange: 240,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Priest],
      damage: 6,
    });
    const wounded = makeSoldier(world, {
      x: 230, y: 200,
      homeX: 230, homeY: 200,
      moveRange: 100,
      attackRange: 40,
    });
    Health.current[wounded] = 50;

    system.update(world, 0.016);

    expect(Health.current[wounded]).toBe(62);
    expect(Attack.damage[priest]).toBe(6);

    system.update(world, 0.5);
    expect(Health.current[wounded]).toBe(62);

    system.update(world, 0.5);
    expect(Health.current[wounded]).toBe(74);
  });

  it('法师周期法术造成魔法伤害并施加负面buff', () => {
    const mage = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 220,
      alertRange: 320,
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.Mage],
      damage: 16,
    });
    const enemy = makeEnemy(world, { x: 260, y: 200, hp: 100 });

    system.update(world, 6.1);

    expect(Health.current[enemy]).toBeLessThan(100);
    expect(getBuffs(enemy).some((buff) => buff.id === 'arcane_vulnerability')).toBe(true);
    expect(Attack.damage[mage]).toBe(16);
  });
});

// ============================================================
// Tests: RETURNING State
// ============================================================

describe('SoldierAISystem — RETURNING state', () => {
  let world: TowerWorld;
  let system: SoldierAISystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new SoldierAISystem();
  });

  it('soldier in RETURNING sets ChaseTarget toward home', () => {
    const soldier = makeSoldier(world, {
      x: 300, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    SoldierComp.state[soldier] = STATE_RETURNING;

    system.update(world, 0.016);

    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
    expect(Movement.targetX[soldier]).toBe(200);
    expect(Movement.targetY[soldier]).toBe(200);
  });

  it('soldier transitions to IDLE when arrived at home (within 10px)', () => {
    const soldier = makeSoldier(world, {
      x: 205, y: 200, // 5px from home
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    SoldierComp.state[soldier] = STATE_RETURNING;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
  });

  it('soldier stays in RETURNING when NOT at home', () => {
    const soldier = makeSoldier(world, {
      x: 250, y: 200, // 50px from home
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    SoldierComp.state[soldier] = STATE_RETURNING;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
  });

  it('soldier in RETURNING transitions to ALERT when enemy spotted', () => {
    const soldier = makeSoldier(world, {
      x: 250, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 260, y: 200 }); // 10px away

    SoldierComp.state[soldier] = STATE_RETURNING;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
  });

  it('soldier in RETURNING ignores enemies outside alert_range', () => {
    const soldier = makeSoldier(world, {
      x: 250, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 50,
    });
    // Enemy far away — outside alert_range
    makeEnemy(world, { x: 350, y: 200 }); // 100px away

    SoldierComp.state[soldier] = STATE_RETURNING;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);
  });
});

// ============================================================
// Tests: State Transitions & Edge Cases
// ============================================================

describe('SoldierAISystem — state transitions & edge cases', () => {
  let world: TowerWorld;
  let system: SoldierAISystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new SoldierAISystem();
  });

  it('stateTimer resets on transition', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 220, y: 200 });

    // Accumulate some time
    SoldierComp.stateTimer[soldier] = 5.0;

    system.update(world, 0.016);

    // Should have transitioned and reset timer
    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.stateTimer[soldier]).toBe(0);
  });

  it('stunned soldier does not update', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    makeEnemy(world, { x: 220, y: 200 });

    // Set stun
    world.addComponent(soldier, Stunned, { timer: 1.0 });

    system.update(world, 0.016);

    // Should remain in IDLE (initial state) despite enemy being in range
    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
  });

  it('frozen soldier does not update', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    makeEnemy(world, { x: 220, y: 200 });

    // Set frozen
    world.addComponent(soldier, Frozen, { timer: 1.0, percent: 100, stacks: 1, maxStacks: 1 });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
  });

  it('soldier ignores dead enemies', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const deadEnemy = makeEnemy(world, { x: 220, y: 200 });
    Health.current[deadEnemy] = 0;

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
    expect(SoldierComp.attackTarget[soldier]).toBe(0);
  });

  it('soldier ignores same-faction units (friendly fire prevention)', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    // Same faction — Justice
    makeEnemy(world, { x: 220, y: 200, faction: FactionVal.Justice });

    system.update(world, 0.016);

    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
  });

  it('unknown state resets to IDLE', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    // Set to an invalid state (99)
    SoldierComp.state[soldier] = 99;

    // Frame 1: default case transitions to IDLE
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);

    // Frame 2: IDLE handler sets Patrol moveMode
    system.update(world, 0.016);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.Patrol);
  });

  it('full lifecycle: IDLE → ALERT → COMBAT → RETURNING → IDLE', () => {
    const homeX = 200;
    const homeY = 200;

    const soldier = makeSoldier(world, {
      x: homeX, y: homeY,
      homeX, homeY,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    // Phase 1: IDLE — no enemies
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);

    // Phase 2: Spawn enemy within alert_range → should go ALERT
    const enemy = makeEnemy(world, { x: 300, y: 200 });
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy);

    // Phase 3: Move enemy within attack_range → should go COMBAT
    Position.x[enemy] = 230;
    Position.y[enemy] = 200;
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_COMBAT);

    // Phase 4: Kill enemy → should go RETURNING
    Health.current[enemy] = 0;
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_RETURNING);

    // Phase 5: Soldier arrives home → should go IDLE
    Position.x[soldier] = homeX + 5; // within threshold
    system.update(world, 0.016);
    expect(SoldierComp.state[soldier]).toBe(STATE_IDLE);
  });

  it('multiple soldiers work independently', () => {
    const s1 = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const s2 = makeSoldier(world, {
      x: 500, y: 200,
      homeX: 500, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });

    // Enemy near s1
    const enemy = makeEnemy(world, { x: 220, y: 200 });

    system.update(world, 0.016);

    // s1 should react to enemy
    expect(SoldierComp.state[s1]).toBe(STATE_ALERT);
    // s2 is far away, no enemies near
    expect(SoldierComp.state[s2]).toBe(STATE_IDLE);
  });

  it('COMBAT→ALERT transition when target moves away and back in range', () => {
    const soldier = makeSoldier(world, {
      x: 200, y: 200,
      homeX: 200, homeY: 200,
      moveRange: 200,
      attackRange: 40,
      alertRange: 150,
    });
    const enemy = makeEnemy(world, { x: 280, y: 200 }); // 80px away — outside attackRange

    SoldierComp.state[soldier] = STATE_COMBAT;
    SoldierComp.attackTarget[soldier] = enemy;

    system.update(world, 0.016);

    // Should go from COMBAT back to ALERT (chase)
    expect(SoldierComp.state[soldier]).toBe(STATE_ALERT);
    expect(Movement.moveMode[soldier]).toBe(MoveModeVal.ChaseTarget);
    expect(SoldierComp.attackTarget[soldier]).toBe(enemy);
  });
});
