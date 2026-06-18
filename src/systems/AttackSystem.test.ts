/**
 * AttackSystem 测试 — P1-#12 弹道层级穿透规则 + v4.0 阵营过滤
 *
 * 对应设计文档:
 * - design/03-units.md §2.0 低空攻击规则
 * - design/02-gameplay.md §6.2 4阵营交互规则矩阵
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AttackSystem,
  doLaserAttack,
  doLightningAttack,
  findEnemiesInRange,
  findLightningStormTarget,
  hasActiveLaserBeam,
  LASER_BEAM_DURATION,
  triggerLightningStorm,
  updateLightningStormSkill,
} from './AttackSystem.js';
import { TowerWorld } from '../core/World.js';
import {
  defineQuery,
  Faction,
  FactionVal,
  Health,
  Position,
  Attack,
  LaserBeam,
  LightningBolt,
  LightningStorm,
  ScreenShake,
  Tower,
  UnitTag,
  Layer,
  LayerVal,
  DamageTypeVal,
  Projectile,
  Boss,
} from '../core/components.js';
import { ruleEngine } from '../core/RuleEngine.js';
import { BUILTIN_HANDLERS } from '../core/RuleHandlers.js';
import { Sound } from '../utils/Sound.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { TileType, TowerType, UnitType, type MapConfig } from '../types/index.js';
import { cardCanCounterLowAir, soldierCanTargetLowAir, towerCanTargetLowAir } from '../utils/lowAirTargeting.js';

const lightningStormQuery = defineQuery([LightningStorm]);
const screenShakeQuery = defineQuery([ScreenShake]);
const projectileQuery = defineQuery([Projectile]);

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

describe('LowAir targeting whitelist', () => {
  it('冰塔、火塔、毒塔都可以主动攻击 LowAir 单位', () => {
    for (const towerType of [TowerType.Ice, TowerType.Fire, TowerType.Poison]) {
      expect(towerCanTargetLowAir(towerType)).toBe(true);
      expect(TOWER_CONFIGS[towerType].canTargetLowAir).toBe(true);
    }

    for (const cardId of ['card_ice_tower', 'card_fire_tower', 'card_poison_tower']) {
      expect(cardCanCounterLowAir(cardId)).toBe(true);
    }
  });

  it('弓手、法师都可以主动攻击 LowAir 单位', () => {
    for (const unitType of [UnitType.Archer, UnitType.Mage]) {
      expect(soldierCanTargetLowAir(unitType)).toBe(true);
    }

    for (const cardId of ['card_archer', 'card_mage']) {
      expect(cardCanCounterLowAir(cardId)).toBe(true);
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

  it('新光束初始伤害为上限的50%，持续时长保持5秒', () => {
    const towerId = makeLaserTower(20);
    const target = makeAttackable(world, 40, 0, FactionVal.Evil, 100);

    doLaserAttack(world, towerId, [{ id: target, dist: 40 }], 1);

    const beam = activeLaserBeamsFor(towerId)[0]!;
    expect(LaserBeam.damage[beam]).toBe(10);
    expect(LaserBeam.duration[beam]).toBe(LASER_BEAM_DURATION);
  });
});

describe('doLightningAttack — 电塔线性弹跳成长', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
  });

  function makeLightningTower(damage: number): number {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Layer, { value: LayerVal.Ground });
    world.addComponent(towerId, Tower, { towerType: 3, level: 1, totalInvested: 110 });
    world.addComponent(towerId, Attack, {
      damage,
      attackSpeed: 0.9,
      range: 170,
      alertRange: 340,
      damageType: DamageTypeVal.Magic,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      isRanged: 1,
      canTargetLowAir: 1,
      splashRadius: 0,
      chainCount: 3,
      chainRange: 120,
      chainDecay: 0.2,
    });
    world.addComponent(towerId, Health, { current: 1800, max: 1800, armor: 0, magicResist: 0 });
    return towerId;
  }

  function makeEnemyLine(count: number): number[] {
    return Array.from({ length: count }, (_, index) => (
      makeAttackable(world, 60 + index * 40, 0, FactionVal.Evil, 100)
    ));
  }

  function activeLightningBoltsFor(towerId: number): number[] {
    const result: number[] = [];
    let currentSourceId = towerId;
    for (let eid = 1; eid < LightningBolt.sourceId.length; eid++) {
      if ((LightningBolt.duration[eid] ?? 0) <= 0) continue;
      if (LightningBolt.sourceId[eid] === currentSourceId) {
        result.push(eid);
        currentSourceId = LightningBolt.targetId[eid]!;
      }
    }
    return result;
  }

  it('配置为 L1 跳跃 3 次，每次升级跳跃次数 +1', () => {
    expect(TOWER_CONFIGS[TowerType.Lightning].chainCount).toBe(3);
    expect(TOWER_CONFIGS[TowerType.Lightning].chainCountByLevel).toEqual([3, 4, 5, 6, 7]);
    expect(TOWER_CONFIGS[TowerType.Lightning].upgradeAtkBonus).toEqual([10, 35, 30, 40]);
  });

  it('L1 连锁最多命中 3 个目标', () => {
    vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const towerId = makeLightningTower(20);
    const enemies = makeEnemyLine(5);

    doLightningAttack(world, towerId, enemies[0]!, 1);

    expect(Health.current[enemies[0]!]).toBeCloseTo(80);
    expect(Health.current[enemies[1]!]).toBeCloseTo(84);
    expect(Health.current[enemies[2]!]).toBeCloseTo(87.2);
    expect(Health.current[enemies[3]!]).toBe(100);
    expect(Health.current[enemies[4]!]).toBe(100);
    expect(activeLightningBoltsFor(towerId)).toHaveLength(3);
  });

  it('L5 连锁最多命中 7 个目标', () => {
    vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const towerId = makeLightningTower(135);
    const enemies = makeEnemyLine(8);

    doLightningAttack(world, towerId, enemies[0]!, 5);

    expect(enemies.filter((eid) => Health.current[eid]! < 100)).toHaveLength(7);
    expect(Health.current[enemies[7]!]!).toBe(100);
    expect(activeLightningBoltsFor(towerId)).toHaveLength(7);
  });
});

describe('LightningStorm — 电塔5级全屏落雷战略技能', () => {
  let world: TowerWorld;

  beforeEach(() => {
    world = new TowerWorld();
  });

  function makeMap(): MapConfig {
    return {
      name: 'storm-test',
      cols: 10,
      rows: 10,
      tileSize: 32,
      tiles: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => TileType.Path)),
      pathGraph: {
        nodes: [
          { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 's0' },
          { id: 'c', row: 8, col: 8, role: 'crystal_anchor' },
        ],
        edges: [{ from: 's', to: 'c' }],
      },
      spawns: [{ id: 's0', row: 0, col: 0 }],
    };
  }

  function makeStormTower(level = 5): number {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Layer, { value: LayerVal.Ground });
    world.addComponent(towerId, Tower, { towerType: 3, level, totalInvested: 2635 });
    world.addComponent(towerId, Attack, {
      damage: 135,
      attackSpeed: 0.9,
      range: 250,
      alertRange: 500,
      damageType: DamageTypeVal.Magic,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      isRanged: 1,
      canTargetLowAir: 1,
      splashRadius: 0,
      chainCount: 7,
      chainRange: 120,
      chainDecay: 0.2,
    });
    world.addComponent(towerId, Health, { current: 1800, max: 1800, armor: 0, magicResist: 0 });
    return towerId;
  }

  function makeStormEnemy(x: number, y: number, hp = 1000, opts: { boss?: boolean; elite?: boolean } = {}): number {
    const eid = makeAttackable(world, x, y, FactionVal.Evil, hp, LayerVal.Ground, 1, 0);
    UnitTag.isBoss[eid] = opts.boss ? 1 : 0;
    UnitTag.isElite[eid] = opts.elite ? 1 : 0;
    return eid;
  }

  it('目标选择优先Boss，其次精英，不按距离抢目标', () => {
    const tower = makeStormTower();
    const normal = makeStormEnemy(250, 250);
    const elite = makeStormEnemy(120, 120, 1000, { elite: true });
    const boss = makeStormEnemy(400, 400, 3000, { boss: true });

    expect(findLightningStormTarget(world, tower, makeMap())).toBe(boss);
    Health.current[boss] = 0;
    expect(findLightningStormTarget(world, tower, makeMap())).toBe(elite);
    Health.current[elite] = 0;
    expect(findLightningStormTarget(world, tower, makeMap())).toBe(normal);
  });

  it('没有Boss和精英时选择离水晶最近的敌人', () => {
    const tower = makeStormTower();
    makeStormEnemy(40, 40);
    const nearCrystal = makeStormEnemy(8 * 32 + 16, 7 * 32 + 16);

    expect(findLightningStormTarget(world, tower, makeMap())).toBe(nearCrystal);
  });

  it('5级电塔冷却满后造成900魔法伤害并创建落雷和屏幕震动表现', () => {
    vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const tower = makeStormTower(5);
    const elite = makeStormEnemy(160, 160, 900, { elite: true });

    updateLightningStormSkill(world, tower, 10, makeMap());

    expect(Health.current[elite]).toBeLessThanOrEqual(0);
    expect(lightningStormQuery(world.world)).toHaveLength(1);
    expect(screenShakeQuery(world.world)).toHaveLength(1);
    expect(Sound.play).toHaveBeenCalledWith('lightning_hit');
  });

  it('5级以下电塔不会触发全屏落雷', () => {
    const tower = makeStormTower(4);
    makeStormEnemy(160, 160, 900, { elite: true });

    updateLightningStormSkill(world, tower, 20, makeMap());

    expect(lightningStormQuery(world.world)).toHaveLength(0);
  });

  it('直接触发落雷时记录目标点用于天空压暗和落雷柱渲染', () => {
    vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const tower = makeStormTower();
    const target = makeStormEnemy(192, 224, 1200);

    triggerLightningStorm(world, tower, target);

    const stormId = lightningStormQuery(world.world)[0]!;
    expect(LightningStorm.targetId[stormId]).toBe(target);
    expect(LightningStorm.targetX[stormId]).toBe(192);
    expect(LightningStorm.targetY[stormId]).toBe(224);
    expect(LightningStorm.damage[stormId]).toBe(900);
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

  describe('Boss塔免疫', () => {
    it('塔无法锁定 immuneToTowers 的虫族女王目标', () => {
      const tower = makeAttackable(world, 0, 0, FactionVal.Justice, 100, LayerVal.Ground, 1, 0);
      world.addComponent(tower, Tower, { towerType: 0, level: 1, range: 100, damage: 10 });
      const boss = makeAttackable(world, 50, 0, FactionVal.Evil);
      world.addComponent(boss, Boss, {
        bossType: 1,
        phase: 1,
        phase2HpRatio: 0.5,
        transitionTimer: 0,
        abilityTimer: 0,
        spawnTimer: 0,
        splitCount: 0,
        immuneToTowers: 1,
      });

      expect(AttackSystem.isValidTarget(world, tower, boss)).toBe(false);
    });

    it('非塔攻击者仍可锁定 immuneToTowers 的虫族女王目标', () => {
      const soldier = makeAttackable(world, 0, 0, FactionVal.Justice, 100, LayerVal.Ground, 0, 0);
      const boss = makeAttackable(world, 50, 0, FactionVal.Evil);
      world.addComponent(boss, Boss, {
        bossType: 1,
        phase: 1,
        phase2HpRatio: 0.5,
        transitionTimer: 0,
        abilityTimer: 0,
        spawnTimer: 0,
        splitCount: 0,
        immuneToTowers: 1,
      });

      expect(AttackSystem.isValidTarget(world, soldier, boss)).toBe(true);
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

  it.each([
    { level: 1, damage: 10, range: 200, expectedTargets: 1 },
    { level: 2, damage: 15, range: 220, expectedTargets: 2 },
    { level: 3, damage: 33, range: 260, expectedTargets: 3 },
  ])('箭塔 L$level 按 projectileCount 同时射向 $expectedTargets 个目标', ({ level, damage, range, expectedTargets }) => {
    vi.spyOn(Sound, 'play').mockImplementation(() => {});
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Layer, { value: LayerVal.Ground });
    world.addComponent(towerId, Tower, { towerType: 0, level, totalInvested: 70 });
    world.addComponent(towerId, Attack, {
      damage,
      attackSpeed: 1,
      range,
      alertRange: range * 2,
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
    world.addComponent(towerId, Health, { current: 1800, max: 1800, armor: 0, magicResist: 0 });

    const targets = [
      makeAttackable(world, 80, 0, FactionVal.Evil, 100),
      makeAttackable(world, 120, 0, FactionVal.Evil, 100),
      makeAttackable(world, 160, 0, FactionVal.Evil, 100),
    ];

    new AttackSystem().update(world, 1 / 60);

    const projectiles = projectileQuery(world.world);
    expect(projectiles).toHaveLength(expectedTargets);
    expect(projectiles.map((eid) => Projectile.targetId[eid])).toEqual(targets.slice(0, expectedTargets));
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

  it('塔的有效攻击距离至少为1格，可以攻击配置射程外但1格内的敌人', () => {
    const towerId = world.createEntity();
    world.addComponent(towerId, Position, { x: 0, y: 0 });
    world.addComponent(towerId, Faction, { value: FactionVal.Justice });
    world.addComponent(towerId, Layer, { value: LayerVal.Ground });
    world.addComponent(towerId, Tower, { towerType: 0, level: 1, totalInvested: 50 });
    world.addComponent(towerId, Attack, {
      damage: 10,
      attackSpeed: 1,
      range: 20,
      alertRange: 40,
      damageType: DamageTypeVal.Physical,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      isRanged: 0,
      canTargetLowAir: 1,
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
    });
    world.addComponent(towerId, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
    const enemy = makeAttackable(world, 30, 0, FactionVal.Evil, 100);

    new AttackSystem(undefined, { name: 'range-test', cols: 2, rows: 1, tileSize: 32, tiles: [] }).update(world, 1 / 60);

    const projectiles = projectileQuery(world.world);
    expect(projectiles).toHaveLength(1);
    expect(Projectile.targetId[projectiles[0]!]).toBe(enemy);
    expect(Attack.cooldownTimer[towerId]).toBeGreaterThan(0);
  });
});
