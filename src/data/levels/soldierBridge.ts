import { UnitType, type UnitConfig, type ShapeType, type UnitVisualParts } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { UNIT_CONFIGS } from '../gameData.js';
import { getProceduralVisualParts } from '../../utils/proceduralArt.js';

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

function mapDamageType(yamlDamageType: string | undefined): 'physical' | 'magic' | 'true' {
  switch (yamlDamageType) {
    case 'true':
      return 'true';
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
    const statsExtra = stats as unknown as Record<string, unknown> | undefined;
    const cost = u.cost;
    const visual = u.visual;
    const behavior = u.behavior;
    const skills = u.skills as Array<Record<string, unknown>> | undefined;

    const special = (behavior?.special ?? {}) as Record<string, unknown>;

    // 解析技能
    const skillId = skills && skills.length > 0 ? (skills[0]?.['id'] as string) ?? '' : '';
    const damageType = mapDamageType(stats?.damageType as string);

    // 解析特殊属性
    const splashRadius = (special['splashRadius'] as number) ?? 0;
    const splashDamage = (special['splashDamage'] as number) ?? 0;
    const tauntCapacity = (special['tauntCapacity'] as number) ?? 0;
    const tauntCapacityPerLevel = (special['tauntCapacityPerLevel'] as number) ?? 0;

    // 解析升级配置
    const maxLevel = (cost?.maxLevel as number) ?? 3; // 默认最大等级
    const upgradeCosts = (cost?.upgrade as number[]) ?? [40, 60];
    const upgradeHpBonus = (cost?.hpGrowth as number[]) ?? [40, 60]; // 默认值
    const upgradeAtkBonus = (cost?.atkGrowth as number[]) ?? [5, 8]; // 默认值
    const upgradeTauntCapacityBonus = cost?.tauntCapacityGrowth as number[] | undefined;

    // 解析 visualParts；未显式配置时按程序化美术规范生成默认复合外观。
    const visualParts = getProceduralVisualParts(u) as UnitVisualParts | undefined;

    const cfg: UnitConfig = {
      type,
      name: u.name,
      hp: stats?.hp ?? 100,
      atk: stats?.atk ?? 10,
      attackSpeed: stats?.attackSpeed ?? 1.0,
      attackRange: stats?.range ?? 50,
      alertRange: (special['alertRange'] as number) ?? Math.max(200, (stats?.range ?? 50) * 1.5),
      speed: stats?.speed ?? 50,
      defense: stats?.armor ?? 0,
      damageType,
      popCost: cost?.pop ?? 2,
      color: visual?.color ?? '#ffffff',
      size: visual?.size ?? 24,
      skillId,
      cost: cost?.build ?? 50,
      moveRange: (statsExtra?.moveRange as number | undefined) ?? ((special['moveRange'] as number) ?? 100),
      maxLevel,
      upgradeCosts,
      upgradeHpBonus,
      upgradeAtkBonus,
      upgradeTauntCapacityBonus,
      shape: mapShape(visual?.shape),
      attackAnimDuration: 0.35,
      targetSelection: behavior?.targetSelection,
    };

    // 添加可选属性
    if (splashRadius > 0) cfg.splashRadius = splashRadius;
    if (splashDamage > 0) cfg.splashDamage = splashDamage;
    if (tauntCapacity > 0) {
      cfg.tauntCapacity = tauntCapacity;
      cfg.tauntCapacityPerLevel = tauntCapacityPerLevel;
    }
    for (const key of [
      'critChance',
      'critMultiplier',
      'critSuperChance',
      'critSuperMultiplier',
      'executeThreshold',
      'debuffValue',
      'debuffDuration',
      'periodicSpellCooldown',
      'periodicSpellDamage',
      'periodicSpellRadius',
      'healAmount',
      'healRange',
      'repairAmount',
      'repairRange',
    ] as const) {
      const value = special[key];
      if (typeof value === 'number') {
        (cfg as unknown as Record<string, unknown>)[key] = value;
      }
    }
    for (const key of ['executeNormalOnly', 'teleportOnExecute', 'debuffIsPercent'] as const) {
      const value = special[key];
      if (typeof value === 'boolean') {
        (cfg as unknown as Record<string, unknown>)[key] = value;
      }
    }
    for (const key of ['debuffId', 'debuffAttribute'] as const) {
      const value = special[key];
      if (typeof value === 'string') {
        (cfg as unknown as Record<string, unknown>)[key] = value;
      }
    }
    if (visualParts) cfg.visualParts = visualParts;

    UNIT_CONFIGS[type] = cfg;
    injected += 1;
  }

  return injected;
}
