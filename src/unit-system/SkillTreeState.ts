export type SkillTreeError =
  | 'INSUFFICIENT_SP'
  | 'INSTANCE_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'PREREQUISITE_NOT_MET'
  | 'NODE_ALREADY_ACTIVE'
  | 'PATH_NOT_FOUND'
  | 'PATH_NOT_ACTIVATABLE'
  | 'UNIT_DEPLOYED'
  | 'ALREADY_EQUIPPED';

export interface SkillTreeEffect {
  readonly rule: string;
  readonly [key: string]: unknown;
}

export interface SkillTreeNodeConfig {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
  readonly spCost: number;
  readonly prerequisites: readonly string[];
  readonly effects: readonly SkillTreeEffect[];
}

export interface SkillTreePathConfig {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly SkillTreeNodeConfig[];
}

export interface CardSkillTreeConfig {
  readonly unitCardId: string;
  readonly paths: readonly SkillTreePathConfig[];
}

export interface CardSkillTreeState {
  readonly unitCardId: string;
  readonly config: CardSkillTreeConfig;
  readonly activeNodes: Set<string>;
  equippedPath: string | null;
}

export interface SkillTreeState {
  readonly instances: Map<string, CardSkillTreeState>;
}

export interface SerializedCardSkillTreeState {
  readonly unitCardId: string;
  readonly activeNodes: readonly string[];
  readonly equippedPath: string | null;
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
      equippedPath: s.equippedPath,
    },
  }));
  return { instances };
}
