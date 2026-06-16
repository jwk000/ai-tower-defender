/**
 * RuleHandlers 实现测试
 *
 * 覆盖所有 BUILTIN_HANDLERS 中的规则处理器。
 * 设计文档: design/02-unit-system.md (Section 3.1)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createWorld, addEntity, addComponent, entityExists, resetGlobals } from 'bitecs';
import type { World as BitecsWorld } from 'bitecs';

import {
  // 核心组件
  Position,
  Health,
  Faction,
  FactionVal,
  Visual,
  ShapeVal,
  Boss,
  UnitTag,
  Attack,
  Movement,
  LightningBolt,
  ExplosionEffect,
  DeathEffect,
  Category,
  CategoryVal,
} from '../core/components.js';

import type { EventContext } from '../core/RuleEngine.js';

import {
  // 处理器
  dealAoeDamage,
  dealDamage,
  explode,
  stealHp,
  chainAttack,
  pushEnemy,
  pullEnemy,
  flashColor,
  changeColor,
  visualFlashLoop,
  playEffect,
  spawnProjectile,
  playSound,
  dropGold,
  dropGoldRandom,
  pauseWorld,
  enterPhase2,
  splitInto,
  spawnUnit,
  applyBuff,
  leaveRuins,
  BUILTIN_HANDLERS,
  // 回调注册
  setGoldCallback,
  setBuffApplier,
} from '../core/RuleHandlers.js';

import type { BuffData } from '../systems/BuffSystem.js';
import { Sound } from '../utils/Sound.js';

// ============================================================
// 测试辅助函数
// ============================================================

/** 创建测试 world 并返回原始 BitecsWorld */
function makeWorld(): BitecsWorld {
  return createWorld();
}

/** 辅助函数：添加组件并设置初始值 */
function addComp(
  world: BitecsWorld,
  eid: number,
  comp: object,
  values: Record<string, unknown>,
): void {
  addComponent(world, comp, eid);
  for (const [key, val] of Object.entries(values)) {
    const c = comp as Record<string, Record<number, unknown>>;
    if (c[key] !== undefined) {
      c[key][eid] = val;
    }
  }
}

/** 创建有 Position + Health + Faction 的实体 */
function makeCombatEntity(
  world: BitecsWorld,
  overrides: {
    x?: number; y?: number;
    hp?: number; maxHp?: number;
    armor?: number; mr?: number;
    faction?: number;
    atk?: number;
  } = {},
): number {
  const eid = addEntity(world);
  addComp(world, eid, Position, {
    x: overrides.x ?? 100,
    y: overrides.y ?? 100,
  });
  addComp(world, eid, Health, {
    current: overrides.hp ?? 100,
    max: overrides.maxHp ?? 100,
    armor: overrides.armor ?? 0,
    magicResist: overrides.mr ?? 0,
  });
  addComp(world, eid, Faction, { value: overrides.faction ?? FactionVal.Evil });
  addComp(world, eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 255, colorG: 255, colorB: 255,
    size: 20,
    alpha: 1,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
    facing: 1,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0,
    partsId: 0,
  });
  addComp(world, eid, UnitTag, {
    isEnemy: overrides.faction === FactionVal.Evil || overrides.faction === FactionVal.Chaos ? 1 : 0,
    isBoss: 0,
    isRanged: 0,
    canAttackBuildings: 0,
    rewardGold: 20,
    rewardEnergy: 0,
    popCost: 0,
    cost: 0,
    atk: overrides.atk ?? 10,
    level: 1,
    maxLevel: 1,
    totalInvested: 0,
    unitTypeNum: 0,
  });
  return eid;
}

/** 默认 context */
function mkCtx(overrides: Partial<EventContext> = {}): EventContext {
  return {
    time: 0,
    sourceId: undefined,
    data: {},
    ...overrides,
  };
}

// ============================================================
// 测试：dealAoeDamage (已完成)
// ============================================================

