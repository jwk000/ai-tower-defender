import { describe, expect, it } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { Attack, Health, PlayerOwned, UnitTag, Visual } from '../core/components.js';
import { UNIT_ID_BY_TYPE } from '../data/gameData.js';
import { UnitType } from '../types/index.js';
import { applySoldierLevelUp, upgradeAllSoldiersOfType } from './soldierUpgrade.js';

function addSoldier(world: TowerWorld, unitType: UnitType, level: number, isEnemy = 0): number {
  const eid = world.createEntity();
  world.addComponent(eid, UnitTag, {
    unitTypeNum: UNIT_ID_BY_TYPE[unitType],
    isEnemy,
    level,
    maxLevel: 3,
    popCost: 2,
    cost: 35,
    totalInvested: 35,
  });
  world.addComponent(eid, Health, { current: 100, max: 100 });
  world.addComponent(eid, Attack, { damage: 10, range: 50, attackSpeed: 1 });
  world.addComponent(eid, Visual, { size: 20, hitFlashTimer: 0 });
  if (isEnemy === 0) {
    world.addComponent(eid, PlayerOwned);
  }
  return eid;
}

describe('soldierUpgrade', () => {
  it('applySoldierLevelUp 按当前等级应用生命与攻击成长', () => {
    const world = new TowerWorld();
    const soldier = addSoldier(world, UnitType.ShieldGuard, 1);

    expect(applySoldierLevelUp(soldier, { upgradeHpBonus: [120, 180], upgradeAtkBonus: [2, 3] }, 40)).toBe(true);

    expect(UnitTag.level[soldier]).toBe(2);
    expect(UnitTag.totalInvested[soldier]).toBe(75);
    expect(Health.current[soldier]).toBe(220);
    expect(Health.max[soldier]).toBe(220);
    expect(Attack.damage[soldier]).toBe(12);
    expect(Visual.hitFlashTimer[soldier]).toBeCloseTo(0.35);
  });

  it('upgradeAllSoldiersOfType 只升级同兵种玩家未满级单位', () => {
    const world = new TowerWorld();
    const shield = addSoldier(world, UnitType.ShieldGuard, 1);
    const maxShield = addSoldier(world, UnitType.ShieldGuard, 3);
    const enemyShield = addSoldier(world, UnitType.ShieldGuard, 1, 1);
    const archer = addSoldier(world, UnitType.Archer, 1);

    expect(upgradeAllSoldiersOfType(world, UnitType.ShieldGuard)).toBe(1);

    expect(UnitTag.level[shield]).toBe(2);
    expect(UnitTag.level[maxShield]).toBe(3);
    expect(UnitTag.level[enemyShield]).toBe(1);
    expect(UnitTag.level[archer]).toBe(1);
  });
});
