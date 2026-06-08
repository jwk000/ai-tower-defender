// ============================================================
// EnemyCodexUI — 敌人图鉴窗口
//
// 关卡内打开，显示当前关卡所有敌方单位信息。
// 卡牌式列表，与卡牌图鉴类似的 UI 模式，但卡牌不可拖拽、
// 仅用于展示。普通 / 精英 / Boss 用卡牌颜色区分。
// ============================================================

import { LayoutManager } from './LayoutManager.js';
import { FONTS, getFont } from '../config/fonts.js';
import type { Renderer } from '../render/Renderer.js';

// ============================================================
// 常量
// ============================================================

const CARD_W = 140;
const CARD_H = 200;
const CARD_GAP = 16;
const ART_W = 100;
const ART_H = 84;
const COLS = 7;
const PANEL_W = 1400;
const PANEL_H = 850;
const HEADER_H = 60;
const PADDING = 20;
const SCROLLBAR_W = 8;
const SCROLL_SPEED = 40;

// ============================================================
// 敌人分类颜色
// ============================================================

const ENEMY_TYPE_COLORS: Record<string, string> = {
  normal: '#90a4ae',  // 银灰
  elite:  '#ffd700',  // 金色
  boss:   '#ef5350',  // 红色
};

const ENEMY_TYPE_LABELS: Record<string, string> = {
  normal: '普通',
  elite:  '精英',
  boss:   'BOSS',
};

// ============================================================
// 敌人数据条目
// ============================================================

export interface EnemyCodexEntry {
  id: string;
  name: string;
  description: string;
  type: 'normal' | 'elite' | 'boss';
  color: string;
  hp: number;
  atk: number;
  speed: number;
  defense: number;
  magicResist: number;
  radius: number;
  shape?: string;
  isBoss?: boolean;
  /** v5.0 掉落金币范围 */
  goldMin: number;
  goldMax: number;
}

// ============================================================
// 圆角矩形 polyfill
// ============================================================

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }
  ctx.fill();
}

function fillAndStrokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  if (typeof (ctx as any).roundRect === 'function') {
    (ctx as any).roundRect(x, y, w, h, r);
  } else {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

// ============================================================
// 敌人矢量图标绘制
// ============================================================

export function drawEnemyIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  _id: string, color: string,
): void {
  const s = Math.min(w, h) * 0.4;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  // 主体 — 带棱角的盾形 / 菱形
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.85, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.85, cy + s * 0.25);
  ctx.quadraticCurveTo(cx + s * 0.7, cy + s * 0.9, cx, cy + s * 0.85);
  ctx.quadraticCurveTo(cx - s * 0.7, cy + s * 0.9, cx - s * 0.85, cy + s * 0.25);
  ctx.lineTo(cx - s * 0.85, cy - s * 0.4);
  ctx.closePath();
  ctx.fill();

  // 头部小三角（角饰）
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.22, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.22, cy - s * 0.3);
  ctx.lineTo(cx, cy - s * 0.55);
  ctx.closePath();
  ctx.fill();

  // 双眼
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - s * 0.18, cy - s * 0.05, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.18, cy - s * 0.05, s * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // 瞳孔
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.arc(cx - s * 0.18, cy - s * 0.05, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.18, cy - s * 0.05, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================
// EnemyCodexUI
// ============================================================

export class EnemyCodexUI {
  private _isOpen = false;
  private entries: EnemyCodexEntry[] = [];
  private hoveredCardIndex = -1;
  private scrollOffset = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartOffset = 0;

  onOpen?: () => void;
  onClose?: () => void;

  constructor(private renderer: Renderer) {}

  get isOpen(): boolean { return this._isOpen; }

  /** 设置图鉴内容 — 由外部在进入关卡时调用 */
  setEntries(entries: EnemyCodexEntry[]): void {
    this.entries = entries;
  }

  open(): void {
    this._isOpen = true;
    this.hoveredCardIndex = -1;
    this.scrollOffset = 0;
    this.onOpen?.();
  }

  close(): void {
    this._isOpen = false;
    this.onClose?.();
  }

  // ============================================================
  // 渲染
  // ============================================================

  render(): void {
    if (!this._isOpen) return;
    try { this.renderImpl(); } catch (err) {
      console.error('[EnemyCodexUI]', err);
    }
  }

  private renderImpl(): void {
    const ctx = this.renderer.context;
    if (!ctx) return;

    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;

    // 半透明黑色遮罩
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    ctx.restore();

    const panelLeft = cx - PANEL_W / 2;
    const panelTop = cy - PANEL_H / 2;

    // 窗口背景
    ctx.save();
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#5a5a8a';
    ctx.lineWidth = 2;
    fillAndStrokeRoundedRect(ctx, panelLeft, panelTop, PANEL_W, PANEL_H, 14);
    ctx.restore();

    // 标题
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFont(26, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('敌人图鉴', cx, panelTop + HEADER_H / 2);
    ctx.restore();

    // 关闭按钮
    const closeX = panelLeft + PANEL_W - 48;
    const closeY = panelTop + 16;
    ctx.save();
    ctx.fillStyle = '#c62828';
    fillRoundedRect(ctx, closeX, closeY, 34, 34, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = getFont(20, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', closeX + 17, closeY + 17);
    ctx.restore();

    // 图例
    this.renderLegend(ctx, cx, panelTop + HEADER_H);

    // 卡牌网格区域
    const gridTop = panelTop + HEADER_H + 36;
    const gridLeft = panelLeft + PADDING;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const gridH = PANEL_H - HEADER_H - 36 - PADDING;

    ctx.save();
    ctx.beginPath();
    ctx.rect(gridLeft, gridTop, gridW, gridH);
    ctx.clip();
    this.renderCardGrid(ctx, gridLeft, gridTop, gridW, gridH);
    ctx.restore();

    // 滚动条
    this.renderScrollbar(ctx, gridLeft + gridW + 4, gridTop, gridH);

    // 计数
    ctx.save();
    ctx.fillStyle = '#8888aa';
    ctx.font = FONTS.body;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${this.entries.length} 种敌人`, panelLeft + PANEL_W - 20, panelTop + PANEL_H - 14);
    ctx.restore();
  }

  // ============================================================
  // 图例
  // ============================================================

  private renderLegend(ctx: CanvasRenderingContext2D, cx: number, legendY: number): void {
    const items = [
      { type: 'normal', label: '普通' },
      { type: 'elite', label: '精英' },
      { type: 'boss', label: 'BOSS' },
    ];
    const itemW = 100;
    const gap = 24;
    const totalW = items.length * itemW + (items.length - 1) * gap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const ix = startX + i * (itemW + gap);
      const color = ENEMY_TYPE_COLORS[it.type]!;

      // 颜色块
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(ix, legendY + 8, 12, 12);
      ctx.restore();

      // 文字
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = getFont(12, false);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.label, ix + 18, legendY + 14);
      ctx.restore();
    }
  }

  // ============================================================
  // 卡片网格
  // ============================================================

  private renderCardGrid(
    ctx: CanvasRenderingContext2D,
    gridLeft: number, gridTop: number, gridW: number, gridH: number,
  ): void {
    const cards = this.entries;
    if (cards.length === 0) {
      ctx.save();
      ctx.fillStyle = '#666688';
      ctx.font = getFont(16, false);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无敌方单位信息', gridLeft + gridW / 2, gridTop + gridH / 2);
      ctx.restore();
      return;
    }

    const actualCols = Math.max(1, Math.floor((gridW + CARD_GAP) / (CARD_W + CARD_GAP)));
    const totalRowW = actualCols * CARD_W + (actualCols - 1) * CARD_GAP;
    const offsetX = (gridW - totalRowW) / 2;
    const rowH = CARD_H + CARD_GAP;
    const rows = Math.ceil(cards.length / actualCols);
    const contentH = rows * rowH + 12;

    this.scrollOffset = this.clampScroll(this.scrollOffset);
    const startY = gridTop + 12 - this.scrollOffset;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      const col = i % actualCols;
      const row = Math.floor(i / actualCols);
      const cardLeft = gridLeft + offsetX + col * (CARD_W + CARD_GAP);
      const cardTop = startY + row * rowH;

      if (cardTop + CARD_H < gridTop || cardTop > gridTop + gridH) continue;

      const borderColor = ENEMY_TYPE_COLORS[card.type] ?? '#ffffff';
      const isHovered = i === this.hoveredCardIndex;
      const cardCenterX = cardLeft + CARD_W / 2;

      // 背景
      ctx.save();
      ctx.fillStyle = '#1a2332';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.globalAlpha = 0.95;
      fillAndStrokeRoundedRect(ctx, cardLeft, cardTop, CARD_W, CARD_H, 8);
      ctx.restore();

      if (isHovered) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        fillRoundedRect(ctx, cardLeft, cardTop, CARD_W, CARD_H, 8);
        ctx.restore();
      }

      // 美术区
      const artCY = cardTop + 14 + ART_H / 2;
      ctx.save();
      ctx.fillStyle = '#0d1b2a';
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 1;
      fillAndStrokeRoundedRect(ctx, cardCenterX - ART_W / 2, artCY - ART_H / 2, ART_W, ART_H, 4);
      ctx.restore();

      // 图标
      ctx.save();
      drawEnemyIcon(ctx, cardCenterX, artCY, ART_W, ART_H, card.id, card.color);
      ctx.restore();

      // 名称
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = getFont(13, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.name, cardCenterX, cardTop + 14 + ART_H + 14);
      ctx.restore();

      // 类型标签
      const label = ENEMY_TYPE_LABELS[card.type] ?? '';
      ctx.save();
      ctx.fillStyle = borderColor;
      ctx.font = getFont(11, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, cardCenterX, cardTop + 14 + ART_H + 34);
      ctx.restore();

      // 属性摘要
      ctx.save();
      ctx.fillStyle = '#90a4ae';
      ctx.font = getFont(9, false);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `HP:${card.hp} ATK:${card.atk} 速度:${card.speed}`,
        cardCenterX, cardTop + 14 + ART_H + 50,
      );
      ctx.restore();

      // v5.0: 掉落金币范围
      ctx.save();
      const goldColor = card.type === 'boss' ? '#ef5350' : card.type === 'elite' ? '#ffd700' : '#ffc107';
      ctx.fillStyle = goldColor;
      ctx.font = getFont(9, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `💰 ${card.goldMin}-${card.goldMax}`,
        cardCenterX, cardTop + 14 + ART_H + 63,
      );
      ctx.restore();

      // 描述
      ctx.save();
      ctx.fillStyle = '#78909c';
      ctx.font = getFont(9, false);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const descLines = this.wrapText(ctx, card.description, CARD_W - 16, 9);
      for (let li = 0; li < descLines.length && li < 2; li++) {
        ctx.fillText(
          descLines[li]!,
          cardCenterX, cardTop + 14 + ART_H + 66 + li * 12,
        );
      }
      ctx.restore();
    }
  }

  // ============================================================
  // 滚动条
  // ============================================================

  private renderScrollbar(ctx: CanvasRenderingContext2D, sbX: number, gridTop: number, gridH: number): void {
    const needed = this.scrollNeeded();
    if (needed <= 0) return;

    ctx.save();
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(sbX, gridTop, SCROLLBAR_W, gridH);

    const thumbH = Math.max(30, gridH * gridH / (gridH + needed));
    const thumbY = gridTop + (gridH - thumbH) * this.scrollOffset / needed;

    ctx.fillStyle = '#5a5a8a';
    ctx.beginPath();
    const r = SCROLLBAR_W / 2;
    ctx.moveTo(sbX + r, thumbY);
    ctx.lineTo(sbX + SCROLLBAR_W - r, thumbY);
    ctx.arcTo(sbX + SCROLLBAR_W, thumbY, sbX + SCROLLBAR_W, thumbY + r, r);
    ctx.lineTo(sbX + SCROLLBAR_W, thumbY + thumbH - r);
    ctx.arcTo(sbX + SCROLLBAR_W, thumbY + thumbH, sbX + SCROLLBAR_W - r, thumbY + thumbH, r);
    ctx.lineTo(sbX + r, thumbY + thumbH);
    ctx.arcTo(sbX, thumbY + thumbH, sbX, thumbY + thumbH - r, r);
    ctx.lineTo(sbX, thumbY + r);
    ctx.arcTo(sbX, thumbY, sbX + r, thumbY, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ============================================================
  // 输入
  // ============================================================

  handleClick(x: number, y: number): boolean {
    if (!this._isOpen) return false;

    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = cy - PANEL_H / 2;

    // 关闭按钮
    if (x >= panelLeft + PANEL_W - 48 && x <= panelLeft + PANEL_W - 14 && y >= panelTop + 16 && y <= panelTop + 50) {
      this.close();
      return true;
    }

    // 卡牌区域：开始拖拽滚动
    const gridTop = panelTop + HEADER_H + 36;
    const gridLeft = panelLeft + PADDING;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const gridH = PANEL_H - HEADER_H - 36 - PADDING;

    if (x >= gridLeft && x <= gridLeft + gridW && y >= gridTop && y <= gridTop + gridH) {
      this.isDragging = true;
      this.dragStartY = y;
      this.dragStartOffset = this.scrollOffset;
      return true;
    }

    // 窗口外 → 关闭
    if (x < panelLeft || x > panelLeft + PANEL_W || y < panelTop || y > panelTop + PANEL_H) {
      this.close();
      return true;
    }

    return true;
  }

  handleMouseMove(x: number, y: number): void {
    if (!this._isOpen) return;

    if (this.isDragging) {
      this.scrollOffset = this.clampScroll(this.dragStartOffset + (this.dragStartY - y));
      this.hoveredCardIndex = -1;
      return;
    }

    this.updateHover(x, y);
  }

  handleMouseUp(_x: number, _y: number): void { this.isDragging = false; }

  handleWheel(deltaY: number): boolean {
    if (!this._isOpen) return false;
    if (this.scrollNeeded() <= 0) return true;
    this.scrollOffset = this.clampScroll(
      this.scrollOffset + (deltaY > 0 ? SCROLL_SPEED : -SCROLL_SPEED) * Math.max(1, Math.abs(deltaY) / 100),
    );
    return true;
  }

  // ============================================================
  // 滚动 / 悬停
  // ============================================================

  private computeContentHeight(): number {
    const cards = this.entries;
    if (!cards || cards.length === 0) return 0;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const actualCols = Math.max(1, Math.floor((gridW + CARD_GAP) / (CARD_W + CARD_GAP)));
    return Math.ceil(cards.length / actualCols) * (CARD_H + CARD_GAP) + 12;
  }

  private visibleHeight(): number { return PANEL_H - HEADER_H - 36 - PADDING; }
  private scrollNeeded(): number { return Math.max(0, this.computeContentHeight() - this.visibleHeight()); }
  private clampScroll(v: number): number { return Math.max(0, Math.min(v, this.scrollNeeded())); }

  private updateHover(x: number, y: number): void {
    const cx = LayoutManager.DESIGN_W / 2;
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = (LayoutManager.DESIGN_H - PANEL_H) / 2;
    const gridTop = panelTop + HEADER_H + 36;
    const gridLeft = panelLeft + PADDING;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const gridH = PANEL_H - HEADER_H - 36 - PADDING;

    if (x < gridLeft || x > gridLeft + gridW || y < gridTop || y > gridTop + gridH) {
      this.hoveredCardIndex = -1; return;
    }

    const actualCols = Math.max(1, Math.floor((gridW + CARD_GAP) / (CARD_W + CARD_GAP)));
    const totalRowW = actualCols * CARD_W + (actualCols - 1) * CARD_GAP;
    const offsetX = (gridW - totalRowW) / 2;
    const rowH = CARD_H + CARD_GAP;
    const startY = gridTop + 12 - this.scrollOffset;
    const cards = this.entries;

    for (let i = 0; i < cards.length; i++) {
      const col = i % actualCols; const row = Math.floor(i / actualCols);
      const cl = gridLeft + offsetX + col * (CARD_W + CARD_GAP);
      const ct = startY + row * rowH;
      if (x >= cl && x <= cl + CARD_W && y >= ct && y <= ct + CARD_H) {
        this.hoveredCardIndex = i; return;
      }
    }
    this.hoveredCardIndex = -1;
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, fs: number): string[] {
    if (!text || maxW <= 0) return [text || ''];
    ctx.save(); ctx.font = getFont(fs, false);
    const lines: string[] = []; let cur = ''; let curW = 0;
    for (const ch of text) {
      const cw = ctx.measureText(ch).width || fs * 0.6;
      if (curW + cw > maxW && cur.length > 0) { lines.push(cur); cur = ch; curW = cw; }
      else { cur += ch; curW += cw; }
    }
    if (cur.length > 0) lines.push(cur);
    ctx.restore();
    return lines.length > 0 ? lines : [text];
  }
}
