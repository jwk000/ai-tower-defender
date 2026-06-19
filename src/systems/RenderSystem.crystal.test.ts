import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { TileType, UnitType } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import {
  Barrel,
  Boss,
  Category,
  CategoryVal,
  DeathEffect,
  DisintegrateEffect,
  Health,
  Layer,
  LayerVal,
  Movement,
  Position,
  Projectile,
  ShapeVal,
  Tower,
  Trap,
  TrapTypeVal,
  UnitTag,
  Visual,
} from '../core/components.js';
import { applyArrowProjectileArt, applySoldierProjectileArt, applyTowerProjectileArt, formatTowerLevelDisplayName, RenderSystem } from './RenderSystem.js';
import { DeathEffectSystem } from './DeathEffectSystem.js';
import type { MapConfig } from '../types/index.js';
import { setArtResourcesEnabled } from '../utils/artResourceSwitch.js';

class RendererStub {
  commands: RenderCommand[] = [];
  context = { translate: (): void => {} };

  push(command: RenderCommand): void {
    this.commands.push(command);
  }

  measureLabel(label: string, size: number): number {
    return label.length * size;
  }
}

function makeMap(): MapConfig {
  return {
    name: 'crystal-render-test',
    cols: 2,
    rows: 1,
    tileSize: 64,
    tiles: [[TileType.Spawn, TileType.Base]],
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'c', row: 0, col: 1, role: 'crystal_anchor' },
      ],
      edges: [{ from: 's', to: 'c' }],
    },
  };
}

function makeCannonTower(world: TowerWorld): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 96, y: 32 });
  world.addComponent(eid, Tower, { towerType: 1, level: 1, totalInvested: 0 });
  world.addComponent(eid, Barrel, { angle: 0, targetAngle: 0, length: 20, width: 6 });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Rect,
    colorR: 255,
    colorG: 138,
    colorB: 101,
    size: 38,
    alpha: 1,
  });
  return eid;
}

function makeNamedEntity(
  world: TowerWorld,
  opts: {
    name: string;
    category: CategoryVal;
    x: number;
    isElite?: boolean;
    isBoss?: boolean;
    outline?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: opts.x, y: 32 });
  world.addComponent(eid, Health, { current: 100, max: 100 });
  world.addComponent(eid, Category, { value: opts.category });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 120,
    colorG: 120,
    colorB: 120,
    size: 32,
    alpha: 1,
    outline: opts.outline ?? 0,
  });
  if (opts.category === CategoryVal.Enemy || opts.isBoss) {
    world.addComponent(eid, UnitTag, {
      isEnemy: 1,
      isBoss: opts.isBoss ? 1 : 0,
      isElite: opts.isElite ? 1 : 0,
    });
  }
  if (opts.category === CategoryVal.Soldier) {
    world.addComponent(eid, Movement, { moveRange: 96 });
  }
  if (opts.isBoss) {
    world.addComponent(eid, Boss, {
      bossType: 0,
      phase: 1,
      phase2HpRatio: 0.5,
      transitionTimer: 0,
    });
  }
  world.setDisplayName(eid, opts.name);
  return eid;
}

function makeBoulderTrap(world: TowerWorld): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 96, y: 32 });
  world.addComponent(eid, Health, { current: 120, max: 200, armor: 20, magicResist: 0 });
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
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 120,
    colorG: 144,
    colorB: 156,
    size: 40,
    alpha: 1,
    outline: 0,
  });
  return eid;
}

function hasProceduralBarrel(commands: RenderCommand[]): boolean {
  return commands.some((cmd) =>
    cmd.shape === 'rect' &&
    cmd.color === '#2a2a2a' &&
    cmd.h === 6 &&
    !cmd.image,
  );
}

function makeProjectile(
  world: TowerWorld,
  opts: {
    sourceTowerType: number;
    shape: ShapeVal;
    size: number;
    colorR: number;
    colorG: number;
    colorB: number;
    targetId?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 64, y: 32 });
  world.addComponent(eid, Projectile, {
    speed: 350,
    damage: 10,
    damageType: 0,
    targetId: opts.targetId ?? 0,
    sourceId: 0,
    fromX: 32,
    fromY: 32,
    shape: opts.shape,
    colorR: opts.colorR,
    colorG: opts.colorG,
    colorB: opts.colorB,
    size: opts.size,
    sourceTowerType: opts.sourceTowerType,
  });
  world.addComponent(eid, Visual, {
    shape: opts.shape,
    colorR: opts.colorR,
    colorG: opts.colorG,
    colorB: opts.colorB,
    size: opts.size,
    alpha: 1,
  });
  return eid;
}

