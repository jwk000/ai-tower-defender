import { describe, expect, it } from 'vitest';
import { ScreenFXSystem } from './ScreenFXSystem.js';
import { WeatherType } from '../types/index.js';

interface ArcCall {
  x: number;
  y: number;
  radius: number;
  fillStyle: unknown;
}

function createMockContext(): CanvasRenderingContext2D & { arcs: ArcCall[] } {
  const arcs: ArcCall[] = [];
  let currentFillStyle: unknown = '';
  const createGradient = () => {
    const gradient = {
      stops: [] as string[],
      addColorStop: (_offset: number, color: string) => {
        gradient.stops.push(color);
      },
    };
    return gradient;
  };
  return {
    arcs,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    arc: (x: number, y: number, radius: number) => {
      arcs.push({ x, y, radius, fillStyle: currentFillStyle });
    },
    fill: () => undefined,
    stroke: () => undefined,
    fillRect: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    createRadialGradient: createGradient,
    createLinearGradient: createGradient,
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      currentFillStyle = value;
    },
    set strokeStyle(_value: string | CanvasGradient | CanvasPattern) {},
    set globalAlpha(_value: number) {},
    set lineWidth(_value: number) {},
  } as unknown as CanvasRenderingContext2D & { arcs: ArcCall[] };
}

function isFogPuff(arc: ArcCall): boolean {
  const stops = (arc.fillStyle as { stops?: string[] }).stops ?? [];
  return stops.some((color) => color.includes('205,213,223') || color.includes('200,210,220'));
}

describe('ScreenFXSystem 下雪天气特效', () => {
  it('雪天绘制随机分布的飘落雪花', () => {
    const fx = new ScreenFXSystem();
    const ctx = createMockContext();

    fx.render(ctx, 0, WeatherType.Snow);

    const snowflakes = ctx.arcs.filter((arc) => arc.radius >= 4 && arc.radius <= 8);
    expect(snowflakes.length).toBe(40);
    expect(new Set(snowflakes.map((arc) => Math.round(arc.x))).size).toBeGreaterThan(30);
    expect(new Set(snowflakes.map((arc) => Math.round(arc.y))).size).toBeGreaterThan(30);
  });

  it('雪花下一帧继续向下飘落', () => {
    const fx = new ScreenFXSystem();
    const first = createMockContext();
    const second = createMockContext();

    fx.render(first, 0, WeatherType.Snow);
    fx.render(second, 1, WeatherType.Snow);

    const firstSnowflakes = first.arcs.filter((arc) => arc.radius >= 4 && arc.radius <= 8);
    const secondSnowflakes = second.arcs.filter((arc) => arc.radius >= 4 && arc.radius <= 8);
    const movedDown = firstSnowflakes.some((arc, i) => secondSnowflakes[i]!.y > arc.y);

    expect(movedDown).toBe(true);
  });
});

describe('ScreenFXSystem 夜晚雾效叠加', () => {
  it('夜晚默认不绘制雾团', () => {
    const fx = new ScreenFXSystem();
    const ctx = createMockContext();

    fx.render(ctx, 0, WeatherType.Night);

    const fogPuffs = ctx.arcs.filter(isFogPuff);
    expect(fogPuffs.length).toBe(0);
  });

  it('夜晚开启 fogOverlay 后叠加雾团', () => {
    const fx = new ScreenFXSystem();
    const ctx = createMockContext();

    fx.render(ctx, 0, WeatherType.Night, { fogOverlay: { enabled: true } });

    const fogPuffs = ctx.arcs.filter(isFogPuff);
    expect(fogPuffs.length).toBe(48);
  });
});
