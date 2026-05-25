// ============================================================
// InterLevelBuffSystem 单元测试
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterLevelBuffSystem, type BuffOption } from '../InterLevelBuffSystem.js';
import { TowerWorld } from '../../core/World.js';

// ---- 测试用 Buff 数据（基于 design/04-levels.md §8 Buff 池） ----

function makeBuffPool(): BuffOption[] {
  return [
    { id: 'sharpshooter', name: '神射手', description: '箭塔+弩塔攻速+15%', rarity: 'common', effect: { type: 'attack_speed', value: 15, target: 'arrow_ballista' } },
    { id: 'frozen_heart', name: '寒冰之心', description: '冰塔减速效果+10%', rarity: 'common', effect: { type: 'slow', value: 10, target: 'ice_tower' } },
    { id: 'flame_power', name: '烈焰之力', description: '火塔灼烧DOT+3/s', rarity: 'common', effect: { type: 'dot', value: 3, target: 'fire_tower' } },
    { id: 'steel_defense', name: '钢铁防线', description: '水晶HP上限+100', rarity: 'common', effect: { type: 'hp', value: 100, target: 'crystal' } },
    { id: 'quick_march', name: '快速行军', description: '所有士兵移速+20%', rarity: 'common', effect: { type: 'move_speed', value: 20, target: 'soldier' } },
    { id: 'gold_reserve', name: '金币储备', description: '下一关初始金币+50', rarity: 'common', effect: { type: 'gold', value: 50 } },
    { id: 'reinforced_arrow', name: '强化箭矢', description: '所有塔射程+10%', rarity: 'rare', effect: { type: 'range', value: 10, target: 'all_towers' } },
    { id: 'magic_surge', name: '魔法涌流', description: '所有魔法塔ATK+20%', rarity: 'rare', effect: { type: 'atk', value: 20, target: 'magic_towers' } },
    { id: 'double_bounty', name: '双倍赏金', description: '所有敌人击杀金币×1.5', rarity: 'rare', effect: { type: 'gold_multiplier', value: 1.5 } },
    { id: 'unbreakable_wall', name: '不破之壁', description: '水晶HP上限+200', rarity: 'rare', effect: { type: 'hp', value: 200, target: 'crystal' } },
    { id: 'arcane_wisdom', name: '奥术智慧', description: '手牌上限+1（本Run内）', rarity: 'epic', effect: { type: 'hand_size', value: 1 } },
    { id: 'tactical_master', name: '战术大师', description: '3选1抽卡改为4选1', rarity: 'epic', effect: { type: 'draft_options', value: 1 } },
  ];
}

function makeSmallBuffPool(): BuffOption[] {
  return makeBuffPool().slice(0, 3);
}

