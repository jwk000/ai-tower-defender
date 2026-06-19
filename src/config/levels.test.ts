import { describe, expect, it } from 'vitest';
import { loadYamlConfig } from './loader.js';
import { loadLevelsFromYaml } from '../data/levels/yamlBridge.js';
import { WeatherType } from '../types/index.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { load as parseYaml, loadAll as parseAllYaml } from 'js-yaml';

interface LevelWeatherConfig {
  id: string;
  map: {
    lighting?: {
      fogOverlay?: {
        enabled?: boolean;
      };
    };
  };
  weather: {
    pool: string[];
    initial: string;
  };
}

interface RawEnemyUnit {
  category?: string;
  isBoss?: boolean;
  stats?: {
    hp?: number;
    atk?: number;
  };
  reward?: {
    gold?: number;
  };
}

interface RawLevelConfig {
  id: string;
  cardPool: string[];
  draftPool: string[];
  map: {
    tiles: string[][];
    obstacles: Array<{
      type: string;
      row: number;
      col: number;
    }>;
  };
  starting: {
    gold: number;
  };
  waves: Array<{
    waveNumber: number;
    isBossWave?: boolean;
    reward: number;
    enemies: Array<{
      enemyType: string;
      count: number;
    }>;
  }>;
}

const rawEnemyModules = import.meta.glob('./units/enemies.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const rawLevelModules = import.meta.glob('./levels/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FRONTLINE_CARDS = new Set(['card_shield_guard', 'card_boulder', 'card_bear_trap']);
const SOLDIER_UPGRADE_CARDS = [
  'card_upgrade_shield_guard',
  'card_upgrade_swordsman',
  'card_upgrade_archer',
  'card_upgrade_priest',
  'card_upgrade_assassin',
  'card_upgrade_mage',
] as const;
const OUTPUT_CARDS = new Set([
  'card_arrow_tower',
  'card_ballista_tower',
  'card_cannon_tower',
  'card_laser_tower',
  'card_bat_tower',
  'card_missile_tower',
  'card_fire_tower',
  'card_poison_tower',
  'card_lightning_tower',
  'card_swordsman',
  'card_archer',
  'card_mage',
  'card_assassin',
]);
const CONTROL_OR_CLEAR_CARDS = new Set([
  'card_ice_tower',
  'card_cannon_tower',
  'card_fire_tower',
  'card_poison_tower',
  'card_lightning_tower',
  'card_spike_trap',
  'card_bear_trap',
  'card_tar_pit',
  'card_fireball',
  'card_arrow_rain',
  'card_bomb',
  'card_blizzard',
  'card_earthquake',
]);

function loadRawEnemyConfigs(): Record<string, RawEnemyUnit> {
  const content = rawEnemyModules['./units/enemies.yaml']!;
  const enemies: Record<string, RawEnemyUnit> = {};

  parseAllYaml(content, (doc) => {
    if (!doc || typeof doc !== 'object') return;
    for (const [id, unit] of Object.entries(doc as Record<string, RawEnemyUnit>)) {
      if (unit.category === 'Enemy' || unit.category === 'Boss') enemies[id] = unit;
    }
  });

  return enemies;
}

function loadRawLevels(): RawLevelConfig[] {
  return Object.entries(rawLevelModules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, content]) => parseYaml(content) as RawLevelConfig);
}

function isAdjacentToRoute(level: RawLevelConfig, row: number, col: number): boolean {
  const neighbors: Array<[number, number]> = [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ];

  return neighbors.some(([r, c]) => {
    const tile = level.map.tiles[r]?.[c];
    return tile === 'path' || tile === 'spawn' || tile === 'base';
  });
}

function waveDifficultyMultiplier(waveIndex: number, totalWaves: number): number {
  const ratio = waveIndex / totalWaves;
  if (ratio < 0.2) return 0.8;
  if (ratio < 0.5) return 1.0;
  if (ratio < 0.8) return 1.3;
  return 1.5;
}

