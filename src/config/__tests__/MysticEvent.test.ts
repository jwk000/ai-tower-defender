import { describe, it, expect } from 'vitest';

import { parseMysticEventConfig } from '../loader.js';

const VALID = `
id: lucky_merchant
title: Lucky Merchant
description: A peddler offers a deal.
choices:
  - id: accept
    label: Pay 30 gold
    effects:
      - type: spend_gold
        amount: 30
      - type: grant_card
        cardId: arrow_tower
  - id: decline
    label: Walk past
    effects: []
`;

const EVENT_TYPE_FIXTURES = {
  lucky_merchant: `
id: lucky_merchant
title: Lucky Merchant
description: A peddler offers a rare card at a steep discount.
choices:
  - id: accept
    label: Pay 30 gold
    effects:
      - type: spend_gold
        amount: 30
      - type: grant_card
        cardId: arrow_tower_card
  - id: decline
    label: Walk past
    effects: []
`,
  pact_of_blood: `
id: pact_of_blood
title: 鲜血契约 ⚠️
description: 黑暗祭司提出契约：以血肉换取本 Run 所有单位的攻击力暴涨。
choices:
  - id: accept
    label: 接受契约（ATK+30% / 能量上限 -1 两关）
    effects:
      - type: buff_all_atk_percent
        amount: 30
      - type: reduce_energy_cap_temp
        amount: 1
        durationLevels: 2
  - id: refuse
    label: 拒绝（+50G）
    effects:
      - type: grant_gold
        amount: 50
`,
  healing_spring: `
id: healing_spring
title: 治疗泉水 ⚠️
description: 清澈泉水散发疗愈光辉，但传说泉水会"消化"踏入者最珍视的回忆。
choices:
  - id: immerse
    label: 浸入 (+250 HP / 失去 1 张卡)
    effects:
      - type: heal_crystal
        amount: 250
      - type: remove_random_card
        count: 1
  - id: leave
    label: 离开（零代价）
    effects: []
`,
  forge: `
id: forge
title: 卡组熔炉
description: 一座神秘熔炉，可以将本 Run 卡组中的一张卡精炼强化。
choices:
  - id: upgrade
    label: 升级 1 张卡 (-50G)
    effects:
      - type: spend_gold
        amount: 50
      - type: upgrade_random_card
        count: 1
  - id: leave
    label: 离开（零代价）
    effects: []
`,
  cursed_idol: `
id: cursed_idol
title: 诅咒神像 ⚠️
description: 神像散发着诡异光辉，传说亵渎它能获得不义之财。
choices:
  - id: loot
    label: 摸金（+200G / 下关敌人 HP+20%）
    effects:
      - type: grant_gold
        amount: 200
      - type: next_level_enemy_hp_percent
        amount: 20
  - id: leave
    label: 离开（零代价）
    effects: []
`,
  traveler_camp: `
id: traveler_camp
title: 旅人营地
description: 一群旅人围在篝火边，乐意分享旅途中获得的智慧。（SP 按关卡分档：关1-3 +5SP，关4-6 +15SP，关7-8 +30SP）
choices:
  - id: join
    label: 加入（按关卡分档 +SP）
    effects:
      - type: grant_sp_tiered
        tiers:
          - { minLevel: 1, maxLevel: 3, amount: 5 }
          - { minLevel: 4, maxLevel: 6, amount: 15 }
          - { minLevel: 7, maxLevel: 9, amount: 30 }
  - id: leave
    label: 离开（零代价）
    effects: []
`,
  mysterious_chest: `
id: mysterious_chest
title: 神秘宝箱
description: 一个未知魔法封印的宝箱，70% 是金币，30% 是陷阱。
choices:
  - id: open
    label: 开启（70% +150G+10SP / 30% -80HP）
    effects:
      - type: grant_gold_or_damage
        goldAmount: 150
        spAmount: 10
        damageAmount: 80
        successChance: 0.7
  - id: leave
    label: 离开（零代价）
    effects: []
`,
} as const;

describe('parseMysticEventConfig', () => {
  it('parses a well-formed mystic event with two choices', () => {
    const cfg = parseMysticEventConfig(VALID);
    expect(cfg.id).toBe('lucky_merchant');
    expect(cfg.title).toBe('Lucky Merchant');
    expect(cfg.choices).toHaveLength(2);
    expect(cfg.choices[0]!.effects).toHaveLength(2);
    expect(cfg.choices[1]!.effects).toEqual([]);
  });

  it('preserves effect.type and additional fields per effect', () => {
    const cfg = parseMysticEventConfig(VALID);
    const accept = cfg.choices[0]!;
    expect(accept.effects[0]).toMatchObject({ type: 'spend_gold', amount: 30 });
    expect(accept.effects[1]).toMatchObject({ type: 'grant_card', cardId: 'arrow_tower' });
  });

  it('throws when a required top-level field is missing', () => {
    const missing = `
title: No ID
choices:
  - id: a
    label: A
    effects: []
`;
    expect(() => parseMysticEventConfig(missing)).toThrow();
  });

  it('throws when choices array is empty', () => {
    const empty = `
id: x
title: X
description: x
choices: []
`;
    expect(() => parseMysticEventConfig(empty)).toThrow();
  });

  it('covers gamble / hp-trade / remove-card / upgrade / curse-reward / temporary-buff / branch event structures', () => {
    const coverage = Object.entries(EVENT_TYPE_FIXTURES).map(([eventId, yaml]) => {
      const cfg = parseMysticEventConfig(yaml);
      return {
        eventId,
        effectTypes: cfg.choices.flatMap((choice) => choice.effects.map((effect) => effect.type)),
      };
    });

    expect(coverage).toEqual([
      { eventId: 'lucky_merchant', effectTypes: ['spend_gold', 'grant_card'] },
      { eventId: 'pact_of_blood', effectTypes: ['buff_all_atk_percent', 'reduce_energy_cap_temp', 'grant_gold'] },
      { eventId: 'healing_spring', effectTypes: ['heal_crystal', 'remove_random_card'] },
      { eventId: 'forge', effectTypes: ['spend_gold', 'upgrade_random_card'] },
      { eventId: 'cursed_idol', effectTypes: ['grant_gold', 'next_level_enemy_hp_percent'] },
      { eventId: 'traveler_camp', effectTypes: ['grant_sp_tiered'] },
      { eventId: 'mysterious_chest', effectTypes: ['grant_gold_or_damage'] },
    ]);
  });
});
