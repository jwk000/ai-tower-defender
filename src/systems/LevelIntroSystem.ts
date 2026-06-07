// ============================================================
// Tower Defender — LevelIntroSystem
//
// 关卡入场动画系统 (v4.1)
// 设计文档: design/05-presentation.md §11
//
// 五阶段仪式感动画：
//   Phase 1 — 棋盘瓦片从天而降 (1.2s + 0.5s stagger)
//   Phase 2 — 场景装饰显现 (0.6s fade)
//   Phase 3 — 水晶显现 (0.6s fade + scale)
//   Phase 4 — 传送门显现 (0.5s fade)
//   Phase 5 — 路径沿行走路线铺展 (1.5s)
// 动画完成后启动第一波倒计时。
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { Visual } from '../core/components.js';
import { TileType, type MapConfig } from '../types/index.js';
import { RenderSystem, computeSceneLayout } from './RenderSystem.js';
import { DecorationSystem } from './DecorationSystem.js';
import { isAdjacentToPath } from '../utils/grid.js';
import { resolveGraphFromMap } from '../level/graph/loaderAdapter.js';
import type { PathNode } from '../level/graph/types.js';

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
  color: string;
  adjColor: string | null;
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
}

// ---- 静态配置 ----

const TILE_FALL_DURATION = 1.2;
const TILE_FALL_STAGGER = 0.5;
const DECOR_FADE_DURATION = 0.6;
const CRYSTAL_FADE_DURATION = 0.6;
const SPAWN_FADE_DURATION = 0.5;
const PATH_REVEAL_DURATION = 1.5;  // 总时长（秒）

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
    const progress = Math.min(1, this.timer / PATH_REVEAL_DURATION);
    this.pathRevealIndex = Math.floor(progress * total);
    if (this.pathRevealIndex >= total) {
      this.pathRevealIndex = total;
      this.finishIntro();
    }
  }

  private finishIntro(): void {
    this.phase = IntroPhase.Complete;
    this.isActive = false;
    RenderSystem.introActive = false;
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

    // 路径铺展叠加层：在已有棋盘格子上绘制蔓延高亮
    if (this.phase === IntroPhase.PathReveal) {
      this.renderPathOverlay(ctx);
    }

    // 传送门特效（SpawnAppear 及之后）
    if (this.phase === IntroPhase.SpawnAppear ||
        this.phase === IntroPhase.PathReveal ||
        this.phase === IntroPhase.Complete) {
      for (const tile of this.tiles) {
        if (tile.type === TileType.Spawn) {
          const alpha = this.phase === IntroPhase.SpawnAppear ? this.spawnAlpha : 1;
          this.drawSpawnPortalSimple(ctx, tile.targetX, tile.targetY, alpha);
        }
      }
    }
  }

  /** 在路径格子上绘制流动高亮叠加（沿行走路线方向 sweep） */
  private renderPathOverlay(ctx: CanvasRenderingContext2D): void {
    const s = this.ts - 2;
    const revealed = this.pathRevealOrder.slice(0, this.pathRevealIndex);

    for (let i = 0; i < revealed.length; i++) {
      const entry = revealed[i]!;
      const tile = this.tiles.find(t => t.row === entry.row && t.col === entry.col);
      if (!tile) continue;

      // 沿路线进度渐变：越近 spawn 越"旧"（恢复到正常色），越近前沿越亮
      const progress = revealed.length > 1 ? i / (revealed.length - 1) : 1;
      const brightness = 0.3 + (1 - progress) * 0.5; // 头部最亮，尾部收敛

      const x = tile.targetX;
      const y = tile.targetY;

      ctx.save();
      // 亮色叠加覆盖原路径瓦片
      ctx.fillStyle = '#c4a96a';  // 亮金色路径
      ctx.globalAlpha = brightness;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);

      // 展开前沿（最后几个格子）额外光晕
      if (i >= revealed.length - 5) {
        const trailAlpha = (i - (revealed.length - 5)) / 5 * 0.4;
        ctx.fillStyle = '#ffd54f';
        ctx.globalAlpha = trailAlpha;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.restore();
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

    ctx.save();
    ctx.fillStyle = tile.color;
    const s = this.ts - 2;
    ctx.fillRect(tile.targetX - s / 2, tile.currentY - s / 2, s, s);
    ctx.restore();
  }

  private renderTileNormal(ctx: CanvasRenderingContext2D, tile: TileAnimData): void {
    const x = tile.targetX;
    const y = tile.targetY;
    const s = this.ts - 2;

    // 路径瓦片在 TilesFalling 阶段由 renderTileFalling 处理，其他阶段正常渲染
    if (tile.type === TileType.Path && (this.phase === IntroPhase.TilesFalling)) {
      return; // handled by renderTileFalling
    }

    // 生成口瓦片：Phase 4 之前隐藏
    if (tile.type === TileType.Spawn && this.phase !== IntroPhase.SpawnAppear &&
        this.phase !== IntroPhase.PathReveal && this.phase !== IntroPhase.Complete) {
      const isAfterFall = this.phase !== IntroPhase.TilesFalling;
      if (isAfterFall) return;
    }

    ctx.save();
    ctx.fillStyle = tile.color;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.restore();

    // 邻路绿色叠加
    if (tile.type === TileType.Empty && tile.adjColor) {
      ctx.save();
      ctx.fillStyle = tile.adjColor;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.strokeStyle = '#709470';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.2;
      ctx.strokeRect(x - s / 2, y - s / 2, s, s);
      ctx.restore();
    }
  }

  // ============================================================
  // 传送门（精简版）
  // ============================================================

  private drawSpawnPortalSimple(ctx: CanvasRenderingContext2D, cx: number, cy: number, alpha: number): void {
    const r = this.ts * 0.44;
    const t = this.timer * 0.001;

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
    const tc = map.tileColors ?? {};
    const defaults: Partial<Record<TileType, string>> = {
      [TileType.Empty]: '#5e6b4e',
      [TileType.Path]: '#8a7d6b',
      [TileType.Blocked]: '#566570',
      [TileType.Spawn]: '#b86b1e',
      [TileType.Base]: '#1866a8',
    };

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const x = c * this.ts + this.ts / 2 + this.ox;
        const y = r * this.ts + this.ts / 2 + this.oy;
        let color: string;
        let adjColor: string | null = null;

        switch (tile) {
          case TileType.Empty: {
            const adjacent = isAdjacentToPath(r, c, map);
            if (tc[TileType.Empty]) {
              color = tc[TileType.Empty]!;
            } else {
              color = adjacent ? '#6b7d5e' : defaults[TileType.Empty]!;
            }
            if (adjacent && !tc[TileType.Empty]) {
              adjColor = '#5c7e5c';
            }
            break;
          }
          default:
            color = tc[tile] ?? defaults[tile] ?? '#333333';
            break;
        }

        const startY = -200 - Math.random() * 400;

        this.tiles.push({
          row: r, col: c, type: tile,
          color, adjColor,
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

    // 从第一个 spawn 出发，沿边走到 crystal_anchor
    const entries: PathTileEntry[] = [];
    const visitedEdges = new Set<string>();
    const startNode = spawnNodes[0]!;
    const stack = [startNode];
    const visitedNodes = new Set<string>();
    visitedNodes.add(startNode.id);

    let dist = 0;
    while (stack.length > 0) {
      const node = stack.pop()!;

      for (const edge of edges) {
        const edgeKey = `${edge.from}→${edge.to}`;
        if (visitedEdges.has(edgeKey)) continue;
        visitedEdges.add(edgeKey);

        let fromNode: typeof node | undefined;
        let toNode: typeof node | undefined;
        if (edge.from === node.id) {
          fromNode = node;
          toNode = nodeById.get(edge.to);
        } else if (edge.to === node.id) {
          fromNode = nodeById.get(edge.from);
          toNode = node;
        } else {
          continue;
        }

        if (!fromNode || !toNode) continue;

        // 沿边插值格子
        const steps = this.interpolateEdge(fromNode.col, fromNode.row, toNode.col, toNode.row);
        for (const [c, r] of steps) {
          if (r < 0 || r >= map.rows || c < 0 || c >= map.cols) continue;
          if (map.tiles[r]![c]! !== TileType.Path) continue;
          entries.push({ row: r, col: c, distance: dist++ });
        }

        if (!visitedNodes.has(toNode.id)) {
          visitedNodes.add(toNode.id);
          stack.push(toNode);
        }
      }
    }

    this.pathRevealOrder = entries;
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
