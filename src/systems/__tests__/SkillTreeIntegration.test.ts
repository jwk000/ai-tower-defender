import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Attack, Faction, FactionTeam, Position, UnitCategory, UnitTag } from '../../core/components.js';
import { attemptPurchaseSkill, type SkillTreeConfig, type SkillTreeState } from '../../ui/SkillTreePanel.js';

const MOCK_SKILL_TREE: SkillTreeConfig = {
  unitId: 'arrow_tower',
  nodes: [
    {
      id: 'arrow_tower.boost_attack_speed',
      label: 'Quick Draw',
      description: 'Attack speed +30%',
      costSP: 2,
      effect: { type: 'boost_attack_speed', multiplier: 1.3 },
    },
    {
      id: 'arrow_tower.add_extra_target',
      label: 'Multi-Shot',
      description: 'Hit one extra target',
      costSP: 3,
      effect: { type: 'add_extra_target', count: 1 },
    },
  ],
};

function spawnTowerEid(game: Game): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Attack, eid);
  addComponent(game.world, UnitTag, eid);
  Position.x[eid] = 100;
  Position.y[eid] = 100;
  Faction.team[eid] = FactionTeam.Player;
  Attack.damage[eid] = 10;
  Attack.range[eid] = 200;
  Attack.cooldown[eid] = 1.0;
  Attack.cooldownLeft[eid] = 0;
  Attack.extraTargets[eid] = 0;
  UnitTag.category[eid] = UnitCategory.Tower;
  return eid;
}

describe('SkillTree → RuleEngine integration', () => {
  it('boost_attack_speed handler shortens Attack.cooldown by multiplier', () => {
    const game = new Game();
    game.ruleEngine.registerHandler('boost_attack_speed', (eid, params) => {
      const multiplier = typeof params?.multiplier === 'number' ? params.multiplier : 1;
      if (multiplier > 0) {
        Attack.cooldown[eid] = Attack.cooldown[eid]! / multiplier;
      }
    });

    const eid = spawnTowerEid(game);
    expect(Attack.cooldown[eid]).toBeCloseTo(1.0, 5);

    game.ruleEngine.dispatch('onSkillUnlock', eid, game.world);
    game.ruleEngine.attachRules(eid, 'onSkillUnlock', [
      { handler: 'boost_attack_speed', params: { multiplier: 1.3 } },
    ]);
    game.ruleEngine.dispatch('onSkillUnlock', eid, game.world);

    expect(Attack.cooldown[eid]).toBeCloseTo(1.0 / 1.3, 5);
  });

  it('add_extra_target handler increments Attack.extraTargets', () => {
    const game = new Game();
    game.ruleEngine.registerHandler('add_extra_target', (eid, params) => {
      const count = typeof params?.count === 'number' ? params.count : 0;
      if (count > 0) {
        Attack.extraTargets[eid] = (Attack.extraTargets[eid] ?? 0) + count;
      }
    });

    const eid = spawnTowerEid(game);
    expect(Attack.extraTargets[eid]).toBe(0);

    game.ruleEngine.attachRules(eid, 'onSkillUnlock', [
      { handler: 'add_extra_target', params: { count: 1 } },
    ]);
    game.ruleEngine.dispatch('onSkillUnlock', eid, game.world);

    expect(Attack.extraTargets[eid]).toBe(1);
  });

  it('attemptPurchaseSkill returns correct effect for boost_attack_speed', () => {
    const state: SkillTreeState = {
      config: MOCK_SKILL_TREE,
      sp: 5,
      purchased: new Set(),
    };
    const result = attemptPurchaseSkill(state, 'arrow_tower.boost_attack_speed');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.effect).toEqual({ type: 'boost_attack_speed', multiplier: 1.3 });
      expect(result.newSp).toBe(3);
    }
  });

  it('attemptPurchaseSkill returns correct effect for add_extra_target', () => {
    const state: SkillTreeState = {
      config: MOCK_SKILL_TREE,
      sp: 5,
      purchased: new Set(),
    };
    const result = attemptPurchaseSkill(state, 'arrow_tower.add_extra_target');
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.effect).toEqual({ type: 'add_extra_target', count: 1 });
      expect(result.newSp).toBe(2);
    }
  });
});
