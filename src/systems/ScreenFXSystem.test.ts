import { describe, expect, it } from 'vitest';
import { ScreenFXSystem } from './ScreenFXSystem.js';
import { WeatherType } from '../types/index.js';

interface ArcCall {
  x: number;
  y: number;
  radius: number;
}

function createMockContext(): CanvasRenderingContext2D & { arcs: ArcCall[] } {
  const arcs: ArcCall[] = [];
  const gradient = { addColorStop: () => undefined };
  return {
    arcs,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    arc: (x: number, y: number, radius: number) => {
      arcs.push({ x, y, radius });
    },
    fill: () => undefined,
    stroke: () => undefined,
    fillRect: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    set fillStyle(_value: string | CanvasGradient | CanvasPattern) {},
    set strokeStyle(_value: string | CanvasGradient | CanvasPattern) {},
    set globalAlpha(_value: number) {},
    set lineWidth(_value: number) {},
  } as unknown as CanvasRenderingContext2D & { arcs: ArcCall[] };
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