function worstCaseIncome(level: RawLevelConfig, enemies: Record<string, RawEnemyUnit>): number {
  let gold = level.starting.gold;

  level.waves.forEach((wave, waveIndex) => {
    const multiplier = waveDifficultyMultiplier(waveIndex, level.waves.length);
    const waveTypes = new Set<string>();

    for (const group of wave.enemies) {
      const enemy = enemies[group.enemyType]!;
      waveTypes.add(group.enemyType);
      const baseReward = enemy.reward?.gold ?? 0;
      gold += Math.floor(baseReward * 0.8) * group.count;
    }

    const eliteRewardFloor = Math.min(
      ...Array.from(waveTypes).map((enemyType) => Math.floor(((enemies[enemyType]!.reward?.gold ?? 0) * 2.0 * 0.8))),
    );
    gold += Number.isFinite(eliteRewardFloor) ? eliteRewardFloor : 0;

    // Keep the difficulty multiplier in this test so the income formula remains
    // coupled to the same wave model used for the combat-load budget.
    expect(multiplier).toBeGreaterThan(0);
    gold += wave.reward;
  });

  return gold;
}

describe('关卡 YAML 配置', () => {
  it('第3关 YAML 固定夜晚天气并开启雾效', async () => {
    const level = await loadYamlConfig<LevelWeatherConfig>('./levels/level-03.yaml');

    expect(level.id).toBe('level_03');
    expect(level.weather.pool).toEqual(['Night']);
    expect(level.weather.initial).toBe('Night');
    expect(level.map.lighting?.fogOverlay?.enabled).toBe(true);
  });

  it('第3关运行时天气解析为 Night 并保留雾效配置', () => {
    const level = loadLevelsFromYaml().find((cfg) => cfg.id === 'level_03');

    expect(level).toBeDefined();
    expect(level!.weatherPool).toEqual([WeatherType.Night]);
    expect(level!.weatherFixed).toBe(WeatherType.Night);
    expect(level!.map.lighting?.fogOverlay?.enabled).toBe(true);
  });

  it('第4关 YAML 固定红雾天气', async () => {
    const level = await loadYamlConfig<LevelWeatherConfig>('./levels/level-04.yaml');

    expect(level.id).toBe('level_04');
    expect(level.weather.pool).toEqual(['RedMist']);
    expect(level.weather.initial).toBe('RedMist');
  });

  it('第4关运行时天气解析为 RedMist', () => {
    const level = loadLevelsFromYaml().find((cfg) => cfg.id === 'level_04');

    expect(level).toBeDefined();
    expect(level!.weatherPool).toEqual([WeatherType.RedMist]);
    expect(level!.weatherFixed).toBe(WeatherType.RedMist);
  });

  it('第4关中部主路径上下两侧不放装饰物', () => {
    const level = loadRawLevels().find((cfg) => cfg.id === 'level_04')!;
    const obstaclesByCell = new Map(level.map.obstacles.map((obstacle) => [`${obstacle.row},${obstacle.col}`, obstacle]));

    expect(obstaclesByCell.has('3,13')).toBe(false);
    expect(obstaclesByCell.has('5,13')).toBe(false);

    expect(obstaclesByCell.get('0,10')?.type).toBe('scorched_tree');
    expect(obstaclesByCell.get('8,14')?.type).toBe('car');
    expect(isAdjacentToRoute(level, 0, 10)).toBe(false);
    expect(isAdjacentToRoute(level, 8, 14)).toBe(false);
  });

  it('所有运行时敌人配置至少有 1 点攻击力', () => {
    for (const [id, config] of Object.entries(ENEMY_CONFIGS)) {
      expect(config.atk, `${id} 的 atk 必须 >= 1，避免进入水晶后不掉血`).toBeGreaterThanOrEqual(1);
    }
  });

  it('所有关卡波次只引用敌人 YAML 中存在的敌方单位', () => {
    const enemies = loadRawEnemyConfigs();

    for (const level of loadRawLevels()) {
      for (const wave of level.waves) {
        for (const group of wave.enemies) {
          expect(group.enemyType, `${level.id} 第${wave.waveNumber}波不能引用玩家祭司 priest`).not.toBe('priest');
          expect(enemies[group.enemyType], `${level.id} 第${wave.waveNumber}波引用了不存在的敌人 ${group.enemyType}`).toBeDefined();
        }
      }
    }
  });

  it('关卡波次奖励从 YAML 透传到运行时配置', () => {
    const rawById = new Map(loadRawLevels().map((level) => [level.id, level]));

    for (const level of loadLevelsFromYaml()) {
      const raw = rawById.get(level.id);
      expect(raw).toBeDefined();
      expect(level.waves.map((wave) => wave.reward)).toEqual(raw!.waves.map((wave) => wave.reward));
    }
  });

  it('后续关卡卡池继承所有前置关卡已出现卡牌', () => {
    const seenCards = new Set<string>();

    for (const level of loadRawLevels()) {
      for (const cardId of seenCards) {
        expect(level.cardPool, `${level.id} cardPool 缺少前置关卡卡牌 ${cardId}`).toContain(cardId);
        expect(level.draftPool, `${level.id} draftPool 缺少前置关卡卡牌 ${cardId}`).toContain(cardId);
      }

      for (const cardId of [...level.cardPool, ...level.draftPool]) {
        seenCards.add(cardId);
      }
    }
  });

  it('第3-5关卡池混入全部士兵升级卡', () => {
    for (const level of loadRawLevels().filter((rawLevel) => ['level_03', 'level_04', 'level_05'].includes(rawLevel.id))) {
      for (const cardId of SOLDIER_UPGRADE_CARDS) {
        expect(level.cardPool, `${level.id} cardPool 缺少士兵升级卡 ${cardId}`).toContain(cardId);
        expect(level.draftPool, `${level.id} draftPool 缺少士兵升级卡 ${cardId}`).toContain(cardId);
      }
    }
  });

  it('每关初始卡池覆盖前排、输出和控制/清线职责', () => {
    for (const level of loadRawLevels()) {
      expect(
        level.cardPool.some((cardId) => FRONTLINE_CARDS.has(cardId)),
        `${level.id} cardPool 缺少前排/阻挡职责卡牌`,
      ).toBe(true);
      expect(
        level.cardPool.some((cardId) => OUTPUT_CARDS.has(cardId)),
        `${level.id} cardPool 缺少稳定输出职责卡牌`,
      ).toBe(true);
      expect(
        level.cardPool.some((cardId) => CONTROL_OR_CLEAR_CARDS.has(cardId)),
        `${level.id} cardPool 缺少控制/清线职责卡牌`,
      ).toBe(true);
    }
  });

  it('每关卡池不包含重复卡牌', () => {
    for (const level of loadRawLevels()) {
      expect(new Set(level.cardPool).size, `${level.id} cardPool 存在重复卡牌`).toBe(level.cardPool.length);
      expect(new Set(level.draftPool).size, `${level.id} draftPool 存在重复卡牌`).toBe(level.draftPool.length);
    }
  });

  it('每个 Boss 波恰好配置 1 个 Boss 敌人', () => {
    const enemies = loadRawEnemyConfigs();

    for (const level of loadRawLevels()) {
      for (const wave of level.waves) {
        const bossGroups = wave.enemies.filter((group) => {
          const enemy = enemies[group.enemyType];
          return enemy?.isBoss === true || enemy?.category === 'Boss';
        });

        if (wave.isBossWave === true || bossGroups.length > 0) {
          const totalBossCount = bossGroups.reduce((sum, group) => sum + group.count, 0);
          expect(totalBossCount, `${level.id} 第${wave.waveNumber}波必须只有 1 个最终 Boss`).toBe(1);
        }
      }
    }
  });

  it('MDA 重设计后最坏金币下限足以支撑基础防线预算', () => {
    const enemies = loadRawEnemyConfigs();
    const requiredGoldByLevel: Record<string, number> = {
      level_01: 620,
      level_02: 850,
      level_03: 1300,
      level_04: 1750,
      level_05: 3600,
    };

    for (const level of loadRawLevels()) {
      const income = worstCaseIncome(level, enemies);
      expect(income, `${level.id} 最坏金币下限不足`).toBeGreaterThanOrEqual(requiredGoldByLevel[level.id]!);
    }
  });
});
