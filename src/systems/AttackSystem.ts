import { TowerWorld, type System, defineQuery, entityExists, hasComponent } from '../core/World.js';
import {
  Position,
  Attack,
  Tower,
  Projectile,
  Visual,
  Health,
  LightningBolt,
  LaserBeam,
  UnitTag,
  ShapeVal,
  Layer,
  LayerVal,
  DamageTypeVal,
  MissileCharge,
  TargetingMark,
  BuildingTower,
  Faction,
  Barrel,
} from '../core/components.js';
import { TowerType } from '../types/index.js';
import type { MapConfig } from '../types/index.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { Sound } from '../utils/Sound.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { areHostile } from '../utils/factionUtils.js';
import type { WeatherSystem } from './WeatherSystem.js';
import { getEffectiveValue } from './BuffSystem.js';
import { ruleEngine } from '../core/RuleEngine.js';

// ============================================================
// TowerType numeric ID → enum mapping (ui8 values)
// ============================================================

const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
  TowerType.Missile,   // 6
  TowerType.Fire,      // 7
  TowerType.Poison,    // 8
  TowerType.Ballista,  // 9
];

// ============================================================
// Projectile visual presets (replaces PROJECTILE_CFG)
// ============================================================

interface ProjectileVisual {
  speed: number;
  shape: number;   // ShapeVal
  colorR: number;
  colorG: number;
  colorB: number;
  size: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const ARROW_COLOR    = hexToRgb('#ff3333');
const CANNON_COLOR   = hexToRgb('#222222');
const ICE_COLOR      = hexToRgb('#81d4fa');
const LIGHTNING_COLOR = hexToRgb('#fff176');
const LASER_COLOR    = hexToRgb('#e040fb');
const BAT_COLOR      = hexToRgb('#7c4dff');

const BALLISTA_COLOR = hexToRgb('#2196f3'); // 蓝色脉冲弩箭

const PROJ_VISUAL: Record<number, ProjectileVisual> = {
  0: { speed: 420, shape: ShapeVal.Arrow,    colorR: ARROW_COLOR[0],    colorG: ARROW_COLOR[1],    colorB: ARROW_COLOR[2],    size: 24 },
  1: { speed: 280, shape: ShapeVal.Circle,   colorR: 0x1a,              colorG: 0x1a,              colorB: 0x1a,              size: 18 },
  2: { speed: 350, shape: ShapeVal.Diamond,  colorR: ICE_COLOR[0],      colorG: ICE_COLOR[1],      colorB: ICE_COLOR[2],      size: 12 },
  3: { speed: 600, shape: ShapeVal.Triangle, colorR: LIGHTNING_COLOR[0], colorG: LIGHTNING_COLOR[1], colorB: LIGHTNING_COLOR[2], size: 10 },
  4: { speed: 500, shape: ShapeVal.Circle,   colorR: LASER_COLOR[0],    colorG: LASER_COLOR[1],    colorB: LASER_COLOR[2],    size: 8 },
  5: { speed: 350, shape: ShapeVal.Triangle, colorR: BAT_COLOR[0],      colorG: BAT_COLOR[1],      colorB: BAT_COLOR[2],      size: 10 },
  6: { speed: 280, shape: ShapeVal.Arrow,    colorR: 0x1a,              colorG: 0x1a,              colorB: 0x1a,              size: 40 },
  7: { speed: 350, shape: ShapeVal.Circle,   colorR: 0xff,              colorG: 0x57,              colorB: 0x22,              size: 10 },
  8: { speed: 280, shape: ShapeVal.Circle,   colorR: 0x66,              colorG: 0xbb,              colorB: 0x6a,              size: 8 },
  9: { speed: 280, shape: ShapeVal.Arrow,    colorR: BALLISTA_COLOR[0], colorG: BALLISTA_COLOR[1], colorB: BALLISTA_COLOR[2], size: 90 },
};

// ============================================================
// Queries
// ============================================================

const towerQuery = defineQuery([Position, Attack, Tower]);
const potentialTargetQuery = defineQuery([Position, Health, UnitTag]);
const chargingQuery = defineQuery([MissileCharge]);
const targetingMarkQuery = defineQuery([TargetingMark, Position]);
const projectileQueryForCleanup = defineQuery([Projectile]);
const laserBeamQuery = defineQuery([LaserBeam]);

// ============================================================
// AttackSystem — towers find nearest enemy and fire
// ============================================================

export class AttackSystem implements System {
  readonly name = 'AttackSystem';

