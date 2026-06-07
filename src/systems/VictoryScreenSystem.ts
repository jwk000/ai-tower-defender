// ============================================================
// VictoryScreenSystem — 过关界面全屏覆盖层（配置驱动）
//
// 职责：
//   - 3 阶段动画序列：胜利宣告 → 庆典特效 → 故事叙述
//   - 所有视觉/音频参数由关卡 YAML victory 配置节驱动
//   - 管理彩带粒子数组 (ConfettiParticle[])
//   - 处理"继续"按钮点击 → 触发 onComplete 回调
//
// 设计参考：design/04-levels.md §9, design/05-presentation.md §10
// ============================================================

import type { TowerWorld, System } from '../core/World.js';
import type {
  VictoryConfig,
  ConfettiShape,
  ConfettiBurst,
  VictoryFilter,
} from '../types/index.js';
import type { Renderer } from '../render/Renderer.js';
import { DEFAULT_VICTORY_CONFIG } from '../config/defaults.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { getFont } from '../config/fonts.js';
import { Sound } from '../utils/Sound.js';
import { Music } from '../utils/Music.js';

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

// ---- 阶段枚举 ----

enum VictoryPhase {
  Inactive = 'inactive',
  Phase1 = 'phase1',       // 胜利宣告 (0~1.5s)
  Phase2 = 'phase2',       // 庆典特效 (1.5~4.5s)
  Phase3 = 'phase3',       // 故事叙述 (4.5~8s)
  Done = 'done',           // 等待玩家点击
}

// ---- 常量 ----

const PHASE1_DURATION = 1.5;
const PHASE2_DURATION = 3.0;   // 实际 = config.confetti.duration，上限 4s
const PHASE3_PANEL_SLIDE = 0.5;
const STAR_SPACING = 40;
const STAR_SIZE = 48;

// ---- VictoryScreenSystem ----

export class VictoryScreenSystem implements System {
  readonly name = 'VictoryScreenSystem';

  private renderer: Renderer;
  private phase: VictoryPhase = VictoryPhase.Inactive;
  private phaseTimer: number = 0;
  private config: VictoryConfig | null = null;
  private timesCleared: number = 0;
  private stars: number = 1;

  /** 彩带粒子 */
  private particles: ConfettiParticle[] = [];

  /** 屏幕震动剩余时间 */
  private shakeTimer: number = 0;
  private shakeIntensity: number = 6;

  /** 星星逐个闪烁索引 */
  private starRevealIndex: number = 0;
  private starRevealTimer: number = 0;

  /** 阶段3面板滑入进度 (0→1) */
  private panelSlideProgress: number = 0;

  /** "继续"按钮可交互标记 */
  private continueButtonVisible: boolean = false;
  /** "继续"按钮命中区域 */
  private continueBtnRect: { x: number; y: number; w: number; h: number } | null = null;

  /** BGM/SFX 已播放标记 */
  private audioPlayed: boolean = false;

  /** 完成回调 */
  onComplete?: () => void;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  // ============================================================
  // System interface
  // ============================================================

