// ============================================================
// Tower Defender — UISystem (bitecs migration)
//
// HUD, tooltips, buttons, overlays — the largest UI system.
// Canvas 2D drawing code preserved; data access migrated to
// bitecs SoA stores and defineQuery.
//
// Pure layout/constants functions extracted to ../ui/LayoutConstants.ts
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager, AnchorX, AnchorY, type AnchorConfig } from '../ui/LayoutManager.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS, TRAP_CONFIGS, UNIT_TYPE_BY_ID, SKILL_CONFIGS } from '../data/gameData.js';
import { GamePhase, TowerType, UnitType, ProductionType, type ShapeType, type TowerConfig, type UnitConfig, type UnitVisualParts } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { FONTS, getFont } from '../config/fonts.js';
import { formatNumber } from '../utils/formatNumber.js';
import {
  Position,
  Health,
  Tower,
  Attack,
  UnitTag,
  Visual,
  Production,
  Category,
  CategoryVal,
  PlayerOwned,
  BatTower,
} from '../core/components.js';
import type { CardConfig, CardType } from '../config/cardRegistry.js';
import { cardConfigRegistry } from '../config/cardRegistry.js';
import type { CardDraftSystem } from './CardDraftSystem.js';
import type { InterLevelBuffSystem } from './InterLevelBuffSystem.js';
import { Sound } from '../utils/Sound.js';
import {
  computeCardSlotsLayout,
  computeHandZoneSlotRects,
  HAND_ZONE_CARD_WIDTH,
  HAND_ZONE_CARD_HEIGHT,
  HAND_ZONE_DEFAULT_SLOT_COUNT,
  HAND_ZONE_GAP,
  RARITY_BORDER_COLORS,
  rarityBorderColor,
  getHandZoneBounds,
  hitTestHandCard,
  cardTypeLabel,
  cardTypeGlyph,
  resolveCardToEntityType,
  CARD_TOOLTIP_WIDTH,
  CARD_TOOLTIP_HEIGHT,
  buildCardTooltipLines,
  computeTooltipAnchor,
} from '../ui/LayoutConstants.js';
import type {
  ResolvedCardEntity,
  CardTooltipLine,
} from '../ui/LayoutConstants.js';
import { cardArtPath, cardFrameArtPath, buffArtPath, uiArtPath, unitArtPath } from '../utils/artAssets.js';
import { resolveCardConfig } from '../utils/cardConfigResolver.js';
import { drawLoadedCardFrameMask, drawLoadedImage, drawLoadedImage9Slice, getLoadedImageFrame, type NineSliceInsets } from '../utils/imageCache.js';

// Re-export for backward compatibility
export {
  computeCardSlotsLayout,
  computeHandZoneSlotRects,
  HAND_ZONE_CARD_WIDTH,
  HAND_ZONE_CARD_HEIGHT,
  HAND_ZONE_DEFAULT_SLOT_COUNT,
  HAND_ZONE_GAP,
  RARITY_BORDER_COLORS,
  rarityBorderColor,
  getHandZoneBounds,
  hitTestHandCard,
  cardTypeLabel,
  cardTypeGlyph,
  resolveCardToEntityType,
  CARD_TOOLTIP_WIDTH,
  CARD_TOOLTIP_HEIGHT,
  buildCardTooltipLines,
  computeTooltipAnchor,
};
export type {
  ResolvedCardEntity,
  CardTooltipLine,
};

// ============================================================
// Card icon draw data (for direct Canvas 2D drawing)
// ============================================================

interface CardIconDraw {
  cx: number; cy: number; w: number; h: number; cardId: string; color: string; layer: UILayer; alpha?: number;
}

interface UIImageDraw {
  x: number; y: number; w: number; h: number; path: string; layer: UILayer; alpha?: number; phase?: 'back' | 'front'; mode?: 'stretch' | 'nine-slice' | 'card-frame-mask'; slice?: NineSliceInsets; z?: number;
}

interface HandCardDrawData {
  index: number;
  cardId: string;
  config: CardConfig;
  left: number;
  top: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  scale: number;
  progress: number;
  z: number;
}

type HandCardCategory = 'tower' | 'soldier' | 'trap' | 'spell';

const HAND_CARD_CATEGORY_COLORS: Record<HandCardCategory, string> = {
  tower: '#42a5f5',
  soldier: '#66bb6a',
  trap: '#ef5350',
  spell: '#ab47bc',
};

const HAND_CARD_CATEGORY_LABELS: Record<HandCardCategory, string> = {
  tower: '塔',
  soldier: '兵',
  trap: '机关',
  spell: '技能',
};

function getHandCardCategory(card: CardConfig): HandCardCategory {
  if (card.type === 'spell') return 'spell';
  if (card.type === 'trap') return 'trap';
  const id = card.unitConfigId ?? card.id;
  if (typeof id === 'string' && id.includes('_tower')) return 'tower';
  return 'soldier';
}

// ============================================================
// TowerType numeric ID → enum mapping (matches BuildSystem)
// ============================================================

const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
  TowerType.Missile,   // 6
  TowerType.Fire,      // 7
  TowerType.Poison,    // 8
  TowerType.Ballista,  // 9
];

const TRAP_TYPE_BY_ID = ['spike_trap', 'bear_trap', 'tar_pit', 'boulder'] as const;

// ============================================================
// Interface types (unchanged from original)
// ============================================================

interface UIButton {
  x: number; y: number; w: number; h: number;
  label: string;
  color: string; textColor: string;
  subLabel?: string;
  iconShape?: { shape: string; color: string };
  onClick: () => void;
  enabled: boolean | (() => boolean);
  /** v5.0: ghost buttons are invisible click targets (no fill/stroke, only hit area) */
  ghost?: boolean;
  /** Use the configured button color directly instead of themed 9-slice art. */
  solidColor?: boolean;
  /** Keep the configured button color even when disabled. */
  keepDisabledColor?: boolean;
  layer?: UILayer;
}

interface UIInfo {
  x: number; y: number;
  text: string; color: string; size: number;
  align?: CanvasTextAlign;
  layer?: UILayer;
}

interface UIOverlay {
  phase: GamePhase;
  color: string;
  title: string;
  subtext: string;
}

interface UIGoldCheatFeedback {
  text: string;
  x: number;
  y: number;
  lifetime: number;
}

interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'production' | 'trap' | 'spell';
  towerType?: TowerType;
  unitType?: UnitType;
  productionType?: ProductionType;
  trapTypeId?: string;
  spellCardId?: string;
  cardIndex?: number;
}

interface DragGhostVisual {
  shape: ShapeType;
  size: number;
  color: string;
  label: string;
  visualParts?: UnitVisualParts;
  range?: number;
  rangeMode?: 'circle' | 'board';
  sceneArtId?: string;
}

const UI_Z = {
  BOARD_TIPS: 30,
  NORMAL_UI: 100,
  FULLSCREEN_UI: 1000,
} as const;

const UI_PANEL_SLICE: NineSliceInsets = { left: 96, right: 96, top: 96, bottom: 96 };
export const UI_HAND_PANEL_SLICE: NineSliceInsets = { left: 40, right: 40, top: 72, bottom: 72 };
const UI_BUTTON_SLICE: NineSliceInsets = { left: 96, right: 96, top: 32, bottom: 32 };
const UI_HUD_SLICE: NineSliceInsets = { left: 180, right: 180, top: 42, bottom: 42 };
const GOLD_CHEAT_BUTTON_W = 32;
const GOLD_CHEAT_BUTTON_H = 28;
const GOLD_CHEAT_FEEDBACK_DURATION = 0.8;
const GOLD_CHEAT_FEEDBACK_FLOAT = 24;
const HAND_CARD_HOVER_SCALE = 1.08;
const HAND_CARD_HOVER_LIFT = 24;
const HAND_CARD_HOVER_SPEED = 12;

const SPELL_DRAG_PREVIEW_FALLBACKS: Record<string, { name: string; subtype: CardConfig['spellSubtype']; radius: number }> = {
  fireball: { name: '火球术', subtype: 'damage', radius: 80 },
  arrow_rain: { name: '剑雨', subtype: 'damage', radius: 128 },
  blizzard: { name: '暴风雪', subtype: 'control', radius: 9999 },
  bomb: { name: '炸弹', subtype: 'damage', radius: 96 },
  earthquake: { name: '大地裂变', subtype: 'damage', radius: 9999 },
  gold_rush: { name: '淘金热', subtype: 'utility', radius: 0 },
};

function resolveSpellCardConfig(spellCardId: string): CardConfig | undefined {
  return resolveCardConfig(spellCardId);
}

function normalizeSpellPreviewId(spellCardId: string): string {
  let id = spellCardId.startsWith('card_') ? spellCardId.slice(5) : spellCardId;
  if (id.endsWith('_card')) id = id.slice(0, -'_card'.length);
  return id;
}

function resolveSpellPreviewMeta(spellCardId: string): {
  name: string;
  subtype: CardConfig['spellSubtype'];
  radius: number | undefined;
} {
  const cardCfg = resolveSpellCardConfig(spellCardId);
  if (cardCfg) {
    const extras = cardCfg as Record<string, unknown>;
    const spellEffect = extras.spellEffect as Record<string, unknown> | undefined;
    return {
      name: cardCfg.name,
      subtype: cardCfg.spellSubtype,
      radius: spellEffect?.radius as number | undefined,
    };
  }
  const fallback = SPELL_DRAG_PREVIEW_FALLBACKS[normalizeSpellPreviewId(spellCardId)];
  if (fallback) return fallback;
  return { name: '法术', subtype: undefined, radius: undefined };
}

function sumLevelBonuses(values: readonly number[] | undefined, level: number): number {
  if (!values || level <= 1) return 0;
  return values.slice(0, level - 1).reduce((sum, value) => sum + value, 0);
}

