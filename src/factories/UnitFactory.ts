import { addComponent } from 'bitecs';

import {
  Attack,
  BossTag,
  Faction,
  FactionTeam,
  type FactionTeamValue,
  Health,
  Movement,
  Position,
  SupportAura,
  SummonAura,
  EliteTag,
  UnitCategory,
  type UnitCategoryValue,
  UnitTag,
  Visual,
  VisualShape,
  type VisualShapeValue,
} from '../core/components.js';
import type { LifecycleEvent, Rule } from '../core/RuleEngine.js';
import type { TowerWorld } from '../core/World.js';

export type UnitFactionString = 'Player' | 'Enemy' | 'Neutral';
export type UnitCategoryString =
  | 'Tower'
  | 'Soldier'
  | 'Enemy'
  | 'Building'
  | 'Trap'
  | 'Neutral'
  | 'Objective';
export type UnitVisualShapeString = 'rect' | 'circle' | 'triangle';

export interface UnitStats {
  hp: number;
  atk: number;
  attackSpeed: number;
  range: number;
  speed: number;
}

export interface UnitChargeBehavior {
  multiplier: number;
  duration: number;
  cooldown: number;
}

export interface UnitSupportBehavior {
  radius: number;
  healAmount: number;
  interval: number;
}

export interface UnitSummonBehavior {
  radius: number;
  interval: number;
  unitId: string;
}

export interface UnitVisual {
  shape: UnitVisualShapeString;
  color: number;
  size: number;
}

export type UnitLifecycle = Partial<Record<LifecycleEvent, Rule[]>>;

export interface UnitConfig {
  id: string;
  category: UnitCategoryString;
  faction: UnitFactionString;
  stats: UnitStats;
  visual: UnitVisual;
  isBoss?: boolean;
  charge?: UnitChargeBehavior;
  support?: UnitSupportBehavior;
  summon?: UnitSummonBehavior;
  lifecycle?: UnitLifecycle;
}

export interface SpawnPosition {
  x: number;
  y: number;
}

const FACTION_LOOKUP: Record<UnitFactionString, FactionTeamValue> = {
  Player: FactionTeam.Player,
  Enemy: FactionTeam.Enemy,
  Neutral: FactionTeam.Neutral,
};

const CATEGORY_LOOKUP: Record<UnitCategoryString, UnitCategoryValue> = {
  Tower: UnitCategory.Tower,
  Soldier: UnitCategory.Soldier,
  Enemy: UnitCategory.Enemy,
  Building: UnitCategory.Building,
  Trap: UnitCategory.Trap,
  Neutral: UnitCategory.Neutral,
  Objective: UnitCategory.Objective,
};

const SHAPE_LOOKUP: Record<UnitVisualShapeString, VisualShapeValue> = {
  rect: VisualShape.Square,
  circle: VisualShape.Circle,
  triangle: VisualShape.Triangle,
};

const SUMMON_UNIT_KIND = {
  grunt: 1,
} as const;

export function spawnUnit(world: TowerWorld, config: UnitConfig, at: SpawnPosition): number {
  const team = FACTION_LOOKUP[config.faction];
  if (team === undefined) {
    throw new Error(`UnitFactory: unknown faction "${config.faction}" on unit "${config.id}"`);
  }

  const shape = SHAPE_LOOKUP[config.visual.shape];
  if (shape === undefined) {
    throw new Error(
      `UnitFactory: unknown visual.shape "${config.visual.shape}" on unit "${config.id}"`,
    );
  }

  const category = CATEGORY_LOOKUP[config.category];
  if (category === undefined) {
    throw new Error(`UnitFactory: unknown category "${config.category}" on unit "${config.id}"`);
  }

  const eid = world.addEntity();

  addComponent(world, Position, eid);
  Position.x[eid] = at.x;
  Position.y[eid] = at.y;

  addComponent(world, Health, eid);
  Health.current[eid] = config.stats.hp;
  Health.max[eid] = config.stats.hp;

  addComponent(world, Visual, eid);
  Visual.shape[eid] = shape;
  Visual.color[eid] = config.visual.color;
  Visual.size[eid] = config.visual.size;

  addComponent(world, Faction, eid);
  Faction.team[eid] = team;

  addComponent(world, UnitTag, eid);
  UnitTag.category[eid] = category;

  if (config.id.endsWith('_elite')) {
    addComponent(world, EliteTag, eid);
  }

  if (config.isBoss) {
    addComponent(world, BossTag, eid);
  }

  if (config.stats.speed > 0) {
    addComponent(world, Movement, eid);
    Movement.speed[eid] = config.stats.speed;
    Movement.vx[eid] = 0;
    Movement.vy[eid] = 0;
    Movement.pathIndex[eid] = 0;
    Movement.baseSpeed[eid] = config.stats.speed;
    Movement.chargeMultiplier[eid] = config.charge?.multiplier ?? 1;
    Movement.chargeDuration[eid] = config.charge?.duration ?? 0;
    Movement.chargeCooldown[eid] = config.charge?.cooldown ?? 0;
    Movement.chargeTimer[eid] = config.charge?.duration ?? 0;
    Movement.chargeCooldownLeft[eid] = 0;
  }

  if (config.support) {
    addComponent(world, SupportAura, eid);
    SupportAura.radius[eid] = config.support.radius;
    SupportAura.healAmount[eid] = config.support.healAmount;
    SupportAura.interval[eid] = config.support.interval;
    SupportAura.cooldownLeft[eid] = config.support.interval;
  }

  if (config.summon) {
    const summonKind = SUMMON_UNIT_KIND[config.summon.unitId as keyof typeof SUMMON_UNIT_KIND];
    if (!summonKind) {
      throw new Error(`UnitFactory: unknown summon.unitId "${config.summon.unitId}" on unit "${config.id}"`);
    }
    addComponent(world, SummonAura, eid);
    SummonAura.radius[eid] = config.summon.radius;
    SummonAura.interval[eid] = config.summon.interval;
    SummonAura.cooldownLeft[eid] = config.summon.interval;
    SummonAura.summonUnitKind[eid] = summonKind;
  }

  if (config.stats.range > 0) {
    addComponent(world, Attack, eid);
    Attack.damage[eid] = config.stats.atk;
    Attack.range[eid] = config.stats.range;
    Attack.cooldown[eid] = config.stats.attackSpeed > 0 ? 1 / config.stats.attackSpeed : 0;
    Attack.cooldownLeft[eid] = 0;
    Attack.projectileSpeed[eid] = 480;
  }

  if (config.lifecycle) {
    for (const [event, rules] of Object.entries(config.lifecycle) as Array<
      [LifecycleEvent, Rule[] | undefined]
    >) {
      if (rules && rules.length > 0) {
        world.ruleEngine.attachRules(eid, event, rules);
      }
    }

    const onCreate = config.lifecycle.onCreate;
    if (onCreate && onCreate.length > 0) {
      world.ruleEngine.dispatch('onCreate', eid, world);
    }
  }

  return eid;
}
