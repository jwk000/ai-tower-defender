import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Health, Trap, GridOccupant, Layer, LayerVal, DamageTypeVal, ExplosionEffect, Visual, ShapeVal,
  Boss, Stunned, Slowed, TrapTypeVal, UnitTag,
} from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';
import { TileType } from '../types/index.js';
import { Sound } from '../utils/Sound.js';

const trapQuery = defineQuery([Trap, Position, GridOccupant]);
const damageableQuery = defineQuery([Position, Health]);
const TRAP_COOLDOWN_EPSILON = 1e-6;

// Direction delta lookup by Trap.direction: 0=right, 1=down, 2=left, 3=up
const DIR_DC = [1, 0, -1, 0] as const;
const DIR_DR = [0, 1, 0, -1] as const;

/** Convert world pixel position to grid row/col */
function getEnemyGridPos(
  eid: number,
  ox: number,
  oy: number,
  ts: number,
): { row: number; col: number } {
  const col = Math.floor((Position.x[eid]! - ox) / ts);
  const row = Math.floor((Position.y[eid]! - oy) / ts);
  return { row, col };
}

/**
 * Grid-based trap system supporting 4 trap types per design/03-units.md §4.
 *
 * Each trap type has unique mechanics:
 *   0 SpikeTrap   — persistent damage/sec on same tile (layer gated)
 *   1 BearTrap    — reusable stun + damage, boss immune, cooldown-gated
 *   2 TarPit      — persistent configured slow on same tile
 *   3 Boulder     — has HP, blocks path, destroyed when HP≤0
 *   4 Bomb        — arms when stepped on, explodes after delay in a 3×3 ground area
 */
export class TrapSystem implements System {
  readonly name = 'TrapSystem';

  constructor(
    private tileSize: number,
    private map?: MapConfig,
  ) {}

  update(world: TowerWorld, dt: number): void {
    const traps = trapQuery(world.world);
    const damageableEntities = damageableQuery(world.world);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (const trapId of traps) {
      const trapType = Trap.trapType[trapId] ?? TrapTypeVal.SpikeTrap;

      // Tick cooldown timer for reusable traps. Bomb uses this field as fuse timer.
      if (trapType !== TrapTypeVal.Bomb && Trap.cooldownTimer[trapId]! > 0) {
        Trap.cooldownTimer[trapId] = Math.max(0, Trap.cooldownTimer[trapId]! - dt);
      }

      // Tick anim timer
      Trap.animTimer[trapId] = Math.max(0, Trap.animTimer[trapId]! - dt);

      const trapRow = GridOccupant.row[trapId] ?? 0;
      const trapCol = GridOccupant.col[trapId] ?? 0;
      const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
      switch (trapType) {
        case TrapTypeVal.SpikeTrap:
          this.tickSpikeTrap(world, trapId, damageableEntities, ox, oy, dt);
          break;

        case TrapTypeVal.BearTrap:
          this.tickBearTrap(world, trapId, damageableEntities, ox, oy);
          break;

        case TrapTypeVal.TarPit:
          this.tickTarPit(world, trapId, damageableEntities, ox, oy);
          break;

        case TrapTypeVal.Boulder:
          this.tickBoulder(world, trapId);
          break;

        case TrapTypeVal.Bomb:
          this.tickBomb(world, trapId, damageableEntities, ox, oy, dt);
          break;

        default:
          break;
      }
    }
  }

