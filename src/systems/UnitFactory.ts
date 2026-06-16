// ============================================================
// UnitFactory — 统一的实体创建工厂（bitecs SoA 风格）
//
// 所有单位实体（塔/陷阱/士兵）均通过此工厂创建。
// 配置统一从 gameData.ts 的扁平配置对象读取。
// ============================================================

import type { TowerWorld } from '../core/World.js';
import { TowerType, UnitType, type UnitVisualParts } from '../types/index.js';
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
  Barrel,
  LightningStormSkill,
} from '../core/components.js';
import { ruleEngine } from '../core/RuleEngine.js';
import {
  TOWER_CONFIGS,
  UNIT_CONFIGS,
  TRAP_CONFIGS,
  TRAP_TYPE_VAL,
} from '../data/gameData.js';
import { shapeTypeToVal, hexToRgb, layerStrToVal } from '../utils/visualHelpers.js';
import { soldierCanTargetLowAir, towerCanTargetLowAir } from '../utils/lowAirTargeting.js';

// ============================================================
// 映射表
// ============================================================

/** TowerType 枚举 → TOWER_CONFIGS key */
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

/** TowerType 枚举 → YAML unit config id */
const TOWER_CONFIG_ID: Record<TowerType, string> = {
  [TowerType.Arrow]: 'arrow_tower',
  [TowerType.Cannon]: 'cannon_tower',
  [TowerType.Ice]: 'ice_tower',
  [TowerType.Lightning]: 'lightning_tower',
  [TowerType.Laser]: 'laser_tower',
  [TowerType.Bat]: 'bat_tower',
  [TowerType.Missile]: 'missile_tower',
  [TowerType.Fire]: 'fire_tower',
  [TowerType.Poison]: 'poison_tower',
  [TowerType.Ballista]: 'ballista_tower',
};

