// ============================================================
// Tower Defender — LayoutConstants
//
// UI 布局纯函数与常量，从 UISystem.ts 提取。
// 所有函数无副作用、无状态依赖，可跨模块安全复用。
// ============================================================

import { LayoutManager } from './LayoutManager.js';
import { TowerType, UnitType, type ShapeType } from '../types/index.js';
import type { CardConfig, CardType } from '../config/cardRegistry.js';

// ============================================================
// Energy Bar
// ============================================================

export function computeEnergyBarRatio(current: number, max: number): number {
  if (max <= 0) return 0;
  if (current <= 0) return 0;
  if (current >= max) return 1;
  return current / max;
}

// ============================================================
// 手牌槽位布局
// ============================================================

/**
 * v3.0 roguelike — 手牌槽位水平居中布局。
 * design/20 §4.5.2：单卡 120×168，卡间距 16px，最多 8 张，水平居中。
 * 返回每张卡左上角相对手牌区原点 (x, y) 坐标，y=0（区内顶部对齐，调用方再做垂直居中）。
 * 8 张溢出 800 宽时 startX 为负、视觉可越界（design 已知约束）。
 */
export function computeCardSlotsLayout(
  handCount: number,
  regionWidth: number,
  cardWidth: number,
  gap: number,
): { x: number; y: number }[] {
  if (handCount <= 0) return [];
  const step = cardWidth + gap;
  const totalWidth = handCount * cardWidth + (handCount - 1) * gap;
  const startX = (regionWidth - totalWidth) / 2;
  const slots: { x: number; y: number }[] = [];
  for (let i = 0; i < handCount; i++) {
    slots.push({ x: startX + i * step, y: 0 });
  }
  return slots;
}

// ============================================================
// 稀有度边框
// ============================================================

/** design/09 §3.2 卡牌稀有度边框色 */
export const RARITY_BORDER_COLORS = {
  common: '#ffffff',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ffc107',
} as const;

export function rarityBorderColor(rarity: string): string {
  return (RARITY_BORDER_COLORS as Record<string, string>)[rarity] ?? '#ffffff';
}

// ============================================================
// 手牌区几何
// ============================================================

/**
 * v3.0 roguelike — 手牌区几何边界（design space），renderHandZone 与命中判定共用。
 * 与 design/20 §4.5.2 一致：bottom-center offset(0,-130), size 800×180。
 */
export function getHandZoneBounds(): {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  left: number;
  top: number;
} {
  const width = 800;
  const height = 180;
  const centerX = 1920 / 2;
  const centerY = 1080 - 130;
  return {
    width,
    height,
    centerX,
    centerY,
    left: centerX - width / 2,
    top: centerY - height / 2,
  };
}

/**
 * v3.0 roguelike — 手牌槽命中判定（design space 坐标）。
 * 返回被点击的卡 slot index，未命中返 -1。
 * 与 renderHandZone 的 computeCardSlotsLayout 布局严格对齐，gap 内不命中。
 */
export function hitTestHandCard(
  px: number,
  py: number,
  handCount: number,
): number {
  if (handCount <= 0) return -1;
  const bounds = getHandZoneBounds();
  const CARD_W = 120;
  const CARD_H = 168;
  const GAP = 16;

  const cardTop = bounds.top + (bounds.height - CARD_H) / 2;
  const cardBottom = cardTop + CARD_H;
  if (py < cardTop || py >= cardBottom) return -1;

  const slots = computeCardSlotsLayout(handCount, bounds.width, CARD_W, GAP);
  for (let i = 0; i < slots.length; i++) {
    const cardLeft = bounds.left + slots[i]!.x;
    const cardRight = cardLeft + CARD_W;
    if (px >= cardLeft && px < cardRight) return i;
  }
  return -1;
}

// ============================================================
// 卡牌类型标签
// ============================================================

export function cardTypeLabel(type: CardType): string {
  switch (type) {
    case 'unit':       return '单位';
    case 'spell':      return '法术';
    case 'trap':       return '陷阱';
    case 'production': return '生产';
  }
}