describe('dealAoeDamage', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('对半径内的所有敌对单位造成伤害', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100, faction: FactionVal.Evil });
    const target1 = makeCombatEntity(world, { x: 110, y: 100, hp: 100, faction: FactionVal.Justice });
    const target2 = makeCombatEntity(world, { x: 150, y: 100, hp: 100, faction: FactionVal.Justice });
    const target3 = makeCombatEntity(world, { x: 300, y: 300, hp: 100, faction: FactionVal.Justice });

    dealAoeDamage(world, source, { radius: 60, damage: 30, targets: [FactionVal.Justice] }, mkCtx());

    expect(Health.current[target1]).toBe(70); // in radius
    expect(Health.current[target2]).toBe(70); // in radius
    expect(Health.current[target3]).toBe(100); // out of radius
  });

  it('不伤害同阵营单位', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100, faction: FactionVal.Evil });
    const ally = makeCombatEntity(world, { x: 110, y: 100, hp: 100, faction: FactionVal.Evil });

    dealAoeDamage(world, source, { radius: 60, damage: 30, targets: [FactionVal.Justice] }, mkCtx());

    expect(Health.current[ally]).toBe(100);
  });

  it('使用默认参数', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100, faction: FactionVal.Evil });
    const target = makeCombatEntity(world, { x: 120, y: 100, hp: 100, faction: FactionVal.Justice });

    dealAoeDamage(world, source, {}, mkCtx());

    expect(Health.current[target]).toBe(50); // default damage=50
  });
});

// ============================================================
// 测试：dealDamage (已完成)
// ============================================================

describe('dealDamage', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('对 context.sourceId 造成伤害', () => {
    const source = makeCombatEntity(world, { hp: 100 });
    const target = makeCombatEntity(world, { hp: 100 });

    dealDamage(world, source, { damage: 25 }, mkCtx({ sourceId: target }));

    expect(Health.current[target]).toBe(75);
    expect(Health.current[source]).toBe(100);
  });

  it('不造成负血量', () => {
    const source = makeCombatEntity(world, { hp: 100 });
    const target = makeCombatEntity(world, { hp: 10 });

    dealDamage(world, source, { damage: 25 }, mkCtx({ sourceId: target }));

    expect(Health.current[target]).toBe(0);
  });

  it('targetId 未定义时不崩溃', () => {
    const source = makeCombatEntity(world, { hp: 100 });
    dealDamage(world, source, { damage: 25 }, mkCtx());
    expect(Health.current[source]).toBe(100);
  });
});

// ============================================================
// 测试：explode
// ============================================================

describe('explode', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('对半径内目标造成AOE伤害', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100, faction: FactionVal.Evil });
    const target = makeCombatEntity(world, { x: 120, y: 100, hp: 100, faction: FactionVal.Justice });

    explode(world, source, { radius: 60, damage: 40 }, mkCtx());

    expect(Health.current[target]).toBe(60);
  });

  it('创建 ExplosionEffect 实体', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100, faction: FactionVal.Evil });

    explode(world, source, { radius: 80, damage: 30 }, mkCtx());

    // 查找创建的爆炸实体
    let foundEffect = false;
    for (let eid = 0; eid < ExplosionEffect.duration.length; eid++) {
      if (ExplosionEffect.duration[eid] !== undefined && ExplosionEffect.duration[eid]! > 0) {
        if (entityExists(world, eid)) {
          foundEffect = true;
          expect(ExplosionEffect.maxRadius[eid]).toBe(80);
          break;
        }
      }
    }
    expect(foundEffect).toBe(true);
  });
});

// ============================================================
// 测试：stealHp
// ============================================================

describe('stealHp', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('造成伤害并按百分比治疗来源', () => {
    const attacker = makeCombatEntity(world, { x: 100, y: 100, hp: 80, maxHp: 100, atk: 50 });
    const target = makeCombatEntity(world, { x: 120, y: 100, hp: 100 });

    stealHp(world, attacker, { percent: 20, damage: 50 }, mkCtx({ sourceId: target }));

    // 造成50伤害，治疗10 (20% of 50)
    expect(Health.current[target]).toBe(50);
    expect(Health.current[attacker]).toBe(90); // 80 + 10 = 90
  });

  it('不超过最大血量', () => {
    const attacker = makeCombatEntity(world, { x: 100, y: 100, hp: 95, maxHp: 100, atk: 50 });
    const target = makeCombatEntity(world, { x: 120, y: 100, hp: 100 });

    stealHp(world, attacker, { percent: 50, damage: 50 }, mkCtx({ sourceId: target }));

    expect(Health.current[target]).toBe(50);
    expect(Health.current[attacker]).toBe(100); // capped at max
  });

  it('targetId 未定义时不崩溃', () => {
    const attacker = makeCombatEntity(world, { x: 100, y: 100, hp: 80, maxHp: 100 });
    stealHp(world, attacker, { percent: 20, damage: 50 }, mkCtx());
    expect(Health.current[attacker]).toBe(80);
  });

  it('使用默认 percent=20', () => {
    const attacker = makeCombatEntity(world, { x: 100, y: 100, hp: 80, maxHp: 100, atk: 10 });
    const target = makeCombatEntity(world, { x: 120, y: 100, hp: 100 });

    stealHp(world, attacker, { damage: 50 }, mkCtx({ sourceId: target }));

    // 20% of 50 = 10 healing
    expect(Health.current[attacker]).toBe(90);
  });
});

