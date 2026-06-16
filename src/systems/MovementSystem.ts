import { TowerWorld, type System, defineQuery, hasComponent, entityExists } from '../core/World.js';
import {
  Position, Movement, Health, UnitTag, Stunned, Frozen, Slowed, MoveModeVal,
  Visual, Attack, Projectile, Category, CategoryVal, Soldier,
  Faction, DamageTypeVal, Tower, PlayerOwned, SlashEffect, Layer, LayerVal, ShapeVal,
  Boss, EnemyFlockMember, Burrowed, EnemySkillParticleEffectVal, Taunted,
} from '../core/components.js';
import { createSkillParticles } from './EnemySkillSystem.js';
import type { MapConfig, GridPos } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { getEffectiveValue } from './BuffSystem.js';
import { resolveGraphFromMap } from '../level/graph/loaderAdapter.js';
import { linearizeSpawnPaths } from '../level/graph/PathGraph.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { ScreenShakeSystem } from './ScreenShakeSystem.js';
import { GamePhase } from '../types/index.js';

/** Distance threshold multiplier: enemy is "off-path" when perpendicular distance > ts * this */
const PATH_RECOVERY_MULT = 1.5;

/** Distance (px) within which a soldier considers itself at its patrol target */
const SOLDIER_REACH_THRESHOLD = 5;

/** Moving enemy two-frame breath cadence. RenderSystem maps the phase to 100% / 104% scale. */
const ENEMY_MOVE_BREATH_RATE = 8;
const FLOCK_SEPARATION_RADIUS = 30;
const FLOCK_ALIGNMENT_RADIUS = 72;
const FLOCK_COHESION_RADIUS = 92;
const FLOCK_MAX_FORCE = 420;
const FLOCK_SEPARATION_WEIGHT = 2.8;
const FLOCK_ALIGNMENT_WEIGHT = 1.1;
const FLOCK_COHESION_WEIGHT = 0.9;
const FLOCK_PATH_WEIGHT = 2.4;
const FLOCK_OFFSET_WEIGHT = 1.1;
const FLOCK_WANDER_STRENGTH = 50;
const FLOCK_PATH_ADVANCE_RADIUS = 18;

export class MovementSystem implements System {
  readonly name = 'MovementSystem';
  private frameCounter = 0;

  /** Query: all moving units (enemies + player units) */
  private movingQuery = defineQuery([Position, Movement, UnitTag]);
  /** Query: player soldier entities (non-enemy with Soldier component) */
  private soldierQuery = defineQuery([Position, Movement, UnitTag, Soldier]);
  /** Query: base objective entities (Category.Objective) for damage on enemy reach-end */
  private baseQuery = defineQuery([Position, Health, Category]);
  /** Query: player tower entities */
  private towerQuery = defineQuery([Position, Tower, Health]);
  /** Per-spawn paths: paths[spawnIdx] = ordered GridPos[] from spawn to crystal_anchor */
  private readonly paths: readonly (readonly GridPos[])[];

  /** Static per-spawn paths — used by findNearestPathIndex for other systems */
  private static _paths: readonly (readonly GridPos[])[] = [];
  /** Static tile size — used by findNearestPathIndex */
  private static _tileSize = 0;

  constructor(
    private map: MapConfig,
    private setPhase?: (phase: GamePhase) => void,
  ) {
    const resolved = resolveGraphFromMap(map);
    const spawnPaths = linearizeSpawnPaths({ pathGraph: resolved.pathGraph, spawns: resolved.spawns });
    this.paths = spawnPaths.map((sp) => sp.path);
    MovementSystem._paths = this.paths;
    MovementSystem._tileSize = map.tileSize;
  }

  update(world: TowerWorld, dt: number): void {
    this.frameCounter++;
    // Phase 1: Process enemy movement (FollowPath + path-recovery)
    this.processEnemies(world, dt);

    // Phase 2: Process soldier movement (HoldPosition / Patrol / ChaseTarget)
    this.processSoldiers(world, dt);
  }

  // ================================================================
  // Enemy movement: FollowPath + path-recovery
  // ================================================================

