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
import { TileType, TowerType, EnemyType, UnitType } from '../types/index.js';
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
  Barrel,
  DeathEffect,
  DisintegrateEffect,
} from '../core/components.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { getTileTexturePath } from '../utils/pathTileTexture.js';
import { objectiveArtPath, objectiveFxArtPath, unitArtPath } from '../utils/artAssets.js';
import { getLoadedImageFrame, type LoadedArtFrame } from '../utils/imageCache.js';
import { getDeathSpriteArtId } from '../utils/deathSpriteRegistry.js';
import { UNIT_CONFIGS, UPGRADE_VISUALS, UNIT_TYPE_BY_ID } from '../data/gameData.js';
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
  TowerType.Missile,   // 6
  TowerType.Fire,      // 7
  TowerType.Poison,    // 8
  TowerType.Ballista,  // 9
];

const TRAP_TYPE_BY_ID = ['spike_trap', 'bear_trap', 'tar_pit', 'boulder'] as const;

const ENEMY_TYPE_BY_ID: EnemyType[] = [
  EnemyType.Goblin,
  EnemyType.Boar,
  EnemyType.Elephant,
  EnemyType.Giant,
  EnemyType.DesertBeetle,
  EnemyType.BurrowBeetle,
  EnemyType.Locust,
  EnemyType.BombBeetle,
  EnemyType.Werewolf,
  EnemyType.VampireBat,
  EnemyType.Wizard,
  EnemyType.Priest,
  EnemyType.Frankenstein,
  EnemyType.Plane,
  EnemyType.Tank,
  EnemyType.OilTruck,
  EnemyType.RobotDog,
  EnemyType.GiantRobot,
  EnemyType.Drone,
  EnemyType.GiantSlime,
  EnemyType.QueenBeetle,
  EnemyType.Lucifer,
  EnemyType.SuperRobot,
  EnemyType.AbyssLord,
];

// ---- Query: all entities with position + visual ----
const renderableQuery = defineQuery([Position, Visual]);

// ---- Query: targeting marks + tile damage ----
const targetingMarkQuery = defineQuery([TargetingMark, Position]);
const tileDamageMarkQuery = defineQuery([TileDamageMark, Position]);

const NAME_COLOR_DEFAULT = '#ffffff';
const NAME_COLOR_ELITE = '#FFD700';
const NAME_COLOR_BOSS = '#ff1744';
const NAME_COLOR_PLAYER_UNIT = '#4ade80';

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
const MOVING_ENEMY_BREATH_SCALE = 1.04;

export function getMovingEnemyBreathScale(phase: number, active: boolean): number {
  if (!active) return 1;
  return Math.sin(phase) >= 0 ? MOVING_ENEMY_BREATH_SCALE : 1;
}

export function getUnitSpriteScaleX(facing: number, artFacesLeft = false): number {
  const normalizedFacing = facing >= 0 ? 1 : -1;
  return artFacesLeft ? -normalizedFacing : normalizedFacing;
}

export function getUnitSpriteArtFacesLeft(isEnemy: boolean, _isBoss = false): boolean {
  return isEnemy;
}

export class RenderSystem implements System {
  readonly name = 'RenderSystem';

  static sceneOffsetX = 0;
  static sceneOffsetY = 0;
  static sceneW = 0;
  static sceneH = 0;

  /** v4.1: 入场动画期间抑制正常棋盘绘制 */
  static introActive = false;
  /** v4.1: 入场动画系统引用（用于水晶 alpha 动画） */
  static introSystem: { crystalRenderAlpha: number } | null = null;
  /** 大地裂变期间地格独立抖动强度（由 SpellProjectileSystem 写入，RenderSystem 每帧消费） */
  static tileJitter = { intensity: 0, seed: 0 };

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
    // v4.1: 入场动画期间由 LevelIntroSystem 接管棋盘渲染
    if (RenderSystem.introActive) return;

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
        const jitter = RenderSystem.tileJitter.intensity;
        const jitterSeed = RenderSystem.tileJitter.seed;
        const jitterPhase = jitterSeed + r * 12.9898 + c * 78.233;
        const x = c * ts + ts / 2 + ox + (jitter > 0 ? Math.sin(jitterPhase) * jitter : 0);
        const y = r * ts + ts / 2 + oy + (jitter > 0 ? Math.cos(jitterPhase * 1.37) * jitter : 0);
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

        const texturePath = getTileTexturePath(map, r, c);
        const texture = texturePath ? getLoadedImageFrame(texturePath) : null;
        this.renderer.push({
          shape: 'rect',
          x,
          y,
          size: texture ? ts : ts - 2,
          color,
          image: texture?.image,
          imageSource: texture?.source ?? undefined,
          alpha: 1,
          z: 0,
        });

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

