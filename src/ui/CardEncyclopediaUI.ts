// ============================================================
// CardEncyclopediaUI — 卡牌图鉴窗口
//
// 在主菜单和关卡内均可打开。大窗口（1400×850）+ 黑色半透背景，
// 自适应列布局（7列），支持鼠标滚轮和拖拽滚动，内容裁剪到窗口内。
// ============================================================

import { LayoutManager } from './LayoutManager.js';
import { FONTS, getFont } from '../config/fonts.js';
import type { CardInstance } from '../systems/HandSystem.js';
import { ALL_CARDS } from '../data/cards.js';
import type { Renderer } from '../render/Renderer.js';

// ============================================================
// 常量
// ============================================================

const CARD_W = 120;
const CARD_H = 168;
const CARD_GAP = 16;
const ART_W = 96;
const ART_H = 80;
const COLS = 7;
const PANEL_W = 1400;
const PANEL_H = 850;
const TAB_H = 40;
const HEADER_H = 60;
const PADDING = 20;
const SCROLLBAR_W = 8;
const SCROLL_SPEED = 40;

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
// 类型与常量
// ============================================================

export type CardFilterCategory = 'all' | 'tower' | 'soldier' | 'trap' | 'spell' | 'arcane';

interface FilterTab { key: CardFilterCategory; label: string; color: string; }

const FILTER_TABS: FilterTab[] = [
  { key: 'all',     label: '全部', color: '#ffffff' },
  { key: 'tower',   label: '塔',   color: '#42a5f5' },
  { key: 'soldier', label: '士兵', color: '#66bb6a' },
  { key: 'trap',    label: '机关', color: '#ef5350' },
  { key: 'spell',   label: '技能', color: '#ab47bc' },
  { key: 'arcane',  label: '奥术', color: '#ffa726' },
];

const CATEGORY_COLORS: Record<string, string> = {
  tower: '#42a5f5', soldier: '#66bb6a', trap: '#ef5350', spell: '#ab47bc', arcane: '#ffa726',
};

/** 在美术区绘制分类矢量图标（96×80 区域中心） */
function drawCategoryIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  category: string, color: string,
): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0d1b2a';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';

  switch (category) {
    case 'tower':   drawTowerIcon(ctx, cx, cy, w, h); break;
    case 'soldier': drawSoldierIcon(ctx, cx, cy, w, h); break;
    case 'trap':    drawTrapIcon(ctx, cx, cy, w, h); break;
    case 'spell':   drawSpellIcon(ctx, cx, cy, w, h); break;
    case 'arcane':  drawArcaneIcon(ctx, cx, cy, w, h); break;
  }
}

/** 塔 — 堡垒剪影：主体 + 城垛 + 门洞 */
function drawTowerIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, _h: number): void {
  const tw = w * 0.52;        // 塔宽
  const th = _h * 0.78;       // 塔高
  const left = cx - tw / 2;
  const top = cy - th / 2;
  const btm = cy + th / 2;

  // 塔身
  ctx.beginPath();
  ctx.moveTo(left + 4, btm);
  ctx.lineTo(left + 4, top + 10);
  ctx.lineTo(left, top + 10);
  ctx.lineTo(left, top);
  ctx.lineTo(cx - 6, top);
  ctx.lineTo(cx - 6, top + 6);
  ctx.lineTo(cx + 6, top + 6);
  ctx.lineTo(cx + 6, top);
  ctx.lineTo(cx + tw / 2, top);
  ctx.lineTo(cx + tw / 2, top + 10);
  ctx.lineTo(cx + tw / 2 - 4, top + 10);
  ctx.lineTo(cx + tw / 2 - 4, btm);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 门洞
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  const dw = 12, dh = 18;
  ctx.moveTo(cx, btm);
  ctx.arc(cx - dw / 2, btm - dh + dw / 2, dw / 2, Math.PI / 2, Math.PI * 1.5, true);
  ctx.arc(cx + dw / 2, btm - dh + dw / 2, dw / 2, Math.PI * 1.5, Math.PI / 2, true);
  ctx.closePath();
  ctx.fill();
}

/** 士兵 — 盾牌 + 十字 */
function drawSoldierIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, _h: number): void {
  const sw = w * 0.48;
  const sh = _h * 0.72;
  const left = cx - sw / 2;
  const top = cy - sh / 2;
  const right = cx + sw / 2;
  const btm = cy + sh / 2;

  // 盾形
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(right - 2, top + sh * 0.35);
  ctx.lineTo(right - 2, cy + sh * 0.15);
  ctx.quadraticCurveTo(right - 2, btm - 4, cx, btm);
  ctx.quadraticCurveTo(left + 2, btm - 4, left + 2, cy + sh * 0.15);
  ctx.lineTo(left + 2, top + sh * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 十字纹
  ctx.beginPath();
  ctx.moveTo(cx, top + 8);
  ctx.lineTo(cx, btm - 10);
  ctx.moveTo(left + 8, cy - 2);
  ctx.lineTo(right - 8, cy - 2);
  ctx.stroke();
}

/** 机关 — 8 齿齿轮 */
function drawTrapIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, _h: number): void {
  const size = Math.min(w, _h) * 0.44;
  const outerR = size;
  const innerR = size * 0.55;
  const teeth = 8;

  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i * Math.PI) / teeth - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 中心孔
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

