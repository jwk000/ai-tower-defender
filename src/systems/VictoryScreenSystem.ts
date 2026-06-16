// ============================================================
// VictoryScreenSystem — 胜败共用结算覆盖层
//
// 背景图全屏保留，棋盘与战斗实体在结算前清理；覆盖层只绘制
// 章节句、剧情文字、战斗统计和胜利庆典粒子。
//
// 设计文档: design/05-presentation.md §10, design/04-levels.md §9
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { getFont } from '../config/fonts.js';
import type { VictoryConfig, VictoryStory } from '../types/index.js';
import { assetUrl, backgroundArtPath } from '../utils/artAssets.js';

const PANEL_ALPHA = 0.85;
const STAR_SIZE = 46;
const STAR_SPACING = 60;
const STORY_TYPEWRITER_START = 0.9;
const STORY_TYPEWRITER_CPS = 19;
const STAT_REVEAL_DELAY = 2.15;
const STAT_REVEAL_INTERVAL = 0.08;
const PANEL_W = 1180;
const PANEL_H = 610;
const PANEL_Y = 118;
const PANEL_BORDER_RADIUS = 8;
const PANEL_SIDE_PADDING = 64;
const PANEL_DIVIDER_Y = PANEL_Y + 168;
const STORY_TITLE_Y = 174;
const STORY_BODY_Y = 358;
const STAT_CARD_W = 276;
const STAT_CARD_H = 34;
const STAT_GRID_COLS = 3;
const STAT_GRID_TOP = 570;
const STAT_GRID_ROW_H = 44;

type SettlementMode = 'victory' | 'defeat';
type ConfettiShape = 'ribbon' | 'petal' | 'sparkle' | 'fragment';

export interface BattleSettlementStats {
  waves: { current: number; total: number };
  enemies: { spawned: number; defeated: number };
  towersUsed: number;
  soldiersUsed: number;
  crystalHp: { current: number; max: number };
  score: number;
  totalDamage: number;
}

interface SettlementCopy {
  chapterLine: string;
  story: VictoryStory;
  prompt: string;
}

interface ConfettiParticle {
  x: number; y: number;
  vx: number; vy: number;
  rotation: number; rotSpeed: number;
  width: number; height: number;
  color: string;
  alpha: number;
  life: number; maxLife: number;
  shape: ConfettiShape;
}

export class VictoryScreenSystem implements System {
  readonly name = 'VictoryScreenSystem';

  private active = false;
  private mode: SettlementMode = 'victory';
  private config: VictoryConfig | null = null;
  private copy: SettlementCopy | null = null;
  private stats: BattleSettlementStats | null = null;
  private timesCleared = 0;
  private stars = 1;
  private elapsed = 0;
  private particles: ConfettiParticle[] = [];
  private confettiSpawned = false;
  private continueButtonVisible = false;
  private bgImage: HTMLImageElement | null = null;
  private bgPath = '';
  private titleScale = 1.18;
  private titleAlpha = 0;
  private starBrightness: number[] = [0, 0, 0];

  onComplete?: () => void;
  onContinue?: () => void;

  constructor(private renderer: Renderer) {}

  update(_world: TowerWorld, dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    this.updateTitleAnimation();
    this.updateStars();
    this.updateParticles(dt);

    if (this.mode === 'victory' && this.elapsed > 1.05) {
      this.ensureConfettiSpawned();
    }
    if (!this.continueButtonVisible && this.isStoryComplete()) {
      this.continueButtonVisible = true;
    }
  }

  activate(
    config: VictoryConfig,
    stars: number,
    timesCleared: number,
    levelName: string,
    stats: BattleSettlementStats,
    backgroundTheme?: string,
  ): void {
    this.mode = 'victory';
    this.config = config;
    this.copy = {
      chapterLine: config.story.title || `${levelName}的阴影退去。`,
      story: config.story,
      prompt: '点击继续',
    };
    this.stats = stats;
    this.stars = stars;
    this.timesCleared = timesCleared;
    this.resetState(backgroundTheme);
  }

