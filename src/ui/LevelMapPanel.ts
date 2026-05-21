import type { MapNodeKind } from '../unit-system/RunManager.js';

export type LevelNodeStatus = 'completed' | 'current' | 'locked';

export interface LevelEnemyPreview {
  readonly enemyId: string;
  readonly name: string;
  readonly count: number;
  readonly isBoss: boolean;
  readonly isElite: boolean;
}

export interface LevelNode {
  readonly levelIndex: number;
  readonly kind: MapNodeKind;
  readonly isBoss: boolean;
  readonly status: LevelNodeStatus;
}

export interface LevelMeta {
  readonly name: string;
  readonly description: string;
  readonly waveCount: number;
  readonly kind?: MapNodeKind;
  readonly enemyPreview?: readonly LevelEnemyPreview[];
}

const NORMAL_NODE_SIZE = 150;
const CURRENT_NODE_SIZE = 210;
const BOSS_NODE_SIZE = 180;
const MAIN_CARD_W = 900;
const MAIN_CARD_H = 380;
const INFO_CARD_W = 300;
const INFO_CARD_H = 360;
const TIMELINE_W = 1680;
const TIMELINE_H = 180;

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

export interface LevelMapInfoCardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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
  readonly currentNode: LevelNodeRect;
  readonly currentNodeTitle: string;
  readonly currentNodeSummary: string;
  readonly mainCard: LevelMapInfoCardRect;
  readonly enemyCard: LevelMapInfoCardRect;
  readonly timeline: LevelMapInfoCardRect;
  readonly enemyPreview: readonly LevelEnemyPreview[];
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

const CHALLENGE_BTN_W = 360;
const CHALLENGE_BTN_H = 76;
const DECK_BTN_W = 140;
const DECK_BTN_H = 52;
const BACK_BTN_W = 140;
const BACK_BTN_H = 44;

const FALLBACK_META: LevelMeta = { name: '???', description: '', waveCount: 0, kind: 'battle', enemyPreview: [] };

function getNodeKind(levelIndex: number, state: LevelMapState): MapNodeKind {
  const metaKind = state.levelMetas[levelIndex - 1]?.kind;
  if (metaKind) return metaKind;
  if (levelIndex === state.totalLevels) return 'boss';
  return 'battle';
}

function formatNodeLabel(kind: MapNodeKind, levelIndex: number): string {
  switch (kind) {
    case 'battle': return `普通战 ${levelIndex}`;
    case 'elite': return `精英战 ${levelIndex}`;
    case 'shop': return '商店';
    case 'mystic': return '事件';
    case 'treasure': return '宝箱';
    case 'rest': return '休整';
    case 'boss': return '终战';
  }
}

function nodeBaseSize(node: LevelNode): number {
  if (node.status === 'current') return CURRENT_NODE_SIZE;
  if (node.isBoss) return BOSS_NODE_SIZE;
  return NORMAL_NODE_SIZE;
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

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
    const kind = getNodeKind(i, state);
    nodes.push({ levelIndex: i, kind, isBoss: kind === 'boss', status });
  }
  return nodes;
}

