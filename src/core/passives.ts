export type PassiveSourceType = 'level_modifier' | 'sanctum_modifier' | 'relic';
export type PassiveScope = 'current_level' | 'next_level' | 'next_n_levels' | 'run';

export type PassiveModifierOp = 'add' | 'mul' | 'set';

export interface PassiveStatModifier {
  readonly stat: string;
  readonly op: PassiveModifierOp;
  readonly value: number;
}

export interface PassiveHandlerRef {
  readonly ruleHandlerId: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface PassiveEffectDef {
  readonly id: string;
  readonly description: string;
  readonly targetTags?: readonly string[];
  readonly triggers?: readonly string[];
  readonly modifiers?: readonly PassiveStatModifier[];
  readonly handlers?: readonly PassiveHandlerRef[];
}

export interface PassiveSourceDef {
  readonly id: string;
  readonly sourceType: PassiveSourceType;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly flavor?: string;
  readonly activeScope: PassiveScope;
  readonly durationValue?: number;
  readonly effectRefs: readonly string[];
  readonly tags?: readonly string[];
  readonly category?: string;
}

export interface ActivePassiveSource {
  readonly sourceId: string;
  readonly sourceType: PassiveSourceType;
  readonly name: string;
  readonly description: string;
  readonly activeScope: PassiveScope;
  readonly effectRefs: readonly string[];
  readonly grantedAtLevel?: number;
  readonly remainingLevels?: number;
  readonly category?: string;
}

export interface PassiveHudEntry {
  readonly sourceId: string;
  readonly sourceType: PassiveSourceType;
  readonly name: string;
  readonly description: string;
}
