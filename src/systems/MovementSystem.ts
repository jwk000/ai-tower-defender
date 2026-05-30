import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Movement, Health, UnitTag, Stunned, Frozen, Slowed, MoveModeVal,
  Visual, Attack, Projectile, DeathEffect, Trap, Category, CategoryVal, Soldier,
} from '../core/components.js';
import type { MapConfig, GridPos } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { getEffectiveValue } from './BuffSystem.js';
import { resolveGraphFromMap } from '../level/graph/loaderAdapter.js';
import { linearizeSpawnPaths } from '../level/graph/PathGraph.js';

interface CollisionResult {
  blocked: boolean;
  pushX: number;
  pushY: number;
}

/** Components excluded from collision — projectiles, death effects, traps pass through */
const EXCLUDE_COLLISION = [Projectile, DeathEffect, Trap] as const;

/** Distance threshold multiplier: enemy is "off-path" when perpendicular distance > ts * this */
const PATH_RECOVERY_MULT = 1.5;

/** Distance (px) within which a soldier considers itself at its patrol target */
const SOLDIER_REACH_THRESHOLD = 5;

/** Collision radius multiplier for soldier-on-soldier (looser — allows pushing past) */
const SOLDIER_VS_SOLDIER_RADIUS_MULT = 0.3;

export class MovementSystem implements System {
  readonly name = 'MovementSystem';

  /** Query: all moving units (enemies + player units) */
  private movingQuery = defineQuery([Position, Movement, UnitTag]);
  /** Query: player soldier entities (non-enemy with Soldier component) */
  private soldierQuery = defineQuery([Position, Movement, UnitTag, Soldier]);
  /** Query: all entities with physical presence (for collision detection) */
  private collisionQuery = defineQuery([Position, Visual]);
  /** Query: base objective entities (Category.Objective) for damage on enemy reach-end */
  private baseQuery = defineQuery([Position, Health, Category]);

  /** Per-spawn paths: paths[spawnIdx] = ordered GridPos[] from spawn to crystal_anchor */
  private readonly paths: readonly (readonly GridPos[])[];

  /** Static per-spawn paths — used by findNearestPathIndex for other systems */
  private static _paths: readonly (readonly GridPos[])[] = [];
  /** Static tile size — used by findNearestPathIndex */
  private static _tileSize = 0;

  constructor(private map: MapConfig) {
    const resolved = resolveGraphFromMap(map);
    const spawnPaths = linearizeSpawnPaths({ pathGraph: resolved.pathGraph, spawns: resolved.spawns });
    this.paths = spawnPaths.map((sp) => sp.path);
    MovementSystem._paths = this.paths;
    MovementSystem._tileSize = map.tileSize;
  }

  update(world: TowerWorld, dt: number): void {
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
      if (Stunned.timer[eid]! > 0) continue;

      // Skip frozen entities — completely immobilized
      if (hasComponent(world.world, Frozen, eid)) continue;

      // Skip if not in follow-path mode
      if (Movement.moveMode[eid] !== MoveModeVal.FollowPath) continue;

      // Select path for this enemy's spawn point
      const spawnIdx = Movement.spawnIdx[eid]!;
      const path = (spawnIdx >= 0 && spawnIdx < paths.length) ? paths[spawnIdx]! : paths[0]!;

      const pathIndex = Movement.pathIndex[eid]!;

      // Reached end of path — damage base and destroy
      if (pathIndex >= path.length - 1) {
        this.onReachEnd(world, eid);
        continue;
      }

      const posX = Position.x[eid]!;
      const posY = Position.y[eid]!;

      // --- Path-recovery: detect if enemy was pushed off-path ---
      if (this.tryPathRecovery(eid, pathIndex, path, ts, ox, oy, posX, posY, spawnIdx)) {
        continue; // position already snapped to nearest waypoint
      }

      const current = path[pathIndex]!;
      const next = path[pathIndex + 1]!;

      // World-space coordinates of current and next waypoint
      const cx = current.col * ts + ts / 2 + ox;
      const cy = current.row * ts + ts / 2 + oy;
      const nx = next.col * ts + ts / 2 + ox;
      const ny = next.row * ts + ts / 2 + oy;

      const dx = nx - cx;
      const dy = ny - cy;
      const segmentLen = Math.sqrt(dx * dx + dy * dy);

      if (segmentLen <= 0) continue;

      const rawSpeed = Movement.speed[eid]!;
      const buff = getEffectiveValue(eid, 'speed');
      const speed = (rawSpeed + buff.absolute) * (1 + buff.percent / 100);
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
      } else {
        Movement.progress[eid] = progress;
        newX = cx + dx * progress;
        newY = cy + dy * progress;
      }