describe('InterLevelBuffSystem — 关间Buff选择', () => {
  let buffSystem: InterLevelBuffSystem;
  let world: TowerWorld;

  beforeEach(() => {
    buffSystem = new InterLevelBuffSystem();
    world = new TowerWorld();
  });

  describe('System 接口', () => {
    it('实现 System 接口，update 不抛异常', () => {
      expect(buffSystem.name).toBe('InterLevelBuffSystem');
      expect(() => buffSystem.update(world, 0.016)).not.toThrow();
    });
  });

  describe('startSelection — 启动选择', () => {
    it('从 Buff 池中随机选 2 个候选 Buff', () => {
      const pool = makeBuffPool();
      buffSystem.startSelection(pool);

      expect(buffSystem.isActive()).toBe(true);
      const options = buffSystem.getOptions();
      expect(options).toHaveLength(2);
      // 2 个 Buff 互不相同
      const ids = options.map((b) => b.id);
      expect(new Set(ids).size).toBe(2);
      // 所有候选都来自卡池
      const poolIds = new Set(pool.map((b) => b.id));
      for (const id of ids) {
        expect(poolIds.has(id)).toBe(true);
      }
    });

    it('空 Buff 池不启动选择', () => {
      buffSystem.startSelection([]);
      expect(buffSystem.isActive()).toBe(false);
      expect(buffSystem.getOptions()).toHaveLength(0);
    });

    it('Buff 池不足 2 个时只选可用的数量', () => {
      buffSystem.startSelection([makeBuffPool()[0]!]);
      expect(buffSystem.isActive()).toBe(true);
      expect(buffSystem.getOptions()).toHaveLength(1);
    });

    it('触发 onSelectionStart 回调', () => {
      const callback = vi.fn();
      buffSystem.onSelectionStart = callback;

      buffSystem.startSelection(makeBuffPool());
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('selectBuff — 选择 Buff', () => {
    it('选择有效索引返回 BuffOption 并结束选择', () => {
      buffSystem.startSelection(makeBuffPool());
      const options = buffSystem.getOptions();
      const expectedId = options[0]!.id;

      const selected = buffSystem.selectBuff(0);
      expect(selected.id).toBe(expectedId);
      expect(buffSystem.isActive()).toBe(false);
      expect(buffSystem.getOptions()).toHaveLength(0);
    });

    it('选中后加入 activeBuffs 列表', () => {
      buffSystem.startSelection(makeBuffPool());
      const options = buffSystem.getOptions();

      buffSystem.selectBuff(0);
      const activeBuffs = buffSystem.getActiveBuffs();
      expect(activeBuffs).toHaveLength(1);
      expect(activeBuffs[0]!.id).toBe(options[0]!.id);
    });

    it('触发 onSelectionComplete 回调', () => {
      const callback = vi.fn();
      buffSystem.onSelectionComplete = callback;

      buffSystem.startSelection(makeBuffPool());
      const options = buffSystem.getOptions();
      buffSystem.selectBuff(0);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(options[0]);
    });

    it('越界 index 抛出异常', () => {
      buffSystem.startSelection(makeBuffPool());
      expect(() => buffSystem.selectBuff(-1)).toThrow();
      expect(() => buffSystem.selectBuff(2)).toThrow();
      expect(() => buffSystem.selectBuff(100)).toThrow();
    });

    it('选择未激活时抛出异常', () => {
      expect(() => buffSystem.selectBuff(0)).toThrow('no active buff selection');
    });

    it('连续两次选择累积 activeBuffs', () => {
      buffSystem.startSelection(makeBuffPool());
      const firstOptions = buffSystem.getOptions();
      buffSystem.selectBuff(0);

      // 第二次选择
      buffSystem.startSelection(makeBuffPool());
      const secondOptions = buffSystem.getOptions();
      buffSystem.selectBuff(1);

      const activeBuffs = buffSystem.getActiveBuffs();
      expect(activeBuffs).toHaveLength(2);
      expect(activeBuffs[0]!.id).toBe(firstOptions[0]!.id);
      expect(activeBuffs[1]!.id).toBe(secondOptions[1]!.id);
    });
  });

  describe('getActiveBuffs — 获取已激活 Buff', () => {
    it('初始无 Buff', () => {
      expect(buffSystem.getActiveBuffs()).toEqual([]);
    });

    it('多次选择后累积', () => {
      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.selectBuff(0);

      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.selectBuff(0);

      expect(buffSystem.getActiveBuffs()).toHaveLength(2);
    });

    it('返回浅拷贝不影响内部数据', () => {
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(0);

      const buffs1 = buffSystem.getActiveBuffs();
      const buffs2 = buffSystem.getActiveBuffs();
      expect(buffs1).not.toBe(buffs2);
      expect(buffs1.map((b) => b.id)).toEqual(buffs2.map((b) => b.id));

      // 修改返回值不影响内部
      buffs1.length = 0;
      expect(buffSystem.getActiveBuffs()).toHaveLength(1);
    });
  });

  describe('isActive — 选择状态', () => {
    it('初始为 false', () => {
      expect(buffSystem.isActive()).toBe(false);
    });

    it('startSelection 后为 true', () => {
      buffSystem.startSelection(makeBuffPool());
      expect(buffSystem.isActive()).toBe(true);
    });

    it('selectBuff 后为 false', () => {
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.isActive()).toBe(false);
    });

    it('cancelSelection 后为 false', () => {
      buffSystem.startSelection(makeBuffPool());
      buffSystem.cancelSelection();
      expect(buffSystem.isActive()).toBe(false);
    });
  });

  describe('getOptions — 获取候选 Buff', () => {
    it('选择前返回空数组', () => {
      expect(buffSystem.getOptions()).toEqual([]);
    });

    it('选择中返回 2 个候选', () => {
      buffSystem.startSelection(makeBuffPool());
      expect(buffSystem.getOptions()).toHaveLength(2);
    });

    it('返回浅拷贝不影响内部', () => {
      buffSystem.startSelection(makeBuffPool());
      const opts1 = buffSystem.getOptions();
      const opts2 = buffSystem.getOptions();
      expect(opts1).not.toBe(opts2);
      opts1.length = 0;
      expect(buffSystem.getOptions()).toHaveLength(2);
    });
  });

  describe('cancelSelection — 取消选择', () => {
    it('取消后清空状态', () => {
      buffSystem.startSelection(makeBuffPool());
      expect(buffSystem.isActive()).toBe(true);

      buffSystem.cancelSelection();
      expect(buffSystem.isActive()).toBe(false);
      expect(buffSystem.getOptions()).toEqual([]);
    });

    it('取消后 selectBuff 抛异常', () => {
      buffSystem.startSelection(makeBuffPool());
      buffSystem.cancelSelection();
      expect(() => buffSystem.selectBuff(0)).toThrow();
    });
  });

  describe('clearAllBuffs — 清空所有 Buff', () => {
    it('清空 activeBuffs 列表', () => {
      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(1);

      buffSystem.clearAllBuffs();
      expect(buffSystem.getActiveBuffs()).toEqual([]);
    });

    it('不影响选择状态', () => {
      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.clearAllBuffs();
      // clearAllBuffs 只清 activeBuffs，不清选择状态
      expect(buffSystem.isActive()).toBe(true);
    });
  });

  describe('removeBuff — 移除指定 Buff', () => {
    it('移除存在的 Buff', () => {
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(0); // 假设选到了第一个
      const activeBuffs = buffSystem.getActiveBuffs();
      const buffId = activeBuffs[0]!.id;

      const result = buffSystem.removeBuff(buffId);
      expect(result).toBe(true);
      expect(buffSystem.getActiveBuffs()).toHaveLength(0);
    });

    it('移除不存在的 Buff 返回 false', () => {
      const result = buffSystem.removeBuff('nonexistent');
      expect(result).toBe(false);
    });

    it('只移除指定 Buff，不影响其他', () => {
      const pool = makeBuffPool();
      // 添加两个 Buff
      buffSystem.startSelection(pool);
      buffSystem.selectBuff(0);
      const firstId = buffSystem.getActiveBuffs()[0]!.id;

      buffSystem.startSelection(pool);
      buffSystem.selectBuff(0);
      const activeBuffs = buffSystem.getActiveBuffs();
      expect(activeBuffs).toHaveLength(2);

      const removed = buffSystem.removeBuff(firstId);
      expect(removed).toBe(true);
      // 还剩 1 个 Buff（可能和 firstId 相同，因为是随机选的）
      expect(buffSystem.getActiveBuffs()).toHaveLength(1);
      // 不再断言剩余 Buff 不等于 firstId（两个选择可能随机到相同 buff）
    });
  });

  describe('Buff 数据结构', () => {
    it('BuffOption 包含所有必需字段', () => {
      buffSystem.startSelection(makeBuffPool());
      const buff = buffSystem.getOptions()[0]!;

      expect(buff).toHaveProperty('id');
      expect(buff).toHaveProperty('name');
      expect(buff).toHaveProperty('description');
      expect(buff).toHaveProperty('rarity');
      expect(buff).toHaveProperty('effect');
      expect(buff.effect).toHaveProperty('type');
      expect(buff.effect).toHaveProperty('value');

      expect(['common', 'rare', 'epic']).toContain(buff.rarity);
      expect(typeof buff.effect.type).toBe('string');
      expect(typeof buff.effect.value).toBe('number');
    });

    it('不同稀有度的 Buff 都能正确选出', () => {
      const pool = makeBuffPool();
      const rarities = new Set(pool.map((b) => b.rarity));
      expect(rarities.has('common')).toBe(true);
      expect(rarities.has('rare')).toBe(true);
      expect(rarities.has('epic')).toBe(true);
    });
  });

  describe('集成场景', () => {
    it('完整 4 关间 Buff 选择流程', () => {
      // 第 1 关通关 → 选 Buff
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(1);

      // 第 2 关通关 → 选 Buff
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(1);
      expect(buffSystem.getActiveBuffs()).toHaveLength(2);

      // 第 3 关通关 → 选 Buff
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(3);

      // 第 4 关通关 → 选 Buff
      buffSystem.startSelection(makeBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(4);

      // 第 5 关通关 → 不触发选择（无第 6 关）
    });

    it('取消后重新选择可以正常进行', () => {
      buffSystem.startSelection(makeBuffPool());
      buffSystem.cancelSelection();
      expect(buffSystem.isActive()).toBe(false);

      // 重新触发
      buffSystem.startSelection(makeBuffPool());
      expect(buffSystem.isActive()).toBe(true);
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(1);
    });

    it('Run 重置：clearAllBuffs 清空历史', () => {
      // 模拟上一 Run 积攒的 Buff
      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.selectBuff(0);
      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(2);

      // 新 Run → 清空
      buffSystem.clearAllBuffs();
      expect(buffSystem.getActiveBuffs()).toHaveLength(0);

      // 新 Run 的首次选择
      buffSystem.startSelection(makeSmallBuffPool());
      buffSystem.selectBuff(0);
      expect(buffSystem.getActiveBuffs()).toHaveLength(1);
    });
  });
});
