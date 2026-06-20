// ============================================================
// Tower Defender — BuildSystem v4.1
//
// 处理玩家建造交互：拖拽放置塔/陷阱/士兵。
// v4.0: 移除 Production（金币矿/能量塔），添加 Faction 阵营标记，
//       网格占用检查改为多层级（同格可同时有 AboveGrid + Ground + LowAir）
// v4.1: 实体创建委托 UnitFactory，消除重复代码
// ============================================================

import { TowerWorld, System, defineQuery } from '../core/World.js';
import {
  GridOccupant,
  BuildingTower,
  Layer,
  LayerVal,
  Trap,
  Health,
} from '../core/components.js';
import {
  TowerType,
  UnitType,
  type MapConfig,
  TileType,
  GamePhase,
} from '../types/index.js';
import { TOWER_CONFIGS, TRAP_CONFIGS } from '../data/gameData.js';
import { RenderSystem } from './RenderSystem.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { UnitFactory, TOWER_TYPE_ID } from './UnitFactory.js';

// ============================================================
// DragState
// ============================================================

export interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'trap' | 'spell';
  towerType?: TowerType;
  unitType?: UnitType;
  /** v4.0: 机关类型ID（如 'spike_trap', 'bear_trap' 等） */
  trapTypeId?: string;
  /** 技能卡ID（如 'fireball', 'blizzard' 等） */
  spellCardId?: string;
  /** 手牌中的卡牌索引（用于放置后移除卡牌） */
  cardIndex?: number;
  /** 起拖时的卡牌 ID，用于避免手牌槽位变化后误消费其它卡 */
  cardId?: string;
}

// ============================================================
// BuildSystem
// ============================================================

export class BuildSystem implements System {
  readonly name = 'BuildSystem';

  // —— 公开状态（main.ts / UISystem 读取） ——
  selectedTowerType: TowerType | null = TowerType.Arrow;
  dragState: DragState | null = null;

  // —— 构造参数 ——
  private map: MapConfig;
  private getPhase: () => GamePhase;
  private unitFactory: UnitFactory;
  /**
   * v3.0 卡牌流：onBuilt 仅作 meta 通知，传入的 cost 用于 EconomySystem.registerBuild
   * 回收退款溯源，并非"已扣金币"的回执。关内部署资源由 RunContext.energy 在
   * tryPlayHandCard → runPlayCard 中已扣，BuildSystem 不再扣金币。
   */
  private onBuilt: ((entityId: number, cost: number) => void) | undefined;

  /** 放置失败回调，传入失败原因和放置坐标 */
  onPlacementDenied: ((reason: string, px: number, py: number) => void) | null = null;

  // —— 每帧由 update() 注入 ——
  private _world: TowerWorld | null = null;

  // —— bitecs 查询（只定义一次） ——
  private gridQuery = defineQuery([GridOccupant]);
  private buildingQuery = defineQuery([BuildingTower]);

  constructor(
    map: MapConfig,
    getPhase: () => GamePhase,
    onBuilt?: (entityId: number, cost: number) => void,
    unitFactory?: UnitFactory,
  ) {
    this.map = map;
    this.getPhase = getPhase;
    this.onBuilt = onBuilt;
    // unitFactory 可在构造时注入，也可在 update 时通过 world 推迟创建
    this.unitFactory = unitFactory ?? new UnitFactory(null as unknown as TowerWorld);
  }

  // ==========================================================
  // System 接口
  // ==========================================================

  /** 每帧更新：建造进度倒计时 + 缓存 world 引用 */
  update(world: TowerWorld, dt: number): void {
    this._world = world;

    // 延迟绑定 unitFactory（首次 update 时 world 才可用）
    if (!this.unitFactory || (this.unitFactory as unknown as { world: TowerWorld }).world === null) {
      this.unitFactory = new UnitFactory(world);
    }

    // Update building tower timers
    const buildingTowers = this.buildingQuery(world.world);
    for (const eid of buildingTowers) {
      const timer = BuildingTower.timer[eid] ?? 0;
      if (timer > 0) {
        BuildingTower.timer[eid] = timer - dt;
        // Building complete — remove BuildingTower component
        if (BuildingTower.timer[eid]! <= 0) {
          world.removeComponent(eid, BuildingTower);
        }
      }
    }
  }

  // ==========================================================
  // 塔选择
  // ==========================================================

  get selectedTower(): TowerType | null {
    return this.selectedTowerType;
  }

  selectTower(type: TowerType): void {
    this.selectedTowerType = type;
  }

  // ==========================================================
  // 拖拽状态管理
  // ==========================================================

  startDrag(
    entityType: 'tower' | 'unit' | 'trap' | 'spell',
    opts?: {
      towerType?: TowerType;
      unitType?: UnitType;
      trapTypeId?: string;
      spellCardId?: string;
      cardIndex?: number;
      cardId?: string;
    },
  ): void {
    this.dragState = {
      active: true,
      entityType,
      towerType: opts?.towerType,
      unitType: opts?.unitType,
      trapTypeId: opts?.trapTypeId ?? 'spike_trap',
      spellCardId: opts?.spellCardId,
      cardIndex: opts?.cardIndex,
      cardId: opts?.cardId,
    };
  }

