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
import { getLoadedImage } from '../utils/imageCache.js';
import { objectiveArtPath, objectiveFxArtPath } from '../utils/artAssets.js';
import { getTileTexturePathForType } from '../utils/pathTileTexture.js';

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
}

// ---- 路径揭示条目 ----

interface PathTileEntry {
  row: number;
  col: number;
  distance: number;
  sequence: number;
}

// ---- 静态配置 ----

const TILE_FALL_DURATION = 1.2;
const TILE_FALL_STAGGER = 0.5;
const DECOR_FADE_DURATION = 0.6;
const CRYSTAL_FADE_DURATION = 0.6;
const SPAWN_FADE_DURATION = 0.5;
const PATH_TILE_INTERVAL = 0.02;

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
  private revealedPathTiles = new Set<string>();

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
    this.revealedPathTiles.clear();
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
    }
  }

  // ============================================================
  // System.update
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    if (!this.isActive) return;
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
    if (this.timer >= totalDuration) {
      this.phase = IntroPhase.DecorAppear;
      this.timer = 0;
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
    this.pathRevealIndex = Math.min(total, Math.floor(this.timer / PATH_TILE_INTERVAL) + 1);
    this.revealedPathTiles.clear();
    for (let i = 0; i < this.pathRevealIndex; i++) {
      const entry = this.pathRevealOrder[i];
      if (entry) this.revealedPathTiles.add(`${entry.row},${entry.col}`);
    }
    if (this.pathRevealIndex >= total) {
      this.pathRevealIndex = total;
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

    this.drawTile(ctx, x, y, TileType.Empty, 1);

    if (tile.type === TileType.Base && this.phaseAtLeast(IntroPhase.CrystalAppear)) {
      const alpha = this.phase === IntroPhase.CrystalAppear ? this.crystalAlpha : 1;
      this.drawTile(ctx, x, y, TileType.Base, alpha);
      return;
    }

    if (tile.type === TileType.Spawn && this.phaseAtLeast(IntroPhase.SpawnAppear)) {
      const alpha = this.phase === IntroPhase.SpawnAppear ? this.spawnAlpha : 1;
      this.drawTile(ctx, x, y, TileType.Spawn, alpha);
      return;
    }

    if (tile.type === TileType.Path && this.phaseAtLeast(IntroPhase.PathReveal) && this.revealedPathTiles.has(`${tile.row},${tile.col}`)) {
      this.drawTile(ctx, x, y, TileType.Path, 1);
    }
  }

  private drawTile(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: TileType, alpha: number): void {
    const texturePath = getTileTexturePathForType(type, this.map.artTheme);
    const texture = texturePath ? getLoadedImage(texturePath) : null;
    const s = texture ? this.ts : this.ts - 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (texture) {
      ctx.drawImage(texture, cx - s / 2, cy - s / 2, s, s);
    } else {
      ctx.fillStyle = this.getFallbackTileColor(type);
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    }
    ctx.restore();
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
      if (path) getLoadedImage(path);
    }
    getLoadedImage(objectiveArtPath('spawn_portal'));
    getLoadedImage(objectiveFxArtPath('spawn_portal'));
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
    const fx = getLoadedImage(objectiveFxArtPath('spawn_portal'));
    const portal = getLoadedImage(objectiveArtPath('spawn_portal'));

    if (fx || portal) {
      if (fx) {
        const pulse = 1 + Math.sin(t * 1.4) * 0.04;
        const s = this.ts * 1.34 * pulse;
        ctx.save();
        ctx.globalAlpha = alpha * 0.72;
        ctx.translate(cx, cy);
        ctx.rotate(t * 0.18);
        ctx.drawImage(fx, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      if (portal) {
        const s = this.ts * 1.06;
        ctx.save();
        ctx.globalAlpha = alpha * 0.98;
        ctx.translate(cx, cy);
        ctx.rotate(-t * 0.28);
        ctx.drawImage(portal, -s / 2, -s / 2, s, s);
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
