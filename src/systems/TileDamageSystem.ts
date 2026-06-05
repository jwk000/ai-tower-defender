// ============================================================
// Tower Defender — TileDamageSystem
//
// Manages TileDamageMark entities that show crater damage
// after missile explosions. Each crater is a circular area
// centered at the impact point, with crack lines radiating
// outward and a dark overlay that fades over time.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { TileDamageMark, Position } from '../core/components.js';
import { Renderer } from '../render/Renderer.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';

// ============================================================
// Query
// ============================================================

const damageQuery = defineQuery([TileDamageMark, Position]);

// ============================================================
// TileDamageSystem
// ============================================================

export class TileDamageSystem implements System {
  readonly name = 'TileDamageSystem';

  private map: MapConfig;

  constructor(map: MapConfig) {
    this.map = map;
  }

  update(world: TowerWorld, dt: number): void {
    const entities = damageQuery(world.world);

    for (const eid of entities) {
      TileDamageMark.elapsed[eid]! += dt;

      if (TileDamageMark.elapsed[eid]! >= TileDamageMark.duration[eid]!) {
        world.destroyEntity(eid);
      }
    }
  }

  /** Render all tile damage marks (canvas 2D post-render overlay) */
  render(renderer: Renderer, world: TowerWorld): void {
    const entities = damageQuery(world.world);
    if (entities.length === 0) return;

    const ctx = renderer.context;
    if (!ctx) return;

    const offsetX = RenderSystem.sceneOffsetX;
    const offsetY = RenderSystem.sceneOffsetY;

    ctx.save();

    for (const eid of entities) {
      const elapsed = TileDamageMark.elapsed[eid]!;
      const duration = TileDamageMark.duration[eid]!;
      const maxAlpha = TileDamageMark.maxAlpha[eid]!;
      const seed = TileDamageMark.crackSeed[eid]!;
      const craterRadius = TileDamageMark.craterRadius[eid]!;

      // Calculate alpha: full during most of duration, fade out in last 1s
      const fadeStart = duration - 1.0;
      let alpha: number;
      if (elapsed >= fadeStart) {
        alpha = maxAlpha * (1.0 - (elapsed - fadeStart) / 1.0);
      } else {
        alpha = maxAlpha;
      }
      if (alpha <= 0) continue;

      if (craterRadius > 0) {
        // ── Circular crater mode (missile impact) ──
        this.drawCircularCrater(ctx, eid, offsetX, offsetY, craterRadius, alpha, seed);
      } else {
        // ── Legacy tile-aligned mode (fallback) ──
        this.drawTileCrater(ctx, eid, offsetX, offsetY, alpha, seed);
      }
    }

    ctx.restore();
  }

  /** Draw circular crater centered at entity Position */
  private drawCircularCrater(
    ctx: CanvasRenderingContext2D,
    eid: number,
    _offsetX: number,
    _offsetY: number,
    radius: number,
    alpha: number,
    seed: number,
  ): void {
    const cx = Position.x[eid]!;
    const cy = Position.y[eid]!;

    if (!cx || !cy) return;

    // ---- Dark crater fill (radial gradient) ----
    const outerR = radius * 0.85;
    const innerR = radius * 0.25;

    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, `rgba(26, 18, 14, ${alpha * 0.65})`);   // dark center
    grad.addColorStop(0.5, `rgba(33, 33, 33, ${alpha * 0.45})`);
    grad.addColorStop(1, `rgba(50, 50, 50, ${alpha * 0.05})`);   // fade edge

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fill();

