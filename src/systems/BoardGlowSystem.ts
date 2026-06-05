// ============================================================
// Tower Defender — BoardGlowSystem
//
// 棋盘流光效果：在棋盘上以随机间隔扫过一道金色光带；
// 夜晚月光使用独立 WebGL overlay shader 渲染棋盘外发光和微光粒子。
//
// 实现为轻量 System，仅管理计时逻辑；实际绘制在 onPostRender 中
// 调用 Canvas 2D 流光与 WebGL shader 月光 overlay。
// ============================================================

import type { System, TowerWorld } from '../core/World.js';
import type { MapConfig, MoonlightConfig } from '../types/index.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { RenderSystem } from './RenderSystem.js';

const DEFAULT_MOONLIGHT: MoonlightConfig = {
  enabled: false,
  ambientAlpha: 0.1,
  bloomAlpha: 0.18,
};

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec4 u_board;
uniform float u_time;
uniform float u_bloomAlpha;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float particleLayer(vec2 uv, float scale, float speed) {
  vec2 p = uv * scale;
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float rnd = hash(cell);
  float rnd2 = hash(cell + 19.41);
  float rnd3 = hash(cell + 31.77);
  vec2 center = vec2(hash(cell + 3.17), hash(cell + 8.91));
  center += 0.24 * vec2(sin(u_time * speed + rnd * 6.2831), cos(u_time * speed * 0.73 + rnd2 * 6.2831));
  float d = length(local - center);
  float radius = mix(0.014, 0.032, rnd2);
  float core = smoothstep(radius, 0.0, d);
  float twinkle = 0.25 + 0.75 * smoothstep(-0.35, 1.0, sin(u_time * (0.45 + rnd * 0.85) + rnd3 * 12.0));
  return core * twinkle * step(0.94, rnd);
}

