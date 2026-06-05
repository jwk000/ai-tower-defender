// ============================================================
// CardDraftSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CardDraftSystem } from '../CardDraftSystem.js';
import { HandSystem, type CardInstance } from '../HandSystem.js';
import { TowerWorld } from '../../core/World.js';

// ---- 测试用卡牌数据 ----

function makeDraftPool(): CardInstance[] {
  return [
    { id: 'card_arrow_tower', name: '箭塔', type: 'unit', description: '基础单体物理输出' },
    { id: 'card_ice_tower', name: '冰塔', type: 'unit', description: '减速控制型魔法塔' },
    { id: 'card_cannon_tower', name: '炮塔', type: 'unit', description: 'AOE物理范围伤害' },
    { id: 'card_fire_tower', name: '火塔', type: 'unit', description: '灼烧DOT魔法塔' },
    { id: 'card_laser_tower', name: '激光塔', type: 'unit', description: '持续锁敌魔法伤害' },
    { id: 'card_shield_guard', name: '盾卫', type: 'unit', description: '近战嘲讽士兵' },
    { id: 'card_archer', name: '弓手', type: 'unit', description: '远程快速攻击' },
    { id: 'card_mage', name: '法师', type: 'unit', description: '远程AOE魔法' },
    { id: 'card_fireball', name: '火球术', type: 'spell', description: '2×2格范围火球伤害' },
    { id: 'card_arrow_rain', name: '剑雨', type: 'spell', description: '3×3格范围剑雨' },
    { id: 'card_blizzard', name: '暴风雪', type: 'spell', description: '减速AOE区域' },
    { id: 'card_bomb', name: '炸弹', type: 'spell', description: '2秒延时爆炸' },
    { id: 'card_emergency_shield', name: '紧急防护', type: 'arcane', description: '水晶10秒无敌' },
    { id: 'card_arrow_boost', name: '箭术精通', type: 'arcane', description: '本关箭塔ATK+20%' },
    { id: 'card_gold_rush', name: '淘金热', type: 'arcane', description: '立即获得80金币' },
  ];
}

/** 4 张卡的小池（刚好填满手牌） */
function makeSmallPool(): CardInstance[] {
  return makeDraftPool().slice(0, 4);
}

