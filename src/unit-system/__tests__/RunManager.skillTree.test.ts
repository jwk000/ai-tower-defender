/**
 * RunManager.skillTree.test.ts — TDD Red Phase
 *
 * 覆盖 v3.4 §8 RunManager 技能树接口：
 *   - activateNode(cardInstanceId, nodeId): boolean
 *   - equipPath(cardInstanceId, pathId): boolean
 *   - resolveCardEffects(cardInstanceId): Effect[]
 *   - resetSkillTreeState(): void
 *
 * 10 个错误码：
 *   activateNode 失败码：INSUFFICIENT_SP / INSTANCE_NOT_FOUND / NODE_NOT_FOUND / PREREQUISITE_NOT_MET / NODE_ALREADY_ACTIVE
 *   equipPath 失败码：INSTANCE_NOT_FOUND / PATH_NOT_FOUND / PATH_NOT_ACTIVATABLE / UNIT_DEPLOYED / ALREADY_EQUIPPED
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { RunManager } from '../RunManager.js';
import type { CardSkillTreeConfig } from '../SkillTreeState.js';

// MVP 技能树配置（仅用于测试，模拟箭塔两路径结构）
const ARROW_TOWER_SKILL_CONFIG: CardSkillTreeConfig = {
  unitCardId: 'arrow_tower',
  paths: [
    {
      id: 'multi_shot',
      name: '多重射击',
      nodes: [
        {
          id: 'arrow_basic',
          name: '普通箭塔',
          depth: 1,
          spCost: 0,
          prerequisites: [],
          effects: [],
        },
        {
          id: 'arrow_double',
          name: '双重箭塔',
          depth: 2,
          spCost: 6,
          prerequisites: ['arrow_basic'],
          effects: [{ rule: 'add_projectile_count', value: 1 }],
        },
        {
          id: 'arrow_triple',
          name: '三重箭塔',
          depth: 3,
          spCost: 10,
          prerequisites: ['arrow_double'],
          effects: [{ rule: 'add_projectile_count', value: 2 }],
        },
      ],
    },
    {
      id: 'rapid_fire',
      name: '高频火力',
      nodes: [
        {
          id: 'arrow_crossbow',
          name: '连弩箭塔',
          depth: 2,
          spCost: 6,
          prerequisites: ['arrow_basic'],
          effects: [{ rule: 'mul_attack_interval', value: 0.4 }],
        },
        {
          id: 'arrow_crossbow_fire',
          name: '连弩火箭塔',
          depth: 3,
          spCost: 10,
          prerequisites: ['arrow_crossbow'],
          effects: [{ rule: 'add_burning_on_hit', duration: 2.0, tickRatio: 0.2 }],
        },
      ],
    },
  ],
};

function makeManager(sp = 30): RunManager {
  const mgr = new RunManager({ totalLevels: 3, initialGold: 200, initialCrystalHp: 20 });
  mgr.startRun();
  // 给 SP
  mgr.grantSp(sp);
  return mgr;
}

// 注册卡实例到技能树
function registerInstance(mgr: RunManager, instanceId: string, config = ARROW_TOWER_SKILL_CONFIG): void {
  mgr.registerCardInstance(instanceId, config);
}

describe('RunManager.registerCardInstance', () => {
  it('注册卡实例后 getCardSkillTreeState 可以返回初始状态', () => {
    const mgr = makeManager();
    registerInstance(mgr, 'arrow_1');
    const state = mgr.getCardSkillTreeState('arrow_1');
    expect(state).not.toBeNull();
    expect(state?.unitCardId).toBe('arrow_tower');
    expect(state?.activeNodes.size).toBe(0);
    expect(state?.equippedPath).toBeNull();
  });

  it('未注册的实例 getCardSkillTreeState 返回 null', () => {
    const mgr = makeManager();
    expect(mgr.getCardSkillTreeState('nonexistent')).toBeNull();
  });
});

describe('RunManager.activateNode', () => {
  let mgr: RunManager;

  beforeEach(() => {
    mgr = makeManager(30);
    registerInstance(mgr, 'arrow_1');
  });

  it('成功点亮 depth=1 免费节点（spCost=0）', () => {
    const ok = mgr.activateNode('arrow_1', 'arrow_basic');
    expect(ok).toBe(true);
    expect(mgr.getCardSkillTreeState('arrow_1')?.activeNodes.has('arrow_basic')).toBe(true);
    expect(mgr.sp).toBe(30); // 不消耗 SP
  });

  it('成功点亮 depth=2 节点（前置已亮，SP 够）', () => {
    mgr.activateNode('arrow_1', 'arrow_basic');
    const ok = mgr.activateNode('arrow_1', 'arrow_double');
    expect(ok).toBe(true);
    expect(mgr.sp).toBe(24); // 消耗 6 SP
  });

  it('错误码 NODE_ALREADY_ACTIVE — 节点已点亮时返回 false', () => {
    mgr.activateNode('arrow_1', 'arrow_basic');
    expect(mgr.activateNode('arrow_1', 'arrow_basic')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('NODE_ALREADY_ACTIVE');
  });

  it('错误码 INSTANCE_NOT_FOUND — cardInstanceId 不存在', () => {
    expect(mgr.activateNode('nonexistent', 'arrow_basic')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('INSTANCE_NOT_FOUND');
  });

  it('错误码 NODE_NOT_FOUND — 节点 ID 不存在于配置', () => {
    expect(mgr.activateNode('arrow_1', 'no_such_node')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('NODE_NOT_FOUND');
  });

  it('错误码 PREREQUISITE_NOT_MET — 前置节点未点亮', () => {
    // arrow_double requires arrow_basic
    expect(mgr.activateNode('arrow_1', 'arrow_double')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('PREREQUISITE_NOT_MET');
  });

  it('错误码 INSUFFICIENT_SP — SP 不足', () => {
    const poorMgr = makeManager(2); // 只有 2 SP，点亮 arrow_double 需要 6 SP
    registerInstance(poorMgr, 'arrow_1');
    poorMgr.activateNode('arrow_1', 'arrow_basic'); // 免费
    expect(poorMgr.activateNode('arrow_1', 'arrow_double')).toBe(false);
    expect(poorMgr.lastSkillTreeError).toBe('INSUFFICIENT_SP');
  });

  it('跨路径独立点亮：点亮 rapid_fire 路径节点不影响 multi_shot 路径', () => {
    mgr.activateNode('arrow_1', 'arrow_basic'); // depth=1，multi_shot 路径起点
    // rapid_fire path 的 arrow_crossbow 也依赖 arrow_basic
    const ok = mgr.activateNode('arrow_1', 'arrow_crossbow');
    expect(ok).toBe(true);
    const state = mgr.getCardSkillTreeState('arrow_1');
    expect(state?.activeNodes.has('arrow_basic')).toBe(true);
    expect(state?.activeNodes.has('arrow_crossbow')).toBe(true);
  });
});

describe('RunManager.equipPath', () => {
  let mgr: RunManager;

  beforeEach(() => {
    mgr = makeManager(30);
    registerInstance(mgr, 'arrow_1');
    // 点亮 multi_shot 路径（depth=1）
    mgr.activateNode('arrow_1', 'arrow_basic');
    // 点亮 depth=2 节点
    mgr.activateNode('arrow_1', 'arrow_double');
  });

  it('成功装备已有节点点亮的路径（0 SP）', () => {
    const spBefore = mgr.sp;
    const ok = mgr.equipPath('arrow_1', 'multi_shot');
    expect(ok).toBe(true);
    expect(mgr.sp).toBe(spBefore); // 不消耗 SP
    expect(mgr.getCardSkillTreeState('arrow_1')?.equippedPath).toBe('multi_shot');
  });

  it('错误码 INSTANCE_NOT_FOUND — cardInstanceId 不存在', () => {
    expect(mgr.equipPath('nonexistent', 'multi_shot')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('INSTANCE_NOT_FOUND');
  });

  it('错误码 PATH_NOT_FOUND — 路径 ID 不存在', () => {
    expect(mgr.equipPath('arrow_1', 'no_such_path')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('PATH_NOT_FOUND');
  });

  it('错误码 PATH_NOT_ACTIVATABLE — 路径上无 depth>=2 节点已点亮', () => {
    // rapid_fire 路径没有任何节点点亮
    expect(mgr.equipPath('arrow_1', 'rapid_fire')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('PATH_NOT_ACTIVATABLE');
  });

  it('错误码 ALREADY_EQUIPPED — 已装备同路径', () => {
    mgr.equipPath('arrow_1', 'multi_shot');
    expect(mgr.equipPath('arrow_1', 'multi_shot')).toBe(false);
    expect(mgr.lastSkillTreeError).toBe('ALREADY_EQUIPPED');
  });

  it('切换装备到另一路径（需要目标路径有节点点亮）', () => {
    mgr.equipPath('arrow_1', 'multi_shot');
    // 点亮 rapid_fire
    mgr.activateNode('arrow_1', 'arrow_crossbow');
    const ok = mgr.equipPath('arrow_1', 'rapid_fire');
    expect(ok).toBe(true);
    expect(mgr.getCardSkillTreeState('arrow_1')?.equippedPath).toBe('rapid_fire');
  });
});

describe('RunManager.resolveCardEffects', () => {
  it('未装备路径时 resolveCardEffects 返回空数组', () => {
    const mgr = makeManager(30);
    registerInstance(mgr, 'arrow_1');
    mgr.activateNode('arrow_1', 'arrow_basic');
    const effects = mgr.resolveCardEffects('arrow_1');
    expect(effects).toEqual([]);
  });

  it('装备路径后 resolveCardEffects 返回合并的 effects', () => {
    const mgr = makeManager(30);
    registerInstance(mgr, 'arrow_1');
    mgr.activateNode('arrow_1', 'arrow_basic');
    mgr.activateNode('arrow_1', 'arrow_double');
    mgr.equipPath('arrow_1', 'multi_shot');
    const effects = mgr.resolveCardEffects('arrow_1');
    // depth=1 effects=[] + depth=2 effects=[{rule:'add_projectile_count', value:1}]
    expect(effects).toContainEqual({ rule: 'add_projectile_count', value: 1 });
  });

  it('只合并装备路径上已点亮节点的 effects（不含未装备路径）', () => {
    const mgr = makeManager(30);
    registerInstance(mgr, 'arrow_1');
    mgr.activateNode('arrow_1', 'arrow_basic');
    mgr.activateNode('arrow_1', 'arrow_double'); // multi_shot
    mgr.activateNode('arrow_1', 'arrow_crossbow'); // rapid_fire
    mgr.equipPath('arrow_1', 'rapid_fire');
    const effects = mgr.resolveCardEffects('arrow_1');
    // 只有 rapid_fire 路径的 effects
    expect(effects.some((e) => e.rule === 'mul_attack_interval')).toBe(true);
    // multi_shot 路径 effects 不应出现
    expect(effects.some((e) => e.rule === 'add_projectile_count')).toBe(false);
  });

  it('未知 cardInstanceId 时 resolveCardEffects 返回空数组', () => {
    const mgr = makeManager(30);
    expect(mgr.resolveCardEffects('nonexistent')).toEqual([]);
  });
});

describe('RunManager.resetSkillTreeState', () => {
  it('resetSkillTreeState 清空所有卡实例技能树状态', () => {
    const mgr = makeManager(30);
    registerInstance(mgr, 'arrow_1');
    mgr.activateNode('arrow_1', 'arrow_basic');
    mgr.activateNode('arrow_1', 'arrow_double');
    mgr.equipPath('arrow_1', 'multi_shot');

    mgr.resetSkillTreeState();

    // 实例状态被清零
    expect(mgr.getCardSkillTreeState('arrow_1')).toBeNull();
  });

  it('resetToIdle 时自动调用 resetSkillTreeState', () => {
    const mgr = makeManager(0);
    registerInstance(mgr, 'arrow_1');
    mgr.activateNode('arrow_1', 'arrow_basic');

    // 走到 Result 相位
    mgr.enterBattle();
    mgr.completeLevel(); // totalLevels=3 → InterLevel
    mgr.returnToLevelMap();
    mgr.enterBattle();
    mgr.completeLevel(); // level=2 → InterLevel
    mgr.returnToLevelMap();
    mgr.enterBattle();
    mgr.completeLevel(); // level=3 = totalLevels → Result

    mgr.resetToIdle();
    // Run 结束后技能树清零
    expect(mgr.getCardSkillTreeState('arrow_1')).toBeNull();
  });
});

describe('RunManager 多卡实例独立', () => {
  it('两张箭塔卡各自维护独立的技能树状态', () => {
    const mgr = makeManager(50);
    registerInstance(mgr, 'arrow_1');
    registerInstance(mgr, 'arrow_2');

    mgr.activateNode('arrow_1', 'arrow_basic');
    mgr.activateNode('arrow_1', 'arrow_double');
    mgr.equipPath('arrow_1', 'multi_shot');

    // arrow_2 不受影响
    const state2 = mgr.getCardSkillTreeState('arrow_2');
    expect(state2?.activeNodes.size).toBe(0);
    expect(state2?.equippedPath).toBeNull();
  });
});
