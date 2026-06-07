import { describe, expect, it, beforeEach } from 'vitest';
import type { RenderCommand } from '../types/index.js';
import { TileType } from '../types/index.js';
import { TowerWorld } from '../core/World.js';
import {
  Category,
  CategoryVal,
  Health,
  Position,
  ShapeVal,
  Visual,
} from '../core/components.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';

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

describe('RenderSystem — 水晶显示', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('Objective 水晶实体即使不属于 UnitTag，也必须以非透明命令绘制', () => {
    const world = new TowerWorld();
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: 96, y: 32 });
    world.addComponent(eid, Health, { current: 100, max: 100 });
    world.addComponent(eid, Category, { value: CategoryVal.Objective });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Diamond,
      colorR: 255,  // #ff1744 红色（设计文档 §5）
      colorG: 23,
      colorB: 68,
      size: 32,     // 主体 32px（设计文档 §5）
      alpha: 1,
    });

    const renderer = new RendererStub();
    const system = new RenderSystem(renderer as never, makeMap());

    // dt=0 避免动画偏移影响断言；验证水晶以不透明菱形绘制
    system.update(world, 0);

    expect(renderer.commands).toContainEqual(
      expect.objectContaining({
        shape: 'diamond',
        alpha: 1,
      }),
    );
  });
});
