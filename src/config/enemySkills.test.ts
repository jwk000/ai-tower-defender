import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllUnitConfigs } from './loader.js';
import { unitConfigRegistry, type UnitConfig } from './registry.js';

function isBoss(config: UnitConfig): boolean {
  return config.isBoss === true || config.category === 'Boss';
}

function isElite(config: UnitConfig): boolean {
  return !isBoss(config) && config.tier === 'L2';
}

function getSkills(config: UnitConfig): unknown[] {
  return Array.isArray(config.skills) ? config.skills : [];
}

describe('敌人技能完整性配置', () => {
  beforeAll(async () => {
    await loadAllUnitConfigs();
  });

  it('所有精英怪（tier=L2）必须且仅有 1 个技能', () => {
    const elites = unitConfigRegistry.getAll().filter(isElite);
    expect(elites.length, '测试应覆盖当前 YAML 中的精英怪').toBeGreaterThan(0);

    const missing = elites
      .filter((config) => getSkills(config).length !== 1)
      .map((config) => `${config.id}(${getSkills(config).length})`);

    expect(missing, `精英怪技能数量不符合要求: ${missing.join(', ')}`).toEqual([]);
  });

  it('所有 Boss 必须有 1 个以上技能', () => {
    const bosses = unitConfigRegistry.getAll().filter(isBoss);
    expect(bosses.length, '测试应覆盖当前 YAML 中的 Boss').toBeGreaterThan(0);

    const missing = bosses
      .filter((config) => getSkills(config).length < 1)
      .map((config) => config.id);

    expect(missing, `Boss 缺少技能配置: ${missing.join(', ')}`).toEqual([]);
  });

  it('敌人技能必须具备运行所需字段', () => {
    const enemies = unitConfigRegistry
      .getAll()
      .filter((config) => ['Enemy', 'enemy', 'Boss'].includes(String(config.category)));

    const invalid: string[] = [];
    for (const config of enemies) {
      for (const skill of getSkills(config)) {
        const record = skill as Record<string, unknown>;
        for (const field of ['id', 'name', 'cooldown', 'range', 'value', 'description']) {
          if (record[field] === undefined) invalid.push(`${config.id}.${String(record.id)} 缺少 ${field}`);
        }
      }
    }

    expect(invalid).toEqual([]);
  });

  it('本次补充的精英/Boss 技能不能误挂到非授权普通敌人', () => {
    const forcedSkillIds = new Set([
      'shield_wall',
      'arcane_bolt',
      'unstable_countdown',
      'burrow_phase',
      'carapace_guard',
      'frost_guard',
      'yeti_charge',
      'snowblind',
      'brine_ram',
      'piercing_lance',
      'building_lock',
      'rail_charge',
      'spore_burst',
      'spore_spawn',
      'blight_pool',
      'frost_pierce',
      'blood_rebirth',
      'slime_split_pulse',
      'summon_desert_beetles',
      'summon_skeletons',
      'targeted_missile',
      'dark_devour',
    ]);
    const allowedNormalEnemySkills = new Set([
      'burrow_beetle.burrow_phase',
    ]);
    const misplaced: string[] = [];

    for (const config of unitConfigRegistry.getAll()) {
      if (isElite(config) || isBoss(config)) continue;
      for (const skill of getSkills(config)) {
        const id = (skill as Record<string, unknown>).id;
        if (typeof id === 'string' && forcedSkillIds.has(id)) {
          const key = `${config.id}.${id}`;
          if (!allowedNormalEnemySkills.has(key)) {
            misplaced.push(key);
          }
        }
      }
    }

    expect(misplaced).toEqual([]);
  });
});
