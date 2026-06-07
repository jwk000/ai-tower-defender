import { DebugPanel, type DebugAction } from './DebugPanel.js';
import { CardListWindow } from './CardListWindow.js';
import type { TowerWorld } from '../core/World.js';
import type { EntityId } from '../types/index.js';
import { CType } from '../types/index.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { Unit } from '../components/Unit.js';
import type { Tower } from '../components/Tower.js';
import type { Enemy } from '../components/Enemy.js';
import type { EconomySystem } from '../systems/EconomySystem.js';
import type { HandSystem } from '../systems/HandSystem.js';
import { ALL_CARDS } from '../data/cards.js';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';

export interface DebugManagerHooks {
  getEconomy?: () => EconomySystem | null;
  getHandSystem?: () => HandSystem | null;
  onLevelProgressChanged?: () => void;
  onOpenLevelEditor?: () => void;
  /** v6.0: 跳过当前关卡直接通关（测试胜利界面用） */
  onSkipToVictory?: () => void;
}

const GOLD_BONUS = 99999;
const FULL_STARS = 3;

export class DebugManager {
  private world: TowerWorld;
  private debugPanel: DebugPanel;
  private cardListWindow: CardListWindow;

  private selectedEntityId: EntityId | null = null;

  /** 调试开关：是否显示关卡背景图（替代天气天空渐变） */
  showBackgroundImage: boolean = false;

  private getEconomyFn: (() => EconomySystem | null) | null = null;
  private getHandSystemFn: (() => HandSystem | null) | null = null;
  private onLevelProgressChangedFn: (() => void) | null = null;
  private onOpenLevelEditorFn: (() => void) | null = null;
  private onSkipToVictoryFn: (() => void) | null = null;

  constructor(world: TowerWorld, hooks: DebugManagerHooks = {}) {
    this.world = world;
    this.getEconomyFn = hooks.getEconomy ?? null;
    this.getHandSystemFn = hooks.getHandSystem ?? null;
    this.onLevelProgressChangedFn = hooks.onLevelProgressChanged ?? null;
    this.onOpenLevelEditorFn = hooks.onOpenLevelEditor ?? null;
    this.onSkipToVictoryFn = hooks.onSkipToVictory ?? null;

    this.cardListWindow = new CardListWindow();
    this.setupCardListWindow();
    this.debugPanel = new DebugPanel(this.buildActions());
    this.setupKeyboardShortcuts();
  }

  getActions(): DebugAction[] {
    return this.buildActions();
  }

  setEconomyProvider(provider: () => EconomySystem | null): void {
    this.getEconomyFn = provider;
    this.debugPanel.refresh();
  }

  setOnLevelProgressChanged(cb: () => void): void {
    this.onLevelProgressChangedFn = cb;
  }

  setOpenLevelEditorCallback(cb: () => void): void {
    this.onOpenLevelEditorFn = cb;
    this.debugPanel.setActions(this.buildActions());
  }

  toggleBackgroundImage(): void {
    this.showBackgroundImage = !this.showBackgroundImage;
    this.debugPanel.flashButton(
      'toggle_bg_image',
      this.showBackgroundImage ? '🖼️ 背景图：开' : '🖼️ 背景图：关',
      1500,
    );
  }

  isBackgroundImageEnabled(): boolean {
    return this.showBackgroundImage;
  }

  private buildActions(): DebugAction[] {
    const actions: DebugAction[] = [
      {
        id: 'toggle_bg_image',
        label: '关卡背景图切换',
        icon: '🖼️',
        isEnabled: () => true,
        onClick: () => this.toggleBackgroundImage(),
      },
      {
        id: 'complete_all_levels',
        label: '一键通关（全部 3 星）',
        icon: '🏆',
        isEnabled: () => true,
        onClick: () => this.completeAllLevels(),
      },
      {
        id: 'add_gold',
        label: `金币 +${GOLD_BONUS}`,
        icon: '💰',
        isEnabled: () => this.getEconomy() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.addDebugGold(),
      },
      {
        id: 'show_card_list',
        label: '查看全部卡牌',
        icon: '🃏',
        isEnabled: () => this.getHandSystem() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.showCardList(),
      },
      {
        id: 'skip_to_victory',
        label: '🏁 直接通关（测试用）',
        icon: '🏁',
        isEnabled: () => this.getEconomy() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.skipToVictory(),
      },
    ];
    if (this.onOpenLevelEditorFn) {
      const openEditor = this.onOpenLevelEditorFn;
      actions.push({
        id: 'open_level_editor',
        label: '关卡编辑器 (F2)',
        icon: '🛠️',
        isEnabled: () => true,
        onClick: () => openEditor(),
      });
    }
    return actions;
  }

