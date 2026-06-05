import { describe, expect, it } from 'vitest';
import { loadYamlConfig } from './loader.js';
import { loadLevelsFromYaml } from '../data/levels/yamlBridge.js';
import { WeatherType } from '../types/index.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';

interface LevelWeatherConfig {
  id: string;
  weather: {
    pool: string[];
    initial: string;
  };
}

describe('关卡 YAML 配置', () => {
  it('第3关 YAML 固定下雾天气', async () => {
    const level = await loadYamlConfig<LevelWeatherConfig>('./levels/level-03.yaml');

    expect(level.id).toBe('level_03');
    expect(level.weather.pool).toEqual(['Fog']);
    expect(level.weather.initial).toBe('Fog');
  });

  it('第3关运行时天气解析为 Fog', () => {
    const level = loadLevelsFromYaml().find((cfg) => cfg.id === 'level_03');

    expect(level).toBeDefined();
    expect(level!.weatherPool).toEqual([WeatherType.Fog]);
    expect(level!.weatherFixed).toBe(WeatherType.Fog);
  });

  it('第4关 YAML 固定下雪天气', async () => {
    const level = await loadYamlConfig<LevelWeatherConfig>('./levels/level-04.yaml');

    expect(level.id).toBe('level_04');
    expect(level.weather.pool).toEqual(['Snow']);
    expect(level.weather.initial).toBe('Snow');
  });

  it('第4关运行时天气解析为 Snow', () => {
    const level = loadLevelsFromYaml().find((cfg) => cfg.id === 'level_04');

    expect(level).toBeDefined();
    expect(level!.weatherPool).toEqual([WeatherType.Snow]);
    expect(level!.weatherFixed).toBe(WeatherType.Snow);
  });

  it('所有运行时敌人配置至少有 1 点攻击力', () => {
    for (const [id, config] of Object.entries(ENEMY_CONFIGS)) {
      expect(config.atk, `${id} 的 atk 必须 >= 1，避免进入水晶后不掉血`).toBeGreaterThanOrEqual(1);
    }
  });
});