  activateDefeat(
    defeatStory: VictoryStory,
    typography: VictoryConfig['typography'],
    stats: BattleSettlementStats,
    backgroundTheme?: string,
  ): void {
    this.mode = 'defeat';
    this.config = {
      story: defeatStory,
      background: { filter: 'gray_tint', gradient: { top: '#12070a', mid: '#211014', bottom: '#060507' }, particles: [] },
      confetti: { count: 0, burst: 'top_fall', colors: [], shapes: {}, duration: 0, spread: 0 },
      audio: { bgm: 'defeat', sfx: 'defeat' },
      typography,
    };
    this.copy = {
      chapterLine: defeatStory.title || '防线在暮色中破碎。',
      story: defeatStory,
      prompt: '点击返回',
    };
    this.stats = stats;
    this.stars = 0;
    this.timesCleared = 0;
    this.resetState(backgroundTheme);
  }

  deactivate(): void {
    this.active = false;
    this.config = null;
    this.copy = null;
    this.stats = null;
    this.particles = [];
  }

  isActive(): boolean { return this.active; }

  handleClick(_x: number, _y: number): boolean {
    if (!this.active) return false;
    if (this.continueButtonVisible || this.shouldSkipStory()) {
      this.onContinue?.();
      this.deactivate();
      this.onComplete?.();
    }
    return true;
  }

  render(): void {
    if (!this.active || !this.config || !this.copy) return;
    const ctx = this.renderer.context;
    if (!ctx) return;

    this.renderer.resetTransform();
    this.drawBackground(ctx);
    this.renderer.applyDesignTransform();

    this.drawAtmosphere(ctx);
    if (this.mode === 'victory') this.drawConfetti(ctx);
    this.drawSettlementPanel(ctx);
    this.drawStars(ctx);
    this.drawStory(ctx);
    this.drawStats(ctx);
    this.drawPrompt(ctx);
  }

  private resetState(backgroundTheme?: string): void {
    this.active = true;
    this.elapsed = 0;
    this.particles = [];
    this.confettiSpawned = false;
    this.continueButtonVisible = false;
    this.titleScale = 1.18;
    this.titleAlpha = 0;
    this.starBrightness = [0, 0, 0];
    this.setBackground(backgroundTheme);
  }

  private shouldSkipStory(): boolean {
    return this.mode === 'victory'
      && !!this.config?.story.showFullStoryOnlyFirst
      && this.timesCleared > 1;
  }

  private updateTitleAnimation(): void {
    const t = Math.min(1, this.elapsed / 0.85);
    this.titleAlpha = easeOutCubic(t);
    this.titleScale = 1.18 - 0.18 * easeOutBack(t);
  }

  private updateStars(): void {
    if (this.mode !== 'victory') return;
    for (let i = 0; i < 3; i++) {
      const t = Math.min(1, Math.max(0, (this.elapsed - 0.95 - i * 0.22) / 0.28));
      this.starBrightness[i] = easeOutBack(t);
    }
  }