  private getEconomy(): EconomySystem | null {
    return this.getEconomyFn ? this.getEconomyFn() : null;
  }

  private getHandSystem(): HandSystem | null {
    return this.getHandSystemFn ? this.getHandSystemFn() : null;
  }

  private setupCardListWindow(): void {
    this.cardListWindow.setOnCardSelected((card) => {
      const handSystem = this.getHandSystem();
      if (!handSystem) {
        console.warn('[DebugManager] getHandSystem() returned null — not in battle?');
        return;
      }

      // 确保卡牌在卡牌库中
      handSystem.addCardsToLibrary([card]);

      // 尝试添加到手牌
      const handBefore = handSystem.getHand().map(c => c?.id ?? null);
      console.log('[DebugManager] drawCard attempt:', card.id, 'handBefore:', handBefore, 'isFull:', handSystem.isFull());
      const success = handSystem.drawCard(card.id);
      const handAfter = handSystem.getHand().map(c => c?.id ?? null);
      console.log('[DebugManager] drawCard result:', success, 'handAfter:', handAfter);
      if (!success) {
        console.warn(`[DebugManager] 手牌已满或卡牌无效，无法添加卡牌: ${card.name} (${card.id})`);
      }
    });
  }

  private showCardList(): void {
    this.cardListWindow.show(ALL_CARDS);
  }

  private skipToVictory(): void {
    this.onSkipToVictoryFn?.();
  }

  completeAllLevels(): { stars: number; unlocked: number } {
    for (let i = 1; i <= LEVELS.length; i++) {
      SaveManager.setStars(i, FULL_STARS);
    }
    SaveManager.unlockLevel(LEVELS.length);
    this.onLevelProgressChangedFn?.();
    this.debugPanel.flashButton('complete_all_levels', `✅ 已通关 ${LEVELS.length} 关 · 全部 3 星`);
    return { stars: FULL_STARS, unlocked: LEVELS.length };
  }

  addDebugGold(): boolean {
    const economy = this.getEconomy();
    if (!economy) return false;
    economy.addGold(GOLD_BONUS);
    this.debugPanel.flashButton('add_gold', `✅ 金币 +${GOLD_BONUS} 已发放`);
    return true;
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        e.preventDefault();
        this.debugPanel.toggle();
      } else if (e.key === 'Escape') {
        if (this.cardListWindow.getIsOpen()) {
          this.cardListWindow.hide();
        } else if (this.debugPanel.getIsExpanded()) {
          this.debugPanel.collapse();
        }
      }
    });
  }

  selectEntity(_entityId: EntityId | null): void {
    this.selectedEntityId = _entityId;
  }

  update(): void {
    this.debugPanel.refresh();
  }

  private getEntityDisplayName(entityId: EntityId): string {
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    if (unitTag) return unitTag.unitConfigId;
    const tower = this.world.getComponent<Tower>(entityId, CType.Tower);
    if (tower) return `Tower_${tower.towerType}`;
    const enemy = this.world.getComponent<Enemy>(entityId, CType.Enemy);
    if (enemy) return `Enemy_${enemy.enemyType}`;
    const unit = this.world.getComponent<Unit>(entityId, CType.Unit);
    if (unit) return `Unit_${unit.unitType}`;
    return '未知单位';
  }

  destroy(): void {
    this.debugPanel.destroy();
    this.cardListWindow.destroy();
  }
}