    // Spawn portal vortex effect — replaces flag poles
    // 黑色+红色漩涡传送门，占满单格空间
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        if (tile !== TileType.Spawn) continue;
        const sx = c * ts + ts / 2 + ox;
        const sy = r * ts + ts / 2 + oy;
        this.drawSpawnPortal(sx, sy, ts);
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
  // Spawn portal vortex — 出生口漩涡传送门特效
  // ============================================
  // 设计: 暗红/黑色多层旋转漩涡，占满单个 64×64 地格
  // 层次 (由外到内):
  //   1. 暗色基底圆 (void)
  //   2. 脉冲外圈光环
  //   3. 外层旋转菱形环 (8个, 慢速)
  //   4. 内层旋转菱形环 (6个, 快速反向)
  //   5. 脉冲核心光点
  //   6. 中心白点
  //   7. 向外飘散粒子
  private drawSpawnPortal(cx: number, cy: number, tileSize: number): void {
    const t = Date.now() * 0.001; // 秒级时间戳
    const r = tileSize * 0.44;     // 主体半径 ~28px (64px 格)
    const z = 0;                    // 地图层
    const fx = getLoadedImageFrame(objectiveFxArtPath('spawn_portal'));
    const portal = getLoadedImageFrame(objectiveArtPath('spawn_portal'));

    if (fx) {
      const pulse = 1 + Math.sin(t * 1.4) * 0.04;
      this.renderer.push({
        shape: 'rect',
        x: cx,
        y: cy,
        size: tileSize * 1.34 * pulse,
        h: tileSize * 1.34 * pulse,
        color: '#ffffff',
        image: fx.image,
        imageSource: fx.source ?? undefined,
        alpha: 0.72,
        rotation: t * 0.18,
        z,
      });
    }

    if (portal) {
      this.renderer.push({
        shape: 'rect',
        x: cx,
        y: cy,
        size: tileSize * 1.06,
        h: tileSize * 1.06,
        color: '#ffffff',
        image: portal.image,
        imageSource: portal.source ?? undefined,
        alpha: 0.98,
        rotation: -t * 0.28,
        z,
      });
    }

    // ── Layer 1: 暗色虚空基底 ──
    if (!portal) {
      this.renderer.push({
        shape: 'circle', x: cx, y: cy,
        size: r * 2.1,
        color: '#0a0000',
        alpha: 0.9,
        z,
      });
    }

    // ── Layer 2: 外侧脉冲红色光环 ──
    const outerPulse = 1 + Math.sin(t * 1.2) * 0.08;
    this.renderer.push({
      shape: 'circle', x: cx, y: cy,
      size: r * 2.5 * outerPulse,
      color: 'transparent',
      alpha: 0.25,
      stroke: '#ff1744',
      strokeWidth: 2.5,
      z,
    });
    // 第二层光环, 略大, 更淡
    this.renderer.push({
      shape: 'circle', x: cx, y: cy,
      size: r * 2.8 * outerPulse,
      color: 'transparent',
      alpha: 0.12,
      stroke: '#ff5252',
      strokeWidth: 1.5,
      z,
    });

    // ── Layer 3: 外层旋转菱形环 (8个, 慢速顺时针) ──
    const outerCount = 8;
    for (let i = 0; i < outerCount; i++) {
      const angle = (i / outerCount) * Math.PI * 2 + t * 0.9;
      const dx = Math.cos(angle) * r * 1.15;
      const dy = Math.sin(angle) * r * 1.15;
      const flicker = 1 + Math.sin(t * 3.5 + i * 1.2) * 0.15;
      this.renderer.push({
        shape: 'diamond',
        x: cx + dx, y: cy + dy,
        size: 6,
        color: '#ff5252',
        alpha: (0.5 + Math.sin(t * 2 + i) * 0.2) * flicker,
        rotation: angle + Math.PI / 4,
        z,
      });
    }

    // ── Layer 4: 内层旋转菱形环 (6个, 快速逆时针) ──
    const innerCount = 6;
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2 - t * 1.6;
      const dx = Math.cos(angle) * r * 0.55;
      const dy = Math.sin(angle) * r * 0.55;
      this.renderer.push({
        shape: 'diamond',
        x: cx + dx, y: cy + dy,
        size: 4,
        color: '#ff8a80',
        alpha: 0.55 + Math.sin(t * 3 + i * 1.5) * 0.15,
        rotation: angle - Math.PI / 2,
        z,
      });
    }

    // ── Layer 5: 脉冲核心 ──
    const corePulse = 0.55 + Math.sin(t * 3.5) * 0.25;
    this.renderer.push({
      shape: 'circle', x: cx, y: cy,
      size: r * 0.55 * corePulse,
      color: '#ff1744',
      alpha: 0.75,
      z,
    });
    // 内层核心 (更亮)
    this.renderer.push({
      shape: 'circle', x: cx, y: cy,
      size: r * 0.25 * corePulse,
      color: '#ff5252',
      alpha: 0.85,
      z,
    });

    // ── Layer 6: 中心白点 ──
    this.renderer.push({
      shape: 'circle', x: cx, y: cy,
      size: 4,
      color: '#ffffff',
      alpha: 0.4 + Math.sin(t * 5) * 0.2,
      z,
    });

