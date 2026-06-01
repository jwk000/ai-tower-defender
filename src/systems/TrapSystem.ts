import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Health, Trap, GridOccupant, Layer, LayerVal, DamageTypeVal,
  Boss, Stunned, Slowed, TrapTypeVal,
} from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';
import { TileType } from '../types/index.js';

const trapQuery = defineQuery([Trap, Position, GridOccupant]);
const damageableQuery = defineQuery([Position, Health]);

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
 * Grid-based trap system supporting 8 trap types per design/03-units.md §4.
 *
 * Each trap type has unique mechanics:
 *   0 SpikeTrap   — persistent damage/sec on same tile (layer gated)
 *   1 BearTrap    — single-use root for 1s, boss immune, then self-destruct
 *   2 TarPit      — persistent 20% slow on same tile
 *   3 Boulder     — has HP, blocks path, destroyed when HP≤0
 *   4 Fan         — 20% slow on front 3 tiles (directional)
 *   5 WaterPit    — 50% instant kill on adjacent path tiles
 *   6 BoxingGlove — push enemy 1 grid away, 3s cooldown (directional)
 *   7 MechanicalArm — pull enemy 1 grid toward, 4s cooldown (directional)
 */
export class TrapSystem implements System {
  readonly name = 'TrapSystem';

  constructor(
    private tileSize: number,
    private map?: MapConfig,
  ) {}