  constructor(
    private weatherSystem?: WeatherSystem,
    private map?: MapConfig,
  ) {}

  update(world: TowerWorld, dt: number): void {
    // Clean up orphaned targeting marks (tower destroyed during charging)
    this.cleanupOrphanedTargetingMarks(world);

    const towers = towerQuery(world.world);

    for (const eid of towers) {
      // 建造中的塔不参与攻击逻辑
      if (hasComponent(world.world, BuildingTower, eid)) continue;
      const towerTypeVal = Tower.towerType[eid]!;

      // 蝙蝠塔由 BatSwarmSystem 处理
      if (towerTypeVal === 5) continue;

      // ── 炮管平滑旋转（始终执行，不受冷却限制）──
      if (hasComponent(world.world, Barrel, eid)) {
        const range = Attack.range[eid]!;
        const enemies = findEnemiesInRange(world, eid, range);
        if (enemies.length > 0) {
          const targetPos = enemies[0]!;
          const tx = Position.x[targetPos.id]!;
          const ty = Position.y[targetPos.id]!;
          const px = Position.x[eid]!;
          const py = Position.y[eid]!;
          Barrel.targetAngle[eid] = Math.atan2(ty - py, tx - px);
        }

        const currentAngle = Barrel.angle[eid]!;
        const targetAngle = Barrel.targetAngle[eid]!;
        let diff = targetAngle - currentAngle;
        // 归一化到 [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const rotateSpeed = 8; // 弧度/秒
        const maxRotation = rotateSpeed * dt;
        if (Math.abs(diff) <= maxRotation) {
          Barrel.angle[eid] = targetAngle;
        } else {
          Barrel.angle[eid] = currentAngle + Math.sign(diff) * maxRotation;
        }
      }

      // Tick cooldown
      if (Attack.cooldownTimer[eid]! > 0) {
        Attack.cooldownTimer[eid]! -= dt;
        continue;
      }

      // Find enemies in range
      const range = Attack.range[eid]!;
      const enemies = findEnemiesInRange(world, eid, range);
      if (enemies.length === 0) continue;

      // Fire based on tower type
      const level = Tower.level[eid] ?? 1;
      const primaryTarget = enemies[0]!.id;
      switch (towerTypeVal) {
        case 0: {
          // Arrow → multi-shot: L1: 1箭, L2: 2箭, L3: 3箭（可锁不同目标）
          const arrowCfg = TOWER_CONFIGS[TowerType.Arrow];
          const configuredCount = arrowCfg.projectileCount?.[level - 1]
            ?? arrowCfg.projectileCount?.[arrowCfg.projectileCount.length - 1]
            ?? 1;
          const arrowCount = Math.min(configuredCount, enemies.length);
          for (let i = 0; i < arrowCount; i++) {
            const target = enemies[i]!.id;
            spawnProjectile(world, eid, target, towerTypeVal);
          }
          break;
        }
        case 1: case 2: case 7: case 8: case 9:
          // Cannon/Ice/Fire/Poison/Ballista → single projectile
          spawnProjectile(world, eid, primaryTarget, towerTypeVal);
          break;
        case 3:
          // Lightning → chain attack (damage + LightningBolt visual)
          doLightningAttack(world, eid, primaryTarget, level);
          break;
        case 4:
          // Laser → beam attack
          doLaserAttack(world, eid, enemies, level);
          break;
        case 6: {
          // Missile → multi-shot: L1: 1枚, L2: 2枚, L3: 3枚
          const missileCfg = TOWER_CONFIGS[TowerType.Missile];
          const missileCount = missileCfg.projectileCount?.[level - 1]
            ?? missileCfg.projectileCount?.[missileCfg.projectileCount.length - 1]
            ?? 1;
          // 使用塔的实际溅射半径作为预览标记半径（与弹体爆炸范围一致）
          const actualSplashRadius = Attack.splashRadius[eid]
            ?? ((missileCfg?.splashRadius as number) ?? 120);
          for (let i = 0; i < missileCount; i++) {
            const target = enemies[i]?.id ?? primaryTarget;
            const tx = Position.x[target]!;
            const ty = Position.y[target]!;
            const markId = world.createEntity();
            world.addComponent(markId, Position, { x: tx, y: ty });
            world.addComponent(markId, TargetingMark, {
              blastRadius: actualSplashRadius,
              pulsePhase: 0,
              ringRotation: 0,
            });
            spawnMissileProjectile(world, eid, markId, tx, ty);
          }
          break;
        }
      }

      ruleEngine.dispatch(world.world, eid, 'onAttack', {
        time: performance.now() / 1000,
        sourceId: primaryTarget,
        data: { towerType: towerTypeVal, level },
      });

      // Trigger tower attack animation (brief brighten pulse)
      Visual.attackAnimTimer[eid] = 0.25;
      Visual.attackAnimDuration[eid] = 0.25;

      // Reset cooldown
      Attack.cooldownTimer[eid]! = 1.0 / Attack.attackSpeed[eid]!;
    }
  }

