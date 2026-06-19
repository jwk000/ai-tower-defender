import type { EnemyConfig, ShapeType } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { ENEMY_CONFIGS } from '../gameData.js';
import { getProceduralVisualParts } from '../../utils/proceduralArt.js';

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
    case 'magical':
      return 'magic';
    case 'physical':
    default:
      return 'physical';
  }
}

const MIN_ENEMY_ATTACK_SPEED = 1 / 3;
const MAX_ENEMY_ATTACK_SPEED = 1;

function clampEnemyAttackSpeed(value: number): number {
  if (value <= 0) return 0;
  return Math.min(MAX_ENEMY_ATTACK_SPEED, Math.max(MIN_ENEMY_ATTACK_SPEED, value));
}

export function injectEnemyConfigsFromRegistry(): number {
  const enemies = unitConfigRegistry.getByCategory('Enemy');
  let injected = 0;

  for (const u of enemies) {
    const stats = u.stats;
    const reward = u.reward;
    const visual = u.visual;
    const behavior = u.behavior;

    const special = (behavior?.special ?? {}) as Record<string, unknown>;
    const canAttackBuildings = special['ignoreBuildings'] !== true;

    const cfg: EnemyConfig = {
      type: u.id,
      name: u.name,
      description: typeof u['description'] === 'string' ? (u['description'] as string) : '',
      hp: stats?.hp ?? 50,
      speed: stats?.speed ?? 80,
      atk: Math.max(1, stats?.atk ?? 5),
      defense: stats?.armor ?? 0,
      magicResist: stats?.mr ?? 0,
      damageType: mapDamageType(stats?.damageType as string),
      attackRange: stats?.range ?? 0,
      attackSpeed: clampEnemyAttackSpeed(stats?.attackSpeed ?? 1),
      canAttackBuildings,
      rewardGold: reward?.gold ?? 10,
      color: visual?.color ?? '#ef5350',
      radius: visual?.size != null ? Math.max(8, visual.size / 2) : 14,
      shape: mapShape(visual?.shape),
      visualParts: getProceduralVisualParts(u),
      isBoss: u['isBoss'] === true,
      bossType: typeof (u['boss'] as Record<string, unknown> | undefined)?.['bossType'] === 'string'
        ? (u['boss'] as Record<string, unknown>)['bossType'] as string
        : undefined,
      splitCount: typeof (u['boss'] as Record<string, unknown> | undefined)?.['splitCount'] === 'number'
        ? (u['boss'] as Record<string, unknown>)['splitCount'] as number
        : undefined,
      bossPhase2HpRatio: typeof u['bossPhase2HpRatio'] === 'number' ? u['bossPhase2HpRatio'] as number : undefined,
    };
    cfg.attackAnimDuration = typeof u['attackAnimDuration'] === 'number'
      ? u['attackAnimDuration'] as number
      : (cfg.isBoss ? 0.95 : 0.3);

    ENEMY_CONFIGS[u.id] = cfg;
    injected += 1;
  }

  return injected;
}
