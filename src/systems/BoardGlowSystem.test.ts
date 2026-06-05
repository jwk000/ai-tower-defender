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
  gradient: { addColorStop: ReturnType<typeof vi.fn> };
  fillRect: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
  clip: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
} {
  const gradient = { addColorStop: vi.fn() };
  return {
    gradient,
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
    createRadialGradient: vi.fn(() => gradient),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D & {
    gradient: { addColorStop: ReturnType<typeof vi.fn> };
    fillRect: ReturnType<typeof vi.fn>;
    strokeRect: ReturnType<typeof vi.fn>;
    rect: ReturnType<typeof vi.fn>;
    clip: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
  };
}

describe('BoardGlowSystem — 月光棋盘提亮', () => {
  it('默认不绘制月光', () => {
    RenderSystem.sceneOffsetX = 10;
    RenderSystem.sceneOffsetY = 20;
    RenderSystem.sceneW = 256;
    RenderSystem.sceneH = 192;

    const ctx = createMockContext();
    new BoardGlowSystem(createMap()).render(ctx);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('启用 moonlight 后整体提亮棋盘并绘制 bloom 光晕', () => {
    RenderSystem.sceneOffsetX = 10;
    RenderSystem.sceneOffsetY = 20;
    RenderSystem.sceneW = 256;
    RenderSystem.sceneH = 192;

    const ctx = createMockContext();
    new BoardGlowSystem(createMap({
      moonlight: { enabled: true, ambientAlpha: 0.16, bloomAlpha: 0.22 },
    })).render(ctx);

    expect(ctx.rect).toHaveBeenCalledWith(10, 20, 256, 192);
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 256, 192);
    expect(ctx.strokeRect).toHaveBeenCalledWith(12, 22, 252, 188);
    expect(ctx.gradient.addColorStop).toHaveBeenCalledWith(0, 'rgba(235, 245, 255, 0.165)');
    expect(ctx.rotate).not.toHaveBeenCalled();
  });
});