  // ---- Orphan cleanup ----

  private cleanupOrphanedTargetingMarks(world: TowerWorld): void {
    const marks = targetingMarkQuery(world.world);
    if (marks.length === 0) return;

    const referencedMarks = new Set<number>();
    const charging = chargingQuery(world.world);
    for (const towerId of charging) {
      const markId = MissileCharge.markEntityId[towerId];
      if (markId !== undefined && markId !== 0) {
        referencedMarks.add(markId);
      }
    }

    // Walk live projectile entities via the active query (NOT the raw typed array —
    // bitecs leaves stale data on destroyed eids, which would keep marks alive forever).
    for (const pid of projectileQueryForCleanup(world.world)) {
      if (!entityExists(world.world, pid)) continue;
      if (!hasComponent(world.world, Projectile, pid)) continue;
      if (Projectile.sourceTowerType[pid] !== 6) continue;
      const tgt = Projectile.targetId[pid];
      if (tgt !== undefined && tgt !== 0) {
        referencedMarks.add(tgt);
      }
    }

    for (const markId of marks) {
      if (!referencedMarks.has(markId)) {
        world.destroyEntity(markId);
      }
    }
  }

  // ---- Missile Tower: charging + targeting mark + launch ----

  /**
   * @deprecated 自 P3 R5 起 BT v1.0 三节点 (select_missile_target /
   * charge_attack / launch_missile_projectile) 完整接管导弹塔行为，
   * 此方法薄化为 no-op 保持 line 158-161 dispatch 结构兼容（避免删除
   * 引入级联改动）。R6 验证全绿后可整体删除 dispatch + 此方法。
   */
  private handleMissileTower(
    _world: TowerWorld,
    _towerId: number,
    _enemyList: number[],
    _dt: number,
  ): void {}

  // ---- Projectile ----

  private spawnProjectile(
    world: TowerWorld,
    towerId: number,
    targetId: number,
    towerTypeVal: number,
  ): void {
    const visual = PROJ_VISUAL[towerTypeVal];
    if (!visual) return;

    const damage = this.getDamage(towerId);
    const fromX = Position.x[towerId];
    const fromY = Position.y[towerId];
    const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal]!;
    const towerCfg = TOWER_CONFIGS[towerTypeEnum];

    const pid = world.createEntity();

    world.addComponent(pid, Position, { x: fromX, y: fromY });

    world.addComponent(pid, Projectile, {
      speed: visual.speed,
      damage,
      damageType: Attack.damageType[towerId],
      targetId,
      sourceId: towerId,
      fromX,
      fromY,
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      splashRadius: towerCfg?.splashRadius ?? 0,
      stunDuration: towerCfg?.stunDuration ?? 0,
      slowPercent: towerCfg?.slowPercent ?? 0,
      slowMaxStacks: towerCfg?.slowMaxStacks ?? 0,
      freezeDuration: towerCfg?.freezeDuration ?? 0,
      chainCount: towerCfg?.chainCount ?? 0,
      chainRange: towerCfg?.chainRange ?? 0,
      chainDecay: towerCfg?.chainDecay ?? 0,
      sourceTowerType: towerTypeVal,
    });

    world.addComponent(pid, Visual, {
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      alpha: 1,
    });

    // Inherit layer from source entity for render z-ordering (方案 B: 弹道随来源层级)
    const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
    world.addComponent(pid, Layer, { value: sourceLayer });
  }

  private spawnMissileProjectile(
    world: TowerWorld,
    towerId: number,
    targetMarkId: number,
    targetX: number,
    targetY: number,
  ): void {
    spawnMissileProjectile(world, towerId, targetMarkId, targetX, targetY);
  }