export function layoutLevelMap(state: LevelMapState, viewportWidth: number, viewportHeight: number): LevelMapLayout {
  const nodes = buildLevelNodes(state);
  const scale = Math.min(viewportWidth / 1920, viewportHeight / 1080);

  const timelineWidth = Math.round(TIMELINE_W * scale);
  const timelineHeight = Math.round(TIMELINE_H * scale);
  const timelineX = Math.round((viewportWidth - timelineWidth) / 2);
  const timelineY = Math.round(viewportHeight - timelineHeight - 110 * scale);

  const usableWidth = timelineWidth - 120 * scale;
  const step = nodes.length > 1 ? usableWidth / (nodes.length - 1) : 0;
  const centerY = timelineY + timelineHeight / 2;

  const nodeRects: LevelNodeRect[] = nodes.map((n, i) => {
    const size = Math.round(nodeBaseSize(n) * scale);
    const cx = timelineX + 60 * scale + step * i;
    const cy = centerY + (n.status === 'current' ? -8 * scale : n.isBoss ? -4 * scale : 0);
    const meta = state.levelMetas[i] ?? FALLBACK_META;
    return {
      ...n,
      x: Math.round(cx - size / 2),
      y: Math.round(cy - size / 2),
      width: size,
      height: size,
      label: formatNodeLabel(n.kind, n.levelIndex),
      name: meta.name,
      description: meta.description,
      waveCount: meta.waveCount,
    };
  });

  const currentNode = nodeRects.find((node) => node.status === 'current') ?? nodeRects[0]!;
  const currentMeta = state.levelMetas[state.currentLevelIdx - 1] ?? FALLBACK_META;

  const mainCardWidth = Math.round(MAIN_CARD_W * scale);
  const mainCardHeight = Math.round(MAIN_CARD_H * scale);
  const enemyCardWidth = Math.round(INFO_CARD_W * scale);
  const enemyCardHeight = Math.round(INFO_CARD_H * scale);
  const gap = Math.round(28 * scale);
  const cardTop = Math.round(130 * scale);
  const totalCardWidth = mainCardWidth + gap + enemyCardWidth;
  const mainCardX = Math.round((viewportWidth - totalCardWidth) / 2);
  const enemyCardX = mainCardX + mainCardWidth + gap;

  const challengeBtnX = Math.round(mainCardX + (mainCardWidth - CHALLENGE_BTN_W * scale) / 2);
  const challengeBtnY = Math.round(cardTop + mainCardHeight - 100 * scale);

  const deckBtnX = Math.round(viewportWidth - 220 * scale);
  const deckBtnY = Math.round(viewportHeight - 108 * scale);

  const backBtnX = Math.round(viewportWidth - BACK_BTN_W * scale - 40 * scale);
  const backBtnY = Math.round(24 * scale);

  return {
    nodes: nodeRects,
    challengeBtn: {
      x: challengeBtnX,
      y: challengeBtnY,
      width: Math.round(CHALLENGE_BTN_W * scale),
      height: Math.round(CHALLENGE_BTN_H * scale),
      label: `进入 ${formatNodeLabel(getNodeKind(state.currentLevelIdx, state), state.currentLevelIdx)}`,
    },
    deckBtn: {
      x: deckBtnX,
      y: deckBtnY,
      width: Math.round(DECK_BTN_W * scale),
      height: Math.round(DECK_BTN_H * scale),
      label: '📚 卡池',
    },
    backBtn: {
      x: backBtnX,
      y: backBtnY,
      width: Math.round(BACK_BTN_W * scale),
      height: Math.round(BACK_BTN_H * scale),
      label: 'ESC 退出',
    },
    titleLabel: `⚔ 长征路线 · Run #${state.runIndex}`,
    crystalLabel: `💎 HP ${state.crystalHp}/${state.crystalHpMax}`,
    goldLabel: `● 金币 ${state.gold}`,
    escHint: 'ESC 退出 Run',
    currentNode,
    currentNodeTitle: `第 ${currentNode.levelIndex} 关 · ${currentNode.label}`,
    currentNodeSummary: currentMeta.waveCount > 0 ? `预计 ${currentMeta.waveCount} 波 · 推荐先检查卡池搭配` : '事件节点 · 可先查看卡池再做决策',
    mainCard: {
      x: mainCardX,
      y: cardTop,
      width: mainCardWidth,
      height: mainCardHeight,
    },
    enemyCard: {
      x: enemyCardX,
      y: cardTop + Math.round(18 * scale),
      width: enemyCardWidth,
      height: enemyCardHeight,
    },
    timeline: {
      x: timelineX,
      y: timelineY,
      width: timelineWidth,
      height: timelineHeight,
    },
    enemyPreview: (currentMeta.enemyPreview ?? []).slice(0, 5),
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

export function formatLevelDescription(description: string): string {
  return truncateText(description, 84);
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