export function cardTypeGlyph(type: CardType): string {
  switch (type) {
    case 'unit':       return '⚔';
    case 'spell':      return '✦';
    case 'trap':       return '✜';
    case 'production': return '⛏';
  }
}

// ============================================================
// 卡牌实体类型解析
// ============================================================

export type ResolvedCardEntity =
  | { entityType: 'tower'; towerType: TowerType }
  | { entityType: 'unit'; unitType: UnitType }
  | { entityType: 'trap'; trapTypeId: string };

/**
 * v3.0 roguelike — 把 CardConfig.unitConfigId 映射成可被 BuildSystem.startDrag 消费的实体描述。
 */
export function resolveCardToEntityType(
  unitConfigId: string | undefined,
): ResolvedCardEntity | null {
  if (!unitConfigId) return null;

  // 8种机关类型
  const TRAP_IDS = [
    'spike_trap', 'bear_trap', 'tar_pit', 'boulder',
    'fan', 'water_pit', 'boxing_glove', 'mechanical_arm',
  ];
  if (TRAP_IDS.includes(unitConfigId)) {
    return { entityType: 'trap', trapTypeId: unitConfigId };
  }

  if (unitConfigId.endsWith('_tower')) {
    const stem = unitConfigId.slice(0, -'_tower'.length);
    const towerValues = Object.values(TowerType) as string[];
    if (towerValues.includes(stem)) {
      return { entityType: 'tower', towerType: stem as TowerType };
    }
    return null;
  }

  const unitValues = Object.values(UnitType) as string[];
  if (unitValues.includes(unitConfigId)) {
    return { entityType: 'unit', unitType: unitConfigId as UnitType };
  }
  return null;
}

// ============================================================
// 悬停详情卡片（Tooltip）
// ============================================================

export const CARD_TOOLTIP_WIDTH = 240;
export const CARD_TOOLTIP_HEIGHT = 320;

/** 详情卡片单行结构 — buildCardTooltipLines 输出 + renderHandTooltip 消费 */
export interface CardTooltipLine {
  /** 'name' = 顶部标题大字 / 'meta' = 稀有度+类型副标题 / 'energy' = 能量行 / 'desc' = 描述段落 / 'persist' = ✦ 跨波标记 / 'flavor' = 斜体风味文 */
  kind: 'name' | 'meta' | 'energy' | 'desc' | 'persist' | 'flavor';
  text: string;
}

/**
 * v3.0 roguelike — 把 CardConfig 结构化为详情卡片显示行序列（纯函数）。
 */
export function buildCardTooltipLines(config: CardConfig): CardTooltipLine[] {
  const lines: CardTooltipLine[] = [];
  lines.push({ kind: 'name', text: config.name });
  const rarityLabel = config.rarity.charAt(0).toUpperCase() + config.rarity.slice(1);
  const typeLabel = cardTypeLabel(config.type);
  lines.push({ kind: 'meta', text: `${rarityLabel} · ${typeLabel}` });
  lines.push({ kind: 'energy', text: `◇ ${config.energyCost}` });
  if (config.persistAcrossWaves) {
    lines.push({ kind: 'persist', text: '✦ 跨波保留' });
  }
  if (config.description) {
    lines.push({ kind: 'desc', text: config.description });
  }
  if (config.flavorText) {
    lines.push({ kind: 'flavor', text: config.flavorText });
  }
  return lines;
}

/**
 * v3.0 roguelike — 详情卡片在 design space 的左上角锚点（纯函数）。
 */
