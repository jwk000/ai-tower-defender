import { UnitType, type UnitConfig, type ShapeType, type UnitVisualParts } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { UNIT_CONFIGS } from '../gameData.js';

const VALID_UNIT_TYPES = new Set<string>(Object.values(UnitType));

function mapShape(yamlShape: string | undefined): ShapeType {
  switch (yamlShape) {
    case 'rectangle':
    case 'rect':
      return 'rect';
    case 'diamond':
      return 'diamond';
    case 'triangle':
      return 'triangle';
    case 'hexagon':
      return 'hexagon';
    case 'circle':
    default:
      return 'circle';
  }
}

function mapDamageType(yamlDamageType: string | undefined): 'physical' | 'magic' {
  switch (yamlDamageType) {
    case 'magic':
      return 'magic';
    case 'physical':
    default:
      return 'physical';
  }
}

export function injectSoldierConfigsFromRegistry(): number {
  const soldiers = unitConfigRegistry.getByCategory('Soldier');
  let injected = 0;

  for (const u of soldiers) {
    if (!VALID_UNIT_TYPES.has(u.id)) {
      continue;
    }
    const type = u.id as UnitType;

    const stats = u.stats;
    const cost = u.cost;
    const visual = u.visual;
    const behavior = u.behavior;
    const skills = u.skills as Array<Record<string, unknown>> | undefined;

    const special = (behavior?.special ?? {}) as Record<string, unknown>;

    // 解析技能
    const skillId = skills && skills.length > 0 ? (skills[0]?.['id'] as string) ?? '' : '';

    // 解析特殊属性
    const splashRadius = (special['splashRadius'] as number) ?? 0;
    const tauntCapacity = (special['tauntCapacity'] as number) ?? 0;
    const tauntCapacityPerLevel = (special['tauntCapacityPerLevel'] as number) ?? 0;

    // 解析升级配置
    const maxLevel = 3; // 默认最大等级
    const upgradeCosts = (cost?.upgrade as number[]) ?? [40, 60];
    const upgradeHpBonus = [40, 60]; // 默认值
    const upgradeAtkBonus = [5, 8]; // 默认值

    // 解析 visualParts
    const visualParts = (u as Record<string, unknown>)['visualParts'] as UnitVisualParts | undefined;

    const cfg: UnitConfig = {
      type,
      name: u.name,
      hp: stats?.hp ?? 100,
      atk: stats?.atk ?? 10,
      attackSpeed: stats?.attackSpeed ?? 1.0,
      attackRange: stats?.range ?? 50,
      alertRange: 200, // 默认值
      speed: stats?.speed ?? 50,
      defense: stats?.armor ?? 0,
      popCost: cost?.pop ?? 2,
      color: visual?.color ?? '#ffffff',
      size: visual?.size ?? 24,
      skillId,
      cost: cost?.build ?? 50,
      moveRange: 200, // 默认值
      maxLevel,
      upgradeCosts,
      upgradeHpBonus,
      upgradeAtkBonus,
      shape: mapShape(visual?.shape),
      attackAnimDuration: 0.35,
    };

    // 添加可选属性
    if (splashRadius > 0) cfg.splashRadius = splashRadius;
    if (tauntCapacity > 0) {
      cfg.tauntCapacity = tauntCapacity;
      cfg.tauntCapacityPerLevel = tauntCapacityPerLevel;
    }
    if (visualParts) cfg.visualParts = visualParts;

    UNIT_CONFIGS[type] = cfg;
    injected += 1;
  }

  return injected;
}