  // ---- Damage ----

  private getDamage(eid: number): number {
    const raw = Attack.damage[eid]!;
    const buff = getEffectiveValue(eid, 'atk');
    return (raw + buff.absolute) * (1 + buff.percent / 100);
  }

  // ---- Layer reachability ----

  /**
   * Check whether an attacker at `attackerLayer` can target a unit at `targetLayer`.
   *
   * 对应设计 design/03-units.md §2.0 低空攻击规则:
   * - 近战 (isRanged=false): only AboveGrid + Ground
   * - 远程 (isRanged=true): AboveGrid + Ground
   * - canTargetLowAir=true: 可额外攻击 LowAir
   * - LowAir attackers (蝙蝠、飞行敌): can attack all ≤ LowAir
   * - BelowGrid 目标默认不可被 Ground/AboveGrid/LowAir 命中，后续地下攻击可通过特殊攻击者层扩展
   *
   * P1-#12: 提为 static 便于纯函数单测覆盖。
   */
  static canAttackLayer(attackerLayer: number, targetLayer: number, isRanged: boolean, canTargetLowAir = false): boolean {
    if (attackerLayer === LayerVal.Ground || attackerLayer === LayerVal.AboveGrid) {
      if (targetLayer === LayerVal.Ground || targetLayer === LayerVal.AboveGrid) return true;
      if (targetLayer === LayerVal.LowAir) return isRanged && canTargetLowAir;
      return false;
    }
    if (attackerLayer === LayerVal.LowAir) {
      return targetLayer === LayerVal.Ground
        || targetLayer === LayerVal.AboveGrid
        || targetLayer === LayerVal.LowAir;
    }
    return true;
  }

  /**
   * Validate whether attackerEid can target targetEid using the 4-faction system
   * combined with alive check and layer reachability.
   *
   * Checks (in order):
   *   1. Faction hostility via areHostile()
   *   2. Target is alive (Health.current > 0)
   *   3. Layer reachability via canAttackLayer()
   *
   * Returns false if either entity lacks Faction/Health/Layer components.
   */
  static isValidTarget(world: TowerWorld, attackerEid: number, targetEid: number): boolean {
    const attackerFaction = Faction.value[attackerEid];
    const targetFaction = Faction.value[targetEid];
    if (attackerFaction === undefined || targetFaction === undefined) return false;
    if (!areHostile(attackerFaction, targetFaction)) return false;

    if ((Health.current[targetEid] ?? 0) <= 0) return false;

    const attackerLayer = Layer.value[attackerEid] ?? LayerVal.Ground;
    const targetLayer = Layer.value[targetEid] ?? LayerVal.Ground;
    const isRanged = (Attack.isRanged[attackerEid] ?? 0) === 1;
    const canTargetLowAir = (Attack.canTargetLowAir[attackerEid] ?? 0) === 1;
    if (!AttackSystem.canAttackLayer(attackerLayer, targetLayer, isRanged, canTargetLowAir)) return false;

    return true;
  }

  // ---- Lightning Chain ----

