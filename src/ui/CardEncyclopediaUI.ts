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
import { cardArtPath } from '../utils/artAssets.js';
import { drawLoadedImage } from '../utils/imageCache.js';

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

/** 在美术区绘制卡牌专属矢量图标（可跨模块复用） */
export function drawCardIcon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  cardId: string, color: string,
): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (cardId) {
    // ============ 塔 (10) ============
    case 'card_arrow_tower':     drawArrowTower(ctx, cx, cy, w, h); break;
    case 'card_ballista_tower':  drawBallistaTower(ctx, cx, cy, w, h); break;
    case 'card_cannon_tower':    drawCannonTower(ctx, cx, cy, w, h); break;
    case 'card_laser_tower':     drawLaserTower(ctx, cx, cy, w, h); break;
    case 'card_bat_tower':       drawBatTower(ctx, cx, cy, w, h); break;
    case 'card_missile_tower':   drawMissileTower(ctx, cx, cy, w, h); break;
    case 'card_ice_tower':       drawIceTower(ctx, cx, cy, w, h); break;
    case 'card_fire_tower':      drawFireTower(ctx, cx, cy, w, h); break;
    case 'card_poison_tower':    drawPoisonTower(ctx, cx, cy, w, h); break;
    case 'card_lightning_tower': drawLightningTower(ctx, cx, cy, w, h); break;
    // ============ 士兵 (4) ============
    case 'card_shield_guard':    drawShieldGuard(ctx, cx, cy, w, h); break;
    case 'card_archer':          drawArcher(ctx, cx, cy, w, h); break;
    case 'card_mage':            drawMage(ctx, cx, cy, w, h); break;
    case 'card_priest':          drawPriest(ctx, cx, cy, w, h); break;
    // ============ 机关 (4) ============
    case 'card_spike_trap':      drawSpikeTrap(ctx, cx, cy, w, h); break;
    case 'card_bear_trap':       drawBearTrap(ctx, cx, cy, w, h); break;
    case 'card_tar_pit':         drawTarPit(ctx, cx, cy, w, h); break;
    case 'card_boulder':         drawBoulder(ctx, cx, cy, w, h); break;
    // ============ 技能 (4) ============
    case 'card_fireball':        drawFireball(ctx, cx, cy, w, h); break;
    case 'card_arrow_rain':      drawArrowRain(ctx, cx, cy, w, h); break;
    case 'card_blizzard':        drawBlizzard(ctx, cx, cy, w, h); break;
    case 'card_bomb':            drawBomb(ctx, cx, cy, w, h); break;
    // ============ 奥术 (5) ============
    case 'card_emergency_shield': drawEmergencyShield(ctx, cx, cy, w, h); break;
    case 'card_arrow_boost':      drawArrowBoost(ctx, cx, cy, w, h); break;
    case 'card_shield_boost':     drawShieldBoost(ctx, cx, cy, w, h); break;
    case 'card_gold_rush':        drawGoldRush(ctx, cx, cy, w, h); break;
    case 'card_speed_boost':      drawSpeedBoost(ctx, cx, cy, w, h); break;
    // fallback
    default:
      drawGenericIcon(ctx, cx, cy, w, h, color); break;
  }
}

// ============================================================
// 塔图标
// ============================================================

/** 箭塔 — 弓 + 箭 */
function drawArrowTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  // 弓身弧
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy, s, Math.PI * 0.7, Math.PI * 1.3, false);
  ctx.stroke();
  // 弓弦
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.65);
  ctx.lineTo(cx - s * 0.15, cy + s * 0.65);
  ctx.stroke();
  ctx.lineWidth = 2;
  // 箭
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, cy);
  ctx.lineTo(cx + s * 0.7, cy);
  ctx.stroke();
  // 箭头
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.7, cy);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.2);
  ctx.moveTo(cx + s * 0.7, cy);
  ctx.lineTo(cx + s * 0.4, cy + s * 0.2);
  ctx.stroke();
  // 尾羽
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.15);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.15);
  ctx.stroke();
}

/** 弩塔 — 弩机 */
function drawBallistaTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.38;
  // 弩臂（水平）
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillRect(cx - s, cy - s * 0.12, s * 2, s * 0.24);
  // 弩身（垂直）
  ctx.fillRect(cx - s * 0.1, cy - s * 0.7, s * 0.2, s * 1.2);
  // 弓弧（上）
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.7, s * 0.6, Math.PI, 0, false);
  ctx.fill();
  // 弓弧（下）
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.5, s * 0.6, Math.PI, 0, true);
  ctx.fill();
}

