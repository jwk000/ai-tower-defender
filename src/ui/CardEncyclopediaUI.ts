// ============================================================
// CardEncyclopediaUI — 卡牌图鉴全屏遮照面板
//
// 在主菜单和关卡内均可打开，显示所有 27 张卡牌的网格视图，
// 支持按类型筛选。打开时游戏暂停，关闭后恢复。
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
const COLS = 5;
const PANEL_W = 950;
const PANEL_H = 680;
const TAB_H = 40;
const HEADER_H = 60;

// ============================================================
// 类型定义
// ============================================================

/** 卡牌展示分类（用于筛选） */
export type CardFilterCategory = 'all' | 'tower' | 'soldier' | 'trap' | 'spell' | 'arcane';

interface FilterTab {
  key: CardFilterCategory;
  label: string;
  color: string;
}

// ============================================================
// 分类与颜色
// ============================================================

const FILTER_TABS: FilterTab[] = [
  { key: 'all',     label: '全部', color: '#ffffff' },
  { key: 'tower',   label: '塔',   color: '#42a5f5' },
  { key: 'soldier', label: '士兵', color: '#66bb6a' },
  { key: 'trap',    label: '机关', color: '#ef5350' },
  { key: 'spell',   label: '技能', color: '#ab47bc' },
  { key: 'arcane',  label: '奥术', color: '#ffa726' },
];

const CATEGORY_COLORS: Record<Exclude<CardFilterCategory, 'all'>, string> = {
  tower:   '#42a5f5',
  soldier: '#66bb6a',
  trap:    '#ef5350',
  spell:   '#ab47bc',
  arcane:  '#ffa726',
};

const CATEGORY_GLYPHS: Record<Exclude<CardFilterCategory, 'all'>, string> = {
  tower:   '🗼',
  soldier: '⚔',
  trap:    '⛓',
  spell:   '✦',
  arcane:  '◇',
};

// ============================================================
// 分类判断
// ============================================================

/** 根据 CardInstance 判断展示分类 */
function getCardCategory(card: CardInstance): Exclude<CardFilterCategory, 'all'> {
  if (card.type === 'spell') return 'spell';
  if (card.type === 'arcane') return 'arcane';
  if (card.type === 'trap') return 'trap';
  // unit 类型：按 id 区分塔和士兵
  if (card.id.includes('_tower')) return 'tower';
  return 'soldier';
}

// ============================================================
// CardEncyclopediaUI
// ============================================================

export class CardEncyclopediaUI {
  private _isOpen: boolean = false;
  private activeFilter: CardFilterCategory = 'all';
  private filteredCards: CardInstance[] = [];
  private hoveredCardIndex: number = -1;

  /** 打开/关闭状态变化回调（供外部暂停/恢复游戏） */
  onOpen?: () => void;
  onClose?: () => void;

  constructor(private renderer: Renderer) {
    this.applyFilter('all');
  }

  // ---- 公共 API ----

  get isOpen(): boolean { return this._isOpen; }

  open(): void {
    this._isOpen = true;
    this.hoveredCardIndex = -1;
    this.onOpen?.();
  }

  close(): void {
    this._isOpen = false;
    this.hoveredCardIndex = -1;
    this.onClose?.();
  }

  toggle(): void {
    if (this._isOpen) this.close();
    else this.open();
  }

  // ---- 渲染 ----