/** YAML targetSelection 字符串 → TargetSelectionVal 数字 */
function targetSelectionStrToVal(sel: string | undefined): number {
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
function damageTypeStrToVal(dt: string | undefined): number {
  switch (dt) {
    case 'true': return DamageTypeVal.True;
    case 'magical':
    case 'magic': return DamageTypeVal.Magic;
    default: return DamageTypeVal.Physical;
  }
}

function attackModeStrToVal(mode: string | undefined, splashRadius: number): number {
  switch (mode) {
    case 'aoe_splash': return AttackModeVal.AoeSplash;
    case 'heal': return AttackModeVal.Heal;
    case 'chain': return AttackModeVal.Chain;
    case 'piercing': return AttackModeVal.Piercing;
    default: return splashRadius > 0 ? AttackModeVal.AoeSplash : AttackModeVal.SingleTarget;
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

  // ============================================================
  // 内部基础创建 — 接收扁平 config 对象
  // ============================================================

  /**
   * 从扁平配置创建基础实体（Position + GridOccupant + Health + Visual + UnitTag + displayName）。
   * 各 create* 方法在此基础上追加类型特有组件。
   */
  private createBase(
    cfg: Record<string, unknown>,
    x: number,
    y: number,
    gridPos?: { row: number; col: number },
    tileSize?: number,
  ): { eid: number; cfg: Record<string, unknown> } | null {
    const eid = this.world.createEntity();

    // Position
    this.world.addComponent(eid, Position, { x, y });

    // GridOccupant
    if (gridPos) {
      this.world.addComponent(eid, GridOccupant, { row: gridPos.row, col: gridPos.col });
    }

    // Health
    const hp = (cfg.hp as number) ?? 0;
    if (hp > 0) {
      this.world.addComponent(eid, Health, {
        current: hp,
        max: hp,
        armor: (cfg.defense as number) ?? 0,
        magicResist: (cfg.magicResist as number) ?? 0,
      });
    }

    // Visual
    const color = (cfg.color as string) ?? '#888888';
    const rgb = hexToRgb(color);
    const shapeStr = (cfg.shape as string) ?? 'rect';
    const baseSize = tileSize ? tileSize * 0.65 : ((cfg.size as number) ?? 32);
    this.world.addComponent(eid, Visual, {
      shape: shapeTypeToVal(shapeStr as never),
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      size: baseSize,
      alpha: 1,
      outline: ((cfg.outline as boolean | undefined) ?? true) ? 1 : 0,
      hitFlashTimer: 0,
      idlePhase: 0,
      facing: 1,
      bobPhase: 0,
      breathPhase: Math.random() * Math.PI * 2,
      attackAnimTimer: 0,
      attackAnimDuration: (cfg.attackAnimDuration as number) ?? 0.3,
      partsId: 0,
    });
    const visualParts = cfg.visualParts as UnitVisualParts | undefined;
    if (visualParts) {
      Visual.partsId[eid] = this.world.registerUnitVisualParts(visualParts);
    }

    // UnitTag
    const cost = (cfg.cost as number) ?? 0;
    const popCost = (cfg.popCost as number) ?? 0;
    const maxLevel = (cfg.maxLevel as number) ?? 3;
    this.world.addComponent(eid, UnitTag, {
      isEnemy: 0,
      isElite: 0,
      isBoss: 0,
      isRanged: 0,
      canAttackBuildings: 0,
      rewardGold: 0,
      rewardEnergy: 0,
      popCost,
      cost,
      atk: (cfg.atk as number) ?? 0,
      level: 1,
      maxLevel,
      totalInvested: cost,
      unitTypeNum: 0,
    });

    // Display name
    this.world.setDisplayName(eid, cfg.name as string ?? '');

    return { eid, cfg };
  }

  // ============================================================
  // 公开创建方法
  // ============================================================

  /**
   * 创建塔实体。
   * 包含：Attack/BatTower + Tower + PlayerOwned + BuildingTower + Category/Faction/Layer
   */
  createTower(
    towerType: TowerType,
    x: number,
    y: number,
    gridPos: { row: number; col: number },
    opts: { tileSize: number; towerTypeNum: number },
  ): number | null {
    const cfg = TOWER_CONFIGS[towerType] as unknown as Record<string, unknown>;
    if (!cfg) {
      console.error(`UnitFactory: tower config not found: ${towerType}`);
      return null;
    }

    const base = this.createBase(cfg, x, y, gridPos, opts.tileSize);
    if (!base) return null;
    const { eid } = base;

    const isBatTower = towerType === TowerType.Bat;
    Visual.outline[eid] = (cfg.outline as boolean | undefined) === true ? 1 : 0;

    // Tower component
    this.world.addComponent(eid, Tower, {
      towerType: opts.towerTypeNum,
      level: 1,
      totalInvested: (cfg.cost as number) ?? 0,
    });
    ruleEngine.registerEntityConfig(eid, TOWER_CONFIG_ID[towerType]);

    // Attack or BatTower
    if (isBatTower) {
      this.world.addComponent(eid, BatTower, {
        maxBats: (cfg.batCount as number) ?? 4,
        replenishCooldown: (cfg.batReplenishCD as number) ?? 12,
        replenishTimer: 0,
        batDamage: (cfg.batDamage as number) ?? (cfg.atk as number) ?? 0,
        batAttackRange: (cfg.batAttackRange as number) ?? (cfg.range as number) ?? 0,
        batAttackSpeed: (cfg.batAttackSpeed as number) ?? (cfg.attackSpeed as number) ?? 0,
        batHp: (cfg.batHP as number) ?? 30,
        batSpeed: (cfg.batSpeed as number) ?? 120,
        batSize: (cfg.batSize as number) ?? 10,
      });
    } else {
      this.world.addComponent(eid, Attack, {
        damage: (cfg.atk as number) ?? 0,
        attackSpeed: (cfg.attackSpeed as number) ?? 1,
        range: (cfg.range as number) ?? 100,
        damageType: damageTypeStrToVal(cfg.damageType as string),
        cooldownTimer: 0,
        targetId: 0,
        targetSelection: TargetSelectionVal.Nearest,
        attackMode: towerType === TowerType.Missile ? AttackModeVal.AoeSplash : ((cfg.splashRadius as number) ?? 0) > 0 ? AttackModeVal.AoeSplash : AttackModeVal.SingleTarget,
        isRanged: 1,
        canTargetLowAir: ((cfg.canTargetLowAir as boolean | undefined) ?? towerCanTargetLowAir(towerType)) ? 1 : 0,
        splashRadius: (cfg.splashRadius as number) ?? 0,
        chainCount: (cfg.chainCount as number) ?? 0,
        chainRange: (cfg.chainRange as number) ?? 0,
        chainDecay: (cfg.chainDecay as number) ?? 0,
        drainPercent: 0,
        alertRange: ((cfg.range as number) ?? 100) * 2,
        tauntCapacity: 0,
        attackerCount: 0,
      });

      if (towerType === TowerType.Lightning) {
        const cooldown = (cfg.lightningStormCooldown as number | undefined) ?? 10;
        this.world.addComponent(eid, LightningStormSkill, {
          cooldown,
          timer: cooldown,
        });
      }
    }

    // PlayerOwned
    this.world.addComponent(eid, PlayerOwned);

    // Category / Faction / Layer
    this.world.addComponent(eid, Category, { value: CategoryVal.Tower });
    this.world.addComponent(eid, Faction, { value: FactionVal.Justice });
    this.world.addComponent(eid, Layer, { value: LayerVal.Ground });

    // Barrel — 仅 Cannon 塔有炮管视觉
    if (towerType === TowerType.Cannon) {
      this.world.addComponent(eid, Barrel, {
        angle: 0,
        targetAngle: 0,
        length: ((cfg.size as number) ?? (opts.tileSize * 0.65)) * 0.55,
        width: 6,
      });
    }

    // BuildingTower — 建造中状态
    const buildTime = (cfg.buildTime as number) ?? 2.0;
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
    trapTypeId: string,
    x: number,
    y: number,
    gridPos: { row: number; col: number },
  ): number | null {
    const cfg = TRAP_CONFIGS[trapTypeId] as unknown as Record<string, unknown>;
    if (!cfg) {
      console.error(`UnitFactory: trap config not found: ${trapTypeId}`);
      return null;
    }

    const base = this.createBase(cfg, x, y, gridPos);
    if (!base) return null;
    const { eid } = base;
    Visual.outline[eid] = (cfg.outline as boolean | undefined) === true ? 1 : 0;

    // Trap component
    const trapTypeStr = (cfg.type as string) ?? 'SpikeTrap';
    const trapTypeVal = TRAP_TYPE_VAL[trapTypeStr] ?? TrapTypeVal.SpikeTrap;
    this.world.addComponent(eid, Trap, {
      trapType: trapTypeVal,
      damagePerSecond: (cfg.damagePerSecond as number) ?? 0,
      radius: (cfg.radius as number) ?? 0,
      cooldown: (cfg.cooldown as number) ?? 0,
      cooldownTimer: 0,
      animTimer: 0,
      animDuration: 0.4,
      triggerCount: 0,
      maxTriggers: (cfg.maxTriggers as number) ?? 0,
      direction: 0,
      stunDuration: (cfg.stunDuration as number) ?? 0,
      damage: (cfg.damage as number) ?? 0,
    });

    // Attack — 陷阱也需要 Attack 组件让 TrapSystem 检测范围
    this.world.addComponent(eid, Attack, {
      damage: (cfg.damagePerSecond as number) ?? 0,
      attackSpeed: 1,
      range: (cfg.radius as number) ?? 32,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: TargetSelectionVal.Nearest,
      attackMode: AttackModeVal.SingleTarget,
      isRanged: 0,
      canTargetLowAir: 0,
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
    const layer = (cfg.layer as string) ?? 'AboveGrid';
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
    unitType: UnitType,
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
    const cfg = UNIT_CONFIGS[unitType] as unknown as Record<string, unknown>;
    if (!cfg) {
      console.error(`UnitFactory: soldier config not found: ${unitType}`);
      return null;
    }

    const base = this.createBase(cfg, x, y, gridPos);
    if (!base) return null;
    const { eid } = base;

    // 更新 UnitTag 的 unitTypeNum
    UnitTag.unitTypeNum[eid] = opts.unitTypeNum;

    // 更新 Visual 的 partsId、outline
    const visualParts = opts.visualParts ?? (cfg.visualParts as UnitVisualParts | undefined);
    if (visualParts && opts.registerVisualParts) {
      Visual.partsId[eid] = opts.registerVisualParts(visualParts);
    }
    Visual.outline[eid] = 1;

    // Attack
    const splashRadius = (cfg.splashRadius as number) ?? 0;
    const attackMode = attackModeStrToVal(cfg.attackMode as string, splashRadius);
    const attackRange = (cfg.attackRange as number) ?? 50;
    this.world.addComponent(eid, Attack, {
      damageType: damageTypeStrToVal(cfg.damageType as string),
      damage: (cfg.atk as number) ?? 0,
      attackSpeed: (cfg.attackSpeed as number) ?? 1,
      range: attackRange,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: targetSelectionStrToVal(cfg.targetSelection as string),
      attackMode,
      isRanged: attackRange > 80 ? 1 : 0,
      canTargetLowAir: ((cfg.canTargetLowAir as boolean | undefined) ?? soldierCanTargetLowAir(unitType)) ? 1 : 0,
      splashRadius,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
      alertRange: ((cfg.alertRange as number) ?? 0) > 0 ? (cfg.alertRange as number) : attackRange * 2,
      tauntCapacity: (cfg.tauntCapacity as number) ?? 0,
      attackerCount: 0,
    });

    // Movement
    const speed = (cfg.speed as number) ?? 60;
    const moveRange = (cfg.moveRange as number) ?? 200;
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
}
