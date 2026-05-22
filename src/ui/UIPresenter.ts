import { Container, Graphics, Text } from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';

import type { LevelConfig } from '../config/loader.js';

import type { CardRegistry } from '../unit-system/CardRegistry.js';
import type { HandPanel, HandState, PendingDrawCard } from './HandPanel.js';
import { hitTestDrawAction, hitTestDrawButton, hitTestHandSlot, layoutHand, HAND_MAX_CARDS } from './HandPanel.js';
import type { RunState } from './HUD.js';
import { projectHUD } from './HUD.js';

export interface UIPresenterConfig {
  readonly battleContainer: Container;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly cellSize?: number;
  readonly handPanel?: HandPanel;
  readonly cardRegistry?: CardRegistry;
  readonly onExitBattle?: () => void;
  readonly onDebugVictory?: () => void;
  readonly onDrawCard?: () => void;
  readonly onConfirmDrawCard?: () => void;
  readonly onRedrawCard?: () => void;
  readonly screenToWorld?: (sx: number, sy: number) => { x: number; y: number };
  readonly worldToScreen?: (wx: number, wy: number) => { x: number; y: number };
  readonly getLevelConfig?: () => LevelConfig | null;
}

export interface UIFrame {
  readonly run: RunState;
  readonly hand: HandState;
}

type FlyingCardAnimation = {
  readonly cardId: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly duration: number;
  readonly delay: number;
  readonly autoCommit: boolean;
  readonly phase: 'to-preview' | 'to-hand';
  elapsed: number;
};

export class UIPresenter {
  private readonly battleContainer: Container;
  private viewportWidth: number;
  private viewportHeight: number;

  private readonly hudContainer: Container;
  private readonly handContainer: Container;
  private readonly hudBackground: Graphics;
  private readonly handBackground: Graphics;
  private readonly goldText: Text;
  private readonly crystalText: Text;
  private readonly waveText: Text;
  private readonly enemyText: Text;
  private readonly runText: Text;
  private readonly phaseText: Text;
  private readonly passiveText: Text;
  private readonly energyText: Text;
  private readonly drawText: Text;
  private readonly slotGraphics: Graphics;
  private readonly slotLabels: Text[] = [];
  private readonly exitBtnGraphics: Graphics;
  private readonly exitBtnText: Text;
  private readonly debugVictoryGraphics: Graphics;
  private readonly debugVictoryText: Text;
  private readonly drawButtonGraphics: Graphics;
  private readonly drawButtonText: Text;
  private readonly drawDeckIconGraphics: Graphics;
  private readonly drawPreviewGraphics: Graphics;
  private readonly drawPreviewText: Text;
  private readonly confirmButtonGraphics: Graphics;
  private readonly confirmButtonText: Text;
  private readonly redrawButtonGraphics: Graphics;
  private readonly redrawButtonText: Text;

  private readonly handPanel: HandPanel | null;
  private readonly cardRegistry: CardRegistry | null;
  private readonly onExitBattle: (() => void) | null;
  private readonly onDebugVictory: (() => void) | null;
  private readonly onDrawCard: (() => void) | null;
  private readonly onConfirmDrawCard: (() => void) | null;
  private readonly onRedrawCard: (() => void) | null;
  private readonly cellSize: number;
  private readonly screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  private readonly worldToScreen: (wx: number, wy: number) => { x: number; y: number };
  private readonly getLevelConfig: () => LevelConfig | null;
  private lastHandState: HandState = { cards: [], energy: 0, energyMax: 10, drawState: 'ready', drawCooldownSeconds: 0 };
  private lastFrameRun: RunState | null = null;
  private flyingDrawCard: FlyingCardAnimation | null = null;
  private flyingDrawCardGraphics: Graphics | null = null;
  private flyingDrawCardText: Text | null = null;
  private autoCommitScheduled = false;
  private dragSlot: number | null = null;
  private ghostCard: Graphics | null = null;
  private ghostCell: Graphics | null = null;