  update(_world: TowerWorld, dt: number): void {
    if (this.phase === VictoryPhase.Inactive) return;

    this.phaseTimer += dt;

    switch (this.phase) {
      case VictoryPhase.Phase1:
        this.updatePhase1(dt);
        break;
      case VictoryPhase.Phase2:
        this.updatePhase2(dt);
        break;
      case VictoryPhase.Phase3:
        this.updatePhase3(dt);
        break;
      case VictoryPhase.Done:
        this.updateParticles(dt);
        break;
    }

    this.render();
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * 启动胜利界面。
   * @param config 关卡 victory 配置（含默认值合并）
   * @param stars 星级评定 (1-3)
   * @param timesCleared 本关已通关次数（含本次）
   */
  activate(config: VictoryConfig, stars: number, timesCleared: number): void {
    this.config = config;
    this.stars = stars;
    this.timesCleared = timesCleared;
    this.phase = VictoryPhase.Phase1;
    this.phaseTimer = 0;
    this.particles = [];
    this.shakeTimer = 0.5;
    this.starRevealIndex = 0;
    this.starRevealTimer = 0;
    this.panelSlideProgress = 0;
    this.continueButtonVisible = false;
    this.continueBtnRect = null;
    this.audioPlayed = false;

    // 屏幕震动
    this.shakeIntensity = 6;
  }

  /** 取消（外部强制关闭） */
  deactivate(): void {
    this.phase = VictoryPhase.Inactive;
    this.config = null;
    this.particles = [];
  }

  /** 是否正在显示 */
  isActive(): boolean {
    return this.phase !== VictoryPhase.Inactive;
  }

  /** 获取阶段（供 main.ts 判断是否允许交互） */
  getPhase(): VictoryPhase {
    return this.phase;
  }

  /**
   * 处理点击事件。
   * @returns true 表示事件被消费
   */
  handleClick(x: number, y: number): boolean {
    if (this.phase === VictoryPhase.Inactive) return false;

    // Phase3/Done：检查"继续"按钮
    if ((this.phase === VictoryPhase.Phase3 || this.phase === VictoryPhase.Done) && this.continueButtonVisible) {
      const btn = this.continueBtnRect;
      if (btn && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.onContinue();
        return true;
      }
    }

    // 重复通关时 Phase2 就可以点任意位置跳过
    if (this.phase === VictoryPhase.Phase2 && this.shouldSkipStory()) {
      this.phase = VictoryPhase.Done;
      this.phaseTimer = 0;
      this.onContinue();
      return true;
    }

    return false;
  }

  // ============================================================
  // Phase updates
  // ============================================================

  private shouldSkipStory(): boolean {
    if (!this.config) return false;
    return this.config.story.showFullStoryOnlyFirst && this.timesCleared > 1;
  }

  private updatePhase1(dt: number): void {
    // 播放音频（仅一次）
    if (!this.audioPlayed) {
      this.audioPlayed = true;
      if (this.config) {
        Sound.play(this.config.audio.sfx as never);
        Music.play(this.config.audio.bgm as never, 0.5);
      }
    }

    // 屏幕震动衰减
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }

    // 过渡到 Phase2
    if (this.phaseTimer >= PHASE1_DURATION) {
      // 生成彩带粒子
      this.spawnConfetti();
      this.phase = VictoryPhase.Phase2;
      this.phaseTimer = 0;
      this.starRevealTimer = 0;
      this.starRevealIndex = 0;
    }
  }

  private updatePhase2(dt: number): void {
    // 更新彩带粒子
    this.updateParticles(dt);

    // 星星逐个闪烁
    this.starRevealTimer += dt;
    if (this.starRevealTimer >= 0.4 && this.starRevealIndex < 3) {
      this.starRevealTimer = 0;
      this.starRevealIndex++;
    }

    const confettiDuration = this.config?.confetti.duration ?? 3.0;

    // 过渡到 Phase3
    if (this.phaseTimer >= confettiDuration) {
      if (this.shouldSkipStory()) {
        // 跳过故事，直接到 Done
        this.phase = VictoryPhase.Done;
        this.phaseTimer = 0;
        this.continueButtonVisible = true;
      } else {
        this.phase = VictoryPhase.Phase3;
        this.phaseTimer = 0;
        this.panelSlideProgress = 0;
      }
    }
  }

  private updatePhase3(dt: number): void {
    // 更新残余彩带（减少数量）
    this.updateParticles(dt);

    // 面板滑入动画
    if (this.panelSlideProgress < 1) {
      this.panelSlideProgress = Math.min(1, this.panelSlideProgress + dt / PHASE3_PANEL_SLIDE);
    }

    // 1.5s 后显示"继续"按钮
    if (this.phaseTimer >= 1.5) {
      this.continueButtonVisible = true;
    }

    // 3s 后自动进入 Done（仍等待点击）
    if (this.phaseTimer >= 3.5 && !this.continueButtonVisible) {
      this.continueButtonVisible = true;
    }
  }

