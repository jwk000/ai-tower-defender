import { WeatherType, type WeatherConfig } from '../types/index.js';

/** v4.0: 天气仅保留视觉数据，移除战斗数值 modifiers */
export const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig> = {
  [WeatherType.Sunny]: {
    type: WeatherType.Sunny,
    name: '晴天',
    modifiers: [],
    screenTint: 'rgba(255,255,200,0.05)',
    screenAlpha: 0.05,
  },

  [WeatherType.Rain]: {
    type: WeatherType.Rain,
    name: '下雨',
    modifiers: [],
    screenTint: 'rgba(30,60,120,0.18)',
    screenAlpha: 0.18,
  },

  [WeatherType.Snow]: {
    type: WeatherType.Snow,
    name: '下雪',
    modifiers: [],
    screenTint: 'rgba(200,220,240,0.10)',
    screenAlpha: 0.10,
  },

  [WeatherType.Fog]: {
    type: WeatherType.Fog,
    name: '下雾',
    modifiers: [],
    screenTint: 'rgba(180,190,200,0.30)',
    screenAlpha: 0.30,
  },

  [WeatherType.Night]: {
    type: WeatherType.Night,
    name: '夜晚',
    modifiers: [],
    screenTint: 'rgba(10,15,40,0.45)',
    screenAlpha: 0.45,
  },
};
