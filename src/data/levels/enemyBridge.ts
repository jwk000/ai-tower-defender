import type { EnemyConfig, ShapeType } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { ENEMY_CONFIGS } from '../gameData.js';

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
      atk: stats?.atk ?? 5,
      defense: stats?.armor ?? 0,
      magicResist: stats?.mr ?? 0,
      attackRange: stats?.range ?? 0,
      attackSpeed: stats?.attackSpeed ?? 1,
      canAttackBuildings,
      rewardGold: reward?.gold ?? 10,
      color: visual?.color ?? '#ef5350',
      radius: visual?.size != null ? Math.max(8, Math.floor(visual.size / 2)) : 14,
      shape: mapShape(visual?.shape),
      attackAnimDuration: 0.3,
      isBoss: u['isBoss'] === true,
      bossPhase2HpRatio: typeof u['bossPhase2HpRatio'] === 'number' ? u['bossPhase2HpRatio'] as number : undefined,
    };

    ENEMY_CONFIGS[u.id] = cfg;
    injected += 1;
  }

  return injected;
}
