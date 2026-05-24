// ============================================================
// Tower Defender — BuildSystem v4.0
//
// 处理玩家建造交互：拖拽放置塔/陷阱/士兵。
// v4.0: 移除 Production（金币矿/能量塔），添加 Faction 阵营标记，
//       网格占用检查改为多层级（同格可同时有 AboveGrid + Ground + LowAir）
// ============================================================

import { TowerWorld, System, defineQuery } from '../core/World.js';
import {
  Position,
  Tower,
  Attack,
  Health,
  Visual,
  GridOccupant,
  PlayerOwned,
  UnitTag,
  Trap,
  Category,
  CategoryVal,
  Layer,
  LayerVal,
  Faction,
  FactionVal,
  BatTower,
  BuildingTower,
  ShapeVal,
  DamageTypeVal,
  TargetSelectionVal,
  AttackModeVal,
} from '../core/components.js';
import {
  TowerType,
  UnitType,
  type MapConfig,
  TileType,
  GamePhase,
} from '../types/index.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { RenderSystem } from './RenderSystem.js';
import { isAdjacentToPath } from '../utils/grid.js';

// ============================================================
// 类型 → 数值 ID 映射
// ============================================================

/** TowerType 枚举 → bitecs Tower.towerType (ui8) */
const TOWER_TYPE_ID: Record<TowerType, number> = {
  [TowerType.Arrow]: 0,
  [TowerType.Cannon]: 1,
  [TowerType.Ice]: 2,
  [TowerType.Lightning]: 3,
  [TowerType.Laser]: 4,
  [TowerType.Bat]: 5,
  [TowerType.Missile]: 6,
  [TowerType.Fire]: 7,
  [TowerType.Poison]: 8,
  [TowerType.Ballista]: 9,
};

// ============================================================
// Helper: hex 颜色 → RGB 分量
// ============================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// ============================================================
// DragState
// ============================================================

export interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'trap';
  towerType?: TowerType;
  unitType?: UnitType;
  /** v4.0: 8种机关类型，0=地刺(默认) */
  trapType?: number;
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
  /**
   * v3.0 卡牌流：onBuilt 仅作 meta 通知，传入的 cost 用于 EconomySystem.registerBuild
   * 回收退款溯源，并非"已扣金币"的回执。关内部署资源由 RunContext.energy 在
   * tryPlayHandCard → runPlayCard 中已扣，BuildSystem 不再扣金币。
   */
  private onBuilt: ((entityId: number, cost: number) => void) | undefined;

  // —— 每帧由 update() 注入 ——
  private _world: TowerWorld | null = null;

  // —— bitecs 查询（只定义一次） ——
  private gridQuery = defineQuery([GridOccupant]);

  constructor(
    map: MapConfig,
    getPhase: () => GamePhase,
    onBuilt?: (entityId: number, cost: number) => void,
  ) {
    this.map = map;
    this.getPhase = getPhase;
    this.onBuilt = onBuilt;
  }

  // ==========================================================
  // System 接口
  // ==========================================================

  /** 每帧缓存 world 引用，供建造方法使用 */
  update(world: TowerWorld, _dt: number): void {
    this._world = world;
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
    entityType: 'tower' | 'unit' | 'trap',
    opts?: {
      towerType?: TowerType;
      unitType?: UnitType;
      trapType?: number;
    },
  ): void {
    this.dragState = {
      active: true,
      entityType,
      towerType: opts?.towerType,
      unitType: opts?.unitType,
      trapType: opts?.trapType ?? 0,
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

    // 边界检查
    if (col < 0 || col >= this.map.cols || row < 0 || row >= this.map.rows) {
      this.cancelDrag();
      return false;
    }

    const tile = this.map.tiles[row]![col]!;

    // 地形校验
    if (ds.entityType === 'trap') {
      // 陷阱只能放在路径上
      if (tile !== TileType.Path) {
        this.cancelDrag();
        return false;
      }
    } else {
      // 塔/建筑/单位必须放在空地 + 毗邻路径
      if (tile !== TileType.Empty) {
        this.cancelDrag();
        return false;
      }
      if (!isAdjacentToPath(row, col, this.map)) {
        this.cancelDrag();
        return false;
      }
    }

    // 网格占用检查 (多层级: 同格可同时有 AboveGrid + Ground + LowAir)
    // design/02-gameplay.md §1.4
    const myLayer = ds.entityType === 'trap' ? LayerVal.AboveGrid : LayerVal.Ground;
    const occupantEntities = this.gridQuery(world.world);
    for (let i = 0; i < occupantEntities.length; i++) {
      const eid = occupantEntities[i]!;
      if (GridOccupant.row[eid] === row && GridOccupant.col[eid] === col) {
        // 同层级冲突才拒绝
        const existingLayer = Layer.value[eid] ?? LayerVal.Ground;
        if (existingLayer === myLayer) {
          this.cancelDrag();
          return false;
        }
      }
    }

    // 像素坐标 → 网格中心
    const x = col * ts + ts / 2 + RenderSystem.sceneOffsetX;
    const y = row * ts + ts / 2 + RenderSystem.sceneOffsetY;

    // 按实体类型分发
    switch (ds.entityType) {
      case 'tower': return this.placeTower(world, x, y, row, col);
      case 'trap':  return this.placeTrap(world, x, y, row, col);
      case 'unit':  return this.placeUnit();
      default: { this.cancelDrag(); return false; }
    }
  }

  // ==========================================================
  // 放置实现
  // ==========================================================

  private placeTower(world: TowerWorld, x: number, y: number, row: number, col: number): number | false {
    const tt = this.dragState?.towerType ?? this.selectedTowerType;
    if (!tt) { this.cancelDrag(); return false; }

    const config = TOWER_CONFIGS[tt];
    if (!config) { this.cancelDrag(); return false; }

    const eid = this.createTowerEntity(world, x, y, row, col, tt);
    this.onBuilt?.(eid, config.cost);
    this.cancelDrag();
    return eid;
  }

  private placeTrap(world: TowerWorld, x: number, y: number, row: number, col: number): number | false {
    const TRAP_REFUND_META = 40;

    const eid = this.createTrapEntity(world, x, y, row, col);
    this.onBuilt?.(eid, TRAP_REFUND_META);
    this.cancelDrag();
    return eid;
  }

  /** 单位放置由 main.ts spawnUnitAt 处理，此处仅取消拖拽 */
  private placeUnit(): number | false {
    this.cancelDrag();
    return false;
  }

  // ==========================================================
  // bitecs 实体创建
  // ==========================================================

  private createTowerEntity(
    world: TowerWorld,
    x: number, y: number,
    row: number, col: number,
    tt: TowerType,
  ): number {
    const config = TOWER_CONFIGS[tt]!;
    const ts = this.map.tileSize;
    const eid = world.createEntity();

    // Position
    world.addComponent(eid, Position, { x, y });
    // GridOccupant
    world.addComponent(eid, GridOccupant, { row, col });
    // Health
    world.addComponent(eid, Health, {
      current: config.hp,
      max: config.hp,
      armor: 0,
      magicResist: 0,
    });
    // Tower
    world.addComponent(eid, Tower, {
      towerType: TOWER_TYPE_ID[tt],
      level: 1,
      totalInvested: config.cost,
    });
    // PlayerOwned (tag)
    world.addComponent(eid, PlayerOwned);

    // Attack / BatTower
    if (tt === TowerType.Bat) {
      const batCount = config.batCount ?? 4;
      const replenishCD = config.batReplenishCD ?? 12;
      const batDmg = config.batDamage ?? config.atk;
      const batRange = config.batAttackRange ?? config.range;
      const batAS = config.batAttackSpeed ?? config.attackSpeed;
      const batHP = config.batHP ?? 30;
      const batSpeed = config.batSpeed ?? 120;
      const batSize = 10;

      world.addComponent(eid, BatTower, {
        maxBats: batCount,
        replenishCooldown: replenishCD,
        replenishTimer: 0,
        batDamage: batDmg,
        batAttackRange: batRange,
        batAttackSpeed: batAS,
        batHp: batHP,
        batSpeed,
        batSize,
      });
    } else {
      const dmgType = config.damageType === 'magic'
        ? DamageTypeVal.Magic
        : DamageTypeVal.Physical;

      const isMissile = tt === TowerType.Missile;

      world.addComponent(eid, Attack, {
        damage: config.atk,
        attackSpeed: config.attackSpeed,
        range: config.range,
        damageType: dmgType,
        cooldownTimer: 0,
        targetId: 0,
        targetSelection: TargetSelectionVal.Nearest,
        attackMode: isMissile ? AttackModeVal.AoeSplash : AttackModeVal.SingleTarget,
        isRanged: 1,  // all towers are ranged
        splashRadius: config.splashRadius ?? 0,
        chainCount: 0,
        chainRange: 0,
        chainDecay: 0,
        drainPercent: 0,
      });
    }

    // Visual
    const rgb = hexToRgb(config.color);
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: ts * 0.65,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    // UnitTag — 统一冷却tick 依赖此组件，与 trap/production 一致
    world.addComponent(eid, UnitTag, {
      isEnemy: 0,
      isBoss: 0,
      isRanged: 1,
      canAttackBuildings: 0,
      rewardGold: 0,
      rewardEnergy: 0,
      popCost: 0,
      cost: config.cost,
    });

    // Category
    world.addComponent(eid, Category, { value: CategoryVal.Tower });
    // Faction — v4.0: player-placed units belong to Justice
    world.addComponent(eid, Faction, { value: FactionVal.Justice });
    world.addComponent(eid, Layer, { value: LayerVal.Ground });

    // 建造中状态 — buildTime 秒内不可攻击、不被锁定、不可选中
    const buildTime = config.buildTime ?? 2.0;
    world.addComponent(eid, BuildingTower, {
      timer: buildTime,
      duration: buildTime,
    });

    // Display name for overhead HUD
    world.setDisplayName(eid, config.name);

    return eid;
  }

  private createTrapEntity(
    world: TowerWorld,
    x: number, y: number,
    row: number, col: number,
  ): number {
    const ts = this.map.tileSize;
    const eid = world.createEntity();

    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, GridOccupant, { row, col });
    world.addComponent(eid, Trap, {
      damagePerSecond: 20,
      radius: 32,
      cooldown: 0,
      cooldownTimer: 0,
      animTimer: 0,
      animDuration: 0.4,
      triggerCount: 0,
      maxTriggers: 0,
    });

    const rgb = hexToRgb('#e53935');
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Triangle,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: ts * 0.5,
      alpha: 1,
      outline: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    world.addComponent(eid, PlayerOwned);
    world.addComponent(eid, Category, { value: CategoryVal.Trap });
    // Faction — v4.0: player-placed traps belong to Justice
    world.addComponent(eid, Faction, { value: FactionVal.Justice });
    world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });

    // UnitTag — AISystem 查询需要
    world.addComponent(eid, UnitTag, {
      isEnemy: 0,
      isBoss: 0,
      isRanged: 0,
      canAttackBuildings: 0,
      rewardGold: 0,
      rewardEnergy: 0,
      popCost: 0,
      cost: 0,
    });

    // Health — 陷阱不可摧毁（超大血量）
    world.addComponent(eid, Health, {
      current: 99999,
      max: 99999,
      armor: 0,
      magicResist: 0,
    });

    // Attack — DOT 伤害
    world.addComponent(eid, Attack, {
      damage: 20,
      attackSpeed: 1,
      range: 32,
      damageType: DamageTypeVal.Physical,
      isRanged: 0,
      cooldownTimer: 0,
    });

    // Display name for overhead HUD
    world.setDisplayName(eid, '地刺');

    return eid;
  }

}
