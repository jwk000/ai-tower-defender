import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { unitConfigRegistry, type UnitConfig as RegistryUnitConfig } from '../../config/registry.js';
import { DamageTypeVal, Visual } from '../../core/components.js';
import { TowerType, UnitType } from '../../types/index.js';
import { TOWER_CONFIGS, UNIT_CONFIGS, ENEMY_CONFIGS } from '../gameData.js';
import { injectTowerConfigsFromRegistry } from './towerBridge.js';
import { injectSoldierConfigsFromRegistry } from './soldierBridge.js';
import { injectEnemyConfigsFromRegistry } from './enemyBridge.js';
import { UnitFactory } from '../../systems/UnitFactory.js';
import { TowerWorld } from '../../core/World.js';
import { Attack } from '../../core/components.js';

function registerConfig(config: RegistryUnitConfig): void {
  unitConfigRegistry.register(config);
}

describe('unit config bridge', () => {
  const originalMissile = { ...TOWER_CONFIGS[TowerType.Missile] };
  const originalMage = { ...UNIT_CONFIGS[UnitType.Mage] };
  const originalWizard = { ...ENEMY_CONFIGS.wizard! };
  const originalGiantSlime = { ...ENEMY_CONFIGS.giant_slime! };

  beforeEach(() => {
    unitConfigRegistry.clear();
  });

  afterEach(() => {
    TOWER_CONFIGS[TowerType.Missile] = { ...originalMissile };
    UNIT_CONFIGS[UnitType.Mage] = { ...originalMage };
    ENEMY_CONFIGS.wizard = { ...originalWizard };
    ENEMY_CONFIGS.giant_slime = { ...originalGiantSlime };
    unitConfigRegistry.clear();
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

  it('塔默认不显示白色描边，选中态由渲染选中状态负责', () => {
    const world = new TowerWorld();
    const factory = new UnitFactory(world);

    const eid = factory.createTower(TowerType.Arrow, 0, 0, { row: 0, col: 0 }, { tileSize: 64, towerTypeNum: 0 })!;

    expect(Visual.outline[eid]).toBe(0);
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
});