function formatPanelNumber(value: number, digits = 0): string {
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

function formatSkillDescription(skillId: string | undefined): string | null {
  if (!skillId) return null;
  const skill = SKILL_CONFIGS[skillId];
  if (!skill?.description) return null;
  return `${skill.name}: ${skill.description}`;
}

function splitPanelText(text: string, maxLen = 17): string[] {
  if (text.length <= maxLen) return [text];
  const lines: string[] = [];
  for (let index = 0; index < text.length; index += maxLen) {
    lines.push(text.slice(index, index + maxLen));
  }
  return lines;
}

interface LevelStatSnapshot {
  atk: number;
  defense: number;
  hp: number;
  skill: string | null;
}

function buildTowerLevelSnapshot(
  config: TowerConfig,
  level: number,
  currentAtk: number,
  currentHp: number,
): LevelStatSnapshot {
  const baseAtk = currentAtk - sumLevelBonuses(config.upgradeAtkBonus, level);
  const skill = config.type === TowerType.Lightning && level >= 5 && config.lightningStormCooldown && config.lightningStormDamage
    ? `天罚落雷: 每${formatPanelNumber(config.lightningStormCooldown)}秒全屏优先打击BOSS/精英，造成${formatPanelNumber(config.lightningStormDamage)}伤害`
    : null;
  return {
    atk: baseAtk + sumLevelBonuses(config.upgradeAtkBonus, level),
    defense: 0,
    hp: currentHp > 0 ? currentHp : config.hp,
    skill,
  };
}

function buildRuntimeUnitLevelSnapshot(config: UnitConfig, id: number): LevelStatSnapshot {
  return {
    atk: Attack.damage[id] ?? config.atk,
    defense: Health.armor[id] ?? config.defense,
    hp: Health.max[id] ?? config.hp,
    skill: formatSkillDescription(config.skillId),
  };
}

function buildNextRuntimeUnitLevelSnapshot(config: UnitConfig, id: number, level: number): LevelStatSnapshot {
  return {
    atk: (Attack.damage[id] ?? config.atk) + (config.upgradeAtkBonus?.[level - 1] ?? 0),
    defense: Health.armor[id] ?? config.defense,
    hp: (Health.max[id] ?? config.hp) + (config.upgradeHpBonus?.[level - 1] ?? 0),
    skill: formatSkillDescription(config.skillId),
  };
}

function pushLevelSnapshotLines(lines: string[], title: string, stats: LevelStatSnapshot): void {
  lines.push(title);
  lines.push(`攻/防/血: ${formatPanelNumber(stats.atk)}/${formatPanelNumber(stats.defense)}/${formatPanelNumber(stats.hp)}`);
  if (stats.skill) {
    for (const line of splitPanelText(`技能 ${stats.skill}`)) {
      lines.push(line);
    }
  }
}

type UILayer = 'board' | 'normal' | 'fullscreen';

// ============================================================
// bitecs query — alive enemy count (replaces world.query(CType.Enemy))
// ============================================================

const aliveEnemyQuery = defineQuery([Health, UnitTag]);

// ============================================================
// UISystem
// ============================================================

export class UISystem implements System {
  readonly name = 'UISystem';
  // requiredComponents removed — no entity iteration; queries run inline

  static readonly TOP_H = 36;
  static readonly TOP_HUD_SIDE_MARGIN = 200;
  static readonly BTN_W = 80;
  static readonly BTN_H = 80;
  static readonly BTN_GAP = 8;

  /** Bottom panel layout constants */
  static readonly PANEL_W = 1344;   // matches map width (21×64=1344)
  static readonly PANEL_H = 100;    // compact, holds single row of 80×80 buttons
  static readonly PANEL_LEFT = (LayoutManager.DESIGN_W - 1344) / 2; // 288 — centered horizontally
  static readonly PANEL_BTN_START_X = UISystem.PANEL_LEFT + 20; // 308 — inner margin

  static goldCheatButtonRect(): { x: number; y: number; w: number; h: number } {
    return {
      x: UISystem.TOP_HUD_SIDE_MARGIN + 150 + 74,
      y: (UISystem.TOP_H - GOLD_CHEAT_BUTTON_H) / 2,
      w: GOLD_CHEAT_BUTTON_W,
      h: GOLD_CHEAT_BUTTON_H,
    };
  }

  showGoldCheatFeedback(text: string): void {
    const button = UISystem.goldCheatButtonRect();
    this.goldCheatFeedbacks.push({
      text,
      x: button.x + button.w / 2,
      y: button.y + button.h + 10,
      lifetime: 0,
    });
  }

  private buttons: UIButton[] = [];
  private infos: UIInfo[] = [];
  private overlay: UIOverlay | null = null;

  /** Tower info panel background — drawn in renderUI() to stay above weather tint */
  private towerPanelBg: { x: number; y: number; w: number; h: number; strokeColor: string } | null = null;

  /** v5.0: modal backdrop alpha drawn in viewport-space (0 = hidden, 0.6 = visible) */
  private modalBackdropAlpha: number = 0;
  private hasFullscreenOverlay: boolean = false;

  /** Card icon draws — collected during update(), drawn directly in renderUI() */
  private cardIconDraws: CardIconDraw[] = [];
  private imageDraws: UIImageDraw[] = [];
  private handCardHoverProgress: number[] = Array.from({ length: HAND_ZONE_DEFAULT_SLOT_COUNT }, () => 0);
  private goldCheatFeedbacks: UIGoldCheatFeedback[] = [];
  private frameDt: number = 1 / 60;

  public selectedEntityId: number | null = null;
  public selectedEntityType: 'tower' | 'unit' | 'trap' | 'production' | null = null;

  public enemyEntityId: number | null = null;
  private enemySelectTimer: number = 0;

  /** Cached world reference — set at beginning of each update() call */
  private _world: TowerWorld | null = null;

  // ---- v3.0 roguelike: CardDraft & BuffSelection system references ----

  private cardDraftSystem: CardDraftSystem | null = null;
  private interLevelBuffSystem: InterLevelBuffSystem | null = null;
  private onOpenEncyclopedia: (() => void) | null = null;

  /** 敌人图鉴回调 */
  private onOpenEnemyCodex: (() => void) | null = null;

  /** 当前抽卡会话中骰子是否已被使用 */
  private draftRerollUsed: boolean = false;

  setCardDraftSystem(sys: CardDraftSystem): void {
    this.cardDraftSystem = sys;
  }

  setInterLevelBuffSystem(sys: InterLevelBuffSystem): void {
    this.interLevelBuffSystem = sys;
  }

  setEncyclopediaCallback(cb: () => void): void {
    this.onOpenEncyclopedia = cb;
  }

  setEnemyCodexCallback(cb: () => void): void {
    this.onOpenEnemyCodex = cb;
  }

  selectEnemy(id: number): void {
    this.selectedEntityId = null;
    this.selectedEntityType = null;
    this.enemyEntityId = id;
    this.enemySelectTimer = 3;
  }

  constructor(
    private renderer: Renderer,
    private getPhase: () => GamePhase,
    private getGold: () => number,
    private getWave: () => number,
    private getTotalWaves: () => number,
    private getWaveActive: () => boolean,
    private getSelectedTower: () => TowerType | null,
    private selectTower: (type: TowerType) => void,
    private startWave: () => void,
    private onUpgradeTower: ((entityId: number) => void) | null = null,
    private onStartDrag: ((entityType: string, towerType?: TowerType, unitType?: UnitType, productionType?: ProductionType, trapTypeId?: string) => void) | null = null,
    private getDragState: (() => DragState | null) | null = null,
    private getPointerPosition: (() => { x: number; y: number }) | null = null,
    private getEndlessScore: (() => number) | null = null,
    private isEndlessMode: (() => boolean) | null = null,
    private onSkipCountdown: (() => void) | null = null,
    private onToggleSpeed: (() => void) | null = null,
    private onPause: (() => void) | null = null,
    private onResume: (() => void) | null = null,
    private onRestart: (() => void) | null = null,
    private onExit: (() => void) | null = null,
    private getCountdown: (() => number) | null = null,
    private getSpeed: (() => number) | null = null,
    private isPaused: (() => boolean) | null = null,
    private getTotalSpawned: (() => number) | null = null,
    private onRecycleEntity: ((entityId: number) => void) | null = null,
    private getWeatherName: (() => string) | null = null,
    /**
     * Live refund quote — P1-#11. UISystem uses this to display the *actual* refund
     * amount and to disable the button when EconomySystem rejects (cooldown/combat).
     * If null/undefined, falls back to a 50% estimate (legacy behaviour).
     * Reason codes match EconomySystem.RefundReason ('ok' | 'misbuild' | 'cooldown'
     * | 'combat_damage' | 'combat_attack').
     */
    private getRefundQuote: ((entityId: number) => { amount: number; reason: string } | null) | null = null,
    private onUpgradeUnit: ((entityId: number) => void) | null = null,
    private getCrystalHealth: (() => { current: number; max: number } | null) | null = null,
    private onGoldCheat: (() => void) | null = null,
  ) {}

  // ---- Selection getter/setter helpers (unchanged) ----

  get selectedTowerEntityId(): number | null {
    return this.selectedEntityType === 'tower' ? this.selectedEntityId : null;
  }
  set selectedTowerEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'tower' : null;
  }

  get selectedUnitEntityId(): number | null {
    return this.selectedEntityType === 'unit' ? this.selectedEntityId : null;
  }
  set selectedUnitEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'unit' : null;
  }

  get selectedTrapEntityId(): number | null {
    return this.selectedEntityType === 'trap' ? this.selectedEntityId : null;
  }
  set selectedTrapEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'trap' : null;
  }

  get selectedProductionEntityId(): number | null {
    return this.selectedEntityType === 'production' ? this.selectedEntityId : null;
  }
  set selectedProductionEntityId(id: number | null) {
    this.selectedEntityId = id;
    this.selectedEntityType = id !== null ? 'production' : null;
  }

  // ============================================================
  // System.update — cache world, build UI state
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    this._world = world;
    this.frameDt = dt;
    const phase = this.getPhase();

    this.buttons = [];
    this.infos = [];
    this.overlay = null;
    this.modalBackdropAlpha = 0;
    this.hasFullscreenOverlay = false;
    this.cardIconDraws = [];
    this.imageDraws = [];
    this.updateGoldCheatFeedbacks(dt);

    if (this.enemyEntityId !== null) {
      this.enemySelectTimer -= dt;
      if (this.enemySelectTimer <= 0) {
        this.enemyEntityId = null;
      }
    }

    // CardDraft / BuffSelection overlays take priority over pause overlay
    if (this.cardDraftSystem?.isActive()) {
      this.buildTopHUD(phase);
      this.renderCardDraftOverlay();
      return;
    } else {
      // 抽卡会话结束时重置骰子状态
      this.draftRerollUsed = false;
    }

    if (this.interLevelBuffSystem?.isActive()) {
      this.buildTopHUD(phase);
      this.renderBuffSelectionOverlay();
      return;
    }

    if (this.isPaused?.()) {
      this.buildTopHUD(phase);
      this.buildBottomPanel(phase);
      this.buildPauseOverlay();
      return;
    }

    if (this.selectedEntityId !== null && this.selectedEntityType === 'tower') {
      this.drawRangePreview();
      this.buildTowerInfoPanel();
    } else if (this.selectedEntityId !== null && this.selectedEntityType === 'unit') {
      this.buildUnitInfoPanel();
    } else {
      this.towerPanelBg = null;
    }

    this.buildTopHUD(phase);
    this.buildBottomPanel(phase);
    this.buildOverlay(phase);

    this.buildDragGhost();
  }

  // ============================================================
  // Range Preview (tower)
  // ============================================================

  private drawRangePreview(): void {
    const id = this.selectedEntityId;
    if (id === null || !this._world) return;

    const px = Position.x[id];
    const py = Position.y[id];
    if (px === undefined || py === undefined) return;

    let diameter = 0;
    let color = '#ffffff';

    if (this.selectedEntityType === 'tower') {
      const towerTypeVal = Tower.towerType[id];
      if (towerTypeVal === undefined) return;

      let atkRange: number | undefined;
      // Bat towers use BatTower component, others use Attack component
      if (towerTypeVal === 5 && hasComponent(this._world.world, BatTower, id)) {
        atkRange = BatTower.batAttackRange[id];
      } else {
        atkRange = Attack.range[id];
      }
      if (atkRange === undefined) return;

      const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal];
      const config = towerTypeEnum ? TOWER_CONFIGS[towerTypeEnum] : undefined;
      diameter = atkRange * 2;
      color = config?.color ?? '#ffffff';
    } else {
      return;
    }

    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter!,
      color,
      alpha: 0.1,
      z: UI_Z.BOARD_TIPS,
    });
    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter!,
      color,
      alpha: 0.35,
      stroke: color,
      strokeWidth: 2,
      z: UI_Z.BOARD_TIPS,
    });
  }

  // ============================================================
  // Tower Info Panel (upgrade / recycle)
  // ============================================================

  private buildTowerInfoPanel(): void {
    const id = this.selectedEntityId;
    if (id === null || !this._world) return;

    const towerTypeVal = Tower.towerType[id];
    if (towerTypeVal === undefined) return;
    const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal];
    if (towerTypeEnum === undefined) return;
    const config = TOWER_CONFIGS[towerTypeEnum];
    if (!config) return;

    const level = Tower.level[id] ?? 1;
    const isBat = towerTypeVal === 5;

    // Stats
    const atk = isBat ? (BatTower.batDamage[id] ?? 0) : (Attack.damage[id] ?? 0);
    const hp = Health.max[id] ?? config.hp;

    // Upgrade info
    const maxLevel = config.upgradeCosts.length + 1;
    const canUpgrade = level < maxLevel;
    const upgradeCost = canUpgrade ? (config.upgradeCosts[level - 1] ?? 0) : 0;
    const gold = this.getGold();
    const canAfford = gold >= upgradeCost;

    const currentStats = buildTowerLevelSnapshot(config, level, atk, hp);
    const nextStats = canUpgrade
      ? buildTowerLevelSnapshot(config, level + 1, atk + (config.upgradeAtkBonus[level - 1] ?? 0), hp)
      : null;
    const infoLines: string[] = [];
    pushLevelSnapshotLines(infoLines, '当前等级:', currentStats);
    if (nextStats) {
      pushLevelSnapshotLines(infoLines, '下一级:', nextStats);
    } else {
      infoLines.push('下一级: 已满级');
    }

    // Refund info
    const refund = this.getRefundQuote?.(id);

    // Panel layout — above the tower
    const panelW = 300;
    const panelH = 260;
    const towerX = Position.x[id] ?? 0;
    const towerY = Position.y[id] ?? 0;

    // Clamp panel position to stay within screen bounds
    const panelX = Math.max(panelW / 2 + 10, Math.min(towerX, LayoutManager.DESIGN_W - panelW / 2 - 10));
    const panelY = Math.max(10, towerY - 100 - panelH);

    // Store panel background for drawing in renderUI() (after weather tint)
    this.towerPanelBg = {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      strokeColor: config.color ?? '#ffffff',
    };

    // Tower name + level
    const panelLeft = panelX - panelW / 2;
    this.infos.push({
      x: panelX,
      y: panelY + 22,
      text: `${config.name} 等级${level}`,
      color: '#ffffff',
      size: 16,
      align: 'center',
      layer: 'board',
    });

    infoLines.slice(0, 8).forEach((text, index) => {
      const isTitle = text.endsWith(':') || text.includes('已满级');
      this.infos.push({
        x: panelLeft + 15,
        y: panelY + 52 + index * 18,
        text,
        color: isTitle ? '#ffd54f' : '#e0e0e0',
        size: isTitle ? 13 : 12,
        layer: 'board',
      });
    });

    // Upgrade button — green
    const btnW = 132;
    const btnH = 32;
    const btnY = panelY + panelH - 46;

    this.buttons.push({
      x: panelLeft + 8,
      y: btnY,
      w: btnW,
      h: btnH,
      label: canUpgrade ? `升级 ${upgradeCost}G` : '满级',
      color: '#4caf50',
      textColor: '#ffffff',
      enabled: canUpgrade && canAfford,
      solidColor: true,
      keepDisabledColor: true,
      layer: 'board',
      onClick: () => {
        this.onUpgradeTower?.(id);
      },
    });

    // Recycle button — red
    const refundText = refund ? `+${refund.amount}G` : '';
    this.buttons.push({
      x: panelLeft + panelW - btnW - 8,
      y: btnY,
      w: btnW,
      h: btnH,
      label: `回收 ${refundText}`,
      color: '#e53935',
      textColor: '#ffffff',
      enabled: true,
      solidColor: true,
      layer: 'board',
      onClick: () => {
        this.onRecycleEntity?.(id);
        this.selectedEntityId = null;
        this.selectedEntityType = null;
      },
    });
  }

  private buildUnitInfoPanel(): void {
    const id = this.selectedEntityId;
    if (id === null || !this._world) return;
    if (UnitTag.isEnemy[id] !== 0) return;

    const unitTypeVal = UnitTag.unitTypeNum[id];
    const unitTypeEnum = unitTypeVal !== undefined ? UNIT_TYPE_BY_ID[unitTypeVal] : undefined;
    const config = unitTypeEnum ? UNIT_CONFIGS[unitTypeEnum] : undefined;
    if (!config) return;

    const level = UnitTag.level[id] ?? 1;
    const maxLevel = UnitTag.maxLevel[id] ?? config.maxLevel ?? 3;
    const currentStats = buildRuntimeUnitLevelSnapshot(config, id);
    const nextStats = level < maxLevel ? buildNextRuntimeUnitLevelSnapshot(config, id, level) : null;
    const infoLines: string[] = [];
    pushLevelSnapshotLines(infoLines, '当前等级:', currentStats);
    if (nextStats) {
      pushLevelSnapshotLines(infoLines, '下一级:', nextStats);
    } else {
      infoLines.push('下一级: 已满级');
    }

    const panelW = 300;
    const panelH = 230;
    const unitX = Position.x[id] ?? 0;
    const unitY = Position.y[id] ?? 0;
    const panelX = Math.max(panelW / 2 + 10, Math.min(unitX, LayoutManager.DESIGN_W - panelW / 2 - 10));
    const panelY = Math.max(10, unitY - 92 - panelH);
    const panelLeft = panelX - panelW / 2;

    this.towerPanelBg = {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      strokeColor: config.color ?? '#ffffff',
    };

    this.infos.push({
      x: panelX,
      y: panelY + 22,
      text: `${config.name} 等级${level}`,
      color: '#ffffff',
      size: 16,
      align: 'center',
      layer: 'board',
    });
    infoLines.slice(0, 9).forEach((text, index) => {
      const isTitle = text.endsWith(':') || text.includes('已满级');
      this.infos.push({
        x: panelLeft + 15,
        y: panelY + 52 + index * 18,
        text,
        color: isTitle ? '#ffd54f' : '#e0e0e0',
        size: isTitle ? 13 : 12,
        layer: 'board',
      });
    });

  }

  // ============================================================
  // renderUI — direct Canvas 2D text overlay (called from onPostRender)
  // ============================================================

  renderUI(): void {
    const ctx = this.renderer.context;

    this.renderUILayer('board');
    this.renderUILayerBackImages('normal');
    this.renderer.redrawCommands((cmd) => {
      const z = cmd.z ?? 5;
      return z >= UI_Z.NORMAL_UI && z < UI_Z.FULLSCREEN_UI;
    });
    this.renderUILayer('normal');

    // v5.0: full-viewport modal backdrop — covers actual browser window,
    // not just the 16:9 design space. Used by countdown, pause, card draft,
    // buff selection, and victory/defeat overlays.
    if (this.modalBackdropAlpha > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // switch to viewport space
      ctx.fillStyle = `rgba(0, 0, 0, ${this.modalBackdropAlpha})`;
      ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
      ctx.restore();
    }

    if (this.hasFullscreenOverlay) {
      this.renderer.redrawCommands((cmd) => (cmd.z ?? 5) >= UI_Z.FULLSCREEN_UI);
      this.renderUILayer('fullscreen');
    }

    if (this.overlay) {
      const cx = LayoutManager.DESIGN_W / 2;
      const cy = LayoutManager.DESIGN_H / 2;
      ctx.save();
      ctx.fillStyle = this.overlay.color;
      ctx.font = FONTS.title;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.overlay.title, cx, cy);
      ctx.font = FONTS.subtitle;
      ctx.fillText(this.overlay.subtext, cx, cy + 50);
      ctx.restore();
    }
  }

  private renderUILayerBackImages(layer: UILayer): void {
    const ctx = this.renderer.context;
    const layerImages = this.imageDraws
      .filter((image) => image.layer === layer && image.phase === 'back')
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    for (const image of layerImages) {
      ctx.save();
      ctx.globalAlpha = image.alpha ?? 1;
      this.drawUIImage(ctx, image);
      ctx.restore();
    }
  }

  private renderUILayer(layer: UILayer): void {
    const ctx = this.renderer.context;

    // Draw tower info panel background (after weather tint, before buttons/text)
    if (layer === 'board' && this.towerPanelBg) {
      const p = this.towerPanelBg;
      ctx.save();
      // Black background
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = 0.92;
      ctx.fillRect(p.x - p.w / 2, p.y, p.w, p.h);
      // Border
      ctx.globalAlpha = 1;
      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - p.w / 2, p.y, p.w, p.h);
      ctx.restore();
    }

    const layerImages = this.imageDraws
      .filter((image) => image.layer === layer)
      .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    if (layer !== 'normal') {
      for (const image of layerImages) {
        if (image.layer !== layer || image.phase !== 'back') continue;
        ctx.save();
        ctx.globalAlpha = image.alpha ?? 1;
        this.drawUIImage(ctx, image);
        ctx.restore();
      }
    }

    for (const btn of this.buttons) {
      if ((btn.layer ?? 'normal') === layer) {
        this.drawButton(btn);
      }
    }

    // Draw card art only; missing images are left empty so resource issues are visible.
    for (const icon of this.cardIconDraws) {
      if (icon.layer !== layer) continue;
      ctx.save();
      ctx.globalAlpha = icon.alpha ?? 1;
      const x = icon.cx - icon.w / 2;
      const y = icon.cy - icon.h / 2;
      drawLoadedImage(ctx, cardArtPath(icon.cardId), x, y, icon.w, icon.h);
      ctx.restore();
    }

    for (const image of layerImages) {
      if (image.layer !== layer || image.phase === 'back') continue;
      ctx.save();
      ctx.globalAlpha = image.alpha ?? 1;
      this.drawUIImage(ctx, image);
      ctx.restore();
    }

    for (const info of this.infos) {
      if ((info.layer ?? 'normal') !== layer) continue;
      ctx.save();
      ctx.fillStyle = info.color;
      ctx.font = getFont(info.size, true);
      ctx.textAlign = info.align ?? 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.text, info.x, info.y);
      ctx.restore();
    }

    if (layer === 'normal') {
      this.drawGoldCheatFeedbacks();
    }
  }

  private updateGoldCheatFeedbacks(dt: number): void {
    if (this.goldCheatFeedbacks.length === 0) return;

    for (const feedback of this.goldCheatFeedbacks) {
      feedback.lifetime += dt;
    }
    this.goldCheatFeedbacks = this.goldCheatFeedbacks.filter(
      (feedback) => feedback.lifetime < GOLD_CHEAT_FEEDBACK_DURATION,
    );
  }

  private drawGoldCheatFeedbacks(): void {
    if (this.goldCheatFeedbacks.length === 0) return;

    const ctx = this.renderer.context;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = getFont(16, true);
    ctx.lineWidth = 2.5;

    for (const feedback of this.goldCheatFeedbacks) {
      const progress = Math.min(1, feedback.lifetime / GOLD_CHEAT_FEEDBACK_DURATION);
      const y = feedback.y - progress * GOLD_CHEAT_FEEDBACK_FLOAT;
      const alpha = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;

      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.65})`;
      ctx.strokeText(feedback.text, feedback.x, y);
      ctx.fillStyle = `rgba(255, 213, 79, ${alpha})`;
      ctx.fillText(feedback.text, feedback.x, y);
    }

    ctx.restore();
  }

  private drawUIImage(ctx: CanvasRenderingContext2D, image: UIImageDraw): boolean {
    if (image.mode === 'nine-slice' && image.slice) {
      return drawLoadedImage9Slice(ctx, image.path, image.x, image.y, image.w, image.h, image.slice);
    }
    if (image.mode === 'card-frame-mask') {
      return drawLoadedCardFrameMask(ctx, image.path, image.x, image.y, image.w, image.h);
    }
    return drawLoadedImage(ctx, image.path, image.x, image.y, image.w, image.h);
  }

  // ---- Button drawing ----

  private drawButton(btn: UIButton): void {
    const ctx = this.renderer.context;
    const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;

    // v5.0: ghost buttons are invisible click targets — skip visual rendering
    if (btn.ghost) return;

    const lines = btn.label.split('\n');
    const lineH = 16;
    const startY = btn.y + btn.h / 2 - ((lines.length - 1) * lineH) / 2;

    ctx.save();

    const usesSkin = !btn.solidColor && enabled && btn.w >= 70 && btn.w / Math.max(1, btn.h) >= 2;
    if (usesSkin) {
      if (!drawLoadedImage9Slice(ctx, uiArtPath('ui_button_green'), btn.x, btn.y, btn.w, btn.h, UI_BUTTON_SLICE)) {
        ctx.fillStyle = btn.color;
        ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      }
    } else {
      ctx.fillStyle = enabled || btn.keepDisabledColor ? btn.color : '#555555';
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    }

    // Button border
    ctx.strokeStyle = usesSkin ? '#ffffff22' : enabled || btn.keepDisabledColor ? '#ffffff44' : '#333333';
    ctx.lineWidth = 1;
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);

    // Button text
    ctx.fillStyle = enabled ? btn.textColor : '#888888';
    ctx.font = FONTS.body;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i]!, btn.x + btn.w / 2, startY + i * lineH);
    }

    ctx.restore();
  }

  // ============================================================
  // Top HUD (compact single line)
  // ============================================================

  /** Design-space X of viewport right edge (for right-anchored elements) */
  private viewportRightDesignX(): number {
    return LayoutManager.toDesignX(LayoutManager.viewportW);
  }

  /** Design-space X of viewport left edge */
  private viewportLeftDesignX(): number {
    return LayoutManager.toDesignX(0);
  }

  /** Design-space X of viewport horizontal center */
  private viewportCenterDesignX(): number {
    return LayoutManager.toDesignX(LayoutManager.viewportW / 2);
  }

  // ---- v5.0: text wrapping ----

  /** Split text into lines to fit within `maxWidth` pixels at given `fontSize`.
   *  Rough estimate: CJK chars ~ fontSize px, ASCII ~ fontSize*0.55 px. */
  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const lines: string[] = [];
    let current = '';
    let currentW = 0;

    for (const ch of text) {
      const charW = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? fontSize : fontSize * 0.55;
      if (currentW + charW > maxWidth && current.length > 0) {
        lines.push(current);
        current = ch;
        currentW = charW;
      } else {
        current += ch;
        currentW += charW;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines.length > 0 ? lines : [text];
  }

  /**
   * v3.0 roguelike — 手牌区渲染（design/20 §4.5.2）。
   *   - 锚点 bottom-center offset(0, -130)，size 800×180
   *   - 单卡 120×168，水平居中排列，卡间距 16px
   *   - 边框 2px 稀有度色（design/09 §3.2）
   *   - 主图区 96×80 放卡牌图标
   *   - 底部显示名称、金币费用、描述，不再使用悬浮详情面板
   *   - 鼠标悬停卡牌时插值放大并向上弹出手牌区，离开后回落
   *   - 灰色底板与 5 个空槽始终绘制，保证手牌区域存在感
   *   - runContext 未装配时仅绘制底板/空槽，主菜单/编辑器流程保持无交互
   */
  private renderHandZone(): void {
    const bounds = getHandZoneBounds();
    const slotRects = computeHandZoneSlotRects(HAND_ZONE_DEFAULT_SLOT_COUNT);
    this.imageDraws.push({
      x: bounds.left,
      y: bounds.top,
      w: bounds.width,
      h: bounds.height,
      path: uiArtPath('ui_hand_panel'),
      layer: 'normal',
      alpha: 1,
      phase: 'back',
      mode: 'nine-slice',
      slice: UI_HAND_PANEL_SLICE,
      z: UI_Z.NORMAL_UI - 3,
    });
    for (const slot of slotRects) {
      this.renderer.push({
        shape: 'rect',
        x: slot.centerX, y: slot.centerY,
        size: slot.width, h: slot.height,
        color: '#111820',
        alpha: 0.42,
        stroke: '#737b85', strokeWidth: 0.5,
        z: UI_Z.NORMAL_UI - 1,
      });
      this.renderer.push({
        shape: 'rect',
        x: slot.centerX, y: slot.centerY - 10,
        size: slot.width - 18, h: slot.height - 28,
        color: '#202833',
        alpha: 0.24,
        stroke: '#3f4853', strokeWidth: 0.5,
        z: UI_Z.NORMAL_UI - 1,
      });
    }

    const runContext = this._world?.runContext;
    if (!runContext) return;

    const cards = runContext.hand.state.hand;
    if (cards.length === 0) return;

    const slots = computeCardSlotsLayout(cards.length, bounds.width, HAND_ZONE_CARD_WIDTH, HAND_ZONE_GAP);
    const hoveredIndex = this.computeHoveredHandCardIndex(cards.length, bounds, slots);
    this.updateHandCardHoverProgress(cards.length, hoveredIndex);
    const cardDraws: HandCardDrawData[] = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card) continue;
      const slot = slots[i]!;
      const config = runContext.registry.get(card.cardId);
      if (!config) continue;

      const cardLeft = bounds.left + slot.x;
      const cardTop = bounds.top + (bounds.height - HAND_ZONE_CARD_HEIGHT) / 2;
      const cardCenterX = cardLeft + HAND_ZONE_CARD_WIDTH / 2;
      const cardCenterY = cardTop + HAND_ZONE_CARD_HEIGHT / 2;
      const progress = this.handCardHoverProgress[i] ?? 0;
      const scale = 1 + (HAND_CARD_HOVER_SCALE - 1) * progress;
      const drawW = HAND_ZONE_CARD_WIDTH * scale;
      const drawH = HAND_ZONE_CARD_HEIGHT * scale;
      const drawCenterY = cardCenterY - HAND_CARD_HOVER_LIFT * progress;

      cardDraws.push({
        index: i,
        cardId: card.cardId,
        config,
        left: cardCenterX - drawW / 2,
        top: drawCenterY - drawH / 2,
        centerX: cardCenterX,
        centerY: drawCenterY,
        width: drawW,
        height: drawH,
        scale,
        progress,
        z: UI_Z.NORMAL_UI + (progress > 0 ? 7 + progress : i * 0.01),
      });
    }

    cardDraws.sort((a, b) => a.progress - b.progress || a.index - b.index);
    for (const cardDraw of cardDraws) {
      this.drawHandCard(cardDraw);
    }
  }

  private computeHoveredHandCardIndex(
    cardCount: number,
    bounds: ReturnType<typeof getHandZoneBounds>,
    slots: { x: number; y: number }[],
  ): number {
    if (cardCount <= 0) return -1;
    if (!this.getPointerPosition) return -1;
    if (this.getDragState?.()) return -1;

    const pos = this.getPointerPosition();
    const baseHit = hitTestHandCard(pos.x, pos.y, cardCount);
    if (baseHit >= 0) return baseHit;

    const cardTop = bounds.top + (bounds.height - HAND_ZONE_CARD_HEIGHT) / 2;
    for (let i = Math.min(cardCount, slots.length) - 1; i >= 0; i--) {
      const progress = this.handCardHoverProgress[i] ?? 0;
      if (progress <= 0.01) continue;
      const cardLeft = bounds.left + slots[i]!.x;
      const centerX = cardLeft + HAND_ZONE_CARD_WIDTH / 2;
      const centerY = cardTop + HAND_ZONE_CARD_HEIGHT / 2 - HAND_CARD_HOVER_LIFT * progress;
      const width = HAND_ZONE_CARD_WIDTH * (1 + (HAND_CARD_HOVER_SCALE - 1) * progress);
      const height = HAND_ZONE_CARD_HEIGHT * (1 + (HAND_CARD_HOVER_SCALE - 1) * progress);
      if (
        pos.x >= centerX - width / 2 &&
        pos.x <= centerX + width / 2 &&
        pos.y >= centerY - height / 2 &&
        pos.y <= centerY + height / 2
      ) {
        return i;
      }
    }

    return -1;
  }

  private updateHandCardHoverProgress(cardCount: number, hoveredIndex: number): void {
    if (this.handCardHoverProgress.length < cardCount) {
      this.handCardHoverProgress.length = cardCount;
    }
    const step = Math.min(1, Math.max(0, this.frameDt) * HAND_CARD_HOVER_SPEED);
    for (let i = 0; i < this.handCardHoverProgress.length; i++) {
      const current = this.handCardHoverProgress[i] ?? 0;
      const target = i < cardCount && i === hoveredIndex ? 1 : 0;
      this.handCardHoverProgress[i] = current + (target - current) * step;
      if (i >= cardCount || this.handCardHoverProgress[i]! < 0.001) {
        this.handCardHoverProgress[i] = 0;
      }
    }
  }

  private drawHandCard(cardDraw: HandCardDrawData): void {
    const { config } = cardDraw;
    const cardAlpha = 1;
    const category = getHandCardCategory(config);
    const borderColor = HAND_CARD_CATEGORY_COLORS[category];
    const artW = 96 * cardDraw.scale;
    const artH = 80 * cardDraw.scale;
    const artCenterY = cardDraw.top + 12 * cardDraw.scale + artH / 2;

    this.imageDraws.push({
      x: cardDraw.left,
      y: cardDraw.top,
      w: cardDraw.width,
      h: cardDraw.height,
      path: cardFrameArtPath(config.rarity),
      layer: 'normal',
      alpha: cardAlpha,
      phase: 'front',
      mode: 'card-frame-mask',
      z: cardDraw.z + 3,
    });

    this.renderer.push({
      shape: 'rect',
      x: cardDraw.centerX, y: artCenterY,
      size: artW, h: artH,
      color: '#0d1b2a',
      alpha: cardAlpha,
      stroke: '#37474f', strokeWidth: 1,
      z: cardDraw.z + 1,
    });

    if (cardDraw.progress > 0) {
      this.renderer.push({
        shape: 'rect',
        x: cardDraw.centerX, y: cardDraw.centerY,
        size: cardDraw.width, h: cardDraw.height,
        color: '#000000',
        alpha: 0,
        stroke: borderColor, strokeWidth: 3,
        z: cardDraw.z + 4,
      });
    }

    this.cardIconDraws.push({
      cx: cardDraw.centerX, cy: artCenterY, w: artW, h: artH,
      cardId: cardDraw.cardId, color: borderColor, layer: 'normal',
    });

    this.infos.push({
      x: cardDraw.centerX, y: cardDraw.top + 12 * cardDraw.scale + artH + 14 * cardDraw.scale,
      text: config.name,
      color: '#ffffff',
      size: 12, align: 'center',
    });

    this.infos.push({
      x: cardDraw.centerX,
      y: cardDraw.top + 12 * cardDraw.scale + artH + 32 * cardDraw.scale,
      text: HAND_CARD_CATEGORY_LABELS[category],
      color: borderColor,
      size: 10,
      align: 'center',
    });

    const goldCost = config.goldCost;
    if (goldCost !== undefined && goldCost > 0) {
      const goldColor = goldCost <= 40 ? '#ffc107' : goldCost <= 70 ? '#ff9800' : '#ff5722';
      this.infos.push({
        x: cardDraw.centerX, y: cardDraw.top + 12 * cardDraw.scale + artH + 46 * cardDraw.scale,
        text: `💰${goldCost}`,
        color: goldColor,
        size: 11, align: 'center',
      });
    } else if (goldCost === 0) {
      this.infos.push({
        x: cardDraw.centerX, y: cardDraw.top + 12 * cardDraw.scale + artH + 46 * cardDraw.scale,
        text: '免费',
        color: '#66bb6a',
        size: 11, align: 'center',
      });
    }

    if (config.description) {
      const descLines = this.wrapText(config.description, cardDraw.width - 18 * cardDraw.scale, 9);
      for (let li = 0; li < descLines.length && li < 2; li++) {
        this.infos.push({
          x: cardDraw.centerX,
          y: cardDraw.top + 12 * cardDraw.scale + artH + 62 * cardDraw.scale + li * 11,
          text: descLines[li]!,
          color: '#90a4ae',
          size: 9, align: 'center',
        });
      }
    }

    // 右上角 ✦ 金色角标 — design/14 §3.2 line 72：persistAcrossWaves=true 法术卡跨波保留
    if (config.persistAcrossWaves) {
      this.infos.push({
        x: cardDraw.left + cardDraw.width - 12 * cardDraw.scale,
        y: cardDraw.top + 14 * cardDraw.scale,
        text: '✦',
        color: '#ffc107',
        size: 18, align: 'center',
      });
    }
  }

  // renderEnergyBar 已移除 — 能量机制已移除

  private buildTopHUD(phase: GamePhase): void {
    const world = this._world;
    const gold = this.getGold();
    const wave = this.getWave();
    const total = this.getTotalWaves();

    // Full-viewport HUD background bar
    const barLeft = this.viewportLeftDesignX();
    const barRight = this.viewportRightDesignX();
    const barCenterX = (barLeft + barRight) / 2;
    const barWidth = barRight - barLeft;

    this.imageDraws.push({
      x: barLeft,
      y: 0,
      w: barWidth,
      h: UISystem.TOP_H,
      path: uiArtPath('ui_hud_bar'),
      layer: 'normal',
      alpha: 0.9,
      phase: 'back',
      mode: 'nine-slice',
      slice: UI_HUD_SLICE,
    });
    this.renderer.push({
      shape: 'rect',
      x: barCenterX, y: UISystem.TOP_H / 2,
      size: barWidth, h: UISystem.TOP_H,
      color: '#0d1b2a',
      alpha: 0.9,
    });

    const crystalHealth = this.getCrystalHealth?.() ?? null;
    this.infos.push({
      x: UISystem.TOP_HUD_SIDE_MARGIN, y: UISystem.TOP_H / 2,
      text: crystalHealth ? `💎${Math.ceil(crystalHealth.current)}/${Math.ceil(crystalHealth.max)}` : '💎--/--',
      color: '#4fc3f7', size: 20,
    });
    this.infos.push({
      x: UISystem.TOP_HUD_SIDE_MARGIN + 150, y: UISystem.TOP_H / 2,
      text: `💰${gold}`,
      color: '#ffd54f', size: 20,
    });
    if (phase === GamePhase.Battle && this.onGoldCheat) {
      const cheatButton = UISystem.goldCheatButtonRect();
      this.renderer.push({
        shape: 'rect',
        x: cheatButton.x + cheatButton.w / 2,
        y: cheatButton.y + cheatButton.h / 2,
        size: cheatButton.w,
        h: cheatButton.h,
        color: '#5d4037',
        alpha: 0.92,
        stroke: '#ffd54f',
        strokeWidth: 1,
        z: UI_Z.NORMAL_UI,
      });
      this.buttons.push({
        x: cheatButton.x,
        y: cheatButton.y,
        w: cheatButton.w,
        h: cheatButton.h,
        label: '☝',
        color: '#5d4037',
        textColor: '#ffd54f',
        enabled: true,
        solidColor: true,
        onClick: () => { this.onGoldCheat?.(); },
      });
    }

    if (phase === GamePhase.Battle && world) {
      // Count alive enemies via bitecs query
      let aliveCount = 0;
      const enemies = aliveEnemyQuery(world.world);
      for (const eid of enemies) {
        if (UnitTag.isEnemy[eid] === 1 && Health.current[eid]! > 0) {
          aliveCount++;
        }
      }

      const totalSpawned = this.getTotalSpawned?.() ?? 0;
      const weatherName = this.getWeatherName?.() ?? '';
      this.infos.push({
        x: 800, y: UISystem.TOP_H / 2,
        text: `波次 ${wave}/${total > 0 ? total : '∞'}`,
        color: '#ffffff', size: 20,
      });
      this.infos.push({
        x: 1000, y: UISystem.TOP_H / 2,
        text: `敌军:${aliveCount}/${totalSpawned}`,
        color: '#ef5350', size: 20,
      });
      if (weatherName) {
        this.infos.push({
          x: 1200, y: UISystem.TOP_H / 2,
          text: `🌤${weatherName}`,
          color: '#ffcc80', size: 18,
        });
      }
    } else {
      const weatherName = this.getWeatherName?.() ?? '';
      this.infos.push({
        x: 800, y: UISystem.TOP_H / 2,
        text: `波次 ${wave}/${total > 0 ? total : '∞'}`,
        color: '#ffffff', size: 20,
      });
      this.infos.push({
        x: 1000, y: UISystem.TOP_H / 2,
        text: '敌军:0/0',
        color: '#aaaaaa', size: 20,
      });
      if (weatherName) {
        this.infos.push({
          x: 1200, y: UISystem.TOP_H / 2,
          text: `🌤${weatherName}`,
          color: '#ffcc80', size: 18,
        });
      }
    }

    // v3.0 roguelike: 能量机制已移除

    const currentlyPaused = this.isPaused?.() ?? false;

    // Viewport-right-anchored button positions (design-space)
    const rightEdgeD = this.viewportRightDesignX();
    const rightControlsEdgeD = rightEdgeD - UISystem.TOP_HUD_SIDE_MARGIN;
    const hasCardCodex = this.onOpenEncyclopedia !== null;
    const hasEnemyCodex = this.onOpenEnemyCodex !== null;
    const hudBtnW = 29;
    const hudBtnH = 28;
    const hudBtnGap = 12;
    const hudBtnY = (UISystem.TOP_H - hudBtnH) / 2;
    let nextButtonRightX = rightControlsEdgeD;
    const reserveHudButtonSlot = (w = hudBtnW): number => {
      const x = nextButtonRightX - w;
      nextButtonRightX = x - hudBtnGap;
      return x;
    };

    const enemyCodexBtnX = hasEnemyCodex ? reserveHudButtonSlot() : null;
    const cardCodexBtnX = hasCardCodex ? reserveHudButtonSlot() : null;
    const pauseBtnX = reserveHudButtonSlot();

    // 倒计时显示 + 跳过按钮（常驻顶部HUD，替代原全屏遮罩）
    if (!currentlyPaused && this.getCountdown && this.getCountdown() > 0) {
      const cd = this.getCountdown();
      const showStartBtn = cd <= 10;
      const skipBtnW = showStartBtn ? 90 : 50;  // "立即开始" 需要更宽的按钮
      const skipBtnH = 28;
      const skipBtnY = (UISystem.TOP_H - skipBtnH) / 2;
      // 按钮右边缘固定在 speedBtnX - 12px 间距处，宽度变化时左边缘左移
      const skipEndX = nextButtonRightX - 30 - hudBtnGap;
      const skipBtnX = skipEndX - skipBtnW;

      this.infos.push({
        x: skipBtnX - 12, y: UISystem.TOP_H / 2,
        text: `⏱${formatNumber(cd)}s`,
        color: '#ffd54f', size: 20,
        align: 'right',
      });

      // 跳过按钮背景（倒计时 ≤10s 时绿色加亮）
      this.renderer.push({
        shape: 'rect',
        x: skipBtnX + skipBtnW / 2, y: skipBtnY + skipBtnH / 2,
        size: skipBtnW, h: skipBtnH,
        color: showStartBtn ? '#2e7d32' : '#37474f',
        alpha: 0.9,
        stroke: showStartBtn ? '#ffd54f' : '#ffffff', strokeWidth: 1,
        z: UI_Z.NORMAL_UI,
      });

      // 跳过按钮（倒计时 ≤10s 时显示"立即开始"）
      this.buttons.push({
        x: skipBtnX, y: skipBtnY, w: skipBtnW, h: skipBtnH,
        label: showStartBtn ? '立即开始' : '▶',
        color: showStartBtn ? '#2e7d32' : '#37474f',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onSkipCountdown?.(); },
      });
    }

    const speedBtnW = 30;
    const speedBtnX = reserveHudButtonSlot(speedBtnW);
    const speedBtnH = 28;
    const speedBtnY = (UISystem.TOP_H - speedBtnH) / 2;
    const currentSpeed = this.getSpeed?.() ?? 1.0;
    const speedLabel = currentSpeed === 2.0 ? '2x' : '1x';
    const speedColor = currentSpeed === 2.0 ? '#c62828' : '#1565c0';

    this.renderer.push({
      shape: 'rect',
      x: speedBtnX + speedBtnW / 2, y: speedBtnY + speedBtnH / 2,
      size: speedBtnW, h: speedBtnH,
      color: speedColor,
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
      z: UI_Z.NORMAL_UI,
    });

    this.buttons.push({
      x: speedBtnX, y: speedBtnY, w: speedBtnW, h: speedBtnH,
      label: speedLabel,
      color: speedColor,
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onToggleSpeed?.(); },
    });

    // Enemy Codex button — 最右侧
    if (enemyCodexBtnX !== null) {
      this.renderer.push({
        shape: 'rect',
        x: enemyCodexBtnX + hudBtnW / 2, y: hudBtnY + hudBtnH / 2,
        size: hudBtnW, h: hudBtnH,
        color: '#37474f',
        alpha: 0.9,
        stroke: '#ef5350', strokeWidth: 1,
        z: UI_Z.NORMAL_UI,
      });

      this.buttons.push({
        x: enemyCodexBtnX, y: hudBtnY, w: hudBtnW, h: hudBtnH,
        label: '📖',
        color: '#37474f',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onOpenEnemyCodex?.(); },
      });
    }

    // Card Codex button — placed directly to the left of enemy codex.
    if (cardCodexBtnX !== null) {
      this.renderer.push({
        shape: 'rect',
        x: cardCodexBtnX + hudBtnW / 2, y: hudBtnY + hudBtnH / 2,
        size: hudBtnW, h: hudBtnH,
        color: '#37474f',
        alpha: 0.9,
        stroke: '#78909c', strokeWidth: 1,
        z: UI_Z.NORMAL_UI,
      });

      this.buttons.push({
        x: cardCodexBtnX, y: hudBtnY, w: hudBtnW, h: hudBtnH,
        label: '🃏',
        color: '#37474f',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onOpenEncyclopedia?.(); },
      });
    }

    this.renderer.push({
      shape: 'rect',
      x: pauseBtnX + hudBtnW / 2, y: hudBtnY + hudBtnH / 2,
      size: hudBtnW, h: hudBtnH,
      color: '#37474f',
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
      z: UI_Z.NORMAL_UI,
    });

    this.buttons.push({
      x: pauseBtnX, y: hudBtnY, w: hudBtnW, h: hudBtnH,
      label: '⏸',
      color: '#37474f',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => {
        if (currentlyPaused) {
          this.onResume?.();
        } else {
          this.onPause?.();
        }
      },
    });
  }

  // ============================================================
  // Bottom Panel (unified toolbar)
  // ============================================================

  private getSceneBottom(): number {
    return RenderSystem.sceneOffsetY + RenderSystem.sceneH;
  }

  private buildBottomPanel(phase: GamePhase): void {
    const available = phase !== GamePhase.Victory && phase !== GamePhase.Defeat;
    if (!available) return;

    this.renderHandZone();
  }

  // ============================================================
  // Drag Ghost — 渲染与实体一致的复合外观 + 攻击范围
  // ============================================================

  private buildDragGhost(): void {
    const ds = this.getDragState?.();
    if (!ds || !ds.active) return;
    const ptr = this.getPointerPosition?.();
    if (!ptr) return;

    const visual = this.resolveDragGhostVisual(ds);
    const { shape, size, color, label, visualParts, range, sceneArtId } = visual;

    const ghostAlpha = 0.5;
    const z = UI_Z.BOARD_TIPS;

    // 1. 攻击范围预览（先渲染，显示在底层）
    if (range !== undefined && range > 0) {
      if (visual.rangeMode === 'board') {
        const boardX = RenderSystem.sceneOffsetX;
        const boardY = RenderSystem.sceneOffsetY;
        const boardW = RenderSystem.sceneW;
        const boardH = RenderSystem.sceneH;
        this.renderer.push({
          shape: 'rect',
          x: boardX + boardW / 2,
          y: boardY + boardH / 2,
          size: boardW,
          h: boardH,
          color,
          alpha: 0.12,
          z,
        });
        this.renderer.push({
          shape: 'rect',
          x: boardX + boardW / 2,
          y: boardY + boardH / 2,
          size: boardW,
          h: boardH,
          color,
          alpha: 0.28,
          stroke: color,
          strokeWidth: 3,
          z,
        });
      } else {
        this.renderer.push({
          shape: 'circle',
          x: ptr.x, y: ptr.y,
          size: range * 2,
          color,
          alpha: 0.1,
          z,
        });
        this.renderer.push({
          shape: 'circle',
          x: ptr.x, y: ptr.y,
          size: range * 2,
          color,
          alpha: 0.35,
          stroke: color,
          strokeWidth: 2,
          z,
        });
      }
    }

    if (sceneArtId) {
      this.drawDragGhostSprite(sceneArtId, ptr.x, ptr.y, size, ghostAlpha, z);
      return;
    }

    this.renderer.push({
      shape,
      x: ptr.x, y: ptr.y,
      size,
      color,
      alpha: ghostAlpha,
      label,
      labelColor: '#ffffff',
      labelSize: 14,
      z,
    });
  }

  private resolveDragGhostVisual(ds: DragState): DragGhostVisual {
    switch (ds.entityType) {
      case 'tower': {
        const tt = ds.towerType ?? this.getSelectedTower();
        if (tt) {
          const cfg = TOWER_CONFIGS[tt];
          if (cfg) {
            return {
              shape: cfg.shape ?? 'circle',
              size: cfg.size ?? 32,
              color: cfg.color,
              label: cfg.name,
              visualParts: cfg.visualParts,
              range: cfg.range,
              sceneArtId: `tower_${tt}`,
            };
          }
        }
        break;
      }
      case 'unit': {
        const ut = ds.unitType;
        if (ut) {
          const cfg = UNIT_CONFIGS[ut];
          if (cfg) {
            return {
              shape: cfg.shape ?? 'circle',
              size: cfg.size,
              color: cfg.color,
              label: cfg.name,
              visualParts: cfg.visualParts,
              range: cfg.attackRange,
              sceneArtId: ut,
            };
          }
        }
        break;
      }
      case 'trap': {
        const tid = ds.trapTypeId;
        if (tid) {
          const cfg = TRAP_CONFIGS[tid];
          if (cfg) {
            return {
              shape: cfg.shape ?? 'circle',
              size: cfg.size,
              color: cfg.color,
              label: cfg.name,
              visualParts: cfg.visualParts,
              range: cfg.radius ?? cfg.range,
              sceneArtId: this.resolveTrapSceneArtId(tid),
            };
          }
        }
        return {
          shape: 'triangle',
          size: 24,
          color: '#e53935',
          label: '陷阱',
          sceneArtId: 'spike_trap',
        };
      }
      case 'production': {
        const pt = ds.productionType;
        if (pt) {
          const cfg = PRODUCTION_CONFIGS[pt];
          if (cfg) {
            return {
              shape: 'circle',
              size: 30,
              color: cfg.color,
              label: cfg.name,
              sceneArtId: pt,
            };
          }
        }
        break;
      }
      case 'spell': {
        const spellId = ds.spellCardId;
        if (spellId) {
          const spellMeta = resolveSpellPreviewMeta(spellId);
          if (spellMeta.name !== '法术' || spellMeta.radius !== undefined) {
            const subtype = spellMeta.subtype;
            let spellColor = '#7c4dff';
            switch (subtype) {
              case 'damage': spellColor = '#ff5722'; break;
              case 'control': spellColor = '#7c4dff'; break;
              case 'buff' as string: case 'buff_instance' as string: case 'buff_card' as string: spellColor = '#66bb6a'; break;
              case 'utility': spellColor = '#ffd700'; break;
              default: spellColor = '#7c4dff';
            }
            return {
              shape: 'circle',
              size: 28,
              color: spellColor,
              label: spellMeta.name,
              range: spellMeta.radius,
              rangeMode: spellMeta.radius !== undefined && spellMeta.radius >= 9999 ? 'board' : 'circle',
            };
          }
        }
        return {
          shape: 'circle',
          size: 28,
          color: '#7c4dff',
          label: '法术',
        };
      }
    }

    return {
      shape: 'circle',
      size: 32,
      color: '#ffffff',
      label: '',
    };
  }

  private resolveTrapSceneArtId(trapTypeId: string): string | undefined {
    if ((TRAP_TYPE_BY_ID as readonly string[]).includes(trapTypeId)) return trapTypeId;
    return undefined;
  }

  private drawDragGhostSprite(sceneArtId: string, x: number, y: number, size: number, alpha: number, z: number): boolean {
    const sprite = getLoadedImageFrame(unitArtPath(sceneArtId, 'idle', 0));
    if (!sprite) return false;

    const sourceW = sprite.width;
    const sourceH = sprite.height;
    if (sourceW <= 0 || sourceH <= 0) return false;

    const h = size * 1.35;
    const w = h * (sourceW / sourceH);
    this.renderer.push({
      shape: 'rect',
      x,
      y: y - h * 0.08,
      size: w,
      h,
      color: '#ffffff',
      alpha,
      image: sprite.image,
      imageSource: sprite.source ?? undefined,
      z,
    });
    return true;
  }

  // ============================================================
  // Overlays (Victory / Defeat)
  // ============================================================

  private buildOverlay(phase: GamePhase): void {
    if (phase === GamePhase.Victory) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.modalBackdropAlpha = 0;
      this.hasFullscreenOverlay = false;
      this.overlay = null;
    } else if (phase === GamePhase.Defeat) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.modalBackdropAlpha = 0;
      this.hasFullscreenOverlay = false;
      this.overlay = null;
    }
  }

  // ============================================================
  // Pause Overlay
  // ============================================================

  private buildPauseOverlay(): void {
    const mapCenterX = RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2;
    const mapCenterY = RenderSystem.sceneOffsetY + RenderSystem.sceneH / 2;

    this.modalBackdropAlpha = 0.6;
    this.hasFullscreenOverlay = true;

    const menuW = 500;
    const menuH = 380;
    const menuX = mapCenterX - menuW / 2;
    const menuY = mapCenterY - menuH / 2;

    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: mapCenterY,
      size: menuW,
      h: menuH,
      color: '#1a1a2e',
      alpha: 0.95,
      stroke: '#555555',
      strokeWidth: 2,
      z: UI_Z.FULLSCREEN_UI,
    });

    this.infos.push({
      x: mapCenterX,
      y: menuY + 50,
      text: '游 戏 暂 停',
      color: '#ffffff',
      size: 40,
      align: 'center',
      layer: 'fullscreen',
    });

    const btnW = 200;
    const btnH = 50;
    const btnX = mapCenterX - btnW / 2;

    const continueY = menuY + 110;
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: continueY + btnH / 2,
      size: btnW,
      h: btnH,
      color: '#2e7d32',
      alpha: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1,
      z: UI_Z.FULLSCREEN_UI,
    });
    this.buttons.push({
      x: btnX, y: continueY, w: btnW, h: btnH,
      label: '继 续',
      color: '#2e7d32',
      textColor: '#ffffff',
      enabled: true,
      layer: 'fullscreen',
      onClick: () => { this.onResume?.(); },
    });

    const restartY = menuY + 180;
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: restartY + btnH / 2,
      size: btnW,
      h: btnH,
      color: '#f9a825',
      alpha: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1,
      z: UI_Z.FULLSCREEN_UI,
    });
    this.buttons.push({
      x: btnX, y: restartY, w: btnW, h: btnH,
      label: '重新开始',
      color: '#f9a825',
      textColor: '#000000',
      enabled: true,
      layer: 'fullscreen',
      onClick: () => { this.onRestart?.(); },
    });

    const exitY = menuY + 250;
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX,
      y: exitY + btnH / 2,
      size: btnW,
      h: btnH,
      color: '#c62828',
      alpha: 0.9,
      stroke: '#ffffff',
      strokeWidth: 1,
      z: UI_Z.FULLSCREEN_UI,
    });
    this.buttons.push({
      x: btnX, y: exitY, w: btnW, h: btnH,
      label: '退 出',
      color: '#c62828',
      textColor: '#ffffff',
      enabled: true,
      layer: 'fullscreen',
      onClick: () => { this.onExit?.(); },
    });

    const wave = this.getWave();
    const total = this.getTotalWaves();
    this.infos.push({
      x: mapCenterX,
      y: menuY + 320,
      text: total === -1 ? `当前波次: ${wave}` : `当前波次: ${wave} / ${total}`,
      color: '#aaaaaa',
      size: 24,
      align: 'center',
      layer: 'fullscreen',
    });
  }

  // ============================================================
  // CardDraft Overlay — 3选1抽卡面板
  // ============================================================

  private renderCardDraftOverlay(): void {
    const sys = this.cardDraftSystem;
    if (!sys) return;

    const options = sys.getOptions();
    if (options.length === 0) return;

    // Apply gaussian blur to background for modal effect
    this.renderer.applyBlur(12);

    this.modalBackdropAlpha = 0.7;
    this.hasFullscreenOverlay = true;

    const mapCenterX = RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2;
    const mapCenterY = RenderSystem.sceneOffsetY + RenderSystem.sceneH / 2;

    const panelW = 560;
    const panelH = 340;
    const panelX = mapCenterX - panelW / 2;
    const panelY = mapCenterY - panelH / 2;

    // Panel background — unified UI style (#1a1a2e + accent border)
    this.renderer.push({
      shape: 'rect',
      x: mapCenterX, y: mapCenterY,
      size: panelW, h: panelH,
      color: '#1a1a2e', alpha: 0.95,
      stroke: '#7c4dff', strokeWidth: 2,
      z: UI_Z.FULLSCREEN_UI,
    });
    this.imageDraws.push({
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      path: uiArtPath('ui_panel_dark'),
      layer: 'fullscreen',
      alpha: 0.85,
      phase: 'back',
      mode: 'nine-slice',
      slice: UI_PANEL_SLICE,
    });

    // Title at top
    this.infos.push({
      x: mapCenterX, y: panelY + 32,
      text: '🎲 抽卡奖励',
      color: '#ffffff', size: 24, align: 'center',
      layer: 'fullscreen',
    });

    // v5.0: card layout — 3 columns, centered, 120×168 cards
    const cardW = 120;
    const cardH = 168;
    const artW = 96;
    const artH = 80;
    const gap = 24;
    const totalW = options.length * cardW + (options.length - 1) * gap;
    const startX = mapCenterX - totalW / 2 + cardW / 2;
    const cardCenterY = panelY + 100 + cardH / 2; // card top at panelY + 100

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const cx = startX + i * (cardW + gap);
      const cardTop = cardCenterY - cardH / 2;
      const runContext = this._world?.runContext;
      const config = runContext?.registry.get(opt.id);
      const borderColor = config ? rarityBorderColor(config.rarity) : '#ffffff';

      // Card background — hand-card style
      this.renderer.push({
        shape: 'rect', x: cx, y: cardCenterY,
        size: cardW, h: cardH,
        color: '#1a2332', alpha: 0.95,
        stroke: borderColor, strokeWidth: 2,
        z: UI_Z.FULLSCREEN_UI,
      });
      if (config) {
        this.imageDraws.push({
          x: cx - cardW / 2,
          y: cardTop,
          w: cardW,
          h: cardH,
          path: cardFrameArtPath(),
          layer: 'fullscreen',
          alpha: 1,
          z: UI_Z.FULLSCREEN_UI + 6,
        });
      }

      // Art area — hand-card style
      const artCenterY = cardTop + 12 + artH / 2;
      this.renderer.push({
        shape: 'rect', x: cx, y: artCenterY,
        size: artW, h: artH,
        color: '#0d1b2a', alpha: 1,
        stroke: '#37474f', strokeWidth: 1,
        z: UI_Z.FULLSCREEN_UI + 1,
      });

      // Glyph — hand-card style
      if (config) {
        this.cardIconDraws.push({
          cx, cy: artCenterY, w: artW, h: artH,
          cardId: opt.id, color: borderColor, layer: 'fullscreen',
        });
      }

      // Card name — hand-card style
      this.infos.push({
        x: cx, y: cardTop + 12 + artH + 14,
        text: opt.name, color: '#ffffff', size: 12, align: 'center',
        layer: 'fullscreen',
      });

      // Description — compact, below name, auto-wrapped within card
      const descLines = this.wrapText(opt.description, cardW - 16, 9);
      for (let li = 0; li < descLines.length && li < 3; li++) {
        this.infos.push({
          x: cx, y: cardTop + 12 + artH + 34 + li * 12,
          text: descLines[li]!,
          color: '#90a4ae', size: 9, align: 'center',
          layer: 'fullscreen',
        });
      }
    }

    // Action buttons — "确定" and "🎲再抽一次"
    const btnW = 120;
    const btnH = 36;
    const btnGap = 24;
    const btnY = panelY + panelH - btnH - 20;
    const confirmBtnX = mapCenterX - btnW - btnGap / 2;
    const rerollBtnX = mapCenterX + btnGap / 2;

    // Confirm button — "确定" (green)
    this.renderer.push({
      shape: 'rect',
      x: confirmBtnX + btnW / 2, y: btnY + btnH / 2,
      size: btnW, h: btnH,
      color: '#2e7d32', alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
      z: UI_Z.FULLSCREEN_UI,
    });
    this.buttons.push({
      x: confirmBtnX, y: btnY, w: btnW, h: btnH,
      label: '确定',
      color: '#2e7d32', textColor: '#ffffff',
      enabled: true,
      layer: 'fullscreen',
      onClick: () => {
        Sound.play('draft_select');
        sys.confirmDraft();
      },
    });

    // Reroll button — "🎲再抽一次" (blue, one-time use)
    const rerollEnabled = !this.draftRerollUsed;
    this.renderer.push({
      shape: 'rect',
      x: rerollBtnX + btnW / 2, y: btnY + btnH / 2,
      size: btnW, h: btnH,
      color: rerollEnabled ? '#1565c0' : '#37474f', alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
      z: UI_Z.FULLSCREEN_UI,
    });
    this.buttons.push({
      x: rerollBtnX, y: btnY, w: btnW, h: btnH,
      label: '🎲再抽一次',
      color: '#1565c0', textColor: '#ffffff',
      enabled: rerollEnabled,
      layer: 'fullscreen',
      onClick: () => {
        this.draftRerollUsed = true;
        Sound.play('ui_click');
        sys.reroll();
      },
    });
  }

  // ============================================================
  // BuffSelection Overlay — 关间2选1 Buff面板
  // ============================================================

  private renderBuffSelectionOverlay(): void {
    const sys = this.interLevelBuffSystem;
    if (!sys) return;

    const options = sys.getOptions();
    if (options.length === 0) return;

    const mapCenterX = RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2;
    const mapCenterY = RenderSystem.sceneOffsetY + RenderSystem.sceneH / 2;

    this.modalBackdropAlpha = 0.6;

    const panelW = 650;
    const panelH = 320;
    const panelX = mapCenterX - panelW / 2;
    const panelY = mapCenterY - panelH / 2;

    this.renderer.push({
      shape: 'rect',
      x: mapCenterX, y: mapCenterY,
      size: panelW, h: panelH,
      color: '#1a1a2e', alpha: 0.95,
      stroke: '#ff9800', strokeWidth: 2,
      z: UI_Z.FULLSCREEN_UI,
    });

    this.infos.push({
      x: mapCenterX, y: panelY + 30,
      text: '选择一个 Buff 带入下一关',
      color: '#ffffff', size: 24, align: 'center',
      layer: 'fullscreen',
    });

    const cardW = 260;
    const cardH = 220;
    const gap = 30;
    const totalW = options.length * cardW + (options.length - 1) * gap;
    const startX = mapCenterX - totalW / 2 + cardW / 2;
    const cardY = panelY + 100;

    const rarityColors: Record<string, string> = {
      common: '#ffffff',
      rare: '#2196f3',
      epic: '#9c27b0',
    };

    for (let i = 0; i < options.length; i++) {
      const opt = options[i]!;
      const cx = startX + i * (cardW + gap);
      const borderColor = rarityColors[opt.rarity] ?? '#ffffff';

      this.renderer.push({
        shape: 'rect',
        x: cx, y: cardY,
        size: cardW, h: cardH,
        color: '#1a2332', alpha: 0.95,
        stroke: borderColor, strokeWidth: 3,
        z: UI_Z.FULLSCREEN_UI,
      });
      this.imageDraws.push({
        x: cx - 40,
        y: cardY - cardH / 2 + 68,
        w: 80,
        h: 80,
        path: buffArtPath(opt.id),
        layer: 'fullscreen',
      });

      this.infos.push({
        x: cx, y: cardY - cardH / 2 + 30,
        text: opt.name, color: '#ffffff', size: 18, align: 'center',
        layer: 'fullscreen',
      });

      const rarityLabel = this.formatBuffRarity(opt.rarity);
      this.infos.push({
        x: cx, y: cardY - cardH / 2 + 52,
        text: rarityLabel, color: borderColor, size: 13, align: 'center',
        layer: 'fullscreen',
      });

      this.infos.push({
        x: cx, y: cardY + 42,
        text: opt.description,
        color: '#b0bec5', size: 13, align: 'center',
        layer: 'fullscreen',
      });

      this.infos.push({
        x: cx, y: cardY + 78,
        text: `${this.formatBuffEffectType(opt.effect.type)}: ${opt.effect.value > 0 ? '+' : ''}${opt.effect.value}${opt.effect.type.includes('speed') || opt.effect.type === 'hp' ? '%' : ''}`,
        color: '#ffcc80', size: 14, align: 'center',
        layer: 'fullscreen',
      });

      this.buttons.push({
        x: cx - cardW / 2, y: cardY - cardH / 2,
        w: cardW, h: cardH,
        label: `选择 ${opt.name}`,
        color: '#ff9800', textColor: '#ffffff',
        enabled: true,
        layer: 'fullscreen',
        onClick: () => {
          Sound.play('buff_select');
          sys.selectBuff(i);
        },
      });
    }
  }

  private formatBuffRarity(rarity: string): string {
    switch (rarity) {
      case 'common': return '普通';
      case 'rare': return '稀有';
      case 'epic': return '史诗';
      default: return rarity;
    }
  }

  private formatBuffEffectType(type: string): string {
    switch (type) {
      case 'attack_speed': return '攻击速度';
      case 'move_speed': return '移动速度';
      case 'gold_multiplier': return '金币收益';
      case 'hand_size': return '手牌上限';
      case 'draft_options': return '抽卡选项';
      case 'atk': return '攻击';
      case 'hp': return '生命';
      case 'range': return '射程';
      case 'slow': return '减速';
      case 'dot': return '持续伤害';
      case 'gold': return '金币';
      default: return type;
    }
  }

  // ============================================================
  // Input — button hit-testing (unchanged)
  // ============================================================

  handleClick(x: number, y: number): boolean {
    // CardDraft / BuffSelection overlays consume all clicks (buttons handle their own)
    if (this.cardDraftSystem?.isActive()) {
      for (const btn of this.buttons) {
        const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;
        if (enabled && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          btn.onClick();
          return true;
        }
      }
      return true; // consume click even outside buttons (block everything else)
    }

    if (this.interLevelBuffSystem?.isActive()) {
      for (const btn of this.buttons) {
        const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;
        if (enabled && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          btn.onClick();
          return true;
        }
      }
      return true;
    }

    for (const btn of this.buttons) {
      const enabled = typeof btn.enabled === 'function' ? btn.enabled() : btn.enabled;
      if (enabled && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.onClick();
        return true;
      }
    }
    return false;
  }
}
