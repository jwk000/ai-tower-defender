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
import { TOWER_CONFIGS, UNIT_CONFIGS, PRODUCTION_CONFIGS } from '../data/gameData.js';
import { GamePhase, TowerType, UnitType, ProductionType, type ShapeType } from '../types/index.js';
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
  Trap,
  PlayerOwned,
  BatTower,
} from '../core/components.js';
import type { CardConfig, CardType } from '../config/cardRegistry.js';
import type { CardDraftSystem } from './CardDraftSystem.js';
import type { InterLevelBuffSystem } from './InterLevelBuffSystem.js';
import { Sound } from '../utils/Sound.js';
import {
  computeCardSlotsLayout,
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
import { drawCardIcon, drawMiniCard } from '../ui/CardEncyclopediaUI.js';

// Re-export for backward compatibility
export {
  computeCardSlotsLayout,
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
  cx: number; cy: number; cardId: string; name: string; description: string; color: string;
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
}

interface UIInfo {
  x: number; y: number;
  text: string; color: string; size: number;
  align?: CanvasTextAlign;
}

interface UIOverlay {
  phase: GamePhase;
  color: string;
  title: string;
  subtext: string;
}

interface DragState {
  active: boolean;
  entityType: 'tower' | 'unit' | 'production' | 'trap' | 'spell';
  towerType?: TowerType;
  unitType?: UnitType;
  productionType?: ProductionType;
  spellCardId?: string;
}

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
  static readonly BTN_W = 80;
  static readonly BTN_H = 80;
  static readonly BTN_GAP = 8;

  /** Bottom panel layout constants */
  static readonly PANEL_W = 1344;   // matches map width (21×64=1344)
  static readonly PANEL_H = 100;    // compact, holds single row of 80×80 buttons
  static readonly PANEL_LEFT = (LayoutManager.DESIGN_W - 1344) / 2; // 288 — centered horizontally
  static readonly PANEL_BTN_START_X = UISystem.PANEL_LEFT + 20; // 308 — inner margin

  private buttons: UIButton[] = [];
  private infos: UIInfo[] = [];
  private overlay: UIOverlay | null = null;

  /** Tower info panel background — drawn in renderUI() to stay above weather tint */
  private towerPanelBg: { x: number; y: number; w: number; h: number; strokeColor: string } | null = null;

  /** v5.0: modal backdrop alpha drawn in viewport-space (0 = hidden, 0.6 = visible) */
  private modalBackdropAlpha: number = 0;

  /** Card icon draws — collected during update(), drawn directly in renderUI() */
  private cardIconDraws: CardIconDraw[] = [];

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
    const phase = this.getPhase();

    this.buttons = [];
    this.infos = [];
    this.overlay = null;
    this.modalBackdropAlpha = 0;
    this.cardIconDraws = [];

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
    } else {
      this.towerPanelBg = null;
    }

    this.buildTopHUD(phase);
    this.buildBottomPanel(phase);
    this.buildCountdownOverlay(phase);
    this.buildOverlay(phase);

    this.buildDragGhost();
  }

  // ============================================================
  // Range Preview (tower / trap)
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
    } else if (this.selectedEntityType === 'trap') {
      const trapRadius = Trap.radius[id];
      if (trapRadius === undefined) return;
      diameter = trapRadius * 2;
      color = '#e53935';
    } else {
      return;
    }

    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter!,
      color,
      alpha: 0.1,
      z: 20,
    });
    this.renderer.push({
      shape: 'circle',
      x: px, y: py,
      size: diameter!,
      color,
      alpha: 0.35,
      stroke: color,
      strokeWidth: 2,
      z: 20,
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
    const range = isBat ? (BatTower.batAttackRange[id] ?? 0) : (Attack.range[id] ?? 0);
    const atkSpeed = isBat ? (BatTower.batAttackSpeed[id] ?? 0) : (Attack.attackSpeed[id] ?? 0);

    // Upgrade info
    const maxLevel = config.upgradeCosts.length + 1;
    const canUpgrade = level < maxLevel;
    const upgradeCost = canUpgrade ? (config.upgradeCosts[level - 1] ?? 0) : 0;
    const gold = this.getGold();
    const canAfford = gold >= upgradeCost;

    // Refund info
    const refund = this.getRefundQuote?.(id);

    // Panel layout — above the tower
    const panelW = 200;
    const panelH = 180;
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
      y: panelY + 20,
      text: `${config.name} Lv.${level}`,
      color: '#ffffff',
      size: 16,
      align: 'center',
    });

    // Stats
    this.infos.push({
      x: panelLeft + 15,
      y: panelY + 48,
      text: `攻击: ${Math.round(atk)}`,
      color: '#e0e0e0',
      size: 13,
    });
    this.infos.push({
      x: panelLeft + 15,
      y: panelY + 68,
      text: `范围: ${Math.round(range)}`,
      color: '#e0e0e0',
      size: 13,
    });
    this.infos.push({
      x: panelLeft + 15,
      y: panelY + 88,
      text: `攻速: ${atkSpeed.toFixed(1)}/s`,
      color: '#e0e0e0',
      size: 13,
    });

    // Upgrade button — green
    const btnW = 85;
    const btnH = 32;
    const btnY = panelY + panelH - 50;

    this.buttons.push({
      x: panelLeft + 8,
      y: btnY,
      w: btnW,
      h: btnH,
      label: canUpgrade ? `升级 ${upgradeCost}G` : '满级',
      color: canUpgrade && canAfford ? '#4caf50' : '#555555',
      textColor: '#ffffff',
      enabled: canUpgrade && canAfford,
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
      onClick: () => {
        this.onRecycleEntity?.(id);
        this.selectedEntityId = null;
        this.selectedEntityType = null;
      },
    });
  }

  // ============================================================
  // renderUI — direct Canvas 2D text overlay (called from onPostRender)
  // ============================================================

  renderUI(): void {
    const ctx = this.renderer.context;

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

    // Draw tower info panel background (after weather tint, before buttons/text)
    if (this.towerPanelBg) {
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

    for (const btn of this.buttons) {
      this.drawButton(btn);
    }

    for (const info of this.infos) {
      ctx.save();
      ctx.fillStyle = info.color;
      ctx.font = getFont(info.size, true);
      ctx.textAlign = info.align ?? 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.text, info.x, info.y);
      ctx.restore();
    }

    // Draw vector card icons (hand zone + draft overlay)
    for (const cd of this.cardIconDraws) {
      ctx.save();
      drawMiniCard(ctx, cd.cx, cd.cy, cd.cardId, cd.name, cd.description, cd.color);
      ctx.restore();
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

    // Button background
    ctx.fillStyle = enabled ? btn.color : '#555555';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);

    // Button border
    ctx.strokeStyle = enabled ? '#ffffff44' : '#333333';
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
   *   - 单卡 120×168，水平居中排列，卡间距 16px，最多 8 张
   *   - 边框 2px 稀有度色（design/09 §3.2）
   *   - 主图区 96×80 放占位符号（type 字母 + 卡名首字）
   *   - 底部：◇ 能量消耗（蓝色菱形）
   *   - 右上角：persistAcrossWaves=true 画金色 ✦ 角标（design/14 §3.2 line 72）
   *   - 能量不足整卡 alpha=0.4 并叠加"能量不足"红字
   *   - runContext 未装配时静默跳过（主菜单/编辑器流程）
   */
  private renderHandZone(): void {
    const runContext = this._world?.runContext;
    if (!runContext) return;

    const cards = runContext.hand.state.hand;
    if (cards.length === 0) return;

    const REGION_W = 800;
    const REGION_H = 180;
    const CARD_W = 120;
    const CARD_H = 168;
    const GAP = 16;

    const regionCenterX = LayoutManager.DESIGN_W / 2;
    const regionCenterY = LayoutManager.DESIGN_H - 130;
    const regionLeft = regionCenterX - REGION_W / 2;
    const regionTop = regionCenterY - REGION_H / 2;

    const slots = computeCardSlotsLayout(cards.length, REGION_W, CARD_W, GAP);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card) continue;
      const slot = slots[i]!;
      const config = runContext.registry.get(card.cardId);
      if (!config) continue;

      const cardLeft = regionLeft + slot.x;
      const cardTop = regionTop + (REGION_H - CARD_H) / 2;
      const cardCenterX = cardLeft + CARD_W / 2;
      const cardCenterY = cardTop + CARD_H / 2;

      const cardAlpha = 1;
      const borderColor = rarityBorderColor(config.rarity);

      this.renderer.push({
        shape: 'rect',
        x: cardCenterX, y: cardCenterY,
        size: CARD_W, h: CARD_H,
        color: '#1a2332',
        alpha: cardAlpha * 0.95,
        stroke: borderColor, strokeWidth: 2,
      });

      const artW = 96;
      const artH = 80;
      const artCenterY = cardTop + 12 + artH / 2;
      this.renderer.push({
        shape: 'rect',
        x: cardCenterX, y: artCenterY,
        size: artW, h: artH,
        color: '#0d1b2a',
        alpha: cardAlpha,
        stroke: '#37474f', strokeWidth: 1,
      });

      const glyph = cardTypeGlyph(config.type);
      this.cardIconDraws.push({
        cx: cardCenterX, cy: cardCenterY,
        cardId: card.cardId,
        name: config.name,
        description: config.description ?? '',
        color: borderColor,
      });

      this.infos.push({
        x: cardCenterX, y: cardTop + 12 + artH + 14,
        text: config.name,
        color: '#ffffff',
        size: 12, align: 'center',
      });

      // 右上角 ✦ 金色角标 — design/14 §3.2 line 72：persistAcrossWaves=true 法术卡跨波保留
      if (config.persistAcrossWaves) {
        this.infos.push({
          x: cardLeft + CARD_W - 12, y: cardTop + 14,
          text: '✦',
          color: '#ffc107',
          size: 18, align: 'center',
        });
      }
    }
  }


  /**
   * v3.0 roguelike — A4-UI A2 悬停详情卡片（design/14 §3.2 line 77）。
   *   - 鼠标位置由 getPointerPosition callback 提供（每帧最新值）
   *   - hitTestHandCard 命中槽位 i → 取 runContext.hand[i] → CardConfig
   *   - buildCardTooltipLines 结构化文本 + computeTooltipAnchor 定位
   *   - 在所有手牌渲染之后绘制（保证 z-order 在最上）
   *   - runContext 未装配 / getPointerPosition 未注入 / 未命中手牌 时静默跳过
   *   - 拖卡 (BuildSystem.dragState != null) 期间不显示，避免与拖拽视觉重叠
   */
  private renderHandTooltip(): void {
    const runContext = this._world?.runContext;
    if (!runContext) return;
    if (!this.getPointerPosition) return;
    if (this.getDragState?.()) return;
    const cards = runContext.hand.state.hand;
    if (cards.length === 0) return;

    const pos = this.getPointerPosition();
    const idx = hitTestHandCard(pos.x, pos.y, cards.length);
    if (idx < 0) return;

    const card = cards[idx];
    if (!card) return;

    const config = runContext.registry.get(card.cardId);
    if (!config) return;

    const REGION_W = 800;
    const CARD_W = 120;
    const GAP = 16;
    const anchor = computeTooltipAnchor(idx, cards.length, REGION_W, CARD_W, GAP);
    const lines = buildCardTooltipLines(config);
    const borderColor = rarityBorderColor(config.rarity);

    this.renderer.push({
      shape: 'rect',
      x: anchor.x + CARD_TOOLTIP_WIDTH / 2,
      y: anchor.y + CARD_TOOLTIP_HEIGHT / 2,
      size: CARD_TOOLTIP_WIDTH, h: CARD_TOOLTIP_HEIGHT,
      color: '#0d1b2a', alpha: 0.96,
      stroke: borderColor, strokeWidth: 3,
    });

    let cursorY = anchor.y + 28;
    for (const line of lines) {
      switch (line.kind) {
        case 'name':
          this.infos.push({
            x: anchor.x + CARD_TOOLTIP_WIDTH / 2, y: cursorY,
            text: line.text, color: borderColor, size: 22, align: 'center',
          });
          cursorY += 30;
          break;
        case 'meta':
          this.infos.push({
            x: anchor.x + CARD_TOOLTIP_WIDTH / 2, y: cursorY,
            text: line.text, color: '#90a4ae', size: 13, align: 'center',
          });
          cursorY += 24;
          break;
        case 'energy':
          this.infos.push({
            x: anchor.x + CARD_TOOLTIP_WIDTH / 2, y: cursorY,
            text: line.text, color: '#bbdefb', size: 18, align: 'center',
          });
          cursorY += 28;
          break;
        case 'persist':
          this.infos.push({
            x: anchor.x + CARD_TOOLTIP_WIDTH / 2, y: cursorY,
            text: line.text, color: '#ffc107', size: 14, align: 'center',
          });
          cursorY += 22;
          break;
        case 'desc':
          this.infos.push({
            x: anchor.x + 16, y: cursorY,
            text: line.text, color: '#e0e0e0', size: 13,
          });
          cursorY += 20 * Math.max(1, Math.ceil(line.text.length / 20));
          break;
        case 'flavor':
          this.infos.push({
            x: anchor.x + CARD_TOOLTIP_WIDTH / 2, y: cursorY,
            text: line.text, color: '#78909c', size: 11, align: 'center',
          });
          cursorY += 18;
          break;
      }
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

    this.renderer.push({
      shape: 'rect',
      x: barCenterX, y: UISystem.TOP_H / 2,
      size: barWidth, h: UISystem.TOP_H,
      color: '#0d1b2a',
      alpha: 0.9,
    });

    this.infos.push({
      x: 20, y: UISystem.TOP_H / 2,
      text: `💰${gold}`,
      color: '#ffd54f', size: 20,
    });

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

    if (!currentlyPaused && this.getCountdown && this.getCountdown() > 0) {
      const cd = this.getCountdown();
      this.infos.push({
        x: rightEdgeD - 270, y: UISystem.TOP_H / 2,
        text: `⏱${formatNumber(cd)}s`,
        color: '#ffd54f', size: 20,
      });

      const skipBtnX = rightEdgeD - 133;  // 12(gap) + 50(btnW) + 12(gap) + 30(btnW) + 12(gap) + 29(btnW) = 133
      const skipBtnW = 50;
      const skipBtnH = 28;
      const skipBtnY = (UISystem.TOP_H - skipBtnH) / 2;

      this.renderer.push({
        shape: 'rect',
        x: skipBtnX + skipBtnW / 2, y: skipBtnY + skipBtnH / 2,
        size: skipBtnW, h: skipBtnH,
        color: '#2e7d32',
        alpha: 0.9,
        stroke: '#ffffff', strokeWidth: 1,
      });

      this.buttons.push({
        x: skipBtnX, y: skipBtnY, w: skipBtnW, h: skipBtnH,
        label: '▶',
        color: '#2e7d32',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onSkipCountdown?.(); },
      });
    }

    const speedBtnX = rightEdgeD - 71;    // 12(gap) + 30(btnW) + 12(gap) + 29(btnW) = 71
    const speedBtnW = 30;
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
    });

    this.buttons.push({
      x: speedBtnX, y: speedBtnY, w: speedBtnW, h: speedBtnH,
      label: speedLabel,
      color: speedColor,
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onToggleSpeed?.(); },
    });

    const pauseBtnX = rightEdgeD - 29;    // touches viewport right edge
    const pauseBtnW = 29;
    const pauseBtnH = 28;
    const pauseBtnY = (UISystem.TOP_H - pauseBtnH) / 2;

    this.renderer.push({
      shape: 'rect',
      x: pauseBtnX + pauseBtnW / 2, y: pauseBtnY + pauseBtnH / 2,
      size: pauseBtnW, h: pauseBtnH,
      color: '#37474f',
      alpha: 0.9,
      stroke: '#ffffff', strokeWidth: 1,
    });

    this.buttons.push({
      x: pauseBtnX, y: pauseBtnY, w: pauseBtnW, h: pauseBtnH,
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
    this.renderHandTooltip();
  }

  // ============================================================
  // Drag Ghost (unchanged — no component access)
  // ============================================================

  private buildDragGhost(): void {
    const ds = this.getDragState?.();
    if (!ds || !ds.active) return;
    const ptr = this.getPointerPosition?.();
    if (!ptr) return;

    let color = '#ffffff';
    let shape: ShapeType = 'circle';
    let size = 32;
    let label = '';

    switch (ds.entityType) {
      case 'tower': {
        const tt = ds.towerType ?? this.getSelectedTower();
        if (tt) {
          const cfg = TOWER_CONFIGS[tt];
          if (cfg) {
            color = cfg.color;
            shape = 'circle';
            size = 32;
            label = cfg.name;
          }
        }
        break;
      }
      case 'unit': {
        const ut = ds.unitType;
        if (ut) {
          const cfg = UNIT_CONFIGS[ut];
          if (cfg) {
            color = cfg.color;
            shape = 'circle';
            size = cfg.size;
            label = cfg.name;
          }
        }
        break;
      }
      case 'production': {
        const pt = ds.productionType;
        if (pt) {
          const cfg = PRODUCTION_CONFIGS[pt];
          if (cfg) {
            color = cfg.color;
            shape = 'circle';
            size = 30;
            label = cfg.name;
          }
        }
        break;
      }
      case 'trap': {
        color = '#e53935';
        shape = 'triangle';
        size = 24;
        label = '陷阱';
        break;
      }
      case 'spell': {
        color = '#7c4dff';
        shape = 'circle';
        size = 28;
        label = '法术';
        break;
      }
    }

    this.renderer.push({
      shape,
      x: ptr.x, y: ptr.y,
      size,
      color,
      alpha: 0.5,
      label,
      labelColor: '#ffffff',
      labelSize: 14,
    });
  }

  // ============================================================
  // Countdown Overlay (Deployment / WaveBreak)
  // ============================================================

  /** v5.0: center-screen countdown overlay with large timer and skip button.
   *  Appears during Deployment and WaveBreak when countdown > 0. */
  private buildCountdownOverlay(phase: GamePhase): void {
    const cd = this.getCountdown?.() ?? 0;
    if (cd <= 0) return;
    if (phase === GamePhase.Battle || phase === GamePhase.Victory || phase === GamePhase.Defeat) return;

    const cx = LayoutManager.DESIGN_W / 2;
    const cy = LayoutManager.DESIGN_H / 2;
    const panelW = 520;
    const panelH = 280;

    // v5.0: signal renderUI() to draw a full-viewport dark backdrop.
    // This MUST cover the actual viewport (not just design-space) so it
    // works correctly on ultrawide and non-16:9 displays.
    this.modalBackdropAlpha = 0.6;

    // Panel background
    this.renderer.push({
      shape: 'rect', x: cx, y: cy,
      size: panelW, h: panelH,
      color: '#1a1a2e', alpha: 0.95,
      stroke: '#ffd54f', strokeWidth: 3,
      z: 1000,
    });

    // Wave label
    const isFirstWave = phase === GamePhase.Deployment;
    const labelText = isFirstWave ? '敌军即将来袭！' : `第 ${this.getWave?.() ?? 1} 波准备`;
    this.infos.push({
      x: cx, y: cy - 90,
      text: labelText,
      color: '#ffd54f', size: 28,
      align: 'center',
    });

    // Countdown timer — large number
    const cdDisplay = Math.ceil(cd);
    this.infos.push({
      x: cx, y: cy - 20,
      text: `${cdDisplay}`,
      color: '#ffffff', size: 72,
      align: 'center',
    });

    // "秒" label
    this.infos.push({
      x: cx, y: cy + 30,
      text: '秒',
      color: '#aaaaaa', size: 24,
      align: 'center',
    });

    // Skip button — large, centered below the countdown
    const btnW = 200;
    const btnH = 48;
    const btnX = cx - btnW / 2;
    const btnY = cy + 60;

    this.buttons.push({
      x: btnX, y: btnY, w: btnW, h: btnH,
      label: '▶ 现在开始',
      color: '#2e7d32',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onSkipCountdown?.(); },
    });
  }

  // ============================================================
  // Overlays (Victory / Defeat)
  // ============================================================

  private buildOverlay(phase: GamePhase): void {
    if (phase === GamePhase.Victory) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.modalBackdropAlpha = 0.6;
      this.overlay = { phase, color: '#4caf50', title: '胜利!', subtext: '刷新页面重新开始' };
    } else if (phase === GamePhase.Defeat) {
      this.selectedEntityId = null;
      this.selectedEntityType = null;
      this.modalBackdropAlpha = 0.6;
      this.overlay = { phase, color: '#f44336', title: '失败!', subtext: '刷新页面重新开始' };
    }
  }

  // ============================================================
  // Pause Overlay
  // ============================================================

  private buildPauseOverlay(): void {
    const mapCenterX = RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2;
    const mapCenterY = RenderSystem.sceneOffsetY + RenderSystem.sceneH / 2;

    this.modalBackdropAlpha = 0.6;

    const hasEncyclopedia = this.onOpenEncyclopedia !== null;
    const menuW = 500;
    const menuH = hasEncyclopedia ? 450 : 380;
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
    });

    this.infos.push({
      x: mapCenterX,
      y: menuY + 50,
      text: '游 戏 暂 停',
      color: '#ffffff',
      size: 40,
      align: 'center',
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
    });
    this.buttons.push({
      x: btnX, y: continueY, w: btnW, h: btnH,
      label: '继 续',
      color: '#2e7d32',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onResume?.(); },
    });

    // Encyclopedia button (conditionally shown)
    const encY = menuY + 180;
    if (hasEncyclopedia) {
      this.renderer.push({
        shape: 'rect',
        x: mapCenterX,
        y: encY + btnH / 2,
        size: btnW,
        h: btnH,
        color: '#37474f',
        alpha: 0.9,
        stroke: '#78909c',
        strokeWidth: 1,
      });
      this.buttons.push({
        x: btnX, y: encY, w: btnW, h: btnH,
        label: '📖 卡牌图鉴',
        color: '#37474f',
        textColor: '#ffffff',
        enabled: true,
        onClick: () => { this.onOpenEncyclopedia?.(); },
      });
    }

    const restartY = hasEncyclopedia ? menuY + 250 : menuY + 180;
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
    });
    this.buttons.push({
      x: btnX, y: restartY, w: btnW, h: btnH,
      label: '重新开始',
      color: '#f9a825',
      textColor: '#000000',
      enabled: true,
      onClick: () => { this.onRestart?.(); },
    });

    const exitY = hasEncyclopedia ? menuY + 320 : menuY + 250;
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
    });
    this.buttons.push({
      x: btnX, y: exitY, w: btnW, h: btnH,
      label: '退 出',
      color: '#c62828',
      textColor: '#ffffff',
      enabled: true,
      onClick: () => { this.onExit?.(); },
    });

    const wave = this.getWave();
    const total = this.getTotalWaves();
    this.infos.push({
      x: mapCenterX,
      y: hasEncyclopedia ? menuY + 390 : menuY + 320,
      text: total === -1 ? `当前波次: ${wave}` : `当前波次: ${wave} / ${total}`,
      color: '#aaaaaa',
      size: 24,
      align: 'center',
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
    });

    // Title at top
    this.infos.push({
      x: mapCenterX, y: panelY + 32,
      text: '🎲 抽卡奖励',
      color: '#ffffff', size: 24, align: 'center',
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

      // Card draw via drawMiniCard
      this.cardIconDraws.push({
        cx, cy: cardCenterY,
        cardId: opt.id, name: opt.name, description: opt.description, color: borderColor,
      });

      // Ghost click target over entire card
      this.buttons.push({
        x: cx - cardW / 2, y: cardTop,
        w: cardW, h: cardH,
        label: '',
        color: '#000000', textColor: '#ffffff',
        enabled: true,
        ghost: true,
        onClick: () => {
          Sound.play('draft_select');
          sys.selectOption(i);
        },
      });
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
    });
    this.buttons.push({
      x: confirmBtnX, y: btnY, w: btnW, h: btnH,
      label: '确定',
      color: '#2e7d32', textColor: '#ffffff',
      enabled: true,
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
    });
    this.buttons.push({
      x: rerollBtnX, y: btnY, w: btnW, h: btnH,
      label: '🎲再抽一次',
      color: '#1565c0', textColor: '#ffffff',
      enabled: rerollEnabled,
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
    });

    this.infos.push({
      x: mapCenterX, y: panelY + 30,
      text: '选择一个 Buff 带入下一关',
      color: '#ffffff', size: 24, align: 'center',
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
      });

      this.infos.push({
        x: cx, y: cardY - cardH / 2 + 30,
        text: opt.name, color: '#ffffff', size: 18, align: 'center',
      });

      const rarityLabel = opt.rarity.charAt(0).toUpperCase() + opt.rarity.slice(1);
      this.infos.push({
        x: cx, y: cardY - cardH / 2 + 52,
        text: rarityLabel, color: borderColor, size: 13, align: 'center',
      });

      this.infos.push({
        x: cx, y: cardY,
        text: opt.description,
        color: '#b0bec5', size: 13, align: 'center',
      });

      this.infos.push({
        x: cx, y: cardY + 50,
        text: `${opt.effect.type}: ${opt.effect.value > 0 ? '+' : ''}${opt.effect.value}${opt.effect.type.includes('speed') || opt.effect.type === 'hp' ? '%' : ''}`,
        color: '#ffcc80', size: 14, align: 'center',
      });

      this.buttons.push({
        x: cx - cardW / 2, y: cardY - cardH / 2,
        w: cardW, h: cardH,
        label: `选择 ${opt.name}`,
        color: '#ff9800', textColor: '#ffffff',
        enabled: true,
        onClick: () => {
          Sound.play('buff_select');
          sys.selectBuff(i);
        },
      });
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
