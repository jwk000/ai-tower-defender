// ============================================================
// HandSystem — 手牌管理（纯逻辑，无 UI 渲染）
//
// 职责：
//   - 管理玩家手牌（v5.0: 上限 5 张，出牌自动补满）
//   - 提供抽牌 / 出牌 / 替换牌操作
//   - 发射 onCardPlayed 回调供 UISystem 消费
//
// 设计参考：design/02-gameplay.md §3.2 手牌区
// ============================================================

import type { TowerWorld, System } from '../core/World.js';

// ---- 数据类型 ----

/** 卡牌实例（手牌中的具体卡牌） */
export interface CardInstance {
  /** 卡牌配置 ID */
  id: string;
  /** 显示名称 */
  name: string;
  /** 卡牌类型 */
  type: 'unit' | 'spell' | 'arcane' | 'trap' | 'production';
  /** 一句话机制描述 */
  description: string;
  /** v5.0 出牌消耗金币 */
  goldCost: number;
}

// ---- 常量 ----

/** v5.0 手牌上限（固定 5 张，出牌后自动补满） */
const MAX_HAND_SIZE = 5;

// ---- HandSystem ----

/**
 * 手牌管理器。
 * 实现 System 接口以注册到管线，但本帧 update 不执行逻辑（纯方法驱动）。
 */
export class HandSystem implements System {
  readonly name = 'HandSystem';

  /** 手牌槽位（v5.0: 固定长度 5，null = 空槽） */
  private hand: (CardInstance | null)[] = Array.from({ length: MAX_HAND_SIZE }, () => null);

  /** 卡牌库（cardId → CardInstance），由 initialize 注入 */
  private cardLibrary: Map<string, CardInstance> = new Map();

  /** 出牌回调 */
  onCardPlayed?: (cardId: string) => void;

  /** 卡牌添加到库回调（用于同步更新 runContext.registry） */
  onCardAddedToLibrary?: (cards: CardInstance[]) => void;

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
   * 初始化手牌：注入卡牌库并从池中随机抽满手牌（v5.0: 5张）。
   * 若池不足 5 张，有多少抽多少。
   *
   * 保证第一张手牌为箭塔卡（card_arrow_tower），降低第一波难度。
   */
  initialize(cardPool: CardInstance[]): void {
    this.cardLibrary.clear();
    for (const card of cardPool) {
      this.cardLibrary.set(card.id, card);
    }

    // 重置手牌
    this.hand = Array.from({ length: MAX_HAND_SIZE }, () => null);

    // Fisher-Yates shuffle，取前 MAX_HAND_SIZE 张
    const shuffled = [...cardPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    // 保证箭塔卡在初始手牌中：若池中有箭塔卡，将其放到第一位
    const arrowIdx = shuffled.findIndex((c) => c.id === 'card_arrow_tower');
    if (arrowIdx > 0) {
      [shuffled[0], shuffled[arrowIdx]] = [shuffled[arrowIdx]!, shuffled[0]!];
    }

    const drawCount = Math.min(MAX_HAND_SIZE, shuffled.length);
    for (let i = 0; i < drawCount; i++) {
      this.hand[i] = shuffled[i]!;
    }
  }

  /**
   * 向手牌中添加一张牌。
   * @returns true 若添加成功，false 若手牌已满或 cardId 无效
   */
  drawCard(cardId: string): boolean {
    if (this.isFull()) return false;
    const card = this.cardLibrary.get(cardId);
    if (!card) return false;

    const slot = this.hand.findIndex((s) => s === null);
    if (slot === -1) return false;
    this.hand[slot] = card;
    return true;
  }

  /**
   * @deprecated v5.0 不再需要外部手动抽牌 — playCard 已内置自动补牌。
   * 从卡牌库中随机抽一张牌补充手牌。
   * @returns true 若抽牌成功，false 若手牌已满或卡牌库为空
   */
  drawRandomCard(): boolean {
    if (this.isFull()) return false;
    if (this.cardLibrary.size === 0) return false;

    const slot = this.hand.findIndex((s) => s === null);
    if (slot === -1) return false;

    // 从卡牌库中随机选择一张
    const cards = Array.from(this.cardLibrary.values());
    const randomIndex = Math.floor(Math.random() * cards.length);
    const card = cards[randomIndex];
    if (!card) return false;

    this.hand[slot] = card;
    return true;
  }

  /**
   * 打出手牌中指定位置的牌，将其从手牌中移除并自动补牌。
   * v5.0: 出牌后自动从牌库随机抽一张牌补满手牌。
   * 触发 onCardPlayed 回调。
   * @returns 被打出卡牌的 cardId，若该位置为空则返回 null
   */
  playCard(index: number): string | null {
    console.log('[HandSystem] playCard called with index:', index, 'hand:', this.hand);
    if (index < 0 || index >= MAX_HAND_SIZE) {
      console.log('[HandSystem] playCard: invalid index');
      return null;
    }
    const card = this.hand[index];
    if (!card) {
      console.log('[HandSystem] playCard: no card at index', index);
      return null;
    }

    const cardId = card.id;
    console.log('[HandSystem] playCard: removing card', cardId, 'at index', index);
    this.hand[index] = null;
    this.onCardPlayed?.(cardId);

    // v5.0: 出牌后自动补牌
    this.drawRandomCard();

    return cardId;
  }

  /**
   * 用手牌中指定位置替换为一张新牌。
   * @returns 被替换掉卡牌的 cardId
   * @throws 若 cardId 无效或 index 越界
   */
  replaceCard(index: number, newCardId: string): string {
    if (index < 0 || index >= MAX_HAND_SIZE) {
      throw new Error(`replaceCard: index ${index} out of range [0, ${MAX_HAND_SIZE - 1}]`);
    }
    const newCard = this.cardLibrary.get(newCardId);
    if (!newCard) {
      throw new Error(`replaceCard: unknown cardId "${newCardId}"`);
    }
    const oldCard = this.hand[index];
    if (!oldCard) {
      // 该槽位为空，直接放入新牌
      this.hand[index] = newCard;
      return '';
    }
    this.hand[index] = newCard;
    return oldCard.id;
  }

  /**
   * 手牌是否已满（无空槽位）。
   */
  isFull(): boolean {
    return this.hand.every((s) => s !== null);
  }

  /**
   * 获取当前手牌内容（浅拷贝）。
   * null 表示该槽位为空。
   */
  getHand(): (CardInstance | null)[] {
    return [...this.hand];
  }

  /**
   * 获取手牌中的卡牌数量。
   */
  getCount(): number {
    return this.hand.filter((s) => s !== null).length;
  }

  /**
   * 向卡牌库中注册一批卡牌（用于 draft 池扩库）。
   */
  addCardsToLibrary(cards: CardInstance[]): void {
    const added: CardInstance[] = [];
    for (const card of cards) {
      if (!this.cardLibrary.has(card.id)) {
        this.cardLibrary.set(card.id, card);
        added.push(card);
      }
    }
    if (added.length > 0) {
      this.onCardAddedToLibrary?.(added);
    }
  }

  /**
   * 重置手牌（清空所有卡牌）。
   */
  reset(): void {
    this.hand = Array.from({ length: MAX_HAND_SIZE }, () => null);
  }
}
