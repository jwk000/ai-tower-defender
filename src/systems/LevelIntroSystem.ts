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
//   Phase 5 — 路径从生成口向水晶蔓延 (BFS，~1.0s)
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
const PATH_REVEAL_INTERVAL = 0.04;

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
    DecorationSystem.introHideDecorations = true;

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
      // 切换到装饰物显现阶段
      DecorationSystem.introHideDecorations = false;
      this.phase = IntroPhase.DecorAppear;
      this.timer = 0;
    }
  }

  private updateDecorAppear(): void {
    this.decorAlpha = Math.min(1, this.timer / DECOR_FADE_DURATION);
    if (this.timer >= DECOR_FADE_DURATION) {
      this.decorAlpha = 1;
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
    this.pathRevealIndex = Math.min(
      Math.floor(this.timer / PATH_REVEAL_INTERVAL),
      this.pathRevealOrder.length,
    );
    if (this.pathRevealIndex >= this.pathRevealOrder.length) {
      this.phase = IntroPhase.Complete;
      this.isActive = false;
      RenderSystem.introActive = false;
      this.onComplete?.();
    }
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

    // Phase 4+: 传送门特效
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

    // 路径瓦片：Phase 5 时按 BFS 逐步揭示
    if (tile.type === TileType.Path && this.phase === IntroPhase.PathReveal) {
      if (!this.isPathTileRevealed(tile.row, tile.col)) return;
    }
    if (tile.type === TileType.Path &&
        (this.phase === IntroPhase.DecorAppear ||
         this.phase === IntroPhase.CrystalAppear ||
         this.phase === IntroPhase.SpawnAppear)) {
      return; // 路径在 Phase 5 才展示
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

  private computePathRevealOrder(): void {
    const map = this.map;
    const visited = new Set<string>();
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    const queue: { r: number; c: number; dist: number }[] = [];

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        if (map.tiles[r]![c]! === TileType.Spawn) {
          const key = `${r},${c}`;
          visited.add(key);
          queue.push({ r, c, dist: 0 });
        }
      }
    }

    const entries: PathTileEntry[] = [];

    while (queue.length > 0) {
      const { r, c, dist } = queue.shift()!;

      if (map.tiles[r]![c]! === TileType.Path) {
        entries.push({ row: r, col: c, distance: dist });
      }

      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= map.rows || nc < 0 || nc >= map.cols) continue;

        const nTile = map.tiles[nr]![nc]!;
        if (nTile !== TileType.Path && nTile !== TileType.Base && nTile !== TileType.Spawn) continue;

        const key = `${nr},${nc}`;
        if (visited.has(key)) continue;
        visited.add(key);

        queue.push({ r: nr, c: nc, dist: dist + 1 });
      }
    }

    entries.sort((a, b) => a.distance - b.distance);
    this.pathRevealOrder = entries;
  }

  private isPathTileRevealed(row: number, col: number): boolean {
    for (let i = 0; i < this.pathRevealIndex && i < this.pathRevealOrder.length; i++) {
      const entry = this.pathRevealOrder[i]!;
      if (entry.row === row && entry.col === col) return true;
    }
    return false;
  }
}
