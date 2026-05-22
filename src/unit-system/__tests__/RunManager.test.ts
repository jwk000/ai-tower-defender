import { describe, expect, it } from 'vitest';

import { RunManager, RunPhase, type MapNodeKind } from '../RunManager.js';
import type { CardSkillTreeConfig } from '../SkillTreeState.js';

function makeManager(totalLevels = 1, route?: readonly MapNodeKind[]): RunManager {
  return new RunManager({ totalLevels, route });
}

function claimBaseInterLevelRewards(run: RunManager): void {
  run.claimCardReward(run.pendingCardReward!.options[0]!.id);
  run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
  run.claimRelicReward(run.pendingRelicReward!.options[0]!.id);
}

const TEST_SKILL_TREE: CardSkillTreeConfig = {
  unitCardId: 'arrow_tower',
  nodes: [
    { id: 'arrow_lv1', name: '箭塔 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
    { id: 'arrow_lv2', name: '箭塔 Lv.2', level: 2, goldCost: 0, prerequisites: ['arrow_lv1'], effects: [] },
    { id: 'arrow_lv3', name: '箭塔 Lv.3', level: 3, goldCost: 0, prerequisites: ['arrow_lv2'], effects: [] },
  ],
};

describe('RunManager state machine', () => {
  it('starts in Idle phase with no active level', () => {
    const run = makeManager();
    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
  });

  it('startRun transitions Idle -> LevelMap and sets level to 1', () => {
    const run = makeManager();
    run.startRun();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(1);
  });

  it('exposes route nodes and current node kind', () => {
    const route = ['battle', 'elite', 'shop', 'mystic', 'treasure', 'rest', 'boss'] as const;
    const run = makeManager(route.length, route);
    run.startRun();
    expect(run.currentNodeKind).toBe('battle');
    expect(run.getRouteNode(2)).toEqual({ levelIndex: 2, kind: 'elite' });
    expect(run.getRoute().map((node) => node.kind)).toEqual(route);
  });

  it('enterBattle transitions LevelMap -> Battle', () => {
    const run = makeManager();
    run.startRun();
    run.enterBattle();
    expect(run.phase).toBe(RunPhase.Battle);
  });

  it('rejects startRun when not in Idle', () => {
    const run = makeManager();
    run.startRun();
    expect(() => run.startRun()).toThrow(/illegal transition/i);
  });

  it('completeLevel from Battle with more levels remaining transitions to InterLevel', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.InterLevel);
    expect(run.currentLevel).toBe(1);
    expect(run.pendingCardReward?.options).toHaveLength(3);
  });

  it('completeLevel from Battle on final level transitions to Result with Victory outcome', () => {
    const run = makeManager(1);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('victory');
  });

  it('pickInterLevelChoice("shop") transitions InterLevel -> Shop without advancing level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.pickInterLevelChoice('shop');
    expect(run.phase).toBe(RunPhase.Shop);
    expect(run.currentLevel).toBe(1);
  });

  it('pickInterLevelChoice("mystic") transitions InterLevel -> Mystic without advancing level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.pickInterLevelChoice('mystic');
    expect(run.phase).toBe(RunPhase.Mystic);
    expect(run.currentLevel).toBe(1);
  });

  it('closeShop transitions Shop -> LevelMap and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.pickInterLevelChoice('shop');
    run.closeShop();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('closeMystic transitions Mystic -> LevelMap and advances level', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.pickInterLevelChoice('mystic');
    run.closeMystic();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('returnToLevelMap transitions InterLevel -> LevelMap and advances level (skip path)', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.InterLevel);
    claimBaseInterLevelRewards(run);
    run.returnToLevelMap();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);
  });

  it('rejects returnToLevelMap when not in InterLevel', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.returnToLevelMap()).toThrow(/illegal transition/i);
  });

  it('rejects closeShop when not in Shop', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.closeShop()).toThrow(/illegal transition/i);
  });

  it('rejects closeMystic when not in Mystic', () => {
    const run = makeManager(3);
    run.startRun();
    expect(() => run.closeMystic()).toThrow(/illegal transition/i);
  });

  it('failRun from Battle transitions to Result with Defeat outcome', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.failRun();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('defeat');
  });

  it('rejects completeLevel when not in Battle', () => {
    const run = makeManager();
    expect(() => run.completeLevel()).toThrow(/illegal transition/i);
  });

  it('rejects pickInterLevelChoice when not in InterLevel', () => {
    const run = makeManager();
    run.startRun();
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/illegal transition/i);
  });

  it('rejects pickInterLevelChoice with unknown choice value', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    expect(() => run.pickInterLevelChoice('teleport' as unknown as 'shop')).toThrow(/unknown choice/i);
  });

  it('stores and resolves pending card reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options).toHaveLength(3);
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/card reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/card reward is pending/i);
    const chosen = run.pendingCardReward!.options[1]!;
    expect(run.claimCardReward(chosen.id)).toEqual(chosen);
    expect(run.pendingCardReward).toBeNull();
  });

  it('stores and resolves pending gold reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);

    expect(run.pendingGoldReward?.options).toHaveLength(3);
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/gold reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/gold reward is pending/i);
    const goldBefore = run.gold;
    const chosen = run.pendingGoldReward!.options[1]!;
    expect(run.claimGoldReward(chosen.id)).toEqual(chosen);
    expect(run.gold).toBe(goldBefore + chosen.amount);
    expect(run.pendingGoldReward).toBeNull();
  });

  it('stores and resolves pending relic reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);

    expect(run.pendingRelicReward?.options).toHaveLength(3);
    expect(() => run.pickInterLevelChoice('shop')).toThrow(/relic reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/relic reward is pending/i);
    const chosen = run.pendingRelicReward!.options[1]!;
    expect(run.claimRelicReward(chosen.id)).toEqual(chosen);
    expect(run.pendingRelicReward).toBeNull();
    expect(run.relics).toContainEqual(chosen);
  });

  it('coin_purse grants immediate bonus gold when claimed', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);

    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_2', relicId: 'mana_orb', title: '法力宝珠', description: '强化能量节奏。', category: 'energy' },
        { id: 'relic_3', relicId: 'war_banner', title: '战旗', description: '召唤体系增益。', category: 'summon' },
      ],
    });

    const goldBefore = run.gold;
    run.claimRelicReward('relic_1');
    expect(run.gold).toBe(goldBefore + 80);
  });

  it('golden_hoard increases future gold reward options after being claimed', () => {
    const run = makeManager(4);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'golden_hoard', title: '鎏金秘藏', description: '每次过关额外获得 25 金币。', category: 'economy' },
        { id: 'relic_2', relicId: 'mana_orb', title: '法力宝珠', description: '强化能量节奏。', category: 'energy' },
        { id: 'relic_3', relicId: 'war_banner', title: '战旗', description: '召唤体系增益。', category: 'summon' },
      ],
    });
    run.claimRelicReward('relic_1');
    run.returnToLevelMap();

    run.enterBattle();
    run.completeLevel();

    expect(run.pendingGoldReward?.options.map((option) => option.amount)).toEqual([60, 80, 110]);
  });

  it('merchant_contract reduces shop prices by 20 percent with floor rounding', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'merchant_contract', title: '商会契约', description: '商店商品统一 8 折。', category: 'economy' },
        { id: 'relic_2', relicId: 'mana_orb', title: '法力宝珠', description: '强化能量节奏。', category: 'energy' },
        { id: 'relic_3', relicId: 'war_banner', title: '战旗', description: '召唤体系增益。', category: 'summon' },
      ],
    });
    run.claimRelicReward('relic_1');

    expect(run.applyShopDiscount(30)).toBe(24);
    expect(run.applyShopDiscount(45)).toBe(36);
    expect(run.applyShopDiscount(101)).toBe(80);
  });

  it('claimRelicReward also records unified passive source for relic', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
        { id: 'relic_2', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_3', relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40。', category: 'summon' },
      ],
    });

    run.claimRelicReward('relic_1');

    expect(run.passiveSources).toEqual([
      {
        sourceId: 'mana_orb',
        sourceType: 'relic',
        name: '法力宝珠',
        description: '下场战斗初始能量 +1。',
        activeScope: 'run',
        effectRefs: ['mana_orb'],
        grantedAtLevel: 1,
        category: 'energy',
      },
    ]);
  });

  it('supports current-level passive sources and clears them after returning to level map', () => {
    const run = makeManager(3);
    run.startRun();

    run.grantPassiveSource({
      sourceId: 'lvmod_blitz',
      sourceType: 'level_modifier',
      name: '速攻号令',
      description: '前 20 秒能量回复更快。',
      activeScope: 'current_level',
      effectRefs: ['lvmod_blitz'],
      grantedAtLevel: 1,
      category: 'economy',
    });

    expect(run.passiveSources).toEqual([
      {
        sourceId: 'lvmod_blitz',
        sourceType: 'level_modifier',
        name: '速攻号令',
        description: '前 20 秒能量回复更快。',
        activeScope: 'current_level',
        effectRefs: ['lvmod_blitz'],
        grantedAtLevel: 1,
        category: 'economy',
      },
    ]);
    expect(run.getActivePassiveHudEntries()).toEqual([
      {
        sourceId: 'lvmod_blitz',
        sourceType: 'level_modifier',
        name: '速攻号令',
        description: '前 20 秒能量回复更快。',
      },
    ]);

    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.claimRelicReward(run.pendingRelicReward!.options[0]!.id);
    run.returnToLevelMap();

    expect(run.passiveSources).toEqual([
      expect.objectContaining({
        sourceId: 'coin_purse',
        sourceType: 'relic',
        activeScope: 'run',
      }),
    ]);
    expect(run.getActivePassiveHudEntries()).toEqual([
      {
        sourceId: 'coin_purse',
        sourceType: 'relic',
        name: '钱袋',
        description: '开局额外获得 80 金币，帮助更快启动构筑。',
      },
    ]);
  });

  it('can roll a level modifier from level pool and expose it to HUD', () => {
    const run = makeManager(3);
    run.startRun();

    const picked = run.rollLevelModifier([
      { id: 'lvmod_blitz' },
      { id: 'lvmod_fog' },
    ], () => 0.1);

    expect(picked).toEqual({ id: 'lvmod_blitz' });
    expect(run.passiveSources).toEqual([
      {
        sourceId: 'lvmod_blitz',
        sourceType: 'level_modifier',
        name: 'lvmod_blitz',
        description: 'lvmod_blitz',
        activeScope: 'current_level',
        effectRefs: ['lvmod_blitz'],
        grantedAtLevel: 1,
      },
    ]);
    expect(run.getActivePassiveHudEntries()).toEqual([
      {
        sourceId: 'lvmod_blitz',
        sourceType: 'level_modifier',
        name: 'lvmod_blitz',
        description: 'lvmod_blitz',
      },
    ]);
  });

  it('does not roll level modifier when pool is empty', () => {
    const run = makeManager(3);
    run.startRun();

    const picked = run.rollLevelModifier([], () => 0.1);

    expect(picked).toBeNull();
    expect(run.passiveSources).toEqual([]);
    expect(run.getActivePassiveHudEntries()).toEqual([]);
  });

  it('snapshot / restore preserves current-level passive sources', () => {
    const run = makeManager(3);
    run.startRun();
    run.grantPassiveSource({
      sourceId: 'lvmod_blitz',
      sourceType: 'level_modifier',
      name: '速攻号令',
      description: '前 20 秒能量回复更快。',
      activeScope: 'current_level',
      effectRefs: ['lvmod_blitz'],
      grantedAtLevel: 1,
      category: 'economy',
    });

    const snap = run.snapshot({ snapshot: () => ({ ownedCards: [] }) } as never);
    const restored = makeManager(3);
    restored.restoreFrom(snap);

    expect(restored.passiveSources).toEqual(run.passiveSources);
    expect(restored.getActivePassiveHudEntries()).toEqual([
      {
        sourceId: 'lvmod_blitz',
        sourceType: 'level_modifier',
        name: '速攻号令',
        description: '前 20 秒能量回复更快。',
      },
    ]);
  });

  it('energy relic getters stack max energy and regen bonuses across multiple relics', () => {
    const run = makeManager(4);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'arcane_reservoir', title: '奥术蓄能池', description: '能量上限 +2。', category: 'energy' },
        { id: 'relic_2', relicId: 'flowing_focus', title: '流光沙漏', description: '能量回复 +0.25/秒。', category: 'energy' },
        { id: 'relic_3', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
      ],
    });
    run.claimRelicReward('relic_1');
    expect(run.getMaxEnergyBonusFromRelics()).toBe(2);
    expect(run.getEnergyRegenBonusFromRelics()).toBe(0);

    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 2,
      options: [
        { id: 'relic_4', relicId: 'flowing_focus', title: '流光沙漏', description: '能量回复 +0.25/秒。', category: 'energy' },
        { id: 'relic_5', relicId: 'war_banner', title: '战旗', description: '召唤体系增益。', category: 'summon' },
        { id: 'relic_6', relicId: 'ember_seal', title: '余烬印记', description: '法术体系增益。', category: 'spell' },
      ],
    });
    run.claimRelicReward('relic_4');

    expect(run.getMaxEnergyBonusFromRelics()).toBe(2);
    expect(run.getEnergyRegenBonusFromRelics()).toBe(0.25);
    expect(run.getStartEnergyBonusFromRelics()).toBe(0);
  });

  it('war_banner grants player soldier hp bonus through summon relic getters', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40。', category: 'summon' },
        { id: 'relic_2', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_3', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
      ],
    });

    expect(run.getPlayerSoldierHpBonusFromRelics()).toBe(0);
    expect(run.getPlayerSoldierAttackBonusFromRelics()).toBe(0);
    run.claimRelicReward('relic_1');
    expect(run.getPlayerSoldierHpBonusFromRelics()).toBe(40);
    expect(run.getPlayerSoldierAttackBonusFromRelics()).toBe(0);
  });

  it('summon relic getters stack player soldier hp and attack bonuses', () => {
    const run = makeManager(4);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40。', category: 'summon' },
        { id: 'relic_2', relicId: 'drill_sergeant_whistle', title: '教官口哨', description: '我方士兵召唤物攻击 +6。', category: 'summon' },
        { id: 'relic_3', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
      ],
    });
    run.claimRelicReward('relic_1');
    expect(run.getPlayerSoldierHpBonusFromRelics()).toBe(40);
    expect(run.getPlayerSoldierAttackBonusFromRelics()).toBe(0);

    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 2,
      options: [
        { id: 'relic_4', relicId: 'drill_sergeant_whistle', title: '教官口哨', description: '我方士兵召唤物攻击 +6。', category: 'summon' },
        { id: 'relic_5', relicId: 'field_rations', title: '战地口粮', description: '我方士兵召唤物生命 +25 且攻击 +4。', category: 'summon' },
        { id: 'relic_6', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
      ],
    });
    run.claimRelicReward('relic_5');

    expect(run.getPlayerSoldierHpBonusFromRelics()).toBe(65);
    expect(run.getPlayerSoldierAttackBonusFromRelics()).toBe(4);
  });

  it('ember_seal grants one extra spell cast through spell relic getter', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'ember_seal', title: '余烬印记', description: '法术额外结算 1 次。', category: 'spell' },
        { id: 'relic_2', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_3', relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40。', category: 'summon' },
      ],
    });

    expect(run.getSpellExtraCastCountFromRelics()).toBe(0);
    run.claimRelicReward('relic_1');
    expect(run.getSpellExtraCastCountFromRelics()).toBe(1);
  });

  it('spell relic getter stacks extra cast counts across multiple spell relics', () => {
    const run = makeManager(4);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'ember_seal', title: '余烬印记', description: '法术额外结算 1 次。', category: 'spell' },
        { id: 'relic_2', relicId: 'echo_scroll', title: '回响卷轴', description: '法术额外结算 1 次。', category: 'spell' },
        { id: 'relic_3', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
      ],
    });
    run.claimRelicReward('relic_1');
    expect(run.getSpellExtraCastCountFromRelics()).toBe(1);

    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 2,
      options: [
        { id: 'relic_4', relicId: 'storm_codex', title: '风暴法典', description: '法术额外结算 1 次。', category: 'spell' },
        { id: 'relic_5', relicId: 'war_banner', title: '战旗', description: '我方士兵召唤物生命 +40。', category: 'summon' },
        { id: 'relic_6', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
      ],
    });
    run.claimRelicReward('relic_4');

    expect(run.getSpellExtraCastCountFromRelics()).toBe(2);
  });

  it('bulwark_core increases crystal max hp and immediately repairs current crystal hp', () => {
    const run = makeManager(3);
    run.startRun();
    run.damageCrystal(5);
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'bulwark_core', title: '壁垒核心', description: '水晶上限 +4，并立刻修复 4 点水晶耐久。', category: 'defense' },
        { id: 'relic_2', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_3', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
      ],
    });

    expect(run.crystalHpMax).toBe(20);
    expect(run.crystalHp).toBe(15);
    expect(run.getCrystalHpMaxBonusFromRelics()).toBe(0);

    run.claimRelicReward('relic_1');

    expect(run.crystalHpMax).toBe(24);
    expect(run.crystalHp).toBe(19);
    expect(run.getCrystalHpMaxBonusFromRelics()).toBe(4);
  });

  it('repair_resin heals crystal hp but never exceeds the current max hp', () => {
    const run = makeManager(3);
    run.startRun();
    run.damageCrystal(3);
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'repair_resin', title: '修复树脂', description: '立刻修复 6 点水晶耐久。', category: 'defense' },
        { id: 'relic_2', relicId: 'war_banner', title: '战旗', description: '召唤体系增益。', category: 'summon' },
        { id: 'relic_3', relicId: 'ember_seal', title: '余烬印记', description: '法术额外结算 1 次。', category: 'spell' },
      ],
    });

    run.claimRelicReward('relic_1');

    expect(run.crystalHpMax).toBe(20);
    expect(run.crystalHp).toBe(20);
    expect(run.getCrystalHpMaxBonusFromRelics()).toBe(0);
  });

  it('defense relics stack crystal max hp bonuses and immediate repairs across multiple claims', () => {
    const run = makeManager(4);
    run.startRun();
    run.damageCrystal(8);
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 1,
      options: [
        { id: 'relic_1', relicId: 'bulwark_core', title: '壁垒核心', description: '水晶上限 +4，并立刻修复 4 点水晶耐久。', category: 'defense' },
        { id: 'relic_2', relicId: 'coin_purse', title: '钱袋', description: '开局额外获得 80 金币。', category: 'economy' },
        { id: 'relic_3', relicId: 'mana_orb', title: '法力宝珠', description: '下场战斗初始能量 +1。', category: 'energy' },
      ],
    });
    run.claimRelicReward('relic_1');

    expect(run.crystalHpMax).toBe(24);
    expect(run.crystalHp).toBe(16);

    run.returnToLevelMap();
    run.damageCrystal(5);
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingRelicReward({
      sourceLevel: 2,
      options: [
        { id: 'relic_4', relicId: 'sanctified_shell', title: '圣护外壳', description: '水晶上限 +2，并立刻修复 2 点水晶耐久。', category: 'defense' },
        { id: 'relic_5', relicId: 'war_banner', title: '战旗', description: '召唤体系增益。', category: 'summon' },
        { id: 'relic_6', relicId: 'ember_seal', title: '余烬印记', description: '法术额外结算 1 次。', category: 'spell' },
      ],
    });
    run.claimRelicReward('relic_4');

    expect(run.crystalHpMax).toBe(26);
    expect(run.crystalHp).toBe(13);
    expect(run.getCrystalHpMaxBonusFromRelics()).toBe(6);
  });

  it('prioritizes core cards when building upgrade reward options', () => {
    const run = makeManager(3);
    run.registerCardInstance('shield_guard_card_inst_2', { unitCardId: 'shield_guard', nodes: [
      { id: 'shield_guard_lv1', name: '盾卫 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'shield_guard_lv2', name: '盾卫 Lv.2', level: 2, goldCost: 55, prerequisites: ['shield_guard_lv1'], effects: [] },
      { id: 'shield_guard_lv3', name: '盾卫 Lv.3', level: 3, goldCost: 80, prerequisites: ['shield_guard_lv2'], effects: [] },
    ] });
    run.registerCardInstance('fireball_card_inst_3', { unitCardId: 'fireball_card', nodes: [
      { id: 'fireball_card_lv1', name: '火球术 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'fireball_card_lv2', name: '火球术 Lv.2', level: 2, goldCost: 60, prerequisites: ['fireball_card_lv1'], effects: [] },
      { id: 'fireball_card_lv3', name: '火球术 Lv.3', level: 3, goldCost: 90, prerequisites: ['fireball_card_lv2'], effects: [] },
    ] });
    run.registerCardInstance('gold_mine_card_inst_4', { unitCardId: 'gold_mine_card', nodes: [
      { id: 'gold_mine_card_lv1', name: '金矿 Lv.1', level: 1, goldCost: 0, prerequisites: [], effects: [] },
      { id: 'gold_mine_card_lv2', name: '金矿 Lv.2', level: 2, goldCost: 70, prerequisites: ['gold_mine_card_lv1'], effects: [] },
      { id: 'gold_mine_card_lv3', name: '金矿 Lv.3', level: 3, goldCost: 110, prerequisites: ['gold_mine_card_lv2'], effects: [] },
    ] });
    const options = run.buildUpgradeRewardOptions([
      { instanceId: 'shield_guard_card_inst_2', cardId: 'shield_guard_card' },
      { instanceId: 'fireball_card_inst_3', cardId: 'fireball_card' },
      { instanceId: 'gold_mine_card_inst_4', cardId: 'gold_mine_card' },
    ]);

    expect(options).toEqual([
      { id: 'shield_guard_card_inst_2_2', instanceId: 'shield_guard_card_inst_2', cardId: 'shield_guard_card', title: '盾卫 Lv.2', description: '升级到 Lv.2' },
      { id: 'fireball_card_inst_3_2', instanceId: 'fireball_card_inst_3', cardId: 'fireball_card', title: '火球术 Lv.2', description: '升级到 Lv.2' },
      { id: 'gold_mine_card_inst_4_2', instanceId: 'gold_mine_card_inst_4', cardId: 'gold_mine_card', title: '金矿 Lv.2', description: '升级到 Lv.2' },
    ]);
  });

  it('registers card reward level tracks for spell and economy core cards', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    run.registerClaimedCardReward('fireball_card_inst_5', 'fireball_card');
    run.registerClaimedCardReward('gold_mine_card_inst_6', 'gold_mine_card');
    run.registerClaimedCardReward('spike_trap_card_inst_7', 'spike_trap_card');

    expect(run.getNextUpgradeNode('fireball_card_inst_5')?.name).toBe('火球术 Lv.2');
    expect(run.getNextUpgradeNode('gold_mine_card_inst_6')?.goldCost).toBe(70);
    expect(run.getNextUpgradeNode('spike_trap_card_inst_7')?.goldCost).toBe(45);
  });

  it('rotates reward starters across summon, spell, and building trap archetypes', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'swordsman_card',
      'archer_card',
      'shield_guard_card',
    ]);

    claimBaseInterLevelRewards(run);
    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'shield_guard_card',
      'priest_card',
      'fireball_card',
    ]);
  });

  it('keeps summon archetype playable across the first two reward rounds', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    const firstRound = run.pendingCardReward!.options.map((option) => option.cardId);
    expect(firstRound).toEqual(['swordsman_card', 'archer_card', 'shield_guard_card']);

    claimBaseInterLevelRewards(run);
    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();

    const secondRound = run.pendingCardReward!.options.map((option) => option.cardId);
    expect(secondRound).toContain('priest_card');
  });

  it('keeps spell archetype reachable by the second reward round', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();

    const secondRound = run.pendingCardReward!.options.map((option) => option.cardId);
    expect(secondRound).toContain('fireball_card');
  });

  it('keeps the second reward round focused on extended summon and spell followups', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();

    const secondRound = run.pendingCardReward!.options.map((option) => option.cardId);
    expect(secondRound).toEqual(['shield_guard_card', 'priest_card', 'fireball_card']);
  });

  it('offers gold support alongside archetype rewards in the first two rounds', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingGoldReward?.options.map((option) => option.amount)).toEqual([30, 50, 80]);

    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[1]!.id);
    run.claimRelicReward(run.pendingRelicReward!.options[0]!.id);
    run.returnToLevelMap();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingGoldReward?.options.map((option) => option.amount)).toEqual([35, 55, 85]);
  });

  it('can claim one archetype reward per round and continue the run loop', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    const summonPick = run.claimCardReward(run.pendingCardReward!.options[1]!.id);
    expect(summonPick.cardId).toBe('archer_card');
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.claimRelicReward(run.pendingRelicReward!.options[0]!.id);
    run.returnToLevelMap();
    expect(run.phase).toBe(RunPhase.LevelMap);
    expect(run.currentLevel).toBe(2);

    run.enterBattle();
    run.completeLevel();
    const followupIds = run.pendingCardReward!.options.map((option) => option.cardId);
    expect(followupIds).toEqual(['shield_guard_card', 'priest_card', 'fireball_card']);
  });

  it('opens the summon reward window with swordsman_card as the low-cost frontline option', () => {
    const run = makeManager(8);
    run.startRun();
    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toContain('swordsman_card');
    expect(run.pendingCardReward?.options[0]?.cardId).toBe('swordsman_card');
  });

  it('exposes energy_crystal_card in the third production/trap reward window', () => {
    const run = makeManager(8);
    run.startRun();

    for (let round = 0; round < 2; round += 1) {
      run.enterBattle();
      run.completeLevel();
      claimBaseInterLevelRewards(run);
      run.returnToLevelMap();
    }

    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'fireball_card',
      'gold_mine_card',
      'engineer_card',
    ]);
  });

  it('exposes late demo tower cards after the spell/building windows', () => {
    const run = makeManager(8);
    run.startRun();

    for (let round = 0; round < 5; round += 1) {
      run.enterBattle();
      run.completeLevel();
      claimBaseInterLevelRewards(run);
      run.returnToLevelMap();
    }

    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'lightning_tower_card',
      'laser_tower_card',
      'arrow_tower_card',
    ]);
  });

  it('keeps every reward window internally unique across the full demo rotation', () => {
    const run = makeManager(8);
    run.startRun();

    for (let round = 0; round < 7; round += 1) {
      run.enterBattle();
      run.completeLevel();

      const rewardIds = run.pendingCardReward!.options.map((option) => option.cardId);
      expect(new Set(rewardIds).size).toBe(3);

      claimBaseInterLevelRewards(run);
      run.returnToLevelMap();
    }
  });

  it('fails fast when fewer than three unique card rewards remain available', () => {
    const run = makeManager(8);
    run.registerCardInstance('owned_swordsman', { unitCardId: 'swordsman', nodes: [] });
    run.registerCardInstance('owned_archer', { unitCardId: 'archer', nodes: [] });
    run.registerCardInstance('owned_shield_guard', { unitCardId: 'shield_guard', nodes: [] });
    run.registerCardInstance('owned_priest', { unitCardId: 'priest', nodes: [] });
    run.registerCardInstance('owned_fireball', { unitCardId: 'fireball', nodes: [] });
    run.registerCardInstance('owned_gold_mine', { unitCardId: 'gold_mine', nodes: [] });
    run.registerCardInstance('owned_engineer', { unitCardId: 'engineer', nodes: [] });
    run.registerCardInstance('owned_assassin', { unitCardId: 'assassin', nodes: [] });
    run.registerCardInstance('owned_energy_crystal', { unitCardId: 'energy_crystal', nodes: [] });
    run.registerCardInstance('owned_spike_trap', { unitCardId: 'spike_trap', nodes: [] });
    run.registerCardInstance('owned_lightning_tower', { unitCardId: 'lightning_tower', nodes: [] });
    run.registerCardInstance('owned_laser_tower', { unitCardId: 'laser_tower', nodes: [] });
    run.registerCardInstance('owned_arrow_tower', { unitCardId: 'arrow_tower', nodes: [] });
    run.registerCardInstance('owned_cannon_tower', { unitCardId: 'cannon_tower', nodes: [] });
    run.registerCardInstance('owned_ice_tower', { unitCardId: 'ice_tower', nodes: [] });
    run.registerCardInstance('owned_fire_tower', { unitCardId: 'fire_tower', nodes: [] });
    run.registerCardInstance('owned_poison_tower', { unitCardId: 'poison_tower', nodes: [] });
    run.registerCardInstance('owned_crossbow_tower', { unitCardId: 'crossbow_tower', nodes: [] });

    run.startRun();
    run.enterBattle();
    expect(() => run.completeLevel()).toThrow(/not enough unique card rewards remaining/i);
  });



  it('exposes assassin_card in the fourth reward window after the engineer card appears', () => {
    const run = makeManager(8);
    run.startRun();

    for (let round = 0; round < 3; round += 1) {
      run.enterBattle();
      run.completeLevel();
      claimBaseInterLevelRewards(run);
      run.returnToLevelMap();
    }

    run.enterBattle();
    run.completeLevel();

    expect(run.pendingCardReward?.options.map((option) => option.cardId)).toEqual([
      'engineer_card',
      'assassin_card',
      'energy_crystal_card',
    ]);
  });

  it('stores and resolves pending upgrade reward in InterLevel phase', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.completeLevel();
    claimBaseInterLevelRewards(run);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'arrow_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.pickInterLevelChoice('shop')).toThrow(/upgrade reward is pending/i);
    expect(() => run.returnToLevelMap()).toThrow(/upgrade reward is pending/i);
    expect(run.getCardLevel('arrow_b')).toBe(1);

    const chosen = run.pendingUpgradeReward!.options[1]!;
    expect(run.claimUpgradeReward(chosen.id)).toEqual(chosen);
    expect(run.pendingUpgradeReward).toBeNull();
    expect(run.getCardLevel('arrow_b')).toBe(2);
  });

  it('claimUpgradeReward rejects unknown option ids', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'arrow_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.claimUpgradeReward('missing')).toThrow(/unknown upgrade reward option/i);
  });

  it('claimUpgradeReward fails loudly when target instance is missing', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'missing_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '升级到 Lv.2' },
        { id: 'u2', instanceId: 'missing_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'missing_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.claimUpgradeReward('u1')).toThrow(/INSTANCE_NOT_FOUND/i);
  });

  it('claimUpgradeReward fails loudly when no next upgrade is available', () => {
    const run = makeManager(3);
    run.startRun();
    run.enterBattle();
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.activateNode('arrow_a', 'arrow_lv2');
    run.activateNode('arrow_a', 'arrow_lv3');
    run.completeLevel();
    run.claimCardReward(run.pendingCardReward!.options[0]!.id);
    run.claimGoldReward(run.pendingGoldReward!.options[0]!.id);
    run.setPendingUpgradeReward({
      sourceLevel: 1,
      options: [
        { id: 'u1', instanceId: 'arrow_a', cardId: 'arrow_tower_card', title: '箭塔 A', description: '已满级' },
        { id: 'u2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 B', description: '升级到 Lv.2' },
        { id: 'u3', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 C', description: '升级到 Lv.2' },
      ],
    });

    expect(() => run.claimUpgradeReward('u1')).toThrow(/NODE_ALREADY_ACTIVE/i);
  });

  it('buildUpgradeRewardOptions filters out max-level cards', () => {
    const run = makeManager(3);
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_d', TEST_SKILL_TREE);
    run.activateNode('arrow_a', 'arrow_lv2');
    run.activateNode('arrow_a', 'arrow_lv3');

    const options = run.buildUpgradeRewardOptions([
      { instanceId: 'arrow_a', cardId: 'arrow_tower_card' },
      { instanceId: 'arrow_b', cardId: 'arrow_tower_card' },
      { instanceId: 'arrow_c', cardId: 'arrow_tower_card' },
      { instanceId: 'arrow_d', cardId: 'arrow_tower_card' },
    ]);

    expect(options).toEqual([
      { id: 'arrow_b_2', instanceId: 'arrow_b', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
      { id: 'arrow_c_2', instanceId: 'arrow_c', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
      { id: 'arrow_d_2', instanceId: 'arrow_d', cardId: 'arrow_tower_card', title: '箭塔 Lv.2', description: '升级到 Lv.2' },
    ]);
  });

  it('buildUpgradeRewardOptions returns null when fewer than three upgradeable cards remain', () => {
    const run = makeManager(3);
    run.registerCardInstance('arrow_a', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_b', TEST_SKILL_TREE);
    run.registerCardInstance('arrow_c', TEST_SKILL_TREE);
    run.activateNode('arrow_a', 'arrow_lv2');
    run.activateNode('arrow_a', 'arrow_lv3');

    const options = run.buildUpgradeRewardOptions([
      { instanceId: 'arrow_a', cardId: 'arrow_tower_card' },
      { instanceId: 'arrow_b', cardId: 'arrow_tower_card' },
      { instanceId: 'arrow_c', cardId: 'arrow_tower_card' },
    ]);

    expect(options).toBeNull();
  });

  it('resetToIdle from Result returns to Idle and clears level/outcome', () => {
    const run = makeManager(1);
    run.startRun();
    run.enterBattle();
    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    run.resetToIdle();
    expect(run.phase).toBe(RunPhase.Idle);
    expect(run.currentLevel).toBe(0);
    expect(run.outcome).toBeNull();
  });

  it('rejects resetToIdle when not in Result', () => {
    const run = makeManager();
    expect(() => run.resetToIdle()).toThrow(/illegal transition/i);
  });
});
