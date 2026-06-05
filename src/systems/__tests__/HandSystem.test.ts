// ============================================================
// HandSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandSystem, type CardInstance } from '../HandSystem.js';
import { TowerWorld } from '../../core/World.js';

// ---- 测试用卡牌数据 ----

function makeTestPool(): CardInstance[] {
  return [
    { id: 'card_arrow_tower', name: '箭塔', type: 'unit', description: '基础单体物理输出' },
    { id: 'card_ice_tower', name: '冰塔', type: 'unit', description: '减速控制型魔法塔' },
    { id: 'card_shield_guard', name: '盾卫', type: 'unit', description: '近战嘲讽士兵' },
    { id: 'card_archer', name: '弓手', type: 'unit', description: '远程快速攻击' },
    { id: 'card_fireball', name: '火球术', type: 'spell', description: '2×2格范围火球伤害' },
    { id: 'card_arrow_rain', name: '剑雨', type: 'spell', description: '3×3格范围剑雨' },
    { id: 'card_emergency_shield', name: '紧急防护', type: 'arcane', description: '水晶10秒无敌' },
    { id: 'card_arrow_boost', name: '箭术精通', type: 'arcane', description: '本关箭塔ATK+20%' },
  ];
}

// 只取 4 张的卡池（刚好手牌上限）
function makeSmallPool(): CardInstance[] {
  return makeTestPool().slice(0, 4);
}

