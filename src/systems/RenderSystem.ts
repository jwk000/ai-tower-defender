// ============================================================
// Tower Defender — RenderSystem (bitecs migration)
//
// Canvas 2D map + entity rendering.
// Data access migrated from class-based components to bitecs SoA stores.
// All Canvas 2D drawing logic preserved as-is.
// ============================================================

import { TowerWorld, System, defineQuery, hasComponent } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { TileType, TowerType } from '../types/index.js';
import type { MapConfig, SceneLayout, ShapeType, CompositePart, UpgradeVisualConfig, UnitVisualParts } from '../types/index.js';
import {
  Position,
  Visual,
  Health,
  UnitTag,
  Tower,
  Attack,
  Projectile,
  BuffContainer,
  Boss,
  Category,
  CategoryVal,
  Movement,
  Trap,
  GridOccupant,
  ShapeVal,
  Slowed,
  AlertMark,
  AlertMarkVal,
  Frozen,
  Stunned,
  Poisoned,
  Production,
  Layer,
  LayerVal,
  TargetingMark,
  TileDamageMark,
  MissileCharge,
  BuildingTower,
  SlashEffect,
} from '../core/components.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { UNIT_CONFIGS, UPGRADE_VISUALS } from '../data/gameData.js';
import { formatNumber } from '../utils/formatNumber.js';
import { ScreenShakeSystem } from '../systems/ScreenShakeSystem.js';

// ---- TowerType numeric ID → enum mapping ----
const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
];

// ---- Query: all entities with position + visual ----
const renderableQuery = defineQuery([Position, Visual]);

// ---- Query: targeting marks + tile damage ----
const targetingMarkQuery = defineQuery([TargetingMark, Position]);
const tileDamageMarkQuery = defineQuery([TileDamageMark, Position]);

// ---- ShapeVal numeric -> string mapping ----
function shapeValToString(v: number): ShapeType {
  switch (v) {
    case ShapeVal.Rect:     return 'rect';
    case ShapeVal.Circle:   return 'circle';
    case ShapeVal.Triangle: return 'triangle';
    case ShapeVal.Diamond:  return 'diamond';
    case ShapeVal.Hexagon:  return 'hexagon';
    case ShapeVal.Arrow:    return 'arrow';
    default:                return 'rect';
  }
}

export function computeSceneLayout(map: MapConfig, canvasW: number, canvasH: number): SceneLayout {
  const mapPixelW = map.cols * map.tileSize;
  const mapPixelH = map.rows * map.tileSize;
  const offsetX = (canvasW - mapPixelW) / 2;

  // Vertical centering: map centered between HUD bottom and bottom panel top
  const topHUD = 36;       // UISystem.TOP_H — must match
  const panelH = 100;      // bottom panel height — must match UISystem
  const mapPanelGap = 8;   // gap between map bottom edge and panel top
  const availableV = canvasH - topHUD - panelH - mapPanelGap;
  const offsetY = topHUD + (availableV - mapPixelH) / 2;

  return { offsetX, offsetY, cols: map.cols, rows: map.rows, tileSize: map.tileSize, mapPixelW, mapPixelH };
}

// ---- Layer → render z-index mapping ----
const LAYER_TO_Z: Record<number, number> = {
  0: 3,  // Abyss → below ground, above decorations
  1: 3,  // BelowGrid
  2: 4,  // AboveGrid (traps) → above ground but below entities
  3: 5,  // Ground → default z
  4: 6,  // LowAir → above ground entities
  5: 7,  // Space → top
};

const HEALTH_BAR_HEIGHT = 6;
const HEALTH_BAR_HALF_H = HEALTH_BAR_HEIGHT / 2;
const CD_BAR_HEIGHT = 3;
const CD_BAR_HALF_H = CD_BAR_HEIGHT / 2;
const CD_BAR_GAP = 1;
const CD_BAR_COLOR = '#2196f3';

const RANK_CHEVRON_THICKNESS = 2;
const RANK_CHEVRON_ARM_LEN = 7;
const RANK_CHEVRON_ROW_GAP = 1;
const RANK_CHEVRON_ANGLE = Math.PI / 6;
const RANK_CHEVRON_FILL = '#e0e0e0';
const RANK_CHEVRON_STROKE = '#ffd700';
const RANK_STAR_SIZE = 5;
const RANK_STAR_COLOR = '#ffd700';
const RANK_STAR_GAP = 2;
const RANK_STAR_ROW_GAP = 2;
const RANK_INSIGNIA_BLOCK_WIDTH = 14;
const RANK_INSIGNIA_NAME_GAP = 4;

export class RenderSystem implements System {
  readonly name = 'RenderSystem';

  static sceneOffsetX = 0;
  static sceneOffsetY = 0;
  static sceneW = 0;
  static sceneH = 0;

  constructor(
    private renderer: Renderer,
    private map: MapConfig,
    private getSelectedTowerId: () => number | null = () => null,
    private getSelectedUnitId: () => number | null = () => null,
    private getSelectedTrapId: () => number | null = () => null,
    private getSelectedProductionId: () => number | null = () => null,
    private screenShakeSystem?: ScreenShakeSystem,
  ) {
    const layout = computeSceneLayout(map, LayoutManager.DESIGN_W, LayoutManager.DESIGN_H);
    RenderSystem.sceneOffsetX = layout.offsetX;
    RenderSystem.sceneOffsetY = layout.offsetY;
    RenderSystem.sceneW = layout.mapPixelW;
    RenderSystem.sceneH = layout.mapPixelH;
  }

  update(world: TowerWorld, dt: number): void {
    // Apply screen shake offset (composes on top of design transform from beginFrame)
    if (this.screenShakeSystem) {
      const state = this.screenShakeSystem.state;
      if (state.offsetX !== 0 || state.offsetY !== 0) {
        this.renderer.context.translate(state.offsetX, state.offsetY);
      }
    }
    this.drawMap(this.map);
    this.drawTargetingMarks(world, dt);
    this.drawTileDamageMarks(world);
    this.drawEntities(world, dt);
  }

