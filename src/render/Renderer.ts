import { Application, Container, Graphics } from 'pixi.js';

export interface RendererConfig {
  readonly canvas: HTMLCanvasElement;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly cellSize: number;
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

  constructor(config: RendererConfig) {
    this.config = config;
    this.app = new Application();
    this.gameWorldRoot = new Container();
    this.mapLayer = new Container();
    this.entityLayer = new Container();
    this.projectileLayer = new Container();
    this.uiLayer = new Container();
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

    this.gameWorldRoot.addChild(this.mapLayer, this.entityLayer, this.projectileLayer);
    this.app.stage.addChild(this.gameWorldRoot, this.uiLayer);

    this.drawGrid();
    this.applyWorldTransform(vw, vh);
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

  private drawGrid(): void {
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