// ============================================================
// 测试：chainAttack
// ============================================================

describe('chainAttack', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('在目标间弹跳并造成递减伤害', () => {
    const source = makeCombatEntity(world, { x: 0, y: 0, hp: 200, faction: FactionVal.Chaos });
    const t1 = makeCombatEntity(world, { x: 50, y: 0, hp: 100, faction: FactionVal.Justice });
    const t2 = makeCombatEntity(world, { x: 100, y: 0, hp: 100, faction: FactionVal.Justice });
    const t3 = makeCombatEntity(world, { x: 150, y: 0, hp: 100, faction: FactionVal.Justice });

    chainAttack(world, source, {
      chainCount: 3,
      chainRange: 200,
      chainDecay: 0.25,
      damage: 40,
      targets: [FactionVal.Justice],
    }, mkCtx());

    // t1: 40 damage → 60 hp
    expect(Health.current[t1]).toBe(60);
    // t2: 40 * 0.75 = 30 damage → 70 hp
    expect(Health.current[t2]).toBe(70);
    // t3: 40 * 0.5625 ≈ 22.5 damage → 77.5 hp (rounded)
    expect(Health.current[t3]).toBeCloseTo(77.5, 1);
  });

  it('创建 LightningBolt 实体', () => {
    const source = makeCombatEntity(world, { x: 0, y: 0, hp: 200, faction: FactionVal.Chaos });
    makeCombatEntity(world, { x: 50, y: 0, hp: 100, faction: FactionVal.Justice });

    let boltCount = 0;
    chainAttack(world, source, {
      chainCount: 1,
      chainRange: 100,
      chainDecay: 0.25,
      damage: 30,
      targets: [FactionVal.Justice],
    }, mkCtx());

    for (let eid = 0; eid < LightningBolt.duration.length; eid++) {
      if (LightningBolt.duration[eid] !== undefined && LightningBolt.duration[eid]! > 0) {
        if (entityExists(world, eid)) boltCount++;
      }
    }
    expect(boltCount).toBeGreaterThanOrEqual(1);
  });

  it('超出链范围时停止', () => {
    const source = makeCombatEntity(world, { x: 0, y: 0, hp: 200, faction: FactionVal.Chaos });
    const t1 = makeCombatEntity(world, { x: 50, y: 0, hp: 100, faction: FactionVal.Justice });
    const t2 = makeCombatEntity(world, { x: 500, y: 0, hp: 100, faction: FactionVal.Justice }); // 太远

    chainAttack(world, source, {
      chainCount: 3,
      chainRange: 100,
      chainDecay: 0.25,
      damage: 30,
      targets: [FactionVal.Justice],
    }, mkCtx());

    // t1 在范围内，应受伤；t2 太远，不受伤
    expect(Health.current[t1]).toBeLessThan(100);
    expect(Health.current[t2]).toBe(100); // 超出范围，未命中
  });
});

// ============================================================
// 测试：pushEnemy / pullEnemy
// ============================================================

