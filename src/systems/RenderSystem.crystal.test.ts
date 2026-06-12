import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { TileType } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import {
  Barrel,
  Boss,
  Category,
  CategoryVal,
  Health,
  Movement,
  Position,
  ShapeVal,
  Tower,
  UnitTag,
  Visual,
} from '../core/components.js';
import { RenderSystem } from './RenderSystem.js';
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

function hasProceduralBarrel(commands: RenderCommand[]): boolean {
  return commands.some((cmd) =>
    cmd.shape === 'rect' &&
    cmd.color === '#2a2a2a' &&
    cmd.h === 6 &&
    !cmd.image,
  );
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

  it('炮塔回退到程序化主体时，保留程序绘制的炮管', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    makeCannonTower(world);

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    system.update(world, 0);

    expect(renderer.commands.some((cmd) => cmd.image)).toBe(false);
    expect(hasProceduralBarrel(renderer.commands)).toBe(true);
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

  it('精英怪与未选中我方士兵不显示被动边框，选中士兵才显示边框', () => {
    setArtResourcesEnabled(false);

    const world = new TowerWorld();
    makeNamedEntity(world, { name: '精英怪', category: CategoryVal.Enemy, x: 48, isElite: true, outline: 1 });
    const soldierId = makeNamedEntity(world, { name: '士兵', category: CategoryVal.Soldier, x: 144, outline: 1 });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap(), undefined, () => soldierId);

    system.update(world, 0);

    const eliteBody = renderer.commands.find((cmd) => cmd.x === 48 && cmd.y === 32 && cmd.size > 32 && !cmd.label);
    const soldierBody = renderer.commands.find((cmd) => cmd.x === 144 && cmd.y === 32 && cmd.size === 32 && !cmd.label);

    expect(eliteBody).toEqual(expect.objectContaining({ stroke: undefined, strokeWidth: undefined }));
    expect(soldierBody).toEqual(expect.objectContaining({ stroke: '#ffffff', strokeWidth: 3 }));
  });
});