  private doLightningAttack(
    world: TowerWorld,
    towerId: number,
    primaryId: number,
    level: number,
  ): void {
    const config = TOWER_CONFIGS[TowerType.Lightning];
    if (!config) return;

    const baseDamage = this.getDamage(towerId);
    const chainCount = config.chainCountByLevel?.[level - 1]
      ?? config.chainCountByLevel?.[config.chainCountByLevel.length - 1]
      ?? ((config.chainCount ?? 3) + (level - 1));
    const chainDecay = config.chainDecay ?? 0.2;
    const chainRange = config.chainRange ?? 120;

    const hit = new Set<number>();
    let dmg = baseDamage;
    let sourceId = towerId;
    let targetId = primaryId;

    for (let hop = 0; hop < chainCount; hop++) {
      if (hit.has(targetId)) break;
      hit.add(targetId);

      // Deal damage
      if (Health.current[targetId]! > 0 && AttackSystem.isValidTarget(world, towerId, targetId)) {
        const dmgType = Attack.damageType[towerId] ?? DamageTypeVal.Physical;
        applyDamageToTarget(world, targetId, dmg, dmgType);
      }

      // Hit flash
      Visual.hitFlashTimer[targetId] = 0.12;

      // Lightning bolt visual
      this.spawnLightningBolt(world, sourceId, targetId, hop);

      // Sound: only play hit sound on first hop to avoid noise overload
      if (hop === 0) {
        Sound.play('lightning_hit');
      }

      // Advance source to current target for next bolt
      sourceId = targetId;

      // Find next chain target
      if (hop < chainCount - 1) {
        dmg *= (1 - chainDecay);

        const originX = Position.x[targetId]!;
        const originY = Position.y[targetId]!;
        let nearestId = 0;
        let nearestDist = chainRange;

        const allMatches = potentialTargetQuery(world.world);
        const towerFaction = Faction.value[towerId]!;
        for (const eid of allMatches) {
          if (hit.has(eid)) continue;
          const tf = Faction.value[eid];
          if (tf === undefined || !areHostile(towerFaction, tf)) continue;
          if ((Health.current[eid] ?? 0) <= 0) continue;
          if (!AttackSystem.isValidTarget(world, towerId, eid)) continue;

          const ex = Position.x[eid]!;
          const ey = Position.y[eid]!;
          const dx = ex - originX;
          const dy = ey - originY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestId = eid;
          }
        }
        targetId = nearestId !== 0 ? nearestId : targetId;
      }
    }
  }

  private spawnLightningBolt(
    world: TowerWorld,
    sourceId: number,
    targetId: number,
    chainIndex: number,
  ): void {
    const bid = world.createEntity();
    world.addComponent(bid, LightningBolt, {
      sourceId,
      targetId,
      damage: 0,
      duration: 0.5,
      elapsed: 0,
      chainIndex,
    });
  }

  // ---- Laser Beam ----

  private doLaserAttack(
    world: TowerWorld,
    towerId: number,
    enemiesInRange: Array<{ id: number; dist: number }>,
    level: number,
  ): void {
    if (hasActiveLaserBeam(world, towerId)) return;
    const target = enemiesInRange[0];
    if (!target) return;
    const maxDamage = this.getDamage(towerId);
    // 激光束初始伤害 = maxDamage × 10%（beam 开始时伤害最低，smoothstep 递增）
    const initialDamage = maxDamage * 0.1;

    const beamId = world.createEntity();
    world.addComponent(beamId, LaserBeam, {
      sourceId: towerId,
      targetId: target.id,
      damage: initialDamage,
      maxDamage,
      duration: 5.0,
      elapsed: 0,
    });
  }
}

/**
 * 计算 entity 的有效攻击力（基础 Attack.damage + BuffSystem absolute/percent 加成）。
 *
 * 公式：damage = (Attack.damage[eid] + buff.absolute) * (1 + buff.percent / 100)
 * 由 LaunchMissileProjectileNode 和 AttackSystem 共用，与 AttackSystem.getDamage
 * 私有方法等价（R5 后 AttackSystem 路径删除，此函数为唯一真理源）。
 */
export function getEffectiveDamage(eid: number): number {
  const raw = Attack.damage[eid]!;
  const buff = getEffectiveValue(eid, 'atk');
  return (raw + buff.absolute) * (1 + buff.percent / 100);
}

/** 导弹塔抛物线物理常量：重力加速度（px/s²） */
export const MISSILE_GRAVITY = 400;

/**
 * 计算导弹抛物线锁定参数（design/19-missile-tower §X/Y 参数化）。
 *
 * 推导：y(t) = fromY + vyInitial*t + 0.5*g*t²，令 y(totalTime)=targetY 反解 vyInitial。
 * X 恒速 → totalTime = |dx|/speed；dx≈0 时退化为 |dx|=1 像素的最短飞行时间避免除零。
 *
 * 由 spawnMissileProjectile 与测试 helper 共用，保证测试与生产代码物理一致。
 */
export function computeMissileParabola(
  fromX: number, fromY: number,
  targetX: number, targetY: number,
  speed: number,
): { totalTime: number; vyInitial: number } {
  const dx = targetX - fromX;
  const totalTime = Math.max(Math.abs(dx), 1) / speed;
  const vyInitial = (targetY - fromY - 0.5 * MISSILE_GRAVITY * totalTime * totalTime) / totalTime;
  return { totalTime, vyInitial };
}

