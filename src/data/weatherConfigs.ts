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

  [WeatherType.RedMist]: {
    type: WeatherType.RedMist,
    name: '红雾',
    modifiers: [],
    screenTint: 'rgba(120,15,12,0.34)',
    screenAlpha: 0.34,
  },

  [WeatherType.Sandstorm]: {
    type: WeatherType.Sandstorm,
    name: '沙暴',
    modifiers: [],
    screenTint: 'rgba(210,170,90,0.28)',
    screenAlpha: 0.28,
  },

  [WeatherType.Blizzard]: {
    type: WeatherType.Blizzard,
    name: '暴风雪',
    modifiers: [],
    screenTint: 'rgba(220,235,250,0.22)',
    screenAlpha: 0.22,
  },

  [WeatherType.Storm]: {
    type: WeatherType.Storm,
    name: '暴雨',
    modifiers: [],
    screenTint: 'rgba(20,40,80,0.30)',
    screenAlpha: 0.30,
  },

  [WeatherType.Smog]: {
    type: WeatherType.Smog,
    name: '煤烟',
    modifiers: [],
    screenTint: 'rgba(60,55,50,0.32)',
    screenAlpha: 0.32,
  },

  [WeatherType.SporeMist]: {
    type: WeatherType.SporeMist,
    name: '孢子雾',
    modifiers: [],
    screenTint: 'rgba(150,80,160,0.28)',
    screenAlpha: 0.28,
  },

  [WeatherType.Void]: {
    type: WeatherType.Void,
    name: '虚空',
    modifiers: [],
    screenTint: 'rgba(60,20,90,0.40)',
    screenAlpha: 0.40,
  },

} as const;