void main() {
  vec2 px = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
  vec2 minB = u_board.xy;
  vec2 maxB = u_board.xy + u_board.zw;
  vec2 insideStep = step(minB, px) * step(px, maxB);
  float inside = insideStep.x * insideStep.y;

  vec2 delta = max(max(minB - px, px - maxB), vec2(0.0));
  float outsideDist = length(delta);
  float haloBand = (1.0 - inside) * smoothstep(4.0, 26.0, outsideDist) * smoothstep(150.0, 38.0, outsideDist);
  float outerBloom = haloBand * exp(-outsideDist * 0.014) * 0.20;

  vec2 glowUv = (px - minB + vec2(96.0)) / max(u_board.zw + vec2(192.0), vec2(1.0));
  float scatterNoise = step(0.58, hash(floor(glowUv * 18.0) + vec2(2.7, 6.1)));
  float particleMask = (1.0 - inside) * smoothstep(10.0, 26.0, outsideDist) * smoothstep(118.0, 46.0, outsideDist) * scatterNoise;
  vec2 driftUv = glowUv + vec2(0.014 * sin(u_time * 0.18), -u_time * 0.010);
  float particles = particleLayer(driftUv, 9.0, 0.42) * particleMask;

  vec3 color = vec3(0.72, 0.84, 1.0);
  float alpha = outerBloom * u_bloomAlpha + particles * u_bloomAlpha * 1.25;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.65));
}
`;

interface MoonlightGLResources {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  attribPosition: number;
  uniforms: {
    resolution: WebGLUniformLocation;
    board: WebGLUniformLocation;
    time: WebGLUniformLocation;
    bloomAlpha: WebGLUniformLocation;
  };
}

export class BoardGlowSystem implements System {
  readonly name = 'BoardGlowSystem';

  static getMoonlightFragmentShaderSource(): string {
    return FRAGMENT_SHADER;
  }

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
  private elapsed = 0;
  private moonlightGL: MoonlightGLResources | null = null;

  constructor(private map: MapConfig) {
    this.nextTriggerTime = this.randomCooldown();
  }

  /** 更新计时器：冷却 + 扫过进度 */
  update(_world: TowerWorld, dt: number): void {
    this.elapsed += dt;
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

  renderMoonlightShader(baseCanvas: HTMLCanvasElement): void {
    const moonlight = this.getMoonlight();
    if (!moonlight.enabled) {
      this.setMoonlightVisible(false);
      return;
    }

    const resources = this.ensureMoonlightGL(baseCanvas);
    if (!resources) return;

    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const mapW = RenderSystem.sceneW;
    const mapH = RenderSystem.sceneH;

    if (mapW <= 0 || mapH <= 0) return;

    this.syncOverlayCanvas(resources.canvas, baseCanvas);
    resources.canvas.style.display = 'block';

    const bloomAlpha = Math.max(0, Math.min(0.35, moonlight.bloomAlpha));
    const sx = LayoutManager.designOffsetX + ox * LayoutManager.scale;
    const sy = LayoutManager.designOffsetY + oy * LayoutManager.scale;
    const sw = mapW * LayoutManager.scale;
    const sh = mapH * LayoutManager.scale;

    const gl = resources.gl;
    gl.viewport(0, 0, resources.canvas.width, resources.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(resources.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.buffer);
    gl.enableVertexAttribArray(resources.attribPosition);
    gl.vertexAttribPointer(resources.attribPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resources.uniforms.resolution, resources.canvas.width, resources.canvas.height);
    gl.uniform4f(resources.uniforms.board, sx, sy, sw, sh);
    gl.uniform1f(resources.uniforms.time, this.elapsed);
    gl.uniform1f(resources.uniforms.bloomAlpha, bloomAlpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  setMoonlightVisible(visible: boolean): void {
    if (this.moonlightGL) {
      this.moonlightGL.canvas.style.display = visible ? 'block' : 'none';
    }
  }

  dispose(): void {
    this.moonlightGL?.canvas.remove();
    this.moonlightGL = null;
  }

  private ensureMoonlightGL(baseCanvas: HTMLCanvasElement): MoonlightGLResources | null {
    if (this.moonlightGL) return this.moonlightGL;

    const canvas = document.createElement('canvas');
    canvas.dataset['testid'] = 'board-moonlight-webgl';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.mixBlendMode = 'screen';
    canvas.style.imageRendering = 'auto';
    canvas.style.zIndex = '1';
    baseCanvas.style.position = baseCanvas.style.position || 'relative';
    baseCanvas.style.zIndex = baseCanvas.style.zIndex || '0';
    baseCanvas.insertAdjacentElement('afterend', canvas);

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    if (!gl) {
      canvas.remove();
      return null;
    }

    const program = this.createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    const buffer = gl.createBuffer();
    if (!program || !buffer) {
      canvas.remove();
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const attribPosition = gl.getAttribLocation(program, 'a_position');
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const board = gl.getUniformLocation(program, 'u_board');
    const time = gl.getUniformLocation(program, 'u_time');
    const bloomAlpha = gl.getUniformLocation(program, 'u_bloomAlpha');
    if (attribPosition < 0 || !resolution || !board || !time || !bloomAlpha) {
      canvas.remove();
      return null;
    }

    this.moonlightGL = {
      canvas,
      gl,
      program,
      buffer,
      attribPosition,
      uniforms: { resolution, board, time, bloomAlpha },
    };
    return this.moonlightGL;
  }

  private syncOverlayCanvas(canvas: HTMLCanvasElement, baseCanvas: HTMLCanvasElement): void {
    if (canvas.width !== baseCanvas.width) canvas.width = baseCanvas.width;
    if (canvas.height !== baseCanvas.height) canvas.height = baseCanvas.height;
    canvas.style.width = baseCanvas.style.width;
    canvas.style.height = baseCanvas.style.height;
  }

  private createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertex = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[BoardGlowSystem] moonlight shader link failed:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  private createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[BoardGlowSystem] moonlight shader compile failed:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }
}