/** 炮塔 — 炮管 + 炮弹 */
function drawCannonTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.36;
  // 炮管
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillRect(cx - s * 0.35, cy - s * 0.6, s * 1.0, s * 0.22);
  // 炮口
  ctx.beginPath();
  ctx.arc(cx + s * 0.65, cy - s * 0.49, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 炮座
  ctx.beginPath();
  ctx.arc(cx - s * 0.25, cy + s * 0.1, s * 0.6, Math.PI * 0.4, Math.PI * 1.6, false);
  ctx.fill();
  ctx.fillRect(cx - s * 0.1, cy - s * 0.15, s * 0.5, s * 0.55);
}

/** 激光塔 — 三道激光束 */
function drawLaserTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  // 发射器
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(cx - s * 0.6, cy, s * 0.25, 0, Math.PI * 2);
  ctx.fill();
  // 三道光束
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + i * s * 0.25);
    ctx.lineTo(cx + s * 0.8, cy + i * s * 0.12);
    ctx.stroke();
  }
  // 目标点
  ctx.beginPath();
  ctx.arc(cx + s * 0.8, cy, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

/** 蝙蝠塔 — 蝙蝠翅膀 */
function drawBatTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.38;
  ctx.fillStyle = ctx.strokeStyle;
  // 身体
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.22, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  // 左翅
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.3);
  ctx.quadraticCurveTo(cx - s * 0.8, cy - s * 0.7, cx - s * 0.9, cy - s * 0.2);
  ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.1, cx - s * 0.15, cy + s * 0.1);
  ctx.fill();
  // 右翅
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.15, cy - s * 0.3);
  ctx.quadraticCurveTo(cx + s * 0.8, cy - s * 0.7, cx + s * 0.9, cy - s * 0.2);
  ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.1, cx + s * 0.15, cy + s * 0.1);
  ctx.fill();
  // 尖耳
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, cy - s * 0.45);
  ctx.lineTo(cx - s * 0.05, cy - s * 0.65);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.65);
  ctx.lineTo(cx + s * 0.12, cy - s * 0.45);
  ctx.fill();
}

/** 导弹塔 — 导弹 + 尾焰 */
function drawMissileTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.36;
  // 弹体
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.8, cy);
  ctx.lineTo(cx - s * 0.3, cy - s * 0.2);
  ctx.lineTo(cx - s * 0.5, cy);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
  // 尾翼
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.25);
  ctx.lineTo(cx - s * 0.6, cy - s * 0.45);
  ctx.lineTo(cx - s * 0.3, cy - s * 0.1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.25);
  ctx.lineTo(cx - s * 0.6, cy + s * 0.45);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.1);
  ctx.fill();
  // 尾焰
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.12);
  ctx.lineTo(cx - s * 0.85, cy);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.12);
  ctx.fill();
}

/** 冰塔 — 雪花 */
function drawIceTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.42;
  // 六瓣雪花
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const x1 = cx + Math.cos(a) * s * 0.3;
    const y1 = cy + Math.sin(a) * s * 0.3;
    const x2 = cx + Math.cos(a) * s;
    const y2 = cy + Math.sin(a) * s;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // 分支
    const ba = a + Math.PI / 6;
    const bx = cx + Math.cos(a) * s * 0.65;
    const by = cy + Math.sin(a) * s * 0.65;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(ba) * s * 0.2, by + Math.sin(ba) * s * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - Math.cos(ba) * s * 0.2, by - Math.sin(ba) * s * 0.2);
    ctx.stroke();
  }
  // 中心
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/** 火塔 — 火焰 */
function drawFireTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = ctx.strokeStyle;
  // 外焰
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.1);
  ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.3, cx, cy - s * 0.9);
  ctx.quadraticCurveTo(cx + s * 0.6, cy - s * 0.3, cx + s * 0.3, cy + s * 0.1);
  ctx.quadraticCurveTo(cx, cy + s * 0.15, cx - s * 0.3, cy + s * 0.1);
  ctx.fill();
  // 内焰（深色挖空）
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy);
  ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.15, cx, cy - s * 0.5);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.15, cx + s * 0.15, cy);
  ctx.quadraticCurveTo(cx, cy + s * 0.05, cx - s * 0.15, cy);
  ctx.fill();
}

