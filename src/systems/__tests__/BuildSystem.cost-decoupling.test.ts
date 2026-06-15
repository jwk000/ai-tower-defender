import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { BuildSystem } from '../BuildSystem.js';
import { TowerWorld } from '../../core/World.js';
import { GamePhase, TowerType, TileType, type MapConfig } from '../../types/index.js';
import { RenderSystem } from '../RenderSystem.js';
import { loadAllUnitConfigs } from '../../config/loader.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { UnitFactory } from '../UnitFactory.js';
import { Health } from '../../core/components.js';

// v4.1 — BuildSystem 实体创建委托 UnitFactory
//
// v4.0: 移除 Production, 添加 Faction 标记
// v3.0 卡牌流：tryPlayHandCard → runPlayCard 已扣能量 → buildSystem.startDrag → tryDrop → placeXxx

function buildSimpleMap(): MapConfig {
  // 3×3 map: row 0 = path (有 spawn 起点)，row 1/2 = empty
  const tiles: TileType[][] = [
    [TileType.Path, TileType.Path, TileType.Path],
    [TileType.Empty, TileType.Empty, TileType.Empty],
    [TileType.Empty, TileType.Empty, TileType.Empty],
  ];
  return {
    name: 'test-map',
    cols: 3,
    rows: 3,
    tileSize: 64,
    tiles,
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    pathGraph: {
      nodes: [
        { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
        { id: 'e', row: 0, col: 2, role: 'crystal_anchor' },
      ],
      edges: [{ from: 's', to: 'e' }],
    },
  };
}

describe('BuildSystem v4.1 — UnitFactory 委托 + Faction 标记', () => {
  let world: TowerWorld;
  let map: MapConfig;
  let buildSystem: BuildSystem;
  let unitFactory: UnitFactory;

  beforeAll(async () => {
    await loadAllUnitConfigs();
  });

  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    world = new TowerWorld();
    map = buildSimpleMap();
    unitFactory = new UnitFactory(world);
    buildSystem = new BuildSystem(map, () => GamePhase.Battle, undefined, unitFactory);
    buildSystem.update(world, 0);
  });

  it('placeTower (Arrow @ row1,col0 邻接 row0 path) 放置成功', () => {
    buildSystem.startDrag('tower', { towerType: TowerType.Arrow });
    const pxX = 0 * 64 + 32;
    const pxY = 1 * 64 + 32;
    const result = buildSystem.tryDrop(pxX, pxY);
    expect(result).not.toBe(false);
  });

  it('placeTrap (path tile @ row0,col1) 放置成功', () => {
    buildSystem.startDrag('trap');
    const pxX = 1 * 64 + 32;
    const pxY = 0 * 64 + 32;
    const result = buildSystem.tryDrop(pxX, pxY);
    expect(result).not.toBe(false);
  });

  it('onBuilt 回调以 cost meta 触发（registerBuild 退款追溯需要）— placeTower', () => {
    const onBuilt = vi.fn();
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt, unitFactory);
    bs.update(world, 0);
    bs.startDrag('tower', { towerType: TowerType.Arrow });
    bs.tryDrop(0 * 64 + 32, 1 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    const callArgs = onBuilt.mock.calls[0]!;
    expect(callArgs[0]).toBeGreaterThan(0);
    expect(typeof callArgs[1]).toBe('number');
    expect(callArgs[1]).toBeGreaterThan(0);
  });

  it('onBuilt 回调以 YAML cost 触发 — placeTrap', () => {
    const onBuilt = vi.fn();
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt, unitFactory);
    bs.update(world, 0);
    bs.startDrag('trap');
    bs.tryDrop(1 * 64 + 32, 0 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    // spike_trap YAML cost.build = 40
    expect(onBuilt.mock.calls[0]![1]).toBe(40);
  });

  it('机关不能放在同一个地格，机关死亡后释放占用', () => {
    buildSystem.startDrag('trap', { trapTypeId: 'spike_trap' });
    const first = buildSystem.tryDrop(1 * 64 + 32, 0 * 64 + 32);
    expect(first).not.toBe(false);

    buildSystem.startDrag('trap', { trapTypeId: 'bear_trap' });
    expect(buildSystem.tryDrop(1 * 64 + 32, 0 * 64 + 32)).toBe(false);

    Health.current[first as number] = 0;
    buildSystem.startDrag('trap', { trapTypeId: 'bear_trap' });
    expect(buildSystem.tryDrop(1 * 64 + 32, 0 * 64 + 32)).not.toBe(false);
  });

  it('塔不能放在装饰物占用的地格上', () => {
    map.obstaclePlacements = [{ row: 1, col: 0, type: 'tree' as never }];

    buildSystem.startDrag('tower', { towerType: TowerType.Arrow });
    expect(buildSystem.tryDrop(0 * 64 + 32, 1 * 64 + 32)).toBe(false);
  });

  it('塔死亡后释放地格占用，可以在同格重新放塔', () => {
    buildSystem.startDrag('tower', { towerType: TowerType.Arrow });
    const first = buildSystem.tryDrop(0 * 64 + 32, 1 * 64 + 32);
    expect(first).not.toBe(false);

    buildSystem.startDrag('tower', { towerType: TowerType.Cannon });
    expect(buildSystem.tryDrop(0 * 64 + 32, 1 * 64 + 32)).toBe(false);

    Health.current[first as number] = 0;
    buildSystem.startDrag('tower', { towerType: TowerType.Cannon });
    expect(buildSystem.tryDrop(0 * 64 + 32, 1 * 64 + 32)).not.toBe(false);
  });
});
