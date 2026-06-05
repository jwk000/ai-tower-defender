// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { TileType, type MapConfig } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { BoardGlowSystem } from './BoardGlowSystem.js';

function createMap(lighting?: MapConfig['lighting']): MapConfig {
  return {
    name: 'test',
    cols: 4,
    rows: 3,
    tileSize: 64,
    tiles: [
      [TileType.Empty, TileType.Path, TileType.Empty, TileType.Empty],
      [TileType.Empty, TileType.Path, TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Empty, TileType.Path, TileType.Base],
    ],
    lighting,
  };
}

function createMockContext(): CanvasRenderingContext2D & {
  fillRect: ReturnType<typeof vi.fn>;
} {
  const gradient = { addColorStop: vi.fn() };
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D & {
    fillRect: ReturnType<typeof vi.fn>;
  };
}

describe('BoardGlowSystem — 月光棋盘外发光', () => {
  it('启用 moonlight 后使用 WebGL overlay shader 渲染棋盘外发光和周围粒子', () => {
    RenderSystem.sceneOffsetX = 10;
    RenderSystem.sceneOffsetY = 20;
    RenderSystem.sceneW = 256;
    RenderSystem.sceneH = 192;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = 800;
    baseCanvas.height = 600;
    baseCanvas.style.width = '800px';
    baseCanvas.style.height = '600px';
    document.body.appendChild(baseCanvas);

    const gl = createMockWebGLContext();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string,
    ) {
      if (this !== baseCanvas && contextId === 'webgl') return gl as unknown as WebGLRenderingContext;
      return null;
    } as HTMLCanvasElement['getContext']);

    try {
      const system = new BoardGlowSystem(createMap({
        moonlight: { enabled: true, ambientAlpha: 0.16, bloomAlpha: 0.22 },
      }));

      system.renderMoonlightShader(baseCanvas);

      const overlay = document.querySelector<HTMLCanvasElement>('[data-testid="board-moonlight-webgl"]');
      expect(overlay).not.toBeNull();
      expect(overlay!.style.pointerEvents).toBe('none');
      expect(overlay!.style.mixBlendMode).toBe('screen');
      expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4);
      expect(gl.uniform4f).toHaveBeenCalledWith(expect.anything(), 10, 20, 256, 192);
      expect(getContext).toHaveBeenCalled();
      system.dispose();
      expect(document.querySelector('[data-testid="board-moonlight-webgl"]')).toBeNull();
    } finally {
      getContext.mockRestore();
      baseCanvas.remove();
    }
  });

  it('shader 源码使用顶部原点坐标并把粒子限制在棋盘外侧', () => {
    const source = BoardGlowSystem.getMoonlightFragmentShaderSource();

    expect(source).toContain('(1.0 - v_uv.y) * u_resolution.y');
    expect(source).toContain('float haloBand = (1.0 - inside)');
    expect(source).toContain('float particleMask = (1.0 - inside)');
    expect(source).toContain('step(0.88, rnd)');
    expect(source).toContain('float scatterNoise = step(0.42');
    expect(source).toContain('float particles = particleLayer(driftUv, 12.0, 0.42) * particleMask');
    expect(source).toContain('* 0.20');
    expect(source).not.toContain('particleLayer(driftUv +');
    expect(source).not.toContain('smoothstep(150.0, 38.0');
    expect(source).not.toContain('smoothstep(118.0, 46.0');
  });

  it('shader 源码不绘制棋盘内部椭圆形径向遮罩，也不铺棋盘内部提亮层', () => {
    const source = BoardGlowSystem.getMoonlightFragmentShaderSource();

    expect(source).toContain('float alpha = outerBloom * u_bloomAlpha + particles * u_bloomAlpha * 1.65');
    expect(source).not.toContain('innerGlow');
    expect(source).not.toContain('length(q)');
    expect(source).not.toContain('boardFill');
    expect(source).not.toContain('u_ambientAlpha');
  });

  it('默认不通过 Canvas 2D 绘制月光', () => {
    RenderSystem.sceneOffsetX = 10;
    RenderSystem.sceneOffsetY = 20;
    RenderSystem.sceneW = 256;
    RenderSystem.sceneH = 192;

    const ctx = createMockContext();
    new BoardGlowSystem(createMap()).render(ctx);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('启用 moonlight 后 Canvas 2D render 仍不绘制 bloom 图形', () => {
    RenderSystem.sceneOffsetX = 10;
    RenderSystem.sceneOffsetY = 20;
    RenderSystem.sceneW = 256;
    RenderSystem.sceneH = 192;

    const ctx = createMockContext();
    new BoardGlowSystem(createMap({
      moonlight: { enabled: true, ambientAlpha: 0.16, bloomAlpha: 0.22 },
    })).render(ctx);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

function createMockWebGLContext(): WebGLRenderingContext & {
  drawArrays: ReturnType<typeof vi.fn>;
  uniform4f: ReturnType<typeof vi.fn>;
} {
  const shader = {};
  const program = {};
  const buffer = {};
  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLE_STRIP: 0x0005,
    COLOR_BUFFER_BIT: 0x4000,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE: 1,
    createShader: vi.fn(() => shader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    createProgram: vi.fn(() => program),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    createBuffer: vi.fn(() => buffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn((_program, name: string) => ({ name })),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    useProgram: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniform2f: vi.fn(),
    uniform4f: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
  } as unknown as WebGLRenderingContext & {
    drawArrays: ReturnType<typeof vi.fn>;
    uniform4f: ReturnType<typeof vi.fn>;
  };
}