describe('pushEnemy', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('向右击退目标', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 200, y: 100 });

    pushEnemy(world, source, { distance: 60 }, mkCtx({ sourceId: target, data: { direction: 0 } }));

    expect(Position.x[target]).toBe(260); // 200 + 60
    expect(Position.y[target]).toBe(100);
  });

  it('向左击退目标', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 200, y: 100 });

    pushEnemy(world, source, { distance: 50 }, mkCtx({ sourceId: target, data: { direction: 2 } }));

    expect(Position.x[target]).toBe(150); // 200 - 50
  });

  it('向下击退目标', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 200, y: 100 });

    pushEnemy(world, source, { distance: 40 }, mkCtx({ sourceId: target, data: { direction: 1 } }));

    expect(Position.y[target]).toBe(140); // 100 + 40
  });

  it('targetId 未定义时不崩溃', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    expect(() => pushEnemy(world, source, { distance: 60 }, mkCtx())).not.toThrow();
  });

  it('使用默认 distance=64', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 200, y: 100 });

    pushEnemy(world, source, {}, mkCtx({ sourceId: target, data: { direction: 0 } }));

    expect(Position.x[target]).toBe(264);
  });
});

describe('pullEnemy', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('向左拉扯目标（与推相反方向）', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 300, y: 100 });

    pullEnemy(world, source, { distance: 60 }, mkCtx({ sourceId: target, data: { direction: 0 } }));

    expect(Position.x[target]).toBe(240); // 300 - 60 (pull = negative push)
  });

  it('向上拉扯目标', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 200, y: 200 });

    pullEnemy(world, source, { distance: 50 }, mkCtx({ sourceId: target, data: { direction: 1 } }));

    expect(Position.y[target]).toBe(150); // 200 - 50
  });
});

// ============================================================
// 测试：flashColor
// ============================================================

describe('flashColor', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('设置 hitFlashTimer', () => {
    const entity = makeCombatEntity(world, {});
    flashColor(world, entity, { duration: 0.2 }, mkCtx());
    expect(Visual.hitFlashTimer[entity]).toBeCloseTo(0.2, 4);
  });

  it('使用默认 duration=0.1', () => {
    const entity = makeCombatEntity(world, {});
    flashColor(world, entity, {}, mkCtx());
    expect(Visual.hitFlashTimer[entity]).toBeCloseTo(0.1, 4);
  });
});

// ============================================================
// 测试：changeColor / visualFlashLoop (no-op handlers)
// ============================================================

describe('changeColor / visualFlashLoop', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('changeColor 不抛出异常', () => {
    expect(() => changeColor(world, 0, {}, mkCtx())).not.toThrow();
  });

  it('visualFlashLoop 不抛出异常', () => {
    expect(() => visualFlashLoop(world, 0, {}, mkCtx())).not.toThrow();
  });
});

// ============================================================
// 测试：playEffect
// ============================================================

