import { describe, expect, it } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { Attack, Health, UnitTag } from '../core/components.js';
import { UNIT_CONFIGS, UNIT_ID_BY_TYPE } from '../data/gameData.js';
import { UnitType } from '../types/index.js';
import { UnitFactory } from './UnitFactory.js';
import { applyBattleSoldierUpgrade, BattleSoldierUpgradeState } from './soldierUpgrade.js';

describe('UnitFactory soldier battle upgrades', () => {
  it('后续创建的士兵自动继承本场已生效兵种升级', () => {
    const world = new TowerWorld();
    const upgrades = new BattleSoldierUpgradeState();
    applyBattleSoldierUpgrade(world, upgrades, UnitType.ShieldGuard);
    applyBattleSoldierUpgrade(world, upgrades, UnitType.ShieldGuard);

    const factory = new UnitFactory(world, upgrades);
    const soldier = factory.createSoldier(UnitType.ShieldGuard, 96, 96, { row: 1, col: 1 }, {
      unitTypeNum: UNIT_ID_BY_TYPE[UnitType.ShieldGuard]!,
      skillId: 0,
      skillCooldown: 0,
      skillEnergyCost: 0,
    })!;

    expect(UnitTag.level[soldier]).toBe(3);
    expect(Health.max[soldier]).toBeGreaterThan(UNIT_CONFIGS[UnitType.ShieldGuard].hp);
    expect(Health.current[soldier]).toBe(Health.max[soldier]);
    expect(Attack.damage[soldier]).toBeGreaterThan(UNIT_CONFIGS[UnitType.ShieldGuard].atk);
  });
});