  // ============================================================
  // Confetti
  // ============================================================

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

    // 构建形状加权数组
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

      // 初始位置（取决于发射方式）
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
      p.vy += 150 * dt; // 重力
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

  private render(): void {
    const ctx = this.renderer.context;
    if (!ctx || !this.config) return;

    const config = this.config;
    const designW = LayoutManager.DESIGN_W;
    const designH = LayoutManager.DESIGN_H;

    // 全屏绘制（viewport-space）
    this.renderer.resetTransform();

    // Phase1: 背景滤镜 + VICTORY 大字
    if (this.phase === VictoryPhase.Phase1) {
      this.drawBackgroundFilter(config.background.filter, this.phaseTimer / PHASE1_DURATION);
      this.renderer.applyDesignTransform();
      this.drawVictoryTitle(designW / 2, designH * 0.35, this.phaseTimer);
    }

    // Phase2: 彩带 + 星星评定
    if (this.phase === VictoryPhase.Phase2) {
      this.drawBackgroundFilter(config.background.filter, 1.0);
      this.renderer.applyDesignTransform();
      this.drawVictoryTitle(designW / 2, designH * 0.25, PHASE1_DURATION); // 锁定到结束态
      this.drawStars(designW / 2, designH * 0.38);
      this.drawConfettiParticles();
    }

    // Phase3 / Done: 面板 + 残余彩带
    if (this.phase === VictoryPhase.Phase3 || this.phase === VictoryPhase.Done) {
      this.drawBackgroundFilter(config.background.filter, 1.0);
      this.renderer.applyDesignTransform();
      this.drawVictoryTitle(designW / 2, designH * 0.18, PHASE1_DURATION);
      this.drawStars(designW / 2, designH * 0.28);
      this.drawConfettiParticles();
      this.drawStoryPanel(config, designW / 2, designH * 0.65);
    }
  }

  private drawBackgroundFilter(filter: VictoryFilter, progress: number): void {
    const ctx = this.renderer.context;
    const w = LayoutManager.viewportW;
    const h = LayoutManager.viewportH;

    ctx.save();
    // 底层：灰度化战斗画面（实际通过半透明暗色模拟）
    const alpha = 0.55 + progress * 0.15;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);

