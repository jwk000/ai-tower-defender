import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelSelectUI } from './LevelSelectUI.js';
import { SaveManager, type SaveData } from '../utils/SaveManager.js';
import { LayoutManager } from './LayoutManager.js';

const localStorageStore: Record<string, string> = {};

function installLocalStorage(): void {
  for (const key of Object.keys(localStorageStore)) delete localStorageStore[key];
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value; },
    removeItem: (key: string) => { delete localStorageStore[key]; },
    clear: () => { for (const k of Object.keys(localStorageStore)) delete localStorageStore[k]; },
    get length() { return Object.keys(localStorageStore).length; },
    key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
  } as Storage;
}

function saveWithUnlockedLevels(unlockedLevels: number): void {
  const data: SaveData = {
    ...SaveManager.getDefaults(),
    unlockedLevels,
  };
  SaveManager.save(data);
}

function createMockContext(): CanvasRenderingContext2D {
  const noop = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  return {
    save: noop,
    restore: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    moveTo: noop,
    lineTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    ellipse: noop,
    roundRect: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    fillText: noop,
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    setTransform: noop,
  } as unknown as CanvasRenderingContext2D;
}

function createMockRenderer(): {
  context: CanvasRenderingContext2D;
  resetTransform: ReturnType<typeof vi.fn>;
  applyDesignTransform: ReturnType<typeof vi.fn>;
} {
  return {
    context: createMockContext(),
    resetTransform: vi.fn(),
    applyDesignTransform: vi.fn(),
  };
}

function createLevelSelect(onStartLevel = vi.fn()): LevelSelectUI {
  return new LevelSelectUI(
    createMockRenderer() as never,
    onStartLevel,
  );
}

describe('LevelSelectUI — 主题背景选择与 hover 交互', () => {
  beforeEach(() => {
    installLocalStorage();
    saveWithUnlockedLevels(3);
  });

  it('默认选中第一个已解锁关卡', () => {
    const ui = createLevelSelect();

    expect(ui.getSelectedLevelId()).toBe(1);
  });

  it('鼠标划过已解锁关卡会自动选中该关卡', () => {
    const ui = createLevelSelect();
    const level2 = ui.getLevelButtonBounds(2);

    expect(level2).not.toBeNull();
    ui.handleMouseMove(level2!.x + level2!.w / 2, level2!.y + level2!.h / 2);

    expect(ui.getSelectedLevelId()).toBe(2);
  });

  it('鼠标划过锁定关卡不会改变当前选中关卡', () => {
    const ui = createLevelSelect();
    const level5 = ui.getLevelButtonBounds(5);

    expect(level5).not.toBeNull();
    ui.handleMouseMove(level5!.x + level5!.w / 2, level5!.y + level5!.h / 2);

    expect(ui.getSelectedLevelId()).toBe(1);
  });

  it('点击已解锁关卡会选中并进入该关卡', () => {
    const onStartLevel = vi.fn();
    const ui = createLevelSelect(onStartLevel);
    const level3 = ui.getLevelButtonBounds(3);

    expect(level3).not.toBeNull();
    ui.handleClick(level3!.x + level3!.w / 2, level3!.y + level3!.h / 2);

    expect(ui.getSelectedLevelId()).toBe(3);
    expect(onStartLevel).toHaveBeenCalledWith(3);
  });

  it('背景绘制使用 viewport 尺寸并在 UI 绘制前恢复设计坐标', () => {
    LayoutManager.update(2560, 1080);
    const renderer = createMockRenderer();
    const ui = new LevelSelectUI(renderer as never, vi.fn());
    const ctx = renderer.context as unknown as {
      fillRect: ReturnType<typeof vi.fn>;
      createLinearGradient: ReturnType<typeof vi.fn>;
    };

    ui.update(1 / 60);

    expect(renderer.resetTransform).toHaveBeenCalledBefore(renderer.applyDesignTransform);
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 1080);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 2560, 1080);
  });
});