    // ── Layer 7: 向外飘散粒子 (4个, 缓慢扩散) ──
    for (let i = 0; i < 4; i++) {
      const particlePhase = (t * 0.35 + i * 0.65) % 1.4;
      if (particlePhase < 1.0) {
        const angle = (i / 4) * Math.PI * 2 + t * 0.25;
        const dist = r * (1.3 + particlePhase * 0.9);
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        this.renderer.push({
          shape: 'circle',
          x: px, y: py,
          size: 1.5 + particlePhase * 2.5,
          color: '#ff8a80',
          alpha: (1 - particlePhase) * 0.5,
          z,
        });
      }
    }
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
   * 单位 composite 渲染：身体 + 装饰部件 + 武器 + 徽记/高光，应用 bob/breath/挥砍动画。
   *
   * 绘制顺序（z 自下而上）：武器光晕 → 身体（带 breathing scale）→ bodyParts → 武器 → 兼容旧 eyes
   * facing 决定 X 翻转；attackAnimTimer/Duration 驱动武器摆角；bobPhase 决定 bobY 偏移；breathPhase 决定身体 scale
   */
  private drawUnitComposite(
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
    const isStatic = parts.bobStyle === 'static';
    const bobY = isStatic ? 0 : floating ? Math.sin(bobPhase) * 4 : Math.sin(bobPhase) * 2;
    const swayX = isStatic || floating ? 0 : Math.sin(bobPhase * 0.5) * 0.6 * facing;
    const breathScale = 1 + Math.sin(breathPhase) * (isStatic ? 0.015 : 0.04);
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

  private drawUnitSprite(
    unitId: string,
    eid: number,
    posX: number,
    posY: number,
    drawSize: number,
    alpha: number,
    z: number,
    opts: { state?: string; frame?: 0 | 1; stroke?: string; strokeWidth?: number; facing?: number; artFacesLeft?: boolean } = {},
  ): boolean {
    const state = opts.state ?? 'idle';
    const frame = opts.frame ?? this.getUnitSpriteFrame(eid, state);
    let sprite: LoadedArtFrame | null = getLoadedImageFrame(unitArtPath(unitId, state, frame));
    if (!sprite && state !== 'idle') {
      sprite = getLoadedImageFrame(unitArtPath(unitId, 'idle', frame));
    }
    if (!sprite) return false;

    const sourceW = sprite.width;
    const sourceH = sprite.height;
    if (sourceW <= 0 || sourceH <= 0) return false;

    const aspect = sourceW / sourceH;
    const h = drawSize;
    const w = h * aspect;
    const facing = opts.facing ?? ((Visual.facing[eid] ?? 1) >= 0 ? 1 : -1);
    const scaleX = getUnitSpriteScaleX(facing, opts.artFacesLeft ?? false);

    this.renderer.push({
      shape: 'rect',
      x: posX,
      y: posY - drawSize * 0.08,
      size: w,
      h,
      color: '#ffffff',
      alpha,
      image: sprite.image,
      imageSource: sprite.source ?? undefined,
      scaleX,
      stroke: opts.stroke,
      strokeWidth: opts.strokeWidth,
      z,
    });
    return true;
  }

  private getUnitSpriteFrame(eid: number, state: string): 0 | 1 {
    if (state === 'attack') {
      const duration = Visual.attackAnimDuration[eid] ?? 0;
      const timer = Visual.attackAnimTimer[eid] ?? 0;
      if (duration <= 0 || timer <= 0) return 0;
      return 1 - timer / duration >= 0.35 ? 1 : 0;
    }
    if (state === 'death') {
      const duration = DeathEffect.duration[eid] ?? 0;
      const elapsed = DeathEffect.elapsed[eid] ?? 0;
      if (duration <= 0) return 0;
      return elapsed / duration >= 0.5 ? 1 : 0;
    }
    return Math.sin(Visual.breathPhase[eid] ?? 0) >= 0 ? 1 : 0;
  }

  private getUnitSpriteState(eid: number, moving: boolean): 'idle' | 'move' | 'attack' | 'death' {
    if (getDeathSpriteArtId(eid)) {
      return 'death';
    }
    if ((Visual.attackAnimTimer[eid] ?? 0) > 0) {
      return 'attack';
    }
    if (moving) {
      return 'move';
    }
    return 'idle';
  }

  private drawBossAura(eid: number, x: number, y: number, size: number, z: number): void {
    const t = (Visual.breathPhase[eid] ?? 0) + Date.now() * 0.003;
    const r = Visual.colorR[eid] ?? 255;
    const g = Visual.colorG[eid] ?? 23;
    const b = Visual.colorB[eid] ?? 68;
    const color = `rgb(${r}, ${g}, ${b})`;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);

    this.renderer.push({
      shape: 'circle',
      x,
      y,
      size: size * (1.35 + pulse * 0.18),
      color,
      alpha: 0.14,
      stroke: '#ff1744',
      strokeWidth: 2,
      z: z - 0.2,
    });

    for (let i = 0; i < 8; i++) {
      const angle = t * 0.8 + (i / 8) * Math.PI * 2;
      const radius = size * (0.62 + (i % 2) * 0.12);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius * 0.55;
      this.renderer.push({
        shape: i % 2 === 0 ? 'diamond' : 'circle',
        x: px,
        y: py,
        size: 5 + (i % 3) * 2,
        color: i % 2 === 0 ? '#ff1744' : color,
        alpha: 0.45 + pulse * 0.25,
        z: z + 0.1,
      });
    }
  }

