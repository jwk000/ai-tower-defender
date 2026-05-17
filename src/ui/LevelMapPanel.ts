export type LevelNodeStatus = 'completed' | 'current' | 'locked';

export interface LevelNode {
  readonly levelIndex: number;
  readonly isBoss: boolean;
  readonly status: LevelNodeStatus;
}

export interface LevelMeta {
  readonly name: string;
  readonly description: string;
  readonly waveCount: number;
}

const NORMAL_NODE_SIZE = 160;
const BOSS_NODE_SIZE = 160;

export interface LevelNodeRect extends LevelNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly name: string;
  readonly description: string;
  readonly waveCount: number;
}

export interface LevelMapBtnRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

export interface LevelMapLayout {
  readonly nodes: readonly LevelNodeRect[];
  readonly challengeBtn: LevelMapBtnRect;
  readonly deckBtn: LevelMapBtnRect;
  readonly backBtn: LevelMapBtnRect;
  readonly titleLabel: string;
  readonly crystalLabel: string;
  readonly goldLabel: string;
  readonly escHint: string;
}

export interface LevelMapState {
  readonly totalLevels: number;
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly runIndex: number;
  readonly levelMetas: readonly LevelMeta[];
}

const CHALLENGE_BTN_W = 280;
const CHALLENGE_BTN_H = 60;
const DECK_BTN_W = 120;
const DECK_BTN_H = 50;
const BACK_BTN_W = 140;
const BACK_BTN_H = 44;
const BOTTOM_OFFSET_Y = 40;

const NODE_COORDS: ReadonlyArray<readonly [number, number]> = [
  [120, 540],
  [330, 540],
  [540, 540],
  [750, 540],
  [960, 540],
  [1170, 540],
  [1380, 540],
  [1590, 540],
  [1800, 540],
];

const FALLBACK_META: LevelMeta = { name: '???', description: '', waveCount: 0 };

export function buildLevelNodes(state: LevelMapState): readonly LevelNode[] {
  const nodes: LevelNode[] = [];
  for (let i = 1; i <= state.totalLevels; i += 1) {
    let status: LevelNodeStatus;
    if (i < state.currentLevelIdx) {
      status = 'completed';
    } else if (i === state.currentLevelIdx) {
      status = 'current';
    } else {
      status = 'locked';
    }
    nodes.push({ levelIndex: i, isBoss: i === state.totalLevels, status });
  }
  return nodes;
}

export function layoutLevelMap(state: LevelMapState, viewportWidth: number, viewportHeight: number): LevelMapLayout {
  const nodes = buildLevelNodes(state);

  const scaleX = viewportWidth / 1920;
  const scaleY = viewportHeight / 1080;

  const nodeRects: LevelNodeRect[] = nodes.map((n, i) => {
    const [cx, cy] = NODE_COORDS[i] ?? [960, 540];
    const size = n.isBoss ? BOSS_NODE_SIZE : NORMAL_NODE_SIZE;
    const scaledSize = Math.round(size * Math.min(scaleX, scaleY));
    const meta = state.levelMetas[i] ?? FALLBACK_META;
    return {
      ...n,
      x: Math.round(cx * scaleX - scaledSize / 2),
      y: Math.round(cy * scaleY - scaledSize / 2),
      width: scaledSize,
      height: scaledSize,
      label: n.isBoss ? '终战' : `关${n.levelIndex}`,
      name: meta.name,
      description: meta.description,
      waveCount: meta.waveCount,
    };
  });

  const challengeBtnX = Math.round((viewportWidth - CHALLENGE_BTN_W) / 2);
  const challengeBtnY = viewportHeight - CHALLENGE_BTN_H - BOTTOM_OFFSET_Y;

  const deckBtnX = viewportWidth - DECK_BTN_W - 160;
  const deckBtnY = viewportHeight - DECK_BTN_H - BOTTOM_OFFSET_Y;

  const backBtnX = viewportWidth - BACK_BTN_W - 30;
  const backBtnY = 18;

  return {
    nodes: nodeRects,
    challengeBtn: {
      x: challengeBtnX,
      y: challengeBtnY,
      width: CHALLENGE_BTN_W,
      height: CHALLENGE_BTN_H,
      label: `挑战关卡 ${state.currentLevelIdx}`,
    },
    deckBtn: {
      x: deckBtnX,
      y: deckBtnY,
      width: DECK_BTN_W,
      height: DECK_BTN_H,
      label: '📚 卡池',
    },
    backBtn: {
      x: backBtnX,
      y: backBtnY,
      width: BACK_BTN_W,
      height: BACK_BTN_H,
      label: 'ESC 退出',
    },
    titleLabel: `⚔ 长征路线 — Run #${state.runIndex}`,
    crystalLabel: `💎 HP ${state.crystalHp}/${state.crystalHpMax}`,
    goldLabel: `● 金币 ${state.gold}`,
    escHint: 'ESC 退出 Run',
  };
}

function hitRect(rect: LevelMapBtnRect, px: number, py: number): boolean {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

export function hitTestLevelMap(layout: LevelMapLayout, px: number, py: number): LevelMapAction | null {
  if (hitRect(layout.challengeBtn, px, py)) return 'challenge';
  if (hitRect(layout.deckBtn, px, py)) return 'view-deck';
  if (hitRect(layout.backBtn, px, py)) return 'back-to-menu';
  return null;
}

export type LevelMapAction = 'challenge' | 'view-deck' | 'back-to-menu';
export type LevelMapHandler = (action: LevelMapAction) => void;

export class LevelMapPanel {
  private state: LevelMapState | null = null;
  private handler: LevelMapHandler | null = null;

  setHandler(handler: LevelMapHandler): void {
    this.handler = handler;
  }

  refresh(state: LevelMapState): void {
    this.state = state;
  }

  trigger(action: LevelMapAction): void {
    if (!this.state) return;
    this.handler?.(action);
  }
}
