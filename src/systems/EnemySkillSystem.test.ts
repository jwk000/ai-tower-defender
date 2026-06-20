import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineQuery, hasComponent, TowerWorld } from '../core/World.js';
import {
  Attack,
  Boss,
  Category,
  CategoryVal,
  Elite,
  EnemySkillParticleEffect,
  EnemySkillParticleEffectVal,
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
import { BossType } from './BossSystem.js';
import { clearArtAtlasRegistryForTests, getLoadedImageFrame } from '../utils/imageCache.js';

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

function makeSkillBoss(
  world: TowerWorld,
  configId: string,
  overrides: { hp?: number; maxHp?: number; x?: number; y?: number } = {},
): number {
  const eid = world.createEntity();
  const maxHp = overrides.maxHp ?? overrides.hp ?? 3000;
  world.addComponent(eid, Position, { x: overrides.x ?? 500, y: overrides.y ?? 300 });
  world.addComponent(eid, Health, {
    current: overrides.hp ?? maxHp,
    max: maxHp,
    armor: 30,
    magicResist: 30,
  });
  world.addComponent(eid, Faction, { value: FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isBoss: 1, atk: 50, rewardGold: 400 });
  world.addComponent(eid, Boss, {
    bossType: BossType.AbyssLord,
    phase: 1,
    phase2HpRatio: 0.5,
    transitionTimer: 0,
    abilityTimer: 0,
    spawnTimer: 0,
    splitCount: 0,
    immuneToTowers: 0,
    skillTimer0: 0,
    skillTimer1: 0,
    skillTimer2: 0,
    selfDestructTimer: -1,
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

function makeEnemy(world: TowerWorld, x: number, y: number, hp = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Faction, { value: FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isBoss: 0, atk: 10, rewardGold: 5 });
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

  it('深渊领主通过YAML技能黑暗吞噬吞噬150px内非Boss单位且不回血', () => {
    registerSkillConfig({
      id: 'test_abyss_lord',
      name: '测试深渊领主',
      category: 'Boss',
      faction: 'Enemy',
      layer: 'Ground',
      isBoss: true,
      stats: { hp: 3000, atk: 50 },
      visual: { shape: 'circle', color: '#1a0033', size: 162 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'dark_devour',
          name: '黑暗吞噬',
          cooldown: 5,
          range: 150,
          value: 0,
          duration: 0,
          description: '吞噬Boss周围150px内所有非Boss单位，不再恢复自身HP',
        },
      ],
    } as unknown as UnitConfig);

    const boss = makeSkillBoss(world, 'test_abyss_lord', { hp: 2000, maxHp: 3000, x: 500, y: 300 });
    const closeEnemy = makeEnemy(world, 520, 310);
    const closeTower = makeTower(world, 550, 350);
    const farEnemy = makeEnemy(world, 700, 300);
    const otherBoss = makeSkillBoss(world, 'test_abyss_lord', { hp: 3000, maxHp: 3000, x: 550, y: 350 });
    const crystal = world.createEntity();
    world.addComponent(crystal, Position, { x: 480, y: 320 });
    world.addComponent(crystal, Health, { current: 500, max: 500, armor: 0, magicResist: 0 });
    world.addComponent(crystal, Category, { value: CategoryVal.Objective });
    world.addComponent(crystal, Faction, { value: FactionVal.Neutral });

    system.update(world, 0.1);

    expect(Health.current[closeEnemy]).toBe(0);
    expect(Health.current[closeTower]).toBe(0);
    expect(Health.current[farEnemy]).toBe(100);
    expect(Health.current[otherBoss]).toBe(3000);
    expect(Health.current[crystal]).toBe(500);
    expect(Health.current[boss]).toBe(2000);
    expect(skillParticleQuery(world.world).length).toBeGreaterThan(0);
  });

  it('YAML Boss 放招时创建Boss技能UI提示', () => {
    const announcementMock = {
      show: vi.fn(),
    };
    system = new EnemySkillSystem(announcementMock as unknown as ConstructorParameters<typeof EnemySkillSystem>[0]);
    registerSkillConfig({
      id: 'test_abyss_lord_announcement',
      name: '测试深渊领主提示',
      category: 'Boss',
      faction: 'Enemy',
      layer: 'Ground',
      isBoss: true,
      stats: { hp: 3000, atk: 50 },
      visual: { shape: 'circle', color: '#1a0033', size: 162 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'dark_devour',
          name: '黑暗吞噬',
          cooldown: 5,
          range: 150,
          value: 0,
          duration: 0,
          description: '吞噬Boss周围150px内所有非Boss单位，不再恢复自身HP',
        },
      ],
    } as unknown as UnitConfig);

    makeSkillBoss(world, 'test_abyss_lord_announcement', { hp: 2000, maxHp: 3000, x: 500, y: 300 });

    system.update(world, 0.1);

    expect(announcementMock.show).toHaveBeenCalledWith(
      world,
      '黑暗吞噬',
      '吞噬Boss周围150px内所有非Boss单位，不再恢复自身HP',
    );
  });

  it('精英技能不会创建Boss技能UI提示', () => {
    const announcementMock = {
      show: vi.fn(),
    };
    system = new EnemySkillSystem(announcementMock as unknown as ConstructorParameters<typeof EnemySkillSystem>[0]);
    registerSkillConfig({
      id: 'test_elite_no_boss_announcement',
      name: '测试精英无Boss提示',
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
          description: '对最弱玩家单位造成 35 魔法伤害',
        },
      ],
    } as unknown as UnitConfig);

    makeElite(world, 'test_elite_no_boss_announcement');
    makeTower(world);

    system.update(world, 0.1);

    expect(announcementMock.show).not.toHaveBeenCalled();
  });

  it('飞机攻击范围内有我方单位时必定投弹并只对同一目标投一次', () => {
    registerSkillConfig({
      id: 'test_plane_bomber',
      name: '测试飞机',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'LowAir',
      stats: { hp: 80, atk: 15 },
      visual: { shape: 'triangle', color: '#78909c', size: 67.2 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      skills: [
        {
          id: 'plane_bombing_run',
          name: '低空投弹',
          cooldown: 0.12,
          range: 60,
          value: 45,
          duration: 58,
          description: '飞机攻击范围内有我方单位时必定投放炸弹',
        },
      ],
    } as unknown as UnitConfig);

    const plane = makeElite(world, 'test_plane_bomber');
    Layer.value[plane] = LayerVal.LowAir;
    Position.x[plane] = 100;
    Position.y[plane] = 100;
    const tower = makeTower(world, 158, 100);

    system.update(world, 0.1);
    const afterFirstHit = Health.current[tower];
    system.update(world, 0.2);

    expect(afterFirstHit).toBeLessThan(100);
    expect(Health.current[tower]).toBe(afterFirstHit);
    expect(skillParticleQuery(world.world).length).toBeGreaterThan(0);
  });

  it('飞机投弹粒子系统优先绘制投弹贴图并在后段绘制爆炸粒子', () => {
    clearArtAtlasRegistryForTests();
    class LoadedImage {
      complete = true;
      naturalWidth = 128;
      naturalHeight = 128;
      width = 128;
      height = 128;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.complete = true;
        this.onload?.();
      }
    }
    vi.stubGlobal('Image', LoadedImage);
    getLoadedImageFrame('/art/fx/fx_plane_bomb_projectile.png');
    const effect = world.createEntity();
    world.addComponent(effect, Position, { x: 100, y: 80 });
    world.addComponent(effect, EnemySkillParticleEffect, {
      effectType: EnemySkillParticleEffectVal.PlaneBomb,
      duration: 0.75,
      elapsed: 0,
      radius: 58,
      targetX: 120,
      targetY: 130,
      colorR: 255,
      colorG: 96,
      colorB: 32,
      seed: 1,
    });

    const { renderer, commands } = makeRenderer();
    const particleSystem = new EnemySkillParticleSystem(renderer);
    particleSystem.update(world, 0.1);
    particleSystem.update(world, 0.3);

    expect(commands.some((cmd) => cmd.image)).toBe(true);
    expect(commands.filter((cmd) => cmd.shape === 'circle').length).toBeGreaterThan(10);
    vi.unstubAllGlobals();
    clearArtAtlasRegistryForTests();
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
