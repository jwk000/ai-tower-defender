import { Application, Container, Graphics, type Ticker } from 'pixi.js';

export interface RendererConfig {
  readonly canvas: HTMLCanvasElement;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly cellSize: number;
}

type WeatherKind = 'blizzard' | 'rain' | 'sand' | 'smog' | 'spore' | 'fog' | 'none';

type TerrainEffectKind = 'ice_tile' | 'conveyor_belt' | 'spore_pod' | 'water_pool' | 'void_rift';

type TerrainEffectDirection = 'right';

type WeatherLayerKind = 'front' | 'back';

interface WeatherDriftLayer {
  readonly kind: WeatherLayerKind;
  readonly speed: number;
  readonly alphaScale: number;
}

interface WeatherVisualState {
  readonly kind: WeatherKind;
  readonly width: number;
  readonly height: number;
  time: number;
  readonly overlay: Graphics;
  readonly layers: readonly WeatherDriftLayer[];
}

interface TerrainEffectCell {
  readonly type: TerrainEffectKind;
  readonly row: number;
  readonly col: number;
  readonly direction?: TerrainEffectDirection;
}

interface TerrainEffectState {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  time: number;
  readonly overlay: Graphics;
  readonly cells: readonly TerrainEffectCell[];
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
  private terrainEffectState: TerrainEffectState | null = null;
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
    this.terrainEffectState = null;
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
    const terrainEffects = new Graphics();
    const terrainCells: TerrainEffectCell[] = [];
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
          terrainCells.push({ type: 'ice_tile', row, col });
          board.roundRect(x + 6, y + 6, level.tileSize - 12, level.tileSize - 12, 10).stroke({ width: 2, color: 0xe1f5fe, alpha: 0.9 });
          board.moveTo(x + 14, y + 20).lineTo(x + level.tileSize - 14, y + level.tileSize - 20);
          board.moveTo(x + level.tileSize * 0.35, y + 12).lineTo(x + level.tileSize * 0.7, y + level.tileSize - 14);
          board.stroke({ width: 2, color: 0xb3e5fc, alpha: 0.5 });
        }
        if (obstacleType === 'conveyor_belt') {
          terrainCells.push({ type: 'conveyor_belt', row, col, direction: 'right' });
          board.roundRect(x + 4, y + 18, level.tileSize - 8, level.tileSize - 36, 8).fill({ color: 0x8d6e63, alpha: 0.45 });
          for (let i = 0; i < 3; i++) {
            const cx = x + 16 + i * 16;
            board.moveTo(cx, y + level.tileSize * 0.35).lineTo(cx + 10, y + level.tileSize * 0.5).lineTo(cx, y + level.tileSize * 0.65);
          }
          board.stroke({ width: 3, color: 0xffcc80, alpha: 0.65 });
        }
        if (obstacleType === 'spore_pod') {
          terrainCells.push({ type: 'spore_pod', row, col });
          board.circle(x + level.tileSize * 0.5, y + level.tileSize * 0.5, level.tileSize * 0.18).fill({ color: 0xab47bc, alpha: 0.55 });
          board.circle(x + level.tileSize * 0.34, y + level.tileSize * 0.4, level.tileSize * 0.08).fill({ color: 0xe1bee7, alpha: 0.45 });
          board.circle(x + level.tileSize * 0.66, y + level.tileSize * 0.6, level.tileSize * 0.06).fill({ color: 0xe1bee7, alpha: 0.35 });
        }
        if (obstacleType === 'water_pool') {
          terrainCells.push({ type: 'water_pool', row, col });
          board.ellipse(x + level.tileSize * 0.5, y + level.tileSize * 0.52, level.tileSize * 0.28, level.tileSize * 0.18).fill({ color: 0x4fc3f7, alpha: 0.38 });
          board.ellipse(x + level.tileSize * 0.46, y + level.tileSize * 0.48, level.tileSize * 0.18, level.tileSize * 0.08).fill({ color: 0xb3e5fc, alpha: 0.28 });
        }
        if (obstacleType === 'void_rift') {
          terrainCells.push({ type: 'void_rift', row, col });
          board.circle(x + level.tileSize * 0.5, y + level.tileSize * 0.5, level.tileSize * 0.24).fill({ color: 0x311b92, alpha: 0.34 });
          board.circle(x + level.tileSize * 0.5, y + level.tileSize * 0.5, level.tileSize * 0.18).stroke({ width: 3, color: 0xea80fc, alpha: 0.78 });
          board.moveTo(x + level.tileSize * 0.5, y + level.tileSize * 0.18)
            .lineTo(x + level.tileSize * 0.82, y + level.tileSize * 0.5)
            .lineTo(x + level.tileSize * 0.5, y + level.tileSize * 0.82)
            .lineTo(x + level.tileSize * 0.18, y + level.tileSize * 0.5)
            .lineTo(x + level.tileSize * 0.5, y + level.tileSize * 0.18);
          board.stroke({ width: 2, color: 0xb388ff, alpha: 0.52 });
        }
      }
    }
    this.backgroundLayer.addChild(board);

    this.backgroundLayer.addChild(terrainEffects);
    if (terrainCells.length > 0) {
      this.terrainEffectState = {
        width: w,
        height: h,
        tileSize: level.tileSize,
        time: 0,
        overlay: terrainEffects,
        cells: terrainCells,
      };
      this.redrawTerrainEffects(this.terrainEffectState);
    }

    const weatherOverlay = new Graphics();
    this.backgroundLayer.addChild(weatherOverlay);
    this.weatherState = {
      kind: weather,
      width: w,
      height: h,
      time: 0,
      overlay: weatherOverlay,
      layers: createWeatherLayers(weather),
    };
    this.redrawWeatherOverlay(this.weatherState);
    this.drawGrid();
  }

  private updateWeatherAnimation(dt: number): void {
    if (dt <= 0) return;
    if (this.terrainEffectState) {
      this.terrainEffectState.time += dt;
      this.redrawTerrainEffects(this.terrainEffectState);
    }
    if (!this.weatherState) return;
    this.weatherState.time += dt;
    this.redrawWeatherOverlay(this.weatherState);
  }

  private redrawTerrainEffects(state: TerrainEffectState): void {
    const { overlay, tileSize, time, cells } = state;
    overlay.clear();

    for (const cell of cells) {
      const x = cell.col * tileSize;
      const y = cell.row * tileSize;
      if (cell.type === 'ice_tile') {
        const shimmer = 0.18 + ((Math.sin(time * 2.2 + cell.row + cell.col) + 1) * 0.5) * 0.12;
        const frostDrift = Math.sin(time * 1.4 + cell.col * 0.7) * 3;
        overlay.roundRect(x + 8, y + 8, tileSize - 16, tileSize - 16, 10).fill({ color: 0xe1f5fe, alpha: shimmer });
        overlay.roundRect(x + 14, y + 14, tileSize - 28, tileSize - 28, 8).stroke({ width: 2, color: 0xffffff, alpha: shimmer * 1.4 });
        overlay.ellipse(x + tileSize * 0.38 + frostDrift, y + tileSize * 0.28, tileSize * 0.16, tileSize * 0.06).fill({ color: 0xf8fdff, alpha: shimmer * 0.4 });
        overlay.ellipse(x + tileSize * 0.62 - frostDrift * 0.5, y + tileSize * 0.72, tileSize * 0.18, tileSize * 0.07).fill({ color: 0xe3f2fd, alpha: shimmer * 0.28 });
        continue;
      }

      if (cell.type === 'conveyor_belt') {
        const offset = ((time * 24) + (cell.row + cell.col) * 6) % 18;
        for (let i = -1; i < 3; i++) {
          const cx = x + 12 + i * 18 + offset;
          overlay.moveTo(cx, y + tileSize * 0.38).lineTo(cx + 8, y + tileSize * 0.5).lineTo(cx, y + tileSize * 0.62);
        }
        overlay.stroke({ width: 2.5, color: 0xffe0b2, alpha: 0.55 });
        const arrowX = x + tileSize * (0.3 + ((time * 0.9) % 0.45));
        overlay.moveTo(arrowX, y + tileSize * 0.5).lineTo(arrowX + 14, y + tileSize * 0.5);
        overlay.moveTo(arrowX + 8, y + tileSize * 0.42).lineTo(arrowX + 14, y + tileSize * 0.5).lineTo(arrowX + 8, y + tileSize * 0.58);
        overlay.stroke({ width: 3, color: 0xfff3e0, alpha: 0.72 });
        continue;
      }

      if (cell.type === 'spore_pod') {
        const pulse = 0.16 + ((Math.sin(time * 3 + cell.row) + 1) * 0.5) * 0.12;
        overlay.circle(x + tileSize * 0.5, y + tileSize * 0.5, tileSize * (0.22 + pulse * 0.2)).fill({ color: 0xce93d8, alpha: pulse });
        overlay.circle(x + tileSize * 0.5, y + tileSize * 0.5, tileSize * (0.28 + pulse * 0.16)).stroke({ width: 1.5, color: 0xf3e5f5, alpha: pulse * 0.45 });
        for (let i = 0; i < 3; i++) {
          const driftX = x + tileSize * (0.3 + i * 0.16) + Math.sin(time * (1.2 + i * 0.3) + cell.col) * 3;
          const driftY = y + tileSize * (0.28 + i * 0.12) - ((time * (10 + i * 2) + i * 7) % 16);
          overlay.circle(driftX, driftY, 3 + i).fill({ color: 0xf3e5f5, alpha: 0.18 + i * 0.05 });
        }
        continue;
      }

      if (cell.type === 'water_pool') {
        const ripple = ((Math.sin(time * 2.6 + cell.col) + 1) * 0.5);
        const foamX = x + tileSize * (0.32 + ripple * 0.22);
        overlay.ellipse(x + tileSize * 0.5, y + tileSize * 0.52, tileSize * (0.2 + ripple * 0.08), tileSize * (0.09 + ripple * 0.03)).stroke({ width: 2, color: 0xe1f5fe, alpha: 0.28 + ripple * 0.16 });
        overlay.ellipse(x + tileSize * 0.5, y + tileSize * 0.52, tileSize * (0.28 + ripple * 0.04), tileSize * (0.16 + ripple * 0.02)).stroke({ width: 1.5, color: 0xb3e5fc, alpha: 0.18 + ripple * 0.1 });
        overlay.circle(foamX, y + tileSize * 0.44, 3).fill({ color: 0xf5fbff, alpha: 0.24 + ripple * 0.18 });
        continue;
      }

      if (cell.type === 'void_rift') {
        const pulse = 0.24 + ((Math.sin(time * 2.4 + cell.row * 0.9 + cell.col * 0.6) + 1) * 0.5) * 0.22;
        const swirl = (time * 1.6 + (cell.row + cell.col) * 0.2) % (Math.PI * 2);
        overlay.circle(x + tileSize * 0.5, y + tileSize * 0.5, tileSize * 0.16 + pulse * 10).stroke({ width: 3, color: 0xea80fc, alpha: pulse * 1.2 });
        overlay.circle(x + tileSize * 0.5, y + tileSize * 0.5, tileSize * 0.08).fill({ color: 0x12005e, alpha: 0.45 + pulse * 0.3 });
        overlay.moveTo(x + tileSize * 0.5, y + tileSize * 0.5)
          .lineTo(x + tileSize * (0.5 + Math.cos(swirl) * 0.22), y + tileSize * (0.5 + Math.sin(swirl) * 0.22));
        overlay.moveTo(x + tileSize * 0.5, y + tileSize * 0.5)
          .lineTo(x + tileSize * (0.5 + Math.cos(swirl + Math.PI * 0.66) * 0.18), y + tileSize * (0.5 + Math.sin(swirl + Math.PI * 0.66) * 0.18));
        overlay.moveTo(x + tileSize * 0.5, y + tileSize * 0.5)
          .lineTo(x + tileSize * (0.5 + Math.cos(swirl + Math.PI * 1.33) * 0.2), y + tileSize * (0.5 + Math.sin(swirl + Math.PI * 1.33) * 0.2));
        overlay.stroke({ width: 2, color: 0xb388ff, alpha: 0.52 + pulse * 0.4 });
      }
    }
  }

  private redrawWeatherOverlay(state: WeatherVisualState): void {
    const { overlay, width: w, height: h, time, kind, layers } = state;
    overlay.clear();

    if (kind === 'blizzard') {
      const backLayer = layers[0] ?? { kind: 'back', speed: 1, alphaScale: 1 };
      const frontLayer = layers[1] ?? { kind: 'front', speed: 1.45, alphaScale: 1.3 };
      overlay.rect(0, 0, w, h).fill({ color: 0xdfeaf4, alpha: 0.035 + Math.sin(time * 1.2) * 0.012 });
      for (const layer of [backLayer, frontLayer]) {
        const density = layer.kind === 'back' ? 14 : 18;
        for (let i = 0; i < density; i++) {
          const px = (i * (layer.kind === 'back' ? 93 : 71) + time * 120 * layer.speed) % (w + 60) - 30;
          const py = (i * (layer.kind === 'back' ? 57 : 41) + time * (layer.kind === 'back' ? 52 : 86) * layer.speed) % (h + 50) - 25;
          const length = layer.kind === 'back' ? 14 : 24;
          const rise = layer.kind === 'back' ? 8 : 12;
          overlay.moveTo(px, py).lineTo(px + length, py - rise);
        }
        overlay.stroke({ width: layer.kind === 'back' ? 1.5 : 2.4, color: 0xffffff, alpha: (layer.kind === 'back' ? 0.1 : 0.2) * layer.alphaScale });
      }
      return;
    }

    if (kind === 'rain') {
      const backLayer = layers[0] ?? { kind: 'back', speed: 1, alphaScale: 1 };
      const frontLayer = layers[1] ?? { kind: 'front', speed: 1.55, alphaScale: 1.25 };
      overlay.rect(0, 0, w, h).fill({ color: 0x10263f, alpha: 0.018 });
      for (const layer of [backLayer, frontLayer]) {
        const density = layer.kind === 'back' ? 18 : 28;
        for (let i = 0; i < density; i++) {
          const px = (i * (layer.kind === 'back' ? 77 : 59) + time * 180 * layer.speed) % (w + 80) - 40;
          const py = (i * (layer.kind === 'back' ? 49 : 33) + time * 150 * layer.speed) % (h + 60) - 30;
          const dx = layer.kind === 'back' ? -8 : -12;
          const dy = layer.kind === 'back' ? 18 : 28;
          overlay.moveTo(px, py).lineTo(px + dx, py + dy);
        }
        overlay.stroke({ width: layer.kind === 'back' ? 1.6 : 2.4, color: 0xb3e5fc, alpha: (layer.kind === 'back' ? 0.1 : 0.18) * layer.alphaScale });
      }
      return;
    }

    if (kind === 'sand') {
      overlay.rect(0, 0, w, h).fill({ color: 0xffd180, alpha: 0.03 + Math.sin(time) * 0.01 });
      for (const layer of layers) {
        const density = layer.kind === 'back' ? 10 : 16;
        for (let i = 0; i < density; i++) {
          const px = (i * (layer.kind === 'back' ? 91 : 67) + time * 48 * layer.speed) % (w + 90) - 45;
          const py = (i * 47 + Math.sin(time * (1.1 + layer.speed * 0.2) + i) * (layer.kind === 'back' ? 10 : 18) + h) % h;
          overlay.ellipse(px, py, layer.kind === 'back' ? 10 : 16, layer.kind === 'back' ? 4 : 6).fill({ color: 0xffd180, alpha: (layer.kind === 'back' ? 0.08 : 0.13) * layer.alphaScale });
        }
      }
      return;
    }

    if (kind === 'smog') {
      for (const layer of layers) {
        const bandCount = layer.kind === 'back' ? 3 : 4;
        for (let i = 0; i < bandCount; i++) {
          const drift = ((time * (10 + i * 2)) * layer.speed + i * 110) % 180;
          const y = 36 + (layer.kind === 'back' ? i * 120 : i * 92);
          const height = layer.kind === 'back' ? 34 : 44;
          overlay.roundRect(-120 + drift, y, w + 80, height, 22).fill({ color: 0x90a4ae, alpha: (layer.kind === 'back' ? 0.05 : 0.08) * layer.alphaScale });
        }
      }
      return;
    }

    if (kind === 'spore' || kind === 'fog') {
      const color = kind === 'spore' ? 0xba68c8 : 0xcfd8dc;
      for (const layer of layers) {
        const count = layer.kind === 'back' ? 4 : 7;
        for (let i = 0; i < count; i++) {
          const pulse = (layer.kind === 'back' ? 22 : 30) + Math.sin(time * (1.1 + layer.speed * 0.2) + i) * (layer.kind === 'back' ? 5 : 8);
          const px = 70 + ((i * (layer.kind === 'back' ? 220 : 170) + time * 18 * layer.speed) % (w + 220)) - 110;
          const py = 60 + (i % 3) * (layer.kind === 'back' ? 140 : 120) + Math.cos(time * layer.speed + i) * (layer.kind === 'back' ? 6 : 10);
          overlay.circle(px, py, pulse).fill({ color, alpha: (layer.kind === 'back' ? 0.045 : 0.08) * layer.alphaScale });
        }
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

function createWeatherLayers(kind: WeatherKind): readonly WeatherDriftLayer[] {
  if (kind === 'none') return [];
  return [
    { kind: 'back', speed: 0.7, alphaScale: 0.9 },
    { kind: 'front', speed: 1.35, alphaScale: 1.1 },
  ];
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
