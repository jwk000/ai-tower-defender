// ============================================================
// CardDraftSystem — 精英击杀后 3选1 抽卡（纯逻辑，无 UI 渲染）
//
// 职责：
//   - 精英被击杀时触发 3 选 1 抽卡
//   - 从关卡 draftPool 随机抽 3 张供玩家选择
//   - 手牌未满 → 直接加入手牌
//   - 手牌已满 → 玩家必须替换手牌中 1 张
//   - 发射 onDraftStart / onDraftComplete 回调
//
// 设计参考：design/02-gameplay.md §3.4 3选1抽卡
// ============================================================

import type { TowerWorld, System } from '../core/World.js';
import type { CardInstance } from './HandSystem.js';
import type { HandSystem } from './HandSystem.js';

// ---- 常量 ----

/** 每次抽卡展示的候选卡数 */
const DRAFT_OPTIONS_COUNT = 3;

// ---- CardDraftSystem ----

/**
 * 3 选 1 抽卡管理器。
 * 实现 System 接口以注册到管线，但本帧 update 不执行逻辑（纯方法驱动）。
 */
export class CardDraftSystem implements System {
  readonly name = 'CardDraftSystem';

  /** 当前抽卡是否活跃中 */
  private active: boolean = false;

  /** 当前 3 张候选卡牌 */
  private options: CardInstance[] = [];

  /** 关联的 HandSystem（用于加入/替换手牌） */
  private handSystem: HandSystem | null = null;

  /** 当前被选中的 option index（暂存，等待玩家选择替换目标） */
  private pendingOptionIndex: number = -1;

  /** 抽卡开始回调 */
  onDraftStart?: () => void;

  /** 抽卡完成回调 */
  onDraftComplete?: (selectedCard: string, replacedCard?: string) => void;

  // ============================================================
  // System interface
  // ============================================================

  update(_world: TowerWorld, _dt: number): void {
    // 本帧不执行逻辑，纯方法驱动
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * 启动 3 选 1 抽卡。
   * 从 draftPool 中随机选取 3 张候选卡牌。
   *
   * @param draftPool 可用卡池
   * @param handSystem 手牌管理器引用
   */
  startDraft(draftPool: CardInstance[], handSystem: HandSystem): void {
    if (draftPool.length === 0) {
      return;
    }

    this.handSystem = handSystem;
    this.active = true;
    this.pendingOptionIndex = -1;

    // 将 draft pool 中的卡牌注册到 HandSystem 的卡库中（以便后续抽牌/替换）
    handSystem.addCardsToLibrary(draftPool);

    // Fisher-Yates shuffle，取前 DRAFT_OPTIONS_COUNT 张
    const shuffled = [...draftPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    this.options = shuffled.slice(0, DRAFT_OPTIONS_COUNT);

    this.onDraftStart?.();
  }

  /**
   * 玩家选择候选卡牌中的一张。
   *
   * - 手牌未满：直接加入手牌，抽卡完成，返回 true。
   * - 手牌已满：暂存选项，返回 false（等待 replaceHandCard 调用）。
   *
   * @param index 候选卡牌索引 (0-2)
   * @returns true 若抽卡完成，false 若手牌已满需替换
   */
  selectOption(index: number): boolean {
    if (!this.active) return false;
    if (index < 0 || index >= this.options.length) return false;
    if (!this.handSystem) return false;

    const selected = this.options[index]!;

    // 手牌未满 → 直接加入
    if (!this.handSystem.isFull()) {
      this.handSystem.drawCard(selected.id);
      const completedCard = selected.id;
      this.reset();
      this.onDraftComplete?.(completedCard, undefined);
      return true;
    }

    // 手牌已满 → 暂存选项，等待 replaceHandCard
    this.pendingOptionIndex = index;
    return false;
  }

  /**
   * 手牌已满时，玩家选择替换手牌中哪个槽位。
   *
   * @param handIndex 手牌中要被替换的槽位 (0-3)
   * @returns true 若替换成功并完成抽卡
   */
  replaceHandCard(handIndex: number): boolean {
    if (!this.active) return false;
    if (this.pendingOptionIndex < 0) return false;
    if (!this.handSystem) return false;

    const selected = this.options[this.pendingOptionIndex];
    if (!selected) return false;

    const replacedCardId = this.handSystem.replaceCard(handIndex, selected.id);
    const completedCard = selected.id;
    const replacedCard = replacedCardId || undefined;
    this.reset();
    this.onDraftComplete?.(completedCard, replacedCard);
    return true;
  }

  /**
   * 获取当前 3 张候选卡牌。
   */
  getOptions(): CardInstance[] {
    return [...this.options];
  }

  /**
   * 抽卡是否进行中。
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * 取消当前抽卡（如玩家关闭面板）。
   */
  cancelDraft(): void {
    this.reset();
  }

  // ============================================================
  // Private
  // ============================================================

  private reset(): void {
    this.active = false;
    this.options = [];
    this.handSystem = null;
    this.pendingOptionIndex = -1;
  }
}