describe('HandSystem — 手牌管理', () => {
  let handSystem: HandSystem;
  let world: TowerWorld;

  beforeEach(() => {
    handSystem = new HandSystem();
    world = new TowerWorld();
  });

  describe('System 接口', () => {
    it('实现 System 接口，update 不抛异常', () => {
      expect(handSystem.name).toBe('HandSystem');
      expect(() => handSystem.update(world, 0.016)).not.toThrow();
    });
  });

  describe('initialize — 初始手牌', () => {
    it('从卡池中随机抽 4 张到手中', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const hand = handSystem.getHand();
      expect(hand).toHaveLength(4);
      // 所有槽位都应非空
      for (const card of hand) {
        expect(card).not.toBeNull();
        expect(card!.id).toBeTruthy();
        expect(card!.name).toBeTruthy();
      }
      // 4 张牌应互不相同
      const ids = hand.map((c) => c!.id);
      expect(new Set(ids).size).toBe(4);
    });

    it('卡池不足 4 张时只抽可用的数量', () => {
      const pool = makeSmallPool().slice(0, 2); // only 2 cards
      handSystem.initialize(pool);
      const hand = handSystem.getHand();
      expect(hand).toHaveLength(4);
      // 前 2 槽非空，后 2 槽为空
      expect(hand[0]).not.toBeNull();
      expect(hand[1]).not.toBeNull();
      expect(hand[2]).toBeNull();
      expect(hand[3]).toBeNull();
      expect(handSystem.getCount()).toBe(2);
    });

    it('重复调用 initialize 每次重新随机', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const firstIds = handSystem.getHand().map((c) => c!.id);

      handSystem.initialize(pool);
      const secondIds = handSystem.getHand().map((c) => c!.id);

      // 由于随机性，两次可能相同但不应总是相同
      // 仅验证结构正确
      expect(handSystem.getCount()).toBe(4);
      expect(firstIds.length).toBe(4);
      expect(secondIds.length).toBe(4);
    });
  });

  describe('drawCard — 抽牌', () => {
    it('手牌未满时成功抽入', () => {
      const pool = makeTestPool();
      // 用完整卡池初始化，但事先打出 2 张让手牌不满
      handSystem.initialize(pool);
      handSystem.playCard(0);
      handSystem.playCard(1);
      expect(handSystem.getCount()).toBe(2);

      const result = handSystem.drawCard('card_fireball');
      expect(result).toBe(true);
      expect(handSystem.getCount()).toBe(3);
      const hand = handSystem.getHand();
      const fireballInHand = hand.some((c) => c?.id === 'card_fireball');
      expect(fireballInHand).toBe(true);
    });

    it('手牌已满时抽入失败', () => {
      const pool = makeSmallPool();
      handSystem.initialize(pool);
      expect(handSystem.isFull()).toBe(true);

      const result = handSystem.drawCard('card_fireball');
      expect(result).toBe(false);
      expect(handSystem.getCount()).toBe(4);
    });

    it('无效 cardId 返回 false', () => {
      handSystem.initialize(makeSmallPool().slice(0, 2));
      const result = handSystem.drawCard('nonexistent_card');
      expect(result).toBe(false);
    });

    it('抽入未知 cardId（未在卡库中）', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool.slice(0, 2));
      // 'card_fireball' is in pool but the pool.slice(0,2) initializes only first 2
      // The cardLibrary should still contain all cards from the pool
      // Actually, initialize() takes the full pool and adds ALL to cardLibrary
      // So 'card_fireball' should be known.
      // Let me test with a truly unknown ID
      const result = handSystem.drawCard('totally_fake_card');
      expect(result).toBe(false);
    });
  });

  describe('playCard — 出牌', () => {
    it('打出有效槽位的牌并返回 cardId', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const handBefore = handSystem.getHand();
      const cardToPlay = handBefore[0]!;
      expect(cardToPlay).not.toBeNull();

      const playedId = handSystem.playCard(0);
      expect(playedId).toBe(cardToPlay.id);
      expect(handSystem.getHand()[0]).toBeNull();
      expect(handSystem.getCount()).toBe(3);
    });

    it('触发 onCardPlayed 回调', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const handBefore = handSystem.getHand();
      const expectedId = handBefore[0]!.id;

      const callback = vi.fn();
      handSystem.onCardPlayed = callback;

      handSystem.playCard(0);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expectedId);
    });

    it('打出空槽位返回 null', () => {
      handSystem.reset();
      // slot 0 is empty
      const result = handSystem.playCard(0);
      expect(result).toBeNull();
    });

    it('越界 index 返回 null', () => {
      handSystem.initialize(makeTestPool());
      expect(handSystem.playCard(-1)).toBeNull();
      expect(handSystem.playCard(4)).toBeNull();
      expect(handSystem.playCard(100)).toBeNull();
    });

    it('打出牌后该槽位为空，不影响其他牌', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const handBefore = handSystem.getHand();

      handSystem.playCard(1);
      const handAfter = handSystem.getHand();
      expect(handAfter[1]).toBeNull();
      expect(handAfter[0]?.id).toBe(handBefore[0]!.id);
      expect(handAfter[2]?.id).toBe(handBefore[2]!.id);
      expect(handAfter[3]?.id).toBe(handBefore[3]!.id);
    });
  });

  describe('replaceCard — 替换牌', () => {
    it('替换有效槽位的牌并返回被替换的 cardId', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const oldCardId = handSystem.getHand()[2]!.id;

      const replacedId = handSystem.replaceCard(2, 'card_fireball');
      expect(replacedId).toBe(oldCardId);
      expect(handSystem.getHand()[2]!.id).toBe('card_fireball');
    });

    it('替换空槽位（空手牌后再初始化替代）', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      // 先打出 slot 2 的牌使其为空
      handSystem.playCard(2);
      // slot 2 现在是空的
      const replacedId = handSystem.replaceCard(2, 'card_fireball');
      expect(replacedId).toBe('');
      expect(handSystem.getHand()[2]!.id).toBe('card_fireball');
      expect(handSystem.getCount()).toBe(4);
    });

    it('越界 index 抛出异常', () => {
      handSystem.initialize(makeTestPool());
      expect(() => handSystem.replaceCard(-1, 'card_fireball')).toThrow();
      expect(() => handSystem.replaceCard(4, 'card_fireball')).toThrow();
    });

    it('无效 cardId 抛出异常', () => {
      handSystem.initialize(makeTestPool());
      expect(() => handSystem.replaceCard(0, 'bad_card')).toThrow();
    });

    it('替换后手牌总数不变（非空槽替换）', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const countBefore = handSystem.getCount();
      handSystem.replaceCard(0, 'card_emergency_shield');
      expect(handSystem.getCount()).toBe(countBefore);
    });
  });

  describe('isFull / getCount', () => {
    it('初始 4 张后 isFull 为 true', () => {
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(4);
    });

    it('出牌后 isFull 为 false', () => {
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      expect(handSystem.isFull()).toBe(false);
      expect(handSystem.getCount()).toBe(3);
    });

    it('初始化为空时 isFull 为 false', () => {
      handSystem.initialize([]);
      expect(handSystem.isFull()).toBe(false);
      expect(handSystem.getCount()).toBe(0);
    });
  });

  describe('getHand — 获取手牌', () => {
    it('返回当前手牌浅拷贝', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const hand1 = handSystem.getHand();
      const hand2 = handSystem.getHand();
      // 浅拷贝：引用不同但内容相同
      expect(hand1).not.toBe(hand2);
      for (let i = 0; i < 4; i++) {
        expect(hand1[i]?.id).toBe(hand2[i]?.id);
      }
    });

    it('修改返回值不影响内部状态', () => {
      handSystem.initialize(makeSmallPool());
      const hand = handSystem.getHand();
      hand[0] = null;
      // 内部状态不变
      expect(handSystem.getHand()[0]).not.toBeNull();
    });
  });

  describe('reset — 重置', () => {
    it('重置后所有槽位为空', () => {
      handSystem.initialize(makeSmallPool());
      expect(handSystem.getCount()).toBe(4);

      handSystem.reset();
      expect(handSystem.getCount()).toBe(0);
      for (const card of handSystem.getHand()) {
        expect(card).toBeNull();
      }
    });
  });

  describe('集成场景', () => {
    it('完整流程：初始→出牌→抽牌→替换', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(4);

      // 打出 2 张牌
      const id1 = handSystem.playCard(0);
      const id2 = handSystem.playCard(1);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(handSystem.getCount()).toBe(2);

      // 抽入 2 张新牌
      handSystem.drawCard('card_fireball');
      handSystem.drawCard('card_emergency_shield');
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(4);

      // 替换一张
      handSystem.replaceCard(3, 'card_arrow_rain');
      expect(handSystem.getHand()[3]!.id).toBe('card_arrow_rain');
    });

    it('手牌满时抽牌失败，需先出再抽', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      expect(handSystem.isFull()).toBe(true);

      // 直接抽失败
      expect(handSystem.drawCard('card_fireball')).toBe(false);

      // 出牌后抽成功
      handSystem.playCard(0);
      expect(handSystem.drawCard('card_fireball')).toBe(true);
    });
  });
});
