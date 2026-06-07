// ============================================================
// Tower Defender — ScreenFXSystem
//
// 全屏后处理特效：阳光射线、风线、暗角
// 在 onPostRender 阶段调用，所有实体绘制完成后叠加
// 非 ECS System，不参与 World.update 循环
// ============================================================

import { WeatherType, type FogOverlayConfig } from '../types/index.js';
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

  /** 坐标哈希 → 单个格点的伪随机值 */
  private hashCell(ix: number, iy: number): number {
    let h = ((ix * 374761393 + iy * 668265263) >>> 0);
    h = this.nextHash(h);
    return this.hashToFloat(h);
  }

  /** 2D 值噪声：双线性插值 + smoothstep */
  private noise2D(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    // smoothstep
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const n00 = this.hashCell(ix, iy);
    const n10 = this.hashCell(ix + 1, iy);
    const n01 = this.hashCell(ix, iy + 1);
    const n11 = this.hashCell(ix + 1, iy + 1);

    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  /** 分形布朗运动（fBm）：多倍频叠加，模拟柏林噪声的自然感 */
  private fbm2D(x: number, y: number, octaves: number): number {
    let value = 0;
    let amp = 1;
    let freq = 1;
    let max = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * freq, y * freq) * amp;
      max += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return value / max;
  }

  /**
   * 更新内部时间并渲染所有全屏特效
   * @param ctx    Canvas 2D 渲染上下文
   * @param dt     帧间隔（秒），用于驱动动画
   * @param weather 当前天气类型
   */
  render(
    ctx: CanvasRenderingContext2D,
    dt: number,
    weather: WeatherType,
    options?: { fogOverlay?: Partial<FogOverlayConfig> },
  ): void {
    this.time += dt;

    this.drawSun(ctx, weather);
    this.drawSunRays(ctx, weather);
    this.drawWindLines(ctx, weather);
    this.drawFogParticles(ctx, weather, options?.fogOverlay);
    this.drawRainDrops(ctx, weather);
    this.drawSnowflakes(ctx, weather);
    this.drawDarkClouds(ctx, weather);
    this.drawRedMistAshClouds(ctx, weather);
    this.drawStars(ctx, weather);
    this.drawMoon(ctx, weather);
    this.drawVignette(ctx, weather);
  }

  // ============================================================
  // 太阳
  // ============================================================

  /**
   * 左上角耀眼太阳：多层径向渐变光晕 + 本体 + 呼吸脉冲
   * 仅在晴天显示
   */
  private drawSun(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Sunny) return;

    const sx = 100;
    const sy = 80;
    const pulse = Math.sin(this.time * 0.5) * 0.06 + 0.94; // 呼吸脉冲

    ctx.save();

    // 最外层光晕（极淡，极大范围）
    const g4 = ctx.createRadialGradient(sx, sy, 60, sx, sy, 250);
    g4.addColorStop(0, `rgba(255,248,200,${0.06 * pulse})`);
    g4.addColorStop(0.5, `rgba(255,240,180,${0.03 * pulse})`);
    g4.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = g4;
    ctx.beginPath(); ctx.arc(sx, sy, 250, 0, Math.PI * 2); ctx.fill();

    // 第三层光晕
    const g3 = ctx.createRadialGradient(sx, sy, 35, sx, sy, 150);
    g3.addColorStop(0, `rgba(255,250,210,${0.12 * pulse})`);
    g3.addColorStop(0.5, `rgba(255,240,180,${0.06 * pulse})`);
    g3.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = g3;
    ctx.beginPath(); ctx.arc(sx, sy, 150, 0, Math.PI * 2); ctx.fill();

    // 第二层光晕（暖黄色）
    const g2 = ctx.createRadialGradient(sx, sy, 15, sx, sy, 70);
    g2.addColorStop(0, `rgba(255,255,230,${0.25 * pulse})`);
    g2.addColorStop(0.5, `rgba(255,245,200,${0.12 * pulse})`);
    g2.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(sx, sy, 70, 0, Math.PI * 2); ctx.fill();

    // 内层光晕（亮白色）
    const g1 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 25);
    g1.addColorStop(0, `rgba(255,255,255,${0.7 * pulse})`);
    g1.addColorStop(0.4, `rgba(255,255,240,${0.4 * pulse})`);
    g1.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(sx, sy, 25, 0, Math.PI * 2); ctx.fill();

    // 太阳本体（刺眼白心）
    const g0 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10);
    g0.addColorStop(0, '#ffffff');
    g0.addColorStop(0.3, '#fffef0');
    g0.addColorStop(0.7, '#fff8c0');
    g0.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = g0;
    ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

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
  // 雾效 —— 随机雾团（FogPuff）
  // ============================================================

  /**
   * 密集随机雾团 + 径向渐变实心 → 软边缘 + 无镂空
   * 双层：大团打底（18个）+ 小团叠加（30个）
   */
  private drawFogParticles(
    ctx: CanvasRenderingContext2D,
    weather: WeatherType,
    fogOverlay?: Partial<FogOverlayConfig>,
  ): void {
    if (weather !== WeatherType.Fog && !(weather === WeatherType.Night && fogOverlay?.enabled)) return;

    ctx.save();

    // ==== 底层：大而淡的雾团 ====
    for (let i = 0; i < 18; i++) {
      let s = ((i * 2654435761 + 777) >>> 0);
      const px = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const py = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_H;
      const radius = 150 + this.hashToFloat(s = this.nextHash(s)) * 250;
      const alpha = 0.03 + this.hashToFloat(s = this.nextHash(s)) * 0.04;
      const driftSpeed = (0.2 + this.hashToFloat(s = this.nextHash(s)) * 0.6)
        * (this.hashToFloat(this.nextHash(s)) > 0.5 ? 1 : -1);
      const oscAmp = 15 + this.hashToFloat(this.nextHash(s)) * 35;
      const oscFreq = 0.15 + this.hashToFloat(this.nextHash(s)) * 0.35;
      const oscPhase = this.hashToFloat(this.nextHash(s)) * Math.PI * 2;

      const dx = px + this.time * driftSpeed * 20;
      const dy = py + Math.sin(this.time * oscFreq + oscPhase) * oscAmp;
      const wrapX = ((dx % (LayoutManager.DESIGN_W + radius * 2)) + (LayoutManager.DESIGN_W + radius * 2)) % (LayoutManager.DESIGN_W + radius * 2) - radius;
      const wrapY = ((dy % (LayoutManager.DESIGN_H + radius * 2)) + (LayoutManager.DESIGN_H + radius * 2)) % (LayoutManager.DESIGN_H + radius * 2) - radius;

      const grad = ctx.createRadialGradient(wrapX, wrapY, 0, wrapX, wrapY, radius);
      grad.addColorStop(0,    `rgba(205,213,223,${alpha})`);
      grad.addColorStop(0.5,  `rgba(200,210,220,${alpha * 0.8})`);
      grad.addColorStop(0.85, `rgba(195,205,218,${alpha * 0.25})`);
      grad.addColorStop(1,    'rgba(195,205,218,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wrapX, wrapY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ==== 表层：小而稍浓的雾团 ====
    for (let i = 0; i < 30; i++) {
      let s = (((i + 1000) * 2654435761 + 777) >>> 0);
      const px = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const py = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_H;
      const radius = 60 + this.hashToFloat(s = this.nextHash(s)) * 100;
      const alpha = 0.04 + this.hashToFloat(s = this.nextHash(s)) * 0.05;
      const driftSpeed = (0.3 + this.hashToFloat(s = this.nextHash(s)) * 0.8)
        * (this.hashToFloat(this.nextHash(s)) > 0.5 ? 1 : -1);
      const oscAmp = 8 + this.hashToFloat(this.nextHash(s)) * 20;
      const oscFreq = 0.2 + this.hashToFloat(this.nextHash(s)) * 0.5;
      const oscPhase = this.hashToFloat(this.nextHash(s)) * Math.PI * 2;

      const dx = px + this.time * driftSpeed * 30;
      const dy = py + Math.sin(this.time * oscFreq + oscPhase) * oscAmp;
      const wrapX = ((dx % (LayoutManager.DESIGN_W + radius * 2)) + (LayoutManager.DESIGN_W + radius * 2)) % (LayoutManager.DESIGN_W + radius * 2) - radius;
      const wrapY = ((dy % (LayoutManager.DESIGN_H + radius * 2)) + (LayoutManager.DESIGN_H + radius * 2)) % (LayoutManager.DESIGN_H + radius * 2) - radius;

      const grad = ctx.createRadialGradient(wrapX, wrapY, 0, wrapX, wrapY, radius);
      grad.addColorStop(0,    `rgba(200,210,220,${alpha})`);
      grad.addColorStop(0.4,  `rgba(195,207,218,${alpha * 0.85})`);
      grad.addColorStop(0.8,  `rgba(190,202,215,${alpha * 0.2})`);
      grad.addColorStop(1,    'rgba(190,202,215,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wrapX, wrapY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 红雾：火山灰云
  // ============================================================

  private drawRedMistAshClouds(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.RedMist) return;

    ctx.save();

    const cloudTop = 300;
    const count = 36;

    for (let i = 0; i < count; i++) {
      let s = (((i + 7000) * 2654435761) >>> 0);
      const baseX = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const baseY = this.hashToFloat(s = this.nextHash(s)) * cloudTop;
      const radiusX = 90 + this.hashToFloat(s = this.nextHash(s)) * 170;
      const radiusY = 24 + this.hashToFloat(s = this.nextHash(s)) * 58;
      const speed = 145 + this.hashToFloat(s = this.nextHash(s)) * 165;
      const alpha = 0.11 + this.hashToFloat(s = this.nextHash(s)) * 0.16;
      const wobble = Math.sin(this.time * (0.7 + i * 0.03) + i) * 14;

      const x = ((baseX + this.time * speed) % (LayoutManager.DESIGN_W + radiusX * 2)) - radiusX;
      const y = baseY + wobble;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radiusX);
      grad.addColorStop(0, `rgba(92,9,9,${alpha})`);
      grad.addColorStop(0.45, `rgba(70,8,10,${alpha * 0.9})`);
      grad.addColorStop(0.82, `rgba(34,5,8,${alpha * 0.35})`);
      grad.addColorStop(1, 'rgba(20,0,0,0)');

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, radiusY / radiusX);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
  // 雪花效果
  // ============================================================

  /**
   * 固定粒子槽位 + 伪随机初始参数，保证雪花随机分布但帧间连续。
   * 仅在下雪天气显示。
   */
  private drawSnowflakes(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Snow) return;

    ctx.save();

    const count = 40;
    const fallSpan = LayoutManager.DESIGN_H + 120;

    ctx.fillStyle = '#ffffff';

    for (let i = 0; i < count; i++) {
      let s = (((i + 4000) * 2654435761) >>> 0);
      const baseX = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const baseY = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_H;
      const radius = 4 + this.hashToFloat(s = this.nextHash(s)) * 4;
      const fallSpeed = 28 + this.hashToFloat(s = this.nextHash(s)) * 42;
      const driftAmp = 16 + this.hashToFloat(s = this.nextHash(s)) * 36;
      const driftFreq = 0.6 + this.hashToFloat(s = this.nextHash(s)) * 1.1;
      const driftPhase = this.hashToFloat(s = this.nextHash(s)) * Math.PI * 2;
      const alpha = 0.45 + this.hashToFloat(s = this.nextHash(s)) * 0.45;

      const y = ((baseY + this.time * fallSpeed + 60) % fallSpan) - 60;
      const x = (baseX + Math.sin(this.time * driftFreq + driftPhase) * driftAmp + LayoutManager.DESIGN_W) % LayoutManager.DESIGN_W;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 乌云 —— 随机云团（DarkCloudPuff）
  // ============================================================

  /**
   * 密集乌云层：双层随机云团 + 径向渐变软边 + 大面积重叠自然纹理
   * 底层（大团打底）+ 表层（小团增加细节），无圆形镂空
   */
  private drawDarkClouds(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Rain) return;

    ctx.save();

    const cloudTop = 260;

    // ==== 底层：大而淡的雾团（28个，半径120-300px）====
    for (let i = 0; i < 28; i++) {
      let s = (((i + 2000) * 2654435761) >>> 0);
      const px = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const py = this.hashToFloat(s = this.nextHash(s)) * cloudTop;
      const radius = 120 + this.hashToFloat(s = this.nextHash(s)) * 180;
      const alpha = 0.06 + this.hashToFloat(s = this.nextHash(s)) * 0.08;
      const driftSpeed = (0.15 + this.hashToFloat(s = this.nextHash(s)) * 0.4)
        * (this.hashToFloat(this.nextHash(s)) > 0.5 ? 1 : -1);
      const oscAmp = 8 + this.hashToFloat(this.nextHash(s)) * 20;
      const oscFreq = 0.12 + this.hashToFloat(this.nextHash(s)) * 0.3;
      const oscPhase = this.hashToFloat(this.nextHash(s)) * Math.PI * 2;

      const dx = px + this.time * driftSpeed * 15;
      const dy = py + Math.sin(this.time * oscFreq + oscPhase) * oscAmp;
      const wrapX = ((dx % (LayoutManager.DESIGN_W + radius * 2)) + (LayoutManager.DESIGN_W + radius * 2)) % (LayoutManager.DESIGN_W + radius * 2) - radius;
      const wrapY = Math.max(-radius * 0.3, Math.min(cloudTop + radius * 0.4, dy));

      const grad = ctx.createRadialGradient(wrapX, wrapY, 0, wrapX, wrapY, radius);
      grad.addColorStop(0,    `rgba(28,34,46,${alpha})`);
      grad.addColorStop(0.5,  `rgba(24,30,42,${alpha * 0.85})`);
      grad.addColorStop(0.85, `rgba(18,23,35,${alpha * 0.3})`);
      grad.addColorStop(1,    'rgba(18,23,35,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wrapX, wrapY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ==== 表层：小而浓的雾团（40个，半径60-140px）====
    for (let i = 0; i < 40; i++) {
      let s = (((i + 3000) * 2654435761) >>> 0);
      const px = this.hashToFloat(s = this.nextHash(s)) * LayoutManager.DESIGN_W;
      const py = this.hashToFloat(s = this.nextHash(s)) * cloudTop * 0.85;
      const radius = 60 + this.hashToFloat(s = this.nextHash(s)) * 80;
      const alpha = 0.08 + this.hashToFloat(s = this.nextHash(s)) * 0.12;
      const driftSpeed = (0.2 + this.hashToFloat(s = this.nextHash(s)) * 0.7)
        * (this.hashToFloat(this.nextHash(s)) > 0.5 ? 1 : -1);
      const oscAmp = 4 + this.hashToFloat(this.nextHash(s)) * 12;
      const oscFreq = 0.2 + this.hashToFloat(this.nextHash(s)) * 0.4;
      const oscPhase = this.hashToFloat(this.nextHash(s)) * Math.PI * 2;

      const dx = px + this.time * driftSpeed * 25;
      const dy = py + Math.sin(this.time * oscFreq + oscPhase) * oscAmp;
      const wrapX = ((dx % (LayoutManager.DESIGN_W + radius * 2)) + (LayoutManager.DESIGN_W + radius * 2)) % (LayoutManager.DESIGN_W + radius * 2) - radius;
      const wrapY = Math.max(-20, Math.min(cloudTop - 10, dy));

      const grad = ctx.createRadialGradient(wrapX, wrapY, 0, wrapX, wrapY, radius);
      grad.addColorStop(0,    `rgba(22,28,40,${alpha})`);
      grad.addColorStop(0.4,  `rgba(20,25,38,${alpha * 0.9})`);
      grad.addColorStop(0.8,  `rgba(15,20,32,${alpha * 0.25})`);
      grad.addColorStop(1,    'rgba(15,20,32,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wrapX, wrapY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ==== 云底渐变：从云层底部向下渐隐，避免硬截断 ====
    const bottomGrad = ctx.createLinearGradient(0, cloudTop - 60, 0, cloudTop + 80);
    bottomGrad.addColorStop(0, 'rgba(18,23,35,0)');
    bottomGrad.addColorStop(0.5, 'rgba(18,23,35,0.04)');
    bottomGrad.addColorStop(1, 'rgba(18,23,35,0)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, cloudTop - 60, LayoutManager.DESIGN_W, 140);

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
