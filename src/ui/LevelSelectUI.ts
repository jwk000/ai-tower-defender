import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from './LayoutManager.js';
import { FONTS, getFont } from '../config/fonts.js';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';
import { Sound } from '../utils/Sound.js';

/** Level select button layout */
interface LevelButton {
  x: number;
  y: number;
  w: number;
  h: number;
  levelId: number;
  name: string;
  theme: string;
  waves: number;
  locked: boolean;
  stars: number;
  /** v6.0: 通关次数 */
  timesCleared: number;
  /** v6.0: 过关界面 summary（来自 LevelCompletionState） */
  summary: string;
  /** 关卡 YAML description（未通关时展示） */
  description: string;
}

interface ThemeBackground {
  id: string;
  title: string;
  subtitle: string;
  top: string;
  mid: string;
  bottom: string;
  accent: string;
  accent2: string;
  text: string;
}

const THEME_BACKGROUNDS: Record<string, ThemeBackground> = {
  plains: {
    id: 'plains',
    title: '绿野仙踪',
    subtitle: '藤蔓、远山与萤光环绕的起始森林',
    top: '#143824',
    mid: '#2f6f3a',
    bottom: '#10261a',
    accent: '#9bd66f',
    accent2: '#f6e27a',
    text: '#e7ffd8',
  },
  desert: {
    id: 'desert',
    title: '沙漠虫潮',
    subtitle: '沙丘热浪下，虫群从地平线涌来',
    top: '#4b2d18',
    mid: '#c58d3d',
    bottom: '#2d1c14',
    accent: '#ffd166',
    accent2: '#5c341d',
    text: '#fff1c2',
  },
  castle: {
    id: 'castle',
    title: '黑暗古堡',
    subtitle: '残月照亮古堡轮廓，雾气和蝙蝠掠过夜空',
    top: '#111827',
    mid: '#2f3a56',
    bottom: '#090d16',
    accent: '#b7c9ff',
    accent2: '#7b879f',
    text: '#e4ecff',
  },
  wasteland: {
    id: 'wasteland',
    title: '末日废土',
    subtitle: '焦黑残骸、红色余烬和断裂地平线',
    top: '#2b1814',
    mid: '#653329',
    bottom: '#130f0e',
    accent: '#ff7043',
    accent2: '#9aa0a6',
    text: '#ffe0d2',
  },
  abyss: {
    id: 'abyss',
    title: '深渊裂隙',
    subtitle: '紫色裂隙、漂浮碎石和不稳定能量',
    top: '#120024',
    mid: '#38105f',
    bottom: '#05000d',
    accent: '#c77dff',
    accent2: '#ffd166',
    text: '#f3ddff',
  },
};

function themeFor(theme: string): ThemeBackground {
  const fallback = THEME_BACKGROUNDS.plains;
  if (!fallback) throw new Error('Missing plains level select background');
  return THEME_BACKGROUNDS[theme] ?? fallback;
}

const BACKGROUND_BASE_W = 1920;
const BACKGROUND_BASE_H = 1080;

/** LevelSelectUI — renders level selection menu and handles clicks */
export class LevelSelectUI {
  private buttons: LevelButton[] = [];
  private selectedLevelId = 1;
  private animationTime = 0;
  /** 图鉴按钮区域 */
  private encyclopediaBtn: { x: number; y: number; w: number; h: number } | null = null;

  /** v6.0: 刚通关的关卡ID（用于脉冲动画） */
  private justCompletedLevelId: number = 0;
  /** v6.0: 脉冲动画计时器 */
  private pulseTimer: number = 0;

  constructor(
    private renderer: Renderer,
    private onStartLevel: (levelId: number) => void,
    private onOpenEncyclopedia?: () => void,
  ) {
    this.buildButtons();
  }

  /** Rebuild button layout (call after save data changes).
   *  v6.0: 可传入刚通关的关卡ID以触发脉冲动画 */
  refresh(justCompletedLevelId?: number): void {
    this.justCompletedLevelId = justCompletedLevelId ?? 0;
    this.pulseTimer = 0;
    this.buildButtons();
  }