export function computeTooltipAnchor(
  cardIndex: number,
  handCount: number,
  regionWidth: number,
  cardWidth: number,
  gap: number,
): { x: number; y: number } {
  const bounds = getHandZoneBounds();
  const slots = computeCardSlotsLayout(handCount, regionWidth, cardWidth, gap);
  const slot = slots[cardIndex];
  if (!slot) {
    return { x: bounds.centerX - CARD_TOOLTIP_WIDTH / 2, y: bounds.top - CARD_TOOLTIP_HEIGHT - 12 };
  }
  const cardCenterX = bounds.left + slot.x + cardWidth / 2;
  let x = cardCenterX - CARD_TOOLTIP_WIDTH / 2;
  const margin = 8;
  const designW = 1920;
  if (x < margin) x = margin;
  if (x + CARD_TOOLTIP_WIDTH > designW - margin) x = designW - margin - CARD_TOOLTIP_WIDTH;
  const y = bounds.top - CARD_TOOLTIP_HEIGHT - 12;
  return { x, y };
}

// ============================================================
// 牌组/弃牌堆全览面板
// ============================================================

export const DECK_ICON_HIT = { x: 1720, y: 920, w: 50, h: 70 } as const;
export const DISCARD_ICON_HIT = { x: 1780, y: 920, w: 50, h: 70 } as const;

export function inHitBox(px: number, py: number, box: { x: number; y: number; w: number; h: number }): boolean {
  return px >= box.x && px < box.x + box.w && py >= box.y && py < box.y + box.h;
}

export function hitTestDeckIcon(px: number, py: number): boolean {
  return inHitBox(px, py, DECK_ICON_HIT);
}

export function hitTestDiscardIcon(px: number, py: number): boolean {
  return inHitBox(px, py, DISCARD_ICON_HIT);
}

// ============================================================
// 模态面板几何
// ============================================================

export const OVERLAY_MODAL_W = 1100;
export const OVERLAY_MODAL_H = 700;
export const OVERLAY_CARD_W = 64;
export const OVERLAY_CARD_H = 88;

export interface OverlayCardCell {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OverlayLayout {
  modal: { x: number; y: number; w: number; h: number };
  title: { x: number; y: number };
  cells: OverlayCardCell[];
  closeHintAt: { x: number; y: number };
}

export function buildDeckOverlayLayout(cardCount: number): OverlayLayout {
  const OVERLAY_PADDING = 32;
  const OVERLAY_TITLE_H = 60;
  const OVERLAY_CELL_GAP = 12;
  const OVERLAY_DESIGN_W = 1920;
  const OVERLAY_DESIGN_H = 1080;

  const modal = {
    x: (OVERLAY_DESIGN_W - OVERLAY_MODAL_W) / 2,
    y: (OVERLAY_DESIGN_H - OVERLAY_MODAL_H) / 2,
    w: OVERLAY_MODAL_W,
    h: OVERLAY_MODAL_H,
  };
  const innerLeft = modal.x + OVERLAY_PADDING;
  const innerTop = modal.y + OVERLAY_PADDING + OVERLAY_TITLE_H;
  const innerWidth = modal.w - OVERLAY_PADDING * 2;
  const colStride = OVERLAY_CARD_W + OVERLAY_CELL_GAP;
  const cols = Math.max(1, Math.floor((innerWidth + OVERLAY_CELL_GAP) / colStride));

  const cells: OverlayCardCell[] = [];
  for (let i = 0; i < cardCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    cells.push({
      index: i,
      x: innerLeft + col * colStride,
      y: innerTop + row * (OVERLAY_CARD_H + OVERLAY_CELL_GAP),
      w: OVERLAY_CARD_W,
      h: OVERLAY_CARD_H,
    });
  }

  return {
    modal,
    title: { x: modal.x + OVERLAY_PADDING, y: modal.y + OVERLAY_PADDING },
    cells,
    closeHintAt: { x: modal.x + modal.w / 2, y: modal.y + modal.h - OVERLAY_PADDING },
  };
}

export type OverlayClickRegion = 'icon-deck' | 'icon-discard' | 'inside-modal' | 'outside-modal';

export function classifyOverlayClick(
  px: number,
  py: number,
  modal: { x: number; y: number; w: number; h: number },
): OverlayClickRegion {
  if (hitTestDeckIcon(px, py)) return 'icon-deck';
  if (hitTestDiscardIcon(px, py)) return 'icon-discard';
  if (inHitBox(px, py, modal)) return 'inside-modal';
  return 'outside-modal';
}
