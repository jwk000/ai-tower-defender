import type { VictoryConfig } from '../types/index.js';

/** 胜利界面默认配置 — 关卡 YAML 未指定的字段使用此默认值 */
export const DEFAULT_VICTORY_CONFIG: Omit<VictoryConfig, 'story' | 'audio'> = {
  background: {
    filter: 'gray_tint',
    gradient: { top: '#000000', mid: '#1a1a2e', bottom: '#0a0a14' },
    particles: [],
  },
  confetti: {
    count: 60,
    burst: 'top_fall',
    colors: [['#ffd700', '#ff8c00', '#ffffff']],
    shapes: { ribbon: 0.6, sparkle: 0.4 },
    duration: 3.0,
    spread: 0.7,
  },
  typography: {
    titleColor: ['#ffd700', '#ffffff'],
    panelBg: 'rgba(10, 14, 22, 0.85)',
    panelBorder: '#ffd700',
    storyColor: '#ffffff',
    accentColor: '#ffd700',
  },
};
