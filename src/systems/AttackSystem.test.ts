/**
 * AttackSystem 测试 — P1-#12 弹道层级穿透规则 + v4.0 阵营过滤
 *
 * 对应设计文档:
 * - design/03-units.md §2.0 低空攻击规则
 * - design/02-gameplay.md §6.2 4阵营交互规则矩阵
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AttackSystem, doLaserAttack, findEnemiesInRange, hasActiveLaserBeam } from './AttackSystem.js';
import { TowerWorld } from '../core/World.js';
import {
  Faction,
  FactionVal,
  Health,
  Position,
  Attack,
  LaserBeam,
  Tower,
  UnitTag,
  Layer,
  LayerVal,
  DamageTypeVal,
} from '../core/components.js';
import { ruleEngine } from '../core/RuleEngine.js';
import { BUILTIN_HANDLERS } from '../core/RuleHandlers.js';
import { Sound } from '../utils/Sound.js';

describe('AttackSystem.canAttackLayer (P1-#12)', () => {
  describe('Ground attacker', () => {
    it('近战地面单位可以攻击 Ground 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.Ground, false)).toBe(true);
    });

    it('近战地面单位可以攻击 AboveGrid 目标 (地刺)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.AboveGrid, false)).toBe(true);
    });

    it('近战地面单位无法攻击 LowAir 目标 (飞行敌)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.LowAir, false)).toBe(false);
    });

    it('远程地面单位没有对空能力时无法攻击 LowAir 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.LowAir, true, false)).toBe(false);
    });

    it('远程地面单位有对空能力时可以攻击 LowAir 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.LowAir, true, true)).toBe(true);
    });

    it('远程地面塔可以攻击 Ground 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.Ground, true)).toBe(true);
    });

    it('远程地面塔无法攻击 Space 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.Space, true)).toBe(false);
    });

    it('远程地面塔无法攻击 BelowGrid 目标 (地下层)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.BelowGrid, true)).toBe(false);
    });

    it('近战地面单位无法攻击 BelowGrid 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Ground, LayerVal.BelowGrid, false)).toBe(false);
    });
  });

  describe('AboveGrid attacker (陷阱)', () => {
    it('近战 AboveGrid 单位可攻击同层目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.AboveGrid, LayerVal.AboveGrid, false)).toBe(true);
    });

    it('近战 AboveGrid 单位无法攻击 LowAir 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.AboveGrid, LayerVal.LowAir, false)).toBe(false);
    });

    it('远程 AboveGrid 单位没有对空能力时无法攻击 LowAir 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.AboveGrid, LayerVal.LowAir, true, false)).toBe(false);
    });
  });

  describe('LowAir attacker (蝙蝠、飞行敌)', () => {
    it('LowAir 单位可攻击 LowAir 同层目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.LowAir, false)).toBe(true);
    });

    it('LowAir 单位可攻击 Ground 目标 (俯冲)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Ground, false)).toBe(true);
    });

    it('LowAir 单位可攻击 AboveGrid 目标 (俯冲)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.AboveGrid, false)).toBe(true);
    });

    it('LowAir 单位无法攻击 Space 目标', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Space, true)).toBe(false);
    });

    it('LowAir 单位的 isRanged 不改变可达性 (LowAir 平台优势)', () => {
      const meleeReach = AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Ground, false);
      const rangedReach = AttackSystem.canAttackLayer(LayerVal.LowAir, LayerVal.Ground, true);
      expect(meleeReach).toBe(rangedReach);
    });
  });

  describe('未知层级 (Abyss/Space)', () => {
    it('Abyss 攻击者默认放行 (未来扩展点)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Abyss, LayerVal.Ground, true)).toBe(true);
    });

    it('Space 攻击者默认放行 (未来扩展点)', () => {
      expect(AttackSystem.canAttackLayer(LayerVal.Space, LayerVal.Ground, true)).toBe(true);
    });
  });

  describe('回归保护 — design/18 §5.2 矩阵全表', () => {
    const cases: Array<[number, number, boolean, boolean, string]> = [
      [LayerVal.Ground, LayerVal.Ground, false, true, 'Ground 近战 → Ground'],
      [LayerVal.Ground, LayerVal.AboveGrid, false, true, 'Ground 近战 → AboveGrid'],
      [LayerVal.Ground, LayerVal.LowAir, false, false, 'Ground 近战 → LowAir (禁)'],
      [LayerVal.Ground, LayerVal.LowAir, true, false, 'Ground 远程无对空 → LowAir (禁)'],
      [LayerVal.Ground, LayerVal.Space, true, false, 'Ground 远程 → Space (禁)'],
      [LayerVal.LowAir, LayerVal.Ground, false, true, 'LowAir → Ground'],
      [LayerVal.LowAir, LayerVal.LowAir, false, true, 'LowAir → LowAir'],
      [LayerVal.LowAir, LayerVal.Space, true, false, 'LowAir → Space (禁)'],
    ];

    for (const [attacker, target, ranged, expected, name] of cases) {
      it(name, () => {
        expect(AttackSystem.canAttackLayer(attacker, target, ranged)).toBe(expected);
      });
    }
  });
});

describe('doLaserAttack — 激光塔单束锁敌', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
  });

  function makeLaserTower(damage: number): number {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Tower, { towerType: 4, level: 1, totalInvested: 125 });
    world.addComponent(towerId, Attack, {
      damage,
      attackSpeed: 0.5,
      range: 250,
      alertRange: 500,
      damageType: DamageTypeVal.Magic,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      isRanged: 1,
      canTargetLowAir: 1,
    });
    return towerId;
  }

  function activeLaserBeamsFor(towerId: number): number[] {
    const result: number[] = [];
    for (let eid = 1; eid < LaserBeam.sourceId.length; eid++) {
      if (LaserBeam.sourceId[eid] !== towerId) continue;
      if ((LaserBeam.elapsed[eid] ?? 0) < (LaserBeam.duration[eid] ?? 0)) {
        result.push(eid);
      }
    }
    return result;
  }

  it('同一座塔已有存活光束时不会再生成第二束', () => {
    const towerId = makeLaserTower(6);
    const near = makeAttackable(world, 40, 0, FactionVal.Evil, 100);
    const far = makeAttackable(world, 80, 0, FactionVal.Evil, 100);

    doLaserAttack(world, towerId, [{ id: near, dist: 40 }, { id: far, dist: 80 }], 5);
    doLaserAttack(world, towerId, [{ id: far, dist: 80 }, { id: near, dist: 40 }], 5);

    const beams = activeLaserBeamsFor(towerId);
    expect(beams).toHaveLength(1);
    expect(LaserBeam.targetId[beams[0]!]!).toBe(near);
    expect(hasActiveLaserBeam(world, towerId)).toBe(true);
  });

  it('光束伤害上限读取塔当前攻击力，升级后下一束上限提高', () => {
    const towerId = makeLaserTower(6);
    const target = makeAttackable(world, 40, 0, FactionVal.Evil, 100);

    doLaserAttack(world, towerId, [{ id: target, dist: 40 }], 1);
    const firstBeam = activeLaserBeamsFor(towerId)[0]!;
    expect(LaserBeam.maxDamage[firstBeam]).toBe(6);

    LaserBeam.elapsed[firstBeam] = LaserBeam.duration[firstBeam]!;
    Attack.damage[towerId] = 12;

    doLaserAttack(world, towerId, [{ id: target, dist: 40 }], 2);
    const activeBeams = activeLaserBeamsFor(towerId);
    expect(activeBeams).toHaveLength(1);
    expect(LaserBeam.maxDamage[activeBeams[0]!]!).toBe(12);
  });
});

// ============================================================
// v4.0 阵营过滤测试 — isValidTarget / findEnemiesInRange
// ============================================================

/** 创建一个带 Faction + Position + Health + Layer + Attack + UnitTag 的实体 */
function makeAttackable(
  world: TowerWorld,
  x: number,
  y: number,
  faction: number = FactionVal.Evil,
  hp: number = 100,
  layer: number = LayerVal.Ground,
  isRanged: 0 | 1 = 0,
  canTargetLowAir: 0 | 1 = 0,
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Faction, { value: faction });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, { isEnemy: 1, isBoss: 0, isRanged: 0, canAttackBuildings: 0, rewardGold: 0, rewardEnergy: 0, popCost: 0, cost: 0 });
  world.addComponent(eid, Layer, { value: layer });
  world.addComponent(eid, Attack, { damage: 10, attackSpeed: 1, range: 100, alertRange: 150, damageType: 0, cooldownTimer: 0, targetId: 0, targetSelection: 0, attackMode: 0, isRanged, canTargetLowAir });
  return eid;
}

