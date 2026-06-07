// ============================================================
// VictoryScreenSystem — 过关覆盖层（3阶段动画序列）
//
// Phase 1 (0 ~ 1.5s): "VICTORY" 大字弹出 + 屏幕震动
// Phase 2 (1.5 ~ 4.5s): 彩带飘落 + 星星评定逐个闪烁
// Phase 3 (4.5s+): 故事面板滑入 + "继续"按钮
//
// 设计文档: design/05-presentation.md §10, design/04-levels.md §9
// P0-2: 补充 VICTORY 大字 + 屏幕震动 + 3阶段动画
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { getFont } from '../config/fonts.js';
import type { VictoryConfig, VictoryStory } from '../types/index.js';

// ============================================================
// Constants
// ============================================================

const OVERLAY_ALPHA = 0.65;
const STAR_SIZE = 48;
const STAR_SPACING = 60;

// Phase timing
const PHASE1_DURATION = 1.5;  // VICTORY pop-in
const PHASE2_DURATION = 3.0;  // confetti + stars
// Phase 3 starts at PHASE1 + PHASE2, runs until player clicks

// ============================================================
// Confetti types
// ============================================================

type ConfettiShape = 'ribbon' | 'petal' | 'sparkle' | 'fragment';

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

enum VictoryPhase {
  Phase1 = 1,
  Phase2 = 2,
  Phase3 = 3,
}

// ============================================================
// System
// ============================================================

export class VictoryScreenSystem implements System {
  readonly name = 'VictoryScreenSystem';

  private renderer: Renderer;
  private active: boolean = false;
  private mode: 'victory' | 'defeat' = 'victory';
  private config: VictoryConfig | null = null;
  private timesCleared: number = 0;
  private stars: number = 1;
  private defeatStory: VictoryStory | null = null;

  /** 当前动画阶段 */
  private phase: VictoryPhase = VictoryPhase.Phase1;
  /** 激活后的累计时间 */
  private elapsed: number = 0;
  /** 阶段内计时（从进入当前阶段开始） */
  private phaseElapsed: number = 0;

  /** 彩带粒子 */
  private particles: ConfettiParticle[] = [];
  private confettiSpawned: boolean = false;

  /** "继续"按钮可交互标记 */
  private continueButtonVisible: boolean = false;
  private continueBtnRect: { x: number; y: number; w: number; h: number } | null = null;

  /** VICTORY 文字弹出的弹性缓动状态 */
  private victoryTextScale: number = 3.0;
  private victoryTextAlpha: number = 0;

  /** 星星闪烁状态：每颗星的亮度 (0=未亮, 1=全亮) */
  private starBrightness: number[] = [0, 0, 0];
  /** 星星逐个点亮时的计时 */
  private starRevealTimer: number = 0;
  private starsRevealed: number = 0;

  /** 故事面板滑动偏移 */
  private panelSlideOffset: number = 300;

  /** 完成回调 */
  onComplete?: () => void;
  onContinue?: () => void;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  // ============================================================
  // System interface
  // ============================================================

  update(_world: TowerWorld, dt: number): void {
    if (!this.active) return;

    this.elapsed += dt;
    this.phaseElapsed += dt;

    this.updatePhaseTransitions();
    this.updateParticles(dt);
    this.updateAnimations(dt);
  }

  private updatePhaseTransitions(): void {
    if (this.mode !== 'victory') return;

    switch (this.phase) {
      case VictoryPhase.Phase1:
        if (this.phaseElapsed >= PHASE1_DURATION) {
          this.phase = VictoryPhase.Phase2;
          this.phaseElapsed = 0;
          this.ensureConfettiSpawned();
        }
        break;
      case VictoryPhase.Phase2:
        if (this.phaseElapsed >= PHASE2_DURATION) {
          this.phase = VictoryPhase.Phase3;
          this.phaseElapsed = 0;
        }
        break;
      case VictoryPhase.Phase3:
        if (this.phaseElapsed >= 0.5 && !this.continueButtonVisible) {
          this.continueButtonVisible = true;
        }
        break;
    }
  }

