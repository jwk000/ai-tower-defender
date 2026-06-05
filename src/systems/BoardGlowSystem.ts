// ============================================================
// Tower Defender — BoardGlowSystem
//
// 棋盘流光效果：在棋盘上以随机间隔扫过一道金色光带。
// 光带 45° 斜向横扫，带渐变软边，间隔 3-8s 随机触发。
//
// 实现为轻量 System，仅管理计时逻辑；实际绘制在 onPostRender 中
// 直接操作 Canvas 2D context（命令缓冲不支持渐变）。
// ============================================================

import type { System, TowerWorld } from '../core/World.js';
import type { MapConfig, MoonlightConfig } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';

const DEFAULT_MOONLIGHT: MoonlightConfig = {
  enabled: false,
  ambientAlpha: 0.1,
  beamAlpha: 0.18,
};

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
  /** 斜向角度（弧度，每次随机 ±45°） */
  private sweepAngle = Math.PI / 4;
  /** 扫过方向（true=正向，false=反向） */
  private sweepForward = true;

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
      }
    } else if (this.cooldown >= this.nextTriggerTime) {
      this.sweepActive = true;
      this.sweepProgress = 0;
      this.sweepDuration = 0.7 + Math.random() * 0.9; // 0.7–1.6s
      this.bandWidthFactor = 0.7 + Math.random() * 0.6; // 0.7–1.3
      this.sweepAngle = Math.random() > 0.5 ? Math.PI / 4 : -Math.PI / 4;
      this.sweepForward = Math.random() > 0.5;
    }
  }

  /**
   * 直接在 Canvas 2D 上下文上绘制 45° 斜向流光光带。
   * 在 onPostRender 中调用，此时 ctx 处于设计空间变换下。
   */
  render(ctx: CanvasRenderingContext2D): void {
    this.renderMoonlight(ctx);
    if (!this.sweepActive) return;

    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = RenderSystem.sceneW;
    const mapH = RenderSystem.sceneH;

    if (mapW <= 0 || mapH <= 0) return;

    const t = this.sweepProgress;
    // ease-in-out
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    // Board center
    const cx = ox + mapW / 2;
    const cy = oy + mapH / 2;

    // 对角线长度确保旋转后覆盖全棋盘
    const diagLen = Math.sqrt(mapW * mapW + mapH * mapH);

    // 扫过位置（沿旋转后 x 轴）
    const sweepX = this.sweepForward
      ? -diagLen / 2 + eased * diagLen
      : diagLen / 2 - eased * diagLen;

    // 光带宽度（基础 120px × 随机因子）
    const bandWidth = 120 * this.bandWidthFactor;
    const halfW = bandWidth / 2;

    // 峰值透明度（扫过中段最亮，两端渐弱）
    const peakAlpha = 0.25 * (1 - Math.abs(t - 0.5) * 2) * 0.9;

    ctx.save();

    // 裁剪到棋盘区域，不透出格子外
    ctx.beginPath();
    ctx.rect(ox, oy, mapW, mapH);
    ctx.clip();

    // 绕棋盘中心旋转 45°，使竖直光带变为斜向
    ctx.translate(cx, cy);
    ctx.rotate(this.sweepAngle);

    // 渐变沿旋转后 x 轴（垂直于光带方向）
    const grad = ctx.createLinearGradient(sweepX - halfW, 0, sweepX + halfW, 0);
    grad.addColorStop(0.0, 'rgba(255, 215, 0, 0)');
    grad.addColorStop(0.15, `rgba(255, 240, 160, ${peakAlpha * 0.3})`);
    grad.addColorStop(0.35, `rgba(255, 250, 220, ${peakAlpha * 0.8})`);
    grad.addColorStop(0.5, `rgba(255, 255, 240, ${peakAlpha})`);
    grad.addColorStop(0.65, `rgba(255, 250, 220, ${peakAlpha * 0.8})`);
    grad.addColorStop(0.85, `rgba(255, 240, 160, ${peakAlpha * 0.3})`);
    grad.addColorStop(1.0, 'rgba(255, 215, 0, 0)');

    ctx.fillStyle = grad;
    // 竖直光带（在旋转空间中看是竖直的，原始空间中看是 45° 斜向）
    ctx.fillRect(sweepX - halfW, -diagLen / 2 - 4, bandWidth, diagLen + 8);

    ctx.restore();
  }

  /** 随机冷却时长 3–8 秒 */
  private randomCooldown(): number {
    return 3.0 + Math.random() * 5.0;
  }

  private getMoonlight(): MoonlightConfig {
    return {
      ...DEFAULT_MOONLIGHT,
      ...this.map.lighting?.moonlight,
    };
  }

  private renderMoonlight(ctx: CanvasRenderingContext2D): void {
    const moonlight = this.getMoonlight();
    if (!moonlight.enabled) return;

    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = RenderSystem.sceneW;
    const mapH = RenderSystem.sceneH;

    if (mapW <= 0 || mapH <= 0) return;

    const ambientAlpha = Math.max(0, Math.min(0.3, moonlight.ambientAlpha));
    const beamAlpha = Math.max(0, Math.min(0.45, moonlight.beamAlpha));
    const diagLen = Math.sqrt(mapW * mapW + mapH * mapH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, mapW, mapH);
    ctx.clip();

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(205, 225, 255, ${ambientAlpha})`;
    ctx.fillRect(ox, oy, mapW, mapH);

    ctx.translate(ox + mapW * 0.52, oy + mapH * 0.48);
    ctx.rotate(-Math.PI / 5);

    const beamWidth = Math.max(160, mapW * 0.22);
    const grad = ctx.createLinearGradient(-beamWidth, 0, beamWidth, 0);
    grad.addColorStop(0.0, 'rgba(190, 215, 255, 0)');
    grad.addColorStop(0.28, `rgba(210, 230, 255, ${beamAlpha * 0.45})`);
    grad.addColorStop(0.5, `rgba(235, 245, 255, ${beamAlpha})`);
    grad.addColorStop(0.72, `rgba(210, 230, 255, ${beamAlpha * 0.45})`);
    grad.addColorStop(1.0, 'rgba(190, 215, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(-beamWidth, -diagLen / 2, beamWidth * 2, diagLen);

    ctx.restore();
  }
}
