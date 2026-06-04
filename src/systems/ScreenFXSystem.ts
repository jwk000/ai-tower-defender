// ============================================================
// Tower Defender — ScreenFXSystem
//
// 全屏后处理特效：阳光射线、风线、暗角
// 在 onPostRender 阶段调用，所有实体绘制完成后叠加
// 非 ECS System，不参与 World.update 循环
// ============================================================

import { WeatherType } from '../types/index.js';
import { LayoutManager } from '../ui/LayoutManager.js';

export class ScreenFXSystem {
  /** 当前时间（秒），用于动画驱动 */
  private time = 0;

  // splitmix32 哈希链 —— 每步完全独立，消除 s0~sN 线性相关
  private nextHash(h: number): number {
    h = ((h ^ (h >>> 16)) * 0x85ebca6b) >>> 0;
    h = ((h ^ (h >>> 13)) * 0xc2b2ae35) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return h;
  }
  private hashToFloat(h: number): number {
    return h / 0xFFFFFFFF;
  }

  /**
   * 更新内部时间并渲染所有全屏特效
   * @param ctx    Canvas 2D 渲染上下文
   * @param dt     帧间隔（秒），用于驱动动画
   * @param weather 当前天气类型
   */
  render(ctx: CanvasRenderingContext2D, dt: number, weather: WeatherType): void {
    this.time += dt;

    this.drawSunRays(ctx, weather);
    this.drawWindLines(ctx, weather);
    this.drawFogParticles(ctx, weather);
    this.drawRainDrops(ctx, weather);
    this.drawDarkClouds(ctx, weather);
    this.drawStars(ctx, weather);
    this.drawMoon(ctx, weather);
    this.drawVignette(ctx, weather);
  }

  // ============================================================
  // 阳光射线
  // ============================================================

  /**
   * 从画面左上角斜射下来的半透明金色光束
   * 仅在晴天显示
   */
  private drawSunRays(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Sunny) return;

    const rayAlpha = 0.025 + Math.sin(this.time * 0.4) * 0.015;
    const rays = [
      { angleDeg: -25, width: 100 },
      { angleDeg: -12, width: 70 },
      { angleDeg: 0,   width: 140 },
      { angleDeg: 12,  width: 80 },
      { angleDeg: 25,  width: 90 },
    ];

    ctx.save();
    ctx.fillStyle = '#fff9c4';

