import { SkillTrigger, type SkillConfig } from '../../types/index.js';
import { unitConfigRegistry } from '../../config/registry.js';
import { SKILL_CONFIGS } from '../gameData.js';

function mapTrigger(trigger: string | undefined): SkillTrigger {
  switch (trigger) {
    case 'active':
      return SkillTrigger.Active;
    case 'passive':
    default:
      return SkillTrigger.Passive;
  }
}

export function injectSkillConfigsFromRegistry(): number {
  const allUnits = unitConfigRegistry.getAll();
  let injected = 0;

  for (const u of allUnits) {
    const skills = u.skills as Array<Record<string, unknown>> | undefined;
    if (!skills || skills.length === 0) continue;

    for (const skill of skills) {
      const id = skill['id'] as string;
      if (!id || SKILL_CONFIGS[id]) continue; // 跳过已存在的配置

      const cfg: SkillConfig = {
        id,
        name: (skill['name'] as string) ?? id,
        trigger: mapTrigger(skill['trigger'] as string),
        cooldown: (skill['cooldown'] as number) ?? 0,
        energyCost: (skill['energyCost'] as number) ?? 0,
        range: (skill['range'] as number) ?? 0,
        value: (skill['value'] as number) ?? 0,
        buffId: (skill['buffId'] as string) ?? null,
        description: (skill['description'] as string) ?? '',
      };

      SKILL_CONFIGS[id] = cfg;
      injected += 1;
    }
  }

  return injected;
}
