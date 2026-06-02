// ============================================================
// SoldierAISystem — 士兵 4 状态机 AI
//
// 对应设计文档:
// - design/02-gameplay.md §7.1.2 — soldier 4-state AI
// - design/03-units.md §3 — soldier stats (alert_range, attack_range, moveRange)
//
// 状态流转:
//   IDLE (0)    巡逻 → 发现敌人在警戒范围内 → ALERT
//   ALERT (1)   追击 → 进入攻击范围 → COMBAT, 目标丢失/脱离警戒 → RETURNING
//   COMBAT (2)  战斗 → 目标死亡 → RETURNING, 脱离攻击范围 → ALERT
//   RETURNING (3) 返回 → 到家 → IDLE, 途中发现敌人 → ALERT
//
// 本系统只设置 Movement.moveMode / Movement.targetX/Y / Attack.targetId
// 与 Visual.facing。实际移动由 MovementSystem 执行，实际攻击伤害由
// AttackSystem（塔）或对应的士兵攻击系统处理。
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position,
  Movement,
  Soldier,
  Attack,
  Faction,
  Health,
  UnitTag,
  Visual,
  MoveModeVal,
  Stunned,
  Frozen,
  DamageTypeVal,
  SlashEffect,
  Projectile,
  Layer,
  LayerVal,
} from '../core/components.js';
import { areHostile } from '../utils/factionUtils.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';

// ============================================================
// 状态常量
// ============================================================

const STATE_IDLE = 0;
const STATE_ALERT = 1;
const STATE_COMBAT = 2;
const STATE_RETURNING = 3;

/** 士兵到家判定距离（px） */
const HOME_REACHED_THRESHOLD = 10;

// ============================================================
// SoldierAISystem
// ============================================================

export class SoldierAISystem implements System {
  readonly name = 'SoldierAISystem';

  /** Query: player soldier entities with full combat components */
  private soldierQuery = defineQuery([Position, Movement, Soldier, Attack, Faction]);

  /** Query: potential enemies (faction check applied per-frame) */
  private enemyQuery = defineQuery([Position, Health, Faction, UnitTag]);

  // ============================================================
  // Frame Update
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    const soldiers = this.soldierQuery(world.world);