  private updateAnimations(dt: number): void {
    if (this.mode !== 'victory') return;

    // Phase 1: VICTORY text elastic pop-in
    if (this.phase === VictoryPhase.Phase1) {
      const t = this.phaseElapsed / PHASE1_DURATION;
      // Elastic ease-out: overshoot then settle
      if (t < 0.8) {
        const p = t / 0.8;
        this.victoryTextScale = 3.0 + (1.0 - 3.0) * elasticOut(p);
        this.victoryTextAlpha = Math.min(1, p * 1.2);
      } else {
        this.victoryTextScale = 1.0;
        this.victoryTextAlpha = 1.0;
      }
    }

    // Phase 2: stars reveal one by one
    if (this.phase === VictoryPhase.Phase2) {
      this.starRevealTimer += dt;
      const revealInterval = 0.5; // each star 0.5s apart
      while (
        this.starsRevealed < 3 &&
        this.starRevealTimer >= this.starsRevealed * revealInterval
      ) {
        this.starBrightness[this.starsRevealed] = 1.0;
        this.starsRevealed++;
      }
    }

    // Phase 3: panel slide in
    if (this.phase === VictoryPhase.Phase3) {
      const slideDuration = 0.5;
      const t = Math.min(1, this.phaseElapsed / slideDuration);
      this.panelSlideOffset = 300 * (1 - easeOutCubic(t));
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  activate(config: VictoryConfig, stars: number, timesCleared: number): void {
    this.mode = 'victory';
    this.config = config;
    this.stars = stars;
    this.timesCleared = timesCleared;
    this.active = true;
    this.elapsed = 0;
    this.phaseElapsed = 0;
    this.phase = VictoryPhase.Phase1;
    this.particles = [];
    this.confettiSpawned = false;
    this.continueButtonVisible = false;
    this.continueBtnRect = null;
    this.defeatStory = null;

    // Reset animation state
    this.victoryTextScale = 3.0;
    this.victoryTextAlpha = 0;
    this.starBrightness = [0, 0, 0];
    this.starRevealTimer = 0;
    this.starsRevealed = 0;
    this.panelSlideOffset = 300;
  }

  activateDefeat(defeatStory: VictoryStory, typography: VictoryConfig['typography']): void {
    this.mode = 'defeat';
    this.defeatStory = defeatStory;
    this.active = true;
    this.elapsed = 0;
    this.phaseElapsed = 0;
    this.phase = VictoryPhase.Phase3;
    this.particles = [];
    this.confettiSpawned = true;
    this.continueButtonVisible = false;
    this.continueBtnRect = null;
    this.timesCleared = 0;
    this.stars = 0;
    this.config = {
      story: { title: '', paragraphs: [], summary: '', showFullStoryOnlyFirst: false },
      background: { filter: 'gray_tint', gradient: { top: '', mid: '', bottom: '' }, particles: [] },
      confetti: { count: 0, burst: 'top_fall', colors: [], shapes: {}, duration: 0, spread: 0 },
      audio: { bgm: '', sfx: '' },
      typography,
    };

    // Show continue button after brief delay
    this.continueButtonVisible = false;
    this.panelSlideOffset = 0;
  }

  deactivate(): void {
    this.active = false;
    this.config = null;
    this.particles = [];
  }

  isActive(): boolean { return this.active; }

  handleClick(x: number, y: number): boolean {
    if (!this.active) return false;

    if (this.continueButtonVisible) {
      const btn = this.continueBtnRect;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.onContinueClick();
        return true;
      }
    }

    if (this.shouldSkipStory()) {
      this.onContinueClick();
      return true;
    }

    return false;
  }

  // ============================================================
  // Internal
  // ============================================================

  private shouldSkipStory(): boolean {
    if (!this.config) return false;
    return this.config.story.showFullStoryOnlyFirst && this.timesCleared > 1;
  }

  private onContinueClick(): void {
    this.onContinue?.();
    this.active = false;
    this.config = null;
    this.particles = [];
    this.onComplete?.();
  }

  // ============================================================
  // Confetti
  // ============================================================

  private ensureConfettiSpawned(): void {
    if (this.confettiSpawned) return;
    this.confettiSpawned = true;
    this.spawnConfetti();
  }

  private spawnConfetti(): void {
    const cfg = this.config?.confetti;
    if (!cfg) return;

    const count = cfg.count;
    const burst = cfg.burst;
    const colors = cfg.colors;
    const shapes = cfg.shapes;
    const spread = cfg.spread;

    const designW = LayoutManager.DESIGN_W;
    const designH = LayoutManager.DESIGN_H;

    const shapeEntries: ConfettiShape[] = [];
    for (const [shape, weight] of Object.entries(shapes) as [ConfettiShape, number][]) {
      for (let i = 0; i < Math.round(weight * 100); i++) {
        shapeEntries.push(shape);
      }
    }
    if (shapeEntries.length === 0) shapeEntries.push('ribbon');

    for (let i = 0; i < count; i++) {
      const colorGroup = colors[i % colors.length]!;
      const color = colorGroup[Math.floor(Math.random() * colorGroup.length)]!;
      const shape = shapeEntries[Math.floor(Math.random() * shapeEntries.length)]!;

      let x: number, y: number, vx: number, vy: number;
      const spdRange = spread * designW;

      switch (burst) {
        case 'bottom_rise':
          x = designW * 0.1 + Math.random() * designW * 0.8;
          y = designH + 20;
          vx = (Math.random() - 0.5) * spdRange * 0.4;
          vy = -150 - Math.random() * 80;
          break;
        case 'explosion_center':
          x = designW / 2;
          y = designH / 2;
          {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            vx = Math.cos(angle) * speed;
            vy = Math.sin(angle) * speed;
          }
          break;
        case 'both_sides':
          if (Math.random() < 0.5) {
            x = -30;
            vx = 100 + Math.random() * 150;
          } else {
            x = designW + 30;
            vx = -100 - Math.random() * 150;
          }
          y = designH * 0.2 + Math.random() * designH * 0.6;
          vy = (Math.random() - 0.5) * 60;
          break;
        case 'top_fall':
        default:
          x = designW * 0.1 + Math.random() * designW * 0.8;
          y = -30;
          vx = (Math.random() - 0.5) * spread * 300;
          vy = 80 + Math.random() * 120;
          break;
      }

      this.particles.push({
        x, y, vx, vy,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        width: shape === 'fragment' ? 4 + Math.random() * 6 : 3,
        height: shape === 'fragment' ? 4 + Math.random() * 6 : 8 + Math.random() * 6,
        color,
        alpha: 1,
        life: 0,
        maxLife: cfg.duration + Math.random() * 1.0,
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

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // ============================================================
  // Render
  // ============================================================

  public render(): void {
    if (!this.active) return;
    const ctx = this.renderer.context;
    if (!ctx) return;

    const designW = LayoutManager.DESIGN_W;
    const designH = LayoutManager.DESIGN_H;

    if (this.mode === 'victory') {
      if (!this.config) return;
      this.renderVictory(ctx, designW, designH);
    } else {
      this.renderDefeat(ctx, designW, designH);
    }
  }

  private renderVictory(ctx: CanvasRenderingContext2D, designW: number, designH: number): void {
    const config = this.config!;

    // 暗色遮罩
    this.renderer.resetTransform();
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_ALPHA})`;
    ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    ctx.restore();

    this.renderer.applyDesignTransform();

    // Phase 1: VICTORY 大字 + 屏幕震动（震动由 main.ts 在 activate 时触发）
    if (this.phase === VictoryPhase.Phase1) {
      this.drawVictoryText(designW / 2, designH * 0.33);
    }

    // Phase 2+: 彩带
    if (this.phase >= VictoryPhase.Phase2) {
      this.drawConfettiParticles();
    }

    // Phase 2+: 星星（在 phase 2 中逐个点亮）
    if (this.phase >= VictoryPhase.Phase2) {
      this.drawStars(designW / 2, designH * 0.33);
    }

    // Phase 3: 故事面板
    if (this.phase >= VictoryPhase.Phase3) {
      this.drawStoryPanel(config, designW / 2, designH * 0.68);
    }
  }

  private renderDefeat(ctx: CanvasRenderingContext2D, designW: number, designH: number): void {
    const config = this.config!;

    // 暗红色遮罩
    this.renderer.resetTransform();
    ctx.save();
    ctx.fillStyle = `rgba(40, 10, 10, ${OVERLAY_ALPHA + 0.1})`;
    ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    ctx.restore();

    this.renderer.applyDesignTransform();

    // 失败标题
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.elapsed * 3);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = `bold 48px ${getFont(48, true)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 16;
    ctx.fillText('DEFEAT', designW / 2, designH * 0.22);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 失败故事
    if (this.defeatStory) {
      const storyConfig: VictoryConfig = {
        ...config,
        story: this.defeatStory,
      };
      this.drawStoryPanel(storyConfig, designW / 2, designH * 0.62);
    }
  }

  // ============================================================
  // Draw helpers
  // ============================================================

  private drawVictoryText(cx: number, cy: number): void {
    const ctx = this.renderer.context;
    const config = this.config;
    if (!ctx || !config) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 光晕
    ctx.shadowColor = config.typography.accentColor;
    ctx.shadowBlur = 30 * this.victoryTextAlpha;

    // 文字
    const baseSize = 96;
    const scale = this.victoryTextScale;
    ctx.font = `bold ${Math.round(baseSize * scale)}px ${getFont(Math.round(baseSize * scale), true)}`;

    // 渐变填充
    const gradient = ctx.createLinearGradient(cx, cy - 50, cx, cy + 50);
    const titleColors = config.typography.titleColor;
    gradient.addColorStop(0, titleColors[0] ?? '#ffd700');
    gradient.addColorStop(1, titleColors[1] ?? '#ffffff');
    ctx.fillStyle = gradient;

    ctx.globalAlpha = this.victoryTextAlpha;
    ctx.fillText('VICTORY', cx, cy);

    ctx.restore();
  }

  private drawStars(cx: number, cy: number): void {
    const ctx = this.renderer.context;
    if (!ctx) return;

    const brightColor = '#ffcc00';
    const dimColor = '#555555';

    ctx.save();
    ctx.font = `${STAR_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * STAR_SPACING;
      const lit = i < this.stars;
      const brightness = lit ? (this.starBrightness[i] ?? 0) : 0;

      if (brightness <= 0) {
        ctx.fillStyle = dimColor;
        ctx.fillText('☆', x, cy);
      } else {
        ctx.globalAlpha = brightness;
        ctx.fillStyle = brightColor;
        ctx.fillText('⭐', x, cy);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  private drawConfettiParticles(): void {
    const ctx = this.renderer.context;
    if (!ctx) return;

    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      switch (p.shape) {
        case 'ribbon':
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          break;
        case 'petal': {
          ctx.beginPath();
          ctx.ellipse(0, 0, p.width, p.height, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'sparkle': {
          const r = p.width;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = p.alpha * 0.4;
          ctx.beginPath();
          ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fragment': {
          ctx.beginPath();
          ctx.moveTo(0, -p.height / 2);
          ctx.lineTo(p.width * 0.7, 0);
          ctx.lineTo(p.width * 0.2, p.height / 2);
          ctx.lineTo(-p.width * 0.5, p.height * 0.3);
          ctx.closePath();
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }
    ctx.restore();
  }

  private drawStoryPanel(config: VictoryConfig, cx: number, cy: number): void {
    const ctx = this.renderer.context;
    if (!ctx) return;

    const shouldSkip = this.shouldSkipStory();

    const panelW = 900;
    const panelH = shouldSkip ? 90 : 240;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2 + this.panelSlideOffset;

    ctx.save();

    // 面板背景
    ctx.fillStyle = config.typography.panelBg;
    ctx.strokeStyle = config.typography.panelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 12);
    ctx.fill();
    ctx.stroke();

    if (shouldSkip) {
      ctx.fillStyle = config.typography.storyColor;
      ctx.font = `18px ${getFont(18)}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.story.summary, cx, py + panelH / 2, panelW - 80);
    } else {
      // 标题
      ctx.fillStyle = config.typography.accentColor;
      ctx.font = `bold 24px ${getFont(24, true)}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(config.story.title, px + 40, py + 18);

      // 分隔线
      ctx.strokeStyle = config.typography.accentColor;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 40, py + 48);
      ctx.lineTo(px + panelW - 40, py + 48);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 段落文字
      ctx.fillStyle = config.typography.storyColor;
      ctx.font = `16px ${getFont(16)}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const paraStartY = py + 58;
      const paraLineH = 24;
      const maxCharsPerLine = Math.floor((panelW - 80) / 16);

      let lineY = paraStartY;
      for (const para of config.story.paragraphs) {
        for (let i = 0; i < para.length; i += maxCharsPerLine) {
          const line = para.slice(i, i + maxCharsPerLine);
          ctx.fillText(line, px + 40, lineY);
          lineY += paraLineH;
        }
      }
    }

    // "继续"按钮
    if (this.continueButtonVisible) {
      const btnW = 120;
      const btnH = 40;
      const btnX = px + panelW - btnW - 32;
      const btnY = py + panelH - btnH - 12;
      this.continueBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.fillStyle = config.typography.accentColor;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 6);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = config.typography.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 6);
      ctx.stroke();

      ctx.fillStyle = config.typography.accentColor;
      ctx.font = `bold 18px ${getFont(18, true)}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const btnLabel = this.mode === 'defeat' ? '返回' : '继续';
      ctx.fillText(btnLabel, btnX + btnW / 2, btnY + btnH / 2);
    }

    ctx.restore();
  }
}

// ============================================================
// Easing functions
// ============================================================

function elasticOut(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 1) * (2 * Math.PI) / 0.3) + 1;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