/** 毒塔 — 骷髅 */
function drawPoisonTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.36;
  ctx.fillStyle = ctx.strokeStyle;
  // 头骨
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.55, 0, Math.PI);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.15);
  ctx.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.5, cy + s * 0.15);
  ctx.closePath();
  ctx.fill();
  // 眼洞
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.arc(cx - s * 0.2, cy - s * 0.15, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.2, cy - s * 0.15, s * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // 毒滴
  ctx.fillStyle = '#66bb6a';
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.55);
  ctx.quadraticCurveTo(cx - s * 0.1, cy + s * 0.7, cx, cy + s * 0.85);
  ctx.quadraticCurveTo(cx + s * 0.1, cy + s * 0.7, cx, cy + s * 0.55);
  ctx.fill();
}

/** 电塔 — 闪电 */
function drawLightningTower(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.9);
  ctx.lineTo(cx - s * 0.4, cy - s * 0.1);
  ctx.lineTo(cx - s * 0.05, cy - s * 0.1);
  ctx.lineTo(cx - s * 0.35, cy + s * 0.7);
  ctx.lineTo(cx + s * 0.15, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.6);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.6);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// 士兵图标
// ============================================================

/** 盾卫 — 塔盾 */
function drawShieldGuard(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.42;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s);
  ctx.lineTo(cx + s * 0.6, cy - s * 0.4);
  ctx.lineTo(cx + s * 0.6, cy + s * 0.3);
  ctx.quadraticCurveTo(cx + s * 0.6, cy + s * 0.9, cx, cy + s * 0.85);
  ctx.quadraticCurveTo(cx - s * 0.6, cy + s * 0.9, cx - s * 0.6, cy + s * 0.3);
  ctx.lineTo(cx - s * 0.6, cy - s * 0.4);
  ctx.closePath();
  ctx.fill();
  // 盾面竖纹
  ctx.strokeStyle = '#0d1b2a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.5);
  ctx.lineTo(cx, cy + s * 0.6);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy - s * 0.15);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.15);
  ctx.stroke();
}

/** 弓手 — 长弓 */
function drawArcher(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.42;
  // 弓臂
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.quadraticCurveTo(cx - s * 0.6, cy, cx + s * 0.1, cy + s);
  ctx.stroke();
  // 弓弦
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, cy - s);
  ctx.lineTo(cx + s * 0.1, cy + s);
  ctx.stroke();
  ctx.lineWidth = 2;
  // 箭
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy);
  ctx.lineTo(cx + s * 0.6, cy);
  ctx.stroke();
  // 箭头
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.6, cy);
  ctx.lineTo(cx + s * 0.35, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.35, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();
  // 弦拉后
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.1, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.05);
  ctx.lineTo(cx + s * 0.15, cy);
  ctx.closePath();
  ctx.fill();
}

/** 法师 — 法杖 + 宝珠 */
function drawMage(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.38;
  // 杖杆
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy + s * 0.8);
  ctx.lineTo(cx - s * 0.05, cy - s * 0.4);
  ctx.stroke();
  // 宝珠
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy - s * 0.55, s * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 光芒
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy - s * 0.55, s * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy - s * 0.55, s * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 小星
  const starPos: [number, number][] = [[cx + s * 0.4, cy - s * 0.5], [cx + s * 0.5, cy + s * 0.3], [cx - s * 0.5, cy + s * 0.4]];
  for (const [sx, sy] of starPos) {
    ctx.beginPath();
    ctx.arc(sx, sy, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 牧师 — 十字架 */
function drawPriest(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.42;
  ctx.fillStyle = ctx.strokeStyle;
  // 竖
  ctx.fillRect(cx - s * 0.12, cy - s * 0.85, s * 0.24, s * 1.7);
  // 横
  ctx.fillRect(cx - s * 0.5, cy - s * 0.1, s * 1.0, s * 0.24);
  // 顶部光环
  ctx.fillStyle = '#ffe082';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.9, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ============================================================
// 机关图标
// ============================================================

/** 地刺 — 向上尖刺 */
function drawSpikeTrap(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = -2; i <= 2; i++) {
    const height = 0.4 + Math.abs(i) * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx + i * s * 0.32, cy + s * 0.5);
    ctx.lineTo(cx + i * s * 0.32 + s * 0.08, cy - s * height);
    ctx.lineTo(cx + i * s * 0.32 + s * 0.16, cy + s * 0.5);
    ctx.fill();
  }
}

/** 捕兽夹 — 锯齿夹 */
function drawBearTrap(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = ctx.strokeStyle;
  // 左夹
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.3);
  ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.8, cx, cy - s * 0.2);
  ctx.lineTo(cx - s * 0.02, cy);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.15);
  ctx.fill();
  // 右夹
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.5, cy - s * 0.3);
  ctx.quadraticCurveTo(cx + s * 0.1, cy - s * 0.8, cx, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.02, cy);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.15);
  ctx.fill();
  // 齿
  ctx.strokeStyle = '#0d1b2a';
  for (let i = 0; i < 3; i++) {
    const x = cx - s * 0.38 + i * s * 0.38;
    ctx.beginPath();
    ctx.moveTo(x, cy + s * 0.05);
    ctx.lineTo(x, cy - s * 0.2);
    ctx.stroke();
  }
}