  private readonly EXIT_BTN = { x: 0, y: 0, w: 140, h: 40 } as { x: number; y: number; w: number; h: number };
  private readonly DEBUG_VICTORY_BTN = { x: 0, y: 0, w: 140, h: 40 } as { x: number; y: number; w: number; h: number };

  constructor(config: UIPresenterConfig) {
    this.battleContainer = config.battleContainer;
    this.viewportWidth = config.viewportWidth;
    this.viewportHeight = config.viewportHeight;
    this.handPanel = config.handPanel ?? null;
    this.cardRegistry = config.cardRegistry ?? null;
    this.onExitBattle = config.onExitBattle ?? null;
    this.onDebugVictory = config.onDebugVictory ?? null;
    this.onDrawCard = config.onDrawCard ?? null;
    this.onConfirmDrawCard = config.onConfirmDrawCard ?? null;
    this.onRedrawCard = config.onRedrawCard ?? null;
    this.cellSize = config.cellSize ?? 64;
    this.screenToWorld = config.screenToWorld ?? ((sx, sy) => ({ x: sx, y: sy }));
    this.worldToScreen = config.worldToScreen ?? ((wx, wy) => ({ x: wx, y: wy }));
    this.getLevelConfig = config.getLevelConfig ?? (() => null);

    this.EXIT_BTN.x = this.viewportWidth - 148;
    this.EXIT_BTN.y = 14;
    this.DEBUG_VICTORY_BTN.x = this.viewportWidth - 148;
    this.DEBUG_VICTORY_BTN.y = 62;

    this.hudContainer = new Container();
    this.handContainer = new Container();
    this.handContainer.eventMode = 'static';
    this.handContainer.hitArea = { contains: () => true };
    this.handContainer.zIndex = 1000;
    this.battleContainer.addChild(this.hudContainer, this.handContainer);

    this.hudBackground = new Graphics();
    this.handBackground = new Graphics();

    const createHudText = (fill: number, fontSize = 18) => new Text({
      text: '',
      style: { fill, fontSize, fontWeight: '600' },
    });

    this.goldText = createHudText(0xffd54f);
    this.crystalText = createHudText(0x4fc3f7);
    this.waveText = createHudText(0xffffff);
    this.enemyText = createHudText(0xff8a80);
    this.runText = createHudText(0xa5d6a7);
    this.phaseText = createHudText(0xb0bec5, 16);
    this.passiveText = new Text({
      text: '',
      style: { fill: 0xfff59d, fontSize: 14, fontWeight: '500', wordWrap: true, wordWrapWidth: 460 },
    });
    this.hudContainer.addChild(
      this.hudBackground,
      this.goldText,
      this.crystalText,
      this.waveText,
      this.enemyText,
      this.runText,
      this.phaseText,
      this.passiveText,
    );

    this.energyText = new Text({ text: '', style: { fill: 0x80cbc4, fontSize: 18, fontWeight: '600' } });
    this.drawText = new Text({ text: '', style: { fill: 0xb0bec5, fontSize: 16, fontWeight: '500' } });
    this.slotGraphics = new Graphics();
    this.drawButtonGraphics = new Graphics();
    this.drawButtonText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 16, fontWeight: '600' } });
    this.drawDeckIconGraphics = new Graphics();
    this.drawPreviewGraphics = new Graphics();
    this.drawPreviewText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 18, fontWeight: '700' } });
    this.drawPreviewText.anchor.set(0.5, 0.5);
    this.confirmButtonGraphics = new Graphics();
    this.confirmButtonText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 16, fontWeight: '600' } });
    this.confirmButtonText.anchor.set(0.5, 0.5);
    this.redrawButtonGraphics = new Graphics();
    this.redrawButtonText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 16, fontWeight: '600' } });
    this.redrawButtonText.anchor.set(0.5, 0.5);
    this.handContainer.addChild(
      this.handBackground,
      this.slotGraphics,
      this.drawDeckIconGraphics,
      this.drawButtonGraphics,
      this.energyText,
      this.drawText,
      this.drawButtonText,
      this.drawPreviewGraphics,
      this.drawPreviewText,
      this.confirmButtonGraphics,
      this.confirmButtonText,
      this.redrawButtonGraphics,
      this.redrawButtonText,
    );

    this.exitBtnGraphics = new Graphics();
    this.exitBtnText = new Text({ text: 'Exit Battle', style: { fill: 0xffffff, fontSize: 15, fontWeight: '600' } });
    this.exitBtnText.anchor.set(0.5, 0.5);
    this.debugVictoryGraphics = new Graphics();
    this.debugVictoryText = new Text({ text: '⚡ 直接胜利', style: { fill: 0xffffff, fontSize: 15, fontWeight: '600' } });
    this.debugVictoryText.anchor.set(0.5, 0.5);
    this.hudContainer.addChild(this.exitBtnGraphics, this.exitBtnText, this.debugVictoryGraphics, this.debugVictoryText);
    this.drawExitButton();
    this.drawDebugVictoryButton();

    this.bindHandEvents();
  }

  private drawExitButton(): void {
    const b = this.EXIT_BTN;
    this.exitBtnGraphics.clear();
    this.exitBtnGraphics.roundRect(b.x, b.y, b.w, b.h, 12).fill({ color: 0x5d1a1a, alpha: 0.94 });
    this.exitBtnGraphics.roundRect(b.x, b.y, b.w, b.h, 12).stroke({ width: 2, color: 0xff5252 });
    this.exitBtnText.position.set(b.x + b.w / 2, b.y + b.h / 2);
  }

  private drawDebugVictoryButton(): void {
    const b = this.DEBUG_VICTORY_BTN;
    this.debugVictoryGraphics.clear();
    this.debugVictoryGraphics.roundRect(b.x, b.y, b.w, b.h, 12).fill({ color: 0x1a3d1a, alpha: 0.94 });
    this.debugVictoryGraphics.roundRect(b.x, b.y, b.w, b.h, 12).stroke({ width: 2, color: 0x69f0ae });
    this.debugVictoryText.position.set(b.x + b.w / 2, b.y + b.h / 2);
  }

  private drawHudBackground(): void {
    this.hudBackground.clear();
    this.hudBackground.roundRect(12, 10, this.viewportWidth - 24, 112, 18).fill({ color: 0x0f1720, alpha: 0.78 });
    this.hudBackground.roundRect(12, 10, this.viewportWidth - 24, 112, 18).stroke({ width: 2, color: 0x5c6b7a, alpha: 0.95 });

    const midX = this.viewportWidth / 2;
    this.hudBackground.roundRect(midX - 1, 22, 2, 88, 1).fill({ color: 0x5c6b7a, alpha: 0.45 });
  }

  private drawHandBackground(layout: ReturnType<typeof layoutHand>): void {
    this.handBackground.clear();
    this.handBackground.roundRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, 22)
      .fill({ color: 0x101820, alpha: 0.88 });
    this.handBackground.roundRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, 22)
      .stroke({ width: 2, color: 0x607d8b, alpha: 0.95 });
  }

  private drawDeckIcon(layout: ReturnType<typeof layoutHand>): void {
    const icon = layout.drawDeckIcon;
    this.drawDeckIconGraphics.clear();
    this.drawDeckIconGraphics.roundRect(icon.x, icon.y, icon.width, icon.height, 16)
      .fill({ color: 0x16222d, alpha: 0.96 });
    this.drawDeckIconGraphics.roundRect(icon.x, icon.y, icon.width, icon.height, 16)
      .stroke({ width: 2, color: 0x90caf9, alpha: 0.95 });
    this.drawDeckIconGraphics.roundRect(icon.x + 14, icon.y + 12, icon.width - 28, icon.height - 24, 12)
      .fill({ color: 0x1f3b52, alpha: 0.92 });
    this.drawDeckIconGraphics.roundRect(icon.x + 14, icon.y + 12, icon.width - 28, icon.height - 24, 12)
      .stroke({ width: 2, color: 0xe3f2fd, alpha: 0.85 });
    this.drawDeckIconGraphics.moveTo(icon.x + 22, icon.y + 28)
      .lineTo(icon.x + icon.width - 22, icon.y + 28)
      .stroke({ width: 2, color: 0xbbdefb, alpha: 0.75 });
    this.drawDeckIconGraphics.moveTo(icon.x + 22, icon.y + 42)
      .lineTo(icon.x + icon.width - 22, icon.y + 42)
      .stroke({ width: 2, color: 0xbbdefb, alpha: 0.55 });
  }

  private isExitBtnHit(x: number, y: number): boolean {
    const b = this.EXIT_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  private isDebugVictoryBtnHit(x: number, y: number): boolean {
    const b = this.DEBUG_VICTORY_BTN;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  private bindHandEvents(): void {
    this.confirmButtonGraphics.eventMode = 'static';
    this.confirmButtonText.eventMode = 'static';
    this.redrawButtonGraphics.eventMode = 'static';
    this.redrawButtonText.eventMode = 'static';
    this.confirmButtonGraphics.cursor = 'pointer';
    this.confirmButtonText.cursor = 'pointer';
    this.redrawButtonGraphics.cursor = 'pointer';
    this.redrawButtonText.cursor = 'pointer';
    this.handContainer.on('pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
    this.handContainer.on('pointermove', (e: FederatedPointerEvent) => this.onPointerMove(e));
    this.handContainer.on('pointerup', (e: FederatedPointerEvent) => this.onPointerUp(e));
    this.handContainer.on('pointerupoutside', () => this.clearDrag());
    this.drawButtonGraphics.on('pointertap', (e: FederatedPointerEvent) => this.onDrawButtonTap(e));
    this.drawButtonText.on('pointertap', (e: FederatedPointerEvent) => this.onDrawButtonTap(e));
    this.confirmButtonGraphics.on('pointertap', (e: FederatedPointerEvent) => this.onConfirmDrawTap(e));
    this.confirmButtonText.on('pointertap', (e: FederatedPointerEvent) => this.onConfirmDrawTap(e));
    this.redrawButtonGraphics.on('pointertap', (e: FederatedPointerEvent) => this.onRedrawTap(e));
    this.redrawButtonText.on('pointertap', (e: FederatedPointerEvent) => this.onRedrawTap(e));
  }

  private spawnGhostCard(cardId: string, x: number, y: number): void {
    this.clearGraphics();
    const g = new Graphics();
    g.eventMode = 'none';
    const card = this.cardRegistry?.getCard(cardId);
    const unit = card?.unitConfigId ? this.cardRegistry?.getUnit(card.unitConfigId) : undefined;
    const color = unit ? unit.visual.color : 0x4fc3f7;
    const size = unit ? unit.visual.size : 36;
    const shape = unit ? unit.visual.shape : 'circle';
    const half = size / 2;

    if (shape === 'circle') {
      g.circle(0, 0, half).fill({ color, alpha: 0.6 });
      g.circle(0, 0, half).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    } else if (shape === 'triangle') {
      g.moveTo(0, -half).lineTo(half, half).lineTo(-half, half).closePath().fill({ color, alpha: 0.6 });
      g.moveTo(0, -half).lineTo(half, half).lineTo(-half, half).closePath().stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    } else {
      g.rect(-half, -half, size, size).fill({ color, alpha: 0.6 });
      g.rect(-half, -half, size, size).stroke({ width: 2, color: 0xffffff, alpha: 0.85 });
    }

    g.position.set(x, y);
    this.handContainer.addChild(g);
    this.ghostCard = g;
  }

  private clearGraphics(): void {
    if (this.ghostCard) {
      this.ghostCard.destroy({ children: true });
      this.ghostCard = null;
    }
    if (this.ghostCell) {
      this.ghostCell.destroy();
      this.ghostCell = null;
    }
  }

  private clearDrag(): void {
    this.clearGraphics();
    this.dragSlot = null;
  }

  private onDrawButtonTap(e: FederatedPointerEvent): void {
    e.stopPropagation();
    const layout = layoutHand(this.lastHandState, this.viewportWidth, this.viewportHeight);
    console.info('[draw] ui tap', {
      enabled: layout.drawButton.enabled,
      drawState: this.lastHandState.drawState ?? 'ready',
      drawCooldownSeconds: this.lastHandState.drawCooldownSeconds ?? 0,
      button: layout.drawButton,
    });
    if (!layout.drawButton.enabled) return;
    this.onDrawCard?.();
  }

  private onConfirmDrawTap(e: FederatedPointerEvent): void {
    e.stopPropagation();
    const layout = layoutHand(this.lastHandState, this.viewportWidth, this.viewportHeight);
    if (!hitTestDrawAction(layout.confirmButton, e.global.x, e.global.y)) return;
    const pendingCard = this.lastHandState.pendingDrawCard;
    if (!pendingCard) return;
    this.startFlyToHand(pendingCard.cardId);
    this.onConfirmDrawCard?.();
  }

  private onRedrawTap(e: FederatedPointerEvent): void {
    e.stopPropagation();
    const layout = layoutHand(this.lastHandState, this.viewportWidth, this.viewportHeight);
    if (!hitTestDrawAction(layout.redrawButton, e.global.x, e.global.y)) return;
    this.onRedrawCard?.();
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    e.stopPropagation();
    const local = this.battleContainer.toLocal(e.global);
    if (this.isExitBtnHit(local.x, local.y)) {
      this.onExitBattle?.();
      return;
    }
    if (this.isDebugVictoryBtnHit(local.x, local.y)) {
      this.onDebugVictory?.();
      return;
    }
    const layout = layoutHand(this.lastHandState, this.viewportWidth, this.viewportHeight);
    const slot = hitTestHandSlot(layout, local.x, local.y);
    this.dragSlot = slot;
    if (slot !== null) {
      const card = this.lastHandState.cards[slot];
      if (card) this.spawnGhostCard(card.cardId, local.x, local.y);
    }
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (this.dragSlot === null || !this.ghostCard) return;
    const local = this.battleContainer.toLocal(e.global);
    this.ghostCard.position.set(local.x, local.y);

    const handZoneTop = this.viewportHeight - 160;
    if (local.y < handZoneTop) {
      const cs = this.cellSize;
      const worldPos = this.screenToWorld(local.x, local.y);
      const levelConfig = this.getLevelConfig();
      const tileSize = levelConfig?.tileSize ?? cs;
      const col = Math.floor(worldPos.x / tileSize);
      const row = Math.floor(worldPos.y / tileSize);
      const isInside = levelConfig
        ? col >= 0 && row >= 0 && col < levelConfig.mapCols && row < levelConfig.mapRows
        : col >= 0 && row >= 0;
      const tile = isInside && levelConfig ? levelConfig.tiles[row]?.[col] ?? 'empty' : 'empty';
      const isPathTile = tile === 'path' || tile === 'spawn' || tile === 'base';
      const dragged = this.dragSlot !== null ? this.lastHandState.cards[this.dragSlot] ?? null : null;
      const card = dragged ? this.cardRegistry?.getCard(dragged.cardId) : null;
      const unit = card?.unitConfigId ? this.cardRegistry?.getUnit(card.unitConfigId) : null;
      const category = unit?.category ?? null;
      const isTowerLike = category === 'Tower' || category === 'Building';
      const isPathOnly = category === 'Soldier' || category === 'Trap';
      const legal = isInside && !((isTowerLike && isPathTile) || (isPathOnly && !isPathTile));
      const cellTopLeft = this.worldToScreen(col * tileSize, row * tileSize);
      const cellBottomRight = this.worldToScreen((col + 1) * tileSize, (row + 1) * tileSize);
      const cellX = cellTopLeft.x;
      const cellY = cellTopLeft.y;
      const cellW = cellBottomRight.x - cellTopLeft.x;
      const cellH = cellBottomRight.y - cellTopLeft.y;
      if (!this.ghostCell) {
        const g = new Graphics();
        g.eventMode = 'none';
        this.handContainer.addChild(g);
        this.ghostCell = g;
      }
      this.ghostCell.clear();
      const previewColor = legal ? 0x00e676 : 0xff5252;
      this.ghostCell.rect(cellX, cellY, cellW, cellH).fill({ color: previewColor, alpha: 0.25 });
      this.ghostCell.rect(cellX, cellY, cellW, cellH).stroke({ width: 2, color: previewColor, alpha: 0.9 });
    } else {
      if (this.ghostCell) {
        this.ghostCell.clear();
      }
    }
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    if (this.dragSlot === null || !this.handPanel) { this.clearDrag(); return; }
    const local = this.battleContainer.toLocal(e.global);
    const slot = this.dragSlot;
    this.clearDrag();
    this.handPanel.trigger(slot, local.x, local.y);
  }

  private ensureFlyingDrawCardLayer(): void {
    if (!this.flyingDrawCardGraphics) {
      this.flyingDrawCardGraphics = new Graphics();
      this.flyingDrawCardGraphics.eventMode = 'none';
      this.handContainer.addChild(this.flyingDrawCardGraphics);
    }
    if (!this.flyingDrawCardText) {
      this.flyingDrawCardText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 18, fontWeight: '700' } });
      this.flyingDrawCardText.anchor.set(0.5, 0.5);
      this.handContainer.addChild(this.flyingDrawCardText);
    }
  }

  private getHandSlotRect(slot: number): { x: number; y: number; width: number; height: number } {
    const totalSlotsWidth = HAND_MAX_CARDS * 120 + (HAND_MAX_CARDS - 1) * 16;
    const slotStartX = (this.viewportWidth - totalSlotsWidth) / 2;
    return {
      x: slotStartX + slot * (120 + 16),
      y: this.viewportHeight - 168 - 130,
      width: 120,
      height: 168,
    };
  }

  private syncDrawAnimation(layout: ReturnType<typeof layoutHand>, pendingDrawCard: PendingDrawCard | null | undefined): void {
    if (!pendingDrawCard) {
      if (this.flyingDrawCard?.phase !== 'to-hand') {
        this.flyingDrawCard = null;
        if (this.flyingDrawCardGraphics) this.flyingDrawCardGraphics.clear();
        if (this.flyingDrawCardText) this.flyingDrawCardText.visible = false;
      }
      this.autoCommitScheduled = false;
      return;
    }
    if (this.flyingDrawCard?.cardId === pendingDrawCard.cardId) return;
    const fromX = layout.drawDeckIcon.x + layout.drawDeckIcon.width / 2;
    const fromY = layout.drawDeckIcon.y + layout.drawDeckIcon.height / 2;
    const toX = layout.drawPreviewCard.x + layout.drawPreviewCard.width / 2;
    const toY = layout.drawPreviewCard.y + layout.drawPreviewCard.height / 2;
    this.flyingDrawCard = {
      cardId: pendingDrawCard.cardId,
      fromX,
      fromY,
      toX,
      toY,
      duration: 0.24,
      delay: pendingDrawCard.secondDraw ? 0.12 : 0,
      autoCommit: pendingDrawCard.secondDraw,
      phase: 'to-preview',
      elapsed: 0,
    };
    this.ensureFlyingDrawCardLayer();
    this.autoCommitScheduled = false;
  }

  private startFlyToHand(cardId: string): void {
    const slotRect = this.getHandSlotRect(this.lastHandState.cards.length);
    this.flyingDrawCard = {
      cardId,
      fromX: this.viewportWidth / 2,
      fromY: (this.viewportHeight - 192) / 2 - 40 + 96,
      toX: slotRect.x + slotRect.width / 2,
      toY: slotRect.y + slotRect.height / 2,
      duration: 0.22,
      delay: 0,
      autoCommit: false,
      phase: 'to-hand',
      elapsed: 0,
    };
    this.ensureFlyingDrawCardLayer();
  }

  private updateDrawAnimation(dt: number): void {
    if (!this.flyingDrawCard) return;
    this.ensureFlyingDrawCardLayer();
    const anim = this.flyingDrawCard;
    anim.elapsed += dt;
    const travelElapsed = Math.max(0, anim.elapsed - anim.delay);
    const progress = Math.min(1, travelElapsed / anim.duration);
    const eased = 1 - (1 - progress) * (1 - progress);
    const x = anim.fromX + (anim.toX - anim.fromX) * eased;
    const y = anim.fromY + (anim.toY - anim.fromY) * eased;
    const width = 144;
    const height = 192;
    this.flyingDrawCardGraphics!.clear();
    this.flyingDrawCardGraphics!.roundRect(x - width / 2, y - height / 2, width, height, 18).fill({ color: 0x1a2633, alpha: 0.96 });
    this.flyingDrawCardGraphics!.roundRect(x - width / 2, y - height / 2, width, height, 18).stroke({ width: 2, color: 0x90caf9, alpha: 0.95 });
    this.flyingDrawCardText!.text = anim.cardId;
    this.flyingDrawCardText!.position.set(x, y);
    this.flyingDrawCardText!.visible = true;
    if (progress < 1) return;
    this.flyingDrawCardGraphics!.clear();
    this.flyingDrawCardText!.visible = false;
    this.flyingDrawCard = null;
    if (anim.phase === 'to-preview') {
      if (anim.autoCommit && !this.autoCommitScheduled) {
        this.autoCommitScheduled = true;
        this.onConfirmDrawCard?.();
      }
      return;
    }
  }

  private drawPendingPreview(layout: ReturnType<typeof layoutHand>, pendingDrawCard: PendingDrawCard | null | undefined): void {
    this.drawPreviewGraphics.clear();
    this.confirmButtonGraphics.clear();
    this.redrawButtonGraphics.clear();
    this.confirmButtonText.visible = false;
    this.redrawButtonText.visible = false;
    this.drawPreviewText.visible = false;
    if (!pendingDrawCard || !layout.drawPreviewCard.visible || this.flyingDrawCard?.phase === 'to-preview') return;
    const preview = layout.drawPreviewCard;
    this.drawPreviewGraphics.roundRect(preview.x, preview.y, preview.width, preview.height, 18).fill({ color: 0x1a2633, alpha: 0.96 });
    this.drawPreviewGraphics.roundRect(preview.x, preview.y, preview.width, preview.height, 18).stroke({ width: 2, color: 0x90caf9, alpha: 0.95 });
    this.drawPreviewText.text = pendingDrawCard.cardId;
    this.drawPreviewText.position.set(preview.x + preview.width / 2, preview.y + preview.height / 2);
    this.drawPreviewText.visible = true;
    if (layout.confirmButton) {
      this.confirmButtonGraphics.roundRect(layout.confirmButton.x, layout.confirmButton.y, layout.confirmButton.width, layout.confirmButton.height, 14)
        .fill({ color: 0x2e7d32, alpha: 0.95 });
      this.confirmButtonGraphics.roundRect(layout.confirmButton.x, layout.confirmButton.y, layout.confirmButton.width, layout.confirmButton.height, 14)
        .stroke({ width: 2, color: 0xa5d6a7, alpha: 0.95 });
      this.confirmButtonText.text = layout.confirmButton.label;
      this.confirmButtonText.position.set(layout.confirmButton.x + layout.confirmButton.width / 2, layout.confirmButton.y + layout.confirmButton.height / 2);
      this.confirmButtonText.visible = true;
    }
    if (layout.redrawButton) {
      this.redrawButtonGraphics.roundRect(layout.redrawButton.x, layout.redrawButton.y, layout.redrawButton.width, layout.redrawButton.height, 14)
        .fill({ color: 0x1565c0, alpha: 0.95 });
      this.redrawButtonGraphics.roundRect(layout.redrawButton.x, layout.redrawButton.y, layout.redrawButton.width, layout.redrawButton.height, 14)
        .stroke({ width: 2, color: 0x90caf9, alpha: 0.95 });
      this.redrawButtonText.text = layout.redrawButton.label;
      this.redrawButtonText.position.set(layout.redrawButton.x + layout.redrawButton.width / 2, layout.redrawButton.y + layout.redrawButton.height / 2);
      this.redrawButtonText.visible = true;
    }
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
    this.EXIT_BTN.x = vw - 148;
    this.EXIT_BTN.y = 14;
    this.DEBUG_VICTORY_BTN.x = vw - 148;
    this.DEBUG_VICTORY_BTN.y = 62;
    this.drawExitButton();
    this.drawDebugVictoryButton();
    this.drawHudBackground();
  }

  present(frame: UIFrame, dt = 0): void {
    this.lastFrameRun = frame.run;
    this.lastHandState = frame.hand;
    const hud = projectHUD(frame.run);
    this.goldText.text = hud.gold;
    this.crystalText.text = hud.crystal;
    this.crystalText.style.fill = hud.crystalLowAlarm ? 0xff5252 : 0x4fc3f7;
    this.waveText.text = hud.wave;
    this.enemyText.text = hud.enemy;
    this.runText.text = hud.runProgress;
    this.phaseText.text = hud.phaseLabel;
    this.passiveText.text = hud.passives;

    this.goldText.position.set(36, 26);
    this.crystalText.position.set(170, 26);
    this.waveText.position.set(320, 26);
    this.enemyText.position.set(this.viewportWidth * 0.5 + 40, 26);
    this.runText.position.set(this.viewportWidth * 0.5 + 170, 26);
    this.phaseText.position.set(this.viewportWidth * 0.5 + 340, 28);
    this.passiveText.style.wordWrapWidth = Math.max(300, this.viewportWidth - 760);
    this.passiveText.position.set(this.viewportWidth * 0.5 + 40, 62);
    this.drawHudBackground();

    const layout = layoutHand(frame.hand, this.viewportWidth, this.viewportHeight);
    this.drawHandBackground(layout);
    this.drawDeckIcon(layout);
    this.syncDrawAnimation(layout, frame.hand.pendingDrawCard);
    this.updateDrawAnimation(dt);
    this.energyText.text = layout.energyLabel;
    this.energyText.position.set(layout.panel.x + 24, layout.panel.y + 18);
    this.drawText.text = layout.drawLabel;
    this.drawPendingPreview(layout, frame.hand.pendingDrawCard);
    this.drawText.position.set(layout.drawButton.x, layout.drawButton.y - 28);
    this.drawButtonGraphics.clear();
    this.drawButtonGraphics.roundRect(layout.drawButton.x, layout.drawButton.y, layout.drawButton.width, layout.drawButton.height, 10)
      .fill({ color: layout.drawButton.enabled ? 0x1565c0 : 0x37474f, alpha: 0.95 });
    this.drawButtonText.text = '抽卡';
    this.drawButtonText.style.fill = layout.drawButton.enabled ? 0xffffff : 0xb0bec5;
    this.drawButtonText.position.set(layout.drawButton.x + 34, layout.drawButton.y + 10);
    this.slotGraphics.clear();
    while (this.slotLabels.length < 4) {
      const label = new Text({ text: '', style: { fill: 0xffffff, fontSize: 14, fontWeight: '500' } });
      this.handContainer.addChild(label);
      this.slotLabels.push(label);
    }
    for (let i = layout.slots.length; i < this.slotLabels.length; i++) {
      this.slotLabels[i]!.text = '';
    }
    for (let i = 0; i < 4; i++) {
      const slot = layout.slots[i] ?? {
        slot: i,
        cardId: '',
        cost: 0,
        playable: false,
        x: ((this.viewportWidth - (4 * 120 + 3 * 16)) / 2) + i * (120 + 16),
        y: this.viewportHeight - 168 - 130,
        width: 120,
        height: 168,
      };
      const hasCard = i < layout.slots.length;
      const fillColor = hasCard ? (slot.playable ? 0x37474f : 0x263238) : 0x1b232c;
      this.slotGraphics.roundRect(slot.x, slot.y, slot.width, slot.height, 16).fill({ color: fillColor, alpha: hasCard ? 0.96 : 0.45 });
      this.slotGraphics.roundRect(slot.x, slot.y, slot.width, slot.height, 16).stroke({ width: 2, color: hasCard ? (slot.playable ? 0x80cbc4 : 0x455a64) : 0x546e7a, alpha: hasCard ? 1 : 0.7 });
      const label = this.slotLabels[i]!;
      label.text = hasCard ? `${slot.cardId}\nCost ${slot.cost}` : '空槽';
      label.style.fill = hasCard ? 0xffffff : 0x78909c;
      label.position.set(slot.x + 10, slot.y + 12);
    }
  }
}