  private processEnemies(world: TowerWorld, dt: number): void {
    const entities = this.movingQuery(world.world);
    const paths = this.paths;
    const ts = this.map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      // Only process enemy units
      if (UnitTag.isEnemy[eid] !== 1) continue;

      // Skip stunned entities
      if (Stunned.timer[eid]! > 0) {
        Movement.currentSpeed[eid] = 0;
        continue;
      }

      // Skip frozen entities — completely immobilized
      if (hasComponent(world.world, Frozen, eid)) {
        Movement.currentSpeed[eid] = 0;
        continue;
      }

      if (this.processTauntTimer(world, eid, dt) && hasComponent(world.world, Attack, eid)) {
        this.processEnemyAttack(world, eid, dt);
        Movement.currentSpeed[eid] = 0;
        continue;
      }

      // Attack animation pause — stop moving during attack wind-down
      if (Visual.attackAnimTimer[eid]! > 0) {
        Visual.attackAnimTimer[eid] = Math.max(0, Visual.attackAnimTimer[eid]! - dt);
        Movement.currentSpeed[eid] = 0;
        continue; // skip movement, but attack logic below won't re-fire due to cooldown
      }

      // Skip if not in follow-path mode
      if (Movement.moveMode[eid] !== MoveModeVal.FollowPath) {
        Movement.currentSpeed[eid] = 0;
        continue;
      }

      // 敌人若本帧能攻击玩家单位，则先攻击并停止移动，避免 Boss/近战单位边走边拆塔。
      if (hasComponent(world.world, Attack, eid) && this.processEnemyAttack(world, eid, dt)) {
        Movement.currentSpeed[eid] = 0;
        continue;
      }

      if (hasComponent(world.world, EnemyFlockMember, eid)) {
        this.processFlockEnemy(world, eid, entities, paths, ts, ox, oy, dt);
        continue;
      }

      // Select path for this enemy's spawn point
      const spawnIdx = Movement.spawnIdx[eid]!;
      const path = (spawnIdx >= 0 && spawnIdx < paths.length) ? paths[spawnIdx]! : paths[0]!;

      const pathIndex = Movement.pathIndex[eid]!;

      // Reached end of path — attack animation + damage base
      if (pathIndex >= path.length - 1) {
        this.processEnemyReachedPathEnd(world, eid);
        continue;
      }

      const posX = Position.x[eid]!;
      const posY = Position.y[eid]!;

      // --- Path-recovery: detect if enemy was pushed off-path ---
      if (this.tryPathRecovery(eid, pathIndex, path, ts, ox, oy, posX, posY, spawnIdx)) {
        Movement.currentSpeed[eid] = 0;
        continue; // position already snapped to nearest waypoint
      }

      const current = path[pathIndex]!;
      const next = path[pathIndex + 1]!;
      this.syncEnemyFacingToPathSegment(eid, path, pathIndex);

      // World-space coordinates of current and next waypoint
      const cx = current.col * ts + ts / 2 + ox;
      const cy = current.row * ts + ts / 2 + oy;
      const nx = next.col * ts + ts / 2 + ox;
      const ny = next.row * ts + ts / 2 + oy;

      const dx = nx - cx;
      const dy = ny - cy;
      const segmentLen = Math.sqrt(dx * dx + dy * dy);

      if (segmentLen <= 0) {
        Movement.currentSpeed[eid] = 0;
        continue;
      }

      const rawSpeed = Movement.speed[eid]!;
      const buff = getEffectiveValue(eid, 'speed');
      const speed = Math.max(rawSpeed * 0.5, (rawSpeed + buff.absolute) * (1 + buff.percent / 100));
      const dist = speed * dt;

      let progress = Movement.progress[eid]!;
      progress += dist / segmentLen;

      let newX: number;
      let newY: number;

      if (progress >= 1.0) {
        // Reached waypoint — advance to next
        Movement.pathIndex[eid] = pathIndex + 1;
        Movement.progress[eid] = 0;
        newX = nx;
        newY = ny;
        this.syncEnemyFacingToPathSegment(eid, path, pathIndex + 1);
      } else {
        Movement.progress[eid] = progress;
        newX = cx + dx * progress;
        newY = cy + dy * progress;
      }

      Position.x[eid] = newX;
      Position.y[eid] = newY;

      const stepDx = Position.x[eid]! - posX;
      const stepDy = Position.y[eid]! - posY;
      const stepDist = Math.sqrt(stepDx * stepDx + stepDy * stepDy);
      this.updateBurrowTravel(world, eid, stepDist, ts, dt);
      Movement.currentSpeed[eid] = dt > 0 ? stepDist / dt : 0;
      if (stepDist > 0.05) {
        Visual.bobPhase[eid] = ((Visual.bobPhase[eid] ?? 0) + speed * dt * 0.08) % (Math.PI * 2);
        Visual.breathPhase[eid] = ((Visual.breathPhase[eid] ?? 0) + dt * ENEMY_MOVE_BREATH_RATE) % (Math.PI * 2);
      }

      // 攻击逻辑已在移动前处理，确保攻击帧不移动。
    }
  }

  private updateBurrowTravel(world: TowerWorld, eid: number, stepDist: number, tileSize: number, dt: number): void {
    if (!hasComponent(world.world, Burrowed, eid)) return;

    Burrowed.distanceRemaining[eid] = Math.max(0, (Burrowed.distanceRemaining[eid] ?? 0) - stepDist / tileSize);
    Burrowed.trailEmitTimer[eid] = (Burrowed.trailEmitTimer[eid] ?? 0) - dt;

    if ((Burrowed.trailEmitTimer[eid] ?? 0) <= 0 && stepDist > 0.05) {
      Burrowed.trailEmitTimer[eid] = 0.12;
      createSkillParticles(
        world,
        Position.x[eid] ?? 0,
        Position.y[eid] ?? 0,
        EnemySkillParticleEffectVal.BurrowTrail,
        { r: 150, g: 105, b: 55 },
        28,
        0.35,
      );
    }

    if ((Burrowed.distanceRemaining[eid] ?? 0) <= 0) {
      if (hasComponent(world.world, Visual, eid)) {
        Visual.alpha[eid] = Math.max(0.2, Burrowed.originalAlpha[eid] ?? 1);
      }
      if (hasComponent(world.world, Layer, eid)) {
        Layer.value[eid] = Burrowed.originalLayer[eid] ?? LayerVal.Ground;
      }
      world.removeComponent(eid, Burrowed);
      createSkillParticles(
        world,
        Position.x[eid] ?? 0,
        Position.y[eid] ?? 0,
        EnemySkillParticleEffectVal.AoeSlam,
        { r: 170, g: 120, b: 70 },
        34,
        0.35,
      );
    }
  }

  private processFlockEnemy(
    world: TowerWorld,
    eid: number,
    allMoving: readonly number[],
    paths: readonly (readonly GridPos[])[],
    ts: number,
    ox: number,
    oy: number,
    dt: number,
  ): void {
    const spawnIdx = Movement.spawnIdx[eid]!;
    const path = (spawnIdx >= 0 && spawnIdx < paths.length) ? paths[spawnIdx]! : paths[0]!;
    let pathIndex = Movement.pathIndex[eid]!;

    if (pathIndex >= path.length - 1) {
      this.processEnemyReachedPathEnd(world, eid);
      return;
    }

    const bx = Position.x[eid]!;
    const by = Position.y[eid]!;
    const next = path[pathIndex + 1]!;
    const nextX = next.col * ts + ts / 2 + ox;
    const nextY = next.row * ts + ts / 2 + oy;
    const anchorOffsetX = EnemyFlockMember.anchorOffsetX[eid] ?? 0;
    const anchorOffsetY = EnemyFlockMember.anchorOffsetY[eid] ?? 0;
    const targetX = nextX + anchorOffsetX;
    const targetY = nextY + anchorOffsetY;

    const toNextX = nextX - bx;
    const toNextY = nextY - by;
    const toNextLen = Math.sqrt(toNextX * toNextX + toNextY * toNextY);
    const toTargetX = targetX - bx;
    const toTargetY = targetY - by;
    const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);
    if (toNextLen <= FLOCK_PATH_ADVANCE_RADIUS || toTargetLen <= FLOCK_PATH_ADVANCE_RADIUS) {
      Movement.pathIndex[eid] = pathIndex + 1;
      Movement.progress[eid] = 0;
      if (pathIndex >= path.length - 2) {
        this.processEnemyReachedPathEnd(world, eid);
        return;
      }
      pathIndex++;
    }
    this.syncEnemyFacingToPathSegment(eid, path, pathIndex);

    const flockId = EnemyFlockMember.flockId[eid];
    let sepX = 0, sepY = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohCount = 0;

    for (let i = 0; i < allMoving.length; i++) {
      const otherId = allMoving[i]!;
      if (otherId === eid) continue;
      if (UnitTag.isEnemy[otherId] !== 1) continue;
      if (Health.current[otherId]! <= 0) continue;
      if (EnemyFlockMember.flockId[otherId] !== flockId) continue;

      const ox2 = Position.x[otherId]!;
      const oy2 = Position.y[otherId]!;
      const dx = bx - ox2;
      const dy = by - oy2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.01) continue;

      if (dist < FLOCK_SEPARATION_RADIUS) {
        sepX += dx / dist;
        sepY += dy / dist;
        sepCount++;
      }
      if (dist < FLOCK_ALIGNMENT_RADIUS) {
        aliX += EnemyFlockMember.velocityX[otherId] ?? 0;
        aliY += EnemyFlockMember.velocityY[otherId] ?? 0;
        aliCount++;
      }
      if (dist < FLOCK_COHESION_RADIUS) {
        cohX += ox2;
        cohY += oy2;
        cohCount++;
      }
    }

    const rawSpeed = Movement.speed[eid]!;
    const buff = getEffectiveValue(eid, 'speed');
    const speed = Math.max(rawSpeed * 0.5, (rawSpeed + buff.absolute) * (1 + buff.percent / 100));

    let fx = 0, fy = 0;
    if (sepCount > 0) {
      fx += (sepX / sepCount) * speed * FLOCK_SEPARATION_WEIGHT;
      fy += (sepY / sepCount) * speed * FLOCK_SEPARATION_WEIGHT;
    }
    if (aliCount > 0) {
      fx += (aliX / aliCount) * FLOCK_ALIGNMENT_WEIGHT;
      fy += (aliY / aliCount) * FLOCK_ALIGNMENT_WEIGHT;
    }
    if (cohCount > 0) {
      const cx = cohX / cohCount - bx;
      const cy = cohY / cohCount - by;
      const len = Math.sqrt(cx * cx + cy * cy);
      if (len > 0.01) {
        fx += (cx / len) * speed * FLOCK_COHESION_WEIGHT;
        fy += (cy / len) * speed * FLOCK_COHESION_WEIGHT;
      }
    }

    const pathDx = targetX - bx;
    const pathDy = targetY - by;
    const pathLen = Math.sqrt(pathDx * pathDx + pathDy * pathDy);
    if (pathLen > 0.01) {
      fx += (pathDx / pathLen) * speed * FLOCK_PATH_WEIGHT;
      fy += (pathDy / pathLen) * speed * FLOCK_PATH_WEIGHT;
    }

    const offsetDx = (nextX + anchorOffsetX * 0.5) - bx;
    const offsetDy = (nextY + anchorOffsetY * 0.5) - by;
    const offsetLen = Math.sqrt(offsetDx * offsetDx + offsetDy * offsetDy);
    if (offsetLen > 0.01) {
      fx += (offsetDx / offsetLen) * speed * FLOCK_OFFSET_WEIGHT;
      fy += (offsetDy / offsetLen) * speed * FLOCK_OFFSET_WEIGHT;
    }

    const wanderAngle = ((EnemyFlockMember.memberIndex[eid] ?? 0) * 1.947 + (Movement.progress[eid] ?? 0) * 9.1 + this.frameCounter * 0.04) % (Math.PI * 2);
    fx += Math.cos(wanderAngle) * FLOCK_WANDER_STRENGTH;
    fy += Math.sin(wanderAngle * 1.37) * FLOCK_WANDER_STRENGTH;

    const forceLen = Math.sqrt(fx * fx + fy * fy);
    if (forceLen > FLOCK_MAX_FORCE) {
      fx = (fx / forceLen) * FLOCK_MAX_FORCE;
      fy = (fy / forceLen) * FLOCK_MAX_FORCE;
    }

    let vx = (EnemyFlockMember.velocityX[eid] ?? 0) + fx * dt;
    let vy = (EnemyFlockMember.velocityY[eid] ?? 0) + fy * dt;
    const vLen = Math.sqrt(vx * vx + vy * vy);
    if (vLen > speed) {
      vx = (vx / vLen) * speed;
      vy = (vy / vLen) * speed;
    }

    Position.x[eid] = bx + vx * dt;
    Position.y[eid] = by + vy * dt;
    EnemyFlockMember.velocityX[eid] = vx;
    EnemyFlockMember.velocityY[eid] = vy;
    Movement.currentSpeed[eid] = Math.sqrt(vx * vx + vy * vy);
    Movement.progress[eid] = Math.min(0.999, (Movement.progress[eid] ?? 0) + (Movement.currentSpeed[eid]! * dt) / Math.max(ts, 1));

    if (Math.abs(vx) > 0.05) Visual.facing[eid] = vx > 0 ? 1 : -1;
    if (Movement.currentSpeed[eid]! > 0.05) {
      Visual.bobPhase[eid] = ((Visual.bobPhase[eid] ?? 0) + speed * dt * 0.08) % (Math.PI * 2);
      Visual.breathPhase[eid] = ((Visual.breathPhase[eid] ?? 0) + dt * ENEMY_MOVE_BREATH_RATE) % (Math.PI * 2);
    }
  }

  private processEnemyReachedPathEnd(world: TowerWorld | null, eid: number): void {
    Movement.currentSpeed[eid] = 0;
    if (!world) return;

    if (hasComponent(world.world, Boss, eid)) {
      this.setPhase?.(GamePhase.Defeat);
      world.destroyEntity(eid);
      return;
    }

    // Reach-crystal attack animation completed after damage was already applied.
    if (Movement.progress[eid]! < 0) {
      world.destroyEntity(eid);
      return;
    }

    const damage = UnitTag.atk[eid] ?? 0;
    const bases = this.baseQuery(world.world);
    for (let i = 0; i < bases.length; i++) {
      const baseId = bases[i]!;
      if (Category.value[baseId] !== CategoryVal.Objective) continue;
      if (damage > 0) {
        Health.current[baseId]! -= damage;
        if (Health.current[baseId]! < 0) Health.current[baseId]! = 0;
        if (Health.current[baseId]! <= 0) {
          this.setPhase?.(GamePhase.Defeat);
        }
      }
      if (Visual.hitFlashTimer[baseId] !== undefined) {
        Visual.hitFlashTimer[baseId] = 0.12;
      }
    }

    Visual.attackAnimTimer[eid] = 0.4;
    Visual.attackAnimDuration[eid] = 0.4;
    Movement.progress[eid] = -1;

    if (damage > 0) {
      ScreenShakeSystem.triggerShake(world, 3, 0.25, 12);
    }
  }

  /**
   * Check if an enemy is too far from its current path segment.
   * If off-path, snap to the nearest waypoint and resume path-following from there.
   * @returns true if recovery was performed
   */
  private tryPathRecovery(
    eid: number,
    pathIndex: number,
    path: readonly GridPos[],
    ts: number,
    ox: number,
    oy: number,
    posX: number,
    posY: number,
    spawnIdx: number,
  ): boolean {
    if (pathIndex >= path.length - 1) return false;

    const current = path[pathIndex]!;
    const next = path[pathIndex + 1]!;

    const cx = current.col * ts + ts / 2 + ox;
    const cy = current.row * ts + ts / 2 + oy;
    const nx = next.col * ts + ts / 2 + ox;
    const ny = next.row * ts + ts / 2 + oy;

    const segDist = this.pointToSegmentDist(posX, posY, cx, cy, nx, ny);
    const threshold = ts * PATH_RECOVERY_MULT;

    if (segDist <= threshold) return false;

    // Enemy is off-path — find nearest waypoint to snap back
    const nearestIdx = this.findNearestPathWaypoint(path, ts, ox, oy, posX, posY);
    const wp = path[nearestIdx]!;

    Position.x[eid] = wp.col * ts + ts / 2 + ox;
    Position.y[eid] = wp.row * ts + ts / 2 + oy;
    Movement.pathIndex[eid] = nearestIdx;
    Movement.progress[eid] = 0;
    this.syncEnemyFacingToPathSegment(eid, path, nearestIdx);

    return true;
  }

  private syncEnemyFacingToPathSegment(eid: number, path: readonly GridPos[], pathIndex: number): void {
    if (pathIndex < 0 || pathIndex >= path.length - 1) return;

    const current = path[pathIndex]!;
    const next = path[pathIndex + 1]!;
    const horizontalStep = next.col - current.col;
    if (horizontalStep > 0) {
      Visual.facing[eid] = 1;
    } else if (horizontalStep < 0) {
      Visual.facing[eid] = -1;
    }
  }

  /** Perpendicular distance from point to line segment (ax,ay)-(bx,by) */
  private pointToSegmentDist(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): number {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLen2 = abx * abx + aby * aby;
    if (abLen2 < 0.0001) {
      // Degenerate segment — distance to point A
      const dax = px - ax;
      const day = py - ay;
      return Math.sqrt(dax * dax + day * day);
    }
    let t = (apx * abx + apy * aby) / abLen2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + abx * t;
    const cy = ay + aby * t;
    const dpx = px - cx;
    const dpy = py - cy;
    return Math.sqrt(dpx * dpx + dpy * dpy);
  }

  /** Find the index of the nearest path waypoint to a world position */
  private findNearestPathWaypoint(
    path: readonly GridPos[],
    ts: number,
    ox: number,
    oy: number,
    x: number,
    y: number,
  ): number {
    let nearestIdx = 0;
    let nearestDistSq = Infinity;
    for (let i = 0; i < path.length; i++) {
      const wp = path[i]!;
      const wx = wp.col * ts + ts / 2 + ox;
      const wy = wp.row * ts + ts / 2 + oy;
      const dx = x - wx;
      const dy = y - wy;
      const dsq = dx * dx + dy * dy;
      if (dsq < nearestDistSq) {
        nearestDistSq = dsq;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  }

  // ================================================================
  // Enemy attack: attack nearby player units
  // ================================================================

  /** 近战 vs 远程判定阈值（像素） */
  private static readonly MELEE_RANGE_THRESHOLD = 60;

  private processEnemyAttack(world: TowerWorld, eid: number, dt: number): boolean {
    const attackRange = Attack.range[eid] ?? 30;
    const damage = Attack.damage[eid] ?? 0;
    const attackSpeed = Attack.attackSpeed[eid] ?? 1.0;

    if (damage <= 0 || attackSpeed <= 0) return false;

    const posX = Position.x[eid]!;
    const posY = Position.y[eid]!;
    const forcedTarget = this.getTauntTarget(world, eid, posX, posY, attackRange);

    // Tick cooldown. 被嘲讽敌人即使冷却中也要停在原地盯住盾卫。
    const cooldownTimer = Attack.cooldownTimer[eid] ?? 0;
    if (cooldownTimer > 0) {
      Attack.cooldownTimer[eid] = cooldownTimer - dt;
      if (forcedTarget !== null) {
        Attack.targetId[eid] = forcedTarget;
        this.faceTarget(eid, forcedTarget, posX);
        return true;
      }
      return false;
    }

    // Find nearest player unit (soldier or tower) within range
    let nearestTarget: number | null = forcedTarget;
    let nearestDist = attackRange;

    // Check soldiers
    if (nearestTarget === null) {
      const soldiers = this.soldierQuery(world.world);
      for (const sid of soldiers) {
        const sx = Position.x[sid];
        const sy = Position.y[sid];
        if (sx === undefined || sy === undefined) continue;

        const dx = sx - posX;
        const dy = sy - posY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTarget = sid;
        }
      }
    }

    // Check towers (if no soldier found)
    if (nearestTarget === null) {
      const towers = this.towerQuery(world.world);
      for (const tid of towers) {
        const tx = Position.x[tid];
        const ty = Position.y[tid];
        if (tx === undefined || ty === undefined) continue;

        const dx = tx - posX;
        const dy = ty - posY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTarget = tid;
        }
      }
    }

    // Attack the target
    if (nearestTarget !== null) {
      const isRanged = attackRange > MovementSystem.MELEE_RANGE_THRESHOLD;

      // Face toward target
      Attack.targetId[eid] = nearestTarget;
      this.faceTarget(eid, nearestTarget, posX);

      if (isRanged) {
        // 远程：投射子弹，命中时造成伤害
        this.spawnEnemyProjectile(world, eid, nearestTarget, posX, posY, damage);
      } else {
        // 近战：立即伤害 + 刀光特效
        const effectiveDamage = this.getEnemyAttackDamage(world, eid, nearestTarget, damage);
        applyDamageToTarget(world, nearestTarget, effectiveDamage, DamageTypeVal.Physical);

        // Hit flash on target
        if (Visual.hitFlashTimer[nearestTarget] !== undefined) {
          Visual.hitFlashTimer[nearestTarget] = 0.12;
        }

        // Spawn slash blade effect
        this.spawnEnemySlashEffect(world, eid, nearestTarget, posX, posY);
      }

      // Reset cooldown and set attack animation pause
      Attack.cooldownTimer[eid] = 1.0 / attackSpeed;
      const attackAnimDuration = Visual.attackAnimDuration[eid] ?? 0.4;
      Visual.attackAnimTimer[eid] = attackAnimDuration > 0 ? attackAnimDuration : 0.4;
      return true;
    }
    return false;
  }

  private processTauntTimer(world: TowerWorld, eid: number, dt: number): boolean {
    if (!hasComponent(world.world, Taunted, eid)) return false;

    const sourceId = Taunted.sourceId[eid] ?? 0;
    const sourceAlive = entityExists(world.world, sourceId)
      && (Health.current[sourceId] ?? 0) > 0;
    Taunted.timer[eid] = Math.max(0, (Taunted.timer[eid] ?? 0) - dt);

    if (!sourceAlive || Taunted.timer[eid]! <= 0) {
      world.removeComponent(eid, Taunted);
      if (Attack.targetId[eid] === sourceId) {
        Attack.targetId[eid] = 0;
      }
      return false;
    }

    Attack.targetId[eid] = sourceId;
    return true;
  }

  private getTauntTarget(world: TowerWorld, eid: number, posX: number, posY: number, attackRange: number): number | null {
    if (!hasComponent(world.world, Taunted, eid)) return null;

    const sourceId = Taunted.sourceId[eid] ?? 0;
    if (!entityExists(world.world, sourceId)) return null;
    if ((Health.current[sourceId] ?? 0) <= 0) return null;

    const tx = Position.x[sourceId];
    const ty = Position.y[sourceId];
    if (tx === undefined || ty === undefined) return null;

    const dx = tx - posX;
    const dy = ty - posY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= attackRange ? sourceId : null;
  }

  private faceTarget(eid: number, targetId: number, posX: number): void {
    const targetX = Position.x[targetId]!;
    if (targetX > posX) {
      Visual.facing[eid] = 1;
    } else if (targetX < posX) {
      Visual.facing[eid] = -1;
    }
  }

  private getEnemyAttackDamage(world: TowerWorld, enemyId: number, targetId: number, baseDamage: number): number {
    if (!hasComponent(world.world, Boss, enemyId)) return baseDamage;
    if (!hasComponent(world.world, Tower, targetId)) return baseDamage;

    const towerMaxHp = Health.max[targetId] ?? 0;
    if (towerMaxHp <= 0) return baseDamage;

    return Math.max(baseDamage, Math.ceil(towerMaxHp / 3));
  }

  /**
   * 近战敌人刀光特效：复用 SlashEffect 组件，红/橙色调
   */
  private spawnEnemySlashEffect(
    world: TowerWorld,
    eid: number,
    targetId: number,
    posX: number,
    posY: number,
  ): void {
    const targetX = Position.x[targetId] ?? posX;
    const targetY = Position.y[targetId] ?? posY;

    const dx = targetX - posX;
    const dy = targetY - posY;
    const baseAngle = Math.atan2(dy, dx);

    const slashId = world.createEntity();
    world.addComponent(slashId, Position, { x: posX, y: posY });
    world.addComponent(slashId, SlashEffect, {
      duration: 0.3,
      elapsed: 0,
      radius: 35,
      startAngle: baseAngle - Math.PI / 4,
      endAngle: baseAngle + Math.PI / 4,
      colorR: 255,
      colorG: 180,
      colorB: 60,  // 橙色刀光，区别于士兵的白色
    });
  }

  /**
   * 远程敌人投射弹：创建 Projectile 实体飞向目标
   */
  private spawnEnemyProjectile(
    world: TowerWorld,
    eid: number,
    targetId: number,
    fromX: number,
    fromY: number,
    damage: number,
  ): void {
    const projId = world.createEntity();

    const visR = Visual.colorR[eid] ?? 0xff;
    const visG = Visual.colorG[eid] ?? 0x44;
    const visB = Visual.colorB[eid] ?? 0x44;

    world.addComponent(projId, Position, { x: fromX, y: fromY });
    world.addComponent(projId, Projectile, {
      speed: 300,
      damage,
      damageType: Attack.damageType[eid] ?? DamageTypeVal.Physical,
      targetId,
      sourceId: eid,
      fromX,
      fromY,
      shape: ShapeVal.Circle,
      colorR: visR,
      colorG: visG,
      colorB: visB,
      size: 10,
      splashRadius: 0,
      stunDuration: 0,
      slowPercent: 0,
      slowMaxStacks: 0,
      freezeDuration: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      isChain: 0,
      chainIndex: 0,
      drainAmount: 0,
      sourceTowerType: 255, // sentinel: enemy projectile (not a tower)
      targetX: 0,
      targetY: 0,
      flightTime: 0,
      totalTime: 0,
      vyInitial: 0,
    });
    world.addComponent(projId, Visual, {
      shape: ShapeVal.Circle,
      colorR: visR,
      colorG: visG,
      colorB: visB,
      size: 10,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
      facing: 1,
      bobPhase: 0,
      breathPhase: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0,
      partsId: 0,
    });
    world.addComponent(projId, Layer, { value: LayerVal.Ground });
  }

  // ================================================================
  // Soldier movement: HoldPosition / Patrol / ChaseTarget
  // ================================================================

  private processSoldiers(world: TowerWorld, dt: number): void {
    const soldiers = this.soldierQuery(world.world);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const sw = RenderSystem.sceneW;
    const sh = RenderSystem.sceneH;

    for (let i = 0; i < soldiers.length; i++) {
      const eid = soldiers[i]!;

      // Skip stunned/frozen
      if (Stunned.timer[eid]! > 0) continue;
      if (hasComponent(world.world, Frozen, eid)) continue;

      const mode = Movement.moveMode[eid]!;

      switch (mode) {
        case MoveModeVal.HoldPosition:
          // Do nothing — stay at current position
          break;

        case MoveModeVal.Patrol:
          this.soldierPatrol(world, eid, ox, oy, sw, sh, dt);
          break;

        case MoveModeVal.ChaseTarget:
          this.soldierChaseTarget(world, eid, ox, oy, sw, sh, dt);
          break;

        default:
          // Flee, PlayerDirected, FollowPath — not implemented for soldiers yet
          break;
      }
    }
  }

  /** Patrol: move to random points within moveRange of anchor */
  private soldierPatrol(
    world: TowerWorld,
    eid: number,
    ox: number,
    oy: number,
    sw: number,
    sh: number,
    dt: number,
  ): void {
    // Anchor: prefer Movement.homeX/Y, then Soldier.homeX/Y, then current position
    let anchorX = Movement.homeX[eid]!;
    let anchorY = Movement.homeY[eid]!;
    if (anchorX === 0 && anchorY === 0) {
      anchorX = Soldier.homeX[eid]!;
      anchorY = Soldier.homeY[eid]!;
    }
    if (anchorX === 0 && anchorY === 0) {
      anchorX = Position.x[eid]!;
      anchorY = Position.y[eid]!;
    }

    const moveRange = Soldier.moveRange[eid]! || Movement.moveRange[eid]! || 64;

    let targetX = Movement.targetX[eid]!;
    let targetY = Movement.targetY[eid]!;

    const currX = Position.x[eid]!;
    const currY = Position.y[eid]!;

    // No valid target or reached current target → pick a new random one
    if (targetX === 0 && targetY === 0) {
      const t = this.pickPatrolTarget(anchorX, anchorY, moveRange, ox, oy, sw, sh);
      Movement.targetX[eid] = t.tx;
      Movement.targetY[eid] = t.ty;
      targetX = t.tx;
      targetY = t.ty;
    } else {
      const toTargetDx = targetX - currX;
      const toTargetDy = targetY - currY;
      const toTargetDist = Math.sqrt(toTargetDx * toTargetDx + toTargetDy * toTargetDy);
      if (toTargetDist < SOLDIER_REACH_THRESHOLD) {
        const t = this.pickPatrolTarget(anchorX, anchorY, moveRange, ox, oy, sw, sh);
        Movement.targetX[eid] = t.tx;
        Movement.targetY[eid] = t.ty;
        targetX = t.tx;
        targetY = t.ty;
      }
    }

    this.soldierMoveToward(world, eid, targetX, targetY, dt);
  }

  /** ChaseTarget: move toward Movement.targetX/Y (set by SoldierAISystem) */
  private soldierChaseTarget(
    world: TowerWorld,
    eid: number,
    ox: number,
    oy: number,
    sw: number,
    sh: number,
    dt: number,
  ): void {
    const targetX = Movement.targetX[eid]!;
    const targetY = Movement.targetY[eid]!;

    // No valid target — hold position
    if (targetX === 0 && targetY === 0) return;

    this.soldierMoveToward(world, eid, targetX, targetY, dt);
  }

  /** Common soldier movement: advance toward (targetX, targetY) with loose collision */
  private soldierMoveToward(
    world: TowerWorld,
    eid: number,
    targetX: number,
    targetY: number,
    dt: number,
  ): void {
    const currX = Position.x[eid]!;
    const currY = Position.y[eid]!;

    const dx = targetX - currX;
    const dy = targetY - currY;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distToTarget < 0.1) return; // already there

    const rawSpeed = Movement.speed[eid]!;
    const buff = getEffectiveValue(eid, 'speed');
    const speed = Math.max(rawSpeed * 0.5, (rawSpeed + buff.absolute) * (1 + buff.percent / 100));
    const moveDist = Math.min(speed * dt, distToTarget);

    const dirX = dx / distToTarget;
    const dirY = dy / distToTarget;

    let newX = currX + dirX * moveDist;
    let newY = currY + dirY * moveDist;

    // Clamp to scene bounds
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const sw = RenderSystem.sceneW;
    const sh = RenderSystem.sceneH;
    const margin = 8;
    newX = Math.max(ox + margin, Math.min(ox + sw - margin, newX));
    newY = Math.max(oy + margin, Math.min(oy + sh - margin, newY));

    Position.x[eid] = newX;
    Position.y[eid] = newY;

    // Update facing based on movement direction
    const stepDx = newX - currX;
    if (stepDx > 0.05) Visual.facing[eid] = 1;
    else if (stepDx < -0.05) Visual.facing[eid] = -1;
    if (Math.abs(stepDx) > 0.05) {
      Visual.bobPhase[eid] = ((Visual.bobPhase[eid] ?? 0) + speed * dt * 0.08) % (Math.PI * 2);
    }
  }

  /** Pick a random patrol destination within moveRange radius of anchor point */
  private pickPatrolTarget(
    anchorX: number,
    anchorY: number,
    moveRange: number,
    ox: number,
    oy: number,
    sw: number,
    sh: number,
  ): { tx: number; ty: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * moveRange;
    let tx = anchorX + Math.cos(angle) * dist;
    let ty = anchorY + Math.sin(angle) * dist;
    const margin = 8;
    tx = Math.max(ox + margin, Math.min(ox + sw - margin, tx));
    ty = Math.max(oy + margin, Math.min(oy + sh - margin, ty));
    return { tx, ty };
  }

  // ================================================================
  // Static API for other systems
  // ================================================================

  /**
   * Find the nearest path waypoint index for an off-path entity.
   * Used by other systems (e.g. trap push-back) to determine where
   * the enemy should resume path-following.
   *
   * @param _world    TowerWorld instance (for API consistency)
   * @param x         World X coordinate to search from
   * @param y         World Y coordinate to search from
   * @param tileSize  Tile size in pixels
   * @returns Index of the nearest path waypoint (0-based), or 0 if path is empty
   */
  static findNearestPathIndex(_world: TowerWorld, x: number, y: number, tileSize: number): number {
    return MovementSystem.findNearestPathLocation(_world, x, y, tileSize).pathIndex;
  }

  static findNearestPathLocation(
    _world: TowerWorld,
    x: number,
    y: number,
    tileSize: number,
  ): { spawnIdx: number; pathIndex: number; progress: number } {
    const allPaths = MovementSystem._paths;
    const ts = tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    if (allPaths.length === 0) return { spawnIdx: 0, pathIndex: 0, progress: 0 };

    // Search across all path segments, so resumed entities keep their current
    // world position instead of jumping back to the nearest waypoint.
    let bestPathIdx = 0;
    let bestPointIdx = 0;
    let bestProgress = 0;
    let nearestDistSq = Infinity;
    for (let p = 0; p < allPaths.length; p++) {
      const path = allPaths[p]!;
      if (path.length < 2) continue;
      for (let i = 0; i < path.length - 1; i++) {
        const current = path[i]!;
        const next = path[i + 1]!;
        const cx = current.col * ts + ts / 2 + ox;
        const cy = current.row * ts + ts / 2 + oy;
        const nx = next.col * ts + ts / 2 + ox;
        const ny = next.row * ts + ts / 2 + oy;
        const sx = nx - cx;
        const sy = ny - cy;
        const lenSq = sx * sx + sy * sy;
        if (lenSq <= 0.0001) continue;
        const progress = Math.max(0, Math.min(1, ((x - cx) * sx + (y - cy) * sy) / lenSq));
        const px = cx + sx * progress;
        const py = cy + sy * progress;
        const dx = x - px;
        const dy = y - py;
        const dsq = dx * dx + dy * dy;
        if (dsq < nearestDistSq) {
          nearestDistSq = dsq;
          bestPathIdx = p;
          bestPointIdx = i;
          bestProgress = progress;
        }
      }
    }
    return { spawnIdx: bestPathIdx, pathIndex: bestPointIdx, progress: bestProgress };
  }
}
