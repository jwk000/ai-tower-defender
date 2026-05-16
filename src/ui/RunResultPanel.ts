export type RunResultOutcome = 'victory' | 'defeat';

export interface RunResultStats {
  readonly levelsCleared: number;
  readonly totalLevels: number;
  readonly enemiesKilled: number;
  readonly goldEarned: number;
  readonly crystalHpRemaining: number;
  readonly elapsedSeconds: number;
}

export interface RunResultState {
  readonly outcome: RunResultOutcome;
  readonly stats: RunResultStats;
  readonly sparkAwarded: number;
}

export interface RunResultLine {
  readonly label: string;
  readonly value: string;
}

export interface RunResultButtonRect {
  readonly id: 'return-menu' | 'start-new-run';
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RunResultLayout {
  readonly headerLabel: string;
  readonly headerColor: number;
  readonly lines: readonly RunResultLine[];
  readonly buttons: readonly RunResultButtonRect[];
}

const VICTORY_COLOR = 0x4ec59a;
const DEFEAT_COLOR = 0xe06868;
const RESULT_BTN_WIDTH = 280;
const RESULT_BTN_HEIGHT = 56;
const RESULT_BTN_GAP = 16;
const RESULT_BTN_MARGIN_BOTTOM = 140;

export function projectRunResult(state: RunResultState, viewportWidth = 1920, viewportHeight = 1080): RunResultLayout {
  const s = state.stats;
  const totalBtnsH = 2 * RESULT_BTN_HEIGHT + RESULT_BTN_GAP;
  const btn1Y = viewportHeight - RESULT_BTN_MARGIN_BOTTOM - totalBtnsH + RESULT_BTN_HEIGHT + RESULT_BTN_GAP;
  const btn0Y = btn1Y - RESULT_BTN_HEIGHT - RESULT_BTN_GAP;
  const btnX = (viewportWidth - RESULT_BTN_WIDTH) / 2;

  const buttons: RunResultButtonRect[] = [
    { id: 'return-menu', label: '返回主菜单', x: btnX, y: btn0Y, width: RESULT_BTN_WIDTH, height: RESULT_BTN_HEIGHT },
    { id: 'start-new-run', label: '立即开始新征程', x: btnX, y: btn1Y, width: RESULT_BTN_WIDTH, height: RESULT_BTN_HEIGHT },
  ];

  return {
    headerLabel: state.outcome === 'victory' ? '胜利！' : '失败',
    headerColor: state.outcome === 'victory' ? VICTORY_COLOR : DEFEAT_COLOR,
    lines: [
      { label: '通关关卡', value: `${s.levelsCleared}/${s.totalLevels}` },
      { label: '击杀敌人', value: String(s.enemiesKilled) },
      { label: '获得金币', value: String(s.goldEarned) },
      { label: '水晶剩余', value: String(s.crystalHpRemaining) },
      { label: '用时', value: formatTime(s.elapsedSeconds) },
      { label: '获得火花', value: `+${state.sparkAwarded}` },
    ],
    buttons,
  };
}

export function hitTestRunResultButton(layout: RunResultLayout, px: number, py: number): RunResultButtonRect['id'] | null {
  for (const btn of layout.buttons) {
    if (px >= btn.x && px <= btn.x + btn.width && py >= btn.y && py <= btn.y + btn.height) {
      return btn.id;
    }
  }
  return null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type RunResultAction = 'return-menu' | 'start-new-run';
export type RunResultHandler = (action: RunResultAction) => void;

export class RunResultPanel {
  private state: RunResultState | null = null;
  private handler: RunResultHandler | null = null;
  private viewportWidth = 1920;
  private viewportHeight = 1080;

  constructor(opts: { viewportWidth?: number; viewportHeight?: number } = {}) {
    if (opts.viewportWidth) this.viewportWidth = opts.viewportWidth;
    if (opts.viewportHeight) this.viewportHeight = opts.viewportHeight;
  }

  setHandler(handler: RunResultHandler): void {
    this.handler = handler;
  }

  refresh(state: RunResultState): void {
    this.state = state;
  }

  getLayout(): RunResultLayout | null {
    return this.state ? projectRunResult(this.state, this.viewportWidth, this.viewportHeight) : null;
  }

  trigger(action: RunResultAction): void {
    if (!this.state) return;
    this.handler?.(action);
  }
}
