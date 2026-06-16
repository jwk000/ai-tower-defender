import { TowerType, type TowerConfig, type ShapeType } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { TOWER_CONFIGS } from '../gameData.js';
import { getProceduralVisualParts } from '../../utils/proceduralArt.js';
import { towerCanTargetLowAir } from '../../utils/lowAirTargeting.js';

const VALID_TOWER_TYPES = new Set<string>(Object.values(TowerType));

const TOWER_CONFIG_ID_TO_TYPE: Record<string, TowerType> = {
  arrow_tower: TowerType.Arrow,
  ballista_tower: TowerType.Ballista,
  cannon_tower: TowerType.Cannon,
  laser_tower: TowerType.Laser,
  bat_tower: TowerType.Bat,
  missile_tower: TowerType.Missile,
  ice_tower: TowerType.Ice,
  fire_tower: TowerType.Fire,
  poison_tower: TowerType.Poison,
  lightning_tower: TowerType.Lightning,
};

function mapTowerType(configId: string): TowerType | undefined {
  if (VALID_TOWER_TYPES.has(configId)) return configId as TowerType;
  return TOWER_CONFIG_ID_TO_TYPE[configId];
}

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

export function injectTowerConfigsFromRegistry(): number {
  const towers = unitConfigRegistry.getByCategory('Tower');
  let injected = 0;

  for (const u of towers) {
    const type = mapTowerType(u.id);
    if (type === undefined) {
      continue;
    }

    const stats = u.stats;
    const cost = u.cost;
    const visual = u.visual;
    const behavior = u.behavior;

    const special = (behavior?.special ?? {}) as Record<string, unknown>;

    // 解析升级配置
    const upgradeCosts = (cost?.upgrade as number[]) ?? [];
    const atkGrowth = (cost?.atkGrowth as number[]) ?? [5, 8, 12, 16]; // 默认值
    const rangeGrowth = (cost?.rangeGrowth as number[]) ?? [20, 20, 30, 30]; // 默认值

    // 解析特殊属性
    const splashRadius = (special['splashRadius'] as number) ?? 0;
    const pierceCount = (special['pierceCount'] as number) ?? 0;
    const chainCount = (special['chainCount'] as number) ?? 0;
    const chainCountByLevel = special['chainCountByLevel'] as number[] | undefined;
    const chainDecay = (special['chainDecay'] as number) ?? 0;
    const lightningStormCooldown = (special['lightningStormCooldown'] as number) ?? 0;
    const lightningStormDamage = (special['lightningStormDamage'] as number) ?? 0;
    const slowPercent = (special['slowPercent'] as number) ?? 0;
    const slowMaxStacks = (special['slowMaxStacks'] as number) ?? 1;
    const dotDamage = (special['dotDamage'] as number) ?? 0;
    const dotDuration = (special['dotDuration'] as number) ?? 0;
    const cantTargetFlying = special['cantTargetFlying'] === true;

    // 蝙蝠塔特殊属性
    const batCount = (special['batCount'] as number) ?? 0;
    const batCountByLevel = special['batCountByLevel'] as number[] | undefined;
    const batReplenishCD = (special['batReplenishCD'] as number) ?? 0;
    const batHP = (special['batHP'] as number) ?? 0;
    const batHPByLevel = special['batHPByLevel'] as number[] | undefined;
    const batDamage = (special['batDamage'] as number) ?? 0;
    const batDamageByLevel = special['batDamageByLevel'] as number[] | undefined;
    const batAttackRange = (special['batAttackRange'] as number) ?? 0;
    const batAttackRangeByLevel = special['batAttackRangeByLevel'] as number[] | undefined;
    const batAttackSpeed = (special['batAttackSpeed'] as number) ?? 0;
    const batAttackSpeedByLevel = special['batAttackSpeedByLevel'] as number[] | undefined;
    const batSpeed = (special['batSpeed'] as number) ?? 0;

    // 导弹塔特殊属性
    const projectileCount = (special['projectileCount'] as number[]) ?? [1];

    const damageType = mapDamageType(stats?.damageType as string);

    const cfg: TowerConfig = {
      type,
      name: u.name,
      cost: cost?.build ?? 0,
      hp: stats?.hp ?? 100,
      atk: stats?.atk ?? 10,
      attackSpeed: stats?.attackSpeed ?? 1.0,
      range: stats?.range ?? 150,
      damageType,
      upgradeCosts,
      upgradeAtkBonus: atkGrowth,
      upgradeRangeBonus: rangeGrowth,
      color: visual?.color ?? '#ffffff',
      size: visual?.size,
      shape: mapShape(visual?.shape),
      outline: visual?.outline ?? false,
      visualParts: getProceduralVisualParts(u),
      buildTime: (u['buildTime'] as number | undefined) ?? (special['buildTime'] as number | undefined) ?? 1.5,
      canTargetLowAir: towerCanTargetLowAir(type),
    };

    // 添加可选属性
    if (splashRadius > 0) cfg.splashRadius = splashRadius;
    if (pierceCount > 0) cfg.pierceCount = pierceCount;
    if (chainCount > 0) cfg.chainCount = chainCount;
    if (chainCountByLevel && chainCountByLevel.length > 0) cfg.chainCountByLevel = chainCountByLevel;
    if (chainDecay > 0) cfg.chainDecay = chainDecay;
    if (lightningStormCooldown > 0) cfg.lightningStormCooldown = lightningStormCooldown;
    if (lightningStormDamage > 0) cfg.lightningStormDamage = lightningStormDamage;
    if (slowPercent > 0) cfg.slowPercent = slowPercent;
    if (slowMaxStacks > 1) cfg.slowMaxStacks = slowMaxStacks;
    if (dotDamage > 0) cfg.dotDamage = dotDamage;
    if (dotDuration > 0) cfg.dotDuration = dotDuration;
    if (cantTargetFlying) cfg.cantTargetFlying = true;
    if (batCount > 0) {
      cfg.batCount = batCount;
      cfg.batReplenishCD = batReplenishCD;
      cfg.batHP = batHP;
      cfg.batDamage = batDamage;
      cfg.batAttackRange = batAttackRange;
      cfg.batAttackSpeed = batAttackSpeed;
      cfg.batSpeed = batSpeed;
    }
    if (batCountByLevel && batCountByLevel.length > 0) cfg.batCountByLevel = batCountByLevel;
    if (batHPByLevel && batHPByLevel.length > 0) cfg.batHPByLevel = batHPByLevel;
    if (batDamageByLevel && batDamageByLevel.length > 0) cfg.batDamageByLevel = batDamageByLevel;
    if (batAttackRangeByLevel && batAttackRangeByLevel.length > 0) cfg.batAttackRangeByLevel = batAttackRangeByLevel;
    if (batAttackSpeedByLevel && batAttackSpeedByLevel.length > 0) cfg.batAttackSpeedByLevel = batAttackSpeedByLevel;
    if (projectileCount.length > 1) cfg.projectileCount = projectileCount;

    TOWER_CONFIGS[type] = cfg;
    injected += 1;
  }

  return injected;
}