/** 焦油坑 — 液滴 */
function drawTarPit(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = ctx.strokeStyle;
  // 液坑
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.1, s * 0.7, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // 气泡
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.arc(cx - s * 0.2, cy - s * 0.05, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.25, cy - s * 0.15, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  // 黏连丝
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.25);
  ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.7, cx - s * 0.3, cy - s * 0.8);
  ctx.stroke();
}

/** 巨石 — 岩块 */
function drawBoulder(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = ctx.strokeStyle;
  // 不规则岩体
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.5, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.15, cy - s * 0.75);
  ctx.lineTo(cx + s * 0.65, cy - s * 0.35);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.45);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0d1b2a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 裂缝纹
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.1, cy);
  ctx.lineTo(cx + s * 0.25, cy + s * 0.25);
  ctx.stroke();
}

// ============================================================
// 技能图标
// ============================================================

/** 火球术 — 火球 */
function drawFireball(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.42;
  ctx.fillStyle = ctx.strokeStyle;
  // 球体
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // 火焰缠绕
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.1);
  ctx.quadraticCurveTo(cx - s * 0.6, cy - s * 0.6, cx + s * 0.1, cy - s * 0.6);
  ctx.quadraticCurveTo(cx + s * 0.4, cy - s * 0.3, cx + s * 0.55, cy);
  ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.3, cx - s * 0.2, cy + s * 0.4);
  ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.15, cx - s * 0.5, cy + s * 0.1);
  ctx.fill();
  // 高光
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.arc(cx - s * 0.15, cy - s * 0.2, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 剑雨 — 多箭下落 */
function drawArrowRain(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.38;
  // 三支箭从不同位置下落
  const arrows = [
    { x: cx - s * 0.5, y: cy - s * 0.2 },
    { x: cx,          y: cy - s * 0.5 },
    { x: cx + s * 0.5, y: cy + s * 0.1 },
  ];
  for (const a of arrows) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - s * 0.8);
    ctx.lineTo(a.x, a.y + s * 0.5);
    ctx.stroke();
    // 箭头
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + s * 0.5);
    ctx.lineTo(a.x - s * 0.15, a.y + s * 0.2);
    ctx.lineTo(a.x + s * 0.15, a.y + s * 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

/** 暴风雪 — 风雪 */
function drawBlizzard(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  // 风线
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 4; i++) {
    const y = cy - s * 0.5 + i * s * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, y);
    ctx.lineTo(cx + s * 0.5, y - s * 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 雪花
  ctx.fillStyle = ctx.strokeStyle;
  const flakePositions: [number, number][] = [[cx - s * 0.3, cy - s * 0.6], [cx + s * 0.2, cy - s * 0.2], [cx + s * 0.4, cy + s * 0.5], [cx - s * 0.4, cy + s * 0.3]];
  for (const [sx, sy] of flakePositions) {
    drawMiniSnowflake(ctx, sx, sy, s * 0.18);
  }
}

function drawMiniSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
    const ba = a + Math.PI / 6;
    const mx = x + Math.cos(a) * r * 0.55;
    const my = y + Math.sin(a) * r * 0.55;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + Math.cos(ba) * r * 0.2, my + Math.sin(ba) * r * 0.2);
    ctx.stroke();
  }
}