      const radius = this.getEntityRadius(eid);

      // Collision avoidance
      const collision = this.checkCollision(world, eid, newX, newY, radius);

      if (collision.blocked) {
        const avoidance = this.findAvoidance(world, eid, posX, posY, radius, nx, ny);

        if (avoidance) {
          const avoidDx = avoidance.x - posX;
          const avoidDy = avoidance.y - posY;
          const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy);

          if (avoidDist > 0.1) {
            const avoidStep = Math.min(dist * 0.8, avoidDist);
            const avoidX = posX + (avoidDx / avoidDist) * avoidStep;
            const avoidY = posY + (avoidDy / avoidDist) * avoidStep;

            const recheck = this.checkCollision(world, eid, avoidX, avoidY, radius);
            Position.x[eid] = recheck.blocked ? newX : avoidX;
            Position.y[eid] = recheck.blocked ? newY : avoidY;
          } else {
            Position.x[eid] = newX;
            Position.y[eid] = newY;
          }
        } else {
          Position.x[eid] = newX;
          Position.y[eid] = newY;
        }
      } else {
        Position.x[eid] = newX;
        Position.y[eid] = newY;
      }

      const stepDx = Position.x[eid]! - posX;
      if (stepDx > 0.05) Visual.facing[eid] = 1;
      else if (stepDx < -0.05) Visual.facing[eid] = -1;
      if (Math.abs(stepDx) > 0.05) {
        Visual.bobPhase[eid] = ((Visual.bobPhase[eid] ?? 0) + speed * dt * 0.08) % (Math.PI * 2);
      }
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

    return true;
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
    const speed = (rawSpeed + buff.absolute) * (1 + buff.percent / 100);
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

    // Loose collision — soldiers push past each other
    const radius = this.getEntityRadius(eid);
    const collision = this.checkCollisionSoldier(world, eid, newX, newY, radius);

    if (collision.blocked) {
      // Gentle push away from collision, then re-clamp
      newX += collision.pushX * 0.5;
      newY += collision.pushY * 0.5;
      newX = Math.max(ox + margin, Math.min(ox + sw - margin, newX));
      newY = Math.max(oy + margin, Math.min(oy + sh - margin, newY));
    }

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

  /** Collision check with reduced radius for soldier-vs-soldier (looser — allows pushing past) */
  private checkCollisionSoldier(
    world: TowerWorld,
    selfId: number,
    x: number,
    y: number,
    selfRadius: number,
  ): CollisionResult {
    const result: CollisionResult = { blocked: false, pushX: 0, pushY: 0 };
    const others = this.collisionQuery(world.world);

    for (let i = 0; i < others.length; i++) {
      const otherId = others[i]!;
      if (otherId === selfId) continue;
      if (this.isExcluded(world, otherId)) continue;

      const otherX = Position.x[otherId]!;
      const otherY = Position.y[otherId]!;
      let otherRadius = this.getEntityRadius(otherId);

      // Looser collision between two soldiers
      let effectiveSelfRadius = selfRadius;
      let effectiveOtherRadius = otherRadius;
      if (hasComponent(world.world, Soldier, otherId)) {
        effectiveSelfRadius = selfRadius * SOLDIER_VS_SOLDIER_RADIUS_MULT;
        effectiveOtherRadius = otherRadius * SOLDIER_VS_SOLDIER_RADIUS_MULT;
      }

      const dx = x - otherX;
      const dy = y - otherY;
      const distSq = dx * dx + dy * dy;
      const minDist = effectiveSelfRadius + effectiveOtherRadius;

      if (distSq < minDist * minDist && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        result.blocked = true;
        result.pushX += nx * overlap;
        result.pushY += ny * overlap;
      }
    }

    return result;
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
  // onReachEnd — enemy reached the base
  // ================================================================

  /**
   * Deal damage to base and destroy enemy that reached the end.
   *
   * Damage source = UnitTag.atk (synced from ENEMY_CONFIGS[type].atk at spawn time).
   * Do NOT read `Attack.damage[eid]` here: bitecs TypedArray returns 0 (not undefined)
   * for entities without the Attack component (e.g. Grunt with attackRange=0),
   * which would silently neutralize all base damage from melee path-enders.
   */
  private onReachEnd(world: TowerWorld, eid: number): void {
    const damage = UnitTag.atk[eid] ?? 0;

    const bases = this.baseQuery(world.world);
    for (let i = 0; i < bases.length; i++) {
      const baseId = bases[i]!;
      if (Category.value[baseId] !== CategoryVal.Objective) continue;
      Health.current[baseId]! -= damage;
      if (Health.current[baseId]! < 0) Health.current[baseId]! = 0;
    }

    world.destroyEntity(eid);
  }

  // ================================================================
  // Collision helpers (shared)
  // ================================================================

  private getEntityRadius(eid: number): number {
    return (Visual.size[eid] ?? 32) / 2;
  }

  /** Check if moving to (x, y) would collide with any non-excluded entity */
  private checkCollision(
    world: TowerWorld,
    selfId: number,
    x: number,
    y: number,
    radius: number,
  ): CollisionResult {
    const result: CollisionResult = { blocked: false, pushX: 0, pushY: 0 };
    const others = this.collisionQuery(world.world);

    for (let i = 0; i < others.length; i++) {
      const otherId = others[i]!;
      if (otherId === selfId) continue;

      if (this.isExcluded(world, otherId)) continue;

      const otherX = Position.x[otherId]!;
      const otherY = Position.y[otherId]!;
      const otherRadius = this.getEntityRadius(otherId);

      const dx = x - otherX;
      const dy = y - otherY;
      const distSq = dx * dx + dy * dy;
      const minDist = radius + otherRadius;

      if (distSq < minDist * minDist && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        result.blocked = true;
        result.pushX += nx * overlap;
        result.pushY += ny * overlap;
      }
    }

    return result;
  }

  /** Find a perpendicular avoidance position near a blocking entity */
  private findAvoidance(
    world: TowerWorld,
    selfId: number,
    x: number,
    y: number,
    radius: number,
    targetX: number,
    targetY: number,
  ): { x: number; y: number } | null {
    const others = this.collisionQuery(world.world);

    for (let i = 0; i < others.length; i++) {
      const otherId = others[i]!;
      if (otherId === selfId) continue;

      if (this.isExcluded(world, otherId)) continue;

      const otherX = Position.x[otherId]!;
      const otherY = Position.y[otherId]!;
      const otherRadius = this.getEntityRadius(otherId);

      const dx = x - otherX;
      const dy = y - otherY;
      const distSq = dx * dx + dy * dy;
      const minDist = radius + otherRadius + 10;

      if (distSq < minDist * minDist && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        const toTargetX = targetX - x;
        const toTargetY = targetY - y;
        const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

        if (toTargetLen > 0.01) {
          const dirX = toTargetX / toTargetLen;
          const dirY = toTargetY / toTargetLen;
          const perpX = -dirY;
          const perpY = dirX;
          const dot = nx * perpX + ny * perpY;
          const sign = dot > 0 ? 1 : -1;
          return {
            x: otherX + (radius + otherRadius + 15) * perpX * sign,
            y: otherY + (radius + otherRadius + 15) * perpY * sign,
          };
        } else {
          return {
            x: otherX + nx * (radius + otherRadius + 15),
            y: otherY + ny * (radius + otherRadius + 15),
          };
        }
      }
    }

    return null;
  }

  /** Check if an entity should be excluded from collision (projectiles, effects, traps) */
  private isExcluded(world: TowerWorld, eid: number): boolean {
    for (const comp of EXCLUDE_COLLISION) {
      if (hasComponent(world.world, comp, eid)) return true;
    }
    return false;
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
    const allPaths = MovementSystem._paths;
    const ts = tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    if (allPaths.length === 0) return 0;

    // Search across all paths, return the index within the nearest path
    let bestPathIdx = 0;
    let bestPointIdx = 0;
    let nearestDistSq = Infinity;
    for (let p = 0; p < allPaths.length; p++) {
      const path = allPaths[p]!;
      for (let i = 0; i < path.length; i++) {
        const wp = path[i]!;
        const wx = wp.col * ts + ts / 2 + ox;
        const wy = wp.row * ts + ts / 2 + oy;
        const dx = x - wx;
        const dy = y - wy;
        const dsq = dx * dx + dy * dy;
        if (dsq < nearestDistSq) {
          nearestDistSq = dsq;
          bestPathIdx = p;
          bestPointIdx = i;
        }
      }
    }
    return bestPointIdx;
  }
}
