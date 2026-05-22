export interface HandCard {
  readonly slot: number;
  readonly cardId: string;
  readonly cost: number;
  readonly playable: boolean;
}

export type DrawState = 'ready' | 'cooldown' | 'full-hand' | 'confirm-draw' | 'second-draw';

export interface PendingDrawCard {
  readonly cardId: string;
  readonly secondDraw: boolean;
}

export interface DrawActionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly enabled: boolean;
}

export interface HandState {
  readonly cards: readonly HandCard[];
  readonly energy: number;
  readonly energyMax: number;
  readonly drawState?: DrawState;
  readonly drawCooldownSeconds?: number;
  readonly pendingDrawCard?: PendingDrawCard | null;
}

export interface HandSlotRect {
  readonly slot: number;
  readonly cardId: string;
  readonly cost: number;
  readonly playable: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DrawButtonRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly enabled: boolean;
}

export interface HandLayout {
  readonly slots: readonly HandSlotRect[];
  readonly energyLabel: string;
  readonly drawLabel: string;
  readonly drawButton: DrawButtonRect;
  readonly drawPreviewCard: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly visible: boolean;
  };
  readonly confirmButton: DrawActionRect | null;
  readonly redrawButton: DrawActionRect | null;
  readonly panel: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type PlayCardIntent =
  | { readonly kind: 'play'; readonly slot: number; readonly cardId: string; readonly targetX: number; readonly targetY: number }
  | { readonly kind: 'cancel'; readonly reason: 'not-playable' | 'over-hand-zone' | 'no-such-slot' };

export const HAND_MAX_CARDS = 4;
const HAND_ZONE_HEIGHT = 180;
const HAND_PANEL_PADDING_X = 28;
const HAND_PANEL_PADDING_Y = 20;
const SLOT_WIDTH = 120;
const SLOT_HEIGHT = 168;
const SLOT_GAP = 16;
const HAND_OFFSET_Y = 130;
const DRAW_BUTTON_WIDTH = 132;
const DRAW_BUTTON_HEIGHT = 44;
const DRAW_BUTTON_MARGIN_LEFT = 24;
const DRAW_BUTTON_MARGIN_BOTTOM = 28;
const DRAW_PREVIEW_WIDTH = 144;
const DRAW_PREVIEW_HEIGHT = 192;
const DRAW_PREVIEW_BUTTON_WIDTH = 144;
const DRAW_PREVIEW_BUTTON_HEIGHT = 44;
const DRAW_PREVIEW_GAP_Y = 16;

export function layoutHand(state: HandState, viewportWidth: number, viewportHeight: number): HandLayout {
  const cards = state.cards.slice(0, HAND_MAX_CARDS);
  const totalSlotsWidth = HAND_MAX_CARDS * SLOT_WIDTH + (HAND_MAX_CARDS - 1) * SLOT_GAP;
  const slotStartX = (viewportWidth - totalSlotsWidth) / 2;
  const y = viewportHeight - SLOT_HEIGHT - HAND_OFFSET_Y;
  const drawLabel = formatDrawLabel(state);
  const drawButtonEnabled = state.drawState === 'ready' || state.drawState === 'confirm-draw' || state.drawState === 'second-draw';
  const panelX = slotStartX - HAND_PANEL_PADDING_X;
  const panelY = y - HAND_PANEL_PADDING_Y;
  const panelWidth = totalSlotsWidth + HAND_PANEL_PADDING_X * 2;
  const panelHeight = SLOT_HEIGHT + HAND_PANEL_PADDING_Y * 2;
  const drawButtonX = DRAW_BUTTON_MARGIN_LEFT;
  const drawButtonY = viewportHeight - DRAW_BUTTON_HEIGHT - DRAW_BUTTON_MARGIN_BOTTOM;
  const previewVisible = state.pendingDrawCard !== undefined && state.pendingDrawCard !== null;
  const previewX = (viewportWidth - DRAW_PREVIEW_WIDTH) / 2;
  const previewY = (viewportHeight - DRAW_PREVIEW_HEIGHT) / 2 - 40;
  const confirmButton = state.drawState === 'confirm-draw'
    ? {
        x: previewX - DRAW_PREVIEW_BUTTON_WIDTH - 12,
        y: previewY + DRAW_PREVIEW_HEIGHT + DRAW_PREVIEW_GAP_Y,
        width: DRAW_PREVIEW_BUTTON_WIDTH,
        height: DRAW_PREVIEW_BUTTON_HEIGHT,
        label: '确认',
        enabled: true,
      }
    : null;
  const redrawButton = state.drawState === 'confirm-draw'
    ? {
        x: previewX + DRAW_PREVIEW_WIDTH + 12,
        y: previewY + DRAW_PREVIEW_HEIGHT + DRAW_PREVIEW_GAP_Y,
        width: DRAW_PREVIEW_BUTTON_WIDTH,
        height: DRAW_PREVIEW_BUTTON_HEIGHT,
        label: '再抽一次',
        enabled: true,
      }
    : null;
  return {
    slots: cards.map((card, i) => ({
      slot: card.slot,
      cardId: card.cardId,
      cost: card.cost,
      playable: card.playable,
      x: slotStartX + i * (SLOT_WIDTH + SLOT_GAP),
      y,
      width: SLOT_WIDTH,
      height: SLOT_HEIGHT,
    })),
    energyLabel: `◇ ${state.energy}/${state.energyMax}`,
    drawLabel,
    drawButton: {
      x: drawButtonX,
      y: drawButtonY,
      width: DRAW_BUTTON_WIDTH,
      height: DRAW_BUTTON_HEIGHT,
      enabled: drawButtonEnabled,
    },
    drawPreviewCard: {
      x: previewX,
      y: previewY,
      width: DRAW_PREVIEW_WIDTH,
      height: DRAW_PREVIEW_HEIGHT,
      visible: previewVisible,
    },
    confirmButton,
    redrawButton,
    panel: {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
    },
  };
}

