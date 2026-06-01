// ============================================================
// UnitFactory — 统一的实体创建工厂（bitecs SoA 风格）
//
// 所有单位实体（塔/陷阱/士兵/敌人/建筑/基地/出生点）均通过此工厂创建。
// BuildSystem / main.ts 通过调用工厂方法委托实体创建。
// ============================================================

import type { TowerWorld } from '../core/World.js';
import { TowerType, type UnitVisualParts } from '../types/index.js';
import {
  Position,
  Health,
  Attack,
  Visual,
  UnitTag,
  GridOccupant,
  PlayerOwned,
  Trap,
  Tower,
  Movement,
  Soldier,
  Skill,
  AlertMark,
  PlayerControllable,
  BatTower,
  BuildingTower,
  Category,
  CategoryVal,
  Faction,
  FactionVal,
  Layer,
  LayerVal,
  DamageTypeVal,
  AttackModeVal,
  TargetSelectionVal,
  TrapTypeVal,
} from '../core/components.js';
import { unitConfigRegistry } from '../config/registry.js';
import { shapeTypeToVal, hexToRgb, layerStrToVal } from '../utils/visualHelpers.js';

// ============================================================
// 映射表
// ============================================================

/** TowerType 枚举 → YAML configId */
const TOWER_TYPE_TO_CONFIG_ID: Record<TowerType, string> = {
  [TowerType.Arrow]: 'arrow_tower',
  [TowerType.Ballista]: 'ballista_tower',
  [TowerType.Cannon]: 'cannon_tower',
  [TowerType.Laser]: 'laser_tower',
  [TowerType.Bat]: 'bat_tower',
  [TowerType.Missile]: 'missile_tower',
  [TowerType.Ice]: 'ice_tower',
  [TowerType.Fire]: 'fire_tower',
  [TowerType.Poison]: 'poison_tower',
  [TowerType.Lightning]: 'lightning_tower',
};

