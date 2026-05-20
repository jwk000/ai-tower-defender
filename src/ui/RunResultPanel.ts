export type RunResultOutcome = 'victory' | 'defeat';

export interface RunResultStats {
  readonly levelsCleared: number;
  readonly totalLevels: number;
  readonly enemiesKilled: number;
  readonly maxSingleWaveKills: number;
  readonly goldSpent: number;
  readonly crystalHpRemaining: number;
  readonly crystalHpMax: number;
  readonly elapsedSeconds: number;
  readonly archetypeTag?: string;
}

export interface RunResultState {
  readonly outcome: RunResultOutcome;
  readonly stats: RunResultStats;
  readonly levelThemeName?: string;
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
  readonly resourceResetLines: readonly string[];
  readonly buttons: readonly RunResultButtonRect[];
}

const VICTORY_COLOR = 0xffd700;
const DEFEAT_COLOR = 0xcc3333;
const RESULT_BTN_WIDTH = 280;
const RESULT_BTN_HEIGHT = 56;
const RESULT_BTN_MARGIN_BOTTOM = 40;
const PANEL_W = 900;
const PANEL_H = 580;

export function projectRunResult(state: RunResultState, viewportWidth = 1920, viewportHeight = 1080): RunResultLayout {
  const s = state.stats;
  const panelLeft = (viewportWidth - PANEL_W) / 2;
  const panelTop = (viewportHeight - PANEL_H) / 2;
  const btnY = panelTop + PANEL_H - RESULT_BTN_MARGIN_BOTTOM - RESULT_BTN_HEIGHT;

  const buttons: RunResultButtonRect[] = [
    {
      id: 'return-menu',
      label: '返回主菜单',
      x: panelLeft + 80,
      y: btnY,
      width: RESULT_BTN_WIDTH,
      height: RESULT_BTN_HEIGHT,
    },
    {
      id: 'start-new-run',
      label: '立即开始新征程',
      x: panelLeft + PANEL_W - 80 - RESULT_BTN_WIDTH,
      y: btnY,
      width: RESULT_BTN_WIDTH,
      height: RESULT_BTN_HEIGHT,
    },
  ];

  const levelReachedLabel = state.outcome === 'victory'
    ? `关卡 ${s.levelsCleared}（终战）`
    : `关卡 ${s.levelsCleared}${state.levelThemeName ? `（${state.levelThemeName}）` : ''}`;

  const lines: RunResultLine[] = [
    { label: '最远到达', value: levelReachedLabel },
    { label: state.outcome === 'victory' ? '通关时长' : '本次 Run 时长', value: formatTime(s.elapsedSeconds) },
    { label: '总击杀', value: String(s.enemiesKilled) },
    { label: '最大单波击杀', value: String(s.maxSingleWaveKills) },
    { label: '水晶剩余血量', value: `${s.crystalHpRemaining}/${s.crystalHpMax}` },
    { label: '共花费金币', value: String(s.goldSpent) },
  ];

  if (state.outcome === 'victory' && s.archetypeTag) {
    lines.push({ label: '流派标签', value: s.archetypeTag });
  }

  const resourceResetLines: string[] = [
    '⚪ 本次 Run 所有资源已清零',
    '   金币 / 水晶 HP / 卡组状态已重置',
  ];
  if (state.outcome === 'victory') {
    resourceResetLines.push('   下一次 Run 从初始状态出发');
  }

  return {
    headerLabel: state.outcome === 'victory' ? '🏆 Run 胜利！' : '💀 Run 失败',
    headerColor: state.outcome === 'victory' ? VICTORY_COLOR : DEFEAT_COLOR,
    lines,
    resourceResetLines,
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