  getSelectedLevelId(): number {
    return this.selectedLevelId;
  }

  getLevelButtonBounds(levelId: number): { x: number; y: number; w: number; h: number } | null {
    const btn = this.buttons.find((b) => b.levelId === levelId);
    return btn ? { x: btn.x, y: btn.y, w: btn.w, h: btn.h } : null;
  }

  /** Build level buttons with unlock/star status */
  private buildButtons(): void {
    const save = SaveManager.load();
    const unlockedLevels = save.unlockedLevels;
    const levelStars = save.levelStars;
    const levelCompletion = save.levelCompletion;

    this.buttons = [];

    const BTN_W = 288;
    const BTN_H = 128;
    const BTN_GAP = 18;
    const TOTAL_W = LEVELS.length * BTN_W + (LEVELS.length - 1) * BTN_GAP;
    const START_X = (LayoutManager.DESIGN_W - TOTAL_W) / 2;
    const START_Y = 812;

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i]!;
      const levelId = i + 1;
      const isLocked = levelId > unlockedLevels;
      const completion = levelCompletion[levelId];

      this.buttons.push({
        x: START_X + i * (BTN_W + BTN_GAP),
        y: START_Y,
        w: BTN_W,
        h: BTN_H,
        levelId,
        name: level.name,
        theme: level.theme,
        waves: level.waves.length,
        locked: isLocked,
        stars: completion?.bestStars ?? levelStars[levelId] ?? 0,
        timesCleared: completion?.timesCleared ?? 0,
        summary: completion?.summary ?? '',
        description: level.description ?? '',
      });
    }

    const selected = this.buttons.find((b) => b.levelId === this.selectedLevelId && !b.locked);
    if (!selected) {
      const firstUnlocked = this.buttons.find((b) => !b.locked);
      this.selectedLevelId = firstUnlocked?.levelId ?? 1;
    }
  }

  /** Render the level select UI */
  update(dt: number): void {
    this.animationTime += dt;
    if (this.justCompletedLevelId > 0 && this.pulseTimer < 2.0) {
      this.pulseTimer += dt;
    }
    const ctx = this.renderer.context;
    const selected = this.getSelectedButton();
    const theme = themeFor(selected?.theme ?? 'plains');

    this.drawThemeBackground(theme);
    this.renderer.applyDesignTransform();

    // Title
    ctx.save();
    ctx.fillStyle = theme.text;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 20;
    ctx.font = FONTS.title;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tower Defender', LayoutManager.DESIGN_W / 2, 118);
    ctx.restore();

    // Subtitle
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = getFont(24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('选择关卡', LayoutManager.DESIGN_W / 2, 178);
    ctx.restore();

    this.drawSelectedLevelPanel(theme, selected);

    // Encyclopedia button (top-right)
    if (this.onOpenEncyclopedia) {
      const encBtnW = 140;
      const encBtnH = 42;
      const encBtnX = LayoutManager.DESIGN_W - encBtnW - 30;
      const encBtnY = 180;
      this.encyclopediaBtn = { x: encBtnX, y: encBtnY, w: encBtnW, h: encBtnH };

      ctx.save();
      ctx.fillStyle = 'rgba(10,16,24,0.68)';
      ctx.strokeStyle = 'rgba(255,255,255,0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(encBtnX, encBtnY, encBtnW, encBtnH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = getFont(16, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📖 卡牌图鉴', encBtnX + encBtnW / 2, encBtnY + encBtnH / 2);
      ctx.restore();
    }

    // Level buttons
    for (const btn of this.buttons) {
      this.drawLevelButton(btn, theme);
    }
  }

  private getSelectedButton(): LevelButton | undefined {
    return this.buttons.find((btn) => btn.levelId === this.selectedLevelId);
  }

  private drawThemeBackground(theme: ThemeBackground): void {
    const ctx = this.renderer.context;
    const w = LayoutManager.viewportW;
    const h = LayoutManager.viewportH;
    const t = this.animationTime;

    this.renderer.resetTransform();
    ctx.save();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, theme.top);
    gradient.addColorStop(0.52, theme.mid);
    gradient.addColorStop(1, theme.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    const scale = Math.max(w / BACKGROUND_BASE_W, h / BACKGROUND_BASE_H);
    const offsetX = (w - BACKGROUND_BASE_W * scale) / 2;
    const offsetY = (h - BACKGROUND_BASE_H * scale) / 2;
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    switch (theme.id) {
      case 'desert':
        this.drawDesertBackground(theme, t);
        break;
      case 'castle':
        this.drawCastleBackground(theme, t);
        break;
      case 'wasteland':
        this.drawWastelandBackground(theme, t);
        break;
      case 'abyss':
        this.drawAbyssBackground(theme, t);
        break;
      case 'plains':
      default:
        this.drawPlainsBackground(theme, t);
        break;
    }

    this.drawBackgroundVignette();
    ctx.restore();
  }

  private drawPlainsBackground(theme: ThemeBackground, t: number): void {
    const ctx = this.renderer.context;
    this.drawLayeredHills(['#1f5c35', '#174226', '#102d1c'], [540, 640, 735], t);
    ctx.save();
    for (let i = 0; i < 26; i++) {
      const x = (i * 149 + Math.sin(t * 0.35 + i) * 18) % 2040 - 60;
      const y = 260 + ((i * 73) % 430) + Math.sin(t * 1.4 + i) * 8;
      const r = 2 + (i % 4);
      ctx.fillStyle = i % 3 === 0 ? theme.accent2 : theme.accent;
      ctx.globalAlpha = 0.28 + 0.22 * Math.sin(t * 1.8 + i);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#83c46a';
    ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const baseX = 120 + i * 430;
      ctx.beginPath();
      ctx.moveTo(baseX, 900);
      ctx.bezierCurveTo(baseX + 80, 720, baseX - 70, 560, baseX + 110, 390 + Math.sin(t + i) * 22);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawDesertBackground(theme: ThemeBackground, t: number): void {
    const ctx = this.renderer.context;
    this.drawLayeredHills(['#d9a14a', '#9f6f31', '#53301b'], [610, 725, 850], -t * 0.25);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,232,166,0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = 270 + i * 42;
      ctx.beginPath();
      for (let x = -40; x <= 1980; x += 80) {
        const waveY = y + Math.sin(x * 0.012 + t * 1.7 + i) * 8;
        if (x === -40) ctx.moveTo(x, waveY); else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }
    ctx.fillStyle = theme.accent2;
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < 6; i++) {
      const x = 170 + i * 315;
      const y = 710 + (i % 2) * 70;
      ctx.fillRect(x - 8, y - 70, 16, 70);
      ctx.fillRect(x - 38, y - 42, 30, 12);
      ctx.fillRect(x + 8, y - 30, 34, 12);
    }
    ctx.fillStyle = '#24140d';
    ctx.globalAlpha = 0.34;
    for (let i = 0; i < 18; i++) {
      const x = (i * 111 + t * 36) % 2000 - 40;
      const y = 580 + Math.sin(i) * 80;
      ctx.beginPath();
      ctx.ellipse(x, y, 15, 5, Math.sin(i), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawCastleBackground(theme: ThemeBackground, t: number): void {
    const ctx = this.renderer.context;
    ctx.save();
    ctx.fillStyle = 'rgba(235,242,255,0.72)';
    ctx.beginPath();
    ctx.arc(1530, 210, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.top;
    ctx.beginPath();
    ctx.arc(1560, 188, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#11141f';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(620, 472, 680, 270);
    for (let i = 0; i < 6; i++) {
      const x = 650 + i * 118;
      ctx.fillRect(x, 382 + (i % 2) * 30, 74, 360);
      ctx.beginPath();
      ctx.moveTo(x - 8, 390 + (i % 2) * 30);
      ctx.lineTo(x + 37, 326 + (i % 2) * 30);
      ctx.lineTo(x + 82, 390 + (i % 2) * 30);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = theme.accent;
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(690 + i * 55, 500 + (i % 3) * 42, 18, 34);
    }
    ctx.strokeStyle = 'rgba(220,230,255,0.16)';
    ctx.lineWidth = 26;
    for (let i = 0; i < 4; i++) {
      const y = 660 + i * 42 + Math.sin(t * 0.45 + i) * 12;
      ctx.beginPath();
      ctx.moveTo(-80, y);
      ctx.bezierCurveTo(420, y - 70, 910, y + 50, 2000, y - 28);
      ctx.stroke();
    }
    ctx.fillStyle = '#05070d';
    ctx.globalAlpha = 0.76;
    for (let i = 0; i < 9; i++) {
      const x = (i * 210 + t * (36 + i * 3)) % 2050 - 80;
      const y = 210 + (i * 67) % 260 + Math.sin(t * 2 + i) * 12;
      this.drawBat(ctx, x, y, 18 + (i % 3) * 5);
    }
    ctx.restore();
  }

  private drawWastelandBackground(theme: ThemeBackground, t: number): void {
    const ctx = this.renderer.context;
    this.drawLayeredHills(['#4b2b24', '#2b1b18', '#151111'], [610, 720, 835], t * 0.12);
    ctx.save();
    ctx.fillStyle = 'rgba(20,18,16,0.88)';
    for (let i = 0; i < 8; i++) {
      const x = 110 + i * 250;
      const y = 650 + (i % 3) * 48;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i % 2 === 0 ? -1 : 1) * 0.16);
      ctx.fillRect(-50, -20, 104, 36);
      ctx.fillRect(-24, -42, 44, 22);
      ctx.beginPath();
      ctx.arc(-30, 20, 14, 0, Math.PI * 2);
      ctx.arc(34, 20, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,104,58,0.34)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 7; i++) {
      const x = 150 + i * 260;
      ctx.beginPath();
      ctx.moveTo(x, 785);
      ctx.lineTo(x + 80 + Math.sin(t + i) * 20, 540 + (i % 2) * 60);
      ctx.stroke();
    }
    for (let i = 0; i < 30; i++) {
      const x = (i * 97 + Math.sin(t * 0.7 + i) * 30) % 2000 - 40;
      const y = 330 + ((i * 53) % 480) - (t * (18 + i % 5) % 120);
      ctx.fillStyle = i % 4 === 0 ? theme.accent : '#6f7478';
      ctx.globalAlpha = 0.18 + (i % 5) * 0.045;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAbyssBackground(theme: ThemeBackground, t: number): void {
    const ctx = this.renderer.context;
    ctx.save();
    const cx = BACKGROUND_BASE_W / 2;
    const pulse = 0.55 + Math.sin(t * 1.6) * 0.12;
    const glow = ctx.createRadialGradient(cx, 560, 20, cx, 560, 560);
    glow.addColorStop(0, `rgba(199,125,255,${pulse})`);
    glow.addColorStop(0.45, 'rgba(83,23,132,0.34)');
    glow.addColorStop(1, 'rgba(6,0,12,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, BACKGROUND_BASE_W, BACKGROUND_BASE_H);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.78;
    ctx.beginPath();
    ctx.moveTo(cx - 55, 220);
    ctx.lineTo(cx + 35 + Math.sin(t) * 22, 430);
    ctx.lineTo(cx - 25 + Math.cos(t * 1.3) * 26, 650);
    ctx.lineTo(cx + 70, 900);
    ctx.stroke();

    for (let i = 0; i < 16; i++) {
      const angle = i * 0.9 + t * 0.18;
      const radius = 150 + (i % 5) * 76;
      const x = cx + Math.cos(angle) * radius;
      const y = 545 + Math.sin(angle * 1.2) * 250;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = i % 3 === 0 ? theme.accent2 : '#2c1847';
      ctx.globalAlpha = 0.34 + (i % 4) * 0.08;
      ctx.fillRect(-22, -14, 44, 28);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    for (let i = 0; i < 36; i++) {
      const x = (i * 131 + Math.sin(t + i) * 60) % BACKGROUND_BASE_W;
      const y = 210 + ((i * 47) % 660);
      ctx.globalAlpha = 0.12 + 0.18 * Math.sin(t * 1.5 + i);
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLayeredHills(colors: string[], baselines: number[], t: number): void {
    const ctx = this.renderer.context;
    ctx.save();
    for (let layer = 0; layer < colors.length; layer++) {
      const base = baselines[layer] ?? 700;
      ctx.fillStyle = colors[layer]!;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(0, BACKGROUND_BASE_H);
      for (let x = 0; x <= BACKGROUND_BASE_W; x += 96) {
        const y = base + Math.sin(x * 0.006 + t + layer) * (34 + layer * 12);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(BACKGROUND_BASE_W, BACKGROUND_BASE_H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawBat(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const flap = Math.sin(this.animationTime * 6 + x * 0.01) * size * 0.22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - size * 0.7, y - size * 0.45 - flap, x - size, y);
    ctx.quadraticCurveTo(x - size * 0.42, y - size * 0.1, x, y);
    ctx.quadraticCurveTo(x + size * 0.42, y - size * 0.1, x + size, y);
    ctx.quadraticCurveTo(x + size * 0.7, y - size * 0.45 + flap, x, y);
    ctx.fill();
  }

  private drawBackgroundVignette(): void {
    const ctx = this.renderer.context;
    ctx.save();
    const gradient = ctx.createRadialGradient(960, 500, 260, 960, 520, 980);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.72, 'rgba(0,0,0,0.22)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BACKGROUND_BASE_W, BACKGROUND_BASE_H);
    ctx.restore();
  }

  private drawSelectedLevelPanel(theme: ThemeBackground, btn: LevelButton | undefined): void {
    if (!btn) return;
    const ctx = this.renderer.context;
    const panelX = 432;
    const panelY = 250;
    const panelW = 1056;
    const panelH = 390;
    const shimmer = Math.sin(this.animationTime * 1.5) * 0.08 + 0.16;

    ctx.save();
    ctx.fillStyle = 'rgba(9,14,22,0.50)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.fill();
    ctx.globalAlpha = 0.72;
    ctx.stroke();

    ctx.globalAlpha = shimmer;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.roundRect(panelX + 18, panelY + 18, panelW - 36, panelH - 36, 14);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.text;
    ctx.font = getFont(52, true);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(btn.name, panelX + 64, panelY + 62);

    ctx.fillStyle = 'rgba(255,255,255,0.74)';
    ctx.font = getFont(22);
    // v6.0: 已通关关卡显示 summary，否则显示 subtitle
    const displayText = btn.timesCleared > 0 && btn.summary ? btn.summary : theme.subtitle;
    ctx.fillText(displayText, panelX + 68, panelY + 140);

    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = getFont(18, true);
    const detailParts = [`${btn.theme.toUpperCase()} · ${btn.waves} WAVES`];
    if (btn.timesCleared > 0) {
      detailParts.push(`已通关 ×${btn.timesCleared}`);
    }
    ctx.fillText(detailParts.join('  |  '), panelX + 68, panelY + 204);

    ctx.fillStyle = btn.locked ? '#ff8a80' : theme.accent;
    ctx.font = getFont(24, true);
    const actionText = btn.locked ? 'LOCKED' : btn.timesCleared > 0 ? 'REPLAY' : 'CLICK TO START';
    ctx.fillText(actionText, panelX + 68, panelY + 272);

    ctx.textAlign = 'right';
    ctx.font = getFont(20, true);
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.fillText(`LEVEL ${btn.levelId}`, panelX + panelW - 64, panelY + 64);
    ctx.restore();
  }

  /** Draw a single level button */
  private drawLevelButton(btn: LevelButton, theme: ThemeBackground): void {
    const ctx = this.renderer.context;
    const selected = btn.levelId === this.selectedLevelId;
    const isJustCompleted = btn.levelId === this.justCompletedLevelId && this.pulseTimer < 2.0;
    const scale = selected ? 1.08 : 1;
    const w = btn.w * scale;
    const h = btn.h * scale;
    const x = btn.x + (btn.w - w) / 2;
    const y = btn.y + (btn.h - h) / 2;

    // Pulse animation for just-completed level
    let pulseBlur = 0;
    let pulseColor = theme.accent;
    if (isJustCompleted) {
      const pulsePhase = this.pulseTimer % 0.6;
      const pulseVal = pulsePhase < 0.3
        ? pulsePhase / 0.3
        : 1 - (pulsePhase - 0.3) / 0.3;
      pulseBlur = pulseVal * 30;
    }

    // Button background
    ctx.save();
    ctx.fillStyle = btn.locked ? 'rgba(22,24,34,0.64)' : 'rgba(12,18,28,0.74)';
    ctx.strokeStyle = btn.locked ? 'rgba(110,116,136,0.36)' : selected ? theme.accent : 'rgba(255,255,255,0.28)';
    ctx.lineWidth = selected ? 4 : 2;
    ctx.shadowColor = isJustCompleted ? pulseColor : (selected ? theme.accent : 'transparent');
    ctx.shadowBlur = pulseBlur > 0 ? pulseBlur : (selected ? 20 : 0);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = btn.locked ? 0.16 : selected ? 0.28 : 0.14;
    ctx.fillStyle = selected ? theme.accent : '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, w - 20, 10, 5);
    ctx.fill();
    ctx.restore();

    // Level name
    ctx.save();
    ctx.fillStyle = btn.locked ? '#70758d' : selected ? theme.text : '#ffffff';
    ctx.font = getFont(selected ? 22 : 20, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.name, btn.x + btn.w / 2, btn.y + 36);
    ctx.restore();

    // v6.0: 已完成关卡显示 summary（一行短文本）取代原 theme · waves
    if (btn.timesCleared > 0 && btn.summary) {
      ctx.save();
      ctx.fillStyle = btn.locked ? '#5f647b' : selected ? 'rgba(255,255,255,0.86)' : '#b9c0d8';
      ctx.font = getFont(13);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const clippedSummary = btn.summary.length > 18 ? btn.summary.slice(0, 15) + '…' : btn.summary;
      ctx.fillText(clippedSummary, btn.x + btn.w / 2, btn.y + 64);
      ctx.restore();
    } else {
      // 未通关 → 显示 YAML description
      ctx.save();
      ctx.fillStyle = btn.locked ? '#5f647b' : selected ? 'rgba(255,255,255,0.86)' : '#b9c0d8';
      ctx.font = getFont(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const clipped = btn.description.length > 16 ? btn.description.slice(0, 13) + '…' : btn.description;
      ctx.fillText(clipped, btn.x + btn.w / 2, btn.y + 68);
      ctx.restore();
    }

    // Stars or lock icon
    if (btn.locked) {
      ctx.save();
      ctx.fillStyle = '#ff6666';
      ctx.font = getFont(24, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', btn.x + btn.w / 2, btn.y + 95);
      ctx.restore();
    } else if (btn.stars > 0) {
      ctx.save();
      ctx.fillStyle = '#ffcc00';
      ctx.font = getFont(20, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const starsText = '⭐'.repeat(btn.stars);
      // 通关次数标签
      const clearedLabel = btn.timesCleared > 1 ? ` ×${btn.timesCleared}` : '';
      ctx.fillText(starsText + clearedLabel, btn.x + btn.w / 2, btn.y + 92);
      ctx.restore();
    }
  }

  /** Handle click at (x, y) in design space */
  handleClick(x: number, y: number): void {
    // Encyclopedia button
    if (this.encyclopediaBtn) {
      const eb = this.encyclopediaBtn;
      if (x >= eb.x && x <= eb.x + eb.w && y >= eb.y && y <= eb.y + eb.h) {
        Sound.play('ui_click');
        this.onOpenEncyclopedia?.();
        return;
      }
    }

    for (const btn of this.buttons) {
      if (btn.locked) continue;
      if (this.isInsideButton(btn, x, y)) {
        Sound.play('ui_click');
        this.selectedLevelId = btn.levelId;
        this.onStartLevel(btn.levelId);
        return;
      }
    }
  }

  handleMouseMove(x: number, y: number): void {
    for (const btn of this.buttons) {
      if (btn.locked) continue;
      if (this.isInsideButton(btn, x, y)) {
        this.selectedLevelId = btn.levelId;
        return;
      }
    }
  }

  private isInsideButton(btn: LevelButton, x: number, y: number): boolean {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
  }
}