/** TowerType 枚举 → bitecs Tower.towerType (ui8) 数值 ID */
export const TOWER_TYPE_ID: Record<TowerType, number> = {
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

/** YAML trap.type 字符串 → TrapTypeVal 数字 */
const TRAP_TYPE_MAP: Record<string, number> = {
  'SpikeTrap': TrapTypeVal.SpikeTrap,
  'BearTrap': TrapTypeVal.BearTrap,
  'TarPit': TrapTypeVal.TarPit,
  'Boulder': TrapTypeVal.Boulder,
  'Fan': TrapTypeVal.Fan,
  'WaterPit': TrapTypeVal.WaterPit,
  'BoxingGlove': TrapTypeVal.BoxingGlove,
  'MechanicalArm': TrapTypeVal.MechanicalArm,
};

/** YAML attackMode 字符串 → AttackModeVal 数字 */
function attackModeStrToVal(mode: string): number {
  switch (mode) {
    case 'aoe_splash': return AttackModeVal.AoeSplash;
    case 'chain': return AttackModeVal.Chain;
    case 'piercing': return AttackModeVal.Piercing;
    case 'dot_aoe': return AttackModeVal.DotAoe;
    case 'heal': return AttackModeVal.Heal;
    default: return AttackModeVal.SingleTarget;
  }
}

/** YAML targetSelection 字符串 → TargetSelectionVal 数字 */
function targetSelectionStrToVal(sel: string): number {
  switch (sel) {
    case 'farthest': return TargetSelectionVal.Farthest;
    case 'weakest': return TargetSelectionVal.Weakest;
    case 'strongest': return TargetSelectionVal.Strongest;
    case 'random': return TargetSelectionVal.Random;
    case 'type_priority': return TargetSelectionVal.TypePriority;
    case 'target_marker': return TargetSelectionVal.TargetMarker;
    default: return TargetSelectionVal.Nearest;
  }
}

/** YAML damageType 字符串 → DamageTypeVal 数字 */
function damageTypeStrToVal(dt: string): number {
  switch (dt) {
    case 'magic': return DamageTypeVal.Magic;
    default: return DamageTypeVal.Physical;
  }
}

// ============================================================
// UnitFactory
// ============================================================

export class UnitFactory {
  private world: TowerWorld;

  constructor(world: TowerWorld) {
    this.world = world;
  }

  /** TowerType → YAML configId */
  getTowerConfigId(tt: TowerType): string {
    return TOWER_TYPE_TO_CONFIG_ID[tt] ?? 'arrow_tower';
  }

  // ============================================================
  // 内部基础创建
  // ============================================================

  /**
   * 读取 YAML 配置，创建基础实体（Position + GridOccupant + Health + Visual + UnitTag + displayName）。
   * 各 create* 方法在此基础上追加类型特有组件。
   */
  private createBase(
    configId: string,
    x: number,
    y: number,
    gridPos?: { row: number; col: number },
    tileSize?: number,
  ): { eid: number; config: Record<string, unknown> } | null {
    const config = unitConfigRegistry.get(configId);
    if (!config) {
      console.error(`UnitFactory: config not found: ${configId}`);
      return null;
    }

    const eid = this.world.createEntity();

    // Position
    this.world.addComponent(eid, Position, { x, y });

    // GridOccupant
    if (gridPos) {
      this.world.addComponent(eid, GridOccupant, { row: gridPos.row, col: gridPos.col });
    }

    // Health
    const stats = (config as Record<string, unknown>).stats as Record<string, unknown> | undefined;
    const hp = (stats?.hp as number) ?? 0;
    if (hp > 0) {
      this.world.addComponent(eid, Health, {
        current: hp,
        max: hp,
        armor: (stats?.armor as number) ?? 0,
        magicResist: (stats?.mr as number) ?? 0,
      });
    }

    // Visual
    const visual = (config as Record<string, unknown>).visual as Record<string, unknown> | undefined;
    const color = (visual?.color as string) ?? '#888888';
    const rgb = hexToRgb(color);
    const shapeStr = (visual?.shape as string) ?? 'rect';
    const outlineVal = (visual?.outline === true || visual?.outline === 1) ? 1 : 0;
    // 塔类使用 tileSize * 0.65，其他使用配置中的 size
    const baseSize = tileSize ? tileSize * 0.65 : ((visual?.size as number) ?? 32);
    this.world.addComponent(eid, Visual, {
      shape: shapeTypeToVal(shapeStr as never),
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: baseSize,
      alpha: 1,
      outline: outlineVal,
      hitFlashTimer: 0,
      idlePhase: 0,
      facing: 1,
      bobPhase: 0,
      breathPhase: Math.random() * Math.PI * 2,
      attackAnimTimer: 0,
      attackAnimDuration: 0.3,
      partsId: 0,
    });

    // UnitTag
    const cost = (config as Record<string, unknown>).cost as Record<string, unknown> | undefined;
    const upgradeArr = cost?.upgrade as unknown[] | undefined;
    const maxLevel = upgradeArr?.length ? upgradeArr.length + 1 : 3;
    this.world.addComponent(eid, UnitTag, {
      isEnemy: 0,
      isElite: 0,
      isBoss: 0,
      isRanged: 0,
      canAttackBuildings: 0,
      rewardGold: 0,
      rewardEnergy: 0,
      popCost: (cost?.pop as number) ?? 0,
      cost: (cost?.build as number) ?? 0,
      atk: (stats?.atk as number) ?? 0,
      level: 1,
      maxLevel,
      totalInvested: (cost?.build as number) ?? 0,
      unitTypeNum: 0,
    });

    // Display name
    this.world.setDisplayName(eid, config.name);

    return { eid, config: config as Record<string, unknown> };
  }

  // ============================================================
  // 公开创建方法
  // ============================================================

  /**
   * 创建塔实体。
   * 包含：Attack/BatTower + Tower + PlayerOwned + BuildingTower + Category/Faction/Layer
   */
  createTower(
    configId: string,
    x: number,
    y: number,
    gridPos: { row: number; col: number },
    opts: { tileSize: number; towerTypeNum: number },
  ): number | null {
    const base = this.createBase(configId, x, y, gridPos, opts.tileSize);
    if (!base) return null;

    const { eid, config } = base;
    const stats = config.stats as Record<string, unknown>;
    const behavior = config.behavior as Record<string, unknown> | undefined;
    const special = behavior?.special as Record<string, unknown> | undefined;
    const layer = (config.layer as string) ?? 'Ground';

    // Tower component
    const towerTypeId = opts.towerTypeNum;
    this.world.addComponent(eid, Tower, {
      towerType: towerTypeId,
      level: 1,
      totalInvested: (config.cost as Record<string, unknown>)?.build as number ?? 0,
    });

    // Attack or BatTower
    const isBatTower = (config.id as string) === 'bat_tower';
    if (isBatTower) {
      this.world.addComponent(eid, BatTower, {
        maxBats: (special?.batCount as number) ?? 4,
        replenishCooldown: (special?.batReplenishCD as number) ?? 12,
        replenishTimer: 0,
        batDamage: (special?.batDamage as number) ?? (stats.atk as number),
        batAttackRange: (special?.batAttackRange as number) ?? (stats.range as number),
        batAttackSpeed: (special?.batAttackSpeed as number) ?? (stats.attackSpeed as number),
        batHp: (special?.batHP as number) ?? 30,
        batSpeed: (special?.batSpeed as number) ?? 120,
        batSize: (special?.batSize as number) ?? 10,
      });
    } else {
      const dmgType = damageTypeStrToVal((stats.damageType as string) ?? 'physical');
      const atkMode = attackModeStrToVal((behavior?.attackMode as string) ?? 'single_target');
      const isMissile = (config.id as string) === 'missile_tower';
      this.world.addComponent(eid, Attack, {
        damage: stats.atk as number,
        attackSpeed: stats.attackSpeed as number,
        range: stats.range as number,
        damageType: isMissile ? DamageTypeVal.Physical : dmgType,
        cooldownTimer: 0,
        targetId: 0,
        targetSelection: targetSelectionStrToVal((behavior?.targetSelection as string) ?? 'nearest'),
        attackMode: isMissile ? AttackModeVal.AoeSplash : atkMode,
        isRanged: 1,
        splashRadius: (special?.splashRadius as number) ?? 0,
        chainCount: (special?.chainCount as number) ?? 0,
        chainRange: (special?.chainRange as number) ?? 0,
        chainDecay: (special?.chainDecay as number) ?? 0,
        drainPercent: (special?.drainPercent as number) ?? 0,
        alertRange: (stats.range as number) * 2,
        tauntCapacity: 0,
        attackerCount: 0,
      });
    }

    // PlayerOwned
    this.world.addComponent(eid, PlayerOwned);

    // Category / Faction / Layer
    this.world.addComponent(eid, Category, { value: CategoryVal.Tower });
    this.world.addComponent(eid, Faction, { value: FactionVal.Justice });
    this.world.addComponent(eid, Layer, { value: layerStrToVal(layer) });

    // BuildingTower — 建造中状态
    const buildTime = (config.cost as Record<string, unknown>)?.buildTime as number ?? 2.0;
    this.world.addComponent(eid, BuildingTower, {
      timer: buildTime,
      duration: buildTime,
    });

    return eid;
  }

  /**
   * 创建陷阱实体。
   * 包含：Trap + Attack + PlayerOwned + Category/Faction/Layer
   */
  createTrap(
    configId: string,
    x: number,
    y: number,
    gridPos: { row: number; col: number },
  ): number | null {
    const base = this.createBase(configId, x, y, gridPos);
    if (!base) return null;

    const { eid, config } = base;
    const stats = config.stats as Record<string, unknown>;
    const trapCfg = config.trap as Record<string, unknown> | undefined;
    const layer = (config.layer as string) ?? 'AboveGrid';

    // Trap component
    const trapTypeStr = (trapCfg?.type as string) ?? 'SpikeTrap';
    const trapTypeVal = TRAP_TYPE_MAP[trapTypeStr] ?? TrapTypeVal.SpikeTrap;
    this.world.addComponent(eid, Trap, {
      trapType: trapTypeVal,
      damagePerSecond: (trapCfg?.damagePerSecond as number) ?? 8,
      radius: (trapCfg?.radius as number) ?? 32,
      cooldown: (trapCfg?.cooldown as number) ?? 0,
      cooldownTimer: 0,
      animTimer: 0,
      animDuration: 0.4,
      triggerCount: 0,
      maxTriggers: (trapCfg?.maxTriggers as number) ?? 0,
      direction: 0,
    });

    // Attack — 陷阱也需要 Attack 组件让 TrapSystem 检测范围
    this.world.addComponent(eid, Attack, {
      damage: (trapCfg?.damagePerSecond as number) ?? 0,
      attackSpeed: 1,
      range: (trapCfg?.radius as number) ?? 32,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: TargetSelectionVal.Nearest,
      attackMode: AttackModeVal.SingleTarget,
      isRanged: 0,
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
      alertRange: 0,
      tauntCapacity: 0,
      attackerCount: 0,
    });

    // PlayerOwned
    this.world.addComponent(eid, PlayerOwned);

    // Category / Faction / Layer
    this.world.addComponent(eid, Category, { value: CategoryVal.Trap });
    this.world.addComponent(eid, Faction, { value: FactionVal.Justice });
    this.world.addComponent(eid, Layer, { value: layerStrToVal(layer) });

    return eid;
  }

  /**
   * 创建士兵实体。
   * 包含：Attack + Movement + Soldier + Skill + AlertMark + PlayerControllable + PlayerOwned + Category/Faction/Layer
   */
  createSoldier(
    configId: string,
    x: number,
    y: number,
    gridPos: { row: number; col: number },
    opts: {
      unitTypeNum: number;
      skillId: number;
      skillCooldown: number;
      skillEnergyCost: number;
      registerVisualParts?: (parts: UnitVisualParts) => number;
      visualParts?: UnitVisualParts;
    },
  ): number | null {
    const base = this.createBase(configId, x, y, gridPos);
    if (!base) return null;

    const { eid, config } = base;
    const stats = config.stats as Record<string, unknown>;
    const behavior = config.behavior as Record<string, unknown> | undefined;
    const special = behavior?.special as Record<string, unknown> | undefined;

    // 更新 UnitTag 的 unitTypeNum
    UnitTag.unitTypeNum[eid] = opts.unitTypeNum;

    // 更新 Visual 的 partsId、outline、attackAnimDuration
    if (opts.visualParts && opts.registerVisualParts) {
      Visual.partsId[eid] = opts.registerVisualParts(opts.visualParts);
    }
    Visual.outline[eid] = 1;

    // Attack
    const splashRadius = (special?.splashRadius as number) ?? 0;
    const attackMode = splashRadius > 0 ? AttackModeVal.AoeSplash : AttackModeVal.SingleTarget;
    this.world.addComponent(eid, Attack, {
      damageType: damageTypeStrToVal((stats.damageType as string) ?? 'physical'),
      damage: stats.atk as number,
      attackSpeed: stats.attackSpeed as number,
      range: (stats.range as number) ?? 50,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: targetSelectionStrToVal((behavior?.targetSelection as string) ?? 'nearest'),
      attackMode,
      isRanged: 0,
      splashRadius,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
      alertRange: ((stats.range as number) ?? 50) * 2,
      tauntCapacity: (special?.tauntCapacity as number) ?? 0,
      attackerCount: 0,
    });

    // Movement
    const speed = (stats.speed as number) ?? 60;
    const moveRange = (stats.moveRange as number) ?? 200;
    this.world.addComponent(eid, Movement, {
      speed,
      currentSpeed: speed,
      targetX: x,
      targetY: y,
      pathIndex: 0,
      progress: 0,
      moveMode: 5, // MoveModeVal.PlayerDirected
      homeX: x,
      homeY: y,
      moveRange,
    });

    // AlertMark
    this.world.addComponent(eid, AlertMark, {
      visible: 0,
      blink: 0,
      timer: 0,
    });

    // PlayerControllable
    this.world.addComponent(eid, PlayerControllable);

    // Skill
    this.world.addComponent(eid, Skill, {
      skillId: opts.skillId,
      cooldown: opts.skillCooldown,
      currentCooldown: 0,
      energyCost: opts.skillEnergyCost,
    });

    // PlayerOwned
    this.world.addComponent(eid, PlayerOwned);

    // Soldier AI
    this.world.addComponent(eid, Soldier, {
      state: 0, // SoldierState.Idle
      homeX: x,
      homeY: y,
      moveRange,
      attackTarget: 0,
      stateTimer: 0,
    });

    // Category / Faction / Layer
    this.world.addComponent(eid, Category, { value: CategoryVal.Soldier });
    this.world.addComponent(eid, Faction, { value: FactionVal.Justice });
    this.world.addComponent(eid, Layer, { value: LayerVal.Ground });

    return eid;
  }

  /**
   * 创建敌人实体。
   * 包含：Enemy tag + Movement
   */
  createEnemy(configId: string, x: number, y: number): number | null {
    const base = this.createBase(configId, x, y);
    if (!base) return null;

    const { eid, config } = base;
    const stats = config.stats as Record<string, unknown>;
    const behavior = config.behavior as Record<string, unknown> | undefined;

    // Movement
    const speed = (stats.speed as number) ?? 0;
    if (speed > 0) {
      this.world.addComponent(eid, Movement, {
        speed,
        currentSpeed: speed,
        targetX: x,
        targetY: y,
        pathIndex: 0,
        progress: 0,
        moveMode: 1, // MoveModeVal.FollowPath
        homeX: x,
        homeY: y,
        moveRange: 0,
      });
    }

    // Category / Faction / Layer
    const layer = (config.layer as string) ?? 'Ground';
    this.world.addComponent(eid, Category, { value: CategoryVal.Enemy });
    this.world.addComponent(eid, Faction, { value: FactionVal.Evil });
    this.world.addComponent(eid, Layer, { value: layerStrToVal(layer) });

    return eid;
  }

  /**
   * 创建基地实体。
   */
  createBaseEntity(x: number, y: number, tileSize: number): number | null {
    const base = this.createBase('base', x, y, undefined, tileSize);
    if (!base) return null;

    const { eid } = base;
    this.world.addComponent(eid, PlayerOwned);
    this.world.addComponent(eid, Faction, { value: FactionVal.Justice });
    this.world.addComponent(eid, Category, { value: CategoryVal.Objective });

    return eid;
  }

  /**
   * 创建出生点标记。
   */
  createSpawnPoint(x: number, y: number): number | null {
    const base = this.createBase('spawn_point', x, y);
    if (!base) return null;
    return base.eid;
  }

  /**
   * 单纯创建一个基础实体（不加类型组件），供外部自行组装。
   */
  createRaw(configId: string, x: number, y: number, gridPos?: { row: number; col: number }): number | null {
    const base = this.createBase(configId, x, y, gridPos);
    return base?.eid ?? null;
  }
}