  /** 每帧调用，绘制完整图鉴面板 */
  render(): void {
    if (!this._isOpen) return;
    const ctx = this.renderer.context;

    // 设计空间中心
    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;

    // ---- 全视口变暗遮罩 ----
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    ctx.restore();

    // ---- 面板背景 ----
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = cy - PANEL_H / 2;
    ctx.save();
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#4a4a7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelLeft, panelTop, PANEL_W, PANEL_H, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ---- 标题 ----
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFont(28, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📖 卡牌图鉴', cx, panelTop + HEADER_H / 2);
    ctx.restore();

    // ---- 关闭按钮 (X) ----
    const closeX = panelLeft + PANEL_W - 40;
    const closeY = panelTop + 12;
    const closeW = 30;
    const closeH = 30;
    ctx.save();
    ctx.fillStyle = '#c62828';
    ctx.beginPath();
    ctx.roundRect(closeX, closeY, closeW, closeH, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = getFont(18, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', closeX + closeW / 2, closeY + closeH / 2);
    ctx.restore();

    // ---- 类型筛选标签 ----
    this.renderFilterTabs(ctx, cx, panelTop + HEADER_H);

    // ---- 卡牌网格 ----
    this.renderCardGrid(ctx, panelLeft, panelTop + HEADER_H + TAB_H);

    // ---- 卡牌总数 ----
    ctx.save();
    ctx.fillStyle = '#8888aa';
    ctx.font = FONTS.body;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      `${this.filteredCards.length} / ${ALL_CARDS.length} 张`,
      panelLeft + PANEL_W - 16,
      panelTop + PANEL_H - 12,
    );
    ctx.restore();
  }

  // ---- 输入 ----

  /** 处理点击，返回 true 表示事件已被消费 */
  handleClick(x: number, y: number): boolean {
    if (!this._isOpen) return false;

    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = cy - PANEL_H / 2;

    // 1. 关闭按钮
    const closeX = panelLeft + PANEL_W - 40;
    const closeY = panelTop + 12;
    if (x >= closeX && x <= closeX + 30 && y >= closeY && y <= closeY + 30) {
      this.close();
      return true;
    }

    // 2. 筛选标签
    const tabY = panelTop + HEADER_H;
    const tabCount = FILTER_TABS.length;
    const tabW = 108;
    const tabGap = 8;
    const totalTabW = tabCount * tabW + (tabCount - 1) * tabGap;
    const tabStartX = cx - totalTabW / 2;
    for (let i = 0; i < FILTER_TABS.length; i++) {
      const tx = tabStartX + i * (tabW + tabGap);
      if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + TAB_H) {
        const tab = FILTER_TABS[i]!;
        if (tab.key !== this.activeFilter) {
          this.applyFilter(tab.key);
        }
        return true;
      }
    }

    // 3. 卡牌点击（暂不处理详情，仅消费点击防止穿透）
    const gridTop = panelTop + HEADER_H + TAB_H + 12;
    const gridLeft = panelLeft + 16;
    for (let i = 0; i < this.filteredCards.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cardLeft = gridLeft + col * (CARD_W + CARD_GAP);
      const cardTop = gridTop + row * (CARD_H + CARD_GAP);
      if (x >= cardLeft && x <= cardLeft + CARD_W && y >= cardTop && y <= cardTop + CARD_H) {
        // 消费点击，暂不显示详情
        return true;
      }
    }

    // 4. 面板外点击 → 关闭
    if (x < panelLeft || x > panelLeft + PANEL_W || y < panelTop || y > panelTop + PANEL_H) {
      this.close();
      return true;
    }

    // 面板内其他区域也消费点击
    return true;
  }

  /** 更新鼠标悬停位置 */
  handleMouseMove(x: number, y: number): void {
    if (!this._isOpen) {
      this.hoveredCardIndex = -1;
      return;
    }

    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;
    const panelLeft = cx - PANEL_W / 2;
    const panelTop = cy - PANEL_H / 2;
    const gridTop = panelTop + HEADER_H + TAB_H + 12;
    const gridLeft = panelLeft + 16;

    this.hoveredCardIndex = -1;
    for (let i = 0; i < this.filteredCards.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cardLeft = gridLeft + col * (CARD_W + CARD_GAP);
      const cardTop = gridTop + row * (CARD_H + CARD_GAP);
      if (x >= cardLeft && x <= cardLeft + CARD_W && y >= cardTop && y <= cardTop + CARD_H) {
        this.hoveredCardIndex = i;
        return;
      }
    }
  }

  // ============================================================
  // 私有渲染方法
  // ============================================================

  private renderFilterTabs(ctx: CanvasRenderingContext2D, cx: number, tabY: number): void {
    const tabCount = FILTER_TABS.length;
    const tabW = 108;
    const tabGap = 8;
    const totalW = tabCount * tabW + (tabCount - 1) * tabGap;
    const startX = cx - totalW / 2;

    for (let i = 0; i < FILTER_TABS.length; i++) {
      const tab = FILTER_TABS[i]!;
      const tx = startX + i * (tabW + tabGap);
      const isActive = tab.key === this.activeFilter;

      ctx.save();
      // 标签背景
      ctx.fillStyle = isActive ? tab.color : '#2a2a4a';
      ctx.strokeStyle = isActive ? tab.color : '#444466';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, tabY + 4, tabW, TAB_H - 8, 6);
      ctx.fill();
      ctx.stroke();

      // 标签文字
      ctx.fillStyle = isActive ? '#ffffff' : '#8888aa';
      ctx.font = getFont(14, isActive);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tab.label, tx + tabW / 2, tabY + TAB_H / 2);
      ctx.restore();
    }
  }

  private renderCardGrid(
    ctx: CanvasRenderingContext2D,
    panelLeft: number,
    gridTop: number,
  ): void {
    const gridLeft = panelLeft + 16;

    for (let i = 0; i < this.filteredCards.length; i++) {
      const card = this.filteredCards[i]!;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cardLeft = gridLeft + col * (CARD_W + CARD_GAP);
      const cardTop = gridTop + 12 + row * (CARD_H + CARD_GAP);
      const cardCenterX = cardLeft + CARD_W / 2;
      const isHovered = i === this.hoveredCardIndex;

      const category = getCardCategory(card);
      const borderColor = CATEGORY_COLORS[category];

      // ---- 卡牌背景 ----
      ctx.save();
      ctx.fillStyle = '#1a2332';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.roundRect(cardLeft, cardTop, CARD_W, CARD_H, 8);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 悬停高亮
      if (isHovered) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.roundRect(cardLeft, cardTop, CARD_W, CARD_H, 8);
        ctx.fill();
        ctx.restore();
      }

      // ---- 美术区域 ----
      const artCenterY = cardTop + 14 + ART_H / 2;
      ctx.save();
      ctx.fillStyle = '#0d1b2a';
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cardCenterX - ART_W / 2, artCenterY - ART_H / 2, ART_W, ART_H, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // ---- 符号图标 ----
      ctx.save();
      ctx.fillStyle = borderColor;
      ctx.font = getFont(36, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(CATEGORY_GLYPHS[category], cardCenterX, artCenterY);
      ctx.restore();

      // ---- 卡牌名称 ----
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = getFont(12, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.name, cardCenterX, cardTop + 14 + ART_H + 14);
      ctx.restore();

      // ---- 类型标签 ----
      const typeLabels: Record<string, string> = {
        tower: '塔', soldier: '士兵', trap: '机关', spell: '技能', arcane: '奥术',
      };
      ctx.save();
      ctx.fillStyle = borderColor;
      ctx.font = getFont(10, false);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        typeLabels[category] ?? category,
        cardCenterX,
        cardTop + 14 + ART_H + 32,
      );
      ctx.restore();

      // ---- 描述（自动换行） ----
      ctx.save();
      ctx.fillStyle = '#90a4ae';
      ctx.font = getFont(9, false);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const descLines = this.wrapText(ctx, card.description, CARD_W - 16, 9);
      const descStartY = cardTop + 14 + ART_H + 48;
      for (let li = 0; li < descLines.length && li < 3; li++) {
        ctx.fillText(descLines[li]!, cardCenterX, descStartY + li * 12);
      }
      ctx.restore();
    }
  }

  // ---- 工具函数 ----

  /** 简单文本换行 */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontSize: number,
  ): string[] {
    const lines: string[] = [];
    let current = '';
    let currentW = 0;

    for (const ch of text) {
      ctx.font = getFont(fontSize, false);
      const metrics = ctx.measureText(ch);
      const charW = metrics.width;
      if (currentW + charW > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
        currentW = charW;
      } else {
        current += ch;
        currentW += charW;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.length > 0 ? lines : [text];
  }

  // ============================================================
  // 筛选
  // ============================================================

  private applyFilter(filter: CardFilterCategory): void {
    this.activeFilter = filter;
    if (filter === 'all') {
      this.filteredCards = [...ALL_CARDS];
    } else {
      this.filteredCards = ALL_CARDS.filter((c) => getCardCategory(c) === filter);
    }
  }
}
