import { Application, Container, Graphics, type Ticker } from 'pixi.js';

export interface RendererConfig {
  readonly canvas: HTMLCanvasElement;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly cellSize: number;
}

type WeatherKind = 'blizzard' | 'rain' | 'sand' | 'smog' | 'spore' | 'fog' | 'none';

interface WeatherVisualState {
  readonly kind: WeatherKind;
  readonly width: number;
  readonly height: number;
  time: number;
  readonly overlay: Graphics;
}

/**
 * Renderer — PixiJS 应用初始化 + 窗口自适应。
 *
 * 自适应策略：
 *   - PixiJS renderer 尺寸始终等于窗口尺寸（window.innerWidth × innerHeight）
 *   - 游戏世界（格子地图）保持固定逻辑尺寸（worldWidth × worldHeight）
 *   - gameWorldRoot 做等比缩放 + 居中，确保世界始终完整可见
 *   - uiLayer 始终铺满整个窗口，UI 组件通过实际窗口尺寸布局
 *
 * 调用方在 window.resize 时调用 resize(w, h) 即可。
 */
export class Renderer {
  readonly app: Application;
  /** 地图格子层（跟随 gameWorldRoot 缩放） */
  readonly mapLayer: Container;
  /** 实体渲染层（跟随 gameWorldRoot 缩放） */
  readonly entityLayer: Container;
  /** 弹射物层（跟随 gameWorldRoot 缩放） */
  readonly projectileLayer: Container;
  /** UI 层（始终铺满窗口，不随游戏世界缩放） */
  readonly uiLayer: Container;

  private readonly config: RendererConfig;
  /** 包裹游戏世界的根容器，负责居中缩放 */
  private readonly gameWorldRoot: Container;
  private readonly backgroundLayer: Container;
  private readonly gridLayer: Container;
  private weatherState: WeatherVisualState | null = null;
  private readonly weatherTick: (ticker: Ticker) => void;

  constructor(config: RendererConfig) {
    this.config = config;
    this.app = new Application();
    this.gameWorldRoot = new Container();
    this.mapLayer = new Container();
    this.entityLayer = new Container();
    this.projectileLayer = new Container();
    this.uiLayer = new Container();
    this.backgroundLayer = new Container();
    this.gridLayer = new Container();
    this.weatherTick = (ticker) => {
      this.updateWeatherAnimation(ticker.deltaMS / 1000);
    };
  }

  async init(): Promise<void> {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    await this.app.init({
      canvas: this.config.canvas,
      width: vw,
      height: vh,
      background: 0x000000,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    });

    this.mapLayer.addChild(this.backgroundLayer, this.gridLayer);
    this.gameWorldRoot.addChild(this.mapLayer, this.entityLayer, this.projectileLayer);
    this.app.stage.addChild(this.gameWorldRoot, this.uiLayer);

    this.drawGrid();
    this.applyWorldTransform(vw, vh);
    this.app.ticker.add(this.weatherTick);
  }

  /**
   * 窗口尺寸变化时调用。更新 renderer 分辨率并重新计算世界变换。
   */
  resize(vw: number, vh: number): void {
    this.app.renderer.resize(vw, vh);
    this.applyWorldTransform(vw, vh);
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const p = this.gameWorldRoot.toLocal({ x: screenX, y: screenY });
    return { x: p.x, y: p.y };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const p = this.gameWorldRoot.toGlobal({ x: worldX, y: worldY });
    return { x: p.x, y: p.y };
  }

  tickWeather(dt: number): void {
    this.updateWeatherAnimation(dt);
  }