function formatDrawLabel(state: HandState): string {
  const drawState = state.drawState ?? 'ready';
  switch (drawState) {
    case 'ready':
      return '抽卡';
    case 'cooldown': {
      const remain = Math.max(0, state.drawCooldownSeconds ?? 0);
      return `冷却 ${remain.toFixed(1)}s`;
    }
    case 'full-hand':
      return '手牌已满';
    case 'confirm-draw':
      return '确认换牌';
    case 'second-draw':
      return '再抽一次';
  }
}

export function hitTestHandSlot(layout: HandLayout, px: number, py: number): number | null {
  for (const slot of layout.slots) {
    if (px >= slot.x && px <= slot.x + slot.width && py >= slot.y && py <= slot.y + slot.height) {
      return slot.slot;
    }
  }
  return null;
}

export function hitTestDrawButton(layout: HandLayout, px: number, py: number): boolean {
  const b = layout.drawButton;
  return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
}

export function hitTestDrawAction(action: DrawActionRect | null, px: number, py: number): boolean {
  if (!action) return false;
  return px >= action.x && px <= action.x + action.width && py >= action.y && py <= action.y + action.height;
}

export function resolveDropIntent(
  state: HandState,
  slot: number,
  dropX: number,
  dropY: number,
  viewportHeight: number,
): PlayCardIntent {
  const card = state.cards.find((c) => c.slot === slot);
  if (!card) return { kind: 'cancel', reason: 'no-such-slot' };
  if (!card.playable) return { kind: 'cancel', reason: 'not-playable' };
  if (dropY >= viewportHeight - HAND_ZONE_HEIGHT) {
    return { kind: 'cancel', reason: 'over-hand-zone' };
  }
  return { kind: 'play', slot: card.slot, cardId: card.cardId, targetX: dropX, targetY: dropY };
}

export type HandPanelHandler = (intent: PlayCardIntent) => void;

export class HandPanel {
  private state: HandState = { cards: [], energy: 0, energyMax: 10 };
  private handler: HandPanelHandler | null = null;
  private viewportWidth = 1920;
  private viewportHeight = 1080;

  constructor(opts: { viewportWidth?: number; viewportHeight?: number } = {}) {
    if (opts.viewportWidth) this.viewportWidth = opts.viewportWidth;
    if (opts.viewportHeight) this.viewportHeight = opts.viewportHeight;
  }

  resize(vw: number, vh: number): void {
    this.viewportWidth = vw;
    this.viewportHeight = vh;
  }

  setHandler(handler: HandPanelHandler): void {
    this.handler = handler;
  }

  refresh(state: HandState): void {
    this.state = state;
  }

  getLayout(): HandLayout {
    return layoutHand(this.state, this.viewportWidth, this.viewportHeight);
  }

  trigger(slot: number, dropX: number, dropY: number): void {
    const intent = resolveDropIntent(this.state, slot, dropX, dropY, this.viewportHeight);
    this.handler?.(intent);
  }
}
