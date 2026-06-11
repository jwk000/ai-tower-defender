import { describe, expect, it } from 'vitest';
import { ScreenFXSystem } from './ScreenFXSystem.js';
import { WeatherType } from '../types/index.js';

interface ArcCall {
  x: number;
  y: number;
  radius: number;
  fillStyle: unknown;
}

interface EllipseCall {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  fillStyle: unknown;
}

interface PathFillCall {
  points: Array<{ x: number; y: number }>;
  fillStyle: unknown;
}

function createMockContext(): CanvasRenderingContext2D & {
  arcs: ArcCall[];
  ellipses: EllipseCall[];
  pathFills: PathFillCall[];
} {
  const arcs: ArcCall[] = [];
  const ellipses: EllipseCall[] = [];
  const pathFills: PathFillCall[] = [];
  let currentFillStyle: unknown = '';
  let currentPath: Array<{ x: number; y: number }> = [];
  let translateX = 0;
  let translateY = 0;
  const transformStack: Array<{ x: number; y: number }> = [];
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
    ellipses,
    pathFills,
    save: () => {
      transformStack.push({ x: translateX, y: translateY });
    },
    restore: () => {
      const previous = transformStack.pop();
      if (!previous) return;
      translateX = previous.x;
      translateY = previous.y;
    },
    beginPath: () => {
      currentPath = [];
    },
    closePath: () => undefined,
    arc: (x: number, y: number, radius: number) => {
      arcs.push({ x: x + translateX, y: y + translateY, radius, fillStyle: currentFillStyle });
    },
    ellipse: (x: number, y: number, radiusX: number, radiusY: number) => {
      ellipses.push({
        x: x + translateX,
        y: y + translateY,
        radiusX,
        radiusY,
        fillStyle: currentFillStyle,
      });
    },
    fill: () => {
      if (currentPath.length > 0) {
        pathFills.push({ points: [...currentPath], fillStyle: currentFillStyle });
      }
    },
    stroke: () => undefined,
    fillRect: () => undefined,
    moveTo: (x: number, y: number) => {
      currentPath.push({ x: x + translateX, y: y + translateY });
    },
    lineTo: (x: number, y: number) => {
      currentPath.push({ x: x + translateX, y: y + translateY });
    },
    translate: (x: number, y: number) => {
      translateX += x;
      translateY += y;
    },
    rotate: () => undefined,
    scale: () => undefined,
    createRadialGradient: createGradient,
    createLinearGradient: createGradient,
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      currentFillStyle = value;
    },
    set strokeStyle(_value: string | CanvasGradient | CanvasPattern) {},
    set globalAlpha(_value: number) {},
    set lineWidth(_value: number) {},
  } as unknown as CanvasRenderingContext2D & {
    arcs: ArcCall[];
    ellipses: EllipseCall[];
    pathFills: PathFillCall[];
  };
}

function isFogPuff(arc: ArcCall): boolean {
  const stops = (arc.fillStyle as { stops?: string[] }).stops ?? [];
  return stops.some((color) => color.includes('205,213,223') || color.includes('200,210,220'));
}

function hasGradientStop(shape: ArcCall | EllipseCall | PathFillCall, text: string): boolean {
  const stops = (shape.fillStyle as { stops?: string[] }).stops ?? [];
  return stops.some((color) => color.includes(text));
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

describe('ScreenFXSystem 图片背景天空地标', () => {
  it('晴天默认绘制太阳与阳光光束，图片背景开启后隐藏', () => {
    const normal = new ScreenFXSystem();
    const withBackground = new ScreenFXSystem();
    const normalCtx = createMockContext();
    const backgroundCtx = createMockContext();

    normal.render(normalCtx, 0, WeatherType.Sunny);
    withBackground.render(backgroundCtx, 0, WeatherType.Sunny, { backgroundImageActive: true });

    const normalSunGlow = normalCtx.arcs.filter((arc) => hasGradientStop(arc, '255,248,200'));
    const backgroundSunGlow = backgroundCtx.arcs.filter((arc) => hasGradientStop(arc, '255,248,200'));

    expect(normalSunGlow.length).toBeGreaterThan(0);
    expect(normalCtx.pathFills.length).toBeGreaterThan(0);
    expect(backgroundSunGlow.length).toBe(0);
    expect(backgroundCtx.pathFills.length).toBe(0);
  });

  it('夜晚图片背景开启后隐藏月亮但保留星空', () => {
    const normal = new ScreenFXSystem();
    const withBackground = new ScreenFXSystem();
    const normalCtx = createMockContext();
    const backgroundCtx = createMockContext();

    normal.render(normalCtx, 0, WeatherType.Night);
    withBackground.render(backgroundCtx, 0, WeatherType.Night, { backgroundImageActive: true });

    const normalMoonArcs = normalCtx.arcs.filter((arc) => arc.radius >= 55);
    const backgroundMoonArcs = backgroundCtx.arcs.filter((arc) => arc.radius >= 55);

    expect(normalMoonArcs.length).toBe(4);
    expect(backgroundMoonArcs.length).toBe(0);
    expect(backgroundCtx.arcs.length).toBeGreaterThan(0);
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

describe('ScreenFXSystem 红雾天气特效', () => {
  it('红雾绘制快速移动的暗红云/火山灰', () => {
    const fx = new ScreenFXSystem();
    const first = createMockContext();
    const second = createMockContext();

    fx.render(first, 0, WeatherType.RedMist);
    fx.render(second, 1, WeatherType.RedMist);

    const firstAshClouds = first.arcs.filter((arc) => hasGradientStop(arc, '92,9,9'));
    const secondAshClouds = second.arcs.filter((arc) => hasGradientStop(arc, '92,9,9'));

    expect(firstAshClouds.length).toBe(36);
    expect(secondAshClouds.length).toBe(36);
    expect(secondAshClouds[0]!.x - firstAshClouds[0]!.x).toBeGreaterThan(120);
  });
});