  /**
   * 计算游戏世界在窗口中的居中缩放变换。
   * 使用 contain 策略：等比缩放使世界完整显示在窗口内，居中放置。
   */
  private applyWorldTransform(vw: number, vh: number): void {
    const { worldWidth, worldHeight } = this.config;
    const scaleX = vw / worldWidth;
    const scaleY = vh / worldHeight;
    const scale = Math.min(scaleX, scaleY);

    const scaledW = worldWidth * scale;
    const scaledH = worldHeight * scale;
    const offsetX = Math.round((vw - scaledW) / 2);
    const offsetY = Math.round((vh - scaledH) / 2);

    this.gameWorldRoot.scale.set(scale);
    this.gameWorldRoot.position.set(offsetX, offsetY);
  }

  drawGrid(): void {
    this.gridLayer.removeChildren();
    const { worldWidth, worldHeight, cellSize } = this.config;
    const grid = new Graphics();
    for (let x = 0; x <= worldWidth; x += cellSize) {
      grid.moveTo(x, 0).lineTo(x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += cellSize) {
      grid.moveTo(0, y).lineTo(worldWidth, y);
    }
    grid.stroke({ width: 1, color: 0x222a3a, alpha: 1 });
    this.gridLayer.addChild(grid);
  }

  drawLevelBackground(level: {
    mapCols: number;
    mapRows: number;
    tileSize: number;
    tiles: readonly (readonly string[])[];
    tileColors: Readonly<Record<string, number>>;
    obstacles?: readonly { type: string; row: number; col: number }[];
    sceneDescription?: string;
    weather?: { pool: readonly string[]; initial?: string };
  }): void {
    this.backgroundLayer.removeChildren();
    this.weatherState = null;
    const scene = (level.sceneDescription ?? '').toLowerCase();
    const weather = normalizeWeather((level.weather?.initial ?? level.weather?.pool[0] ?? '').toLowerCase());
    const w = level.mapCols * level.tileSize;
    const h = level.mapRows * level.tileSize;
    const obstacleByCell = new Map((level.obstacles ?? []).map((ob) => [`${ob.row},${ob.col}`, ob.type]));

    const sky = new Graphics();
    const topColor = scene.includes('雪') || scene.includes('极北') || scene.includes('冰') ? 0xa7c7e7
      : scene.includes('沙') ? 0xe6c27a
      : scene.includes('蒸汽') || scene.includes('工厂') ? 0x4f5b62
      : 0x7fbf7f;
    const bottomColor = scene.includes('雪') || scene.includes('极北') || scene.includes('冰') ? 0xdfeaf4
      : scene.includes('沙') ? 0xc49a5a
      : scene.includes('蒸汽') || scene.includes('工厂') ? 0x263238
      : 0x355e3b;
    sky.rect(0, 0, w, h * 0.55).fill({ color: topColor, alpha: 1 });
    sky.rect(0, h * 0.55, w, h * 0.45).fill({ color: bottomColor, alpha: 1 });
    this.backgroundLayer.addChild(sky);

    const atmosphere = new Graphics();
    const atmosphereColor = scene.includes('雪') ? 0xffffff : scene.includes('沙') ? 0xffe0b2 : scene.includes('蒸汽') ? 0xb0bec5 : 0xc8e6c9;
    for (let i = 0; i < 6; i++) {
      const bandY = (h / 7) * i;
      atmosphere.roundRect((i % 2) * 40, bandY, w - 80, h / 10, 24).fill({ color: atmosphereColor, alpha: 0.06 + i * 0.01 });
    }
    this.backgroundLayer.addChild(atmosphere);

    const board = new Graphics();
    for (let row = 0; row < level.mapRows; row++) {
      for (let col = 0; col < level.mapCols; col++) {
        const tile = level.tiles[row]?.[col] ?? 'empty';
        const color = level.tileColors[tile] ?? level.tileColors.empty ?? 0x304b3d;
        const x = col * level.tileSize;
        const y = row * level.tileSize;
        board.rect(x, y, level.tileSize, level.tileSize).fill({ color, alpha: tile === 'empty' ? 0.95 : 1 });
        if (tile === 'path' || tile === 'spawn' || tile === 'base') {
          board.rect(x + 8, y + 8, level.tileSize - 16, level.tileSize - 16).stroke({ width: 3, color: 0xffffff, alpha: 0.14 });
        }
        if (scene.includes('雪') && tile === 'empty' && (row + col) % 5 === 0) {
          board.circle(x + level.tileSize * 0.24, y + level.tileSize * 0.26, 3).fill({ color: 0xffffff, alpha: 0.35 });
          board.circle(x + level.tileSize * 0.7, y + level.tileSize * 0.62, 2).fill({ color: 0xe3f2fd, alpha: 0.28 });
        }
        if ((scene.includes('蒸汽') || weather === 'smog') && tile === 'empty' && row % 3 === 1 && col % 4 === 0) {
          board.circle(x + level.tileSize * 0.5, y + level.tileSize * 0.35, level.tileSize * 0.14).fill({ color: 0xcfd8dc, alpha: 0.18 });
        }
        if ((scene.includes('菌') || weather === 'spore') && tile === 'empty' && (row + col) % 4 === 1) {
          board.circle(x + level.tileSize * 0.3, y + level.tileSize * 0.68, 5).fill({ color: 0xce93d8, alpha: 0.22 });
        }
        if (tile === 'blocked') {
          board.rect(x + 10, y + 10, level.tileSize - 20, level.tileSize - 20).stroke({ width: 2, color: 0x263238, alpha: 0.65 });
        }

        const obstacleType = obstacleByCell.get(`${row},${col}`) ?? '';
        if (obstacleType === 'ice_tile') {
          board.roundRect(x + 6, y + 6, level.tileSize - 12, level.tileSize - 12, 10).stroke({ width: 2, color: 0xe1f5fe, alpha: 0.9 });
          board.moveTo(x + 14, y + 20).lineTo(x + level.tileSize - 14, y + level.tileSize - 20);
          board.moveTo(x + level.tileSize * 0.35, y + 12).lineTo(x + level.tileSize * 0.7, y + level.tileSize - 14);
          board.stroke({ width: 2, color: 0xb3e5fc, alpha: 0.5 });
        }
        if (obstacleType === 'conveyor_belt') {
          board.roundRect(x + 4, y + 18, level.tileSize - 8, level.tileSize - 36, 8).fill({ color: 0x8d6e63, alpha: 0.45 });
          for (let i = 0; i < 3; i++) {
            const cx = x + 16 + i * 16;
            board.moveTo(cx, y + level.tileSize * 0.35).lineTo(cx + 10, y + level.tileSize * 0.5).lineTo(cx, y + level.tileSize * 0.65);
          }
          board.stroke({ width: 3, color: 0xffcc80, alpha: 0.65 });
        }
        if (obstacleType === 'spore_pod') {
          board.circle(x + level.tileSize * 0.5, y + level.tileSize * 0.5, level.tileSize * 0.18).fill({ color: 0xab47bc, alpha: 0.55 });
          board.circle(x + level.tileSize * 0.34, y + level.tileSize * 0.4, level.tileSize * 0.08).fill({ color: 0xe1bee7, alpha: 0.45 });
          board.circle(x + level.tileSize * 0.66, y + level.tileSize * 0.6, level.tileSize * 0.06).fill({ color: 0xe1bee7, alpha: 0.35 });
        }
        if (obstacleType === 'water_pool') {
          board.ellipse(x + level.tileSize * 0.5, y + level.tileSize * 0.52, level.tileSize * 0.28, level.tileSize * 0.18).fill({ color: 0x4fc3f7, alpha: 0.38 });
          board.ellipse(x + level.tileSize * 0.46, y + level.tileSize * 0.48, level.tileSize * 0.18, level.tileSize * 0.08).fill({ color: 0xb3e5fc, alpha: 0.28 });
        }
      }
    }
    this.backgroundLayer.addChild(board);

    const weatherOverlay = new Graphics();
    this.backgroundLayer.addChild(weatherOverlay);
    this.weatherState = { kind: weather, width: w, height: h, time: 0, overlay: weatherOverlay };
    this.redrawWeatherOverlay(this.weatherState);
    this.drawGrid();
  }

  private updateWeatherAnimation(dt: number): void {
    if (!this.weatherState || dt <= 0) return;
    this.weatherState.time += dt;
    this.redrawWeatherOverlay(this.weatherState);
  }

  private redrawWeatherOverlay(state: WeatherVisualState): void {
    const { overlay, width: w, height: h, time, kind } = state;
    overlay.clear();

    if (kind === 'blizzard') {
      overlay.rect(0, 0, w, h).fill({ color: 0xdfeaf4, alpha: 0.04 + Math.sin(time * 1.2) * 0.015 });
      for (let i = 0; i < 24; i++) {
        const px = (i * 79 + time * 120) % (w + 40) - 20;
        const py = (i * 43 + time * 65) % (h + 30) - 15;
        overlay.moveTo(px, py).lineTo(px + 18, py - 10);
      }
      overlay.stroke({ width: 2, color: 0xffffff, alpha: 0.18 });
      return;
    }

    if (kind === 'rain') {
      overlay.rect(0, 0, w, h).fill({ color: 0x10263f, alpha: 0.02 });
      for (let i = 0; i < 28; i++) {
        const px = (i * 61 + time * 210) % (w + 50) - 25;
        const py = (i * 37 + time * 170) % (h + 40) - 20;
        overlay.moveTo(px, py).lineTo(px - 10, py + 24);
      }
      overlay.stroke({ width: 2, color: 0xb3e5fc, alpha: 0.18 });
      return;
    }

    if (kind === 'sand') {
      overlay.rect(0, 0, w, h).fill({ color: 0xffd180, alpha: 0.03 + Math.sin(time) * 0.01 });
      for (let i = 0; i < 18; i++) {
        const px = (i * 73 + time * 55) % (w + 60) - 30;
        const py = (i * 47 + Math.sin(time * 1.4 + i) * 14 + h) % h;
        overlay.ellipse(px, py, 14, 5).fill({ color: 0xffd180, alpha: 0.12 });
      }
      return;
    }

    if (kind === 'smog') {
      for (let i = 0; i < 5; i++) {
        const drift = ((time * (12 + i * 2)) + i * 90) % 120;
        overlay.roundRect(-80 + drift, 40 + (i % 2) * 90, w - 20, 42, 20).fill({ color: 0x90a4ae, alpha: 0.08 + i * 0.01 });
      }
      return;
    }

    if (kind === 'spore' || kind === 'fog') {
      const color = kind === 'spore' ? 0xba68c8 : 0xcfd8dc;
      for (let i = 0; i < 7; i++) {
        const pulse = 30 + Math.sin(time * 1.3 + i) * 8;
        const px = 80 + ((i * 170 + time * 18) % (w + 180)) - 90;
        const py = 70 + (i % 3) * 120 + Math.cos(time + i) * 8;
        overlay.circle(px, py, pulse).fill({ color, alpha: 0.08 });
      }
    }
  }

  private legacyDrawGrid(): void {
    const { worldWidth, worldHeight, cellSize } = this.config;
    const grid = new Graphics();
    for (let x = 0; x <= worldWidth; x += cellSize) {
      grid.moveTo(x, 0).lineTo(x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += cellSize) {
      grid.moveTo(0, y).lineTo(worldWidth, y);
    }
    grid.stroke({ width: 1, color: 0x222a3a, alpha: 1 });
    this.mapLayer.addChild(grid);
  }
}

function normalizeWeather(raw: string): WeatherKind {
  if (raw.includes('blizzard') || raw.includes('snow')) return 'blizzard';
  if (raw.includes('rain') || raw.includes('storm')) return 'rain';
  if (raw.includes('sand')) return 'sand';
  if (raw.includes('smog')) return 'smog';
  if (raw.includes('spore')) return 'spore';
  if (raw.includes('fog')) return 'fog';
  return 'none';
}
