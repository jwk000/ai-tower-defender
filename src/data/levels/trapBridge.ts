import type { TrapConfig } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { TRAP_CONFIGS } from '../gameData.js';
import { getProceduralVisualParts } from '../../utils/proceduralArt.js';

export function injectTrapConfigsFromRegistry(): number {
  const traps = unitConfigRegistry.getByCategory('Trap');
  let injected = 0;

  for (const u of traps) {
    const raw = u as Record<string, unknown>;
    const trap = raw.trap as Record<string, unknown> | undefined;
    const trapType = (trap?.type as string) ?? u.id;
    const stats = raw.stats as Record<string, unknown> | undefined;
    const cost = raw.cost as Record<string, unknown> | undefined;
    const visual = raw.visual as Record<string, unknown> | undefined;

    const cfg: TrapConfig = {
      type: trapType,
      name: u.name,
      hp: (stats?.hp as number) ?? 99999,
      defense: (stats?.armor as number) ?? 0,
      magicResist: (stats?.mr as number) ?? 0,
      damagePerSecond: (trap?.damagePerSecond as number) ?? 0,
      radius: (trap?.radius as number) ?? 0,
      cooldown: (trap?.cooldown as number) ?? 0,
      maxTriggers: (trap?.maxTriggers as number) ?? 0,
      color: (visual?.color as string) ?? '#888888',
      size: (visual?.size as number) ?? 28,
      cost: (cost?.build as number) ?? 40,
      shape: (visual?.shape as string) as TrapConfig['shape'],
      outline: (visual?.outline as boolean | undefined) ?? false,
      visualParts: getProceduralVisualParts(u),
      layer: u.layer as string | undefined,
    };

    // 可选属性
    if (trap?.rootDuration) cfg.rootDuration = trap.rootDuration as number;
    if (trap?.stunDuration) cfg.stunDuration = trap.stunDuration as number;
    if (trap?.damage) cfg.damage = trap.damage as number;
    if (trap?.bossImmune) cfg.bossImmune = trap.bossImmune as boolean;
    if (trap?.slowPercent) cfg.slowPercent = trap.slowPercent as number;
    if (trap?.slowDuration) cfg.slowDuration = trap.slowDuration as number;
    if (trap?.killChance) cfg.killChance = trap.killChance as number;
    if (trap?.pushDistance) cfg.pushDistance = trap.pushDistance as number;
    if (trap?.pullDistance) cfg.pullDistance = trap.pullDistance as number;
    if (trap?.range) cfg.range = trap.range as number;

    TRAP_CONFIGS[u.id] = cfg;
    injected += 1;
  }

  return injected;
}