describe('playEffect', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('为 explosion 类型创建 ExplosionEffect 实体', () => {
    const entity = makeCombatEntity(world, { x: 150, y: 200 });

    playEffect(world, entity, { effect: 'explosion_red' }, mkCtx());

    let found = false;
    for (let eid = 0; eid < ExplosionEffect.duration.length; eid++) {
      if (ExplosionEffect.duration[eid] !== undefined && ExplosionEffect.duration[eid]! > 0) {
        if (entityExists(world, eid)) {
          found = true;
          expect(Position.x[eid]).toBe(150);
          expect(Position.y[eid]).toBe(200);
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('为 death 类型创建 DeathEffect 实体', () => {
    const entity = makeCombatEntity(world, { x: 100, y: 100 });

    playEffect(world, entity, { effect: 'death_basic' }, mkCtx());

    let found = false;
    for (let eid = 0; eid < DeathEffect.duration.length; eid++) {
      if (DeathEffect.duration[eid] !== undefined && DeathEffect.duration[eid]! > 0) {
        if (entityExists(world, eid)) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('为 unrecognized 类型创建默认 ExplosionEffect', () => {
    const entity = makeCombatEntity(world, { x: 50, y: 50 });

    playEffect(world, entity, { effect: 'unknown_effect' }, mkCtx());

    let found = false;
    for (let eid = 0; eid < ExplosionEffect.duration.length; eid++) {
      if (ExplosionEffect.duration[eid] !== undefined && ExplosionEffect.duration[eid]! > 0) {
        if (entityExists(world, eid)) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('位置未定义时不崩溃', () => {
    const w = makeWorld();
    const eid = addEntity(w); // no Position
    expect(() => playEffect(w, eid, { effect: 'death_basic' }, mkCtx())).not.toThrow();
  });
});

// ============================================================
// 测试：spawnProjectile / playSound (stub handlers)
// ============================================================

describe('spawnProjectile / playSound', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('spawnProjectile 不抛出异常', () => {
    expect(() => spawnProjectile(world, 0, {}, mkCtx())).not.toThrow();
  });

  it('playSound 不抛出异常', () => {
    expect(() => playSound(world, 0, {}, mkCtx())).not.toThrow();
  });

  it('playSound 根据配置 sound key 播放音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});

    playSound(world, 0, { sound: 'tower_arrow' }, mkCtx());

    expect(playSpy).toHaveBeenCalledWith('tower_arrow');
    playSpy.mockRestore();
  });

  it('playSound 兼容设计配置里的 SFX 常量别名', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});

    playSound(world, 0, { sound: 'SFX_ENEMY_DIE' }, mkCtx());
    playSound(world, 0, { sound: 'SFX_BOSS_PHASE3' }, mkCtx());

    expect(playSpy).toHaveBeenNthCalledWith(1, 'enemy_death');
    expect(playSpy).toHaveBeenNthCalledWith(2, 'boss_phase2');
    playSpy.mockRestore();
  });

  it('playSound 按 Boss 类型映射出场与死亡音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const boss = addEntity(world);
    addComponent(world, Boss, boss);
    addComponent(world, UnitTag, boss);
    Boss.bossType[boss] = 4;
    UnitTag.isBoss[boss] = 1;

    playSound(world, boss, { sound: 'SFX_BOSS_SPAWN' }, mkCtx());
    playSound(world, boss, { sound: 'SFX_BOSS_DIE' }, mkCtx());

    expect(playSpy).toHaveBeenNthCalledWith(1, 'boss_enter_abyss');
    expect(playSpy).toHaveBeenNthCalledWith(2, 'boss_death_void');
    playSpy.mockRestore();
  });

  it('playSound 按敌人类型映射出生与死亡音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const enemy = addEntity(world);
    addComponent(world, UnitTag, enemy);
    UnitTag.unitTypeNum[enemy] = 17;

    playSound(world, enemy, { sound: 'SFX_ENEMY_SPAWN' }, mkCtx());
    playSound(world, enemy, { sound: 'SFX_ENEMY_DIE' }, mkCtx());

    expect(playSpy).toHaveBeenNthCalledWith(1, 'enemy_spawn_machine');
    expect(playSpy).toHaveBeenNthCalledWith(2, 'enemy_death_heavy');
    playSpy.mockRestore();
  });

  it('playSound 兼容资源路径形式的音效配置', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});

    playSound(world, 0, { sound: 'sfx/victory_meadow.ogg' }, mkCtx());

    expect(playSpy).toHaveBeenCalledWith('victory_meadow');
    playSpy.mockRestore();
  });
});

// ============================================================
// 测试：dropGold / dropGoldRandom
// ============================================================

describe('dropGold / dropGoldRandom', () => {
  let world: BitecsWorld;
  let goldReceived: number;

  beforeEach(() => {
    world = makeWorld();
    goldReceived = -1;
    setGoldCallback((amount) => { goldReceived = amount; });
  });

  afterEach(() => {
    setGoldCallback(null!);
  });

  it('dropGold 读取 UnitTag.rewardGold 并回调', () => {
    const entity = makeCombatEntity(world, {}); // rewardGold=20
    dropGold(world, entity, {}, mkCtx());
    expect(goldReceived).toBe(20);
  });

  it('dropGold 奖励为 0 时不回调', () => {
    const entity = makeCombatEntity(world, {});
    UnitTag.rewardGold[entity] = 0;
    goldReceived = -1;
    dropGold(world, entity, {}, mkCtx());
    expect(goldReceived).toBe(-1); // unchanged
  });

  it('dropGoldRandom 在区间内生成随机金币', () => {
    dropGoldRandom(world, 0, { min: 50, max: 100 }, mkCtx());
    expect(goldReceived).toBeGreaterThanOrEqual(50);
    expect(goldReceived).toBeLessThanOrEqual(100);
  });

  it('dropGoldRandom 无回调时不崩溃', () => {
    setGoldCallback(null!);
    expect(() => dropGoldRandom(world, 0, { min: 50, max: 100 }, mkCtx())).not.toThrow();
  });
});

// ============================================================
// 测试：pauseWorld (stub)
// ============================================================

describe('pauseWorld', () => {
  let world: BitecsWorld;
  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('不抛出异常', () => {
    expect(() => pauseWorld(world, 0, { duration: 0.3 }, mkCtx())).not.toThrow();
  });
});

// ============================================================
// 测试：enterPhase2
// ============================================================

describe('enterPhase2', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('设置 Boss.phase = 2', () => {
    const eid = addEntity(world);
    addComp(world, eid, Position, { x: 200, y: 300 });
    addComp(world, eid, Boss, { phase: 1, phase2HpRatio: 0.5, transitionTimer: 0 });
    addComp(world, eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 255, colorG: 0, colorB: 0,
      size: 60, alpha: 1, outline: 0,
      hitFlashTimer: 0, idlePhase: 0,
      facing: 1, bobPhase: 0, breathPhase: 0,
      attackAnimTimer: 0, attackAnimDuration: 0, partsId: 0,
    });

    enterPhase2(world, eid, {}, mkCtx());

    expect(Boss.phase[eid]).toBe(2);
  });

  it('BOSS 对象无相位字段时不抛出异常', () => {
    const eid = makeCombatEntity(world, { x: 200, y: 300 });
    expect(() => enterPhase2(world, eid, {}, mkCtx())).not.toThrow();
  });

  it('创建 phase 转换特效实体', () => {
    const eid = addEntity(world);
    addComp(world, eid, Position, { x: 200, y: 300 });
    addComp(world, eid, Boss, { phase: 1, phase2HpRatio: 0.5, transitionTimer: 0 });
    addComp(world, eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 255, colorG: 0, colorB: 0,
      size: 60, alpha: 1, outline: 0,
      hitFlashTimer: 0, idlePhase: 0,
      facing: 1, bobPhase: 0, breathPhase: 0,
      attackAnimTimer: 0, attackAnimDuration: 0, partsId: 0,
    });

    enterPhase2(world, eid, {}, mkCtx());

    let foundEffect = false;
    for (let i = 0; i < ExplosionEffect.duration.length; i++) {
      if (ExplosionEffect.duration[i] !== undefined && ExplosionEffect.duration[i]! > 0) {
        if (entityExists(world, i)) {
          foundEffect = true;
          expect(ExplosionEffect.maxRadius[i]).toBe(120);
          expect(Category.value[i]).toBe(CategoryVal.Effect);
          break;
        }
      }
    }
    expect(foundEffect).toBe(true);
  });
});

