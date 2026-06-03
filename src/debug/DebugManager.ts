import { DebugPanel, type DebugAction } from './DebugPanel.js';
import { BehaviorTreeWindow } from './BehaviorTreeWindow.js';
import { CardListWindow } from './CardListWindow.js';
import type { BehaviorTreeDebugState, BTNodeDebugInfo } from './types.js';
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
}

const GOLD_BONUS = 99999;
const FULL_STARS = 3;

export class DebugManager {
  private world: TowerWorld;
  private debugPanel: DebugPanel;
  private behaviorTreeWindow: BehaviorTreeWindow;
  private cardListWindow: CardListWindow;

  private selectedEntityId: EntityId | null = null;

  private getEconomyFn: (() => EconomySystem | null) | null = null;
  private getHandSystemFn: (() => HandSystem | null) | null = null;
  private onLevelProgressChangedFn: (() => void) | null = null;
  private onOpenLevelEditorFn: (() => void) | null = null;

  constructor(world: TowerWorld, hooks: DebugManagerHooks = {}) {
    this.world = world;
    this.getEconomyFn = hooks.getEconomy ?? null;
    this.getHandSystemFn = hooks.getHandSystem ?? null;
    this.onLevelProgressChangedFn = hooks.onLevelProgressChanged ?? null;
    this.onOpenLevelEditorFn = hooks.onOpenLevelEditor ?? null;

    this.behaviorTreeWindow = new BehaviorTreeWindow();
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

  /** Phase 0: 行为树已移除，此方法保留为空兼容层 */
  registerAIConfigs(_configs: unknown[]): void {}

  private buildActions(): DebugAction[] {
    const actions: DebugAction[] = [
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
        id: 'view_behavior_tree',
        label: '查看行为树',
        icon: '🌳',
        isEnabled: () => true,
        onClick: () => this.openBehaviorTreeWindow(),
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

  private openBehaviorTreeWindow(): void {
    const state = this.buildCurrentBehaviorTreeState();
    this.behaviorTreeWindow.show(state);
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.key === '`') {
        e.preventDefault();
        this.debugPanel.toggle();
      } else if (e.key === 'Escape') {
        if (this.cardListWindow.getIsOpen()) {
          this.cardListWindow.hide();
        } else if (this.behaviorTreeWindow.getIsOpen()) {
          this.behaviorTreeWindow.hide();
        } else if (this.debugPanel.getIsExpanded()) {
          this.debugPanel.collapse();
        }
      }
    });
  }

  selectEntity(entityId: EntityId | null): void {
    this.selectedEntityId = entityId;
    if (this.behaviorTreeWindow.getIsOpen()) {
      this.behaviorTreeWindow.updateState(this.buildCurrentBehaviorTreeState());
    }
  }

  update(): void {
    this.debugPanel.refresh();
    if (this.selectedEntityId !== null && this.behaviorTreeWindow.getIsOpen()) {
      this.behaviorTreeWindow.updateState(this.buildCurrentBehaviorTreeState());
    }
  }

  private buildCurrentBehaviorTreeState(): BehaviorTreeDebugState | null {
    // Phase 0: AI/行为树系统已移除，返回 null
    return null;
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
    this.behaviorTreeWindow.destroy();
    this.cardListWindow.destroy();
  }
}