  // ============================================================
  // SpikeTrap (0) — damage/sec on same tile, layer-gated
  // ============================================================
  private tickSpikeTrap(
    world: TowerWorld,
    trapId: number,
    damageableEntities: readonly number[],
    ox: number,
    oy: number,
    dt: number,
  ): void {
    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
    const cooldown = Trap.cooldown[trapId] ?? 0;
    if (cooldown > 0 && (Trap.cooldownTimer[trapId] ?? 0) > TRAP_COOLDOWN_EPSILON) return;

    let damaging = false;

    for (const enemyId of damageableEntities) {
      if (!TrapSystem.isTrapTarget(world, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== trapRow || pos.col !== trapCol) continue;

      const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
      if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

      applyDamageToTarget(
        world,
        enemyId,
        Trap.damagePerSecond[trapId]!,
        DamageTypeVal.Physical,
      );
      damaging = true;
      if (cooldown > 0) {
        Trap.cooldownTimer[trapId] = cooldown;
      }
      break;
    }

    if (damaging) {
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
    }
  }

  // ============================================================
  // BearTrap (1) — reusable stun + damage, boss immune, cooldown-gated
  // ============================================================
  private tickBearTrap(
    world: TowerWorld,
    trapId: number,
    damageableEntities: readonly number[],
    ox: number,
    oy: number,
  ): void {
    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
    const triggerCount = Trap.triggerCount[trapId] ?? 0;
    const maxTriggers = Trap.maxTriggers[trapId] ?? 0;
    const stunDuration = Trap.stunDuration[trapId] ?? 2.0;
    const damage = Trap.damage[trapId] ?? 20;
    const configuredCooldown = Trap.cooldown[trapId] ?? 0;
    const cooldown = configuredCooldown > 0 ? configuredCooldown : 5.0;

    if (cooldown > 0 && (Trap.cooldownTimer[trapId] ?? 0) > TRAP_COOLDOWN_EPSILON) return;

    // Limited-use legacy configs should become inert instead of disappearing.
    if (maxTriggers > 0 && triggerCount >= maxTriggers) {
      return;
    }

    for (const enemyId of damageableEntities) {
      if (!TrapSystem.isTrapTarget(world, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== trapRow || pos.col !== trapCol) continue;

      const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
      if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

      // Boss immune
      if (hasComponent(world.world, Boss, enemyId)) continue;

      // Apply stun
      world.addComponent(enemyId, Stunned, { timer: stunDuration });

      // Apply damage
      if (damage > 0) {
        applyDamageToTarget(world, enemyId, damage, DamageTypeVal.Physical);
      }

      // Mark trap as triggered and start cooldown. The trap remains on the board.
      Trap.triggerCount[trapId] = triggerCount + 1;
      if (cooldown > 0) {
        Trap.cooldownTimer[trapId] = cooldown;
      }
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
      return;
    }
  }

  // ============================================================
  // TarPit (2) — persistent configured slow on same tile
  // ============================================================
  private tickTarPit(
    world: TowerWorld,
    trapId: number,
    damageableEntities: readonly number[],
    ox: number,
    oy: number,
  ): void {
    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
    const slowPercent = Trap.slowPercent[trapId] ?? 20;
    const slowDuration = Trap.slowDuration[trapId] ?? 0.3;
    let anyTriggered = false;

    for (const enemyId of damageableEntities) {
      if (!TrapSystem.isTrapTarget(world, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== trapRow || pos.col !== trapCol) continue;

      const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
      if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

      // Refresh each frame while on tile so the slow expires shortly after leaving.
      world.addComponent(enemyId, Slowed, {
        percent: slowPercent,
        timer: slowDuration,
        stacks: 1,
        maxStacks: 1,
      });
      anyTriggered = true;
    }

    if (anyTriggered) {
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
    }
  }

  // ============================================================
  // Boulder (3) — has HP, enemies must destroy it; HP≤0 → destroy
  // ============================================================
  private tickBoulder(world: TowerWorld, trapId: number): void {
    const hp = Health.current[trapId];
    if (hp !== undefined && hp <= 0) {
      world.destroyEntity(trapId);
    }
  }

  // ============================================================
  // Bomb (4) — path trap, arms on ground enemy crossing, explodes after delay
  // ============================================================
  private tickBomb(
    world: TowerWorld,
    trapId: number,
    damageableEntities: readonly number[],
    ox: number,
    oy: number,
    dt: number,
  ): void {
    const triggerCount = Trap.triggerCount[trapId] ?? 0;
    const armed = triggerCount > 0;

    if (!armed) {
      const trapRow = GridOccupant.row[trapId]!;
      const trapCol = GridOccupant.col[trapId]!;

      for (const enemyId of damageableEntities) {
        if (!TrapSystem.isTrapTarget(world, enemyId)) continue;
        if ((Layer.value[enemyId] ?? LayerVal.Ground) !== LayerVal.Ground) continue;

        const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
        if (pos.row !== trapRow || pos.col !== trapCol) continue;

        Trap.triggerCount[trapId] = 1;
        Trap.cooldownTimer[trapId] = Trap.slowDuration[trapId] || 1.0;
        Trap.animTimer[trapId] = Trap.cooldownTimer[trapId]!;
        return;
      }

      return;
    }

    Trap.cooldownTimer[trapId] = Math.max(0, (Trap.cooldownTimer[trapId] ?? 0) - dt);
    Trap.animTimer[trapId] = Trap.cooldownTimer[trapId]!;
    if ((Trap.cooldownTimer[trapId] ?? 0) > TRAP_COOLDOWN_EPSILON) return;

    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const damage = Trap.damage[trapId] ?? 90;

    for (const enemyId of damageableEntities) {
      if (!TrapSystem.isTrapTarget(world, enemyId)) continue;
      if ((Layer.value[enemyId] ?? LayerVal.Ground) !== LayerVal.Ground) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (Math.abs(pos.row - trapRow) > 1 || Math.abs(pos.col - trapCol) > 1) continue;

      applyDamageToTarget(world, enemyId, damage, DamageTypeVal.Physical);
    }

    this.createBombExplosion(world, Position.x[trapId]!, Position.y[trapId]!, Trap.radius[trapId] || this.tileSize * 3);
    Sound.play('skill_bomb');
    world.destroyEntity(trapId);
  }

  // ============================================================
  // Shared helpers
  // ============================================================

  /** Check if a tile is a path tile */
  private isPathTile(row: number, col: number): boolean {
    if (!this.map) return false;
    const tiles = this.map.tiles;
    if (row < 0 || row >= tiles.length) return false;
    const cols = tiles[row];
    if (!cols || col < 0 || col >= cols.length) return false;
    return cols[col] === TileType.Path;
  }

  private static isTrapTarget(world: TowerWorld, entityId: number): boolean {
    if (hasComponent(world.world, Trap, entityId)) return false;
    return hasComponent(world.world, UnitTag, entityId) && UnitTag.isEnemy[entityId] === 1;
  }

  private createBombExplosion(world: TowerWorld, x: number, y: number, radius: number): void {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 255,
      colorG: 120,
      colorB: 16,
      size: 0,
      alpha: 1,
      outline: 0,
    });
    world.addComponent(eid, ExplosionEffect, {
      duration: 0.5,
      elapsed: 0,
      radius: 0,
      maxRadius: radius,
      colorR: 255,
      colorG: 120,
      colorB: 16,
    });
  }

  /**
   * Layer trigger matrix per design/18-layer-system.md §5.4.
   * Exported as static helper to enable unit testing without world setup.
   */
  static canTriggerOnEnemy(trapLayer: number, enemyLayer: number): boolean {
    switch (trapLayer) {
      case LayerVal.AboveGrid:
        return enemyLayer === LayerVal.Ground || enemyLayer === LayerVal.AboveGrid;
      case LayerVal.BelowGrid:
        return true;
      case LayerVal.LowAir:
        return enemyLayer === LayerVal.LowAir;
      default:
        return enemyLayer === LayerVal.Ground || enemyLayer === LayerVal.AboveGrid;
    }
  }
}
