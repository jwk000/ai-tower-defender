export type LevelNodeStatus = 'completed' | 'current' | 'locked';

export interface LevelNode {
  readonly levelIndex: number;
  readonly isBoss: boolean;
  readonly status: LevelNodeStatus;
}

export interface LevelNodeRect extends LevelNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
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
  readonly viewDeckBtn: LevelMapBtnRect;
  readonly backBtn: LevelMapBtnRect;
  readonly hudLabel: string;
  readonly goldLabel: string;
  readonly crystalLabel: string;
}

export interface LevelMapState {
  readonly totalLevels: number;
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
}

const NODE_W = 72;
const NODE_H = 72;
const NODE_GAP = 60;
const CHALLENGE_BTN_W = 260;
const CHALLENGE_BTN_H = 56;
const VIEW_DECK_BTN_W = 180;
const VIEW_DECK_BTN_H = 44;
const BACK_BTN_W = 140;
const BACK_BTN_H = 44;

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
  const totalW = nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP;
  const startX = (viewportWidth - totalW) / 2;
  const nodeY = viewportHeight / 2 - NODE_H / 2;

  const nodeRects: LevelNodeRect[] = nodes.map((n, i) => ({
    ...n,
    x: startX + i * (NODE_W + NODE_GAP),
    y: nodeY,
    width: NODE_W,
    height: NODE_H,
    label: n.isBoss ? '终战' : `关${n.levelIndex}`,
  }));

  const currentNode = nodeRects.find((n) => n.status === 'current');
  const btnX = currentNode ? currentNode.x + (NODE_W - CHALLENGE_BTN_W) / 2 : (viewportWidth - CHALLENGE_BTN_W) / 2;
  const btnY = nodeY + NODE_H + 40;

  const viewDeckBtnX = 30;
  const viewDeckBtnY = viewportHeight - VIEW_DECK_BTN_H - 20;

  const backBtnX = viewportWidth - BACK_BTN_W - 30;
  const backBtnY = viewportHeight - BACK_BTN_H - 20;

  return {
    nodes: nodeRects,
    challengeBtn: { x: btnX, y: btnY, width: CHALLENGE_BTN_W, height: CHALLENGE_BTN_H, label: `挑战关卡 ${state.currentLevelIdx}` },
    viewDeckBtn: { x: viewDeckBtnX, y: viewDeckBtnY, width: VIEW_DECK_BTN_W, height: VIEW_DECK_BTN_H, label: '📚 查看卡组' },
    backBtn: { x: backBtnX, y: backBtnY, width: BACK_BTN_W, height: BACK_BTN_H, label: '← 返回主菜单' },
    hudLabel: '⚔ 长征路线',
    goldLabel: `金币 ${state.gold}`,
    crystalLabel: `💎 ${state.crystalHp}/${state.crystalHpMax}`,
  };
}

function hitRect(rect: LevelMapBtnRect, px: number, py: number): boolean {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

export function hitTestLevelMap(layout: LevelMapLayout, px: number, py: number): LevelMapAction | null {
  if (hitRect(layout.challengeBtn, px, py)) return 'challenge';
  if (hitRect(layout.viewDeckBtn, px, py)) return 'view-deck';
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
