import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENEMY_ID_BY_TYPE, ENEMY_TYPE_BY_ID, TRAP_TYPE_VAL, UNIT_ID_BY_TYPE, UNIT_TYPE_BY_ID } from '../data/gameData.js';
import { TOWER_TYPE_ID } from '../systems/UnitFactory.js';
import { EnemyType, TowerType, UnitType } from '../types/index.js';
import { load as parseYaml, loadAll as parseAllYaml } from 'js-yaml';

interface RawCardConfig {
  unitConfigId?: string;
  type?: string;
}

interface RawLevelConfig {
  id: string;
  waves: Array<{
    waveNumber: number;
    enemies: Array<{ enemyType: string }>;
  }>;
}

interface RawUnitConfig {
  category?: string;
  trap?: { type?: string };
}

const rawCardModules = import.meta.glob('./cards/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const rawLevelModules = import.meta.glob('./levels/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const rawUnitModules = import.meta.glob('./units/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

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

const TRAP_TYPE_BY_ID = ['spike_trap', 'bear_trap', 'tar_pit', 'boulder'] as const;

function parseRecord<T>(content: string): Record<string, T> {
  return (parseYaml(content) ?? {}) as Record<string, T>;
}

function parseAllRecords<T>(content: string): Record<string, T> {
  const records: Record<string, T> = {};
  parseAllYaml(content, (doc) => {
    if (doc && typeof doc === 'object') {
      Object.assign(records, doc as Record<string, T>);
    }
  });
  return records;
}

function loadRawUnits(): Record<string, RawUnitConfig> {
  const units: Record<string, RawUnitConfig> = {};
  for (const content of Object.values(rawUnitModules)) {
    Object.assign(units, parseAllRecords<RawUnitConfig>(content));
  }
  return units;
}

function loadRawCards(): Record<string, RawCardConfig> {
  const cards: Record<string, RawCardConfig> = {};
  for (const content of Object.values(rawCardModules)) {
    Object.assign(cards, parseRecord<RawCardConfig>(content));
  }
  return cards;
}

function loadRawLevels(): RawLevelConfig[] {
  return Object.values(rawLevelModules)
    .map((content) => parseYaml(content) as RawLevelConfig)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function expectUnitSprite(artId: string, context: string): void {
  const spritePath = join(process.cwd(), 'public/art/units', `unit_${artId}_idle_0.png`);
  expect(existsSync(spritePath), `${context} 缺少场景贴图 ${spritePath}`).toBe(true);
}

describe('运行时单位类型映射一致性', () => {
  it('关卡波次引用的敌人都能映射到 EnemyType、类型编号和场景贴图', () => {
    for (const level of loadRawLevels()) {
      for (const wave of level.waves) {
        for (const group of wave.enemies) {
          const enemyType = group.enemyType as EnemyType;
          const context = `${level.id} 第${wave.waveNumber}波敌人 ${group.enemyType}`;

          expect(Object.values(EnemyType), `${context} 不在 EnemyType 中`).toContain(enemyType);
          const typeNum = ENEMY_ID_BY_TYPE[enemyType];
          expect(typeNum, `${context} 缺少 ENEMY_ID_BY_TYPE 映射`).toBeDefined();
          expect(ENEMY_TYPE_BY_ID[typeNum], `${context} 类型编号反查不一致`).toBe(enemyType);
          expectUnitSprite(`enemy_${enemyType}`, context);
        }
      }
    }
  });

  it('卡牌引用的士兵、塔和机关都能映射到运行时类型编号和场景贴图', () => {
    const units = loadRawUnits();
    const cards = loadRawCards();

    for (const [cardId, card] of Object.entries(cards)) {
      if (!card.unitConfigId) continue;
      const unit = units[card.unitConfigId];
      const context = `卡牌 ${cardId} 引用 ${card.unitConfigId}`;

      expect(unit, `${context} 的单位配置不存在`).toBeDefined();
      if (!unit) continue;

      if (unit.category === 'Soldier') {
        const unitType = card.unitConfigId as UnitType;
        expect(Object.values(UnitType), `${context} 不在 UnitType 中`).toContain(unitType);
        const typeNum = UNIT_ID_BY_TYPE[unitType];
        expect(typeNum, `${context} 缺少 UNIT_ID_BY_TYPE 映射`).toBeDefined();
        expect(UNIT_TYPE_BY_ID[typeNum], `${context} 类型编号反查不一致`).toBe(unitType);
        expectUnitSprite(unitType, context);
      } else if (unit.category === 'Tower') {
        const towerType = TOWER_CONFIG_ID_TO_TYPE[card.unitConfigId];
        expect(towerType, `${context} 无法映射到 TowerType`).toBeDefined();
        if (!towerType) continue;
        expect(TOWER_TYPE_ID[towerType], `${context} 缺少 TOWER_TYPE_ID 映射`).toBeDefined();
        expectUnitSprite(`tower_${towerType}`, context);
      } else if (unit.category === 'Trap') {
        const trapType = unit.trap?.type;
        expect(trapType, `${context} 缺少 trap.type`).toBeDefined();
        if (!trapType) continue;
        const trapTypeNum = TRAP_TYPE_VAL[trapType];
        expect(trapTypeNum, `${context} 缺少 TRAP_TYPE_VAL 映射`).toBeDefined();
        if (trapTypeNum === undefined) continue;
        const sceneArtId = TRAP_TYPE_BY_ID[trapTypeNum];
        expect(sceneArtId, `${context} 类型编号反查不一致`).toBeDefined();
        if (sceneArtId) expectUnitSprite(sceneArtId, context);
      }
    }
  });
});