  cancelDrag(): void {
    this.dragState = null;
  }

  // ==========================================================
  // 放置建造（由 main.ts onPointerUp 调用）
  // ==========================================================

  /**
   * 在画布像素坐标处尝试放置。
   * @returns 实体 ID（成功）| false（失败）
   */
  tryDrop(px: number, py: number): number | false {
    const world = this._world;
    const ds = this.dragState;
    if (!world || !ds) return false;

    const phase = this.getPhase();
    if (phase === GamePhase.Victory || phase === GamePhase.Defeat) {
      this.cancelDrag();
      return false;
    }

    const ts = this.map.tileSize;
    const col = Math.floor((px - RenderSystem.sceneOffsetX) / ts);
    const row = Math.floor((py - RenderSystem.sceneOffsetY) / ts);

    // 网格中心坐标（用于飘字提示定位）
    const cx = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const cy = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    // 边界检查
    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) {
      this.onPlacementDenied?.('超出地图范围', px, py);
      this.cancelDrag();
      return false;
    }

    const tile = this.map.tiles[row]![col]!;

    // 地形校验
    if (ds.entityType === 'trap') {
      // 陷阱只能放在路径上
      if (tile !== TileType.Path) {
        this.onPlacementDenied?.('陷阱只能放在路径上', cx, cy);
        this.cancelDrag();
        return false;
      }
    } else {
      // 塔/建筑必须放在空地 + 毗邻路径；士兵由 main.ts spawnUnitAt 处理路径放置
      if (tile !== TileType.Empty) {
        this.onPlacementDenied?.('只能放在空地上', cx, cy);
        this.cancelDrag();
        return false;
      }
      if (!isAdjacentToPath(row, col, this.map)) {
        this.onPlacementDenied?.('必须毗邻路径', cx, cy);
        this.cancelDrag();
        return false;
      }
    }

    if (!this.canPlaceAt(world, ds.entityType, row, col)) {
      this.onPlacementDenied?.('地格已被占用', cx, cy);
      this.cancelDrag();
      return false;
    }

    // 像素坐标 → 网格中心
    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    // 按实体类型分发
    switch (ds.entityType) {
      case 'tower': return this.placeTower(x, y, row, col);
      case 'trap':  return this.placeTrap(x, y, row, col);
      case 'unit':  return this.placeUnit();
      default: { this.cancelDrag(); return false; }
    }
  }

  // ==========================================================
  // 放置实现
  // ==========================================================

  private placeTower(x: number, y: number, row: number, col: number): number | false {
    const tt = this.dragState?.towerType ?? this.selectedTowerType;
    if (!tt) { this.cancelDrag(); return false; }

    const config = TOWER_CONFIGS[tt];
    if (!config) { this.cancelDrag(); return false; }

    const eid = this.unitFactory.createTower(tt, x, y, { row, col }, {
      tileSize: this.map.tileSize,
      towerTypeNum: TOWER_TYPE_ID[tt] ?? 0,
    });
    if (eid == null) { this.cancelDrag(); return false; }

    this.onBuilt?.(eid, config.cost);
    this.cancelDrag();
    return eid;
  }

  private placeTrap(x: number, y: number, row: number, col: number): number | false {
    const trapTypeId = this.dragState?.trapTypeId ?? 'spike_trap';
    const config = TRAP_CONFIGS[trapTypeId];
    if (!config) { this.cancelDrag(); return false; }

    const eid = this.unitFactory.createTrap(trapTypeId, x, y, { row, col });
    if (eid == null) { this.cancelDrag(); return false; }

    this.onBuilt?.(eid, config.cost);
    this.cancelDrag();
    return eid;
  }

  /** 单位放置由 main.ts spawnUnitAt 处理，此处仅取消拖拽 */
  private placeUnit(): number | false {
    this.cancelDrag();
    return false;
  }

  private canPlaceAt(world: TowerWorld, entityType: DragState['entityType'], row: number, col: number): boolean {
    if (entityType === 'unit' || entityType === 'spell') return true;

    if (entityType === 'tower' && this.isDecorationOccupied(row, col)) {
      return false;
    }

    const occupantEntities = this.gridQuery(world.world);
    for (let i = 0; i < occupantEntities.length; i++) {
      const eid = occupantEntities[i]!;
      if (GridOccupant.row[eid] !== row || GridOccupant.col[eid] !== col) continue;
      if ((Health.current[eid] ?? 1) <= 0) continue;

      if (entityType === 'trap') {
        if (world.hasComponent(eid, Trap)) return false;
        continue;
      }

      const existingLayer = Layer.value[eid] ?? LayerVal.Ground;
      if (existingLayer === LayerVal.Ground) return false;
    }

    return true;
  }

  private isDecorationOccupied(row: number, col: number): boolean {
    return this.map.obstaclePlacements?.some(obs => obs.row === row && obs.col === col) ?? false;
  }

}
