// ============================================================
// VictoryScreenSystem — 过关覆盖层（轻量，在战斗画面上叠加）
//
// 职责：
//   - 在定格战斗画面上叠加半透明暗色遮罩
//   - 彩带粒子特效（配置驱动颜色/形状/发射方式）
//   - 星星评定 + 故事文字 + "继续"按钮
//   - 音频由外部 handleVictory() 触发，本系统不再播放
//
// 设计参考：design/04-levels.md §9, design/05-presentation.md §10
// ============================================================

import type { TowerWorld, System } from '../core/World.js';
import type { VictoryConfig, ConfettiShape, ConfettiBurst } from '../types/index.js';
import type { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { getFont } from '../config/fonts.js';

// ---- 彩带粒子 ----

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  width: number;
  height: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: ConfettiShape;
}

// ---- 常量 ----

const STAR_SPACING = 40;
const STAR_SIZE = 48;
const OVERLAY_ALPHA = 0.55;

// ---- VictoryScreenSystem ----

export class VictoryScreenSystem implements System {
  readonly name = 'VictoryScreenSystem';

  private renderer: Renderer;
  private active: boolean = false;
  private config: VictoryConfig | null = null;
  private timesCleared: number = 0;
  private stars: number = 1;

  /** 彩带粒子 */
  private particles: ConfettiParticle[] = [];
  /** 彩带是否已生成 */
  private confettiSpawned: boolean = false;
  /** 激活后的累计时间 */
  private elapsed: number = 0;

  /** "继续"按钮可交互标记 */
  private continueButtonVisible: boolean = false;
  /** "继续"按钮命中区域 */
  private continueBtnRect: { x: number; y: number; w: number; h: number } | null = null;

  /** 完成回调 */
  onComplete?: () => void;

  /** 外部注入胜利回调（由 main.ts 设置，用于在点击继续后保存数据） */
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
    this.updateParticles(dt);

    // 0.8s 后显示"继续"按钮
    if (this.elapsed >= 0.8 && !this.continueButtonVisible) {
      this.continueButtonVisible = true;
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  activate(config: VictoryConfig, stars: number, timesCleared: number): void {
    this.config = config;
    this.stars = stars;
    this.timesCleared = timesCleared;
    this.active = true;
    this.elapsed = 0;
    this.particles = [];
    this.confettiSpawned = false;
    this.continueButtonVisible = false;
    this.continueBtnRect = null;
  }

  deactivate(): void {
    this.active = false;
    this.config = null;
    this.particles = [];
  }

  isActive(): boolean {
    return this.active;
  }

  handleClick(x: number, y: number): boolean {
    if (!this.active) return false;

    if (this.continueButtonVisible) {
      const btn = this.continueBtnRect;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.onContinueClick();
        return true;
      }
    }

    // 重复通关可点击任意位置跳过故事
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
  // Render（在 onPostRender 中调用，位于所有场景/UI 之上）
  // ============================================================

  public render(): void {
    if (!this.active) return;
    const ctx = this.renderer.context;
    if (!ctx || !this.config) return;

    const config = this.config;
    const designW = LayoutManager.DESIGN_W;
    const designH = LayoutManager.DESIGN_H;

    this.ensureConfettiSpawned();

    // 1. 全屏暗色遮罩（viewport-space）
    this.renderer.resetTransform();
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${OVERLAY_ALPHA})`;
    ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    ctx.restore();

    // 2. 设计空间绘制
    this.renderer.applyDesignTransform();

    // 3. 彩带粒子
    this.drawConfettiParticles();

    // 4. 星星评定
    this.drawStars(designW / 2, designH * 0.32);

    // 5. 故事文字 + 继续按钮
    this.drawStoryPanel(config, designW / 2, designH * 0.68);
  }

  private drawStars(cx: number, cy: number): void {
    const ctx = this.renderer.context;
    const brightColor = '#ffcc00';
    const dimColor = '#555555';

    ctx.save();
    ctx.font = `${STAR_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * STAR_SPACING;
      const lit = i < this.stars;

      ctx.fillStyle = lit ? brightColor : dimColor;
      ctx.fillText('⭐', x, cy);
    }

    ctx.restore();
  }

  private drawConfettiParticles(): void {
    const ctx = this.renderer.context;

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

    const shouldSkip = this.shouldSkipStory();

    const panelW = 900;
    // 跳过故事时面板高度缩小
    const panelH = shouldSkip ? 90 : 240;
    const px = cx - panelW / 2;
    const py = cy - panelH / 2;

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
      // 只显示简短 summary
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
      const maxCharsPerLine = Math.floor((panelW - 80) / 16); // 中文约16px/字

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
      ctx.fillText('继续', btnX + btnW / 2, btnY + btnH / 2);
    }

    ctx.restore();
  }
}