  private setBackground(backgroundTheme?: string): void {
    const path = backgroundArtPath(backgroundTheme);
    if (path === this.bgPath && this.bgImage) return;
    this.bgPath = path;
    const img = new Image();
    img.onload = () => { this.bgImage = img; };
    img.onerror = () => { if (this.bgPath === path) this.bgImage = null; };
    img.src = assetUrl(path);
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const vw = LayoutManager.viewportW;
    const vh = LayoutManager.viewportH;

    ctx.save();
    if (this.bgImage?.complete && this.bgImage.naturalWidth > 0) {
      const iw = this.bgImage.naturalWidth;
      const ih = this.bgImage.naturalHeight;
      const scale = Math.max(vw / iw, vh / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(this.bgImage, (vw - dw) / 2, (vh - dh) / 2, dw, dh);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      if (this.mode === 'victory') {
        g.addColorStop(0, '#101c28');
        g.addColorStop(0.55, '#1b2634');
        g.addColorStop(1, '#07090d');
      } else {
        g.addColorStop(0, '#16070b');
        g.addColorStop(0.55, '#201015');
        g.addColorStop(1, '#060406');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }

    ctx.fillStyle = this.mode === 'victory'
      ? 'rgba(1, 5, 12, 0.48)'
      : 'rgba(22, 3, 6, 0.62)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.restore();
  }

  private drawAtmosphere(ctx: CanvasRenderingContext2D): void {
    const w = LayoutManager.DESIGN_W;
    const h = LayoutManager.DESIGN_H;
    const accent = this.mode === 'victory'
      ? this.config?.typography.accentColor ?? '#ffd700'
      : '#ff6b5f';

    ctx.save();
    const glow = ctx.createRadialGradient(w / 2, h * 0.2, 0, w / 2, h * 0.2, w * 0.52);
    glow.addColorStop(0, withAlpha(accent, 0.2));
    glow.addColorStop(0.5, withAlpha(accent, 0.08));
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = this.mode === 'victory' ? 'rgba(255,255,255,0.18)' : 'rgba(255,105,97,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = 40 + i * 58 + Math.sin(this.elapsed * 0.6 + i) * 10;
      ctx.globalAlpha = Math.max(0, 0.28 - i * 0.01);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y - 44);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSettlementPanel(ctx: CanvasRenderingContext2D): void {
    const w = LayoutManager.DESIGN_W;
    const panelW = PANEL_W;
    const panelH = PANEL_H;
    const x = this.getPanelX();
    const y = PANEL_Y;
    const config = this.config!;
    const accent = this.mode === 'victory' ? config.typography.accentColor : '#ff6b5f';

    ctx.save();
    ctx.globalAlpha = easeOutCubic(Math.min(1, this.elapsed / 0.75));
    ctx.fillStyle = withPanelAlpha(config.typography.panelBg, PANEL_ALPHA);
    ctx.strokeStyle = withAlpha(accent, 0.55);
    ctx.lineWidth = 2;
    ctx.shadowColor = withAlpha(accent, this.mode === 'victory' ? 0.42 : 0.3);
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, PANEL_BORDER_RADIUS);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + PANEL_SIDE_PADDING, PANEL_DIVIDER_Y);
    ctx.lineTo(x + panelW - PANEL_SIDE_PADDING, PANEL_DIVIDER_Y);
    ctx.stroke();
    ctx.restore();
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    if (this.mode !== 'victory') return;
    const cx = LayoutManager.DESIGN_W / 2;
    const cy = 302;

    ctx.save();
    ctx.font = `${STAR_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * STAR_SPACING;
      const lit = i < this.stars;
      const brightness = Math.max(0, Math.min(1, this.starBrightness[i] ?? 0));
      ctx.globalAlpha = lit ? Math.max(0.2, brightness) : 0.45;
      ctx.fillStyle = lit ? '#ffd862' : '#6d7280';
      ctx.shadowColor = lit ? 'rgba(255, 216, 98, 0.75)' : 'rgba(0,0,0,0)';
      ctx.shadowBlur = lit ? 18 * brightness : 0;
      ctx.fillText(lit ? '★' : '☆', x, cy);
    }
    ctx.restore();
  }

  private drawStory(ctx: CanvasRenderingContext2D): void {
    const copy = this.copy!;
    const config = this.config!;
    const cx = LayoutManager.DESIGN_W / 2;
    const titleY = STORY_TITLE_Y;
    const visibleText = this.getVisibleStoryText();
    const lines = wrapParagraphLines(ctx, visibleText, 1040);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = this.titleAlpha;
    ctx.shadowColor = this.mode === 'victory' ? withAlpha(config.typography.accentColor, 0.9) : 'rgba(255,95,82,0.9)';
    ctx.shadowBlur = 24;
    ctx.font = getFont(Math.round(60 * this.titleScale), true);
    const gradient = ctx.createLinearGradient(cx, titleY - 52, cx, titleY + 52);
    const titleColors = this.mode === 'victory'
      ? config.typography.titleColor
      : ['#ffc1bb', '#ff6659'];
    gradient.addColorStop(0, titleColors[0] ?? '#f6f8ff');
    gradient.addColorStop(1, titleColors[1] ?? '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillText(copy.chapterLine, cx, titleY);

    const storyAlpha = easeOutCubic(Math.min(1, Math.max(0, (this.elapsed - 0.45) / 0.75)));
    ctx.globalAlpha = storyAlpha;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12;
    ctx.textBaseline = 'top';
    ctx.font = getFont(25);
    ctx.fillStyle = config.typography.storyColor;
    let y = STORY_BODY_Y;
    for (const line of lines.slice(0, 4)) {
      ctx.fillText(line, cx, y);
      y += 36;
    }
    ctx.restore();
  }

  private drawStats(ctx: CanvasRenderingContext2D): void {
    if (!this.stats) return;
    const rows = this.getStatRows();
    const panelX = this.getPanelX();
    const statAreaX = panelX + PANEL_SIDE_PADDING;
    const statAreaW = PANEL_W - PANEL_SIDE_PADDING * 2;
    const colW = statAreaW / STAT_GRID_COLS;
    const startX = statAreaX + colW / 2;
    const startY = STAT_GRID_TOP;
    const rowH = STAT_GRID_ROW_H;

    ctx.save();
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; i++) {
      const reveal = easeOutCubic(Math.min(1, Math.max(0, (this.elapsed - STAT_REVEAL_DELAY - i * STAT_REVEAL_INTERVAL) / 0.28)));
      if (reveal <= 0) continue;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * colW;
      const y = startY + row * rowH + 12 * (1 - reveal);
      const item = rows[i]!;

      ctx.globalAlpha = reveal;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(x - STAT_CARD_W / 2, y - 19, STAT_CARD_W, STAT_CARD_H, 6);
      ctx.fill();

      ctx.font = getFont(17);
      ctx.fillStyle = 'rgba(226,232,240,0.74)';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x - 122, y);

      ctx.font = getFont(20, true);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(item.value, x + 122, y);
    }
    ctx.restore();
  }

  private drawPrompt(ctx: CanvasRenderingContext2D): void {
    if (!this.continueButtonVisible || !this.copy) return;
    const alpha = 0.42 + Math.sin(this.elapsed * 4) * 0.16;
    ctx.save();
    ctx.globalAlpha = Math.max(0.25, Math.min(0.7, alpha));
    ctx.font = getFont(21);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.copy.prompt, LayoutManager.DESIGN_W / 2, LayoutManager.DESIGN_H - 90);
    ctx.restore();
  }

  private getVisibleStoryText(): string {
    if (!this.copy) return '';
    const paragraphs = this.shouldSkipStory() ? [this.copy.story.summary] : this.copy.story.paragraphs;
    const fullText = paragraphs.join('\n');
    const elapsed = Math.max(0, this.elapsed - STORY_TYPEWRITER_START);
    return fullText.slice(0, Math.floor(elapsed * STORY_TYPEWRITER_CPS));
  }

  private isStoryComplete(): boolean {
    if (!this.copy) return this.elapsed >= 1.2;
    const paragraphs = this.shouldSkipStory() ? [this.copy.story.summary] : this.copy.story.paragraphs;
    const fullTextLength = paragraphs.join('\n').length;
    return this.elapsed >= STORY_TYPEWRITER_START + fullTextLength / STORY_TYPEWRITER_CPS + 0.45;
  }

  private getStatRows(): Array<{ label: string; value: string }> {
    const s = this.stats!;
    return [
      { label: '波次', value: `${s.waves.current}/${s.waves.total > 0 ? s.waves.total : '∞'}` },
      { label: '敌人', value: `${s.enemies.defeated}/${s.enemies.spawned}` },
      { label: '使用塔', value: `${s.towersUsed}` },
      { label: '兵数量', value: `${s.soldiersUsed}` },
      { label: '水晶血量', value: `${Math.max(0, Math.ceil(s.crystalHp.current))}/${Math.ceil(s.crystalHp.max)}` },
      { label: '总得分', value: formatInteger(s.score) },
      { label: '总伤害', value: formatInteger(s.totalDamage) },
    ];
  }

  private getPanelX(): number {
    return (LayoutManager.DESIGN_W - PANEL_W) / 2;
  }

  private ensureConfettiSpawned(): void {
    if (this.confettiSpawned) return;
    this.confettiSpawned = true;
    this.spawnConfetti();
  }

  private spawnConfetti(): void {
    const cfg = this.config?.confetti;
    if (!cfg || cfg.count <= 0) return;

    const shapeEntries: ConfettiShape[] = [];
    for (const [shape, weight] of Object.entries(cfg.shapes) as [ConfettiShape, number][]) {
      for (let i = 0; i < Math.round(weight * 100); i++) shapeEntries.push(shape);
    }
    if (shapeEntries.length === 0) shapeEntries.push('ribbon');

    const w = LayoutManager.DESIGN_W;
    const h = LayoutManager.DESIGN_H;
    for (let i = 0; i < cfg.count; i++) {
      const colorGroup = cfg.colors[i % Math.max(1, cfg.colors.length)] ?? ['#ffd700', '#ffffff'];
      const color = colorGroup[Math.floor(Math.random() * colorGroup.length)] ?? '#ffd700';
      const shape = shapeEntries[Math.floor(Math.random() * shapeEntries.length)] ?? 'ribbon';
      let x = w / 2;
      let y = h / 2;
      let vx = 0;
      let vy = 0;

      switch (cfg.burst) {
        case 'bottom_rise':
          x = w * 0.1 + Math.random() * w * 0.8;
          y = h + 20;
          vx = (Math.random() - 0.5) * cfg.spread * 260;
          vy = -150 - Math.random() * 90;
          break;
        case 'explosion_center': {
          const angle = Math.random() * Math.PI * 2;
          const speed = 120 + Math.random() * 220;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
          break;
        }
        case 'both_sides':
          x = Math.random() < 0.5 ? -30 : w + 30;
          y = h * 0.2 + Math.random() * h * 0.6;
          vx = x < 0 ? 120 + Math.random() * 170 : -120 - Math.random() * 170;
          vy = (Math.random() - 0.5) * 80;
          break;
        case 'top_fall':
        default:
          x = w * 0.08 + Math.random() * w * 0.84;
          y = -30;
          vx = (Math.random() - 0.5) * cfg.spread * 320;
          vy = 80 + Math.random() * 130;
          break;
      }

      this.particles.push({
        x, y, vx, vy,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        width: shape === 'fragment' ? 5 + Math.random() * 7 : 4,
        height: shape === 'fragment' ? 5 + Math.random() * 7 : 10 + Math.random() * 8,
        color,
        alpha: 1,
        life: 0,
        maxLife: cfg.duration + Math.random() * 1.1,
        shape,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 150 * dt;
      p.rotation += p.rotSpeed * dt;
      p.life += dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
  }

  private drawConfetti(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.shape === 'petal') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.width, p.height, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'sparkle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, p.width * 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'fragment') {
        ctx.beginPath();
        ctx.moveTo(0, -p.height / 2);
        ctx.lineTo(p.width * 0.75, 0);
        ctx.lineTo(-p.width * 0.35, p.height * 0.45);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

function wrapParagraphLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i] ?? '';
    if (para.length === 0) {
      lines.push('');
    } else {
      lines.push(...wrapTextLines(ctx, para, maxWidth));
    }
    if (i < paragraphs.length - 1) lines.push('');
  }
  return lines;
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    const next = current + char;
    if (current.length > 0 && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function withPanelAlpha(color: string, alpha: number): string {
  const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgba) return `rgba(10, 14, 22, ${alpha})`;
  const parts = rgba[1]!.split(',').map((p) => p.trim());
  return `rgba(${parts[0] ?? '10'}, ${parts[1] ?? '14'}, ${parts[2] ?? '22'}, ${alpha})`;
}

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(255, 255, 255, ${alpha})`;
}

function formatInteger(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString('zh-CN');
}
