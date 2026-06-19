import type { TowerWorld } from '../core/World.js';
import { hasComponent } from '../core/World.js';
import { Attack, Health, PlayerOwned, UnitTag, Visual } from '../core/components.js';
import { UNIT_CONFIGS, UNIT_ID_BY_TYPE } from '../data/gameData.js';
import type { UnitType } from '../types/index.js';

export interface SoldierUpgradeConfig {
  upgradeHpBonus?: readonly number[];
  upgradeAtkBonus?: readonly number[];
}

export function applySoldierLevelUp(
  entityId: number,
  cfg: SoldierUpgradeConfig,
  investedCost = 0,
): boolean {
  const curLevel = UnitTag.level[entityId];
  const maxLevel = UnitTag.maxLevel[entityId];
  if (curLevel === undefined || maxLevel === undefined || curLevel >= maxLevel) return false;

  const costIdx = curLevel - 1;
  UnitTag.level[entityId] = curLevel + 1;
  UnitTag.totalInvested[entityId] = (UnitTag.totalInvested[entityId] ?? 0) + investedCost;

  const hpBonus = cfg.upgradeHpBonus?.[costIdx] ?? 0;
  if (hpBonus > 0) {
    Health.max[entityId] = (Health.max[entityId] ?? 0) + hpBonus;
    Health.current[entityId] = (Health.current[entityId] ?? 0) + hpBonus;
  }

  const atkBonus = cfg.upgradeAtkBonus?.[costIdx] ?? 0;
  if (atkBonus > 0 && Attack.damage[entityId] !== undefined) {
    Attack.damage[entityId]! += atkBonus;
  }

  Visual.hitFlashTimer[entityId] = 0.35;
  return true;
}

export function upgradeAllSoldiersOfType(world: TowerWorld, unitType: UnitType): number {
  const unitTypeNum = UNIT_ID_BY_TYPE[unitType];
  const cfg = UNIT_CONFIGS[unitType];
  if (unitTypeNum === undefined || !cfg) return 0;

  let upgraded = 0;
  for (let eid = 1; eid < UnitTag.unitTypeNum.length; eid++) {
    if (UnitTag.isEnemy[eid] !== 0) continue;
    if (UnitTag.unitTypeNum[eid] !== unitTypeNum) continue;
    if (!hasComponent(world.world, PlayerOwned, eid)) continue;
    if (applySoldierLevelUp(eid, cfg, 0)) {
      upgraded++;
    }
  }

  return upgraded;
}
