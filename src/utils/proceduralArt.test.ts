import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllUnitConfigs } from '../config/loader.js';
import { unitConfigRegistry, type UnitConfig } from '../config/registry.js';
import { getProceduralVisualParts } from './proceduralArt.js';

const VISIBLE_CATEGORIES = ['Tower', 'Soldier', 'Trap', 'Enemy'] as const;

function visibleUnits(): UnitConfig[] {
  return unitConfigRegistry
    .getAll()
    .filter((unit) => VISIBLE_CATEGORIES.includes(unit.category as (typeof VISIBLE_CATEGORIES)[number]));
}

describe('程序化单位美术系统', () => {
  beforeAll(async () => {
    await loadAllUnitConfigs();
  });

  it('塔、士兵、机关、敌人都能获得复合外观', () => {
    const missing: string[] = [];

    for (const unit of visibleUnits()) {
      const parts = getProceduralVisualParts(unit);
      if (!parts || !parts.bodyParts || parts.bodyParts.length < 2) {
        missing.push(`${unit.category}:${unit.id}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it('士兵和敌人不依赖眼睛，用装备和威胁部件识别', () => {
    for (const unit of visibleUnits()) {
      const parts = getProceduralVisualParts(unit);
      if (unit.category === 'Soldier' || unit.category === 'Enemy') {
        expect(parts.eyes, `${unit.id} eyes`).toBeUndefined();
        expect(parts.bodyParts?.length ?? 0, `${unit.id} bodyParts`).toBeGreaterThanOrEqual(4);
      } else {
        expect(parts.bodyParts?.length ?? 0, `${unit.id} bodyParts`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('不同类别使用不同动效风格', () => {
    const tower = getProceduralVisualParts(unitConfigRegistry.get('arrow_tower')!);
    const soldier = getProceduralVisualParts(unitConfigRegistry.get('swordsman')!);
    const flyingEnemy = getProceduralVisualParts(unitConfigRegistry.get('locust')!);

    expect(tower.bobStyle).toBe('static');
    expect(soldier.bobStyle).toBe('walking');
    expect(flyingEnemy.bobStyle).toBe('floating');
  });
});