/**
 * 生成导弹塔抛物线投射物（design/23 §0.5 launch_missile_projectile 节点核心副作用）。
 *
 * 与 AttackSystem.spawnMissileProjectile 私有方法等价：使用 PROJ_VISUAL[6] 视觉配置，
 * 读取 BuffSystem 加成后的有效攻击力，挂载 Projectile + Visual + Layer 组件。
 * targetMarkId 指向 ChargeAttackNode spawn 的 TargetingMark 实体，ProjectileSystem
 * 据此计算抛物线终点并触发 AOE 爆炸（splashRadius 从 Attack 组件读取，fallback 120px）。
 */
export function spawnMissileProjectile(
  world: TowerWorld,
  towerId: number,
  targetMarkId: number,
  _targetX: number,
  _targetY: number,
): void {
  const visual = PROJ_VISUAL[6];
  if (!visual) return;

  const damage = getEffectiveDamage(towerId);
  const fromX = Position.x[towerId]!;
  const fromY = Position.y[towerId]!;
  const towerCfg = TOWER_CONFIGS[TowerType.Missile];

  const targetX = Position.x[targetMarkId] ?? fromX;
  const targetY = Position.y[targetMarkId] ?? fromY;
  const { totalTime, vyInitial } = computeMissileParabola(fromX, fromY, targetX, targetY, visual.speed);

  const pid = world.createEntity();
  world.addComponent(pid, Position, { x: fromX, y: fromY });
  world.addComponent(pid, Projectile, {
    speed: visual.speed,
    damage,
    damageType: Attack.damageType[towerId],
    targetId: targetMarkId,
    sourceId: towerId,
    fromX,
    fromY,
    shape: visual.shape,
    colorR: visual.colorR,
    colorG: visual.colorG,
    colorB: visual.colorB,
    size: visual.size,
    splashRadius: (Attack.splashRadius[towerId] !== undefined && Attack.splashRadius[towerId]! > 0)
      ? Attack.splashRadius[towerId]!
      : (towerCfg?.splashRadius ?? 120),
    stunDuration: 0,
    slowPercent: 0,
    slowMaxStacks: 0,
    freezeDuration: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    sourceTowerType: 6,
    targetX,
    targetY,
    flightTime: 0,
    totalTime,
    vyInitial,
  });

  world.addComponent(pid, Visual, {
    shape: visual.shape,
    colorR: visual.colorR,
    colorG: visual.colorG,
    colorB: visual.colorB,
    size: visual.size,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
  });

  const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
  world.addComponent(pid, Layer, { value: sourceLayer });
}

// ============================================================
// P4 R1 — 非-missile 塔攻击工具函数（BT 节点依赖）
// ============================================================
//
// 这 3 个函数将 AttackSystem 类的私有 spawnProjectile / doLightningAttack /
// doLaserAttack 提取为模块级 export，供 BT 节点（SpawnProjectileTowerNode /
// LightningChainNode / LaserBeamNode）调用。语义与原私有方法等价（damage 公式 /
// 弹道视觉 / chain 衰减 / laser 多束逻辑保持一致），仅去除 `this` 依赖以便从
// BehaviorTree.ts 直接 import。R6 完成后，AttackSystem.update 中的私有方法
// 调用将被薄化为 no-op dispatch（类比 P3 R5 handleMissileTower）。

/**
 * 生成通用塔弹道投射物（design/23 §0.5 `spawn_projectile_tower` 节点核心副作用）。
 *
 * 服务 basic/cannon/ice/bat 4 塔。读 PROJ_VISUAL[towerTypeVal] 视觉配置 + TOWER_CONFIGS
 * 修饰属性（splashRadius / slowPercent / stunDuration / freezeDuration / chainCount /
 * chainRange / chainDecay），挂载 Projectile + Visual + Layer 组件。命中时由
 * ProjectileSystem 执行 splash/slow/stun/freeze/chain 副作用。
 *
 * 与 AttackSystem.spawnProjectile 私有方法等价（R5 后私有路径将清零，此函数为唯一真理源）。
 */
