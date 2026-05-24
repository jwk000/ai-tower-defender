import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildSystem } from '../BuildSystem.js';
import { TowerWorld } from '../../core/World.js';
import { GamePhase, TowerType, TileType, type MapConfig } from '../../types/index.js';
import { RenderSystem } from '../RenderSystem.js';

// v4.0 — BuildSystem 清理 Production 引用 + Faction 标记
//
// v3.0 卡牌流：tryPlayHandCard → runPlayCard 已扣能量 → buildSystem.startDrag → tryDrop → placeXxx
// BuildSystem.onBuilt 回调按 cost meta 触发，供 EconomySystem.registerBuild 回收溯源。
// v4.0 移除 production 实体类型（金币矿/能量塔），所有玩家放置实体添加 FactionVal.Justice。

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

describe('BuildSystem v4.0 — 卡牌流部署 + Faction 标记', () => {
  let world: TowerWorld;
  let map: MapConfig;
  let buildSystem: BuildSystem;

  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    world = new TowerWorld();
    map = buildSimpleMap();
    buildSystem = new BuildSystem(map, () => GamePhase.Battle);
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
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt);
    bs.update(world, 0);
    bs.startDrag('tower', { towerType: TowerType.Arrow });
    bs.tryDrop(0 * 64 + 32, 1 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    const callArgs = onBuilt.mock.calls[0]!;
    expect(callArgs[0]).toBeGreaterThan(0);
    expect(typeof callArgs[1]).toBe('number');
    expect(callArgs[1]).toBeGreaterThan(0);
  });

  it('onBuilt 回调以 TRAP_REFUND_META=40 触发 — placeTrap', () => {
    const onBuilt = vi.fn();
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt);
    bs.update(world, 0);
    bs.startDrag('trap');
    bs.tryDrop(1 * 64 + 32, 0 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    expect(onBuilt.mock.calls[0]![1]).toBe(40);
  });
});