  private drawMap(map: MapConfig): void {
    const ts = map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = map.cols * ts;
    const mapH = map.rows * ts;
    const tc = map.tileColors ?? {};

    const defaults: Partial<Record<TileType, string>> = {
      [TileType.Empty]: '#5e6b4e',
      [TileType.Path]: '#8a7d6b',
      [TileType.Blocked]: '#566570',
      [TileType.Spawn]: '#b86b1e',
      [TileType.Base]: '#1866a8',
    };
    const emptyAdjacentColor = '#6b7d5e';

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const x = c * ts + ts / 2 + ox;
        const y = r * ts + ts / 2 + oy;
        let color: string;

        switch (tile) {
          case TileType.Empty: {
            const adjacent = isAdjacentToPath(r, c, map);
            if (tc[TileType.Empty]) {
              color = tc[TileType.Empty]!;
            } else {
              color = adjacent ? emptyAdjacentColor : defaults[TileType.Empty]!;
            }
            break;
          }
          default:
            color = tc[tile] ?? defaults[tile] ?? '#333333';
            break;
        }

        this.renderer.push({ shape: 'rect', x, y, size: ts - 2, color, alpha: 1, z: 0 });

        if (tile === TileType.Empty && isAdjacentToPath(r, c, map) && !tc[TileType.Empty]) {
          this.renderer.push({
            shape: 'rect', x, y, size: ts - 2,
            color: '#5c7e5c',
            alpha: 0.2,
            stroke: '#709470',
            strokeWidth: 1,
            z: 0,
          });
        }
      }
    }

    // Obstacle rendering migrated to DecorationSystem

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        if (tile !== TileType.Spawn) continue;
        const sx = c * ts + ts / 2 + ox;
        const sy = r * ts + ts / 2 + oy;
        // Flag pole
        this.renderer.push({ shape: 'rect', x: sx, y: sy - 6, size: 2, h: 22, color: '#e0e0e0', alpha: 0.9, z: 0 });
        // Flag banner (small red rect)
        this.renderer.push({ shape: 'rect', x: sx + 7, y: sy - 12, size: 14, h: 8, color: '#ff1744', alpha: 0.95, z: 0 });
      }
    }

    // Scene border (4 thin rects — top, bottom, left, right)
    const borderW = 3;
    // Top
    this.renderer.push({ shape: 'rect', x: ox + mapW / 2, y: oy - borderW / 2, size: mapW + borderW * 2, h: borderW, color: '#111111', alpha: 1, z: 0 });
    // Bottom
    this.renderer.push({ shape: 'rect', x: ox + mapW / 2, y: oy + mapH + borderW / 2, size: mapW + borderW * 2, h: borderW, color: '#111111', alpha: 1, z: 0 });
    // Left
    this.renderer.push({ shape: 'rect', x: ox - borderW / 2, y: oy + mapH / 2, size: borderW, h: mapH, color: '#111111', alpha: 1, z: 0 });
    // Right
    this.renderer.push({ shape: 'rect', x: ox + mapW + borderW / 2, y: oy + mapH / 2, size: borderW, h: mapH, color: '#111111', alpha: 1, z: 0 });
  }

  // ============================================
  // TargetingMark rendering — concentric rings + crosshair
  // ============================================
  // Visual: 3 concentric rings (outer = blast radius, middle = 60%, inner = 25%) + 4-arm
  // crosshair extending past the outer ring. All red, pulsing alpha. Marker is destroyed
  // on missile impact (ProjectileSystem.onHit) so it disappears together with the boom.
  private drawTargetingMarks(world: TowerWorld, dt: number): void {
    const entities = targetingMarkQuery(world.world);
    for (const eid of entities) {
      const px = Position.x[eid]!;
      const py = Position.y[eid]!;
      const blastRadius = TargetingMark.blastRadius[eid]!;
      if (blastRadius <= 0) continue;

      TargetingMark.pulsePhase[eid]! += dt;
      const pulsePhase = TargetingMark.pulsePhase[eid]!;
      const pulse = 0.75 + 0.25 * Math.sin(pulsePhase * 10);

      const outerR = blastRadius;
      const midR = blastRadius * 0.6;
      const innerR = blastRadius * 0.25;

      this.renderer.push({
        shape: 'circle', x: px, y: py, size: outerR * 2,
        color: 'transparent', alpha: 0.55 * pulse,
        stroke: '#ff1744', strokeWidth: 3, z: 4,
      });
      this.renderer.push({
        shape: 'circle', x: px, y: py, size: midR * 2,
        color: 'transparent', alpha: 0.7 * pulse,
        stroke: '#ff1744', strokeWidth: 2, z: 4,
      });
      this.renderer.push({
        shape: 'circle', x: px, y: py, size: innerR * 2,
        color: 'transparent', alpha: 0.85 * pulse,
        stroke: '#d50000', strokeWidth: 2, z: 4,
      });

      const crossLen = outerR * 1.15;
      const crossThick = 2;
      this.renderer.push({
        shape: 'rect', x: px, y: py,
        size: crossThick, h: crossLen * 2,
        color: '#ff1744', alpha: 0.85 * pulse, z: 4,
      });
      this.renderer.push({
        shape: 'rect', x: px, y: py,
        size: crossLen * 2, h: crossThick,
        color: '#ff1744', alpha: 0.85 * pulse, z: 4,
      });

      this.renderer.push({
        shape: 'circle', x: px, y: py, size: 6,
        color: '#ff1744', alpha: 1, z: 4,
      });
    }
  }

  /**
   * 士兵 composite 渲染：身体 + 装饰部件 + 眼睛 + 武器，应用 bob/breath/挥砍动画。
   *
   * 绘制顺序（z 自下而上）：武器光晕 → 身体（带 breathing scale）→ bodyParts → 武器 → 眼睛
   * facing 决定 X 翻转；attackAnimTimer/Duration 驱动武器摆角；bobPhase 决定 bobY 偏移；breathPhase 决定身体 scale
   */
  private drawSoldierComposite(
    eid: number,
    posX: number,
    posY: number,
    drawSize: number,
    color: string,
    alpha: number,
    strokeColor: string | undefined,
    strokeW: number | undefined,
    z: number,
    parts: UnitVisualParts,
  ): void {
    const facing: number = (Visual.facing[eid] ?? 1) >= 0 ? 1 : -1;
    const bobPhase = Visual.bobPhase[eid] ?? 0;
    const breathPhase = Visual.breathPhase[eid] ?? 0;
    const attackDur = Visual.attackAnimDuration[eid] ?? 0;
    const attackTimer = Visual.attackAnimTimer[eid] ?? 0;

    const floating = parts.bobStyle === 'floating';
    const bobY = floating ? Math.sin(bobPhase) * 4 : Math.sin(bobPhase) * 2;
    const swayX = floating ? 0 : Math.sin(bobPhase * 0.5) * 0.6 * facing;
    const breathScale = 1 + Math.sin(breathPhase) * 0.04;
    const bodySize = drawSize * breathScale;

    const bodyX = posX + swayX;
    const bodyY = posY + bobY;

    const swingProgress = attackDur > 0 && attackTimer > 0
      ? 1 - attackTimer / attackDur
      : 0;
    const swingOffset = Math.sin(swingProgress * Math.PI);

    const shape: ShapeType = shapeValToString(Visual.shape[eid]!);

    if (parts.weapon) {
      const w = parts.weapon;
      const glowColor = w.glowColor;
      const glowRadius = w.glowRadius;
      if (glowColor !== undefined && glowRadius !== undefined && glowRadius > 0) {
        const ax = bodyX + w.anchorX * facing;
        const ay = bodyY + w.anchorY;
        const glowAlpha = (w.glowAlpha ?? 0.4) * (0.85 + 0.15 * Math.sin(Date.now() * 0.008));
        this.renderer.push({
          shape: 'circle',
          x: ax + (w.length * 0.5) * facing,
          y: ay,
          size: glowRadius * 2,
          color: glowColor,
          alpha: glowAlpha,
          z: z - 1,
        });
      }
    }

    this.renderer.push({
      shape,
      x: bodyX, y: bodyY,
      size: bodySize,
      color,
      alpha,
      stroke: strokeColor,
      strokeWidth: strokeW,
      z,
    });

    if (parts.bodyParts) {
      for (const part of parts.bodyParts) {
        this.renderer.push({
          shape: part.shape,
          x: bodyX + part.offsetX * facing,
          y: bodyY + part.offsetY,
          size: part.size,
          h: part.h,
          color: part.color,
          alpha: part.alpha ?? 1,
          stroke: part.stroke,
          strokeWidth: part.strokeWidth,
          rotation: part.rotation,
          z,
        });
      }
    }

    if (parts.weapon) {
      const w = parts.weapon;
      const ax = bodyX + w.anchorX * facing;
      const ay = bodyY + w.anchorY;
      const angle = (w.restAngle + swingOffset * w.swingAngle) * facing;
      const midX = ax + Math.cos(angle) * (w.length * 0.5) * facing;
      const midY = ay + Math.sin(angle) * (w.length * 0.5);
      this.renderer.push({
        shape: 'rect',
        x: midX,
        y: midY,
        size: w.length,
        h: w.width,
        color: w.color,
        alpha: 1,
        stroke: w.stroke,
        strokeWidth: w.strokeWidth,
        rotation: angle,
        z: z + 1,
      });
    }

    if (parts.eyes) {
      const e = parts.eyes;
      const eyeOffsetX = e.offsetX ?? drawSize * 0.18;
      const eyeOffsetY = e.offsetY ?? -drawSize * 0.12;
      const eyeY = bodyY + eyeOffsetY;
      const leftX = bodyX - eyeOffsetX;
      const rightX = bodyX + eyeOffsetX;
      if (e.scleraRadius && e.scleraRadius > 0) {
        this.renderer.push({ shape: 'circle', x: leftX, y: eyeY, size: e.scleraRadius * 2, color: e.scleraColor ?? '#ffffff', alpha: 1, z: z + 2 });
        this.renderer.push({ shape: 'circle', x: rightX, y: eyeY, size: e.scleraRadius * 2, color: e.scleraColor ?? '#ffffff', alpha: 1, z: z + 2 });
      }
      this.renderer.push({ shape: 'circle', x: leftX, y: eyeY, size: e.pupilRadius * 2, color: e.pupilColor, alpha: 1, z: z + 3 });
      this.renderer.push({ shape: 'circle', x: rightX, y: eyeY, size: e.pupilRadius * 2, color: e.pupilColor, alpha: 1, z: z + 3 });
    }
  }

  // ============================================
  // Missile projectile rendering — black body + red warhead + blue trail + orange glow
  // ============================================
  // Drawn 4-layer back-to-front (each at projectile's z):
  //   1) outer orange-red glow halo (pulsing)
  //   2) blue exhaust trail (3 fading dots behind, sized by velocity angle)
  //   3) black missile body (rotated rect aligned with flight direction)
  //   4) red warhead (diamond at the front tip)
  private drawMissileProjectile(eid: number, posX: number, posY: number): void {
    const angle = Visual.idlePhase[eid] ?? 0;
    const size = Visual.size[eid] ?? 40;
    const layerVal = Layer.value[eid] ?? LayerVal.Ground;
    const z = LAYER_TO_Z[layerVal] ?? 5;

    const bodyLen = size;
    const bodyW = Math.max(6, size * 0.32);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.012);
    this.renderer.push({
      shape: 'circle', x: posX, y: posY, size: size * 1.6 * pulse,
      color: '#ff5722', alpha: 0.22, z,
    });
    this.renderer.push({
      shape: 'circle', x: posX, y: posY, size: size * 1.0 * pulse,
      color: '#ff8a50', alpha: 0.35, z,
    });

    for (let i = 1; i <= 3; i++) {
      const dist = bodyLen * 0.45 + i * bodyLen * 0.45;
      const tx = posX - cos * dist;
      const ty = posY - sin * dist;
      const tAlpha = 0.7 - i * 0.18;
      const tSize = bodyW * (1.4 - i * 0.25);
      this.renderer.push({
        shape: 'circle', x: tx, y: ty, size: tSize * 1.8,
        color: '#40c4ff', alpha: tAlpha * 0.4, z,
      });
      this.renderer.push({
        shape: 'circle', x: tx, y: ty, size: tSize,
        color: '#82e9ff', alpha: tAlpha, z,
      });
    }

    this.renderer.push({
      shape: 'rect', x: posX, y: posY,
      size: bodyLen, h: bodyW,
      color: '#111111', alpha: 1,
      stroke: '#3a3a3a', strokeWidth: 1,
      rotation: angle, z,
    });

    const headLen = bodyLen * 0.4;
    const tipX = posX + cos * (bodyLen * 0.5 + headLen * 0.5);
    const tipY = posY + sin * (bodyLen * 0.5 + headLen * 0.5);
    this.renderer.push({
      shape: 'diamond', x: tipX, y: tipY,
      size: bodyW * 1.4,
      color: '#ff1744', alpha: 1, z,
    });
    this.renderer.push({
      shape: 'circle', x: tipX, y: tipY, size: bodyW * 0.55,
      color: '#ffcdd2', alpha: 0.9, z,
    });
  }

  // ============================================
  // TileDamageMark rendering (circular crater or legacy tile-aligned damage)
  // ============================================
  private drawTileDamageMarks(world: TowerWorld): void {
    const entities = tileDamageMarkQuery(world.world);
    const ts = this.map.tileSize;

    for (const eid of entities) {
      const craterRadius = TileDamageMark.craterRadius[eid]!;
      const duration = TileDamageMark.duration[eid]!;
      const elapsed = TileDamageMark.elapsed[eid]!;
      const crackSeed = TileDamageMark.crackSeed[eid]!;
      const maxAlpha = TileDamageMark.maxAlpha[eid]!;

      // Fade out in last 1.0 second
      let fadeFactor: number;
      if (elapsed < duration - 1.0) {
        fadeFactor = 1.0;
      } else {
        fadeFactor = Math.max(0, 1.0 - (elapsed - (duration - 1.0)) / 1.0);
      }
      const alpha = maxAlpha * fadeFactor;

      if (craterRadius > 0) {
        // ── Circular crater mode (missile impact, center = entity Position) ──
        const cx = Position.x[eid]!;
        const cy = Position.y[eid]!;
        const outerR = craterRadius * 0.85;

        // Dark crater fill (large filled circle)
        this.renderer.push({
          shape: 'circle', x: cx, y: cy, size: outerR * 2,
          color: '#1a120e', alpha: alpha * 0.55, z: 1,
        });
        // Rim ring
        this.renderer.push({
          shape: 'circle', x: cx, y: cy, size: outerR * 1.84,
          color: 'transparent', alpha: alpha * 0.35,
          stroke: '#281912', strokeWidth: 2, z: 2,
        });

        // ---- Crack lines (thin rects rotated, seeded PRNG) ----
        const rand = simplePRNG(crackSeed);
        const crackCount = 6 + (crackSeed % 5); // 6-10 cracks
        for (let i = 0; i < crackCount; i++) {
          const angle = rand() * Math.PI * 2;
          const len = outerR * (0.5 + rand() * 0.5);
          const startDist = craterRadius * 0.25 * (0.3 + rand() * 0.7);
          const sx = cx + Math.cos(angle) * startDist;
          const sy = cy + Math.sin(angle) * startDist;

          this.renderer.push({
            shape: 'rect',
            x: sx, y: sy,
            size: 1.2, h: len,
            color: '#3e2723', alpha: alpha * 0.7,
            rotation: angle - Math.PI / 2, // rect drawn from left→right, rotate to match angle
            z: 2,
          });
        }

        // ---- Debris dots around rim ----
        const debrisCount = 8 + (crackSeed % 7);
        for (let i = 0; i < debrisCount; i++) {
          const angle = rand() * Math.PI * 2;
          const dist = outerR * (0.6 + rand() * 0.35);
          const dx = cx + Math.cos(angle) * dist;
          const dy = cy + Math.sin(angle) * dist;
          this.renderer.push({
            shape: 'circle',
            x: dx, y: dy,
            size: 2 + rand() * 3,
            color: '#2c211c',
            alpha: alpha * (0.35 + rand() * 0.35),
            z: 2,
          });
        }
      } else {
        // ── Legacy tile-aligned mode (fallback) ──
        const row = TileDamageMark.row[eid]!;
        const col = TileDamageMark.col[eid]!;

        // Tile center position (matches drawMap tile positioning)
        const tileX = RenderSystem.sceneOffsetX + col * ts + ts / 2;
        const tileY = RenderSystem.sceneOffsetY + row * ts + ts / 2;

        // ---- Dark overlay ----
        this.renderer.push({
          shape: 'rect', x: tileX, y: tileY, size: ts,
          color: '#000000', alpha: alpha * 0.4, z: 1,
        });

        // ---- Crack dots (scattered dots from center, seeded PRNG) ----
        const rand = simplePRNG(crackSeed);
        const numDots = 10 + (crackSeed % 6);
        for (let i = 0; i < numDots; i++) {
          const angle = rand() * Math.PI * 2;
          const dist = ts * 0.1 + rand() * ts * 0.4;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist;
          this.renderer.push({
            shape: 'circle',
            x: tileX + dx, y: tileY + dy,
            size: 1.5 + rand() * 3,
            color: '#3e2723',
            alpha: alpha * (0.5 + rand() * 0.5),
            z: 2,
          });
        }
      }
    }
  }

  private drawEntities(world: TowerWorld, dt: number): void {
    const entities = renderableQuery(world.world);

    // Build sorted array: entity id + position for Y-sorting
    const sorted = (entities as number[])
      .filter((eid: number) => typeof Position.x[eid]! === 'number' && typeof Position.y[eid]! === 'number')
      .sort((a: number, b: number) => Position.y[a]! - Position.y[b]!);

    const selectedTowerId = this.getSelectedTowerId();
    const selectedUnitId = this.getSelectedUnitId();
    const selectedTrapId = this.getSelectedTrapId();
    const selectedProductionId = this.getSelectedProductionId();

    for (const eid of sorted) {
      const posX = Position.x[eid]!;
      const posY = Position.y[eid]!;

      // ---- Type identification ----
      const isProjectile = hasComponent(world.world, Projectile, eid);
      const isEnemy = hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Enemy;
      const isTower = hasComponent(world.world, Tower, eid);
      const isTrap = hasComponent(world.world, Trap, eid);
      const isUnit = hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Soldier;
      const isProduction = hasComponent(world.world, Production, eid);

      // ---- Missile projectile: dedicated multi-layer visual (glow + black body + red head + blue trail) ----
      // sourceTowerType=6 (Missile) gets a fully custom render path. Bypasses the generic arrow render.
      if (isProjectile && Projectile.sourceTowerType[eid] === 6) {
        this.drawMissileProjectile(eid, posX, posY);
        continue;
      }

      // ---- Buff/status flags (computed once) ----
      const hasFrozen = hasComponent(world.world, Frozen, eid);
      const hasSlowed = hasComponent(world.world, Slowed, eid);
      const hasStunnedComponent = hasComponent(world.world, Stunned, eid);

      // ========================================
      // TRAP rendering — 根据机关类型绘制不同外观
      // ========================================
      if (isTrap) {
        const animTimer = Trap.animTimer[eid]!;
        const animDuration = Trap.animDuration[eid]!;
        const trapType = Trap.trapType[eid] ?? 0;
        const trapDirection = Trap.direction[eid] ?? 0;

        // 动画进度（0→1）
        const animProgress = animTimer > 0 ? (1 - animTimer / animDuration) : 0;
        const animFactor = Math.sin(animProgress * Math.PI);

        switch (trapType) {
          case 0: // SpikeTrap - 地刺：灰色三角形尖刺从地面冒出
          {
            const spikeOffset = -animFactor * 12;
            const spikeSizeBonus = animFactor * 6;
            for (let o = -1; o <= 1; o++) {
              this.renderer.push({
                shape: 'triangle',
                x: posX + o * 8,
                y: posY + spikeOffset,
                size: 14 + spikeSizeBonus,
                color: '#757575',
                alpha: 1,
              });
            }
            break;
          }

          case 1: // BearTrap - 捕兽夹：金属锯齿夹子
          {
            // 两个菱形组合表示夹子
            this.renderer.push({
              shape: 'diamond',
              x: posX - 6,
              y: posY,
              size: 16,
              color: '#8d6e63',
              alpha: 1,
            });
            this.renderer.push({
              shape: 'diamond',
              x: posX + 6,
              y: posY,
              size: 16,
              color: '#8d6e63',
              alpha: 1,
            });
            // 中心锯齿
            this.renderer.push({
              shape: 'rect',
              x: posX,
              y: posY,
              size: 8,
              h: 4,
              color: '#d7ccc8',
              alpha: 1,
            });
            break;
          }

          case 2: // TarPit - 焦油坑：黑色半透明圆形
          {
            this.renderer.push({
              shape: 'circle',
              x: posX,
              y: posY,
              size: 28,
              color: '#424242',
              alpha: 0.7,
            });
            // 内部深色
            this.renderer.push({
              shape: 'circle',
              x: posX,
              y: posY,
              size: 18,
              color: '#212121',
              alpha: 0.8,
            });
            break;
          }

          case 3: // Boulder - 巨石：灰色大型岩石
          {
            // 主体圆形
            this.renderer.push({
              shape: 'circle',
              x: posX,
              y: posY,
              size: 36,
              color: '#78909c',
              alpha: 1,
            });
            // 裂纹装饰
            this.renderer.push({
              shape: 'rect',
              x: posX - 8,
              y: posY - 4,
              size: 12,
              h: 2,
              color: '#546e7a',
              alpha: 1,
            });
            this.renderer.push({
              shape: 'rect',
              x: posX + 6,
              y: posY + 6,
              size: 10,
              h: 2,
              color: '#546e7a',
              alpha: 1,
            });
            break;
          }

          default: {
            // 默认地刺样式
            const spikeOffset = -animFactor * 12;
            const spikeSizeBonus = animFactor * 6;
            for (let o = -1; o <= 1; o++) {
              this.renderer.push({
                shape: 'triangle',
                x: posX + o * 8,
                y: posY + spikeOffset,
                size: 14 + spikeSizeBonus,
                color: '#757575',
                alpha: 1,
              });
            }
          }
        }
        continue;
      }

      // ========================================
      // Hit flash
      // ========================================
      const flashActive = Visual.hitFlashTimer[eid]! > 0;
      let displayColor = rgbFromVisual(eid);
      let displayAlpha = Visual.alpha[eid]!;
      if (flashActive) {
        displayColor = '#ffffff';
        displayAlpha = 1;
        Visual.hitFlashTimer[eid]! = 0;
      }

      // ========================================
      // Buff visual effects (frozen / slow)
      // ========================================
      if (!flashActive) {
        if (hasFrozen) {
          displayColor = '#00bcd4';
          displayAlpha = 1;
        } else if (hasSlowed) {
          const stacks = Slowed.stacks[eid]!;
          const t = Math.min(stacks / 5, 1);
          displayColor = this.lerpColorRGB(
            Visual.colorR[eid]!, Visual.colorG[eid]!, Visual.colorB[eid]!,
            '#4488cc', t * 0.7,
          );
        }
      }

      // ========================================
      // Enemy stun visual
      // ========================================
      if (isEnemy && !flashActive) {
        if (hasStunnedComponent && Stunned.timer[eid]! > 0) {
          displayColor = '#ffd700';
          displayAlpha = 0.9;
        }
      }

      // ========================================
      // Poison visual — green tint (shader effect via lerp)
      // ========================================
      const hasPoisoned = hasComponent(world.world, Poisoned, eid);
      if (hasPoisoned && !flashActive && !hasFrozen) {
        const poisonIntensity = Poisoned.intensity[eid]! || 1.0;
        const poisonTimer = Poisoned.timer[eid]! || 0;
        // Pulse the tint intensity
        const pulse = 0.7 + 0.3 * Math.sin(poisonTimer * 4);
        const t = poisonIntensity * pulse * 0.6;
        displayColor = this.lerpColorRGB(
          Visual.colorR[eid]!, Visual.colorG[eid]!, Visual.colorB[eid]!,
          '#4caf50', t,
        );
      }

      // ========================================
      // Boss rendering
      // ========================================
      const isBossEntity = hasComponent(world.world, Boss, eid);
      let drawSize = Visual.size[eid]!;
      if (isBossEntity) {
        drawSize = Visual.size[eid]! * 1.3;
        if (Boss.phase[eid]! === 2 && !flashActive) {
          if (Boss.transitionTimer[eid]! > 0) {
            const cycle = Math.floor(Boss.transitionTimer[eid]! / 0.1) % 2;
            displayColor = cycle === 0 ? '#ffffff' : '#d32f2f';
            displayAlpha = 1;
          } else {
            displayColor = this.lerpColorRGB(
              Visual.colorR[eid]!, Visual.colorG[eid]!, Visual.colorB[eid]!,
              '#d32f2f', 0.35,
            );
          }
        }
      }

      // ========================================
      // Selection highlight
      // ========================================
      const isSelected = (selectedTowerId !== null && eid === selectedTowerId) ||
        (selectedUnitId !== null && eid === selectedUnitId) ||
        (selectedTrapId !== null && eid === selectedTrapId) ||
        (selectedProductionId !== null && eid === selectedProductionId);
      let strokeColor = isSelected ? '#ffffff' : (Visual.outline[eid] ? '#ffffff' : undefined);
      let strokeW = isSelected ? 3 : (Visual.outline[eid] ? 2 : undefined);

      // ========================================
      // Elite enemy rendering — gold border + 20% size increase
      // design/02-gameplay.md §2.4: 金色边框+体型增大20%
      // ========================================
      const isEliteEnemy = isEnemy && (UnitTag.isElite[eid] ?? 0) === 1;
      if (isEliteEnemy) {
        drawSize = drawSize * 1.2;
        if (!isSelected) {
          strokeColor = '#FFD700';
          strokeW = 3;
        }
      }

      // ========================================
      // Unit move-range circle (when selected)
      // ========================================
      if (isUnit && selectedUnitId === eid) {
        if (hasComponent(world.world, Movement, eid)) {
          const moveRange = Movement.moveRange[eid]!;
          this.renderer.push({
            shape: 'circle',
            x: posX,
            y: posY,
            size: moveRange * 2,
            color: '#4fc3f7',
            alpha: 0.15,
            stroke: '#4fc3f7',
            strokeWidth: 1,
          });
        }
      }

      // ========================================
      // Build pushCmd for single-shape entities
      // ========================================
      const pushCmd = (extras: Partial<Parameters<typeof this.renderer.push>[0]> = {}) => {
        let shape: ShapeType = shapeValToString(Visual.shape[eid]!);
        let targetX: number | undefined;
        let targetY: number | undefined;

        if (isProjectile) {
          shape = 'arrow';
          const projTargetId = Projectile.targetId[eid]!;
          if (projTargetId > 0 && typeof Position.x[projTargetId] === 'number') {
            targetX = Position.x[projTargetId];
            targetY = Position.y[projTargetId];
          }
        }

        this.renderer.push({
          shape,
          x: posX, y: posY,
          size: drawSize,
          color: displayColor,
          alpha: displayAlpha,
          stroke: strokeColor,
          strokeWidth: strokeW,
          targetX,
          targetY,
          z: renderZ,
          ...extras,
        });
      };

      // ========================================
      // Per-level upgrade visuals for towers
      // ========================================
      let upgradeVisual: UpgradeVisualConfig | undefined;
      const towerLevel = Tower.level[eid] ?? 1;
      if (isTower) {
        const towerTypeEnum = TOWER_TYPE_BY_ID[Tower.towerType[eid]!];
        const upgradeKey = towerTypeEnum + '_tower';
        if (towerTypeEnum && UPGRADE_VISUALS[upgradeKey]) {
          const levelConfigs = UPGRADE_VISUALS[upgradeKey]!;
          upgradeVisual = levelConfigs[towerLevel - 1];
          if (upgradeVisual) {
            drawSize = Math.round(drawSize * upgradeVisual.scaleMultiplier);
          }
        }
      }

      // ========================================
      // Layer → render z-index
      // ========================================
      const layerVal = Layer.value[eid] ?? LayerVal.Ground;
      const renderZ = LAYER_TO_Z[layerVal] ?? 5;

      // ========================================
      // Glow rendering (L3+ towers)
      // ========================================
      if (upgradeVisual?.glow) {
        const g = upgradeVisual.glow;
        const pulseMult = g.pulseAmplitude ? 1 + Math.sin(Date.now() * 0.003) * g.pulseAmplitude : 1;
        const glowRadius = Math.round(g.radius * pulseMult);
        this.renderer.push({
          shape: 'circle',
          x: posX,
          y: posY,
          size: glowRadius * 2,
          color: g.color,
          alpha: g.alpha * 0.5,
          z: renderZ,
        });
        // Second glow layer (larger, more transparent)
        if (towerLevel >= 4) {
          this.renderer.push({
            shape: 'circle',
            x: posX,
            y: posY,
            size: glowRadius * 3,
            color: g.color,
            alpha: g.alpha * 0.2,
            z: renderZ,
          });
        }
      }

      // ========================================
      // Building period: half-transparent body so player can see placement
      // ========================================
      const isBuilding = isTower && hasComponent(world.world, BuildingTower, eid);
      if (isBuilding) {
        displayAlpha *= 0.5;
      }

      // ========================================
      // MissileCharge visual (pulsing red glow + alpha flicker)
      // ========================================
      if (isTower && hasComponent(world.world, MissileCharge, eid)) {
        const chargeElapsed = MissileCharge.chargeElapsed[eid]!;
        const glowAlpha = 0.15 + 0.25 * Math.sin(chargeElapsed * 10);
        this.renderer.push({
          shape: 'circle',
          x: posX,
          y: posY,
          size: drawSize * 2 + 16,
          color: '#ff1744',
          alpha: glowAlpha,
          z: renderZ,
        });
        displayAlpha *= (0.85 + 0.15 * Math.sin(chargeElapsed * 10));
      }

      // ========================================
      // Poison glow aura (below entity body)
      // ========================================
      if (hasPoisoned && !isProjectile) {
        const poisonTimer = Poisoned.timer[eid]! || 0;
        this.renderer.drawPoisonGlow(posX, posY, drawSize, poisonTimer);
      }

      // ========================================
      // Enemy attack animation: squash-stretch deformation
      // ========================================
      let attackAnimPosX = posX;
      let attackAnimPosY = posY;
      let attackAnimSize = drawSize;
      if (isEnemy) {
        const atkTimer = Visual.attackAnimTimer[eid]!;
        const atkDur = Visual.attackAnimDuration[eid]!;
        if (atkTimer > 0 && atkDur > 0) {
          const progress = 1 - atkTimer / atkDur;
          const facing = Visual.facing[eid] ?? 1;

          // Phase 1: wind-up (0-35%) — shrink
          // Phase 2: strike (35-60%) — expand + lunge toward target
          // Phase 3: recovery (60-100%) — spring back to normal
          let scale = 1.0;
          let lungeDist = 0;
          if (progress < 0.35) {
            const t = progress / 0.35;
            scale = 1 - 0.15 * t;
          } else if (progress < 0.6) {
            const t = (progress - 0.35) / 0.25;
            scale = 0.85 + 0.3 * t;
            lungeDist = 6 * Math.sin(t * Math.PI);
          } else {
            const t = (progress - 0.6) / 0.4;
            scale = 1 + 0.1 * (1 - t);
          }
          attackAnimSize = drawSize * scale;
          attackAnimPosX = posX + lungeDist * facing;
        }
      }

      // ========================================
      // 1. Entity body (bottom layer — drawn first)
      // ========================================
      const unitPartsId = Visual.partsId[eid] ?? 0;
      if ((isUnit || isEnemy) && unitPartsId !== 0) {
        const parts = world.getUnitVisualParts(unitPartsId);
        if (parts) {
          this.drawSoldierComposite(eid, attackAnimPosX, attackAnimPosY, attackAnimSize, displayColor, displayAlpha, strokeColor, strokeW, renderZ, parts);
        } else {
          // Use attack-animated position/size for simple-shape enemies
          this.renderer.push({
            shape: shapeValToString(Visual.shape[eid]!),
            x: attackAnimPosX, y: attackAnimPosY,
            size: attackAnimSize,
            color: displayColor,
            alpha: displayAlpha,
            stroke: strokeColor,
            strokeWidth: strokeW,
            z: renderZ,
          });
        }
      } else {
        // Use attack-animated position/size for simple-shape enemies/non-unit entities
        if (isEnemy) {
          this.renderer.push({
            shape: shapeValToString(Visual.shape[eid]!),
            x: attackAnimPosX, y: attackAnimPosY,
            size: attackAnimSize,
            color: displayColor,
            alpha: displayAlpha,
            stroke: strokeColor,
            strokeWidth: strokeW,
            z: renderZ,
          });
        } else {
          pushCmd();
        }
      }

      // ========================================
      // Enemy attack animation: pulse wave (concentric expanding circles)
      // ========================================
      if (isEnemy) {
        const atkTimer = Visual.attackAnimTimer[eid]!;
        const atkDur = Visual.attackAnimDuration[eid]!;
        if (atkTimer > 0 && atkDur > 0) {
          const progress = 1 - atkTimer / atkDur;
          // Draw 3 concentric wave rings that expand outward and fade
          const waveCount = 3;
          const waveLiftZ = (LAYER_TO_Z[LayerVal.Ground] ?? 5) + 1; // draw just above entity
          for (let w = 0; w < waveCount; w++) {
            const waveStart = w * 0.22;
            const waveProgress = Math.max(0, Math.min(1, (progress - waveStart) / 0.55));
            if (waveProgress > 0 && waveProgress < 1) {
              const radius = (drawSize * 0.4) + waveProgress * drawSize * 0.8;
              const alpha = 0.45 * (1 - waveProgress) * (1 - waveProgress);
              this.renderer.push({
                shape: 'circle',
                x: posX,
                y: posY,
                size: radius * 2,
                color: '#ffffff',
                alpha,
                stroke: '#ffffff',
                strokeWidth: 1.5,
                z: waveLiftZ,
              });
            }
          }
        }
      }

      // ========================================
      // 2. Composite geometry extra parts (L3-L5 towers)
      // ========================================
      if (upgradeVisual && upgradeVisual.extraParts.length > 0) {
        for (const part of upgradeVisual.extraParts) {
          this.renderer.push({
            shape: part.shape,
            x: posX + part.offsetX,
            y: posY + part.offsetY,
            size: part.size,
            color: part.color,
            alpha: part.alpha ?? 1,
            stroke: part.stroke,
            strokeWidth: part.strokeWidth,
            rotation: part.rotation,
            z: renderZ,
          });
        }
      }

      // ========================================
      // Alert mark (red ! above soldier head)
      // ========================================
      if (hasComponent(world.world, AlertMark, eid)) {
        const visible = AlertMark.visible[eid]!;
        if (visible === AlertMarkVal.Blinking || visible === AlertMarkVal.Solid) {
          let show = true;
          if (visible === AlertMarkVal.Blinking) {
            // Blink: visible 0.3s, hidden 0.3s
            AlertMark.timer[eid]! += dt;
            if (AlertMark.timer[eid]! >= 0.3) AlertMark.timer[eid] = 0;
            show = AlertMark.timer[eid]! < 0.15;
          }
          if (show) {
            const markY = posY - drawSize / 2 - 12;
            this.renderer.push({
              shape: 'triangle',
              x: posX,
              y: markY,
              size: 14,
              color: '#ff1744',
              alpha: 0.95,
              z: renderZ + 1,
            });
            // Vertical bar of the "!" mark
            this.renderer.push({
              shape: 'rect',
              x: posX,
              y: markY + 3,
              size: 2,
              h: 6,
              color: '#ff1744',
              alpha: 0.95,
              z: renderZ + 1,
            });
          }
        }
      }

      // ========================================
      // 2. Health bar (always visible above entity)
      // ========================================
      const entityTop = posY - drawSize / 2;
      const healthBarY = entityTop - 8;  // bar center, 6px height

      const hasHealth = hasComponent(world.world, Health, eid);
      const barW = Math.max(drawSize * 1.2, 28);
      if (hasHealth && !isProjectile && drawSize > 0 && isFinite(entityTop)) {
        const hpCurrent = Health.current[eid]!;
        const hpMax = Health.max[eid]!;
        const ratio = hpMax > 0 ? hpCurrent / hpMax : 0;
        this.drawHealthBar(posX, healthBarY, barW, ratio, renderZ);
      }

      // ========================================
      // 2.5. Cooldown bar (thin blue bar below health bar, towers only)
      // ========================================
      if (isTower && hasComponent(world.world, Attack, eid) && drawSize > 0 && isFinite(entityTop) && !isBuilding) {
        const atkSpeed = Attack.attackSpeed[eid]!;
        const cdTimer = Attack.cooldownTimer[eid]!;
        // fillRatio: 0 = just fired (empty), 1 = ready to fire (full)
        const fillRatio = Math.max(0, Math.min(1, 1 - cdTimer * atkSpeed));
        const cdBarY = healthBarY + HEALTH_BAR_HALF_H + CD_BAR_GAP + CD_BAR_HALF_H;
        this.drawCooldownBar(posX, cdBarY, barW, fillRatio, renderZ);
      }

      // ========================================
      // 2.6. Building progress bar (orange → green gradient below tower)
      // ========================================
      if (isBuilding && drawSize > 0 && isFinite(entityTop)) {
        const timer = BuildingTower.timer[eid]!;
        const duration = BuildingTower.duration[eid]!;
        const progress = duration > 0 ? Math.max(0, Math.min(1, 1 - timer / duration)) : 1;
        const barY = posY + drawSize / 2 + 8;
        this.drawBuildingProgressBar(posX, barY, barW, progress, renderZ);
      }

      // ========================================
      // 3. Display name + (towers) rank insignia on the same horizontal line
      //    Layout: [insignia][gap][name], centered around posX
      // ========================================
      const displayName = world.getDisplayName(eid);
      if (isFinite(healthBarY)) {
        const nameY = healthBarY - 10;
        const showInsignia = isTower && Tower.level[eid]! >= 1;
        const nameLabelSize = 12;
        const nameWidth = displayName
          ? this.renderer.measureLabel(displayName, nameLabelSize)
          : 0;
        const insigniaWidth = showInsignia ? RANK_INSIGNIA_BLOCK_WIDTH : 0;
        const gap = showInsignia && displayName ? RANK_INSIGNIA_NAME_GAP : 0;
        const totalWidth = insigniaWidth + gap + nameWidth;
        const blockLeft = posX - totalWidth / 2;

        if (showInsignia) {
          const insigniaCenterX = blockLeft + insigniaWidth / 2;
          this.drawTowerRankInsignia(insigniaCenterX, nameY, Tower.level[eid]!, renderZ);
        }

        if (displayName) {
          const nameCenterX = blockLeft + insigniaWidth + gap + nameWidth / 2;
          this.renderer.push({
            shape: 'rect',
            x: nameCenterX,
            y: nameY,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: displayName,
            labelColor: '#ffffff',
            labelSize: nameLabelSize,
            z: renderZ,
          });
        }
      }

      // ========================================
      // 4b. Production building level diamonds (kept as-is)
      // ========================================
      if (isProduction && isFinite(entityTop)) {
        const prodLevel = Production.level[eid]!;
        if (prodLevel > 1) {
          const diamondSize = 6;
          const gap = 2;
          const totalW = prodLevel * diamondSize * 2 + (prodLevel - 1) * gap;
          const startX = posX - totalW / 2 + diamondSize;
          const diamondY = entityTop - 30;
          for (let i = 0; i < prodLevel; i++) {
            this.renderer.push({
              shape: 'diamond',
              x: startX + i * (diamondSize * 2 + gap),
              y: diamondY,
              size: diamondSize,
              color: '#ffd700',
              alpha: 0.95,
              z: renderZ,
            });
          }
        }
      }

      // ========================================
      // 5. Unit info panel (when selected — detailed stats)
      // ========================================
      if (isUnit && selectedUnitId === eid) {
        const hasAttackComp = hasComponent(world.world, Attack, eid);
        if (hasHealth && hasAttackComp) {
          const hpCurrent = Math.ceil(Health.current[eid]!);
          const hpMax = Health.max[eid]!;
          const atkDmg = Attack.damage[eid]!;
          const atkSpd = Attack.attackSpeed[eid]!;

          const infoY = posY - drawSize / 2 - 30;
          const unitName = displayName || '士兵';
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 12,
            size: 120,
            h: 45,
            color: '#1a1a2e',
            alpha: 0.85,
            stroke: '#555555',
            strokeWidth: 1,
            z: renderZ,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 25,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: unitName,
            labelColor: '#ffffff',
            labelSize: 14,
            z: renderZ,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY - 5,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: `HP:${hpCurrent}/${hpMax}`,
            labelColor: '#4caf50',
            labelSize: 12,
            z: renderZ,
          });
          this.renderer.push({
            shape: 'rect',
            x: posX,
            y: infoY + 12,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: `ATK:${formatNumber(atkDmg)} SPD:${formatNumber(atkSpd)}`,
            labelColor: '#ff9800',
            labelSize: 12,
            z: renderZ,
          });
        }
      }

      // ========================================
      // Ice particles at feet (slowed/frozen enemies)
      // ========================================
      if (isEnemy && !flashActive) {
        if (hasFrozen || hasSlowed) {
          const stacks = hasSlowed ? Slowed.stacks[eid]! : (hasFrozen ? 5 : 1);
          const particleCount = Math.min(stacks * 2, 10);
          const footY = posY + Visual.size[eid]! / 2 + 2;
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + (Date.now() % 3000) / 3000 * Math.PI * 2;
            const radius = Visual.size[eid]! * 0.4 + (i % 3) * 3;
            const px = posX + Math.cos(angle) * radius;
            const py = footY + Math.sin(angle * 2) * 4;
            this.renderer.push({
              shape: 'circle',
              x: px, y: py,
              size: 4 + (i % 2) * 2,
              color: hasFrozen ? '#e0f7fa' : '#b3e5fc',
              alpha: 0.7 + (i % 3) * 0.1,
              z: renderZ,
            });
          }
        }
      }

      // ========================================
      // Poison bubbles (green rising particles for poisoned enemies)
      // ========================================
      if (hasPoisoned && !flashActive && !isProjectile) {
        const poisonTimer = Poisoned.timer[eid]! || 0;
        this.renderer.drawPoisonBubbles(posX, posY, drawSize, poisonTimer);
      }
    }
  }

  // ============================================
  // Tower rank insignia — chevron stripes + star pips (military-style epaulette)
  // L1: 1 chevron; L2: 2; L3: 3; L4: 3 chevrons + 1 star; L5: 3 chevrons + 2 stars
  // (x, y) = bottom-center anchor (typically just above tower's top edge)
  // ============================================
  private drawTowerRankInsignia(
    x: number, y: number, level: number, z: number,
  ): void {
    const clampedLevel = Math.max(1, Math.min(5, level));
    const chevronCount = Math.min(clampedLevel, 3);
    const starCount = Math.max(0, clampedLevel - 3);

    const rowH = RANK_CHEVRON_THICKNESS + RANK_CHEVRON_ROW_GAP;
    const chevronBlockH = chevronCount * RANK_CHEVRON_THICKNESS + (chevronCount - 1) * RANK_CHEVRON_ROW_GAP;
    const starBlockH = starCount > 0 ? RANK_STAR_ROW_GAP + RANK_STAR_SIZE : 0;
    const totalH = chevronBlockH + starBlockH;
    const blockTop = y - totalH / 2;

    const firstChevronCenterY = blockTop + RANK_CHEVRON_THICKNESS / 2;
    for (let i = 0; i < chevronCount; i++) {
      this.drawSingleChevron(x, firstChevronCenterY + i * rowH, z);
    }

    if (starCount > 0) {
      const starsTotalW = starCount * RANK_STAR_SIZE + (starCount - 1) * RANK_STAR_GAP;
      const starsStartX = x - starsTotalW / 2 + RANK_STAR_SIZE / 2;
      const starsY = blockTop + chevronBlockH + RANK_STAR_ROW_GAP + RANK_STAR_SIZE / 2;
      for (let i = 0; i < starCount; i++) {
        this.renderer.push({
          shape: 'diamond',
          x: starsStartX + i * (RANK_STAR_SIZE + RANK_STAR_GAP),
          y: starsY,
          size: RANK_STAR_SIZE,
          color: RANK_STAR_COLOR,
          alpha: 0.95,
          z,
        });
      }
    }
  }

  // ---- Draw one chevron stripe centered on (x, y), apex pointing up ----
  private drawSingleChevron(x: number, y: number, z: number): void {
    const armLen = RANK_CHEVRON_ARM_LEN;
    const thickness = RANK_CHEVRON_THICKNESS;
    const angle = RANK_CHEVRON_ANGLE;
    // Each arm's center sits halfway along the arm from the apex
    const armCenterDX = Math.sin(angle) * armLen / 2;
    const armCenterDY = Math.cos(angle) * armLen / 2;

    this.renderer.push({
      shape: 'rect',
      x: x - armCenterDX,
      y: y + armCenterDY,
      size: armLen,
      h: thickness,
      color: RANK_CHEVRON_FILL,
      stroke: RANK_CHEVRON_STROKE,
      strokeWidth: 0.5,
      rotation: -angle,
      alpha: 0.95,
      z,
    });

    this.renderer.push({
      shape: 'rect',
      x: x + armCenterDX,
      y: y + armCenterDY,
      size: armLen,
      h: thickness,
      color: RANK_CHEVRON_FILL,
      stroke: RANK_CHEVRON_STROKE,
      strokeWidth: 0.5,
      rotation: angle,
      alpha: 0.95,
      z,
    });
  }

  // ============================================
  // Cooldown bar — thin blue progress bar (rendered below health bar)
  // ============================================
  private drawCooldownBar(
    x: number, y: number, width: number, ratio: number, z: number,
  ): void {
    const barH = CD_BAR_HEIGHT;
    const barW = width;
    const halfW = barW / 2;

    this.renderer.push({
      shape: 'rect', x, y, size: barW, h: barH,
      color: '#222222', alpha: 0.7,
      z,
    });

    const fillW = Math.max(barW * ratio, 0);
    if (fillW > 0) {
      this.renderer.push({
        shape: 'rect',
        x: x - halfW + fillW / 2,
        y,
        size: fillW,
        h: barH,
        color: CD_BAR_COLOR,
        alpha: 0.95,
        z,
      });
    }
  }

  // ============================================
  // Building progress bar — orange→green gradient below tower body
  // ============================================
  private drawBuildingProgressBar(
    x: number, y: number, width: number, progress: number, z: number,
  ): void {
    const barH = CD_BAR_HEIGHT;
    const barW = width;
    const halfW = barW / 2;

    this.renderer.push({
      shape: 'rect', x, y, size: barW, h: barH,
      color: '#222222', alpha: 0.85,
      z,
    });

    const fillW = Math.max(barW * progress, 0);
    if (fillW > 0) {
      const fillColor = this.lerpColorRGB(0xff, 0x8c, 0x00, '#00ff00', progress);
      this.renderer.push({
        shape: 'rect',
        x: x - halfW + fillW / 2,
        y,
        size: fillW,
        h: barH,
        color: fillColor,
        alpha: 1,
        z,
      });
    }
  }

  // ============================================
  // Health bar
  // ============================================
  private drawHealthBar(
    x: number, y: number, width: number, ratio: number,
    z: number = 5,
  ): void {
    const barH = HEALTH_BAR_HEIGHT;
    const barW = width;
    const halfW = barW / 2;

    this.renderer.push({
      shape: 'rect', x, y: y, size: barW, h: barH,
      color: '#222222', alpha: 0.8,
      z,
    });

    let fillColor: string;
    if (ratio > 0.6) {
      fillColor = '#4caf50';
    } else if (ratio > 0.3) {
      fillColor = '#ffc107';
    } else {
      fillColor = '#f44336';
    }

    const fillW = Math.max(barW * ratio, 0);
      if (fillW > 0) {
      this.renderer.push({
        shape: 'rect',
        x: x - halfW + fillW / 2,
        y: y,
        size: fillW,
        h: barH,
        color: fillColor,
        alpha: 0.95,
        z,
      });
    }
  }

  // ============================================
  // Color utilities
  // ============================================

  /** Lerp from RGB components (entity base color) toward a target hex color */
  private lerpColorRGB(r1: number, g1: number, b1: number, hex2: string, t: number): string {
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }
}

// ---- Helper: convert Visual RGB components to CSS rgb string ----
function rgbFromVisual(eid: number): string {
  const r = Visual.colorR[eid]!;
  const g = Visual.colorG[eid]!;
  const b = Visual.colorB[eid]!;
  return `rgb(${r},${g},${b})`;
}

// ---- Helper: seeded PRNG for deterministic crack patterns ----
function simplePRNG(seed: number): () => number {
  let state = seed * 12345 + 67890;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}