export function spawnProjectile(
  world: TowerWorld,
  towerId: number,
  targetId: number,
  towerTypeVal: number,
): void {
  const visual = PROJ_VISUAL[towerTypeVal];
  if (!visual) return;

  const damage = getEffectiveDamage(towerId);

  // ── 仅炮塔（Cannon, type=1）从炮管尖端发射 + 抛物线轨迹 ──
  let fromX = Position.x[towerId]!;
  let fromY = Position.y[towerId]!;
  const isCannon = towerTypeVal === 1;
  if (isCannon && hasComponent(world.world, Barrel, towerId)) {
    const barrelAngle = Barrel.angle[towerId]!;
    const barrelLen = Barrel.length[towerId]!;
    fromX = Position.x[towerId]! + Math.cos(barrelAngle) * barrelLen;
    fromY = Position.y[towerId]! + Math.sin(barrelAngle) * barrelLen;
  }

  const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal]!;
  const towerCfg = TOWER_CONFIGS[towerTypeEnum];

  // ── 炮塔：锁定目标位置计算抛物线参数 ──
  let targetX = 0;
  let targetY = 0;
  let totalTime = 0;
  let vyInitial = 0;
  if (isCannon) {
    targetX = Position.x[targetId]!;
    targetY = Position.y[targetId]!;
    const parabola = computeMissileParabola(fromX, fromY, targetX, targetY, visual.speed);
    totalTime = parabola.totalTime;
    vyInitial = parabola.vyInitial;
  }

  const pid = world.createEntity();

  world.addComponent(pid, Position, { x: fromX, y: fromY });

  world.addComponent(pid, Projectile, {
    speed: visual.speed,
    damage,
    damageType: Attack.damageType[towerId],
    targetId,
    sourceId: towerId,
    fromX,
    fromY,
    shape: visual.shape,
    colorR: visual.colorR,
    colorG: visual.colorG,
    colorB: visual.colorB,
    size: visual.size,
    splashRadius: towerCfg?.splashRadius ?? 0,
    stunDuration: towerCfg?.stunDuration ?? 0,
    slowPercent: towerCfg?.slowPercent ?? 0,
    slowMaxStacks: towerCfg?.slowMaxStacks ?? 0,
    freezeDuration: towerCfg?.freezeDuration ?? 0,
    chainCount: towerCfg?.chainCount ?? 0,
    chainRange: towerCfg?.chainRange ?? 0,
    chainDecay: towerCfg?.chainDecay ?? 0,
    sourceTowerType: towerTypeVal,
    // 抛物线参数（仅 Cannon 塔使用）
    targetX,
    targetY,
    flightTime: 0,
    totalTime,
    vyInitial,
  });

  world.addComponent(pid, Visual, {
    shape: visual.shape,
    colorR: visual.colorR,
    colorG: visual.colorG,
    colorB: visual.colorB,
    size: visual.size,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
  });

  // Inherit layer from source entity for render z-ordering (design/18 §5.2)
  const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
  world.addComponent(pid, Layer, { value: sourceLayer });
}

/**
 * 执行闪电链攻击（design/23 §0.5 `lightning_chain` 节点核心副作用）。
 *
 * 服务 lightning 塔。chainCount = baseChain + (level-1) 跳，每跳衰减 chainDecay，
 * 每跳 spawn LightningBolt entity（视觉 0.5s）+ applyDamageToTarget 直接造成伤害。
 * 首跳 Sound.play('lightning_hit') 避免噪音过载。
 *
 * 与 AttackSystem.doLightningAttack 私有方法等价。
 */
