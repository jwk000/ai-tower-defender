import { beforeEach, describe, expect, it } from 'vitest';
import { defineQuery, hasComponent, TowerWorld } from '../core/World.js';
import {
  Attack,
  Category,
  CategoryVal,
  Elite,
  EnemySkillParticleEffect,
  Faction,
  FactionVal,
  Health,
  Layer,
  LayerVal,
  Movement,
  Position,
  ShapeVal,
  Tower,
  UnitTag,
  Visual,
  Burrowed,
} from '../core/components.js';
import { unitConfigRegistry, type UnitConfig } from '../config/registry.js';
import { EnemySkillSystem, registerEnemySkillEntity } from './EnemySkillSystem.js';
import { EnemySkillParticleSystem } from './EnemySkillParticleSystem.js';
import { findEnemiesInRange } from './AttackSystem.js';
import type { Renderer } from '../render/Renderer.js';
import type { RenderCommand } from '../types/index.js';

const skillParticleQuery = defineQuery([Position, EnemySkillParticleEffect]);

function makeRenderer(): { renderer: Renderer; commands: RenderCommand[] } {
  const commands: RenderCommand[] = [];
  return {
    renderer: {
      push: (cmd: RenderCommand) => commands.push(cmd),
    } as unknown as Renderer,
    commands,
  };
}

function registerSkillConfig(config: UnitConfig): void {
  unitConfigRegistry.register(config);
}

function makeElite(world: TowerWorld, configId: string): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100, y: 100 });
  world.addComponent(eid, Health, { current: 200, max: 200, armor: 10, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, Movement, {
    speed: 40,
    currentSpeed: 40,
    moveMode: 0,
    targetX: 0,
    targetY: 0,
    pathIndex: 0,
    progress: 0,
    homeX: 100,
    homeY: 100,
    moveRange: 0,
    spawnIdx: 0,
  });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isElite: 1, atk: 20, rewardGold: 10 });
  world.addComponent(eid, Elite, {
    cardOptions: 3,
    hpMultiplier: 2,
    atkMultiplier: 1.5,
    visualScale: 1.2,
  });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 255,
    colorG: 215,
    colorB: 0,
    size: 40,
    alpha: 1,
    outline: 1,
    facing: 1,
    hitFlashTimer: 0,
    idlePhase: 0,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0.3,
    partsId: 0,
  });
  registerEnemySkillEntity(eid, configId);
  return eid;
}

function makeTower(world: TowerWorld, x = 140, y = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Justice });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });
  world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 50 });
  world.addComponent(eid, Attack, {
    damage: 20,
    attackSpeed: 1,
    range: 180,
    alertRange: 180,
    damageType: 0,
    cooldownTimer: 0,
    targetId: 0,
    targetSelection: 0,
    attackMode: 0,
    isRanged: 1,
    splashRadius: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    drainPercent: 0,
    tauntCapacity: 0,
    attackerCount: 0,
  });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Rect,
    colorR: 80,
    colorG: 120,
    colorB: 220,
    size: 28,
    alpha: 1,
    outline: 1,
    facing: 1,
    hitFlashTimer: 0,
    idlePhase: 0,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0,
    partsId: 0,
  });
  return eid;
}

