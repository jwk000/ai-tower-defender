// ============================================================
// InterLevelBuffSystem — 关间 Buff 选择（纯逻辑，无 UI 渲染）
//
// 职责：
//   - 每关通关后（除第 5 关），从 Buff 池随机抽 2 个供玩家选择
//   - 玩家选 1 个带入下一关，Buff 效果在 Run 内持续
//   - 管理当前 Run 中所有已激活的 Buff 列表
//   - 发射 onSelectionStart / onSelectionComplete 回调
//
// 设计参考：design/04-levels.md §8 关间Buff选择
// ============================================================

import type { TowerWorld, System } from '../core/World.js';

// ---- 数据类型 ----

/**
 * Buff 选项（关间选择）。
 * effect 字段供其他系统读取后应用修改器（如 BuffSystem/AttackSystem）。
 */
export interface BuffOption {
  /** Buff 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 效果描述（展示用） */
  description: string;
  /** 稀有度 */
  rarity: 'common' | 'rare' | 'epic';
  /** 效果定义（其他系统据此应用修改器） */
  effect: {
    /** 效果类型（attack_speed / hp / atk / range / move_speed / gold / hand_size / draft_options 等） */
    type: string;
    /** 效果数值 */
    value: number;
    /** 目标类型（可选，如 'arrow_ballista' 限定箭塔+弩塔） */
    target?: string;
  };
}

// ---- 常量 ----

/** 每次关间选择展示的 Buff 数 */
const SELECTION_OPTIONS_COUNT = 2;

// ---- InterLevelBuffSystem ----

/**
 * 关间 Buff 选择管理器。
 * 实现 System 接口以注册到管线，但本帧 update 不执行逻辑（纯方法驱动）。
 */
export class InterLevelBuffSystem implements System {
  readonly name = 'InterLevelBuffSystem';

  /** 当前是否在 Buff 选择中 */
  private active: boolean = false;

  /** 当前 2 个候选 Buff */
  private options: BuffOption[] = [];

  /** 当前 Run 中所有已激活的 Buff */
  private activeBuffs: BuffOption[] = [];

  /** 预注入的 Buff 池（由 initialize 设置） */
  private buffPool: BuffOption[] = [];

  /** Buff 选择开始回调 */
  onSelectionStart?: () => void;

  /** Buff 选择完成回调 */
  onSelectionComplete?: (selected: BuffOption) => void;

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
   * 初始化 Buff 池（在关间选择开始前注入）。
   * 设置后可通过 startSelection() 无参调用来启动选择。
   *
   * @param buffPool 可用 Buff 池
   */
  initialize(buffPool: BuffOption[]): void {
    this.buffPool = [...buffPool];
  }

  /**
   * 启动关间 Buff 选择。
   * 从 buffPool 中随机选取 SELECTION_OPTIONS_COUNT 个候选 Buff。
   *
   * @param buffPool 可用 Buff 池
   */
  startSelection(buffPool: BuffOption[]): void {
    const pool = buffPool.length > 0 ? buffPool : this.buffPool;
    if (pool.length === 0) {
      return;
    }

    this.active = true;

    // Fisher-Yates shuffle，取前 SELECTION_OPTIONS_COUNT 个
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const count = Math.min(SELECTION_OPTIONS_COUNT, shuffled.length);
    this.options = shuffled.slice(0, count);

    this.onSelectionStart?.();
  }

  /**
   * 玩家选择一个 Buff。
   * Buff 被加入 activeBuffs 列表，选择结束。
   *
   * @param index 候选 Buff 索引 (0-1)
   * @returns 被选中的 BuffOption，若选择无效则抛出异常
   * @throws 若 index 越界或选择未激活
   */
  selectBuff(index: number): BuffOption {
    if (!this.active) {
      throw new Error('selectBuff: no active buff selection');
    }
    if (index < 0 || index >= this.options.length) {
      throw new Error(`selectBuff: index ${index} out of range [0, ${this.options.length - 1}]`);
    }

    const selected = this.options[index]!;
    this.activeBuffs.push(selected);
    this.options = [];
    this.active = false;

    this.onSelectionComplete?.(selected);
    return selected;
  }

  /**
   * 获取当前候选 Buff 列表（浅拷贝）。
   */
  getOptions(): BuffOption[] {
    return [...this.options];
  }

  /**
   * 获取当前 Run 中所有已激活的 Buff。
   */
  getActiveBuffs(): BuffOption[] {
    return [...this.activeBuffs];
  }

  /**
   * 是否正在选择中。
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * 取消当前选择（如玩家关闭面板）。
   */
  cancelSelection(): void {
    this.active = false;
    this.options = [];
  }

  /**
   * 清除当前 Run 所有已激活的 Buff（新 Run 开始时调用）。
   */
  clearAllBuffs(): void {
    this.activeBuffs = [];
  }

  /**
   * 移除指定的 Buff（用于叠加上限处理等场景）。
   */
  removeBuff(buffId: string): boolean {
    const idx = this.activeBuffs.findIndex((b) => b.id === buffId);
    if (idx === -1) return false;
    this.activeBuffs.splice(idx, 1);
    return true;
  }
}