export function doLightningAttack(
  world: TowerWorld,
  towerId: number,
  primaryId: number,
  level: number,
): void {
  const config = TOWER_CONFIGS[TowerType.Lightning];
  if (!config) return;

  const baseDamage = getEffectiveDamage(towerId);
  const chainCount = config.chainCountByLevel?.[level - 1]
    ?? config.chainCountByLevel?.[config.chainCountByLevel.length - 1]
    ?? ((config.chainCount ?? 3) + (level - 1));
  const chainDecay = config.chainDecay ?? 0.2;
  const chainRange = config.chainRange ?? 120;

  const hit = new Set<number>();
  let dmg = baseDamage;
  let sourceId = towerId;
  let targetId = primaryId;

  for (let hop = 0; hop < chainCount; hop++) {
    if (hit.has(targetId)) break;
    hit.add(targetId);

    if ((Health.current[targetId] ?? 0) > 0 && AttackSystem.isValidTarget(world, towerId, targetId)) {
      const dmgType = Attack.damageType[towerId] ?? DamageTypeVal.Physical;
      applyDamageToTarget(world, targetId, dmg, dmgType);
    }

    Visual.hitFlashTimer[targetId] = 0.12;

    // LightningBolt entity（视觉 0.5s，RenderSystem 消费）
    const bid = world.createEntity();
    world.addComponent(bid, LightningBolt, {
      sourceId,
      targetId,
      damage: 0,
      duration: 0.5,
      elapsed: 0,
      chainIndex: hop,
    });

    if (hop === 0) Sound.play('lightning_hit');

    sourceId = targetId;

    // 寻找下一跳目标
    if (hop < chainCount - 1) {
      dmg *= (1 - chainDecay);

      const originX = Position.x[targetId]!;
      const originY = Position.y[targetId]!;
      let nearestId = 0;
      let nearestDist = chainRange;

      const allMatches = potentialTargetQuery(world.world);
      const towerFaction = Faction.value[towerId]!;
      for (const eid of allMatches) {
        if (hit.has(eid)) continue;
        const tf = Faction.value[eid];
        if (tf === undefined || !areHostile(towerFaction, tf)) continue;
        if ((Health.current[eid] ?? 0) <= 0) continue;
        if (!AttackSystem.isValidTarget(world, towerId, eid)) continue;

        const ex = Position.x[eid]!;
        const ey = Position.y[eid]!;
        const dx = ex - originX;
        const dy = ey - originY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = eid;
        }
      }
      targetId = nearestId !== 0 ? nearestId : targetId;
    }
  }
}

/**
 * 扫描指定塔射程内的活敌，返回按距离升序排列的 {id, dist} 列表（design/23 §0.5 工具函数）。
 *
 * 服务 BT 层 LaserBeamNode（多束自扫）及 AttackSystem 内部 update / doLightningAttack 链跳目标搜索。
 * 用 potentialTargetQuery（Position + Health + UnitTag）+ areHostile(towerFaction, targetFaction) + Health.current > 0 过滤。
 */
export function findEnemiesInRange(
  world: TowerWorld,
  towerId: number,
  range: number,
): Array<{ id: number; dist: number }> {
  const tx = Position.x[towerId]!;
  const ty = Position.y[towerId]!;
  const towerFaction = Faction.value[towerId]!;
  const result: Array<{ id: number; dist: number }> = [];
  const allMatches = potentialTargetQuery(world.world);
  for (const eid of allMatches) {
    const tf = Faction.value[eid];
    if (tf === undefined || !areHostile(towerFaction, tf)) continue;
    if ((Health.current[eid] ?? 0) <= 0) continue;
    if (!AttackSystem.isValidTarget(world, towerId, eid)) continue;
    const ex = Position.x[eid]!;
    const ey = Position.y[eid]!;
    const dx = ex - tx;
    const dy = ey - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= range) {
      result.push({ id: eid, dist });
    }
  }
  result.sort((a, b) => a.dist - b.dist);
  return result;
}

/**
 * 执行激光多束攻击（design/23 §0.5 `laser_beam` 节点核心副作用）。
 *
 * 服务 laser 塔。L1-2: 1 束 / L3-4: 2 束 / L5: 3 束（getLaserBeamCount）；
 * 取 enemiesInRange 按距离排序前 N 束，每束 spawn LaserBeam entity（视觉 1.0s + DOT）。
 * 实际持续伤害由 LaserBeamSystem 周期 tick。
 *
 * 与 AttackSystem.doLaserAttack 私有方法等价。
 */
export function hasActiveLaserBeam(world: TowerWorld, towerId: number): boolean {
  const beams = laserBeamQuery(world.world);
  for (const eid of beams) {
    if (LaserBeam.sourceId[eid] !== towerId) continue;
    if ((LaserBeam.elapsed[eid] ?? 0) < (LaserBeam.duration[eid] ?? 0)) {
      return true;
    }
  }
  return false;
}

export function doLaserAttack(
  world: TowerWorld,
  towerId: number,
  enemiesInRange: Array<{ id: number; dist: number }>,
  level: number,
): void {
  if (hasActiveLaserBeam(world, towerId)) return;
  const target = enemiesInRange[0];
  if (!target) return;
  const maxDamage = getEffectiveDamage(towerId);
  const initialDamage = maxDamage * 0.1;

  const beamId = world.createEntity();
  world.addComponent(beamId, LaserBeam, {
    sourceId: towerId,
    targetId: target.id,
    damage: initialDamage,
    maxDamage,
    duration: 5.0,
    elapsed: 0,
  });
}