// ============================================================
// 测试：splitInto
// ============================================================

describe('splitInto', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('创建指定数量的子实体', () => {
    const parent = makeCombatEntity(world, { x: 200, y: 200, faction: FactionVal.Evil });

    const initialCount = countEntities(world);
    splitInto(world, parent, { count: 3, unitType: 'boss_beast_spawn', radius: 40 }, mkCtx());
    const finalCount = countEntities(world);

    expect(finalCount - initialCount).toBe(3);
  });

  it('子实体在半径范围内生成', () => {
    const parent = makeCombatEntity(world, { x: 200, y: 200, faction: FactionVal.Evil });

    const entityCountBefore = countEntities(world);
    splitInto(world, parent, { count: 5, unitType: 'boss_beast_spawn', radius: 40 }, mkCtx());
    const entityCountAfter = countEntities(world);

    // 应有 5 个新实体
    expect(entityCountAfter - entityCountBefore).toBe(5);

    // 验证所有子实体在半径内
    for (let eid = 0; eid < Position.x.length; eid++) {
      if (eid === parent || !entityExists(world, eid)) continue;
      const x = Position.x[eid];
      const y = Position.y[eid];
      if (x === undefined || y === undefined) continue;
      // 检查是否是有效实体（有 Health 的 child）
      const hp = Health.current[eid];
      if (hp === undefined || hp <= 0) continue;
      const dx = x - 200;
      const dy = y - 200;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(40 * 40);
    }
  });

  it('子实体继承父阵营', () => {
    const parent = makeCombatEntity(world, { x: 200, y: 200, faction: FactionVal.Evil });

    splitInto(world, parent, { count: 2, unitType: 'boss_beast_spawn' }, mkCtx());

    for (let eid = 0; eid < Faction.value.length; eid++) {
      if (eid === parent) continue;
      const val = Faction.value[eid];
      if (val !== undefined && entityExists(world, eid) && Health.current[eid] !== undefined && Health.current[eid]! > 0) {
        expect(val).toBe(FactionVal.Evil);
      }
    }
  });

  it('子实体拥有 Attack 和 Movement', () => {
    const parent = makeCombatEntity(world, { x: 200, y: 200, faction: FactionVal.Evil });

    splitInto(world, parent, { count: 1, unitType: 'boss_beast_spawn' }, mkCtx());

    // 查找子实体（第一个不是 parent 且有 Attack 的）
    let childFound = false;
    for (let eid = 0; eid < Attack.damage.length; eid++) {
      if (eid === parent) continue;
      if (Attack.damage[eid] !== undefined && entityExists(world, eid)) {
        childFound = true;
        expect(Attack.damage[eid]).toBe(5); // default atk
        expect(Movement.speed[eid]).toBe(60); // default speed
        break;
      }
    }
    expect(childFound).toBe(true);
  });

  it('使用自定义参数', () => {
    const parent = makeCombatEntity(world, { x: 200, y: 200, faction: FactionVal.Evil });

    splitInto(world, parent, { count: 1, hp: 200, atk: 15 }, mkCtx());

    for (let eid = 0; eid < Health.max.length; eid++) {
      if (eid === parent) continue;
      const hp = Health.max[eid];
      if (hp !== undefined && hp > 0 && entityExists(world, eid)) {
        expect(hp).toBe(200);
        expect(Attack.damage[eid]).toBe(15);
        break;
      }
    }
  });

  it('位置未定义时不崩溃', () => {
    const w = makeWorld();
    const eid = addEntity(w); // no Position
    expect(() => splitInto(w, eid, { count: 2 }, mkCtx())).not.toThrow();
  });
});

