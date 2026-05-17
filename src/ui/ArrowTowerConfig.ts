export type SkillEffect =
  | { readonly type: 'boost_attack_speed'; readonly multiplier: number }
  | { readonly type: 'add_extra_target'; readonly count: number };

export interface SkillNode {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly costSP: number;
  readonly effect: SkillEffect;
}

export interface SkillTreeConfig {
  readonly unitId: string;
  readonly nodes: readonly SkillNode[];
}

export interface SkillTreeState {
  readonly config: SkillTreeConfig;
  readonly sp: number;
  readonly purchased: ReadonlySet<string>;
}

export type SkillPurchaseResult =
  | { readonly kind: 'success'; readonly unitId: string; readonly nodeId: string; readonly effect: SkillEffect; readonly newSp: number; readonly newPurchased: ReadonlySet<string> }
  | { readonly kind: 'rejected'; readonly reason: 'no-such-node' | 'already-purchased' | 'insufficient-sp' };

export function attemptPurchaseSkill(state: SkillTreeState, nodeId: string): SkillPurchaseResult {
  const node = state.config.nodes.find((n) => n.id === nodeId);
  if (!node) return { kind: 'rejected', reason: 'no-such-node' };
  if (state.purchased.has(nodeId)) return { kind: 'rejected', reason: 'already-purchased' };
  if (state.sp < node.costSP) return { kind: 'rejected', reason: 'insufficient-sp' };
  const newPurchased = new Set(state.purchased);
  newPurchased.add(nodeId);
  return { kind: 'success', unitId: state.config.unitId, nodeId, effect: node.effect, newSp: state.sp - node.costSP, newPurchased };
}

export const ARROW_TOWER_SKILL_TREE: SkillTreeConfig = {
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
