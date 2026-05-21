export type MainMenuAction = 'start-run' | 'quit';

export interface MainMenuState {}

export interface MainMenuButton {
  readonly action: MainMenuAction;
  readonly label: string;
  readonly icon: string;
  readonly enabled: boolean;
}

export function buildMainMenu(_state: MainMenuState): readonly MainMenuButton[] {
  return [
    { action: 'start-run', label: '新的征程', icon: '🗡', enabled: true },
    { action: 'quit', label: '离开游戏', icon: '🚪', enabled: true },
  ];
}

export function resolveMainMenuClick(state: MainMenuState, action: MainMenuAction): MainMenuAction | { readonly kind: 'rejected'; readonly reason: 'disabled' } {
  const button = buildMainMenu(state).find((b) => b.action === action);
  if (!button || !button.enabled) return { kind: 'rejected', reason: 'disabled' };
  return action;
}

export interface MainMenuButtonRect extends MainMenuButton {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MainMenuLayout {
  readonly titleLabel: string;
  readonly subtitleLabel: string;
  readonly versionLabel: string;
  readonly titleX: number;
  readonly titleY: number;
  readonly subtitleX: number;
  readonly subtitleY: number;
  readonly versionX: number;
  readonly versionY: number;
  readonly buttons: readonly MainMenuButtonRect[];
}

const MENU_BUTTON_WIDTH = 320;
const MENU_BUTTON_HEIGHT = 56;
const MENU_BUTTON_GAP = 16;
const BTN_CONTAINER_OFFSET_Y = 20;
const TITLE_OFFSET_Y = -200;
const SUBTITLE_OFFSET_Y = -155;

export function layoutMainMenu(state: MainMenuState, viewportWidth: number, viewportHeight: number): MainMenuLayout {
  const buttons = buildMainMenu(state);
  const totalH = buttons.length * MENU_BUTTON_HEIGHT + (buttons.length - 1) * MENU_BUTTON_GAP;
  const containerCenterY = viewportHeight / 2 + BTN_CONTAINER_OFFSET_Y;
  const startY = containerCenterY - totalH / 2 - MENU_BUTTON_HEIGHT;
  const x = (viewportWidth - MENU_BUTTON_WIDTH) / 2;
  const cx = viewportWidth / 2;
  return {
    titleLabel: 'Tower Defender',
    subtitleLabel: '塔 防 守 护 者',
    versionLabel: 'v0.1',
    titleX: cx,
    titleY: viewportHeight / 2 + TITLE_OFFSET_Y,
    subtitleX: cx,
    subtitleY: viewportHeight / 2 + SUBTITLE_OFFSET_Y,
    versionX: viewportWidth - 20,
    versionY: viewportHeight - 16,
    buttons: buttons.map((b, i) => ({
      ...b,
      x,
      y: startY + i * (MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP),
      width: MENU_BUTTON_WIDTH,
      height: MENU_BUTTON_HEIGHT,
    })),
  };
}

export function hitTestMainMenu(layout: MainMenuLayout, px: number, py: number): MainMenuAction | null {
  for (const btn of layout.buttons) {
    if (!btn.enabled) continue;
    if (px >= btn.x && px <= btn.x + btn.width && py >= btn.y && py <= btn.y + btn.height) {
      return btn.action;
    }
  }
  return null;
}

export type MainMenuHandler = (action: MainMenuAction) => void;

export class MainMenu {
  private state: MainMenuState;
  private handler: MainMenuHandler | null = null;
  private buttons: readonly MainMenuButton[];

  constructor(initial: MainMenuState = {}) {
    this.state = initial;
    this.buttons = buildMainMenu(initial);
  }

  setHandler(handler: MainMenuHandler): void {
    this.handler = handler;
  }

  refresh(state: MainMenuState): void {
    this.state = state;
    this.buttons = buildMainMenu(state);
  }

  getButtons(): readonly MainMenuButton[] {
    return this.buttons;
  }

  trigger(action: MainMenuAction): void {
    const resolved = resolveMainMenuClick(this.state, action);
    if (typeof resolved === 'string') {
      this.handler?.(resolved);
    }
  }
}