  private drawDisintegrateEffect(eid: number, x: number, y: number, size: number, z: number): void {
    const duration = DeathEffect.duration[eid] ?? 0.45;
    const elapsed = DeathEffect.elapsed[eid] ?? 0;
    const progress = duration > 0 ? Math.max(0, Math.min(1, elapsed / duration)) : 1;
    const shardCount = DisintegrateEffect.shardCount[eid] ?? 10;
    const radius = DisintegrateEffect.radius[eid] ?? size;
    const r = DisintegrateEffect.colorR[eid] ?? 170;
    const g = DisintegrateEffect.colorG[eid] ?? 170;
    const b = DisintegrateEffect.colorB[eid] ?? 170;
    const alpha = Math.max(0, 1 - progress);

    this.renderer.push({
      shape: 'circle',
      x,
      y,
      size: size * (1 + progress * 0.7),
      color: `rgb(${r}, ${g}, ${b})`,
      alpha: 0.18 * alpha,
      stroke: '#d0d0d0',
      strokeWidth: 1,
      z,
    });

    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2 + i * 0.73;
      const dist = radius * (0.15 + progress * (0.45 + (i % 4) * 0.08));
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist * 0.72 - progress * 14;
      this.renderer.push({
        shape: i % 3 === 0 ? 'triangle' : 'diamond',
        x: px,
        y: py,
        size: Math.max(3, size * 0.08 + (i % 3) * 2),
        color: `rgb(${r}, ${g}, ${b})`,
        alpha: 0.75 * alpha,
        rotation: angle + progress * Math.PI,
        z: z + 0.1,
      });
    }
  }

  private getTrapSpriteState(trapType: number, animTimer: number): 'idle' | 'attack' {
    if (trapType === 3) {
      return 'idle';
    }
    return animTimer > 0 ? 'attack' : 'idle';
  }

  private getTrapSpriteFrame(animTimer: number, animDuration: number): 0 | 1 {
    if (animDuration <= 0 || animTimer <= 0) {
      return 0;
    }
    return 1 - animTimer / animDuration >= 0.5 ? 1 : 0;
  }

  private getSceneUnitArtId(world: TowerWorld, eid: number): string | null {
    const deathArtId = getDeathSpriteArtId(eid);
    if (deathArtId) return deathArtId;
    if (hasComponent(world.world, Tower, eid)) {
      const towerType = TOWER_TYPE_BY_ID[Tower.towerType[eid]!];
      return towerType ? `tower_${towerType}` : null;
    }
    if (hasComponent(world.world, Trap, eid)) {
      return TRAP_TYPE_BY_ID[Trap.trapType[eid] ?? 0] ?? 'spike_trap';
    }
    if (hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Soldier) {
      return UNIT_TYPE_BY_ID[UnitTag.unitTypeNum[eid] ?? 0] ?? UnitType.ShieldGuard;
    }
    if (hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Enemy) {
      return `enemy_${ENEMY_TYPE_BY_ID[UnitTag.unitTypeNum[eid] ?? 0] ?? EnemyType.Goblin}`;
    }
    return null;
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
        void trapDirection;

        // 动画进度（0→1）
        const animProgress = animTimer > 0 ? (1 - animTimer / animDuration) : 0;
        const animFactor = Math.sin(animProgress * Math.PI);
        const trapRenderZ = LAYER_TO_Z[Layer.value[eid] ?? LayerVal.AboveGrid] ?? 2;
        const trapSpriteId = this.getSceneUnitArtId(world, eid);
        const trapSpriteState = this.getTrapSpriteState(trapType, animTimer);
        if (
          trapSpriteId &&
          this.drawUnitSprite(
            trapSpriteId,
            eid,
            posX,
            posY - animFactor * 3,
            Visual.size[eid]! * (1 + animFactor * 0.08) * 1.25,
            Visual.alpha[eid]!,
            trapRenderZ,
            {
              state: trapSpriteState,
              frame: this.getTrapSpriteFrame(animTimer, animDuration),
              stroke: Visual.outline[eid] ? '#ffffff' : undefined,
              strokeWidth: Visual.outline[eid] ? 2 : undefined,
            },
          )
        ) {
          continue;
        }

        const trapPartsId = Visual.partsId[eid] ?? 0;
        const trapParts = trapPartsId !== 0 ? world.getUnitVisualParts(trapPartsId) : undefined;
        if (trapParts) {
          const trapSize = Visual.size[eid]! * (1 + animFactor * 0.08);
          this.drawUnitComposite(
            eid,
            posX,
            posY - animFactor * 3,
            trapSize,
            rgbFromVisual(eid),
            Visual.alpha[eid]!,
            Visual.outline[eid] ? '#ffffff' : undefined,
            Visual.outline[eid] ? 2 : undefined,
            trapRenderZ,
            trapParts,
          );
          continue;
        }

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
      // Enemy / Tower stun visual
      // ========================================
      if ((isEnemy || isTower) && !flashActive) {
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
      const isEliteEnemy = isEnemy && (UnitTag.isElite[eid] ?? 0) === 1;
      let drawSize = Visual.size[eid]!;
      if (isBossEntity) {
        const isSplitSlime = Boss.bossType[eid] === 0 && (Boss.splitCount[eid] ?? 0) > 0;
        drawSize = isSplitSlime
          ? Math.min(180, Visual.size[eid]!)
          : Math.max(70, Math.min(180, Visual.size[eid]!));
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
      const usePassiveOutline = !isUnit && !isEliteEnemy && (Visual.outline[eid] ?? 0) === 1;
      let strokeColor = isSelected ? '#ffffff' : (usePassiveOutline ? '#ffffff' : undefined);
      let strokeW = isSelected ? 3 : (usePassiveOutline ? 2 : undefined);

      // ========================================
      // Elite enemy rendering — 20% size increase, name color handles identification.
      // design/02-gameplay.md §2.4: 体型增大20%，名称黄色
      // ========================================
      if (isEliteEnemy) {
        drawSize = drawSize * 1.2;
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
          // 箭头形状的投射物需要 targetX/targetY 来确定朝向
          if (shape === 'arrow') {
            const isBallista = Projectile.sourceTowerType[eid] === 9;
            if (isBallista && (Projectile.dirX[eid] !== 0 || Projectile.dirY[eid] !== 0)) {
              // 弩箭使用锁定方向，避免击中目标后箭头反转
              targetX = posX + (Projectile.dirX[eid] ?? 0) * 50;
              targetY = posY + (Projectile.dirY[eid] ?? 0) * 50;
            } else {
              const projTargetId = Projectile.targetId[eid]!;
              if (projTargetId > 0 && typeof Position.x[projTargetId] === 'number') {
                targetX = Position.x[projTargetId];
                targetY = Position.y[projTargetId];
              }
            }
          }
          // 弩箭：白→蓝渐变箭杆
          if (isProjectile && Projectile.sourceTowerType[eid] === 9 && shape === 'arrow') {
            (extras as any).arrowGradientTail = '#ffffff';
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

      if (isBossEntity) {
        this.drawBossAura(eid, posX, posY, drawSize, renderZ);
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
      // Tower attack animation: brief brighten pulse
      if (isTower) {
        const atkTimer = Visual.attackAnimTimer[eid]!;
        const atkDur = Visual.attackAnimDuration[eid]!;
        if (atkTimer > 0 && atkDur > 0) {
          const progress = 1 - atkTimer / atkDur;
          if (progress < 0.15) {
            // Brief bright flash + slight scale pulse
            attackAnimSize = drawSize * (1 + 0.06 * Math.sin(progress / 0.15 * Math.PI / 2));
            displayAlpha = Math.min(1, displayAlpha * 1.2);
          }
        }
      }

      if (hasComponent(world.world, DisintegrateEffect, eid)) {
        this.drawDisintegrateEffect(eid, posX, posY, drawSize, renderZ + 2);
      }

      // ========================================
      // 1. Entity body (bottom layer — drawn first)
      // ========================================
      let bodySpriteDrawn = false;
      // Crystal (Objective) — 使用文档定义的菱形复合+辉光+浮动动画渲染
      // 设计文档: design/05-presentation.md §5 水晶视觉
      const isObjective = hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Objective;
      if (isObjective) {
        this.drawCrystal(eid, posX, posY, dt, displayAlpha);
      } else {
        const unitPartsId = Visual.partsId[eid] ?? 0;
        const sceneUnitArtId = this.getSceneUnitArtId(world, eid);
        const isMovingUnit =
          hasComponent(world.world, Movement, eid) &&
          (Movement.currentSpeed[eid] ?? 0) > 0.05 &&
          !hasFrozen &&
          !(hasStunnedComponent && Stunned.timer[eid]! > 0) &&
          Visual.attackAnimTimer[eid]! <= 0;
        const unitSpriteState = this.getUnitSpriteState(eid, isMovingUnit);
        const movingEnemyBreathScale = getMovingEnemyBreathScale(
          Visual.breathPhase[eid] ?? 0,
          unitSpriteState === 'idle' &&
            isEnemy &&
            hasComponent(world.world, Movement, eid) &&
            (Movement.currentSpeed[eid] ?? 0) > 0.05 &&
            !hasFrozen &&
            !(hasStunnedComponent && Stunned.timer[eid]! > 0) &&
            Visual.attackAnimTimer[eid]! <= 0,
        );
        const spriteDrawn = sceneUnitArtId !== null && this.drawUnitSprite(
          sceneUnitArtId,
          eid,
          attackAnimPosX,
          attackAnimPosY,
          attackAnimSize * (isTower ? 1.35 : isEnemy ? 1.45 * movingEnemyBreathScale : 1.35),
          displayAlpha,
          renderZ,
          {
            state: unitSpriteState,
            stroke: strokeColor,
            strokeWidth: strokeW,
            artFacesLeft: getUnitSpriteArtFacesLeft(isEnemy, isBossEntity),
          },
        );
        bodySpriteDrawn = spriteDrawn;
        if (spriteDrawn) {
          // Keep procedural rendering as fallback only; state overlays still render below.
        } else if (unitPartsId !== 0) {
          const parts = world.getUnitVisualParts(unitPartsId);
          if (parts) {
            this.drawUnitComposite(eid, attackAnimPosX, attackAnimPosY, attackAnimSize, displayColor, displayAlpha, strokeColor, strokeW, renderZ, parts);
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
      // Barrel rendering — 炮管（塔上方，可旋转追踪目标）
      // ========================================
      if (isTower && !bodySpriteDrawn && hasComponent(world.world, Barrel, eid)) {
        const barrelAngle = Barrel.angle[eid]!;
        const barrelLen = Barrel.length[eid]!;
        const barrelW = Barrel.width[eid]!;
        const midX = posX + Math.cos(barrelAngle) * (barrelLen * 0.5);
        const midY = posY + Math.sin(barrelAngle) * (barrelLen * 0.5);

        this.renderer.push({
          shape: 'rect',
          x: midX,
          y: midY,
          size: barrelLen,
          h: barrelW,
          color: '#2a2a2a',
          alpha: 1,
          stroke: '#444444',
          strokeWidth: 1,
          rotation: barrelAngle,
          z: renderZ + 1,
        });
      }

      // ========================================
      // Tower idle effects — particles / aura / orbiters
      // ========================================
      if (isTower && !isBuilding) {
        this.drawTowerIdleEffects(eid, posX, posY, Tower.towerType[eid]!, drawSize, renderZ, hasFrozen, hasStunnedComponent);
      }

      // ========================================
      // Tower state overlays — frozen ice shards / stunned stars
      // ========================================
      if (isTower) {
        if (hasFrozen) {
          // Ice crystal shards encasing the tower
          const t = Date.now() * 0.001;
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + t * 0.3;
            const r = drawSize * 0.55;
            this.renderer.push({
              shape: 'diamond',
              x: posX + Math.cos(angle) * r,
              y: posY + Math.sin(angle) * r * 0.7,
              size: 5,
              color: '#b3e5fc',
              alpha: 0.7,
              rotation: angle,
              z: renderZ + 3,
            });
          }
        }
        if (hasStunnedComponent && Stunned.timer[eid]! > 0) {
          // Orbiting golden stars
          const t = Date.now() * 0.001;
          for (let i = 0; i < 3; i++) {
            const angle = t * 2.5 + (i / 3) * Math.PI * 2;
            const r = drawSize * 0.5;
            this.renderer.push({
              shape: 'triangle',
              x: posX + Math.cos(angle) * r,
              y: posY - 2 + Math.sin(angle) * r * 0.6,
              size: 6,
              color: '#ffd700',
              alpha: 0.8,
              rotation: angle,
              z: renderZ + 3,
            });
          }
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
      if (hasHealth && !isProjectile && drawSize > 0 && isFinite(entityTop) && displayAlpha > 0.01) {
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
          const labelColor = isBossEntity
            ? NAME_COLOR_BOSS
            : isEliteEnemy
              ? NAME_COLOR_ELITE
              : isUnit
                ? NAME_COLOR_PLAYER_UNIT
                : NAME_COLOR_DEFAULT;
          this.renderer.push({
            shape: 'rect',
            x: nameCenterX,
            y: nameY,
            size: 0.1,
            h: 0.1,
            color: '#ffffff',
            alpha: 1,
            label: displayName,
            labelColor,
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
  // Crystal (Objective 水晶) 视觉渲染
  // 设计语言: 高贵 / 优雅 / 神秘
  // 六边形紫水晶主体 + 金色六角点缀 + 多层光效 + 旋转光点 + 射线 + 闪光粒子
  // 低血量 (<30%): 转为红色警戒 + 加速动画 + 更强烈的脉冲
  // ============================================
  private drawCrystal(eid: number, posX: number, posY: number, dt: number, alpha: number = 1): void {
    Visual.breathPhase[eid]! += dt;
    const phase = Visual.breathPhase[eid]!;
    const renderAlpha = Math.max(0, Math.min(1, alpha));
    if (renderAlpha <= 0) return;

    // ── 血量状态 ──
    const hpCurrent = Health.current[eid]!;
    const hpMax = Health.max[eid]!;
    const hpRatio = hpMax > 0 ? hpCurrent / hpMax : 1;
    const isLowHp = hpRatio < 0.3;

    // ── 主题色 (低血量时转红) ──
    const bodyDeep   = isLowHp ? '#b91c1c' : '#4a1d8f'; // 深紫 → 深红
    const bodyMid    = isLowHp ? '#ef4444' : '#7c3aed'; // 紫罗兰 → 红
    const bodyLight  = isLowHp ? '#fca5a5' : '#a78bfa'; // 浅紫 → 浅红
    const glowAura   = isLowHp ? '#fecaca' : '#c4b5fd'; // 辉光紫 → 辉光红
    const innerCore  = isLowHp ? '#dc2626' : '#4c1d95'; // 深紫内核 → 深红 (六边形脉冲)
    const goldAccent = '#fcd34d';                        // 金色点缀 (不变)
    const whitePure  = '#ffffff';

    // ── 动画参数 (低血量加速) ──
    const speedMul = isLowHp ? 1.8 : 1.0;

    // 漂浮: ±6px, 3.5s 周期
    const floatY = Math.sin(phase / 3.5 * Math.PI * 2 * speedMul) * 6;
    // 轻微水平摇曳
    const swayX = Math.sin(phase / 4.7 * Math.PI * 2 * speedMul + 1.3) * 2;

    // 辉光呼吸: 极缓, 5s 周期
    const auraBreath = Math.sin(phase / 5.0 * Math.PI * 2 * speedMul) * 0.5 + 0.5;

    // 内核脉冲: 2.5s 周期
    const innerPulse = Math.sin(phase / 2.5 * Math.PI * 2 * speedMul) * 0.5 + 0.5;

    const layerVal = Layer.value[eid] ?? LayerVal.Ground;
    const renderZ = LAYER_TO_Z[layerVal] ?? 5;

    const cx = posX + swayX;
    const cy = posY + floatY;
    const fx = getLoadedImageFrame(objectiveFxArtPath('crystal_aura'));
    const crystal = getLoadedImageFrame(objectiveArtPath(isLowHp ? 'crystal_low_hp' : 'crystal'));

    if (fx) {
      this.renderer.push({
        shape: 'rect',
        x: cx,
        y: cy,
        size: 86 + auraBreath * 10,
        h: 86 + auraBreath * 10,
        color: '#ffffff',
        image: fx.image,
        imageSource: fx.source ?? undefined,
        alpha: (isLowHp ? 0.9 : 0.72) * renderAlpha,
        rotation: phase * 0.12 * speedMul,
        z: renderZ,
      });
    }

    // ============================================
    // Layer 1: 地面光池 (底部柔光椭圆)
    // ============================================
    this.renderer.push({
      shape: 'circle', x: posX, y: posY + 10,
      size: 50 + auraBreath * 8,
      color: glowAura,
      alpha: (0.06 + auraBreath * 0.04) * renderAlpha,
      z: renderZ,
    });

    // ============================================
    // Layer 2: 外层以太辉光 (3层同心圆, 逐层淡化)
    // ============================================
    for (let i = 0; i < 3; i++) {
      this.renderer.push({
        shape: 'circle', x: cx, y: cy,
        size: 38 + i * 22 + auraBreath * 6,
        color: glowAura,
        alpha: ((0.08 - i * 0.025) + auraBreath * 0.03) * renderAlpha,
        z: renderZ,
      });
    }

    // ============================================
    // Layer 3: 旋转光点环 (5颗菱形, 椭圆轨道慢速公转)
    // ============================================
    const moteCount = 5;
    for (let i = 0; i < moteCount; i++) {
      const orbitAngle = (i / moteCount) * Math.PI * 2 + phase * 0.35 * speedMul;
      const orbitRx = 20 + Math.sin(i * 1.7) * 5;
      const orbitRy = orbitRx * 0.55;
      const mx = cx + Math.cos(orbitAngle) * orbitRx;
      const my = cy + Math.sin(orbitAngle) * orbitRy;
      const moteFlicker = Math.sin(phase * 2.2 * speedMul + i * 2.1) * 0.3 + 0.7;
      this.renderer.push({
        shape: 'diamond',
        x: mx, y: my,
        size: 3.5 + moteFlicker * 1.5,
        color: goldAccent,
        alpha: (0.45 + Math.sin(phase * 1.3 + i) * 0.2) * moteFlicker * renderAlpha,
        rotation: orbitAngle + Math.PI / 4,
        z: renderZ,
      });
    }

    // ============================================
    // Layer 4: 水晶主体 — 外层六边形 (深色)
    // ============================================
    if (crystal) {
      this.renderer.push({
        shape: 'rect',
        x: cx,
        y: cy,
        size: 66,
        h: 66,
        color: '#ffffff',
        image: crystal.image,
        imageSource: crystal.source ?? undefined,
        alpha: renderAlpha,
        z: renderZ,
      });
    } else {
      this.renderer.push({
        shape: 'hexagon',
        x: cx, y: cy,
        size: 38,
        color: bodyDeep,
        alpha: renderAlpha,
        stroke: isLowHp ? '#f87171' : '#8b5cf6',
        strokeWidth: 1.5,
        z: renderZ,
      });
    }

    // ============================================
    // Layer 5: 水晶主体 — 内层六边形 (浅色, 偏移营造宝石切割感)
    // ============================================
    if (!crystal) {
      this.renderer.push({
        shape: 'hexagon',
        x: cx, y: cy - 3,
        size: 24,
        color: bodyMid,
        alpha: 0.88 * renderAlpha,
        z: renderZ,
      });
    }

    // ============================================
    // Layer 6: 金色六边形顶点点缀 (6颗小菱形在六边形顶点)
    // ============================================
    if (!crystal) {
      for (let i = 0; i < 6; i++) {
        const edgeAngle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const ex = cx + Math.cos(edgeAngle) * 16;
        const ey = cy + Math.sin(edgeAngle) * 16;
        this.renderer.push({
          shape: 'diamond',
          x: ex, y: ey,
          size: 4,
          color: goldAccent,
          alpha: (0.65 + innerPulse * 0.2) * renderAlpha,
          rotation: edgeAngle,
          z: renderZ,
        });
      }
    }

    // ============================================
    // Layer 7: 内核脉冲 (六边形, 深紫色)
    // ============================================
    if (!crystal) {
      this.renderer.push({
        shape: 'hexagon',
        x: cx, y: cy,
        size: 10 + innerPulse * 8,
        color: innerCore,
        alpha: (0.7 + innerPulse * 0.25) * renderAlpha,
        z: renderZ,
      });
    }
    // 中心白点亮核
    this.renderer.push({
      shape: 'circle',
      x: cx, y: cy,
      size: 3 + innerPulse * 2,
      color: whitePure,
      alpha: (0.4 + innerPulse * 0.5) * renderAlpha,
      z: renderZ,
    });

    // ============================================
    // Layer 8: 十字光射线 (4条细光束从中心辐射)
    // ============================================
    const rayLen = 20;
    for (let i = 0; i < 4; i++) {
      const rayAngle = (i / 4) * Math.PI * 2 + Math.PI / 8;
      const rx = cx + Math.cos(rayAngle) * rayLen * 0.5;
      const ry = cy + Math.sin(rayAngle) * rayLen * 0.5;
      this.renderer.push({
        shape: 'rect',
        x: rx, y: ry,
        size: rayLen, h: 1.5,
        color: innerCore,
        alpha: (0.12 + innerPulse * 0.18) * (isLowHp ? 1.5 : 1) * renderAlpha,
        rotation: rayAngle,
        z: renderZ,
      });
    }

    // ============================================
    // Layer 9: 闪烁星光粒子 (随机短暂爆发, 位置分散在水晶周围)
    // ============================================
    const sparkleSlot = Math.floor(phase * 4.1 * speedMul) % 6;  // 6个槽位轮换
    const sparklePhase = (phase * 4.1 * speedMul) % 1;             // 当前槽位内的阶段
    const sparkleLifetime = 0.35;                                   // 单次闪烁持续时长
    if (sparklePhase < sparkleLifetime) {
      const sAngle = (sparkleSlot / 6) * Math.PI * 2 + phase * 0.2;
      const sDist = 14 + (sparkleSlot % 3) * 6;
      const sx = cx + Math.cos(sAngle) * sDist;
      const sy = cy + Math.sin(sAngle) * sDist * 0.7;
      const sLife = sparklePhase / sparkleLifetime; // 0→1
      // 闪烁曲线: 快速亮起, 慢速消散
      const sAlpha = sLife < 0.2
        ? sLife / 0.2 * 0.9
        : (1 - (sLife - 0.2) / 0.8) * 0.9;
      const sSize = 1.5 + (sLife < 0.2 ? sLife / 0.2 : (1 - sLife)) * 5;
      this.renderer.push({
        shape: 'diamond',
        x: sx, y: sy,
        size: sSize,
        color: whitePure,
        alpha: sAlpha * renderAlpha,
        z: renderZ,
      });
    }
  }

  // ============================================
  // Tower idle effects — particles, auras, orbiter
  // ============================================

  /** Deterministic seed-based particle generation for tower idle effects */
  private seedRand(seed: number): () => number {
    let s = (seed * 16807) % 2147483647;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  private drawTowerIdleEffects(
    eid: number, posX: number, posY: number,
    towerTypeVal: number, drawSize: number, renderZ: number,
    hasFrozen: boolean, hasStunned: boolean,
  ): void {
    if (hasFrozen || hasStunned) return; // disabled towers idle effects stop

    const t = Date.now() * 0.001;
    const seed = eid * 2654435761;
    const rng = this.seedRand(seed);

    switch (towerTypeVal) {
      // ── Arrow (0): 2 floating cyan diamonds from arrow tip ──
      case 0: {
        for (let i = 0; i < 2; i++) {
          const cycle = 1.4 + i * 0.35;
          const phase = ((t * 0.7 + i * 1.8) % cycle + cycle) % cycle;
          const p = phase / cycle;
          const py = posY - drawSize * 0.45 - p * 28;
          const px = posX + Math.sin(t * 1.6 + i * Math.PI) * 5;
          this.renderer.push({ shape: 'diamond', x: px, y: py, size: 3, color: '#b3e5fc', alpha: (1 - p) * 0.55, z: renderZ + 2 });
        }
        break;
      }
      // ── Ballista (9): slow metallic gear particles rotating ──
      case 9: {
        for (let i = 0; i < 2; i++) {
          const angle = t * 1.2 + i * Math.PI;
          this.renderer.push({ shape: 'circle', x: posX + Math.cos(angle) * 18, y: posY + Math.sin(angle) * 14, size: 3, color: '#90a4ae', alpha: 0.45, z: renderZ + 1 });
        }
        break;
      }
      // ── Cannon (1): smoke puffs from barrel ──
      case 1: {
        for (let i = 0; i < 3; i++) {
          const cycle = 2.5 + i * 0.7;
          const phase = ((t * 0.9 + i * rng() * 2) % cycle + cycle) % cycle;
          const p = phase / cycle;
          const py = posY - drawSize * 0.5 - p * 32;
          const px = posX + Math.sin(t * 0.5 + i * 2.0) * 8 * p;
          this.renderer.push({ shape: 'circle', x: px, y: py, size: 3 + p * 5, color: '#bdbdbd', alpha: (1 - p) * 0.35, z: renderZ + 2 });
        }
        break;
      }
      // ── Ice (2): snowflakes + frost aura ──
      case 2: {
        // frost aura
        const auraPulse = 0.08 + 0.04 * Math.sin(t * 1.5);
        this.renderer.push({ shape: 'circle', x: posX, y: posY, size: drawSize * 1.6, color: '#81d4fa', alpha: auraPulse, z: renderZ, stroke: '#81d4fa', strokeWidth: 1 });
        // snowflakes
        for (let i = 0; i < 4; i++) {
          const cycle = 2.2 + i * 0.5;
          const phase = ((t * 0.5 + i * 1.3) % cycle + cycle) % cycle;
          const p = phase / cycle;
          const px = posX + Math.sin(t * 0.8 + i * 1.57) * 16 * p;
          const py = posY - drawSize * 0.4 - p * 30;
          this.renderer.push({ shape: 'diamond', x: px, y: py, size: 3, color: '#e1f5fe', alpha: (1 - p) * 0.7, z: renderZ + 2 });
        }
        break;
      }
      // ── Lightning (3): Tesla sparks ──
      case 3: {
        // corona pulse
        const corona = 0.06 + 0.05 * Math.sin(t * 3.5 + seed * 0.001);
        this.renderer.push({ shape: 'circle', x: posX, y: posY - drawSize * 0.35, size: drawSize * 0.5, color: '#fff176', alpha: corona, z: renderZ + 1 });
        // random spark flashes
        const sparkSeed = Math.floor(t * 2.3 + seed * 0.001);
        const sparkRng = this.seedRand(sparkSeed * 4091 + eid);
        if (sparkRng() > 0.65) {
          const sx = posX + (sparkRng() - 0.5) * 14;
          const sy = posY - drawSize * 0.3 + (sparkRng() - 0.5) * 10;
          this.renderer.push({ shape: 'diamond', x: sx, y: sy, size: 2 + sparkRng() * 3, color: '#ffffff', alpha: sparkRng() * 0.5, z: renderZ + 3 });
        }
        break;
      }
      // ── Laser (4): 3 orbiting light dots ──
      case 4: {
        for (let i = 0; i < 3; i++) {
          const angle = t * 1.5 + i * Math.PI * 2 / 3;
          const r = drawSize * 0.5 + 4;
          this.renderer.push({ shape: 'circle', x: posX + Math.cos(angle) * r, y: posY - 2 + Math.sin(angle) * (r * 0.6), size: 3, color: '#e0f7fa', alpha: 0.7, z: renderZ + 2 });
        }
        // core pulse
        const pulse = 0.3 + 0.15 * Math.sin(t * 2.5);
        this.renderer.push({ shape: 'circle', x: posX, y: posY - 2, size: drawSize * 0.3, color: '#ffffff', alpha: pulse, z: renderZ + 1 });
        break;
      }
      // ── Bat (5): 2 bat silhouettes orbiting ──
      case 5: {
        for (let i = 0; i < 2; i++) {
          const angle = t * 1.0 + i * Math.PI;
          const bx = posX + Math.cos(angle) * 22;
          const by = posY + Math.sin(angle) * 20;
          // V-shaped bat: two small triangles
          this.renderer.push({ shape: 'triangle', x: bx - 3, y: by, size: 6, color: '#311b92', alpha: 0.6, z: renderZ + 1, rotation: -0.4 });
          this.renderer.push({ shape: 'triangle', x: bx + 3, y: by, size: 6, color: '#311b92', alpha: 0.6, z: renderZ + 1, rotation: 0.4 });
        }
        // eye pulse
        const eyePulse = 0.4 + 0.2 * Math.sin(t * 1.8);
        this.renderer.push({ shape: 'circle', x: posX, y: posY + 2, size: 8, color: '#ff1744', alpha: eyePulse, z: renderZ + 1 });
        break;
      }
      // ── Missile (6): blinking light + radar scan ──
      case 6: {
        // blinking warning light
        const blinkPhase = (t % 1.5) / 1.5;
        const blinkAlpha = blinkPhase < 0.1 ? 0.9 : 0.2;
        this.renderer.push({ shape: 'circle', x: posX, y: posY - drawSize * 0.55, size: 5, color: '#ffeb3b', alpha: blinkAlpha, z: renderZ + 3 });
        // radar scan line
        const radarAngle = (t * 0.8) % (Math.PI * 2);
        const radarLen = drawSize * 0.9;
        const rx = posX + Math.cos(radarAngle) * radarLen * 0.5;
        const ry = posY - 8 + Math.sin(radarAngle) * radarLen * 0.5;
        this.renderer.push({ shape: 'rect', x: rx, y: ry, size: radarLen, h: 1, color: '#ff1744', alpha: 0.3, z: renderZ + 1, rotation: radarAngle });
        break;
      }
      // ── Fire (7): embers + fire glow ──
      case 7: {
        // fire aura
        const fireAura = 0.08 + 0.06 * Math.sin(t * 2.5);
        this.renderer.push({ shape: 'circle', x: posX, y: posY - 2, size: drawSize * 1.3, color: '#ff5722', alpha: fireAura, z: renderZ });
        // ember particles
        for (let i = 0; i < 5; i++) {
          const cycle = 1.5 + i * 0.35;
          const phase = ((t * 1.2 + i * 0.7) % cycle + cycle) % cycle;
          const p = phase / cycle;
          const px = posX + (Math.sin(t * 2.0 + i * 1.26) * 10 + (rng() - 0.5) * 4) * p;
          const py = posY - drawSize * 0.35 - p * 35;
          const colors = ['#ff9800', '#ff5722', '#ffcc80'];
          this.renderer.push({ shape: 'circle', x: px, y: py, size: 2 + p * 2, color: colors[i % 3]!, alpha: (1 - p) * 0.55, z: renderZ + 2 });
        }
        break;
      }
      // ── Poison (8): bubbles + toxic mist ──
      case 8: {
        // toxic mist aura
        const mistPulse = 0.06 + 0.03 * Math.sin(t * 1.2);
        this.renderer.push({ shape: 'circle', x: posX, y: posY, size: drawSize * 1.4, color: '#4caf50', alpha: mistPulse, z: renderZ });
        // bubbles
        for (let i = 0; i < 3; i++) {
          const cycle = 2.0 + i * 0.55;
          const phase = ((t * 0.6 + i * 1.1) % cycle + cycle) % cycle;
          const p = phase / cycle;
          const wobble = Math.sin(t * 2.5 + i * 2.0) * 5;
          const px = posX + wobble * p;
          const py = posY + drawSize * 0.3 - p * 25;
          this.renderer.push({ shape: 'circle', x: px, y: py, size: 2 + (1 - p) * 3, color: '#a5d6a7', alpha: (1 - p) * 0.5, z: renderZ + 2 });
        }
        break;
      }
      default: break;
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