    for (const ray of rays) {
      const angle = (ray.angleDeg * Math.PI) / 180;
      const originX = 0;
      const originY = 0;

      const length = 1800;
      const topW = ray.width * 0.3;
      const bottomW = ray.width;
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      const endX = originX + Math.cos(angle) * length;
      const endY = originY + Math.sin(angle) * length;

      ctx.globalAlpha = rayAlpha;
      ctx.beginPath();
      ctx.moveTo(originX + perpX * topW, originY + perpY * topW);
      ctx.lineTo(endX + perpX * bottomW, endY + perpY * bottomW);
      ctx.lineTo(endX - perpX * bottomW, endY - perpY * bottomW);
      ctx.lineTo(originX - perpX * topW, originY - perpY * topW);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 风线
  // ============================================================

  /**
   * 半透明白色细线从左侧向右扫过全屏
   * 雨天/夜晚密度翻倍
   */
  private drawWindLines(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    const isWindy = weather === WeatherType.Rain || weather === WeatherType.Night;
    const count = isWindy ? 6 : 2;
    const baseAlpha = isWindy ? 0.06 : 0.03;

    ctx.save();
    ctx.strokeStyle = '#ffffff';

    for (let i = 0; i < count; i++) {
      const phase = i * 0.7 + this.time * (0.8 + i * 0.3);
      const speed = 200 + i * 80;
      const rawX = (this.time * speed + i * 400) % 2400 - 200;

      const baseY = 200 + i * 140 + (i % 2) * 60;
      const y = baseY + Math.sin(phase * 1.5) * 30;
      const lineW = 2 + (i % 3);
      const len = 250 + (i % 3) * 200;

      ctx.globalAlpha = baseAlpha * (0.7 + (i % 3) * 0.2);
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(rawX, y);
      ctx.lineTo(rawX + len, y + Math.sin(phase * 2) * 15);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  // 暗角效果
  // ============================================================

  /**
   * 屏幕四角向中心渐变变暗
   * 夜晚/雾天 alpha 翻倍
   */
  private drawVignette(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    const isDark = weather === WeatherType.Fog || weather === WeatherType.Night;
    const baseAlpha = isDark ? 0.2 : 0.1;

    const corners = [
      { x: 0, y: 0 },
      { x: LayoutManager.DESIGN_W, y: 0 },
      { x: 0, y: LayoutManager.DESIGN_H },
      { x: LayoutManager.DESIGN_W, y: LayoutManager.DESIGN_H },
    ];

    ctx.save();

    for (const corner of corners) {
      const radius = isDark ? 600 : 450;
      const grad = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${baseAlpha})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${baseAlpha * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(corner.x - radius, corner.y - radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }

  // ============================================================
  // 雾效粒子
  // ============================================================

  /**
   * 半透明雾粒子团块缓慢漂移横跨全屏
   * 仅在雾天显示
   * 使用确定性种子（Knuth's hash）避免每帧位置跳动
   */
  private drawFogParticles(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Fog) return;

    ctx.save();

    const fogCount = 10;
    const color = '#d0d8e0';

    for (let i = 0; i < fogCount; i++) {
      let s = ((i * 2654435761) >>> 0);
      const radius = 80 + this.hashToFloat(s = this.nextHash(s)) * 120;
      const alpha = 0.03 + this.hashToFloat(s = this.nextHash(s)) * 0.05;
      const driftSpeed = 20 + this.hashToFloat(s = this.nextHash(s)) * 30;

      const baseX = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const baseY = 100 + this.hashToFloat(s = this.nextHash(s)) * (LayoutManager.DESIGN_H - 200);

      // 水平漂移 + 边界循环
      const driftX = (this.time * driftSpeed + baseX) % (LayoutManager.DESIGN_W + radius * 2) - radius;

      // 轻微纵向摆动
      const wobble = Math.sin(this.time * 0.3 + i * 1.7) * 25 + Math.cos(this.time * 0.5 + i * 0.8) * 15;
      const fogY = baseY + wobble;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(driftX, fogY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 雨滴效果
  // ============================================================

  /**
   * 双层雨滴系统：远层（细小稀疏）+ 近层（粗密快速）
   * 带风斜效果，离开底部边界后从顶部重新生成
   * 仅在雨天显示
   */
  private drawRainDrops(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Rain) return;

    ctx.save();

    // 风斜角度（轻微向左倾斜，模拟风雨）
    const windAngle = Math.sin(this.time * 0.3) * 3 + 5; // 2°-8° 动态变化

    // ============================================================
    // 远层：细小稀疏雨滴（60滴）
    // ============================================================
    const farColor = '#7ba4c8';
    const farCount = 60;

    for (let i = 0; i < farCount; i++) {
      let s = ((i * 2654435761) >>> 0);
      const fallSpeed = 350 + this.hashToFloat(s = this.nextHash(s)) * 250;
      const len = 8 + this.hashToFloat(s = this.nextHash(s)) * 14;
      const x = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const alpha = 0.15 + this.hashToFloat(s = this.nextHash(s)) * 0.25;
      const lw = 0.8 + this.hashToFloat(s = this.nextHash(s)) * 0.4;
      const phaseOffset = this.hashToFloat(this.nextHash(s)) * 3;

      const rawY = ((this.time + phaseOffset) * fallSpeed + this.hashToFloat(this.nextHash(s)) * LayoutManager.DESIGN_H) % (LayoutManager.DESIGN_H + 80) - 40;
      const slantX = (rawY / LayoutManager.DESIGN_H) * Math.tan(windAngle * Math.PI / 180) * 40;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = farColor;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + slantX, rawY);
      ctx.lineTo(x, rawY + len);
      ctx.stroke();
    }

    // ============================================================
    // 近层：粗密快速雨滴（70滴）
    // ============================================================
    const nearColor = '#b8d8f0';
    const nearCount = 70;

    for (let i = 0; i < nearCount; i++) {
      let s = (((i + 1000) * 2654435761) >>> 0);
      const fallSpeed = 450 + this.hashToFloat(s = this.nextHash(s)) * 350;
      const len = 18 + this.hashToFloat(s = this.nextHash(s)) * 25;
      const x = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const alpha = 0.25 + this.hashToFloat(s = this.nextHash(s)) * 0.4;
      const lw = 1 + this.hashToFloat(s = this.nextHash(s)) * 1.5;
      const phaseOffset = this.hashToFloat(this.nextHash(s)) * 2;

      const rawY = ((this.time + phaseOffset) * fallSpeed + this.hashToFloat(this.nextHash(s)) * LayoutManager.DESIGN_H) % (LayoutManager.DESIGN_H + 80) - 40;
      const slantX = (rawY / LayoutManager.DESIGN_H) * Math.tan(windAngle * Math.PI / 180) * 60;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = nearColor;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x + slantX, rawY);
      ctx.lineTo(x, rawY + len);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  // 乌云效果
  // ============================================================

  /**
   * 深灰色云层团块在屏幕顶部缓慢漂移
   * 仅在雨天显示
   */
  private drawDarkClouds(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Rain) return;

    ctx.save();

    const cloudCount = 5;
    const color = '#2a3040';

    for (let i = 0; i < cloudCount; i++) {
      let s = ((i * 2654435761) >>> 0);
      const y = this.hashToFloat(s = this.nextHash(s)) * 200;
      const hR = 80 + this.hashToFloat(s = this.nextHash(s)) * 80;
      const vR = 40 + this.hashToFloat(s = this.nextHash(s)) * 30;
      const alpha = 0.15 + this.hashToFloat(s = this.nextHash(s)) * 0.15;
      const driftSpeed = 15 + this.hashToFloat(s = this.nextHash(s)) * 20;

      const baseX = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const cloudX = (this.time * driftSpeed + baseX) % (LayoutManager.DESIGN_W + hR * 2) - hR;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cloudX, y, hR, vR, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 星空效果
  // ============================================================

  /**
   * 满天星斗散布在天空区域 —— 多档大小 + 星芒十字 + 闪烁
   * 仅在夜晚显示
   * 使用 splitmix32 哈希链确保每颗星的位置/参数完全独立
   */
  private drawStars(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Night) return;

    ctx.save();

    const skyHeight = 200; // 仅天空区域，不落入棋盘

    // ---- 小星（70颗，半径0.5-1.2px）----
    for (let i = 0; i < 70; i++) {
      let s = ((i * 2654435761) >>> 0);
      const x = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const y = this.hashToFloat(s = this.nextHash(s)) * skyHeight;
      const r = 0.5 + this.hashToFloat(s = this.nextHash(s)) * 0.7;
      const tf = 2 + this.hashToFloat(s = this.nextHash(s)) * 3;
      const tp = this.hashToFloat(s = this.nextHash(s)) * Math.PI * 2;
      const ba = 0.3 + this.hashToFloat(this.nextHash(s)) * 0.5;
      const tw = Math.sin(this.time * tf + tp) * 0.4 + 0.6;

      ctx.globalAlpha = ba * tw;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- 中星（35颗，半径1.2-2.5px，含微十字星芒）----
    for (let i = 0; i < 35; i++) {
      let s = (((i + 500) * 2654435761) >>> 0);
      const x = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const y = this.hashToFloat(s = this.nextHash(s)) * skyHeight;
      const r = 1.2 + this.hashToFloat(s = this.nextHash(s)) * 1.3;
      const tf = 1.2 + this.hashToFloat(s = this.nextHash(s)) * 2.5;
      const tp = this.hashToFloat(s = this.nextHash(s)) * Math.PI * 2;
      const ba = 0.4 + this.hashToFloat(this.nextHash(s)) * 0.6;
      const tw = Math.sin(this.time * tf + tp) * 0.35 + 0.65;
      const alpha = ba * tw;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (alpha > 0.55) {
        const glowR = r * 3;
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillRect(x - glowR, y - 0.5, glowR * 2, 1);
        ctx.fillRect(x - 0.5, y - glowR, 1, glowR * 2);
      }
    }

    // ---- 亮星（8颗，四角星芒 + 强闪烁）----
    for (let i = 0; i < 8; i++) {
      let s = (((i + 1000) * 2654435761) >>> 0);
      const x = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const y = this.hashToFloat(s = this.nextHash(s)) * skyHeight;
      const r = 2 + this.hashToFloat(s = this.nextHash(s)) * 2;
      const tf = 0.8 + this.hashToFloat(s = this.nextHash(s)) * 1.5;
      const tp = this.hashToFloat(this.nextHash(s)) * Math.PI * 2;
      const tw = Math.sin(this.time * tf + tp) * 0.4 + 0.6;
      const alpha = (0.6 + this.hashToFloat(this.nextHash(s)) * 0.4) * tw;

      const armLen = r * 4;
      const armW = r * 0.6;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.save();
      ctx.translate(x, y);
      for (let j = 0; j < 4; j++) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-armW / 2, -armLen, armW, armLen * 2);
      }
      ctx.restore();

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 月亮效果
  // ============================================================

  /**
   * 大而明亮的月亮 + 光晕，位于屏幕右上角
   * 仅在夜晚显示
   * 具有微妙的呼吸脉冲效果
   */
  private drawMoon(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Night) return;

    ctx.save();

    // 月亮位置：右上角，使用设计分辨率定位
    const moonX = LayoutManager.DESIGN_W * 0.85;
    const moonY = 100;
    const moonRadius = 55;

    // 呼吸脉冲：alpha 轻微振荡
    const pulse = Math.sin(this.time * 0.6) * 0.03 + 0.97;

    // 光晕 — 3 层同心圆（暖白→浅黄渐变）
    const halos = [
      { radius: 80,  color: '#fffef5', alpha: 0.18 },
      { radius: 115, color: '#fff8d4', alpha: 0.09 },
      { radius: 155, color: '#fff3b0', alpha: 0.04 },
    ];

    for (const halo of halos) {
      ctx.globalAlpha = halo.alpha * pulse;
      ctx.fillStyle = halo.color;
      ctx.beginPath();
      ctx.arc(moonX, moonY, halo.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 月亮本体 — 白色偏黄
    ctx.globalAlpha = 0.95 * pulse;
    ctx.fillStyle = '#fffef0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
