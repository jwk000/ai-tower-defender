import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllUnitConfigs } from '../config/loader.js';
import { unitConfigRegistry, type UnitConfig } from '../config/registry.js';
import { getProceduralVisualParts } from './proceduralArt.js';

const VISIBLE_CATEGORIES = ['Tower', 'Soldier', 'Trap', 'Enemy', 'Boss'] as const;

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

  it('所有 Boss 使用最高复杂度复合外观并带动画效果', () => {
    const bosses = unitConfigRegistry.getByCategory('Boss');

    expect(bosses.length).toBeGreaterThanOrEqual(5);
    for (const boss of bosses) {
      const parts = getProceduralVisualParts(boss);
      const bodyParts = parts.bodyParts ?? [];
      const haloParts = bodyParts.filter((p) => p.stroke && p.alpha !== undefined && p.alpha < 0.2);
      const armoredParts = bodyParts.filter((p) => p.stroke === '#ffd54f' || p.stroke === '#ffffff');

      expect(parts.eyes, `${boss.id} eyes`).toBeUndefined();
      expect(parts.bobStyle, `${boss.id} bobStyle`).not.toBe('static');
      expect(bodyParts.length, `${boss.id} bodyParts`).toBeGreaterThanOrEqual(12);
      expect(haloParts.length, `${boss.id} haloParts`).toBeGreaterThanOrEqual(1);
      expect(armoredParts.length, `${boss.id} armoredParts`).toBeGreaterThanOrEqual(3);
    }
  });
});