/** 技能 — 五芒星 */
function drawSpellIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, _h: number): void {
  const outerR = Math.min(w, _h) * 0.45;
  const innerR = outerR * 0.4;
  const points = 5;

  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // 星形光辉（外层半透明描边）
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR * 1.18 : innerR * 1.18;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** 奥术 — 菱形 + 内嵌圆 */
function drawArcaneIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, _h: number): void {
  const size = Math.min(w, _h) * 0.44;

  // 外菱形
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 内圆
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // 内菱形
  ctx.fillStyle = ctx.strokeStyle;
  const innerS = size * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx, cy - innerS);
  ctx.lineTo(cx + innerS, cy);
  ctx.lineTo(cx, cy + innerS);
  ctx.lineTo(cx - innerS, cy);
  ctx.closePath();
  ctx.fill();
}

function getCardCategory(card: CardInstance): Exclude<CardFilterCategory, 'all'> {
  if (card.type === 'spell') return 'spell';
  if (card.type === 'arcane') return 'arcane';
  if (card.type === 'trap') return 'trap';
  if (card.id.includes('_tower')) return 'tower';
  return 'soldier';
}

// ============================================================
// CardEncyclopediaUI
// ============================================================

export class CardEncyclopediaUI {
  private _isOpen = false;
  private activeFilter: CardFilterCategory = 'all';
  private filteredCards: CardInstance[] = [];
  private hoveredCardIndex = -1;
  private scrollOffset = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartOffset = 0;

  onOpen?: () => void;
  onClose?: () => void;

  constructor(private renderer: Renderer) {
    this.applyFilter('all');
  }