/** 炸弹 — 圆形炸弹 + 引信 */
function drawBomb(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  // 弹体
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.1, s * 0.6, 0, Math.PI * 2);
  ctx.fill();
  // 高光
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(cx - s * 0.15, cy - s * 0.15, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = ctx.strokeStyle;
  // 引信
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.2, cy - s * 0.45);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.7, cx + s * 0.1, cy - s * 0.8);
  ctx.stroke();
  // 火花
  ctx.fillStyle = '#ff9800';
  ctx.beginPath();
  ctx.arc(cx + s * 0.1, cy - s * 0.85, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // 星爆
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.08, cy - s * 0.85);
    ctx.lineTo(cx + Math.cos(a) * s * 0.25, cy - s * 0.85 + Math.sin(a) * s * 0.25);
    ctx.stroke();
  }
}

// ============================================================
// 奥术图标
// ============================================================

/** 紧急防护 — 防护罩 */
function drawEmergencyShield(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  // 护罩弧
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.1, s * 0.7, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.1, s * 0.7, Math.PI, 0);
  ctx.stroke();
  // 感叹号
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.3);
  ctx.lineTo(cx, cy + s * 0.15);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.35, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

/** 箭术精通 — 弓 + 上箭头 */
function drawArrowBoost(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.38;
  // 小弓
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.3);
  ctx.quadraticCurveTo(cx - s * 0.5, cy, cx - s * 0.3, cy - s * 0.6);
  ctx.stroke();
  // 箭（斜上）
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.2);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.5);
  ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.5, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.55);
  ctx.lineTo(cx + s * 0.35, cy - s * 0.3);
  ctx.closePath();
  ctx.fill();
}

/** 坚韧守护 — 盾 + 上箭头 */
function drawShieldBoost(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.38;
  ctx.fillStyle = ctx.strokeStyle;
  // 小盾
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.5, cy - s * 0.3);
  ctx.quadraticCurveTo(cx, cy - s * 0.7, cx + s * 0.3, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.2);
  ctx.quadraticCurveTo(cx, cy + s * 0.5, cx - s * 0.5, cy + s * 0.2);
  ctx.fill();
  // 上箭头
  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy - s * 0.15);
  ctx.lineTo(cx, cy - s * 0.5);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.15);
  ctx.closePath();
  ctx.fill();
}

/** 淘金热 — 金币 */
function drawGoldRush(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.42;
  // 金币主体
  ctx.fillStyle = '#ffc107';
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d1b2a';
  ctx.stroke();
  // $ 符号
  ctx.fillStyle = '#0d1b2a';
  ctx.font = 'bold ' + Math.round(s * 0.8) + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx, cy + s * 0.05);
}

/** 疾风步 — 速度线 */
function drawSpeedBoost(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number): void {
  const s = Math.min(w, h) * 0.4;
  // 速度线（从左到右逐渐变长）
  for (let i = 0; i < 4; i++) {
    const y = cy - s * 0.5 + i * s * 0.35;
    const len = s * (0.3 + i * 0.25);
    ctx.beginPath();
    ctx.moveTo(cx - len * 0.5, y);
    ctx.lineTo(cx + len * 0.5, y);
    ctx.stroke();
  }
  // 人物剪影
  ctx.fillStyle = ctx.strokeStyle;
  // 头
  ctx.beginPath();
  ctx.arc(cx + s * 0.3, cy - s * 0.2, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // 身体
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.25, cy);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.5);
  ctx.lineTo(cx + s * 0.4, cy + s * 0.5);
  ctx.lineTo(cx + s * 0.35, cy);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// 通用 fallback
// ============================================================

function drawGenericIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, color: string): void {
  const s = Math.min(w, h) * 0.4;
  ctx.fillStyle = color;
  ctx.beginPath();
  // 菱形
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s, cy);
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
    ctx.font = getFont(26, true);
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
      ctx.fillStyle = active ? (t.key === 'all' ? '#1a1a2e' : '#ffffff') : '#8888aa';
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
      if (!drawLoadedImage(ctx, cardArtPath(card.id), cardCenterX - ART_W / 2, artCY - ART_H / 2, ART_W, ART_H)) {
        drawCardIcon(ctx, cardCenterX, artCY, ART_W, ART_H, card.id, borderColor);
      }
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