    for (let i = 0; i < soldiers.length; i++) {
      const eid = soldiers[i]!;
      this.processSoldier(world, eid, dt);
    }
  }

  // ============================================================
  // Per-soldier processing
  // ============================================================

  private processSoldier(world: TowerWorld, eid: number, dt: number): void {
    // Skip stunned / frozen soldiers
    if (Stunned.timer[eid]! > 0) return;
    if (hasComponent(world.world, Frozen, eid)) return;

    // Tick state timer
    Soldier.stateTimer[eid] = (Soldier.stateTimer[eid] ?? 0) + dt;

    const state = Soldier.state[eid]!;

    switch (state) {
      case STATE_IDLE:
        this.updateIdle(world, eid, dt);
        break;
      case STATE_ALERT:
        this.updateAlert(world, eid, dt);
        break;
      case STATE_COMBAT:
        this.updateCombat(world, eid, dt);
        break;
      case STATE_RETURNING:
        this.updateReturning(world, eid, dt);
        break;
      default:
        // Unknown state — reset to IDLE
        this.transitionTo(world, eid, STATE_IDLE);
        break;
    }
  }

  // ============================================================
  // IDLE — 巡逻 + 警戒扫描
  // ============================================================

  private updateIdle(world: TowerWorld, eid: number, dt: number): void {
    // Set patrol movement mode — MovementSystem handles the rest
    Movement.moveMode[eid] = MoveModeVal.Patrol;

    // Scan for enemies within alert_range
    const nearestEnemy = this.findNearestEnemyInRange(world, eid, this.getAlertRange(eid));

    if (nearestEnemy !== 0) {
      // Enemy found! Transition to ALERT and set attack target
      Soldier.attackTarget[eid] = nearestEnemy;
      this.setChaseTarget(world, eid, nearestEnemy);
      this.transitionTo(world, eid, STATE_ALERT);
    }
  }

  // ============================================================
  // ALERT — 追击目标
  // ============================================================

  private updateAlert(world: TowerWorld, eid: number, dt: number): void {
    const attackTarget = Soldier.attackTarget[eid]!;

    // Validate current target: alive, hostile, not too far
    if (!this.isValidTarget(world, eid, attackTarget, this.getAlertRange(eid))) {
      // Current target invalid — look for next closest enemy
      const nextEnemy = this.findNearestEnemyInRange(world, eid, this.getAlertRange(eid));

      if (nextEnemy !== 0) {
        // Switch to new target
        Soldier.attackTarget[eid] = nextEnemy;
        this.setChaseTarget(world, eid, nextEnemy);
        // Stay in ALERT
      } else {
        // No more enemies — return home
        Soldier.attackTarget[eid] = 0;
        this.setMovementTarget(world, eid, Soldier.homeX[eid]!, Soldier.homeY[eid]!);
        this.transitionTo(world, eid, STATE_RETURNING);
      }
      return;
    }

    // Check if soldier has strayed too far from home (priority over combat)
    if (this.isTooFarFromHome(eid)) {
      Soldier.attackTarget[eid] = 0;
      this.setMovementTarget(world, eid, Soldier.homeX[eid]!, Soldier.homeY[eid]!);
      this.transitionTo(world, eid, STATE_RETURNING);
      return;
    }

    // Update chase target to enemy's current position
    this.setChaseTarget(world, eid, attackTarget);

    // Check if within attack range → transition to COMBAT
    // 使用90%的攻击范围作为进入阈值，添加滞后缓冲防止抖动
    const distToTarget = this.getDistance(eid, attackTarget);
    const attackRange = this.getAttackRange(eid);
    if (distToTarget <= attackRange * 0.9) {
      this.transitionTo(world, eid, STATE_COMBAT);
      return;
    }
  }

  // ============================================================
  // COMBAT — 战斗
  // ============================================================

  private updateCombat(world: TowerWorld, eid: number, dt: number): void {
    // Stop moving — hold position
    Movement.moveMode[eid] = MoveModeVal.HoldPosition;

    const attackTarget = Soldier.attackTarget[eid]!;

    // Face toward target
    const targetX = Position.x[attackTarget];
    const targetY = Position.y[attackTarget];
    const selfX = Position.x[eid]!;
    if (targetX !== undefined) {
      if (targetX > selfX) Visual.facing[eid] = 1;
      else if (targetX < selfX) Visual.facing[eid] = -1;
    }

    // Validate current target
    if (!this.isValidTarget(world, eid, attackTarget, this.getAlertRange(eid))) {
      // Target dead or out of alert range
      Soldier.attackTarget[eid] = 0;

      // Check if another enemy is nearby
      const nextEnemy = this.findNearestEnemyInRange(world, eid, this.getAlertRange(eid));
      if (nextEnemy !== 0) {
        Soldier.attackTarget[eid] = nextEnemy;
        this.setChaseTarget(world, eid, nextEnemy);
        this.transitionTo(world, eid, STATE_ALERT);
      } else {
        this.setMovementTarget(world, eid, Soldier.homeX[eid]!, Soldier.homeY[eid]!);
        this.transitionTo(world, eid, STATE_RETURNING);
      }
      return;
    }

    // Check if target moved out of attack range but still in alert range
    // 使用110%的攻击范围作为离开阈值，添加滞后缓冲防止抖动
    const distToTarget = this.getDistance(eid, attackTarget);
    const attackRange = this.getAttackRange(eid);
    if (distToTarget > attackRange * 1.1) {
      // Back to chase mode
      this.setChaseTarget(world, eid, attackTarget);
      this.transitionTo(world, eid, STATE_ALERT);
      return;
    }

    // Still in combat — set Attack.targetId for damage systems
    Attack.targetId[eid] = attackTarget;

    // Handle attack cooldown and deal damage
    const cooldownTimer = Attack.cooldownTimer[eid] ?? 0;
    if (cooldownTimer > 0) {
      Attack.cooldownTimer[eid] = cooldownTimer - dt;
    } else {
      // Attack is ready — deal damage
      const damage = Attack.damage[eid] ?? 0;
      const attackSpeed = Attack.attackSpeed[eid] ?? 1.0;
      if (damage > 0 && attackSpeed > 0) {
        const attackRange = Attack.range[eid] ?? 50;

        // 远程单位（射程>80）发射投射物，近战单位显示扇形刀光
        if (attackRange > 80) {
          this.spawnSoldierProjectile(world, eid, attackTarget, damage);
        } else {
          this.spawnSlashEffect(world, eid, attackTarget);
          applyDamageToTarget(world, attackTarget, damage, DamageTypeVal.Physical);
        }

        Attack.cooldownTimer[eid] = 1.0 / attackSpeed;

        // Hit flash on target
        if (Visual.hitFlashTimer[attackTarget] !== undefined) {
          Visual.hitFlashTimer[attackTarget] = 0.12;
        }
      }
    }

    // Check if too far from home
    if (this.isTooFarFromHome(eid)) {
      Soldier.attackTarget[eid] = 0;
      this.setMovementTarget(world, eid, Soldier.homeX[eid]!, Soldier.homeY[eid]!);
      this.transitionTo(world, eid, STATE_RETURNING);
    }
  }

  // ============================================================
  // RETURNING — 返回原位
  // ============================================================

  private updateReturning(world: TowerWorld, eid: number, dt: number): void {
    // Move toward home position
    Movement.moveMode[eid] = MoveModeVal.ChaseTarget;

    const homeX = Soldier.homeX[eid]!;
    const homeY = Soldier.homeY[eid]!;
    this.setMovementTarget(world, eid, homeX, homeY);

    // Check if arrived at home
    const selfX = Position.x[eid]!;
    const selfY = Position.y[eid]!;
    const dx = selfX - homeX;
    const dy = selfY - homeY;
    const distToHome = Math.sqrt(dx * dx + dy * dy);

    if (distToHome <= HOME_REACHED_THRESHOLD) {
      // Arrived home — back to idle patrol
      this.transitionTo(world, eid, STATE_IDLE);
      return;
    }

    // Scan for enemies while returning — may get interrupted
    const spotted = this.findNearestEnemyInRange(world, eid, this.getAlertRange(eid));
    if (spotted !== 0) {
      // Interrupt return to engage new threat
      Soldier.attackTarget[eid] = spotted;
      this.setChaseTarget(world, eid, spotted);
      this.transitionTo(world, eid, STATE_ALERT);
    }
  }

  // ============================================================
  // State Transition Helper
  // ============================================================

  private transitionTo(_world: TowerWorld, eid: number, newState: number): void {
    Soldier.state[eid] = newState;
    Soldier.stateTimer[eid] = 0;
  }

  // ============================================================
  // Movement Helpers
  // ============================================================

  /** Set Movement target to chase an enemy entity */
  private setChaseTarget(world: TowerWorld, eid: number, targetId: number): void {
    Movement.moveMode[eid] = MoveModeVal.ChaseTarget;
    Movement.targetX[eid] = Position.x[targetId]!;
    Movement.targetY[eid] = Position.y[targetId]!;
  }

  /** Set Movement target to a world position (for returning home) */
  private setMovementTarget(_world: TowerWorld, eid: number, x: number, y: number): void {
    Movement.moveMode[eid] = MoveModeVal.ChaseTarget;
    Movement.targetX[eid] = x;
    Movement.targetY[eid] = y;
  }

  // ============================================================
  // Attack Visual Effects
  // ============================================================

  /** 生成近战扇形刀光特效 */
  private spawnSlashEffect(world: TowerWorld, attackerId: number, targetId: number): void {
    const fromX = Position.x[attackerId]!;
    const fromY = Position.y[attackerId]!;
    const toX = Position.x[targetId];
    const toY = Position.y[targetId];

    if (toX === undefined || toY === undefined) return;

    // 计算攻击方向角度
    const dx = toX - fromX;
    const dy = toY - fromY;
    const baseAngle = Math.atan2(dy, dx);

    // 扇形刀光：以攻击方向为中心，左右各45度
    const slashId = world.createEntity();
    world.addComponent(slashId, Position, { x: fromX, y: fromY });
    world.addComponent(slashId, SlashEffect, {
      duration: 0.3,
      elapsed: 0,
      radius: 40,
      startAngle: baseAngle - Math.PI / 4,
      endAngle: baseAngle + Math.PI / 4,
      colorR: 255,
      colorG: 255,
      colorB: 255,
    });
  }

  /** 生成远程投射物 */
  private spawnSoldierProjectile(world: TowerWorld, attackerId: number, targetId: number, damage: number): void {
    const fromX = Position.x[attackerId]!;
    const fromY = Position.y[attackerId]!;

    const pid = world.createEntity();
    world.addComponent(pid, Position, { x: fromX, y: fromY });
    world.addComponent(pid, Projectile, {
      speed: 300,
      damage,
      damageType: DamageTypeVal.Physical,
      targetId,
      sourceId: attackerId,
      fromX,
      fromY,
      shape: 1, // triangle
      colorR: 102,
      colorG: 187,
      colorB: 106,
      size: 8,
      splashRadius: 0,
      stunDuration: 0,
      slowPercent: 0,
      slowMaxStacks: 0,
      freezeDuration: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      sourceTowerType: -1, // soldier projectile
    });
    world.addComponent(pid, Visual, {
      shape: 1, // triangle
      colorR: 102,
      colorG: 187,
      colorB: 106,
      size: 8,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
    world.addComponent(pid, Layer, { value: LayerVal.Ground });
  }

  // ============================================================
  // Range Helpers
  // ============================================================

  /** Get soldier's alert range (detection radius) */
  private getAlertRange(eid: number): number {
    const alertRange = Attack.alertRange[eid];
    if (alertRange !== undefined && alertRange > 0) return alertRange;

    const atkRange = Attack.range[eid];
    if (atkRange !== undefined && atkRange > 0) return atkRange * 1.5;

    const moveRange = Soldier.moveRange[eid];
    if (moveRange !== undefined && moveRange > 0) return moveRange;

    return 200; // fallback default
  }

  /** Get soldier's attack range */
  private getAttackRange(eid: number): number {
    const atkRange = Attack.range[eid];
    if (atkRange !== undefined && atkRange > 0) return atkRange;

    const moveRange = Soldier.moveRange[eid];
    if (moveRange !== undefined && moveRange > 0) return moveRange;

    return 40; // fallback default
  }

  /** Check if soldier is too far from home position (with hysteresis buffer) */
  private isTooFarFromHome(eid: number): boolean {
    const homeX = Soldier.homeX[eid]!;
    const homeY = Soldier.homeY[eid]!;
    const selfX = Position.x[eid]!;
    const selfY = Position.y[eid]!;
    const moveRange = Soldier.moveRange[eid]!;

    const dx = selfX - homeX;
    const dy = selfY - homeY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 添加10%滞后缓冲，防止在边界上来回抖动
    return dist > moveRange * 1.1;
  }

  // ============================================================
  // Enemy Detection Helpers
  // ============================================================

  /** Get Euclidean distance between two entities */
  private getDistance(eidA: number, eidB: number): number {
    const ax = Position.x[eidA]!;
    const ay = Position.y[eidA]!;
    const bx = Position.x[eidB]!;
    const by = Position.y[eidB]!;
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Find the nearest hostile enemy within range of a soldier.
   * Returns entity ID of nearest enemy, or 0 if none found.
   */
  private findNearestEnemyInRange(world: TowerWorld, soldierId: number, range: number): number {
    const soldierFaction = Faction.value[soldierId];
    if (soldierFaction === undefined) return 0;

    const soldierX = Position.x[soldierId]!;
    const soldierY = Position.y[soldierId]!;

    const enemies = this.enemyQuery(world.world);

    let nearestId = 0;
    let nearestDist = range;

    for (let i = 0; i < enemies.length; i++) {
      const enemyId = enemies[i]!;

      // Must be alive
      if ((Health.current[enemyId] ?? 0) <= 0) continue;

      // Must be hostile
      const enemyFaction = Faction.value[enemyId];
      if (enemyFaction === undefined) continue;
      if (!areHostile(soldierFaction, enemyFaction)) continue;

      const enemyX = Position.x[enemyId]!;
      const enemyY = Position.y[enemyId]!;
      const dx = soldierX - enemyX;
      const dy = soldierY - enemyY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = enemyId;
      }
    }

    return nearestId;
  }

  /**
   * Check if a target entity is still valid for the soldier:
   * - alive
   * - hostile
   * - within specified range (with 10% hysteresis buffer to prevent jitter)
   */
  private isValidTarget(world: TowerWorld, soldierId: number, targetId: number, maxRange: number): boolean {
    const soldierFaction = Faction.value[soldierId];
    const targetFaction = Faction.value[targetId];
    if (soldierFaction === undefined || targetFaction === undefined) return false;
    if (!areHostile(soldierFaction, targetFaction)) return false;

    if ((Health.current[targetId] ?? 0) <= 0) return false;

    const dist = this.getDistance(soldierId, targetId);
    // 添加10%滞后缓冲，防止在范围边界上来回切换状态
    if (dist > maxRange * 1.1) return false;

    return true;
  }
}