describe('AttackSystem.isValidTarget — 阵营过滤 + 存活 + 层级', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
  });

  describe('阵营敌对性', () => {
    it('Justice 可以攻击 Evil (不同非中立阵营 → 敌对)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });

    it('Justice 可以攻击 Chaos (不同非中立阵营 → 敌对)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice);
      const target = makeAttackable(world, 50, 0, FactionVal.Chaos);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });

    it('Justice 不可以攻击 Neutral (中立不可攻击)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice);
      const target = makeAttackable(world, 50, 0, FactionVal.Neutral);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(false);
    });

    it('Justice 不可以攻击 Justice (同阵营友好)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice);
      const target = makeAttackable(world, 50, 0, FactionVal.Justice);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(false);
    });

    it('Evil 可以攻击 Justice', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Evil);
      const target = makeAttackable(world, 50, 0, FactionVal.Justice);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });

    it('Evil 不可以攻击 Evil (同阵营友好)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Evil);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(false);
    });

    it('Chaos 可以攻击 Chaos (混乱内斗)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Chaos);
      const target = makeAttackable(world, 50, 0, FactionVal.Chaos);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });

    it('Chaos 可以攻击 Justice', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Chaos);
      const target = makeAttackable(world, 50, 0, FactionVal.Justice);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });

    it('Chaos 可以攻击 Evil', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Chaos);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });

    it('Neutral 不可以攻击任何阵营 (Neutral 从不敌对)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Neutral);
      const justice = makeAttackable(world, 50, 0, FactionVal.Justice);
      const evil = makeAttackable(world, 100, 0, FactionVal.Evil);
      const chaos = makeAttackable(world, 150, 0, FactionVal.Chaos);
      expect(AttackSystem.isValidTarget(world, attacker, justice)).toBe(false);
      expect(AttackSystem.isValidTarget(world, attacker, evil)).toBe(false);
      expect(AttackSystem.isValidTarget(world, attacker, chaos)).toBe(false);
    });

    it('任何阵营不可以攻击 Neutral (中立不可被攻击)', () => {
      const neutral = makeAttackable(world, 50, 0, FactionVal.Neutral);
      const justice = makeAttackable(world, 0, 0, FactionVal.Justice);
      const evil = makeAttackable(world, 100, 0, FactionVal.Evil);
      const chaos = makeAttackable(world, 150, 0, FactionVal.Chaos);
      expect(AttackSystem.isValidTarget(world, justice, neutral)).toBe(false);
      expect(AttackSystem.isValidTarget(world, evil, neutral)).toBe(false);
      expect(AttackSystem.isValidTarget(world, chaos, neutral)).toBe(false);
    });
  });

  describe('存活检查', () => {
    it('目标已死亡 (HP <= 0) 时返回 false', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil, 0); // 0 HP = dead
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(false);
    });

    it('目标 HP > 0 且阵营敌对时返回 true', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil, 50);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });
  });

  describe('层级可达性', () => {
    it('Ground 近战无法攻击 LowAir (层级阻断)', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice, 100, LayerVal.Ground, 0);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil, 100, LayerVal.LowAir, 0);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(false);
    });

    it('Ground 远程没有对空能力时无法攻击 LowAir', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice, 100, LayerVal.Ground, 1, 0);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil, 100, LayerVal.LowAir, 0);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(false);
    });

    it('Ground 远程有对空能力时可以攻击 LowAir', () => {
      const attacker = makeAttackable(world, 0, 0, FactionVal.Justice, 100, LayerVal.Ground, 1, 1);
      const target = makeAttackable(world, 50, 0, FactionVal.Evil, 100, LayerVal.LowAir, 0);
      expect(AttackSystem.isValidTarget(world, attacker, target)).toBe(true);
    });
  });
});

