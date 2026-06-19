import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unitConfigRegistry, type UnitConfig as RegistryUnitConfig } from '../../config/registry.js';
import { DamageTypeVal, Health, Visual } from '../../core/components.js';
import { EnemyType, TowerType, UnitType } from '../../types/index.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, ENEMY_CONFIGS } from '../gameData.js';
import { injectTowerConfigsFromRegistry } from './towerBridge.js';
import { injectSoldierConfigsFromRegistry } from './soldierBridge.js';
import { injectEnemyConfigsFromRegistry } from './enemyBridge.js';
import { injectTrapConfigsFromRegistry } from './trapBridge.js';
import { UnitFactory } from '../../systems/UnitFactory.js';
import { TowerWorld } from '../../core/World.js';
import { Attack, Trap } from '../../core/components.js';
import { TRAP_CONFIGS } from '../gameData.js';

function registerConfig(config: RegistryUnitConfig): void {
  unitConfigRegistry.register(config);
}

describe('unit config bridge', () => {
  const originalArrow = { ...TOWER_CONFIGS[TowerType.Arrow] };
  const originalLightning = { ...TOWER_CONFIGS[TowerType.Lightning] };
  const originalMissile = { ...TOWER_CONFIGS[TowerType.Missile] };
  const originalMage = { ...UNIT_CONFIGS[UnitType.Mage] };
  const originalWizard = { ...ENEMY_CONFIGS.wizard! };
  const originalGiantSlime = { ...ENEMY_CONFIGS.giant_slime! };
  const originalPlane = { ...ENEMY_CONFIGS.plane! };
  const originalSpikeTrap = { ...TRAP_CONFIGS.spike_trap! };
  const originalBoulder = { ...TRAP_CONFIGS.boulder! };

  beforeEach(() => {
    unitConfigRegistry.clear();
  });

  afterEach(() => {
    TOWER_CONFIGS[TowerType.Arrow] = { ...originalArrow };
    TOWER_CONFIGS[TowerType.Lightning] = { ...originalLightning };
    TOWER_CONFIGS[TowerType.Missile] = { ...originalMissile };
    UNIT_CONFIGS[UnitType.Mage] = { ...originalMage };
    ENEMY_CONFIGS.wizard = { ...originalWizard };
    ENEMY_CONFIGS.giant_slime = { ...originalGiantSlime };
    ENEMY_CONFIGS.plane = { ...originalPlane };
    TRAP_CONFIGS.spike_trap = { ...originalSpikeTrap };
    TRAP_CONFIGS.boulder = { ...originalBoulder };
    unitConfigRegistry.clear();
  });

  it('电塔从 YAML 注入线性弹跳次数与减半后的高等级伤害', () => {
    registerConfig({
      id: 'lightning_tower',
      name: '测试电塔',
      category: 'Tower',
      faction: 'Player',
      layer: 'Ground',
      stats: { hp: 900, atk: 20, attackSpeed: 0.9, range: 170, armor: 0, mr: 0, damageType: 'magic' },
      cost: { build: 110, upgrade: [65, 580, 780, 1100], atkGrowth: [10, 2.5, 15, 20], rangeGrowth: [15, 25, 20, 20] },
      visual: { shape: 'rect', color: '#fff176', size: 34 },
      behavior: {
        targetSelection: 'nearest',
        attackMode: 'chain',
        movementMode: 'hold_position',
        special: {
          chainCount: 3,
          chainCountByLevel: [3, 4, 5, 6, 7],
          chainRange: 120,
          chainDecay: 0.2,
          lightningStormCooldown: 10,
          lightningStormDamage: 200,
        },
      },
    });

    injectTowerConfigsFromRegistry();

    expect(TOWER_CONFIGS[TowerType.Lightning].atk).toBe(20);
    expect(TOWER_CONFIGS[TowerType.Lightning].upgradeAtkBonus).toEqual([10, 2.5, 15, 20]);
    expect(TOWER_CONFIGS[TowerType.Lightning].chainCount).toBe(3);
    expect(TOWER_CONFIGS[TowerType.Lightning].chainCountByLevel).toEqual([3, 4, 5, 6, 7]);
    expect(TOWER_CONFIGS[TowerType.Lightning].lightningStormCooldown).toBe(10);
    expect(TOWER_CONFIGS[TowerType.Lightning].lightningStormDamage).toBe(200);
  });

  it('塔从 stats.damageType 读取伤害类型，支持 true 伤害', () => {
    registerConfig({
      id: TowerType.Missile,
      name: '测试导弹塔',
      category: 'Tower',
      faction: 'Player',
      layer: 'Ground',
      stats: { hp: 100, atk: 10, attackSpeed: 1, range: 200, armor: 0, mr: 0, damageType: 'true' },
      cost: { build: 1, upgrade: [1], atkGrowth: [2], rangeGrowth: [0] },
      visual: { shape: 'rect', color: '#ffffff', size: 32 },
      behavior: { targetSelection: 'nearest', attackMode: 'aoe_splash', movementMode: 'hold_position', special: { splashRadius: 80 } },
    });

    injectTowerConfigsFromRegistry();

    expect(TOWER_CONFIGS[TowerType.Missile].damageType).toBe('true');

    const world = new TowerWorld();
    const factory = new UnitFactory(world);
    const eid = factory.createTower(TowerType.Missile, 0, 0, { row: 0, col: 0 }, { tileSize: 64, towerTypeNum: 6 })!;
    expect(Attack.damageType[eid]).toBe(DamageTypeVal.True);
  });

  it('塔桥接支持 *_tower 配置 ID，并按升级费用长度决定等级上限', () => {
    registerConfig({
      id: 'arrow_tower',
      name: '测试箭塔',
      category: 'Tower',
      faction: 'Player',
      layer: 'Ground',
      stats: { hp: 100, atk: 10, attackSpeed: 1, range: 200, armor: 0, mr: 0, damageType: 'physical' },
      cost: { build: 70, upgrade: [40, 360], atkGrowth: [5, 18], rangeGrowth: [20, 40] },
      visual: { shape: 'rect', color: '#ffffff', size: 32 },
      behavior: {
        targetSelection: 'nearest',
        attackMode: 'single_target',
        movementMode: 'hold_position',
        special: { projectileCount: [1, 2, 3] },
      },
    });
    registerConfig({
      id: 'missile_tower',
      name: '测试导弹塔',
      category: 'Tower',
      faction: 'Player',
      layer: 'Ground',
      stats: { hp: 120, atk: 80, attackSpeed: 0.3, range: 672, armor: 0, mr: 0, damageType: 'true' },
      cost: { build: 220, upgrade: [130, 980, 1400, 1850], atkGrowth: [30, 110, 60, 80], rangeGrowth: [0, 0, 0, 0] },
      visual: { shape: 'rect', color: '#ffffff', size: 42 },
      behavior: {
        targetSelection: 'highest_threat',
        attackMode: 'aoe_splash',
        movementMode: 'hold_position',
        special: { splashRadius: 80, projectileCount: [1, 1, 2, 2, 3] },
      },
    });

    injectTowerConfigsFromRegistry();

    expect(TOWER_CONFIGS[TowerType.Arrow].upgradeCosts).toEqual([40, 360]);
    expect(TOWER_CONFIGS[TowerType.Arrow].upgradeAtkBonus).toEqual([5, 18]);
    expect(TOWER_CONFIGS[TowerType.Arrow].projectileCount).toEqual([1, 2, 3]);
    expect(TOWER_CONFIGS[TowerType.Arrow].upgradeCosts).toHaveLength(2);

    expect(TOWER_CONFIGS[TowerType.Missile].damageType).toBe('true');
    expect(TOWER_CONFIGS[TowerType.Missile].range).toBe(672);
    expect(TOWER_CONFIGS[TowerType.Missile].upgradeCosts).toHaveLength(4);
    expect(TOWER_CONFIGS[TowerType.Missile].projectileCount).toEqual([1, 1, 2, 2, 3]);

    const world = new TowerWorld();
    const factory = new UnitFactory(world);
    const eid = factory.createTower(TowerType.Arrow, 0, 0, { row: 0, col: 0 }, { tileSize: 64, towerTypeNum: 0 })!;
    expect(Health.current[eid]).toBe(100);
    expect(Health.max[eid]).toBe(100);
  });

  it('塔默认不显示白色描边，选中态由渲染选中状态负责', () => {
    const world = new TowerWorld();
    const factory = new UnitFactory(world);

    const eid = factory.createTower(TowerType.Arrow, 0, 0, { row: 0, col: 0 }, { tileSize: 64, towerTypeNum: 0 })!;

    expect(Visual.outline[eid]).toBe(0);
  });

  it('机关默认不显示白色描边，并从配置读取低伤害高频率节奏', () => {
    registerConfig({
      id: 'spike_trap',
      name: '测试地刺',
      category: 'Trap',
      faction: 'Player',
      layer: 'AboveGrid',
      stats: { hp: 99999, atk: 0 },
      cost: { build: 40 },
      trap: { type: 'SpikeTrap', damagePerSecond: 3, radius: 32, cooldown: 0.2 },
      visual: { shape: 'triangle', color: '#757575', size: 28, outline: false },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'hold_position' },
    } as RegistryUnitConfig);

    injectTrapConfigsFromRegistry();

    const world = new TowerWorld();
    const factory = new UnitFactory(world);
    const eid = factory.createTrap('spike_trap', 0, 0, { row: 0, col: 0 })!;

    expect(Visual.outline[eid]).toBe(0);
    expect(Trap.damagePerSecond[eid]).toBe(3);
    expect(Trap.cooldown[eid]).toBeCloseTo(0.2);
  });

  it('巨石机关从 stats 读取血量、防御和魔抗，确保可被攻击破坏', () => {
    registerConfig({
      id: 'boulder',
      name: '测试巨石',
      category: 'Trap',
      faction: 'Player',
      layer: 'Ground',
      stats: { hp: 200, atk: 0, armor: 20, mr: 5 },
      cost: { build: 60 },
      trap: { type: 'Boulder' },
      visual: { shape: 'circle', color: '#78909c', size: 40, outline: false },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'hold_position' },
    } as RegistryUnitConfig);

    injectTrapConfigsFromRegistry();

    const world = new TowerWorld();
    const factory = new UnitFactory(world);
    const eid = factory.createTrap('boulder', 0, 0, { row: 0, col: 0 })!;

    const cfg = TRAP_CONFIGS.boulder!;
    expect(cfg.hp).toBe(200);
    expect(cfg.defense).toBe(20);
    expect(cfg.magicResist).toBe(5);
    expect(Health.current[eid]).toBe(200);
    expect(Health.max[eid]).toBe(200);
    expect(Health.armor[eid]).toBe(20);
    expect(Health.magicResist[eid]).toBe(5);
  });

  it('飞机兜底配置保持三倍血量和低空两倍视觉半径', () => {
    expect(ENEMY_CONFIGS[EnemyType.Plane]!.hp).toBe(240);
    expect(ENEMY_CONFIGS[EnemyType.Plane]!.radius).toBeCloseTo(33.6);
  });

  it('士兵升级成长和伤害类型来自 cost/stats 配置', () => {
    registerConfig({
      id: UnitType.Mage,
      name: '测试法师',
      category: 'Soldier',
      faction: 'Player',
      layer: 'Ground',
      stats: { hp: 80, atk: 12, attackSpeed: 1, range: 120, speed: 50, armor: 0, mr: 10, damageType: 'magic' },
      cost: { build: 20, pop: 2, upgrade: [30, 50], hpGrowth: [7, 11], atkGrowth: [3, 5], tauntCapacityGrowth: [1, 2], maxLevel: 3 },
      visual: { shape: 'circle', color: '#ffffff', size: 24 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'player_directed' },
    });

    injectSoldierConfigsFromRegistry();

    const cfg = UNIT_CONFIGS[UnitType.Mage];
    expect(cfg.damageType).toBe('magic');
    expect(cfg.upgradeHpBonus).toEqual([7, 11]);
    expect(cfg.upgradeAtkBonus).toEqual([3, 5]);
    expect(cfg.upgradeTauntCapacityBonus).toEqual([1, 2]);
    expect(cfg.maxLevel).toBe(3);
  });

  it('敌人伤害类型和 Boss 尺寸来自配置，不被桥接默认值覆盖', () => {
    registerConfig({
      id: 'wizard',
      name: '测试巫师',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      stats: { hp: 90, atk: 20, attackSpeed: 1, range: 160, speed: 30, armor: 0, mr: 20, damageType: 'magical' },
      reward: { gold: 12 },
      visual: { shape: 'hexagon', color: '#ffffff', size: 28 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
    });
    registerConfig({
      id: 'giant_slime',
      name: '测试巨型史莱姆',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      isBoss: true,
      stats: { hp: 800, atk: 20, attackSpeed: 0.5, range: 50, speed: 15, armor: 10, mr: 5, damageType: 'physical' },
      reward: { gold: 100 },
      visual: { shape: 'circle', color: '#66bb6a', size: 96 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      boss: { bossType: 'GiantSlime', splitCount: 0 },
    } as RegistryUnitConfig);

    injectEnemyConfigsFromRegistry();

    expect(ENEMY_CONFIGS.wizard!.damageType).toBe('magic');
    expect(ENEMY_CONFIGS.giant_slime!.radius).toBe(48);
  });

  it('敌人普攻攻速注入后限制为1到3秒攻击间隔', () => {
    registerConfig({
      id: 'wizard',
      name: '测试巫师',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      stats: { hp: 90, atk: 20, attackSpeed: 0.2, range: 160, speed: 30, armor: 0, mr: 20, damageType: 'magic' },
      reward: { gold: 12 },
      visual: { shape: 'hexagon', color: '#ffffff', size: 28 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
    });
    registerConfig({
      id: 'giant_slime',
      name: '测试巨型史莱姆',
      category: 'Enemy',
      faction: 'Enemy',
      layer: 'Ground',
      isBoss: true,
      stats: { hp: 800, atk: 20, attackSpeed: 1.8, range: 50, speed: 15, armor: 10, mr: 5, damageType: 'physical' },
      reward: { gold: 100 },
      visual: { shape: 'circle', color: '#66bb6a', size: 96 },
      behavior: { targetSelection: 'nearest', attackMode: 'single_target', movementMode: 'follow_path' },
      boss: { bossType: 'GiantSlime', splitCount: 0 },
    } as RegistryUnitConfig);

    injectEnemyConfigsFromRegistry();

    expect(ENEMY_CONFIGS.wizard!.attackSpeed).toBeCloseTo(1 / 3);
    expect(ENEMY_CONFIGS.giant_slime!.attackSpeed).toBe(1);
  });
});