    // 每种 filter 的特效
    switch (filter) {
      case 'rain_to_sunny': {
        // 顶部→底部渐变（雨过天晴）
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(45, 90, 30, 0.6)');
        grad.addColorStop(0.5, 'rgba(74, 140, 63, 0.3)');
        grad.addColorStop(1, 'rgba(26, 58, 18, 0.6)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 右上角太阳光晕
        if (progress > 0.2) {
          const sunR = 80 + progress * 60;
          const sun = ctx.createRadialGradient(w * 0.85, h * 0.18, sunR * 0.3, w * 0.85, h * 0.18, sunR);
          sun.addColorStop(0, `rgba(255, 215, 0, ${0.7 * progress})`);
          sun.addColorStop(0.5, `rgba(255, 200, 50, ${0.3 * progress})`);
          sun.addColorStop(1, 'rgba(255, 180, 30, 0)');
          ctx.fillStyle = sun;
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }
      case 'heat_dissipate': {
        // 棕黄暖色 tint + 热浪水平波纹
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(75, 45, 24, 0.5)');
        grad.addColorStop(0.5, 'rgba(197, 141, 61, 0.2)');
        grad.addColorStop(1, 'rgba(45, 28, 20, 0.6)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 热浪波纹（振幅随时间衰减）
        const waveAmp = (1 - progress) * 15;
        ctx.strokeStyle = `rgba(255, 209, 102, ${0.15 * (1 - progress)})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const y = h * 0.25 + i * h * 0.09;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 20) {
            const wy = y + Math.sin(x * 0.008 + this.phaseTimer * 2 + i) * waveAmp;
            if (x === 0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
          }
          ctx.stroke();
        }
        break;
      }
      case 'dawn_break': {
        // 灰暗冷色 → 裂缝白光破开
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(17, 24, 39, 0.7)');
        grad.addColorStop(0.5, 'rgba(47, 58, 86, 0.4)');
        grad.addColorStop(1, 'rgba(9, 13, 22, 0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 裂缝白光
        if (progress > 0.3) {
          const crackAlpha = Math.min(1, (progress - 0.3) * 2);
          const crackGrad = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.55, h * 0.4);
          crackGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * crackAlpha})`);
          crackGrad.addColorStop(0.15, `rgba(220, 230, 255, ${0.5 * crackAlpha})`);
          crackGrad.addColorStop(1, 'rgba(200, 210, 255, 0)');
          ctx.fillStyle = crackGrad;
          ctx.fillRect(0, 0, w, h);
        }
        break;
      }
      case 'eye_close': {
        // 暗红 tint
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(43, 24, 20, 0.6)');
        grad.addColorStop(0.5, 'rgba(101, 51, 41, 0.3)');
        grad.addColorStop(1, 'rgba(19, 15, 14, 0.7)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 右上角"眼睛"闭合（瞳孔缩小）
        const eyeX = w * 0.85;
        const eyeY = h * 0.15;
        const eyeR = 100 * (1 - progress * 0.85);
        // 虹膜
        const iris = ctx.createRadialGradient(eyeX, eyeY, eyeR * 0.2, eyeX, eyeY, eyeR);
        iris.addColorStop(0, `rgba(255, 80, 40, ${0.6 * (1 - progress)})`);
        iris.addColorStop(0.4, `rgba(180, 30, 20, ${0.4 * (1 - progress)})`);
        iris.addColorStop(1, 'rgba(100, 10, 0, 0)');
        ctx.fillStyle = iris;
        ctx.fillRect(0, 0, w, h);

        // 绿色光点（新生植物）
        if (progress > 0.5) {
          for (let i = 0; i < 12; i++) {
            const gx = w * 0.15 + (i * 79 + this.phaseTimer * 40) % (w * 0.7);
            const gy = h * 0.75 + Math.sin(i * 1.7) * 60;
            ctx.fillStyle = `rgba(144, 238, 144, ${0.4 * progress})`;
            ctx.beginPath();
            ctx.arc(gx, gy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
      case 'rift_seal': {
        // 深紫 tint
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(18, 0, 36, 0.7)');
        grad.addColorStop(0.5, 'rgba(56, 16, 95, 0.3)');
        grad.addColorStop(1, 'rgba(5, 0, 13, 0.8)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 底部裂缝愈合（变窄）
        const riftHeight = h * 0.08 * (1 - progress);
        if (riftHeight > 0.5) {
          ctx.fillStyle = `rgba(199, 125, 255, ${0.3 * (1 - progress)})`;
          ctx.fillRect(0, h - riftHeight, w, riftHeight);
        }

        // 紫色火焰 → 蓝白光
        for (let i = 0; i < 6; i++) {
          const fx = w * 0.12 + i * w * 0.15;
          const fy = h * 0.8 + Math.sin(i * 2.1) * 40;
          const col = progress > 0.6
            ? `rgba(180, 200, 255, ${0.4})`
            : `rgba(199, 125, 255, ${0.4 * (1 - progress * 1.2)})`;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(fx, fy, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'gray_tint':
      default:
        // 默认：纯灰度暗角
        break;
    }

    ctx.restore();
  }

  private drawVictoryTitle(cx: number, cy: number, elapsed: number): void {
    const ctx = this.renderer.context;
    const config = this.config;
    if (!config) return;

    // 弹性缓出动画
    const t = Math.min(1, elapsed / 0.6);
    const easeOutBack = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
    const scale = 3 - easeOutBack * 2;  // 3 → 1
    const alpha = Math.min(1, elapsed / 0.3);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // 渐变填充 "VICTORY"
    const colors = config.typography.titleColor;
    const fontSize = 96;
    const grad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]!);
    }
    ctx.fillStyle = grad;
    ctx.font = `bold ${fontSize}px ${getFont(fontSize, true)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = config.typography.accentColor;
    ctx.shadowBlur = 24;
    ctx.fillText('VICTORY', 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  private drawStars(cx: number, cy: number): void {
    const ctx = this.renderer.context;
    if (!this.config) return;

    const brightColor = '#ffcc00';
    const dimColor = '#555555';

    ctx.save();
    ctx.font = `${STAR_SIZE}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * STAR_SPACING;
      const revealed = i < this.starRevealIndex ||
        (i === this.starRevealIndex && i < this.stars);
      const lit = i < this.stars;

      // 闪烁动画（刚reveal时）
      let extraScale = 1;
      let extraAlpha = 1;
      if (revealed && this.starRevealIndex === i && this.starRevealTimer < 0.3) {
        const blinkT = this.starRevealTimer / 0.3;
        extraScale = 1 + 0.3 * (1 - blinkT);
        extraAlpha = 0.6 + 0.4 * blinkT;
      }

      ctx.save();
      ctx.translate(x, cy);
      ctx.scale(extraScale, extraScale);
      ctx.globalAlpha = extraAlpha;
      ctx.fillStyle = lit ? brightColor : dimColor;
      ctx.fillText('⭐', 0, 0);
      ctx.restore();
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
          // 小光晕
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

    const panelW = 900;
    const panelH = 280;
    const px = cx - panelW / 2;
    // 滑入动画：从底部上移
    const slideOffset = (1 - this.panelSlideProgress) * (panelH + 100);
    const py = cy - panelH / 2 + slideOffset;

    ctx.save();

    // 面板背景
    ctx.fillStyle = config.typography.panelBg;
    ctx.strokeStyle = config.typography.panelBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 16);
    ctx.fill();
    ctx.stroke();

    // 标题
    ctx.fillStyle = config.typography.accentColor;
    ctx.font = `bold 28px ${getFont(28, true)}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(config.story.title, px + 48, py + 24);

    // 分隔线
    ctx.strokeStyle = config.typography.accentColor;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 48, py + 62);
    ctx.lineTo(px + panelW - 48, py + 62);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 段落文字（逐段淡入）
    const paraStartY = py + 78;
    const paraLineH = 26;
    ctx.fillStyle = config.typography.storyColor;
    ctx.font = `18px ${getFont(18)}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const paraFadeIn = this.panelSlideProgress > 0.7 ? Math.min(1, (this.panelSlideProgress - 0.7) / 0.3) : 0;

    for (let i = 0; i < config.story.paragraphs.length; i++) {
      const paraAlpha = Math.min(1, i < 3 ? paraFadeIn : Math.max(0, paraFadeIn - (i - 2) * 0.3));
      ctx.globalAlpha = paraAlpha;
      ctx.fillText(
        config.story.paragraphs[i]!,
        px + 48,
        paraStartY + i * paraLineH,
        panelW - 96,
      );
    }
    ctx.globalAlpha = 1;

    // "继续"按钮
    if (this.continueButtonVisible) {
      const btnW = 120;
      const btnH = 42;
      const btnX = px + panelW - btnW - 40;
      const btnY = py + panelH - btnH - 20;
      this.continueBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.fillStyle = config.typography.accentColor;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.strokeStyle = config.typography.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.stroke();

      ctx.fillStyle = config.typography.accentColor;
      ctx.font = `bold 18px ${getFont(18, true)}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('继续', btnX + btnW / 2, btnY + btnH / 2);
    }

    ctx.restore();
  }

  // ============================================================
  // Continue callback
  // ============================================================

  private onContinue(): void {
    this.phase = VictoryPhase.Inactive;
    this.config = null;
    this.particles = [];
    this.onComplete?.();
  }
}