describe('findEnemiesInRange — 阵营过滤', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
  });

  it('只返回阵营敌对的目标', () => {
    // Justice tower at origin
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Attack, { damage: 10, attackSpeed: 1, range: 100, alertRange: 150, damageType: 0, cooldownTimer: 0, targetId: 0, targetSelection: 0, attackMode: 0, isRanged: 1, canTargetLowAir: 1 });

    // Evil in range → should be included
    const evilInRange = makeAttackable(world, 50, 0, FactionVal.Evil, 100);
    // Chaos in range → should be included
    const chaosInRange = makeAttackable(world, -30, 0, FactionVal.Chaos, 100);
    // Neutral in range → should be EXCLUDED
    const neutralInRange = makeAttackable(world, 0, 50, FactionVal.Neutral, 100);
    // Justice in range → should be EXCLUDED (same faction)
    const justiceInRange = makeAttackable(world, 0, -50, FactionVal.Justice, 100);

    const result = findEnemiesInRange(world, towerId, 200);
    const ids = result.map((r) => r.id);

    expect(ids).toContain(evilInRange);
    expect(ids).toContain(chaosInRange);
    expect(ids).not.toContain(neutralInRange);
    expect(ids).not.toContain(justiceInRange);
  });

  it('排除已死亡的目标', () => {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });

    const deadEvil = makeAttackable(world, 50, 0, FactionVal.Evil, 0); // dead
    const aliveEvil = makeAttackable(world, 50, 0, FactionVal.Evil, 100); // alive

    const result = findEnemiesInRange(world, towerId, 200);
    const ids = result.map((r) => r.id);

    expect(ids).not.toContain(deadEvil);
    expect(ids).toContain(aliveEvil);
  });

  it('Chaos tower 可以攻击 Chaos target (混乱内斗)', () => {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Chaos });

    const otherChaos = makeAttackable(world, 50, 0, FactionVal.Chaos, 100);

    const result = findEnemiesInRange(world, towerId, 200);
    const ids = result.map((r) => r.id);

    expect(ids).toContain(otherChaos);
  });

  it('结果按距离升序排列', () => {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });

    const far = makeAttackable(world, 100, 0, FactionVal.Evil, 100);
    const near = makeAttackable(world, 10, 0, FactionVal.Evil, 100);
    const mid = makeAttackable(world, 50, 0, FactionVal.Evil, 100);

    const result = findEnemiesInRange(world, towerId, 200);
    const ids = result.map((r) => r.id);

    expect(ids).toEqual([near, mid, far]);
  });
});

describe('AttackSystem — 配置驱动攻击音效', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
    ruleEngine.reset();
    ruleEngine.registerHandlers(BUILTIN_HANDLERS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ruleEngine.reset();
  });

  it('塔成功开火时派发 onAttack 并播放 YAML 配置的音效', () => {
    const playSpy = vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Layer, { value: LayerVal.Ground });
    world.addComponent(towerId, Tower, { towerType: 0, level: 1, totalInvested: 50 });
    world.addComponent(towerId, Attack, {
      damage: 10,
      attackSpeed: 1,
      range: 200,
      alertRange: 400,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      isRanged: 1,
      canTargetLowAir: 1,
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
    });
    world.addComponent(towerId, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
    ruleEngine.registerEntityConfig(towerId, 'arrow_tower');
    ruleEngine.registerLifecycleRules('arrow_tower', new Map([
      ['onAttack', [{ type: 'play_sound', sound: 'tower_arrow' }]],
    ]));

    makeAttackable(world, 80, 0, FactionVal.Evil, 100);

    new AttackSystem().update(world, 1 / 60);

    expect(playSpy).toHaveBeenCalledWith('tower_arrow');
  });
});