    // ---- Crater rim (thin dark ring at outer edge) ----
    ctx.strokeStyle = `rgba(40, 25, 18, ${alpha * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    // ---- Crack lines radiating from center ----
    const rng = seededRandom(seed);
    const crackCount = 6 + (seed % 5); // 6-10 cracks

    ctx.strokeStyle = `rgba(62, 39, 35, ${alpha})`;
    ctx.lineWidth = 1.2;

    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2 + rng() * 0.6;
      const len = outerR * (0.5 + rng() * 0.5);
      const startDist = innerR * (0.3 + rng() * 0.7);

      const sx = cx + Math.cos(angle) * startDist;
      const sy = cy + Math.sin(angle) * startDist;

      // Two-segment crack for jagged look
      const midFactor = 0.5 + rng() * 0.3;
      const midAngle = angle + (rng() - 0.5) * 0.8;
      const mx = sx + Math.cos(midAngle) * len * midFactor;
      const my = sy + Math.sin(midAngle) * len * midFactor;
      const ex = mx + Math.cos(midAngle + (rng() - 0.5) * 0.6) * len * (1 - midFactor);
      const ey = my + Math.sin(midAngle + (rng() - 0.5) * 0.6) * len * (1 - midFactor);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(mx, my);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    // ---- Small debris chunks near rim ----
    ctx.fillStyle = `rgba(44, 33, 28, ${alpha * 0.5})`;
    const debrisCount = 8 + (seed % 7); // 8-14 debris bits
    for (let i = 0; i < debrisCount; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = outerR * (0.6 + rng() * 0.35);
      const dx = cx + Math.cos(angle) * dist;
      const dy = cy + Math.sin(angle) * dist;
      const size = 2 + rng() * 3;
      ctx.beginPath();
      ctx.arc(dx, dy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Legacy tile-aligned crater for backward compatibility */
  private drawTileCrater(
    ctx: CanvasRenderingContext2D,
    eid: number,
    offsetX: number,
    offsetY: number,
    alpha: number,
    seed: number,
  ): void {
    const row = TileDamageMark.row[eid]!;
    const col = TileDamageMark.col[eid]!;
    const TILE_SIZE = 64;

    const cx = offsetX + col * TILE_SIZE;
    const cy = offsetY + row * TILE_SIZE;

    // Dark overlay on tile
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.4})`;
    ctx.fillRect(cx, cy, TILE_SIZE, TILE_SIZE);

    // Crack lines
    const rng = seededRandom(seed);
    const crackCount = 3 + (seed % 3);
    const centerX = cx + TILE_SIZE / 2;
    const centerY = cy + TILE_SIZE / 2;

    ctx.strokeStyle = `rgba(62, 39, 35, ${alpha})`;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < crackCount; i++) {
      ctx.beginPath();
      const angle = (i / crackCount) * Math.PI * 2 + rng() * 0.8;
      const len1 = 8 + rng() * 20;
      const len2 = 10 + rng() * 18;
      const startX = centerX + rng() * 12 - 6;
      const startY = centerY + rng() * 12 - 6;
      const midX = startX + Math.cos(angle) * len1;
      const midY = startY + Math.sin(angle) * len1;
      const endX = midX + Math.cos(angle + rng() * 1.2 - 0.6) * len2;
      const endY = midY + Math.sin(angle + rng() * 1.2 - 0.6) * len2;

      ctx.moveTo(startX, startY);
      ctx.lineTo(midX, midY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  /** Spawn a circular crater mark at the impact point */
  static spawnTileDamage(
    world: TowerWorld,
    hitX: number,
    hitY: number,
    blastRadius: number,
    _map: MapConfig,
  ): void {
    // Check for existing crater at this position and refresh it
    const existingEntities = damageQuery(world.world);
    for (const eid of existingEntities) {
      const craterR = TileDamageMark.craterRadius[eid];
      if (craterR !== undefined && craterR > 0) {
        const px = Position.x[eid]!;
        const py = Position.y[eid]!;
        const dx = px - hitX;
        const dy = py - hitY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // If existing crater center is within half the new blast radius, refresh it
        if (dist < blastRadius * 0.5) {
          TileDamageMark.elapsed[eid] = 0;
          return;
        }
      }
    }

    // Create new crater entity
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x: hitX, y: hitY });
    world.addComponent(eid, TileDamageMark, {
      row: 0,
      col: 0,
      duration: 3.0,
      elapsed: 0,
      crackSeed: Math.floor(Math.random() * 256),
      maxAlpha: 0.35 + Math.random() * 0.25,
      craterRadius: blastRadius,
    });
  }
}

// ============================================================
// Seeded PRNG (simple linear congruential generator)
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