  update(world: TowerWorld, dt: number): void {
    const traps = trapQuery(world.world);
    const enemies = damageableQuery(world.world);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (const trapId of traps) {
      const trapType = Trap.trapType[trapId] ?? TrapTypeVal.SpikeTrap;

      // Tick cooldown timer for all traps
      if (Trap.cooldownTimer[trapId]! > 0) {
        Trap.cooldownTimer[trapId] = Math.max(0, Trap.cooldownTimer[trapId]! - dt);
      }

      // Tick anim timer
      Trap.animTimer[trapId] = Math.max(0, Trap.animTimer[trapId]! - dt);

      const trapRow = GridOccupant.row[trapId] ?? 0;
      const trapCol = GridOccupant.col[trapId] ?? 0;
      const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
      const dir = Trap.direction[trapId] ?? 0;
      const cdTimer = Trap.cooldownTimer[trapId] ?? 0;
      const cooldown = Trap.cooldown[trapId] ?? 0;

      switch (trapType) {
        case TrapTypeVal.SpikeTrap:
          this.tickSpikeTrap(world, trapId, enemies, ox, oy, dt);
          break;

        case TrapTypeVal.BearTrap:
          this.tickBearTrap(world, trapId, enemies, ox, oy);
          break;

        case TrapTypeVal.TarPit:
          this.tickTarPit(world, trapId, enemies, ox, oy);
          break;

        case TrapTypeVal.Boulder:
          this.tickBoulder(world, trapId);
          break;

        case TrapTypeVal.Fan:
          this.tickFan(world, trapId, enemies, ox, oy, trapRow, trapCol, dir);
          break;

        case TrapTypeVal.WaterPit:
          this.tickWaterPit(world, trapId, enemies, ox, oy, trapRow, trapCol);
          break;

        case TrapTypeVal.BoxingGlove:
          this.tickBoxingGlove(world, trapId, enemies, ox, oy, trapRow, trapCol, dir, cdTimer, cooldown, dt);
          break;

        case TrapTypeVal.MechanicalArm:
          this.tickMechanicalArm(world, trapId, enemies, ox, oy, trapRow, trapCol, dir, cdTimer, cooldown, dt);
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
    enemies: readonly number[],
    ox: number,
    oy: number,
    dt: number,
  ): void {
    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
    let damaging = false;

    for (const enemyId of enemies) {
      // Skip traps (including self) — damageableQuery includes all Position+Health entities
      if (hasComponent(world.world, Trap, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== trapRow || pos.col !== trapCol) continue;

      const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
      if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

      applyDamageToTarget(
        world,
        enemyId,
        Trap.damagePerSecond[trapId]! * dt,
        DamageTypeVal.Physical,
      );
      damaging = true;
      break;
    }

    if (damaging) {
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
    }
  }

  // ============================================================
  // BearTrap (1) — single-use root 1s, boss immune, self-destruct
  // ============================================================
  private tickBearTrap(
    world: TowerWorld,
    trapId: number,
    enemies: readonly number[],
    ox: number,
    oy: number,
  ): void {
    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
    const triggerCount = Trap.triggerCount[trapId] ?? 0;
    const maxTriggers = Trap.maxTriggers[trapId] ?? 0;

    // Already used up (maxTriggers > 0 && triggerCount >= maxTriggers)?
    if (maxTriggers > 0 && triggerCount >= maxTriggers) {
      world.destroyEntity(trapId);
      return;
    }

    for (const enemyId of enemies) {
      // Skip traps (including self) — damageableQuery includes all Position+Health entities
      if (hasComponent(world.world, Trap, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== trapRow || pos.col !== trapCol) continue;

      const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
      if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

      // Boss immune
      if (hasComponent(world.world, Boss, enemyId)) continue;

      // Apply 1.0s immobilization (Stunned)
      world.addComponent(enemyId, Stunned, { timer: 1.0 });

      // Mark trap as triggered and schedule destruction
      Trap.triggerCount[trapId] = triggerCount + 1;
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
      world.destroyEntity(trapId);
      return;
    }
  }

  // ============================================================
  // TarPit (2) — persistent 20% slow on same tile
  // ============================================================
  private tickTarPit(
    world: TowerWorld,
    trapId: number,
    enemies: readonly number[],
    ox: number,
    oy: number,
  ): void {
    const trapRow = GridOccupant.row[trapId]!;
    const trapCol = GridOccupant.col[trapId]!;
    const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
    let anyTriggered = false;

    for (const enemyId of enemies) {
      // Skip traps (including self) — damageableQuery includes all Position+Health entities
      if (hasComponent(world.world, Trap, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== trapRow || pos.col !== trapCol) continue;

      const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
      if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

      // Apply 20% slow — refresh each frame while on tile
      world.addComponent(enemyId, Slowed, {
        percent: 20,
        timer: 0.3,
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
  // Fan (4) — 20% slow on front 3 tiles (directional)
  // ============================================================
  private tickFan(
    world: TowerWorld,
    trapId: number,
    enemies: readonly number[],
    ox: number,
    oy: number,
    trapRow: number,
    trapCol: number,
    dir: number,
  ): void {
    const dc = DIR_DC[dir] ?? 0;
    const dr = DIR_DR[dir] ?? 0;
    let anyTriggered = false;

    for (const enemyId of enemies) {
      // Skip traps — damageableQuery includes all Position+Health entities
      if (hasComponent(world.world, Trap, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);

      // Check if enemy is in front 1-3 tiles in the facing direction
      for (let dist = 1; dist <= 3; dist++) {
        if (pos.row === trapRow + dr * dist && pos.col === trapCol + dc * dist) {
          world.addComponent(enemyId, Slowed, {
            percent: 20,
            timer: 0.3,
            stacks: 1,
            maxStacks: 1,
          });
          anyTriggered = true;
          break;
        }
      }
    }

    if (anyTriggered) {
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
    }
  }

  // ============================================================
  // WaterPit (5) — 50% instant kill on adjacent path tiles
  // ============================================================
  private tickWaterPit(
    world: TowerWorld,
    _trapId: number,
    enemies: readonly number[],
    ox: number,
    oy: number,
    trapRow: number,
    trapCol: number,
  ): void {
    // Cannot verify path tiles without map — skip
    if (!this.map) return;

    for (const enemyId of enemies) {
      // Skip traps — damageableQuery includes all Position+Health entities
      if (hasComponent(world.world, Trap, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);

      // Check if enemy is on an adjacent tile (4-directional)
      const dr = Math.abs(pos.row - trapRow);
      const dc = Math.abs(pos.col - trapCol);
      if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) continue;

      // Check if that tile is a path tile
      if (!this.isPathTile(pos.row, pos.col)) continue;

      // 50% instant kill
      if (Math.random() < 0.5) {
        Health.current[enemyId] = 0;
      }
    }
  }

  // ============================================================
  // BoxingGlove (6) — push enemy 1 grid away, 3s cooldown
  // ============================================================
  private tickBoxingGlove(
    world: TowerWorld,
    trapId: number,
    enemies: readonly number[],
    ox: number,
    oy: number,
    trapRow: number,
    trapCol: number,
    dir: number,
    cdTimer: number,
    _cooldown: number,
    _dt: number,
  ): void {
    if (cdTimer > 0) return;

    const dc = DIR_DC[dir] ?? 0;
    const dr = DIR_DR[dir] ?? 0;
    const frontTile = { row: trapRow + dr, col: trapCol + dc };

    for (const enemyId of enemies) {
      // Skip traps — damageableQuery includes all Position+Health entities
      if (hasComponent(world.world, Trap, enemyId)) continue;

      const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
      if (pos.row !== frontTile.row || pos.col !== frontTile.col) continue;

      // Push enemy 1 grid further away in the facing direction
      const ts = this.tileSize;
      Position.x[enemyId]! += dc * ts;
      Position.y[enemyId]! += dr * ts;

      // Set 3-second cooldown
      Trap.cooldownTimer[trapId] = 3.0;
      Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
      return;
    }
  }

  // ============================================================
  // MechanicalArm (7) — pull enemy 1 grid toward, 4s cooldown
  // ============================================================
  private tickMechanicalArm(
    world: TowerWorld,
    trapId: number,
    enemies: readonly number[],
    ox: number,
    oy: number,
    trapRow: number,
    trapCol: number,
    dir: number,
    cdTimer: number,
    _cooldown: number,
    _dt: number,
  ): void {
    if (cdTimer > 0) return;

    const dc = DIR_DC[dir] ?? 0;
    const dr = DIR_DR[dir] ?? 0;

    // Check front 1-2 tiles for enemies
    for (let dist = 2; dist >= 1; dist--) {
      const checkTile = { row: trapRow + dr * dist, col: trapCol + dc * dist };

      for (const enemyId of enemies) {
        // Skip traps — damageableQuery includes all Position+Health entities
        if (hasComponent(world.world, Trap, enemyId)) continue;

        const pos = getEnemyGridPos(enemyId, ox, oy, this.tileSize);
        if (pos.row !== checkTile.row || pos.col !== checkTile.col) continue;

        // Pull enemy 1 grid toward the trap (opposite of facing direction)
        const ts = this.tileSize;
        Position.x[enemyId]! -= dc * ts;
        Position.y[enemyId]! -= dr * ts;

        // Set 4-second cooldown
        Trap.cooldownTimer[trapId] = 4.0;
        Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
        return;
      }
    }
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
