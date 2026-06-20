// ============================================================
// HandSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandSystem, type CardInstance } from '../HandSystem.js';
import { TowerWorld } from '../../core/World.js';

// ---- 测试用卡牌数据 ----

function makeTestPool(): CardInstance[] {
  return [
    { id: 'card_arrow_tower', name: '箭塔', type: 'unit', description: '基础单体物理输出', goldCost: 0 },
    { id: 'card_ice_tower', name: '冰塔', type: 'unit', description: '减速控制型魔法塔', goldCost: 0 },
    { id: 'card_shield_guard', name: '盾卫', type: 'unit', description: '近战嘲讽士兵', goldCost: 0 },
    { id: 'card_archer', name: '弓手', type: 'unit', description: '远程快速攻击', goldCost: 0 },
    { id: 'card_fireball', name: '火球术', type: 'spell', description: '2×2格范围火球伤害', goldCost: 0 },
    { id: 'card_arrow_rain', name: '剑雨', type: 'spell', description: '3×3格范围剑雨', goldCost: 0 },
    { id: 'card_gold_rush', name: '淘金热', type: 'spell', description: '立即获得80金币', goldCost: 0 },
    { id: 'card_blizzard', name: '暴风雪', type: 'spell', description: '减速AOE区域', goldCost: 0 },
  ];
}

// 5 张卡的卡池（刚好手牌上限）
function makeSmallPool(): CardInstance[] {
  return makeTestPool().slice(0, 5);
}

function makeCard(id: string, name = id): CardInstance {
  return { id, name, type: 'unit', description: '测试卡牌', goldCost: 0 };
}

function makeTrapCard(id: string, name = id): CardInstance {
  return { id, name, type: 'trap', description: '测试机关', goldCost: 0 };
}

function getDrawWeight(handSystem: HandSystem, cardId: string): number | undefined {
  return (handSystem as unknown as { cardDrawWeights: Map<string, number> }).cardDrawWeights.get(cardId);
}