  get isOpen(): boolean { return this._isOpen; }

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
      console.error('[CardEncyclopediaUI]', err);
    }
  }

  private renderImpl(): void {
    const ctx = this.renderer.context;
    if (!ctx) return;

    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;

    // 半透明黑色遮罩（全视口）
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
    ctx.font = FONTS.title;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('卡牌图鉴', cx, panelTop + HEADER_H / 2);
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

    // 筛选标签
    this.renderFilterTabs(ctx, cx, panelTop + HEADER_H);

    // 卡牌网格区域（带裁剪）
    const gridTop = panelTop + HEADER_H + TAB_H;
    const gridLeft = panelLeft + PADDING;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const gridH = PANEL_H - HEADER_H - TAB_H - PADDING;

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
    const allCount = Array.isArray(ALL_CARDS) ? ALL_CARDS.length : 0;
    ctx.fillText(`${this.filteredCards.length} / ${allCount} 张`, panelLeft + PANEL_W - 20, panelTop + PANEL_H - 14);
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

    // 筛选标签
    const tabY = panelTop + HEADER_H;
    const tabW = 108; const tabGap = 8;
    const totalW = FILTER_TABS.length * tabW + (FILTER_TABS.length - 1) * tabGap;
    const tabStartX = cx - totalW / 2;
    for (let i = 0; i < FILTER_TABS.length; i++) {
      const tx = tabStartX + i * (tabW + tabGap);
      if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + TAB_H) {
        const key = FILTER_TABS[i]!.key;
        if (key !== this.activeFilter) { this.applyFilter(key); this.scrollOffset = 0; }
        return true;
      }
    }

    // 卡牌区域：开始拖拽滚动
    const gridTop = panelTop + HEADER_H + TAB_H;
    const gridLeft = panelLeft + PADDING;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const gridH = PANEL_H - HEADER_H - TAB_H - PADDING;

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
  // 子渲染
  // ============================================================

  private renderFilterTabs(ctx: CanvasRenderingContext2D, cx: number, tabY: number): void {
    const tabW = 108; const tabGap = 8;
    const totalW = FILTER_TABS.length * tabW + (FILTER_TABS.length - 1) * tabGap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < FILTER_TABS.length; i++) {
      const t = FILTER_TABS[i]!;
      const tx = startX + i * (tabW + tabGap);
      const active = t.key === this.activeFilter;

      ctx.save();
      ctx.fillStyle = active ? t.color : '#2a2a4a';
      ctx.strokeStyle = active ? t.color : '#444466';
      ctx.lineWidth = 1;
      fillAndStrokeRoundedRect(ctx, tx, tabY + 4, tabW, TAB_H - 8, 6);
      ctx.fillStyle = active ? '#ffffff' : '#8888aa';
      ctx.font = getFont(14, active);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx + tabW / 2, tabY + TAB_H / 2);
      ctx.restore();
    }
  }

  private renderCardGrid(
    ctx: CanvasRenderingContext2D,
    gridLeft: number, gridTop: number, gridW: number, gridH: number,
  ): void {
    const cards = this.filteredCards;
    if (!cards || cards.length === 0) return;

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

      const borderColor = CATEGORY_COLORS[getCardCategory(card)] ?? '#ffffff';
      const isHovered = i === this.hoveredCardIndex;
      const cardCenterX = cardLeft + CARD_W / 2;

      // 背景
      ctx.save();
      ctx.fillStyle = '#1a2332'; ctx.strokeStyle = borderColor;
      ctx.lineWidth = isHovered ? 3 : 2; ctx.globalAlpha = 0.95;
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
      ctx.fillStyle = '#0d1b2a'; ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1;
      fillAndStrokeRoundedRect(ctx, cardCenterX - ART_W / 2, artCY - ART_H / 2, ART_W, ART_H, 4);
      ctx.restore();

      // 图标
      ctx.save();
      drawCategoryIcon(ctx, cardCenterX, artCY, ART_W, ART_H, getCardCategory(card), borderColor);
      ctx.restore();

      // 名称
      ctx.save();
      ctx.fillStyle = '#ffffff'; ctx.font = getFont(12, true);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(card.name, cardCenterX, cardTop + 14 + ART_H + 14);
      ctx.restore();

      // 类型标签
      const labels: Record<string, string> = { tower: '塔', soldier: '兵', trap: '机关', spell: '技能', arcane: '奥术' };
      ctx.save();
      ctx.fillStyle = borderColor; ctx.font = getFont(10, false);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(labels[getCardCategory(card)] ?? '', cardCenterX, cardTop + 14 + ART_H + 32);
      ctx.restore();

      // 描述
      ctx.save();
      ctx.fillStyle = '#90a4ae'; ctx.font = getFont(9, false);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let li = 0; li < this.wrapText(ctx, card.description, CARD_W - 16, 9).length && li < 3; li++) {
        ctx.fillText(this.wrapText(ctx, card.description, CARD_W - 16, 9)[li]!, cardCenterX, cardTop + 14 + ART_H + 48 + li * 12);
      }
      ctx.restore();
    }
  }

  private renderScrollbar(ctx: CanvasRenderingContext2D, sbX: number, gridTop: number, gridH: number): void {
    const needed = this.scrollNeeded();
    if (needed <= 0) return;

    // 轨道
    ctx.save();
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(sbX, gridTop, SCROLLBAR_W, gridH);

    const thumbH = Math.max(30, gridH * gridH / (gridH + needed));
    const thumbY = gridTop + (gridH - thumbH) * this.scrollOffset / needed;

    ctx.fillStyle = '#5a5a8a';
    ctx.beginPath();
    const r = SCROLLBAR_W / 2;
    ctx.moveTo(sbX + r, thumbY); ctx.lineTo(sbX + SCROLLBAR_W - r, thumbY);
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
  // 滚动 / 悬停
  // ============================================================

  private computeContentHeight(): number {
    const cards = this.filteredCards;
    if (!cards || cards.length === 0) return 0;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const actualCols = Math.max(1, Math.floor((gridW + CARD_GAP) / (CARD_W + CARD_GAP)));
    return Math.ceil(cards.length / actualCols) * (CARD_H + CARD_GAP) + 12;
  }

  private visibleHeight(): number { return PANEL_H - HEADER_H - TAB_H - PADDING; }
  private scrollNeeded(): number { return Math.max(0, this.computeContentHeight() - this.visibleHeight()); }
  private clampScroll(v: number): number { return Math.max(0, Math.min(v, this.scrollNeeded())); }

  private updateHover(x: number, y: number): void {
    const cx = LayoutManager.DESIGN_W / 2;
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = (LayoutManager.DESIGN_H - PANEL_H) / 2;
    const gridTop = panelTop + HEADER_H + TAB_H;
    const gridLeft = panelLeft + PADDING;
    const gridW = PANEL_W - PADDING * 2 - SCROLLBAR_W - 6;
    const gridH = PANEL_H - HEADER_H - TAB_H - PADDING;

    if (x < gridLeft || x > gridLeft + gridW || y < gridTop || y > gridTop + gridH) {
      this.hoveredCardIndex = -1; return;
    }

    const actualCols = Math.max(1, Math.floor((gridW + CARD_GAP) / (CARD_W + CARD_GAP)));
    const totalRowW = actualCols * CARD_W + (actualCols - 1) * CARD_GAP;
    const offsetX = (gridW - totalRowW) / 2;
    const rowH = CARD_H + CARD_GAP;
    const startY = gridTop + 12 - this.scrollOffset;
    const cards = this.filteredCards;

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

  private applyFilter(filter: CardFilterCategory): void {
    this.activeFilter = filter;
    const all = Array.isArray(ALL_CARDS) ? ALL_CARDS : [];
    this.filteredCards = filter === 'all' ? [...all] : all.filter(c => getCardCategory(c) === filter);
  }
}
