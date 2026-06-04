// ============================================================
// Tower Defender — BoardGlowSystem
//
// 棋盘流光效果：在棋盘上以随机间隔扫过一道金色光带。
// 光带水平横扫，带渐变软边，间隔 3-8s 随机触发。
//
// 实现为轻量 System，仅管理计时逻辑；实际绘制在 onPostRender 中
// 直接操作 Canvas 2D context（命令缓冲不支持渐变）。
// ============================================================

import type { System, TowerWorld } from '../core/World.js';
import type { MapConfig } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';

export class BoardGlowSystem implements System {
  readonly name = 'BoardGlowSystem';

  /** 距下次触发的冷却时间（秒） */
  private cooldown = 0;
  /** 随机冷却目标值（秒） */
  private nextTriggerTime: number;

  /** 当前是否有光带正在扫过 */
  private sweepActive = false;
  /** 光带扫过进度 0→1 */
  private sweepProgress = 0;
  /** 本次扫过持续时长（秒） */
  private sweepDuration = 1.0;
  /** 扫过方向 */
  private sweepDirection: 'ltr' | 'rtl' = 'ltr';

  /** 光带宽度因子（0.7–1.3，每次随机） */
  private bandWidthFactor = 1.0;

  constructor(private map: MapConfig) {
    this.nextTriggerTime = this.randomCooldown();
  }

  /** 更新计时器：冷却 + 扫过进度 */
  update(_world: TowerWorld, dt: number): void {
    this.cooldown += dt;

    if (this.sweepActive) {
      this.sweepProgress += dt / this.sweepDuration;
      if (this.sweepProgress >= 1.0) {
        this.sweepActive = false;
        this.sweepProgress = 0;
        this.cooldown = 0;
        this.nextTriggerTime = this.randomCooldown();
        this.sweepDirection = Math.random() > 0.5 ? 'ltr' : 'rtl';
      }
    } else if (this.cooldown >= this.nextTriggerTime) {
      this.sweepActive = true;
      this.sweepProgress = 0;
      this.sweepDuration = 0.7 + Math.random() * 0.9; // 0.7–1.6s
      this.bandWidthFactor = 0.7 + Math.random() * 0.6; // 0.7–1.3
    }
  }

  /**
   * 直接在 Canvas 2D 上下文上绘制流光光带。
   * 在 onPostRender 中调用，此时 ctx 处于设计空间变换下。
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.sweepActive) return;

    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = RenderSystem.sceneW;  // mapPixelW
    const mapH = RenderSystem.sceneH;  // mapPixelH

    if (mapW <= 0 || mapH <= 0) return;

    const t = this.sweepProgress;
    // ease-in-out
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // 光带水平位置
    const bandX = this.sweepDirection === 'ltr'
      ? ox + eased * mapW
      : ox + (1 - eased) * mapW;

    // 光带宽度（基础 120px × 随机因子）
    const bandWidth = 120 * this.bandWidthFactor;
    const halfW = bandWidth / 2;

    // 峰值透明度（扫过中段最亮，两端渐弱）
    const peakAlpha = 0.25 * (1 - Math.abs(t - 0.5) * 2) * 0.9;

    ctx.save();

    // 水平渐变：中心亮 → 两侧透明
    const grad = ctx.createLinearGradient(bandX - halfW, 0, bandX + halfW, 0);
    grad.addColorStop(0.0, 'rgba(255, 215, 0, 0)');
    grad.addColorStop(0.15, `rgba(255, 240, 160, ${peakAlpha * 0.3})`);
    grad.addColorStop(0.35, `rgba(255, 250, 220, ${peakAlpha * 0.8})`);
    grad.addColorStop(0.5, `rgba(255, 255, 240, ${peakAlpha})`);
    grad.addColorStop(0.65, `rgba(255, 250, 220, ${peakAlpha * 0.8})`);
    grad.addColorStop(0.85, `rgba(255, 240, 160, ${peakAlpha * 0.3})`);
    grad.addColorStop(1.0, 'rgba(255, 215, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(bandX - halfW, oy - 4, bandWidth, mapH + 8);

    ctx.restore();
  }

  /** 随机冷却时长 3–8 秒 */
  private randomCooldown(): number {
    return 3.0 + Math.random() * 5.0;
  }
}