function setDrawWeight(handSystem: HandSystem, cardId: string, weight: number): void {
  (handSystem as unknown as { cardDrawWeights: Map<string, number> }).cardDrawWeights.set(cardId, weight);
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
    it('从卡池中随机抽 5 张到手中', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const hand = handSystem.getHand();
      expect(hand).toHaveLength(5);
      // 所有槽位都应非空
      for (const card of hand) {
        expect(card).not.toBeNull();
        expect(card!.id).toBeTruthy();
        expect(card!.name).toBeTruthy();
      }
      // 5 张牌应互不相同
      const ids = hand.map((c) => c!.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('卡池不足 5 张时只抽可用的数量', () => {
      const pool = makeSmallPool().slice(0, 2); // only 2 cards
      handSystem.initialize(pool);
      const hand = handSystem.getHand();
      expect(hand).toHaveLength(5);
      // 前 2 槽非空，后 3 槽为空
      expect(hand[0]).not.toBeNull();
      expect(hand[1]).not.toBeNull();
      expect(hand[2]).toBeNull();
      expect(hand[3]).toBeNull();
      expect(hand[4]).toBeNull();
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
      expect(handSystem.getCount()).toBe(5);
      expect(firstIds.length).toBe(5);
      expect(secondIds.length).toBe(5);
    });

    it('初始手牌前 5 张没有防空牌时，从卡池后续交换 1 张防空牌进手', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);
      const pool: CardInstance[] = [
        { id: 'card_cannon_tower', name: '炮塔', type: 'unit', description: '地面群伤', goldCost: 0 },
        { id: 'card_missile_tower', name: '导弹塔', type: 'unit', description: '地面爆炸', goldCost: 0 },
        { id: 'card_fireball', name: '火球术', type: 'spell', description: '地面范围法术', goldCost: 0 },
        { id: 'card_bomb', name: '炸弹', type: 'spell', description: '地面爆炸', goldCost: 0 },
        { id: 'card_swordsman', name: '剑士', type: 'unit', description: '地面近战', goldCost: 0 },
        { id: 'card_archer', name: '弓手', type: 'unit', description: '防空士兵', goldCost: 0 },
      ];

      handSystem.initialize(pool);
      const ids = handSystem.getHand().map((c) => c?.id);

      expect(ids).toContain('card_archer');
      expect(ids).toHaveLength(5);
      expect(ids.some((id) => id === 'card_cannon_tower' || id === 'card_missile_tower' || id === 'card_fireball' || id === 'card_bomb' || id === 'card_swordsman')).toBe(true);
    });

    it('初始抽牌时同一张卡最多出现 2 张', () => {
      const pool: CardInstance[] = [
        makeCard('card_arrow_tower', '箭塔A'),
        makeCard('card_arrow_tower', '箭塔B'),
        makeCard('card_arrow_tower', '箭塔C'),
        makeCard('card_shield_guard', '盾卫'),
        makeCard('card_archer', '弓手'),
        { id: 'card_fireball', name: '火球术', type: 'spell', description: '测试法术', goldCost: 0 },
        { id: 'card_arrow_rain', name: '剑雨', type: 'spell', description: '测试法术', goldCost: 0 },
      ];

      handSystem.initialize(pool);
      const ids = handSystem.getHand().map((c) => c?.id);

      expect(ids.filter((id) => id === 'card_arrow_tower')).toHaveLength(2);
      expect(handSystem.getCount()).toBe(5);
    });

    it('初始抽牌时兵、塔、法术各自最多出现 2 张', () => {
      const pool: CardInstance[] = [
        makeCard('card_arrow_tower', '箭塔'),
        makeCard('card_ice_tower', '冰塔'),
        makeCard('card_fire_tower', '火塔'),
        makeCard('card_shield_guard', '盾卫'),
        makeCard('card_archer', '弓手'),
        makeCard('card_mage', '法师'),
        { id: 'card_fireball', name: '火球术', type: 'spell', description: '测试法术', goldCost: 0 },
        { id: 'card_arrow_rain', name: '剑雨', type: 'spell', description: '测试法术', goldCost: 0 },
        { id: 'card_blizzard', name: '暴风雪', type: 'spell', description: '测试法术', goldCost: 0 },
      ];

      handSystem.initialize(pool);
      const ids = handSystem.getHand().map((c) => c?.id);

      expect(ids.filter((id) => id?.endsWith('_tower'))).toHaveLength(2);
      expect(ids.filter((id) => id === 'card_shield_guard' || id === 'card_archer' || id === 'card_mage')).toHaveLength(2);
      expect(ids.filter((id) => id === 'card_fireball' || id === 'card_arrow_rain' || id === 'card_blizzard')).toHaveLength(1);
      expect(handSystem.getCount()).toBe(5);
    });
  });

  describe('drawCard — 抽牌', () => {
    it('手牌未满时成功抽入', () => {
      // initialize 存入 cardLibrary，然后 reset 清空手牌，再手动抽入 2 张
      handSystem.initialize(makeTestPool());
      handSystem.reset();
      expect(handSystem.getCount()).toBe(0);

      handSystem.drawCard('card_arrow_tower');
      handSystem.drawCard('card_ice_tower');
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
      expect(handSystem.getCount()).toBe(5);
    });

    it('无效 cardId 返回 false', () => {
      handSystem.initialize(makeTestPool());
      handSystem.reset();
      const result = handSystem.drawCard('nonexistent_card');
      expect(result).toBe(false);
    });

    it('抽入未知 cardId（未在卡库中）', () => {
      handSystem.initialize(makeTestPool());
      handSystem.reset();
      const result = handSystem.drawCard('totally_fake_card');
      expect(result).toBe(false);
    });

    it('手动抽牌时同一张卡最多出现 2 张', () => {
      handSystem.initialize(makeTestPool());
      handSystem.reset();

      expect(handSystem.drawCard('card_arrow_tower')).toBe(true);
      expect(handSystem.drawCard('card_arrow_tower')).toBe(true);
      expect(handSystem.drawCard('card_arrow_tower')).toBe(false);
      expect(handSystem.getHand().filter((card) => card?.id === 'card_arrow_tower')).toHaveLength(2);
    });

    it('手动抽牌时同类塔牌超过 2 张会失败', () => {
      handSystem.initialize(makeTestPool());
      handSystem.reset();

      expect(handSystem.drawCard('card_arrow_tower')).toBe(true);
      expect(handSystem.drawCard('card_ice_tower')).toBe(true);
      expect(handSystem.drawCard('card_fire_tower')).toBe(false);
      expect(handSystem.getHand().filter((card) => card?.id.endsWith('_tower'))).toHaveLength(2);
    });

    it('手动抽牌时同类兵牌超过 2 张会失败', () => {
      handSystem.initialize(makeTestPool());
      handSystem.reset();

      expect(handSystem.drawCard('card_shield_guard')).toBe(true);
      expect(handSystem.drawCard('card_archer')).toBe(true);
      expect(handSystem.drawCard('card_mage')).toBe(false);
      expect(handSystem.getHand().filter((card) => card?.id === 'card_shield_guard' || card?.id === 'card_archer' || card?.id === 'card_mage')).toHaveLength(2);
    });

    it('手动抽牌时同类法术牌超过 2 张会失败', () => {
      handSystem.initialize(makeTestPool());
      handSystem.reset();

      expect(handSystem.drawCard('card_fireball')).toBe(true);
      expect(handSystem.drawCard('card_arrow_rain')).toBe(true);
      expect(handSystem.drawCard('card_gold_rush')).toBe(false);
      expect(handSystem.getHand().filter((card) => card?.type === 'spell')).toHaveLength(2);
    });

    it('成功抽入手牌后对应卡牌随机权重降低 1 点，最低为 5', () => {
      const pool = [
        makeTrapCard('card_spike_trap', '地刺'),
        makeTrapCard('card_bear_trap', '捕兽夹'),
        makeTrapCard('card_tar_pit', '焦油坑'),
        makeTrapCard('card_boulder', '巨石'),
        makeTrapCard('card_bomb', '炸弹'),
      ];

      handSystem.initialize(pool);
      expect(getDrawWeight(handSystem, 'card_spike_trap')).toBe(19);

      for (let i = 0; i < 30; i++) {
        handSystem.reset();
        expect(handSystem.drawCard('card_spike_trap')).toBe(true);
      }

      expect(getDrawWeight(handSystem, 'card_spike_trap')).toBe(5);
    });

    it('随机补牌按当前卡牌权重加权选择', () => {
      handSystem.initialize([
        makeTrapCard('card_spike_trap', '地刺'),
        makeTrapCard('card_bear_trap', '捕兽夹'),
      ]);
      handSystem.reset();
      setDrawWeight(handSystem, 'card_spike_trap', 5);
      setDrawWeight(handSystem, 'card_bear_trap', 20);

      vi.spyOn(Math, 'random').mockReturnValueOnce(0.19);
      expect(handSystem.drawRandomCard()).toBe(true);
      expect(handSystem.getHand()[0]?.id).toBe('card_spike_trap');

      handSystem.reset();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.2);
      expect(handSystem.drawRandomCard()).toBe(true);
      expect(handSystem.getHand()[0]?.id).toBe('card_bear_trap');
    });

    it('随机补牌不会连续两次抽到同一张卡', () => {
      handSystem.initialize([
        makeTrapCard('card_spike_trap', '地刺'),
        makeTrapCard('card_bear_trap', '捕兽夹'),
        makeTrapCard('card_tar_pit', '焦油坑'),
      ]);
      handSystem.reset();

      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(handSystem.drawRandomCard()).toBe(true);
      expect(handSystem.getHand()[0]?.id).toBe('card_spike_trap');

      handSystem.reset();
      expect(handSystem.drawRandomCard()).toBe(true);
      expect(handSystem.getHand()[0]?.id).toBe('card_bear_trap');
    });

    it('只有上一张卡是合法候选时允许连续抽到同一张卡兜底', () => {
      handSystem.initialize([
        makeTrapCard('card_spike_trap', '地刺'),
      ]);
      handSystem.reset();

      expect(handSystem.drawRandomCard()).toBe(true);
      expect(handSystem.getHand()[0]?.id).toBe('card_spike_trap');

      handSystem.reset();
      expect(handSystem.drawRandomCard()).toBe(true);
      expect(handSystem.getHand()[0]?.id).toBe('card_spike_trap');
    });
  });

  describe('playCard — 出牌（v5.0: 自动补牌）', () => {
    it('打出有效槽位的牌并返回 cardId，自动补牌保持手牌满', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const handBefore = handSystem.getHand();
      const cardToPlay = handBefore[0]!;
      expect(cardToPlay).not.toBeNull();

      const playedId = handSystem.playCard(0);
      expect(playedId).toBe(cardToPlay.id);
      // v5.0: 自动补牌后所有槽位仍然非空
      const handAfter = handSystem.getHand();
      for (const card of handAfter) {
        expect(card).not.toBeNull();
      }
      expect(handSystem.getCount()).toBe(5);
      expect(handSystem.isFull()).toBe(true);
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
      expect(handSystem.playCard(5)).toBeNull();
      expect(handSystem.playCard(100)).toBeNull();
    });

    it('指定 expectedCardId 时，槽位不是同一张卡则不移除也不补牌', () => {
      handSystem.initialize(makeTestPool());
      const handBefore = handSystem.getHand();
      const originalCard = handBefore[0]!;

      const playedId = handSystem.playCard(0, 'card_not_in_this_slot');

      expect(playedId).toBeNull();
      expect(handSystem.getHand()[0]?.id).toBe(originalCard.id);
      expect(handSystem.getHand().map((card) => card?.id)).toEqual(handBefore.map((card) => card?.id));
    });

    it('出牌后自动补牌，所有槽位非空，原打出槽位被新牌填充', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const oldCard = handSystem.getHand()[1]!;

      handSystem.playCard(1);
      const handAfter = handSystem.getHand();
      // 所有槽位非空
      for (let i = 0; i < 5; i++) {
        expect(handAfter[i]).not.toBeNull();
      }
      // slot 1 被新牌填充（不同于旧牌）
      expect(handAfter[1]!.id).not.toBe(oldCard.id);
    });

    it('出牌后自动补牌不会立刻补回刚打出的同一张卡', () => {
      handSystem.initialize([
        makeTrapCard('card_spike_trap', '地刺'),
        makeTrapCard('card_bear_trap', '捕兽夹'),
      ]);
      handSystem.reset();
      handSystem.drawCard('card_spike_trap');
      handSystem.drawCard('card_bear_trap');

      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(handSystem.playCard(0)).toBe('card_spike_trap');

      expect(handSystem.getHand()[0]?.id).toBe('card_bear_trap');
    });

    it('出牌后自动补牌不会让同一卡超过 2 张', () => {
      handSystem.initialize([
        { id: 'card_spike_trap', name: '地刺', type: 'trap', description: '测试机关', goldCost: 0 },
        { id: 'card_bear_trap', name: '捕兽夹', type: 'trap', description: '测试机关', goldCost: 0 },
      ]);
      handSystem.reset();
      handSystem.drawCard('card_spike_trap');
      handSystem.drawCard('card_spike_trap');
      handSystem.drawCard('card_bear_trap');

      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(handSystem.playCard(2)).toBe('card_bear_trap');

      const ids = handSystem.getHand().map((c) => c?.id);
      expect(ids.filter((id) => id === 'card_spike_trap')).toHaveLength(2);
      expect(handSystem.getCount()).toBe(3);
    });

    it('出牌后自动补牌不会让同类牌超过 2 张', () => {
      handSystem.initialize([
        makeCard('card_arrow_tower', '箭塔'),
        makeCard('card_ice_tower', '冰塔'),
        makeCard('card_fire_tower', '火塔'),
        makeCard('card_shield_guard', '盾卫'),
      ]);
      handSystem.reset();
      handSystem.drawCard('card_arrow_tower');
      handSystem.drawCard('card_ice_tower');
      handSystem.drawCard('card_shield_guard');

      vi.spyOn(Math, 'random').mockReturnValue(0);
      expect(handSystem.playCard(2)).toBe('card_shield_guard');

      const hand = handSystem.getHand();
      expect(hand.filter((card) => card?.id.endsWith('_tower'))).toHaveLength(2);
      expect(hand.some((card) => card?.id === 'card_fire_tower')).toBe(false);
      expect(handSystem.getCount()).toBe(3);
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

    it('替换空槽位放入新牌', () => {
      // initialize 填充 cardLibrary，然后 reset + 部分抽牌创建空槽位
      handSystem.initialize(makeTestPool());
      handSystem.reset();
      handSystem.drawCard('card_arrow_tower');
      handSystem.drawCard('card_ice_tower');
      // slot 2 为空
      expect(handSystem.getHand()[2]).toBeNull();
      const replacedId = handSystem.replaceCard(2, 'card_fireball');
      expect(replacedId).toBe('');
      expect(handSystem.getHand()[2]!.id).toBe('card_fireball');
      expect(handSystem.getCount()).toBe(3);
    });

    it('越界 index 抛出异常', () => {
      handSystem.initialize(makeTestPool());
      expect(() => handSystem.replaceCard(-1, 'card_fireball')).toThrow();
      expect(() => handSystem.replaceCard(5, 'card_fireball')).toThrow();
    });

    it('无效 cardId 抛出异常', () => {
      handSystem.initialize(makeTestPool());
      expect(() => handSystem.replaceCard(0, 'bad_card')).toThrow();
    });

    it('替换后手牌总数不变（非空槽替换）', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      const countBefore = handSystem.getCount();
      handSystem.replaceCard(0, 'card_gold_rush');
      expect(handSystem.getCount()).toBe(countBefore);
    });
  });

  describe('isFull / getCount', () => {
    it('初始 5 张后 isFull 为 true', () => {
      handSystem.initialize(makeSmallPool());
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(5);
    });

    it('出牌后自动补牌，isFull 仍为 true', () => {
      handSystem.initialize(makeSmallPool());
      handSystem.playCard(0);
      // v5.0: 自动补牌保持手牌满
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(5);
    });

    it('初始化为空时 isFull 为 false', () => {
      handSystem.initialize([]);
      expect(handSystem.isFull()).toBe(false);
      expect(handSystem.getCount()).toBe(0);
    });

    it('部分卡池初始化后 isFull 为 false', () => {
      handSystem.initialize(makeTestPool().slice(0, 3));
      expect(handSystem.isFull()).toBe(false);
      expect(handSystem.getCount()).toBe(3);
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
      for (let i = 0; i < 5; i++) {
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
      expect(handSystem.getCount()).toBe(5);

      handSystem.reset();
      expect(handSystem.getCount()).toBe(0);
      for (const card of handSystem.getHand()) {
        expect(card).toBeNull();
      }
    });
  });

  describe('集成场景', () => {
    it('完整流程：初始→出牌（自动补牌）→替换', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(5);

      // 打出 2 张牌（自动补牌，手牌保持满）
      const id1 = handSystem.playCard(0);
      const id2 = handSystem.playCard(1);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(5);

      // 替换一张
      handSystem.replaceCard(3, 'card_arrow_rain');
      expect(handSystem.getHand()[3]!.id).toBe('card_arrow_rain');
    });

    it('手牌满时抽牌失败', () => {
      const pool = makeTestPool();
      handSystem.initialize(pool);
      expect(handSystem.isFull()).toBe(true);

      // 直接抽失败
      expect(handSystem.drawCard('card_fireball')).toBe(false);
    });

    it('每种士兵升级卡成功进手两次后不能再次抽入', () => {
      const upgradeCard: CardInstance = {
        id: 'card_upgrade_shield_guard',
        name: '盾卫升级卡',
        type: 'spell',
        description: '本场盾卫等级+1',
        goldCost: 0,
      };
      handSystem.initialize(makeSmallPool());
      handSystem.addCardsToLibrary([upgradeCard]);
      handSystem.reset();

      expect(handSystem.drawCard('card_upgrade_shield_guard')).toBe(true);
      handSystem.reset();
      expect(handSystem.drawCard('card_upgrade_shield_guard')).toBe(true);
      handSystem.reset();
      expect(handSystem.drawCard('card_upgrade_shield_guard')).toBe(false);
    });

    it('re-init + 抽牌流程', () => {
      // initialize → cardLibrary 已填充 → reset → 抽牌
      handSystem.initialize(makeTestPool());
      handSystem.reset();
      expect(handSystem.getCount()).toBe(0);

      handSystem.drawCard('card_arrow_tower');
      handSystem.drawCard('card_ice_tower');
      expect(handSystem.getCount()).toBe(2);
      expect(handSystem.isFull()).toBe(false);

      handSystem.drawCard('card_shield_guard');
      handSystem.drawCard('card_archer');
      handSystem.drawCard('card_fireball');
      expect(handSystem.isFull()).toBe(true);
      expect(handSystem.getCount()).toBe(5);
    });
  });
});
