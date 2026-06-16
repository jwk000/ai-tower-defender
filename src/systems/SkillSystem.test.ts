import { describe, expect, it } from 'vitest';
import { hasComponent, TowerWorld } from '../core/World.js';
import {
  Attack,
  Category,
  CategoryVal,
  DamageTypeVal,
  Faction,
  FactionVal,
  Health,
  Layer,
  LayerVal,
  MoveModeVal,
  Movement,
  Position,
  ShapeVal,
  Skill,
  Soldier,
  Taunted,
  UnitTag,
  Visual,
} from '../core/components.js';
import { SkillSystem } from './SkillSystem.js';
import { MovementSystem } from './MovementSystem.js';
import { RenderSystem } from './RenderSystem.js';
import { SkillTrigger, TileType } from '../types/index.js';
import type { MapConfig } from '../types/index.js';
import { migrateEnemyPathToGraph } from '../level/graph/migration.js';
import { SKILL_CONFIGS } from '../data/gameData.js';

const TILE = 32;

function makeMap(): MapConfig {
  const enemyPath = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 0, col: 3 },
  ];
  const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath });
  return {
    name: 'taunt-test',
    cols: 4,
    rows: 1,
    tileSize: TILE,
    tiles: [[TileType.Path, TileType.Path, TileType.Path, TileType.Path]],
    pathGraph,
    spawns,
  };
}

function addVisual(world: TowerWorld, eid: number, colorR: number): void {
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR,
    colorG: 120,
    colorB: 120,
    size: 24,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
    facing: 1,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0.3,
    partsId: 0,
  });
}

function makeShieldGuard(world: TowerWorld): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 40, y: 16 });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Justice });
  world.addComponent(eid, Category, { value: CategoryVal.Soldier });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, {
    isEnemy: 0,
    isElite: 0,
    isBoss: 0,
    isRanged: 0,
    canAttackBuildings: 0,
    rewardGold: 0,
    rewardEnergy: 0,
    popCost: 2,
    cost: 35,
    atk: 4,
    level: 1,
    maxLevel: 3,
    totalInvested: 35,
    unitTypeNum: 0,
  });
  world.addComponent(eid, Soldier, {
    state: 0,
    homeX: 40,
    homeY: 16,
    moveRange: 100,
    attackTarget: 0,
    stateTimer: 0,
  });
  world.addComponent(eid, Skill, {
    skillId: 0,
    cooldown: 0,
    currentCooldown: 0,
    energyCost: 0,
  });
  world.addComponent(eid, Attack, {
    damage: 4,
    attackSpeed: 0.55,
    range: 50,
    alertRange: 200,
    damageType: DamageTypeVal.Physical,
    cooldownTimer: 0,
    targetId: 0,
    targetSelection: 0,
    attackMode: 0,
    isRanged: 0,
    canTargetLowAir: 0,
    splashRadius: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    drainPercent: 0,
    tauntCapacity: 1,
    attackerCount: 0,
  });
  addVisual(world, eid, 80);
  return eid;
}

function makeEnemy(world: TowerWorld, x: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y: 16 });
  world.addComponent(eid, Health, { current: 50, max: 50, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, Movement, {
    speed: 20,
    currentSpeed: 20,
    moveMode: MoveModeVal.FollowPath,
    targetX: 0,
    targetY: 0,
    pathIndex: 0,
    progress: 0,
    homeX: x,
    homeY: 16,
    moveRange: 0,
    spawnIdx: 0,
  });
  world.addComponent(eid, Attack, {
    damage: 10,
    attackSpeed: 1,
    range: 60,
    alertRange: 60,
    damageType: DamageTypeVal.Physical,
    cooldownTimer: 0,
    targetId: 0,
    targetSelection: 0,
    attackMode: 0,
    isRanged: 0,
    canTargetLowAir: 0,
    splashRadius: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    drainPercent: 0,
    tauntCapacity: 0,
    attackerCount: 0,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    isElite: 0,
    isBoss: 0,
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
  });
  addVisual(world, eid, 220);
  return eid;
}

describe('SkillSystem — 盾卫自动嘲讽', () => {
  it('自动嘲讽范围内最近的1个敌人，使其停止移动并锁定攻击盾卫', () => {
    const world = new TowerWorld();
    world.createEntity();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    const shield = makeShieldGuard(world);
    const enemyA = makeEnemy(world, 70);
    const enemyB = makeEnemy(world, 95);

    const originalTaunt = SKILL_CONFIGS.taunt!;
    SKILL_CONFIGS.taunt = {
      id: 'taunt',
      name: '嘲讽',
      trigger: SkillTrigger.Passive,
      cooldown: 0,
      energyCost: 0,
      range: 120,
      value: 3,
      buffId: null,
      description: '',
    };

    try {
      new SkillSystem(() => true).update(world, 0.016);

      expect(hasComponent(world.world, Taunted, enemyA)).toBe(true);
      expect(hasComponent(world.world, Taunted, enemyB)).toBe(false);
      expect(Taunted.sourceId[enemyA]).toBe(shield);

      const enemyAX = Position.x[enemyA]!;
      const enemyBX = Position.x[enemyB]!;
      new MovementSystem(makeMap()).update(world, 1);

      expect(Position.x[enemyA]).toBe(enemyAX);
      expect(Movement.progress[enemyB]).toBeGreaterThan(0);
      expect(Movement.currentSpeed[enemyA]).toBe(0);
      expect(Movement.currentSpeed[enemyB]).toBeGreaterThan(0);
      expect(Attack.targetId[enemyA]).toBe(shield);
      expect(Attack.targetId[enemyB]).not.toBe(shield);
      expect(Health.current[shield]).toBe(90);
    } finally {
      SKILL_CONFIGS.taunt = originalTaunt;
    }
  });

  it('被嘲讽但攻击距离不够的敌人继续沿路径移动', () => {
    const world = new TowerWorld();
    world.createEntity();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    const shield = makeShieldGuard(world);
    const enemy = makeEnemy(world, 16);
    Position.x[shield] = 200;
    Position.y[shield] = 16;
    Health.current[shield] = 100;
    world.addComponent(enemy, Taunted, { sourceId: shield, timer: 3 });

    new MovementSystem(makeMap()).update(world, 1);

    expect(hasComponent(world.world, Taunted, enemy)).toBe(true);
    expect(Position.x[enemy]).toBeGreaterThan(16);
    expect(Movement.currentSpeed[enemy]).toBeGreaterThan(0);
    expect(Health.current[shield]).toBe(100);
    expect(Attack.targetId[enemy]).toBe(shield);
  });

  it('盾卫死亡后嘲讽效果消失，敌人恢复沿路径推进', () => {
    const world = new TowerWorld();
    world.createEntity();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    const shield = makeShieldGuard(world);
    const enemy = makeEnemy(world, 70);
    world.addComponent(enemy, Taunted, { sourceId: shield, timer: 3 });
    Attack.targetId[enemy] = shield;
    Health.current[shield] = 0;

    new MovementSystem(makeMap()).update(world, 1);

    expect(hasComponent(world.world, Taunted, enemy)).toBe(false);
    expect(Attack.targetId[enemy]).toBe(0);
    expect(Movement.progress[enemy]).toBeGreaterThan(0);
    expect(Movement.currentSpeed[enemy]).toBeGreaterThan(0);
  });
});