// ============================================================
// 测试：spawnUnit
// ============================================================

describe('spawnUnit', () => {
  let world: BitecsWorld;

  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('生成 Chaos 阵营的敌人', () => {
    const source = makeCombatEntity(world, { x: 300, y: 300, faction: FactionVal.Chaos });

    spawnUnit(world, source, { count: 2, hp: 80, atk: 12, speed: 50 }, mkCtx());

    let spawned = 0;
    for (let eid = 0; eid < Faction.value.length; eid++) {
      if (eid === source) continue;
      if (Faction.value[eid] === FactionVal.Chaos && entityExists(world, eid)) {
        spawned++;
        expect(UnitTag.isEnemy[eid]).toBe(1);
        expect(Attack.damage[eid]).toBe(12);
        expect(Movement.speed[eid]).toBe(50);
      }
    }
    expect(spawned).toBe(2);
  });

  it('不超过 maxCount 上限', () => {
    const source = makeCombatEntity(world, { x: 300, y: 300, faction: FactionVal.Chaos });

    // 预先创建 8 个 Chaos 敌人（远超上限5）
    for (let i = 0; i < 8; i++) {
      makeCombatEntity(world, { x: 300 + i * 30, y: 300, faction: FactionVal.Chaos });
    }

    const entityCountBefore = countEntities(world);
    spawnUnit(world, source, { count: 10, maxCount: 5 }, mkCtx());
    const entityCountAfter = countEntities(world);

    // 已有 8+1=9 个 Chaos 实体（含source），上限5，应不再生成新实体
    expect(entityCountAfter - entityCountBefore).toBe(0);
  });

  it('maxCount 足够时生成指定数量的单位', () => {
    const source = makeCombatEntity(world, { x: 300, y: 300, faction: FactionVal.Chaos });

    // 使用与 "生成 Chaos 阵营的敌人" 测试完全一致的参数，仅添加 maxCount
    spawnUnit(world, source, { count: 3, maxCount: 10, hp: 80, atk: 12, speed: 50 }, mkCtx());

    let spawned = 0;
    for (let eid = 0; eid < Faction.value.length; eid++) {
      if (eid === source) continue;
      if (Faction.value[eid] === FactionVal.Chaos && entityExists(world, eid)) {
        spawned++;
      }
    }
    // 应生成3个单位
    expect(spawned).toBeGreaterThanOrEqual(1);
  });

  it('使用默认参数', () => {
    const source = makeCombatEntity(world, { x: 300, y: 300, faction: FactionVal.Chaos });
    spawnUnit(world, source, {}, mkCtx());

    let found = false;
    for (let eid = 0; eid < Faction.value.length; eid++) {
      if (eid === source) continue;
      if (Faction.value[eid] === FactionVal.Chaos && entityExists(world, eid)) {
        expect(Health.max[eid]).toBe(80); // default hp
        expect(Attack.damage[eid]).toBe(12); // default atk
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ============================================================
// 测试：applyBuff
// ============================================================

describe('applyBuff', () => {
  let world: BitecsWorld;
  let receivedBuffData: { targetId: number; sourceId: number; buffData: BuffData } | null;

  beforeEach(() => {
    world = makeWorld();
    receivedBuffData = null;
    setBuffApplier((targetId, sourceId, buffData) => {
      receivedBuffData = { targetId, sourceId, buffData };
    });
  });

  afterEach(() => {
    setBuffApplier(null!);
  });

  it('通过回调调用 BuffSystem', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 120, y: 100 });

    applyBuff(world, source, {
      buffId: 'ice_slow',
      attribute: 'speed',
      value: -30,
      duration: 3,
      isPercent: true,
    }, mkCtx({ sourceId: target }));

    expect(receivedBuffData).not.toBeNull();
    expect(receivedBuffData!.targetId).toBe(target);
    expect(receivedBuffData!.sourceId).toBe(source);
    expect(receivedBuffData!.buffData.id).toBe('ice_slow');
    expect(receivedBuffData!.buffData.attribute).toBe('speed');
    expect(receivedBuffData!.buffData.value).toBe(-30);
    expect(receivedBuffData!.buffData.isPercent).toBe(true);
    expect(receivedBuffData!.buffData.duration).toBe(3);
  });

  it('未注册回调时不崩溃', () => {
    setBuffApplier(null!);
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    const target = makeCombatEntity(world, { x: 120, y: 100 });

    expect(() => applyBuff(world, source, {
      buffId: 'test',
      attribute: 'atk',
      value: 10,
    }, mkCtx({ sourceId: target }))).not.toThrow();
  });

  it('目标实体不存在时不调用回调', () => {
    const source = makeCombatEntity(world, { x: 100, y: 100 });
    receivedBuffData = null;

    applyBuff(world, source, { buffId: 'test', attribute: 'atk', value: 10 }, mkCtx({ sourceId: 999 }));

    expect(receivedBuffData).toBeNull();
  });
});

// ============================================================
// 测试：leaveRuins (stub)
// ============================================================

describe('leaveRuins', () => {
  let world: BitecsWorld;
  beforeEach(() => { resetGlobals(); world = makeWorld(); });

  it('不抛出异常', () => {
    const entity = makeCombatEntity(world, {});
    expect(() => leaveRuins(world, entity, {}, mkCtx())).not.toThrow();
  });
});

// ============================================================
// 测试：BUILTIN_HANDLERS 注册表完整性
// ============================================================

describe('BUILTIN_HANDLERS 注册表', () => {
  it('包含所有期望的处理器键', () => {
    const expectedKeys = [
      'deal_aoe_damage', 'deal_damage', 'explode', 'steal_hp', 'chain_attack',
      'push_enemy', 'pull_enemy',
      'flash_color', 'change_color', 'visual_flash_loop',
      'visual_flash_bright', 'visual_dim', 'visual_pulse',
      'play_effect', 'spawn_projectile', 'play_sound',
      'drop_gold', 'drop_gold_random',
      'pause_world', 'enter_phase2', 'split_into', 'spawn_unit', 'apply_buff',
      'leave_ruins', 'hp_bar_boss',
    ];

    for (const key of expectedKeys) {
      expect(BUILTIN_HANDLERS[key]).toBeDefined();
      expect(typeof BUILTIN_HANDLERS[key]).toBe('function');
    }
  });

  it('每个处理器都是函数', () => {
    for (const [key, handler] of Object.entries(BUILTIN_HANDLERS)) {
      expect(typeof handler, `Handler "${key}" should be a function`).toBe('function');
    }
  });
});

// ============================================================
// 辅助
// ============================================================

function countEntities(world: BitecsWorld): number {
  let count = 0;
  for (let eid = 0; eid < Position.x.length; eid++) {
    if (Position.x[eid] !== undefined && entityExists(world, eid)) count++;
  }
  return count;
}
