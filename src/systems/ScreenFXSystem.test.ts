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
  it('红雾绘制右上角眼睛夕阳', () => {
    const fx = new ScreenFXSystem();
    const ctx = createMockContext();

    fx.render(ctx, 0, WeatherType.RedMist);

    const sunEye = ctx.ellipses.find((ellipse) =>
      ellipse.radiusX > 100 &&
      ellipse.radiusY > 60 &&
      ellipse.x > 1500 &&
      ellipse.y < 180
    );
    const pupil = ctx.ellipses.find((ellipse) =>
      ellipse.radiusX >= 20 &&
      ellipse.radiusX <= 35 &&
      ellipse.radiusY >= 50 &&
      ellipse.radiusY <= 65 &&
      ellipse.x > 1500 &&
      ellipse.y < 180
    );

    expect(sunEye).toBeDefined();
    expect(pupil).toBeDefined();
  });

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

  it('红雾绘制多层淡黑渐变背景远山', () => {
    const fx = new ScreenFXSystem();
    const ctx = createMockContext();

    fx.render(ctx, 0, WeatherType.RedMist);

    const mountainLayers = ctx.pathFills.filter((path) =>
      hasGradientStop(path, '12,12,13') &&
      hasGradientStop(path, '0,0,0,0') &&
      Math.max(...path.points.map((point) => point.y)) <= 506
    );

    expect(mountainLayers.length).toBe(3);
    expect(mountainLayers.map((path) => Math.min(...path.points.map((point) => point.y)))).toEqual([
      250,
      238,
      198,
    ]);
  });

  it('红雾只有最大山顶有淡红光并冒缓慢黑烟', () => {
    const fx = new ScreenFXSystem();
    const first = createMockContext();
    const second = createMockContext();

    fx.render(first, 0, WeatherType.RedMist);
    fx.render(second, 1, WeatherType.RedMist);

    const redPeakGlows = first.arcs.filter((arc) =>
      arc.radius === 62 &&
      arc.y < 230 &&
      hasGradientStop(arc, '185,34,22')
    );
    const firstSmoke = first.arcs.filter((arc) => hasGradientStop(arc, '8,8,8'));
    const secondSmoke = second.arcs.filter((arc) => hasGradientStop(arc, '8,8,8'));
    const maxSmokeStep = Math.max(
      ...firstSmoke.map((arc, i) =>
        Math.hypot(secondSmoke[i]!.x - arc.x, secondSmoke[i]!.y - arc.y)
      )
    );

    expect(redPeakGlows.length).toBe(1);
    expect(firstSmoke.length).toBe(12);
    expect(secondSmoke.length).toBe(12);
    expect(maxSmokeStep).toBeGreaterThan(1);
    expect(maxSmokeStep).toBeLessThan(8);
  });
});
