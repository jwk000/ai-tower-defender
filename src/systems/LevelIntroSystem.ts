// ============================================================
// Tower Defender — LevelIntroSystem
//
// 关卡入场动画系统 (v4.1)
// 设计文档: design/05-presentation.md §11
//
// 五阶段仪式感动画：
//   Phase 1 — 普通场景地格从天而降 (1.2s + 0.5s stagger)
//   Phase 2 — 场景装饰显现 (0.6s fade)
//   Phase 3 — 水晶地格替换水晶位置 (0.6s fade)
//   Phase 4 — 出生口地格替换出生口位置 (0.5s fade)
//   Phase 5 — 路径按 path 顺序逐格替换普通场景地格 (20ms/格)
// 动画完成后启动第一波倒计时。
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { Visual } from '../core/components.js';
import { TileType, type MapConfig } from '../types/index.js';
import { RenderSystem, computeSceneLayout } from './RenderSystem.js';
import { DecorationSystem } from './DecorationSystem.js';
import { resolveGraphFromMap } from '../level/graph/loaderAdapter.js';
import type { PathNode } from '../level/graph/types.js';
import { drawImageFrame, getLoadedImageFrame } from '../utils/imageCache.js';
import { objectiveArtPath, objectiveFxArtPath } from '../utils/artAssets.js';
import { getTileTexturePathForType } from '../utils/pathTileTexture.js';
import { Sound } from '../utils/Sound.js';

// ---- 阶段枚举 ----

export enum IntroPhase {
  None = 'none',
  TilesFalling = 'tiles_falling',
  DecorAppear = 'decor_appear',
  CrystalAppear = 'crystal_appear',
  SpawnAppear = 'spawn_appear',
  PathReveal = 'path_reveal',
  Complete = 'complete',
}

// ---- 瓦片动画数据 ----

interface TileAnimData {
  row: number;
  col: number;
  type: TileType;
  targetX: number;
  targetY: number;
  startY: number;
  currentY: number;
  delay: number;
  dropSoundPlayed: boolean;
}

// ---- 路径揭示条目 ----

interface PathTileEntry {
  row: number;
  col: number;
  distance: number;
  sequence: number;
}

interface TileBreakEffect {
  row: number;
  col: number;
  x: number;
  y: number;
  elapsed: number;
  seed: number;
}

// ---- 静态配置 ----

const TILE_FALL_DURATION = 1.2;
const TILE_FALL_STAGGER = 0.5;
const DECOR_FADE_DURATION = 0.6;
const CRYSTAL_FADE_DURATION = 0.6;
const SPAWN_FADE_DURATION = 0.5;
const PATH_TILE_INTERVAL = 0.02;
const TILE_BREAK_DURATION = 0.42;
const TILE_BREAK_GRID = 4;

export class LevelIntroSystem implements System {
  readonly name = 'LevelIntroSystem';

  phase: IntroPhase = IntroPhase.None;
  isActive: boolean = false;
  onComplete: (() => void) | null = null;

  private renderer: Renderer;
  private map: MapConfig;
  private ts: number;
  private ox: number;
  private oy: number;

  private timer: number = 0;
  private tiles: TileAnimData[] = [];

  // Path reveal
  private pathRevealOrder: PathTileEntry[] = [];
  private pathRevealIndex: number = 0;
  private previousPathRevealIndex: number = 0;
  private revealedPathTiles = new Set<string>();
  private tileBreakEffects: TileBreakEffect[] = [];
  private pathRevealDone: boolean = false;
  private frameDt: number = 1 / 60;

  // 各阶段 alpha
  private decorAlpha: number = 0;
  private crystalAlpha: number = 0;
  private spawnAlpha: number = 0;

  /** 水晶的 ECS 实体 ID */
  private baseEntityId: number | null = null;