function makeTarget(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 120,
    colorG: 120,
    colorB: 120,
    size: 10,
    alpha: 1,
  });
  return eid;
}

describe('RenderSystem — 水晶显示', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    setArtResourcesEnabled(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setArtResourcesEnabled(true);
  });

  it('Objective 水晶实体即使不属于 UnitTag，也必须以非透明命令绘制', () => {
    const world = new TowerWorld();
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 96, y: 32 });
    world.addComponent(eid, Health, { current: 100, max: 100 });
    world.addComponent(eid, Category, { value: CategoryVal.Objective });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Hexagon,  // 六边形水晶
      colorR: 124,  // #7c3aed 紫色
      colorG: 58,
      colorB: 237,
      size: 38,
      alpha: 1,
    });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    // dt=0 避免动画偏移影响断言；验证水晶以不透明六边形绘制
    system.update(world, 0);

    expect(renderer.commands).toContainEqual(
      expect.objectContaining({
        shape: 'hexagon',
        alpha: 1,
      }),
    );
  });

  it('炮塔图片主体已绘制时，不再叠加程序绘制的炮管', () => {
    class LoadedImage {
      complete = true;
      naturalWidth = 128;
      naturalHeight = 128;
      width = 128;
      height = 128;
      src = '';
    }
    vi.stubGlobal('Image', LoadedImage);

    const world = new TowerWorld();
    makeCannonTower(world);

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);
    renderer.commands = [];
    system.update(world, 0);

    expect(renderer.commands).toContainEqual(expect.objectContaining({ image: expect.any(LoadedImage) }));
    expect(hasProceduralBarrel(renderer.commands)).toBe(false);
  });

  it('箭塔普通箭矢优先使用 AI 贴图主体', () => {
    const image = {} as HTMLImageElement;
    const extras: Partial<RenderCommand> = {};

    applyArrowProjectileArt(0, 'arrow', 22, extras, () => ({
      image,
      source: null,
      width: 60,
      height: 12,
      path: '/art/fx/fx_arrow_projectile.png',
    }));

    expect(extras).toEqual(expect.objectContaining({
      image,
      imageSource: undefined,
      size: 57.2 / 3,
      arrowGradientTail: '#e3f2fd',
      arrowGlowColor: '#4fc3f7',
      arrowGlowAlpha: 0.42,
      arrowAirStreaks: true,
      arrowLengthScale: 1.45,
      arrowShaftWidthRatio: 0.12,
      arrowHeadWidthRatio: 0.36,
    }));
    expect(extras.h).toBeCloseTo(11.44 / 3, 2);
  });

  it('箭塔普通箭矢贴图未加载时使用高可见度程序化回退', () => {
    const extras: Partial<RenderCommand> = {};

    applyArrowProjectileArt(0, 'arrow', 22, extras, () => null);

    expect(extras).toEqual(expect.objectContaining({
      arrowGradientTail: '#e3f2fd',
      arrowGlowColor: '#4fc3f7',
      arrowGlowAlpha: 0.42,
      arrowAirStreaks: true,
      arrowLengthScale: 1.45,
      arrowShaftWidthRatio: 0.12,
      arrowHeadWidthRatio: 0.36,
    }));
    expect(extras.image).toBeUndefined();
  });

  it('非箭塔 arrow 投射物不套用普通箭矢贴图', () => {
    const image = {} as HTMLImageElement;
    const extras: Partial<RenderCommand> = {};

    applyArrowProjectileArt(255, 'arrow', 22, extras, () => ({
      image,
      source: null,
      width: 128,
      height: 32,
      path: '/art/fx/fx_arrow_projectile.png',
    }));

    expect(extras).toEqual({});
  });

  it('普通塔弹体优先使用对应图片资源绘制', () => {
    const image = {} as HTMLImageElement;
    const cases = [
      { sourceTowerType: 1, path: '/art/fx/fx_cannonball_projectile.png', shape: 'circle' as const },
      { sourceTowerType: 2, path: '/art/fx/fx_ice_crystal_projectile.png', shape: 'diamond' as const },
      { sourceTowerType: 7, path: '/art/fx/fx_fireball_projectile.png', shape: 'circle' as const },
      { sourceTowerType: 8, path: '/art/fx/fx_poison_projectile.png', shape: 'circle' as const },
    ];

    for (const c of cases) {
      const extras: Partial<RenderCommand> = {};
      const shape = applyTowerProjectileArt(c.sourceTowerType, c.shape, 18, extras, (path) => {
        expect(path).toBe(c.path);
        return {
          image,
          source: null,
          width: 60,
          height: 60,
          path,
        };
      });

      expect(shape).toBe('rect');
      expect(extras).toEqual(expect.objectContaining({
        image,
        imageSource: undefined,
      }));
      expect(extras.size).toBeCloseTo(10.8, 2);
      expect(extras.h).toBeCloseTo(10.8, 2);
    }
  });

  it('普通塔弹体图片缺失时保留原几何形状回退', () => {
    const extras: Partial<RenderCommand> = {};

    const shape = applyTowerProjectileArt(7, 'circle', 18, extras, () => null);

    expect(shape).toBe('circle');
    expect(extras.image).toBeUndefined();
  });

  it('远程士兵弹体优先使用对应图片资源绘制', () => {
    const image = {} as HTMLImageElement;
    const cases = [
      { unitType: UnitType.Archer, path: '/art/fx/fx_soldier_archer_arrow.png', expectedShape: 'arrow' as const, minSize: 38.4 },
      { unitType: UnitType.Mage, path: '/art/fx/fx_soldier_mage_bolt.png', expectedShape: 'rect' as const, minSize: 38.4 },
      { unitType: UnitType.Priest, path: '/art/fx/fx_soldier_priest_bolt.png', expectedShape: 'rect' as const, minSize: 38.4 },
    ];

    for (const c of cases) {
      const extras: Partial<RenderCommand> = {};
      const shape = applySoldierProjectileArt(c.unitType, 'triangle', 8, extras, (path) => {
        expect(path).toBe(c.path);
        return {
          image,
          source: null,
          width: 256,
          height: 256,
          path,
        };
      });

      expect(shape).toBe(c.expectedShape);
      expect(extras).toEqual(expect.objectContaining({
        image,
        imageSource: undefined,
        size: c.minSize,
        h: c.minSize,
      }));
    }
  });

  it('远程士兵弹体图片缺失时保留原几何形状回退', () => {
    const extras: Partial<RenderCommand> = {};

    const shape = applySoldierProjectileArt(UnitType.Mage, 'triangle', 8, extras, () => null);

    expect(shape).toBe('triangle');
    expect(extras.image).toBeUndefined();
  });

  it('普通 projectile 实体必须调用通用主体绘制，避免冰塔和火塔子弹消失', () => {
    const world = new TowerWorld();
    makeProjectile(world, {
      sourceTowerType: 2,
      shape: ShapeVal.Diamond,
      size: 12,
      colorR: 0x81,
      colorG: 0xd4,
      colorB: 0xfa,
    });
    makeProjectile(world, {
      sourceTowerType: 7,
      shape: ShapeVal.Circle,
      size: 10,
      colorR: 0xff,
      colorG: 0x57,
      colorB: 0x22,
    });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);

    expect(renderer.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ shape: 'diamond', color: 'rgb(129,212,250)', size: 12 }),
      expect.objectContaining({ shape: 'circle', color: 'rgb(255,87,34)', size: 10 }),
    ]));
  });

  it('冰塔贴图弹体按目标方向旋转，避免素材朝向和轨迹不一致', () => {
    class LoadedImage {
      complete = true;
      naturalWidth = 128;
      naturalHeight = 128;
      width = 128;
      height = 128;
      src = '';
    }
    vi.stubGlobal('Image', LoadedImage);

    const world = new TowerWorld();
    const target = makeTarget(world, 164, 32);
    makeProjectile(world, {
      sourceTowerType: 2,
      shape: ShapeVal.Diamond,
      size: 12,
      colorR: 0x81,
      colorG: 0xd4,
      colorB: 0xfa,
      targetId: target,
    });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());
    system.update(world, 0);
    renderer.commands = [];
    system.update(world, 0);

    expect(renderer.commands).toContainEqual(expect.objectContaining({
      image: expect.any(LoadedImage),
      shape: 'rect',
      rotation: Math.PI / 2,
    }));
  });

  it('炮塔图片缺失时不回退绘制程序化主体和炮管', () => {
    const world = new TowerWorld();
    makeCannonTower(world);

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);

    expect(renderer.commands.some((cmd) => cmd.image)).toBe(false);
    expect(hasProceduralBarrel(renderer.commands)).toBe(false);
  });

  it('敌人受击时在当前精灵上叠色，不回退成程序化敌人主体', () => {
    class LoadedImage {
      complete = true;
      naturalWidth = 128;
      naturalHeight = 128;
      width = 128;
      height = 128;
      src = '';
    }
    vi.stubGlobal('Image', LoadedImage);

    const world = new TowerWorld();
    const enemyId = makeNamedEntity(world, { name: '敌人', category: CategoryVal.Enemy, x: 48 });
    Visual.hitFlashTimer[enemyId] = 0.12;

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);
    renderer.commands = [];
    Visual.hitFlashTimer[enemyId] = 0.12;
    system.update(world, 0);

    const spriteBody = renderer.commands.find((cmd) => cmd.image instanceof LoadedImage && cmd.imageTint);
    const proceduralBody = renderer.commands.find((cmd) =>
      cmd.x === 48 &&
      cmd.y === 32 &&
      cmd.shape === 'circle' &&
      !cmd.image &&
      cmd.color === '#ffffff',
    );

    expect(spriteBody).toEqual(expect.objectContaining({
      imageTint: { color: '#ffffff', alpha: 0.72 },
    }));
    expect(proceduralBody).toBeUndefined();
  });

  it('巨石机关绘制主体后仍显示血条', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    makeBoulderTrap(world);

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);

    expect(renderer.commands).toContainEqual(expect.objectContaining({
      shape: 'circle',
      color: '#78909c',
      size: 36,
    }));
    expect(renderer.commands).toContainEqual(expect.objectContaining({
      shape: 'rect',
      color: '#222222',
      h: 6,
    }));
    expect(renderer.commands).toContainEqual(expect.objectContaining({
      shape: 'rect',
      color: '#ffc107',
      h: 6,
    }));
  });

  it('精英、Boss、我方士兵使用阵营化名称颜色', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    makeNamedEntity(world, { name: '精英怪', category: CategoryVal.Enemy, x: 48, isElite: true });
    makeNamedEntity(world, { name: 'Boss', category: CategoryVal.Boss, x: 96, isBoss: true });
    makeNamedEntity(world, { name: '士兵', category: CategoryVal.Soldier, x: 144 });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);

    expect(renderer.commands).toContainEqual(expect.objectContaining({ label: '精英怪', labelColor: '#FFD700' }));
    expect(renderer.commands).toContainEqual(expect.objectContaining({ label: 'Boss', labelColor: '#ff1744' }));
    expect(renderer.commands).toContainEqual(expect.objectContaining({ label: '士兵', labelColor: '#4ade80' }));
  });

  it('塔名称后追加罗马数字等级后缀，不再绘制等级徽章', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    const towerId = makeCannonTower(world);
    Tower.level[towerId] = 3;
    world.setDisplayName(towerId, '箭塔');

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);

    expect(formatTowerLevelDisplayName('箭塔', 3)).toBe('箭塔[III]');
    expect(formatTowerLevelDisplayName('箭塔', 5)).toBe('箭塔[V]');
    expect(renderer.commands).toContainEqual(expect.objectContaining({
      label: '箭塔[III]',
      labelColor: '#ffffff',
    }));
    expect(renderer.commands).not.toContainEqual(expect.objectContaining({ label: '箭塔' }));
  });

  it('精英怪与士兵缺图时不回退绘制可选中程序化主体', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    makeNamedEntity(world, { name: '精英怪', category: CategoryVal.Enemy, x: 48, isElite: true, outline: 1 });
    const soldierId = makeNamedEntity(world, { name: '士兵', category: CategoryVal.Soldier, x: 144, outline: 1 });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap(), undefined, () => soldierId);

    system.update(world, 0);

    const eliteBody = renderer.commands.find((cmd) => cmd.x === 48 && cmd.y === 32 && cmd.size === 32 && !cmd.label);
    const soldierBody = renderer.commands.find((cmd) => cmd.x === 144 && cmd.y === 32 && cmd.size === 32 && !cmd.label);

    expect(eliteBody).toBeUndefined();
    expect(soldierBody).toBeUndefined();
  });

  it('死亡灰飞烟灭特效首帧必须先渲染，再进入生命周期清理', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    const effectId = world.createEntity();
    world.addComponent(effectId, Position, { x: 48, y: 32 });
    world.addComponent(effectId, Visual, {
      shape: ShapeVal.Circle,
      colorR: 120,
      colorG: 120,
      colorB: 120,
      size: 32,
      alpha: 1,
    });
    world.addComponent(effectId, DeathEffect, { duration: 0.3, elapsed: 0, renderedFrames: 0 });
    world.addComponent(effectId, DisintegrateEffect, {
      shardCount: 10,
      radius: 32,
      colorR: 170,
      colorG: 170,
      colorB: 170,
    });

    const deathEffectSystem = new DeathEffectSystem();
    deathEffectSystem.update(world, 1);
    world.cleanupDeadEntities();

    const renderer = new RendererStub();
    const renderSystem = new RenderSystem(renderer as never, makeMap());
    renderSystem.update(world, 0);

    const ashShards = renderer.commands.filter((cmd) =>
      cmd.color === 'rgb(170, 170, 170)' &&
      (cmd.shape === 'triangle' || cmd.shape === 'diamond'),
    );

    expect(ashShards.length).toBe(10);
    expect(DeathEffect.renderedFrames[effectId]).toBe(1);
  });
});