describe('EnemySkillSystem — 精英技能与视觉效果', () => {
  let world: TowerWorld;
  let system: EnemySkillSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new EnemySkillSystem();
  });

  it('精英 arcane_bolt 会伤害目标并创建技能视觉效果', () => {
    registerSkillConfig({
      id: 'test_elite_mage',
      name: '测试精英法师',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      tier: 'L2',
      stats: { hp: 100, atk: 10 },
      visual: { shape: 'circle', color: '#ce93d8', size: 28 },
      behavior: { targetSelection: 'weakest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'arcane_bolt',
          name: '奥术冲击',
          cooldown: 8,
          range: 250,
          value: 35,
          description: '对最弱玩家单位造成 35 魔法伤害，并短暂打断攻击 1s',
        },
      ],
    } as unknown as UnitConfig);

    makeElite(world, 'test_elite_mage');
    const tower = makeTower(world);

    system.update(world, 0.1);

    expect(Health.current[tower]).toBe(65);
    expect(Visual.hitFlashTimer[tower]).toBeGreaterThan(0);
    expect(skillParticleQuery(world.world).length).toBeGreaterThan(0);
  });

  it('冷却未结束时不会重复释放精英技能', () => {
    registerSkillConfig({
      id: 'test_elite_mage_cooldown',
      name: '测试精英法师冷却',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      tier: 'L2',
      stats: { hp: 100, atk: 10 },
      visual: { shape: 'circle', color: '#ce93d8', size: 28 },
      behavior: { targetSelection: 'weakest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'arcane_bolt',
          name: '奥术冲击',
          cooldown: 8,
          range: 250,
          value: 35,
          description: '对最弱玩家单位造成 35 魔法伤害，并短暂打断攻击 1s',
        },
      ],
    } as unknown as UnitConfig);

    makeElite(world, 'test_elite_mage_cooldown');
    const tower = makeTower(world);

    system.update(world, 0.1);
    system.update(world, 0.1);

    expect(Health.current[tower]).toBe(65);
  });

  it('敌人技能粒子效果由粒子系统渲染为多粒子命令', () => {
    registerSkillConfig({
      id: 'test_elite_guard',
      name: '测试精英守卫',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      tier: 'L2',
      stats: { hp: 100, atk: 10 },
      visual: { shape: 'circle', color: '#90caf9', size: 28 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'shield_wall',
          name: '盾墙推进',
          cooldown: 8,
          range: 0,
          value: 40,
          duration: 4,
          description: '自身获得护甲并播放护盾粒子',
        },
      ],
    } as unknown as UnitConfig);

    makeElite(world, 'test_elite_guard');
    system.update(world, 0.1);

    const { renderer, commands } = makeRenderer();
    const particleSystem = new EnemySkillParticleSystem(renderer);
    particleSystem.update(world, 0.1);

    expect(skillParticleQuery(world.world).length).toBeGreaterThan(0);
    expect(commands.length).toBeGreaterThan(10);
    expect(commands.every((cmd) => cmd.shape === 'circle' || cmd.shape === 'rect')).toBe(true);
  });

  it('钻地潜行会隐藏本体、挂载潜地状态并生成翻土粒子', () => {
    registerSkillConfig({
      id: 'test_burrow_beetle',
      name: '测试钻地甲虫',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      tier: 'L2',
      stats: { hp: 120, atk: 15 },
      visual: { shape: 'circle', color: '#795548', size: 30 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'burrow_phase',
          name: '钻地潜行',
          cooldown: 3,
          range: 0,
          value: 3,
          description: '钻入地下并沿路径前进3格',
        },
      ],
    } as unknown as UnitConfig);

    const beetle = makeElite(world, 'test_burrow_beetle');

    system.update(world, 0.1);

    expect(hasComponent(world.world, Burrowed, beetle)).toBe(true);
    expect(Burrowed.distanceRemaining[beetle]).toBe(3);
    expect(Burrowed.originalLayer[beetle]).toBe(LayerVal.Ground);
    expect(Layer.value[beetle]).toBe(LayerVal.BelowGrid);
    expect(Visual.alpha[beetle]).toBe(0);
    expect(skillParticleQuery(world.world).length).toBeGreaterThan(0);
  });

  it('炮塔寻敌通过层级限制跳过 BelowGrid 潜地敌人', () => {
    const tower = makeTower(world, 100, 100);
    const beetle = makeElite(world, 'test_burrow_target');
    world.addComponent(beetle, Burrowed, {
      distanceRemaining: 3,
      trailEmitTimer: 0,
      originalAlpha: 1,
      originalLayer: LayerVal.Ground,
    });
    Layer.value[beetle] = LayerVal.BelowGrid;

    expect(findEnemiesInRange(world, tower, 200).map((target) => target.id)).not.toContain(beetle);
  });
});