  constructor(renderer: Renderer, map: MapConfig) {
    this.renderer = renderer;
    this.map = map;
    this.ts = map.tileSize;

    const layout = computeSceneLayout(map, LayoutManager.DESIGN_W, LayoutManager.DESIGN_H);
    this.ox = layout.offsetX;
    this.oy = layout.offsetY;

    this.collectTiles();
    this.computePathRevealOrder();
    this.preloadIntroArt();
  }

  setBaseEntityId(eid: number): void {
    this.baseEntityId = eid;
  }

  // ============================================================
  // 启动
  // ============================================================

  start(): void {
    this.phase = IntroPhase.TilesFalling;
    this.timer = 0;
    this.isActive = true;
    this.decorAlpha = 0;
    this.crystalAlpha = 0;
    this.spawnAlpha = 0;
    this.pathRevealIndex = 0;
    this.previousPathRevealIndex = 0;
    this.pathRevealDone = false;
    this.revealedPathTiles.clear();
    this.tileBreakEffects = [];
    if (this.baseEntityId !== null) {
      Visual.alpha[this.baseEntityId] = 0;
    }

    // 抑制正常渲染
    RenderSystem.introActive = true;
    DecorationSystem.introDecorAlpha = 0;

    // 随机化瓦片延迟
    for (const tile of this.tiles) {
      tile.delay = Math.random() * TILE_FALL_STAGGER;
      tile.currentY = tile.startY;
      tile.dropSoundPlayed = false;
    }
  }

  // ============================================================
  // System.update
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    if (!this.isActive) return;
    this.frameDt = dt;
    this.timer += dt;

    switch (this.phase) {
      case IntroPhase.TilesFalling:
        this.updateTilesFalling();
        break;
      case IntroPhase.DecorAppear:
        this.updateDecorAppear();
        break;
      case IntroPhase.CrystalAppear:
        this.updateCrystalAppear(world);
        break;
      case IntroPhase.SpawnAppear:
        this.updateSpawnAppear();
        break;
      case IntroPhase.PathReveal:
        this.updatePathReveal();
        break;
      case IntroPhase.Complete:
        break;
      case IntroPhase.None:
        break;
    }

