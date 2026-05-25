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

describe('CardDraftSystem — 3选1抽卡', () => {
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

  describe('selectOption — 选择候选卡', () => {
    it('手牌未满时直接加入手牌并完成抽卡', () => {
      // 手牌只有 2 张（不满）
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      expect(handSystem.getCount()).toBe(2);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);

      const options = draftSystem.getOptions();
      const selectedId = options[0]!.id;

      const result = draftSystem.selectOption(0);
      expect(result).toBe(true);
      expect(draftSystem.isActive()).toBe(false);
      expect(handSystem.getCount()).toBe(3);
      // 选中的卡在手牌中
      const handIds = handSystem.getHand().filter((c) => c !== null).map((c) => c!.id);
      expect(handIds).toContain(selectedId);
    });

    it('手牌已满时返回 false，等待替换', () => {
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const result = draftSystem.selectOption(0);
      expect(result).toBe(false);
      // 抽卡仍活跃
      expect(draftSystem.isActive()).toBe(true);
      // 手牌未变化
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(4);
    });

    it('越界 index 返回 false', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.selectOption(-1)).toBe(false);
      expect(draftSystem.selectOption(3)).toBe(false);
      expect(draftSystem.selectOption(100)).toBe(false);
    });

    it('抽卡未激活时返回 false', () => {
      expect(draftSystem.selectOption(0)).toBe(false);
    });

    it('抽卡完成时触发 onDraftComplete（无替换情况）', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      // 手牌不满
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const options = draftSystem.getOptions();
      draftSystem.selectOption(0);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(options[0]!.id, undefined);
    });
  });

  describe('replaceHandCard — 手牌满时替换', () => {
    it('替换指定槽位后完成抽卡', () => {
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const options = draftSystem.getOptions();
      const selectedId = options[0]!.id;

      // 第一步：选卡 → 返回 false（手牌满）
      const selectResult = draftSystem.selectOption(0);
      expect(selectResult).toBe(false);

      // 第二步：选替换哪个手牌槽位
      const oldHand = handSystem.getHand();
      const replacedCardId = oldHand[2]!.id;

      const replaceResult = draftSystem.replaceHandCard(2);
      expect(replaceResult).toBe(true);
      // 抽卡完成
      expect(draftSystem.isActive()).toBe(false);
      // 手牌槽位 2 现在是新卡
      expect(handSystem.getHand()[2]!.id).toBe(selectedId);
      // 手牌总数不变
      expect(handSystem.getCount()).toBe(4);
    });

    it('触发 onDraftComplete 含被替换卡牌信息', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      handSystem.initialize(makeSmallPool());
      const oldHand = handSystem.getHand();
      const replacedId = oldHand[1]!.id;

      draftSystem.startDraft(makeDraftPool(), handSystem);
      const options = draftSystem.getOptions();
      draftSystem.selectOption(0);
      draftSystem.replaceHandCard(1);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(options[0]!.id, replacedId);
    });

    it('无 pending option 时返回 false', () => {
      handSystem.initialize(makeSmallPool());
      draftSystem.startDraft(makeDraftPool(), handSystem);
      // 未先调用 selectOption
      expect(draftSystem.replaceHandCard(0)).toBe(false);
    });

    it('抽卡未激活时返回 false', () => {
      expect(draftSystem.replaceHandCard(0)).toBe(false);
    });
  });

  describe('isActive — 抽卡状态', () => {
    it('启动抽卡后为 true', () => {
      expect(draftSystem.isActive()).toBe(false);
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);
    });

    it('完成抽卡后为 false', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.selectOption(0);
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

    it('取消后 selectOption 返回 false', () => {
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.cancelDraft();
      expect(draftSystem.selectOption(0)).toBe(false);
    });
  });

  describe('集成场景', () => {
    it('完整 3 选 1 流程（手牌不满）', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      // 手牌只初始化 2 张
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      expect(handSystem.getCount()).toBe(2);

      // 触发抽卡
      draftSystem.startDraft(makeDraftPool(), handSystem);
      expect(draftSystem.isActive()).toBe(true);
      expect(draftSystem.getOptions()).toHaveLength(3);

      // 选第 2 张
      const options = draftSystem.getOptions();
      const result = draftSystem.selectOption(1);
      expect(result).toBe(true);
      expect(draftSystem.isActive()).toBe(false);

      // 回调含正确的 cardId
      expect(callback).toHaveBeenCalledWith(options[1]!.id, undefined);
      // 手牌有 3 张
      expect(handSystem.getCount()).toBe(3);
    });

    it('完整 3 选 1 流程（手牌满，需替换）', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      // 手牌满
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);

      // 触发抽卡
      draftSystem.startDraft(makeDraftPool(), handSystem);
      const options = draftSystem.getOptions();

      // 选择失败 → 手牌满
      const selectResult = draftSystem.selectOption(2);
      expect(selectResult).toBe(false);

      // 替换槽位 0
      const oldSlot0Id = handSystem.getHand()[0]!.id;
      const replaceResult = draftSystem.replaceHandCard(0);
      expect(replaceResult).toBe(true);
      expect(draftSystem.isActive()).toBe(false);

      // 回调含被替换的卡牌
      expect(callback).toHaveBeenCalledWith(options[2]!.id, oldSlot0Id);
      expect(handSystem.getCount()).toBe(4);
    });

    it('连续两次抽卡', () => {
      const callback = vi.fn();
      draftSystem.onDraftComplete = callback;

      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      handSystem.playCard(1);
      expect(handSystem.getCount()).toBe(2);

      // 第一次抽卡
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.selectOption(0);
      expect(callback).toHaveBeenCalledTimes(1);

      // 此时手牌有 3 张
      expect(handSystem.getCount()).toBe(3);

      // 第二次抽卡（手牌仍不满）
      draftSystem.startDraft(makeDraftPool(), handSystem);
      draftSystem.selectOption(0);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(handSystem.isFull()).toBe(true);
    });
  });
});
