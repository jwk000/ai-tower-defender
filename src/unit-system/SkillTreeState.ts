export type SkillTreeError =
  | 'INSUFFICIENT_GOLD'
  | 'INSTANCE_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'PREREQUISITE_NOT_MET'
  | 'NODE_ALREADY_ACTIVE';

export interface SkillTreeEffect {
  readonly rule: string;
  readonly [key: string]: unknown;
}

export interface SkillTreeNodeConfig {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly goldCost: number;
  readonly prerequisites: readonly string[];
  readonly effects: readonly SkillTreeEffect[];
}

export interface CardSkillTreeConfig {
  readonly unitCardId: string;
  readonly nodes: readonly SkillTreeNodeConfig[];
}

export interface CardSkillTreeState {
  readonly unitCardId: string;
  readonly config: CardSkillTreeConfig;
  readonly activeNodes: Set<string>;
}

export interface SkillTreeState {
  readonly instances: Map<string, CardSkillTreeState>;
}

export interface SerializedCardSkillTreeState {
  readonly unitCardId: string;
  readonly activeNodes: readonly string[];
}

export interface SerializedSkillTreeState {
  readonly instances: ReadonlyArray<{ readonly instanceId: string; readonly state: SerializedCardSkillTreeState }>;
}

export function createSkillTreeState(): SkillTreeState {
  return { instances: new Map() };
}

export function serializeSkillTreeState(state: SkillTreeState): SerializedSkillTreeState {
  const instances = [...state.instances.entries()].map(([instanceId, s]) => ({
    instanceId,
    state: {
      unitCardId: s.unitCardId,
      activeNodes: [...s.activeNodes],
    },
  }));
  return { instances };
}