    this.render();
  }

  // ============================================================
  // 阶段更新
  // ============================================================

  private updateTilesFalling(): void {
    const totalDuration = TILE_FALL_DURATION + TILE_FALL_STAGGER + 0.2;
    this.updateTileDropSounds();
    if (this.timer >= totalDuration) {
      this.phase = IntroPhase.DecorAppear;
      this.timer = 0;
    }
  }

  private updateTileDropSounds(): void {
    for (const tile of this.tiles) {
      if (tile.dropSoundPlayed) continue;
      if (this.timer < tile.delay + TILE_FALL_DURATION) continue;
      tile.dropSoundPlayed = true;
      Sound.play('intro_tile_drop');
    }
  }

  private updateDecorAppear(): void {
    this.decorAlpha = Math.min(1, this.timer / DECOR_FADE_DURATION);
    DecorationSystem.introDecorAlpha = this.decorAlpha;
    if (this.timer >= DECOR_FADE_DURATION) {
      this.decorAlpha = 1;
      DecorationSystem.introDecorAlpha = 1;
      this.phase = IntroPhase.CrystalAppear;
      this.timer = 0;
      this.spawnBreakEffectsForType(TileType.Base);
    }
  }

  private updateCrystalAppear(world: TowerWorld): void {
    this.crystalAlpha = Math.min(1, this.timer / CRYSTAL_FADE_DURATION);
    // 通过 Visual.alpha 控制水晶实体的透明度
    if (this.baseEntityId !== null) {
      Visual.alpha[this.baseEntityId] = this.crystalAlpha;
    }
    if (this.timer >= CRYSTAL_FADE_DURATION) {
      this.crystalAlpha = 1;
      this.phase = IntroPhase.SpawnAppear;
      this.timer = 0;
      this.spawnBreakEffectsForType(TileType.Spawn);
    }
  }

  private updateSpawnAppear(): void {
    this.spawnAlpha = Math.min(1, this.timer / SPAWN_FADE_DURATION);
    if (this.timer >= SPAWN_FADE_DURATION) {
      this.spawnAlpha = 1;
      this.phase = IntroPhase.PathReveal;
      this.timer = 0;
    }
  }

  private updatePathReveal(): void {
    const total = this.pathRevealOrder.length;
    if (total === 0) {
      this.finishIntro();
      return;
    }
    if (!this.pathRevealDone) {
      this.pathRevealIndex = Math.min(total, Math.floor(this.timer / PATH_TILE_INTERVAL) + 1);
      for (let i = this.previousPathRevealIndex; i < this.pathRevealIndex; i++) {
        const entry = this.pathRevealOrder[i];
        if (entry) this.spawnBreakEffect(entry.row, entry.col);
      }
      this.previousPathRevealIndex = this.pathRevealIndex;
      this.revealedPathTiles.clear();
      for (let i = 0; i < this.pathRevealIndex; i++) {
        const entry = this.pathRevealOrder[i];
        if (entry) this.revealedPathTiles.add(`${entry.row},${entry.col}`);
      }
      if (this.pathRevealIndex >= total) {
        this.pathRevealIndex = total;
        this.pathRevealDone = true;
      }
    }
    if (this.pathRevealDone && this.tileBreakEffects.length === 0) {
      this.finishIntro();
    }
  }

  private finishIntro(): void {
    this.phase = IntroPhase.Complete;
    this.isActive = false;
    RenderSystem.introActive = false;
    if (this.baseEntityId !== null) {
      Visual.alpha[this.baseEntityId] = 1;
    }
    this.onComplete?.();
  }

  // ============================================================
  // 渲染（直接 Canvas 2D 绘制，绕过命令缓冲）
  // ============================================================

  private render(): void {
    const ctx = this.renderer.context;
    this.updateTileBreakEffects();

    for (const tile of this.tiles) {
      switch (this.phase) {
        case IntroPhase.TilesFalling:
          this.renderTileFalling(ctx, tile);
          break;
        default:
          this.renderTileNormal(ctx, tile);
          break;
      }
    }

    this.renderTileBreakEffects(ctx);

    // 传送门特效（SpawnAppear 及之后）
    if (this.phase === IntroPhase.SpawnAppear ||
        this.phase === IntroPhase.PathReveal ||
        this.phase === IntroPhase.Complete) {
      for (const tile of this.tiles) {
        if (tile.type === TileType.Spawn) {
          const alpha = this.phase === IntroPhase.SpawnAppear ? this.spawnAlpha : 1;
          this.drawSpawnPortal(ctx, tile.targetX, tile.targetY, alpha);
        }
      }
    }
  }

  // ============================================================
  // 瓦片绘制
  // ============================================================

  private renderTileFalling(ctx: CanvasRenderingContext2D, tile: TileAnimData): void {
    if (this.timer < tile.delay) return;

    const elapsed = this.timer - tile.delay;
    const progress = Math.min(1, elapsed / TILE_FALL_DURATION);
    const eased = progress * progress;

    tile.currentY = tile.startY + (tile.targetY - tile.startY) * eased;

    this.drawTile(ctx, tile.targetX, tile.currentY, TileType.Empty, 1);
  }

  private renderTileNormal(ctx: CanvasRenderingContext2D, tile: TileAnimData): void {
    const x = tile.targetX;
    const y = tile.targetY;

    if (tile.type === TileType.Base && this.phaseAtLeast(IntroPhase.CrystalAppear)) {
      const alpha = this.phase === IntroPhase.CrystalAppear ? this.crystalAlpha : 1;
      this.drawTile(ctx, x, y, TileType.Empty, 1 - alpha);
      this.drawTile(ctx, x, y, TileType.Base, alpha);
      return;
    }

    if (tile.type === TileType.Spawn && this.phaseAtLeast(IntroPhase.SpawnAppear)) {
      const alpha = this.phase === IntroPhase.SpawnAppear ? this.spawnAlpha : 1;
      this.drawTile(ctx, x, y, TileType.Empty, 1 - alpha);
      this.drawTile(ctx, x, y, TileType.Spawn, alpha);
      return;
    }

    if (tile.type === TileType.Path && this.phaseAtLeast(IntroPhase.PathReveal) && this.revealedPathTiles.has(`${tile.row},${tile.col}`)) {
      this.drawTile(ctx, x, y, TileType.Path, 1);
      return;
    }

    this.drawTile(ctx, x, y, TileType.Empty, 1);
  }

  private drawTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: TileType, alpha: number): void {
    const texturePath = getTileTexturePathForType(type, this.map.artTheme);
    const texture = texturePath ? getLoadedImageFrame(texturePath) : null;
    const s = texture ? this.ts : this.ts - 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (texture) {
      drawImageFrame(ctx, texture, cx - s / 2, cy - s / 2, s, s);
    } else {
      ctx.fillStyle = this.getFallbackTileColor(type);
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    }
    ctx.restore();
  }

  private updateTileBreakEffects(): void {
    if (this.tileBreakEffects.length === 0) return;
    for (const effect of this.tileBreakEffects) {
      effect.elapsed += this.frameDt;
    }
    this.tileBreakEffects = this.tileBreakEffects.filter(effect => effect.elapsed < TILE_BREAK_DURATION);
  }

  private renderTileBreakEffects(ctx: CanvasRenderingContext2D): void {
    if (this.tileBreakEffects.length === 0) return;

    const texturePath = getTileTexturePathForType(TileType.Empty, this.map.artTheme);
    const texture = texturePath ? getLoadedImageFrame(texturePath) : null;
    const fallback = this.getFallbackTileColor(TileType.Empty);
    const sourceX = texture?.source?.x ?? 0;
    const sourceY = texture?.source?.y ?? 0;
    const sourceW = texture?.width || 1;
    const sourceH = texture?.height || 1;
    const pieceW = this.ts / TILE_BREAK_GRID;
    const pieceH = this.ts / TILE_BREAK_GRID;

    for (const effect of this.tileBreakEffects) {
      const t = Math.min(1, effect.elapsed / TILE_BREAK_DURATION);
      const easeOut = 1 - (1 - t) * (1 - t);
      const alpha = (1 - t) * 0.92;

      for (let i = 0; i < 10; i++) {
        const a = this.hash01(effect.seed, 100 + i) * Math.PI * 2;
        const r = (10 + this.hash01(effect.seed, 120 + i) * 28) * easeOut;
        const px = effect.x + Math.cos(a) * r;
        const py = effect.y + Math.sin(a) * r - Math.sin(t * Math.PI) * 8;
        const pr = 1.2 + this.hash01(effect.seed, 140 + i) * 2.2;
        ctx.save();
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = i % 2 === 0 ? '#d8e7aa' : '#6c7f5c';
        ctx.beginPath();
        ctx.arc(px, py, pr * (1 - t * 0.45), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let gy = 0; gy < TILE_BREAK_GRID; gy++) {
        for (let gx = 0; gx < TILE_BREAK_GRID; gx++) {
          const idx = gy * TILE_BREAK_GRID + gx;
          const rx = this.hash01(effect.seed, idx * 3 + 1);
          const ry = this.hash01(effect.seed, idx * 3 + 2);
          const rr = this.hash01(effect.seed, idx * 3 + 3);
          const localX = (gx + 0.5) * pieceW - this.ts / 2;
          const localY = (gy + 0.5) * pieceH - this.ts / 2;
          const awayAngle = Math.atan2(localY, localX) + (rx - 0.5) * 0.9;
          const dist = (12 + rr * 26) * easeOut;
          const lift = -Math.sin(t * Math.PI) * (6 + ry * 14);
          const drawX = effect.x + localX + Math.cos(awayAngle) * dist;
          const drawY = effect.y + localY + Math.sin(awayAngle) * dist + lift;
          const rot = (rr - 0.5) * Math.PI * 1.2 * easeOut;
          const scale = 1 - t * 0.18;
          const dw = pieceW * scale;
          const dh = pieceH * scale;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.shadowColor = 'rgba(218, 238, 166, 0.35)';
          ctx.shadowBlur = 4;
          ctx.translate(drawX, drawY);
          ctx.rotate(rot);
          if (texture) {
            const sx = sourceX + gx * sourceW / TILE_BREAK_GRID;
            const sy = sourceY + gy * sourceH / TILE_BREAK_GRID;
            const sw = sourceW / TILE_BREAK_GRID;
            const sh = sourceH / TILE_BREAK_GRID;
            ctx.drawImage(texture.image, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
          } else {
            ctx.fillStyle = fallback;
            ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
          }
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(230, 242, 180, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-dw / 2, -dh / 2, dw, dh);
          ctx.restore();
        }
      }
    }
  }

  private spawnBreakEffectsForType(type: TileType): void {
    for (const tile of this.tiles) {
      if (tile.type === type) {
        this.spawnBreakEffect(tile.row, tile.col);
      }
    }
  }

  private spawnBreakEffect(row: number, col: number): void {
    const tile = this.tiles.find(candidate => candidate.row === row && candidate.col === col);
    if (!tile) return;
    Sound.play('intro_path_break');
    this.tileBreakEffects.push({
      row,
      col,
      x: tile.targetX,
      y: tile.targetY,
      elapsed: 0,
      seed: (row + 1) * 73856093 ^ (col + 1) * 19349663,
    });
  }

  private hash01(seed: number, salt: number): number {
    let x = (seed ^ Math.imul(salt + 1, 0x45d9f3b)) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  private getFallbackTileColor(type: TileType): string {
    const tc = this.map.tileColors ?? {};
    const defaults: Partial<Record<TileType, string>> = {
      [TileType.Empty]: '#5e6b4e',
      [TileType.Path]: '#8a7d6b',
      [TileType.Blocked]: '#566570',
      [TileType.Spawn]: '#b86b1e',
      [TileType.Base]: '#1866a8',
    };
    return tc[type] ?? defaults[type] ?? '#333333';
  }

  private preloadIntroArt(): void {
    for (const type of [TileType.Empty, TileType.Path, TileType.Base, TileType.Spawn]) {
      const path = getTileTexturePathForType(type, this.map.artTheme);
      if (path) getLoadedImageFrame(path);
    }
    getLoadedImageFrame(objectiveArtPath('spawn_portal'));
    getLoadedImageFrame(objectiveFxArtPath('spawn_portal'));
  }

  private phaseAtLeast(phase: IntroPhase): boolean {
    const order: Record<IntroPhase, number> = {
      [IntroPhase.None]: 0,
      [IntroPhase.TilesFalling]: 1,
      [IntroPhase.DecorAppear]: 2,
      [IntroPhase.CrystalAppear]: 3,
      [IntroPhase.SpawnAppear]: 4,
      [IntroPhase.PathReveal]: 5,
      [IntroPhase.Complete]: 6,
    };
    return order[this.phase] >= order[phase];
  }

  // ============================================================
  // 传送门（精简版）
  // ============================================================

  private drawSpawnPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, alpha: number): void {
    const r = this.ts * 0.44;
    const t = this.timer;
    const fx = getLoadedImageFrame(objectiveFxArtPath('spawn_portal'));
    const portal = getLoadedImageFrame(objectiveArtPath('spawn_portal'));

    if (fx || portal) {
      if (fx) {
        const pulse = 1 + Math.sin(t * 1.4) * 0.04;
        const s = this.ts * 1.34 * pulse;
        ctx.save();
        ctx.globalAlpha = alpha * 0.72;
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.18);
        drawImageFrame(ctx, fx, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      if (portal) {
        const s = this.ts * 1.06;
        ctx.save();
        ctx.globalAlpha = alpha * 0.98;
        ctx.translate(cx, cy);
        ctx.rotate(-t * 0.28);
        drawImageFrame(ctx, portal, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      if (portal) return;
    }

    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#0a0000';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    ctx.fill();

    const outerPulse = 1 + Math.sin(t * 1.2) * 0.08;
    ctx.globalAlpha = alpha * 0.25;
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5 * outerPulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.6;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + t * 0.9;
      const dx = Math.cos(angle) * r * 1.15;
      const dy = Math.sin(angle) * r * 1.15;
      ctx.fillStyle = '#ff5252';
      ctx.save();
      ctx.translate(cx + dx, cy + dy);
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, 3);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ============================================================
  // 工具方法
  // ============================================================

  private collectTiles(): void {
    const map = this.map;

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const x = c * this.ts + this.ts / 2 + this.ox;
        const y = r * this.ts + this.ts / 2 + this.oy;
        const startY = -200 - Math.random() * 400;

        this.tiles.push({
          row: r, col: c, type: tile,
          targetX: x, targetY: y,
          startY, currentY: startY,
          delay: 0,
          dropSoundPlayed: false,
        });
      }
    }
  }

  /**
   * 从路径图提取行走路线顺序（spawn → waypoints → crystal_anchor）
   * 用于路径铺展动画，按敌人实际行走方向逐格揭示。
   */
  private computePathRevealOrder(): void {
    const map = this.map;
    const graph = resolveGraphFromMap(map);
    const { nodes, edges } = graph.pathGraph;

    // 找到所有 spawn 节点
    const spawnNodes = nodes.filter(n => n.role === 'spawn');
    if (spawnNodes.length === 0) return;

    // 建索引：id → node
    const nodeById = new Map<string, PathNode>();
    for (const n of nodes) nodeById.set(n.id, n);

    const outgoing = new Map<string, string[]>();
    for (const edge of edges) {
      const list = outgoing.get(edge.from) ?? [];
      list.push(edge.to);
      outgoing.set(edge.from, list);
    }

    const entriesByTile = new Map<string, PathTileEntry>();
    let sequence = 0;
    for (const spawnNode of spawnNodes) {
      const queue: Array<{ node: PathNode; distance: number }> = [{ node: spawnNode, distance: 0 }];
      const visitedNodes = new Set<string>([spawnNode.id]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const targets = outgoing.get(current.node.id) ?? [];

        for (const targetId of targets) {
          const targetNode = nodeById.get(targetId);
          if (!targetNode) continue;

          const steps = this.interpolateEdge(current.node.col, current.node.row, targetNode.col, targetNode.row);
          let stepDistance = current.distance;
          for (const [c, r] of steps) {
            if (r < 0 || r >= map.rows || c < 0 || c >= map.cols) continue;
            if (map.tiles[r]![c]! !== TileType.Path) continue;
            const key = `${r},${c}`;
            const existing = entriesByTile.get(key);
            if (!existing || stepDistance < existing.distance) {
              entriesByTile.set(key, { row: r, col: c, distance: stepDistance, sequence: sequence++ });
            }
            stepDistance++;
          }

          if (!visitedNodes.has(targetNode.id)) {
            visitedNodes.add(targetNode.id);
            queue.push({ node: targetNode, distance: stepDistance });
          }
        }
      }
    }

    this.pathRevealOrder = [...entriesByTile.values()]
      .sort((a, b) => a.distance - b.distance || a.sequence - b.sequence);
  }

  /** 两点间插值，生成经过的格子坐标列表 */
  private interpolateEdge(x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const result: [number, number][] = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy);

    if (steps === 0) {
      result.push([x0, y0]);
      return result;
    }

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      result.push([cx, cy]);
    }

    return result;
  }
}
