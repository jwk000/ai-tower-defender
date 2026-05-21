export interface HandCard {
  readonly slot: number;
  readonly cardId: string;
  readonly cost: number;
  readonly playable: boolean;
}

export type DrawState = 'ready' | 'cooldown' | 'full-hand' | 'reroll';

export interface HandState {
  readonly cards: readonly HandCard[];
  readonly energy: number;
  readonly energyMax: number;
  readonly drawState?: DrawState;
  readonly drawCooldownSeconds?: number;
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
}

export type PlayCardIntent =
  | { readonly kind: 'play'; readonly slot: number; readonly cardId: string; readonly targetX: number; readonly targetY: number }
  | { readonly kind: 'cancel'; readonly reason: 'not-playable' | 'over-hand-zone' | 'no-such-slot' };

export const HAND_MAX_CARDS = 4;
const HAND_ZONE_HEIGHT = 180;
const SLOT_WIDTH = 120;
const SLOT_HEIGHT = 168;
const SLOT_GAP = 16;
const HAND_OFFSET_Y = 130;
const DRAW_BUTTON_WIDTH = 132;
const DRAW_BUTTON_HEIGHT = 44;

export function layoutHand(state: HandState, viewportWidth: number, viewportHeight: number): HandLayout {
  const cards = state.cards.slice(0, HAND_MAX_CARDS);
  const totalWidth = cards.length * SLOT_WIDTH + Math.max(0, cards.length - 1) * SLOT_GAP;
  const startX = (viewportWidth - totalWidth) / 2;
  const y = viewportHeight - SLOT_HEIGHT - HAND_OFFSET_Y;
  const drawLabel = formatDrawLabel(state);
  const drawButtonX = 12;
  const drawButtonY = viewportHeight - 80;
  const drawButtonEnabled = state.drawState === 'ready' || state.drawState === 'reroll';
  return {
    slots: cards.map((card, i) => ({
      slot: card.slot,
      cardId: card.cardId,
      cost: card.cost,
      playable: card.playable,
      x: startX + i * (SLOT_WIDTH + SLOT_GAP),
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
    case 'reroll':
      return '可重抽';
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
