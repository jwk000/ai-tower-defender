// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Renderer } from './Renderer.js';

type ContextRecord = CanvasRenderingContext2D & {
  calls: string[];
};

function makeContext(calls: string[]): ContextRecord {
  let composite = 'source-over';
  return {
    calls,
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    setTransform: vi.fn(() => calls.push('setTransform')),
    clearRect: vi.fn(() => calls.push(`clearRect:${composite}`)),
    drawImage: vi.fn(() => calls.push(`drawImage:${composite}`)),
    fillRect: vi.fn(() => calls.push(`fillRect:${composite}`)),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 0 })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    set globalCompositeOperation(value: string) {
      composite = value;
      calls.push(`gco:${value}`);
    },
    get globalCompositeOperation() {
      return composite;
    },
    set globalAlpha(value: number) {
      calls.push(`alpha:${value}`);
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      calls.push(`fillStyle:${String(value)}`);
    },
    set strokeStyle(_value: string | CanvasGradient | CanvasPattern) {},
    set lineWidth(_value: number) {},
    set font(_value: string) {},
    set textAlign(_value: CanvasTextAlign) {},
    set textBaseline(_value: CanvasTextBaseline) {},
    set filter(_value: string) {},
  } as unknown as ContextRecord;
}

describe('Renderer image tint mask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('受击 tint 使用图片 alpha mask，不在主画布绘制整块白色矩形', () => {
    const mainCalls: string[] = [];
    const tintCalls: string[] = [];
    const mainCtx = makeContext(mainCalls);
    const tintCtx = makeContext(tintCalls);
    const baseCanvas = document.createElement('canvas');
    const tintCanvas = document.createElement('canvas');
    const image = document.createElement('canvas');
    image.width = 8;
    image.height = 8;
    const originalCreateElement = document.createElement.bind(document);

    vi.spyOn(baseCanvas, 'getContext').mockImplementation(((contextId: string) =>
      contextId === '2d' ? mainCtx : null
    ) as HTMLCanvasElement['getContext']);
    vi.spyOn(tintCanvas, 'getContext').mockImplementation(((contextId: string) =>
      contextId === '2d' ? tintCtx : null
    ) as HTMLCanvasElement['getContext']);
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') return tintCanvas;
      return originalCreateElement(tagName);
    }) as typeof document.createElement);

    const renderer = new Renderer(baseCanvas);

    renderer.beginFrame();
    renderer.push({
      shape: 'rect',
      x: 10,
      y: 10,
      size: 8,
      h: 8,
      color: '#ffffff',
      image,
      imageTint: { color: '#ffffff', alpha: 0.72 },
    });
    renderer.endFrame();

    expect(tintCalls).toContain('gco:source-in');
    expect(tintCalls).toContain('fillRect:source-in');
    expect(mainCalls).toContain('alpha:0.72');
    expect(mainCalls).toContain('drawImage:source-over');
    expect(mainCalls).not.toContain('fillRect:source-atop');
  });
});
