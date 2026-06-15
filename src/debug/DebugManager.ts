import { DebugPanel, type DebugAction } from './DebugPanel.js';
import { CardListWindow } from './CardListWindow.js';
import { UnitAnimationPreviewWindow } from './UnitAnimationPreviewWindow.js';
import type { TowerWorld } from '../core/World.js';
import type { EntityId } from '../types/index.js';
import { CType } from '../types/index.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { Unit } from '../components/Unit.js';
import type { Tower } from '../components/Tower.js';
import type { Enemy } from '../components/Enemy.js';
import type { EconomySystem } from '../systems/EconomySystem.js';
import type { CardInstance, HandSystem } from '../systems/HandSystem.js';
import { ALL_CARDS } from '../data/cards.js';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';
import { setArtResourcesEnabled } from '../utils/artResourceSwitch.js';

export interface DebugManagerHooks {
  getEconomy?: () => EconomySystem | null;
  getHandSystem?: () => HandSystem | null;
  onLevelProgressChanged?: () => void;
  onOpenLevelEditor?: () => void;
  /** v6.0: 跳过当前关卡直接通关（测试胜利界面用） */
  onSkipToVictory?: () => void;
  /** v6.0: 跳过当前关卡直接失败（测试失败界面用） */
  onSkipToDefeat?: () => void;
  /** 调试：直接进入最后一波，用于测试 Boss 技能 */
  onSkipToFinalWave?: () => boolean;
}

const GOLD_BONUS = 99999;
const FULL_STARS = 3;

export class DebugManager {
  private world: TowerWorld;
  private debugPanel: DebugPanel;
  private cardListWindow: CardListWindow;
  private unitAnimationPreviewWindow: UnitAnimationPreviewWindow;

  private selectedEntityId: EntityId | null = null;

  /** 调试开关：是否显示关卡背景图（替代天气天空渐变）。默认开启。 */
  showBackgroundImage: boolean = true;
  /** 调试开关：是否启用图片美术资源。默认开启，关闭时回退程序化视觉。 */
  useArtResources: boolean = true;

  /** 调试卡牌试用替换的下一个手牌槽位，从左到右循环。 */
  private nextDebugCardReplaceIndex = 0;

  private getEconomyFn: (() => EconomySystem | null) | null = null;
  private getHandSystemFn: (() => HandSystem | null) | null = null;
  private onLevelProgressChangedFn: (() => void) | null = null;
  private onOpenLevelEditorFn: (() => void) | null = null;
  private onSkipToVictoryFn: (() => void) | null = null;
  private onSkipToDefeatFn: (() => void) | null = null;
  private onSkipToFinalWaveFn: (() => boolean) | null = null;

  constructor(world: TowerWorld, hooks: DebugManagerHooks = {}) {
    this.world = world;
    this.getEconomyFn = hooks.getEconomy ?? null;
    this.getHandSystemFn = hooks.getHandSystem ?? null;
    this.onLevelProgressChangedFn = hooks.onLevelProgressChanged ?? null;
    this.onOpenLevelEditorFn = hooks.onOpenLevelEditor ?? null;
    this.onSkipToVictoryFn = hooks.onSkipToVictory ?? null;
    this.onSkipToDefeatFn = hooks.onSkipToDefeat ?? null;
    this.onSkipToFinalWaveFn = hooks.onSkipToFinalWave ?? null;

    this.cardListWindow = new CardListWindow();
    this.unitAnimationPreviewWindow = new UnitAnimationPreviewWindow();
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

  toggleArtResources(): void {
    this.useArtResources = !this.useArtResources;
    setArtResourcesEnabled(this.useArtResources);
    this.debugPanel.flashButton(
      'toggle_art_resources',
      this.useArtResources ? '🎨 美术资源：开' : '🎨 美术资源：关',
      1500,
    );
  }

  isArtResourcesEnabled(): boolean {
    return this.useArtResources;
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
        id: 'toggle_art_resources',
        label: '美术资源切换',
        icon: '🎨',
        isEnabled: () => true,
        onClick: () => this.toggleArtResources(),
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
        id: 'show_unit_animation_preview',
        label: '单位动作预览',
        icon: '🎞️',
        isEnabled: () => true,
        onClick: () => this.showUnitAnimationPreview(),
      },
      {
        id: 'skip_to_final_wave',
        label: '直接进入最后一波',
        icon: '👑',
        isEnabled: () => this.onSkipToFinalWaveFn !== null && this.getEconomy() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.skipToFinalWave(),
      },
      {
        id: 'skip_to_victory',
        label: '🏁 直接通关（测试用）',
        icon: '🏁',
        isEnabled: () => this.getEconomy() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.skipToVictory(),
      },
      {
        id: 'skip_to_defeat',
        label: '💀 直接失败（测试用）',
        icon: '💀',
        isEnabled: () => this.getEconomy() !== null,
        disabledHint: '仅战斗中可用',
        onClick: () => this.skipToDefeat(),
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
      this.replaceNextHandCardForDebug(card);
    });
  }

  private showCardList(): void {
    this.nextDebugCardReplaceIndex = 0;
    this.cardListWindow.show(ALL_CARDS);
  }

  replaceNextHandCardForDebug(card: CardInstance): boolean {
    const handSystem = this.getHandSystem();
    if (!handSystem) {
      console.warn('[DebugManager] getHandSystem() returned null — not in battle?');
      return false;
    }

    handSystem.addCardsToLibrary([card]);

    const hand = handSystem.getHand();
    if (hand.length === 0) {
      console.warn(`[DebugManager] 手牌槽位为空，无法替换卡牌: ${card.name} (${card.id})`);
      return false;
    }

    const slotIndex = this.nextDebugCardReplaceIndex % hand.length;
    try {
      handSystem.replaceCard(slotIndex, card.id);
    } catch (error) {
      console.warn(`[DebugManager] 无法替换调试卡牌: ${card.name} (${card.id})`, error);
      return false;
    }

    this.nextDebugCardReplaceIndex = (slotIndex + 1) % hand.length;
    return true;
  }

  private showUnitAnimationPreview(): void {
    this.unitAnimationPreviewWindow.show();
  }

  private skipToVictory(): void {
    this.onSkipToVictoryFn?.();
  }

  private skipToDefeat(): void {
    this.onSkipToDefeatFn?.();
  }

  skipToFinalWave(): boolean {
    const ok = this.onSkipToFinalWaveFn?.() ?? false;
    if (ok) {
      this.debugPanel.flashButton('skip_to_final_wave', '✅ 已进入最后一波');
    }
    return ok;
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
        if (this.unitAnimationPreviewWindow.getIsOpen()) {
          this.unitAnimationPreviewWindow.hide();
        } else if (this.cardListWindow.getIsOpen()) {
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
    this.unitAnimationPreviewWindow.destroy();
  }
}