describe('CardDraftSystem — 3张全抽（确认+骰子模式）', () => {
  let draftSystem: CardDraftSystem;
  let handSystem: HandSystem;
  let world: TowerWorld;

  beforeEach(() => {
    draftSystem = new CardDraftSystem();
    handSystem = new HandSystem();
    world = new TowerWorld();
  });

  describe('System 接口', () => {
    it('实现 System 接口，update 不抛异常', () => {
      expect(draftSystem.name).toBe('CardDraftSystem');
      expect(() => draftSystem.update(world, 0.016)).not.toThrow();
    });
  });

  describe('startDraft — 启动抽卡', () => {
    it('从卡池中随机选 3 张候选卡', () => {
      const draftPool = makeDraftPool();
      draftSystem.startDraft(draftPool, handSystem);

      expect(draftSystem.isActive()).toBe(true);
      const options = draftSystem.getOptions();
      expect(options).toHaveLength(3);
      // 3 张卡应互不相同
      const ids = options.map((c) => c.id);
      expect(new Set(ids).size).toBe(3);
      // 所有卡都来自卡池
      const poolIds = new Set(draftPool.map((c) => c.id));
      for (const id of ids) {
        expect(poolIds.has(id)).toBe(true);
      }
    });

    it('空卡池不启动抽卡', () => {
      draftSystem.startDraft([], handSystem);
      expect(draftSystem.isActive()).toBe(false);
      expect(draftSystem.getOptions()).toHaveLength(0);
    });

    it('触发 onDraftStart 回调', () => {
      const callback = vi.fn();
      draftSystem.onDraftStart = callback;

      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('卡池不足 3 张时只选可用的数量', () => {
      const tinyPool = makeDraftPool().slice(0, 2);
      draftSystem.startDraft(tinyPool, handSystem);

      expect(draftSystem.isActive()).toBe(true);
      expect(draftSystem.getOptions()).toHaveLength(2);
    });
  });

  describe('confirmDraft — 确定抽取（全部加入手牌）', () => {
    it('手牌有空位时全部加入并完成抽卡', () => {
      // 手牌只有 1 张（3 个空位）
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      handSystem.playCard(2);
      expect(handSystem.getCount()).toBe(1);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);

      const options = draftSystem.getOptions();
      const addedCount = draftSystem.confirmDraft();

      expect(addedCount).toBe(3);
      expect(draftSystem.isActive()).toBe(false);
      expect(handSystem.isFull()).toBe(true);
      // 3 张候选卡都在手牌中
      const handIds = handSystem.getHand().filter((c) => c !== null).map((c) => c!.id);
      for (const opt of options) {
        expect(handIds).toContain(opt.id);
      }
    });

    it('手牌空位不足时只放入能放的数量', () => {
      // 手牌有 2 张，只剩 2 个空位
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      expect(handSystem.getCount()).toBe(2);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const addedCount = draftSystem.confirmDraft();

      expect(addedCount).toBe(2);
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(4);
    });

    it('手牌满时什么也不加入，仍完成抽卡', () => {
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const addedCount = draftSystem.confirmDraft();

      expect(addedCount).toBe(0);
      expect(draftSystem.isActive()).toBe(false);
      expect(handSystem.getCount()).toBe(4);
    });

    it('抽卡未激活时返回 0', () => {
      expect(draftSystem.confirmDraft()).toBe(0);
    });

    it('触发 onDraftComplete 回调（含实际加入的卡牌 ID 列表）', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      // 手牌有空位
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      handSystem.playCard(2);
      expect(handSystem.getCount()).toBe(1);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const options = draftSystem.getOptions();
      draftSystem.confirmDraft();

      expect(callback).toHaveBeenCalledTimes(1);
      const addedIds = callback.mock.calls[0]![0] as string[];
      expect(addedIds).toHaveLength(3);
      // 确认回调中的 ID 与候选卡一致
      const optionIds = options.map((o) => o.id);
      for (const id of addedIds) {
        expect(optionIds).toContain(id);
      }
    });

    it('手牌满时 onDraftComplete 收到空数组', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.confirmDraft();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe('reroll — 骰子重抽', () => {
    it('重新随机后候选卡发生变化（大概率）', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      const firstOptions = draftSystem.getOptions();
      const firstIds = firstOptions.map((c) => c.id);

      // 多次 reroll 确保至少有一次不同（概率极低会完全相同）
      let changed = false;
      for (let i = 0; i < 5; i++) {
        draftSystem.reroll();
        const newIds = draftSystem.getOptions().map((c) => c.id);
        if (newIds.join(',') !== firstIds.join(',')) {
          changed = true;
          break;
        }
      }
      expect(changed).toBe(true);
    });

    it('reroll 后的卡仍来自原卡池', () => {
      const draftPool = makeDraftPool();
      draftSystem.startDraft(draftPool, handSystem);
      draftSystem.reroll();

      const poolIds = new Set(draftPool.map((c) => c.id));
      for (const opt of draftSystem.getOptions()) {
        expect(poolIds.has(opt.id)).toBe(true);
      }
    });

    it('reroll 不改变抽卡激活状态', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);
      draftSystem.reroll();
      expect(draftSystem.isActive()).toBe(true);
    });

    it('抽卡未激活时 reroll 无效', () => {
      // 不应抛异常
      expect(() => draftSystem.reroll()).not.toThrow();
      expect(draftSystem.getOptions()).toEqual([]);
    });

    it('reroll 后仍有 3 张候选卡', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.reroll();
      expect(draftSystem.getOptions()).toHaveLength(3);
    });
  });

  describe('isActive — 抽卡状态', () => {
    it('启动抽卡后为 true', () => {
      expect(draftSystem.isActive()).toBe(false);
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);
    });

    it('确认后为 false', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.confirmDraft();
      expect(draftSystem.isActive()).toBe(false);
    });

    it('取消抽卡后为 false', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.cancelDraft();
      expect(draftSystem.isActive()).toBe(false);
    });
  });

  describe('getOptions — 获取候选卡', () => {
    it('抽卡前返回空数组', () => {
      expect(draftSystem.getOptions()).toEqual([]);
    });

    it('返回的内容与内部独立（浅拷贝）', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      const opts1 = draftSystem.getOptions();
      const opts2 = draftSystem.getOptions();
      expect(opts1).not.toBe(opts2);
      expect(opts1.map((c) => c.id)).toEqual(opts2.map((c) => c.id));
    });
  });

  describe('cancelDraft — 取消抽卡', () => {
    it('取消后清空所有状态', () => {
      handSystem.initialize(makeSmallPool());
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);

      draftSystem.cancelDraft();
      expect(draftSystem.isActive()).toBe(false);
      expect(draftSystem.getOptions()).toEqual([]);
    });

    it('取消后 confirmDraft 返回 0', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.cancelDraft();
      expect(draftSystem.confirmDraft()).toBe(0);
    });
  });

  describe('集成场景', () => {
    it('完整流程：抽卡 → 骰子重抽 → 确定全部放入', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      // 手牌只初始化 1 张（有 3 个空位）
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      handSystem.playCard(2);
      expect(handSystem.getCount()).toBe(1);

      // 触发抽卡
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);
      expect(draftSystem.getOptions()).toHaveLength(3);

      // 骰子重抽
      draftSystem.reroll();
      const finalOptions = draftSystem.getOptions();
      expect(finalOptions).toHaveLength(3);

      // 确定全部放入
      const addedCount = draftSystem.confirmDraft();
      expect(addedCount).toBe(3);
      expect(draftSystem.isActive()).toBe(false);

      // 手牌满了
      expect(handSystem.isFull()).toBe(true);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('完整流程：抽卡 → 确定（手牌满时什么也不加）', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      // 手牌满
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const addedCount = draftSystem.confirmDraft();

      expect(addedCount).toBe(0);
      expect(callback).toHaveBeenCalledWith([]);
    });

    it('连续两次抽卡', () => {
      // 清空手牌
      handSystem.reset();
      expect(handSystem.getCount()).toBe(0);

      // 第一次抽卡
      draftSystem.startDraft(makeDraftPool(), handSystem);
      const added1 = draftSystem.confirmDraft();
      expect(added1).toBe(3);
      expect(handSystem.getCount()).toBe(3);

      // 第二次抽卡（只剩 1 个空位）
      draftSystem.startDraft(makeDraftPool(), handSystem);
      const added2 = draftSystem.confirmDraft();
      expect(added2).toBe(1);
      expect(handSystem.isFull()).toBe(true);
    });
  });
});
