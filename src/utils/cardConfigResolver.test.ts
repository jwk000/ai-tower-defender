import { afterEach, describe, expect, it } from 'vitest';
import { cardConfigRegistry } from '../config/cardRegistry.js';
import { getCardConfigIdCandidates, resolveCardConfig } from './cardConfigResolver.js';

describe('cardConfigResolver', () => {
  afterEach(() => {
    cardConfigRegistry.clear();
  });

  it('将运行时 card_* ID 映射到 YAML 的 *_card 配置 ID', () => {
    cardConfigRegistry.register({
      id: 'ice_tower_card',
      name: '冰塔',
      type: 'unit',
      rarity: 'rare',
      energyCost: 5,
      goldCost: 70,
      unitConfigId: 'ice_tower',
      placement: { targetType: 'tile' },
    });

    expect(getCardConfigIdCandidates('card_ice_tower')).toEqual([
      'card_ice_tower',
      'card_ice_tower_card',
      'ice_tower_card',
    ]);
    expect(resolveCardConfig('card_ice_tower')?.rarity).toBe('rare');
  });
});
