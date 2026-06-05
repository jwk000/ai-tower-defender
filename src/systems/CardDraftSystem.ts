// ============================================================
// CardDraftSystem — 精英击杀后 3选3 抽卡（纯逻辑，无 UI 渲染）
//
// 职责：
//   - 精英被击杀时触发抽卡
//   - 从关卡 draftPool 随机抽 3 张供玩家预览
//   - 玩家可点击"确定"将 3 张全部加入手牌
//   - 玩家可点击"骰子"重新随机 3 张
//   - 发射 onDraftStart / onDraftComplete 回调
//
// 设计参考：design/02-gameplay.md §3.4 抽卡
// ============================================================

import type { TowerWorld, System } from '../core/World.js';
import type { CardInstance } from './HandSystem.js';
import type { HandSystem } from './HandSystem.js';

// ---- 常量 ----

/** 每次抽卡展示的候选卡数 */
const DRAFT_OPTIONS_COUNT = 3;

// ---- CardDraftSystem ----

/**
 * 抽卡管理器（3张全部进入手牌模式）。
 * 实现 System 接口以注册到管线，但本帧 update 不执行逻辑（纯方法驱动）。
 */
export class CardDraftSystem implements System {
  readonly name = 'CardDraftSystem';

  /** 当前抽卡是否活跃中 */
  private active: boolean = false;

  /** 当前 3 张候选卡牌 */
  private options: CardInstance[] = [];

  /** 关联的 HandSystem（用于加入手牌） */
  private handSystem: HandSystem | null = null;

  /** 抽卡池引用（用于骰子重抽） */
  private draftPool: CardInstance[] = [];

  /** 抽卡开始回调 */
  onDraftStart?: () => void;

  /** 抽卡完成回调 — addedCardIds 为实际加入手牌的卡牌 ID 列表 */
  onDraftComplete?: (addedCardIds: string[]) => void;

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
   * 启动抽卡。
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
    this.draftPool = [...draftPool];

    // 将 draft pool 中的卡牌注册到 HandSystem 的卡库中（以便后续抽牌）
    handSystem.addCardsToLibrary(draftPool);

    // Fisher-Yates shuffle，取前 DRAFT_OPTIONS_COUNT 张
    this.options = this.pickRandom(draftPool);

    this.onDraftStart?.();
  }

  /**
   * 确认抽卡：将当前 3 张候选卡牌全部加入手牌。
   * 能放几张放几张（若手牌空位不足，剩余的忽略）。
   *
   * @returns 实际加入手牌的卡牌数量
   */
  confirmDraft(): number {
    if (!this.active) return 0;
    if (!this.handSystem) return 0;

    const addedIds: string[] = [];

    for (const card of this.options) {
      if (!this.handSystem.isFull()) {
        const success = this.handSystem.drawCard(card.id);
        if (success) {
          addedIds.push(card.id);
        }
      }
    }

    this.reset();
    this.onDraftComplete?.(addedIds);
    return addedIds.length;
  }

  /**
   * 骰子重抽：从 draftPool 中重新随机抽取 3 张卡牌替换当前候选。
   */
  reroll(): void {
    if (!this.active) return;
    if (this.draftPool.length === 0) return;

    this.options = this.pickRandom(this.draftPool);
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

  /**
   * 从卡池中随机选取指定数量的卡牌（Fisher-Yates shuffle）。
   */
  private pickRandom(pool: CardInstance[]): CardInstance[] {
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const count = Math.min(DRAFT_OPTIONS_COUNT, shuffled.length);
    return shuffled.slice(0, count);
  }

  private reset(): void {
    this.active = false;
    this.options = [];
    this.handSystem = null;
    this.draftPool = [];
  }
}
