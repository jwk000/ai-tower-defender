// ============================================================
// Tower Defender — EnemySkillSystem (v5.0)
//
// Data-driven boss skill execution for YAML-configured bosses.
// Reads skill definitions from unitConfigRegistry and executes
// them based on cooldown timers. Handles 9 new bosses with 14+ skills.
//
// 对应设计文档: design/03-units.md §6
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Health, Boss, Faction, FactionVal,
  Attack, Movement, UnitTag, Visual, Category, CategoryVal,
  Tower, ScreenShake, Elite,
  MoveModeVal, DamageTypeVal, ShapeVal, Layer, LayerVal,
  EnemySkillParticleEffect, EnemySkillParticleEffectVal, Burrowed,
} from '../core/components.js';
import { unitConfigRegistry } from '../config/registry.js';
import { Sound, type SfxKey } from '../utils/Sound.js';
import { getPhaseSfx, getSummonSfx } from '../utils/audioKeys.js';
import { hexToRgb } from '../utils/visualHelpers.js';

// ============================================================
// Entity → Config ID mapping (bitecs can't store strings)
// ============================================================

const entityConfigId = new Map<number, string>();
const genericSkillTimers = new Map<number, number[]>();
const temporaryArmorBonuses = new Map<number, Array<{ amount: number; timer: number }>>();
const ABYSS_LORD_BOSS_TYPE = 4; // Keep in sync with BossType.AbyssLord without importing BossSystem.

/** Register an enemy entity with its YAML config ID */
export function registerEnemySkillEntity(eid: number, configId: string): void {
  entityConfigId.set(eid, configId);
}

/** Backward-compatible alias for older Boss-only call sites/tests. */
export const registerBossEntity = registerEnemySkillEntity;

/** Unregister a boss entity (on death/cleanup) */
export function unregisterBossEntity(eid: number): void {
  entityConfigId.delete(eid);
  genericSkillTimers.delete(eid);
}

/** Get config ID for a boss entity */
export function getBossConfigId(eid: number): string | undefined {
  return entityConfigId.get(eid);
}

// ============================================================
// Skill config interface
// ============================================================

interface BossSkillConfig {
  id: string;
  name: string;
  cooldown: number;
  range: number;
  value: number;
  duration?: number;
  buffId?: string;
  unitId?: string;
  description: string;
}

// ============================================================
// Queries
// ============================================================

const bossQuery = defineQuery([Position, Health, Boss, Faction]);
const skilledEnemyQuery = defineQuery([Position, Health, UnitTag, Faction]);
const towerQuery = defineQuery([Position, Health, Tower]);
const allPositionedQuery = defineQuery([Position]);

// ============================================================
// Screen shake helper (shared with BossSystem)
// ============================================================

function triggerScreenShake(world: TowerWorld, intensity: number, duration: number, frequency: number): void {
  const eid = world.createEntity();
  world.addComponent(eid, ScreenShake, { intensity, duration, elapsed: 0, frequency });
}

// ============================================================
// Spawn minion helper
// ============================================================

function spawnMinion(
  world: TowerWorld,
  x: number, y: number,
  config: {
    hp: number; atk: number; speed: number;
    armor?: number; mr?: number;
    name: string;
    color: string;
    size: number;
    shape?: number;
    faction?: number;
    attackRange?: number;
    attackSpeed?: number;
    canAttackBuildings?: boolean;
    rewardGold?: number;
    moveMode?: number;
  },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, {
    current: config.hp, max: config.hp,
    armor: config.armor ?? 0, magicResist: config.mr ?? 0,
  });
  world.addComponent(eid, Faction, { value: config.faction ?? FactionVal.Evil });
  world.addComponent(eid, Category, { value: CategoryVal.Enemy });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    atk: config.atk,
    rewardGold: config.rewardGold ?? 5,
    canAttackBuildings: config.canAttackBuildings ? 1 : 0,
  });

  const rgb = hexToRgb(config.color);
  world.addComponent(eid, Visual, {
    shape: config.shape ?? ShapeVal.Circle,
    colorR: rgb.r, colorG: rgb.g, colorB: rgb.b,
    size: config.size, alpha: 1, outline: 1, facing: 1,
    hitFlashTimer: 0, idlePhase: Math.random(),
    bobPhase: 0, breathPhase: Math.random() * Math.PI * 2,
    attackAnimTimer: 0, attackAnimDuration: 0.3, partsId: 0,
  });

  world.addComponent(eid, Attack, {
    damage: config.atk,
    attackSpeed: config.attackSpeed ?? 0.4,
    range: config.attackRange ?? 32,
    damageType: DamageTypeVal.Physical,
    isRanged: (config.attackRange ?? 32) > 60 ? 1 : 0,
    canTargetLowAir: 0,
    alertRange: 200,
    cooldownTimer: 0, targetId: 0,
    targetSelection: 0, attackMode: 0,
    splashRadius: 0, chainCount: 0, chainRange: 0, chainDecay: 0,
    drainPercent: 0, tauntCapacity: 0, attackerCount: 0,
  });

  world.addComponent(eid, Movement, {
    speed: config.speed,
    currentSpeed: config.speed,
    moveMode: config.moveMode ?? MoveModeVal.FollowPath,
    targetX: 0, targetY: 0, pathIndex: 0, progress: 0, spawnIdx: 0,
    homeX: x, homeY: y, moveRange: 0,
  });

  world.setDisplayName(eid, config.name);
  return eid;
}

// ============================================================
// AOE damage helper
// ============================================================

function dealAoeDamage(
  world: TowerWorld,
  centerX: number, centerY: number,
  radius: number, damage: number,
  targetFaction: number,
  options?: {
    knockback?: number;
    slowPercent?: number;
    slowDuration?: number;
    damageType?: number;
    falloff?: boolean;
  },
): number {
  const allEntities = allPositionedQuery(world.world);
  let hitCount = 0;

  for (let i = 0; i < allEntities.length; i++) {
    const eid = allEntities[i]!;
    const hp = Health.current[eid];
    if (hp === undefined || hp <= 0) continue;

    const faction = Faction.value[eid];
    if (faction !== targetFaction) continue;

    const ex = Position.x[eid] ?? 0;
    const ey = Position.y[eid] ?? 0;
    const dx = ex - centerX;
    const dy = ey - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= radius) {
      let dmg = damage;
      if (options?.falloff) {
        dmg = Math.round(damage * (1 - dist / radius));
      }
      if (dmg > 0) {
        Health.current[eid] = Math.max(0, hp - dmg);
        hitCount++;
      }

      // Knockback
      if (options?.knockback && dist > 0) {
        const kb = options.knockback;
        const nx = dx / dist;
        const ny = dy / dist;
        Position.x[eid] = ex + nx * kb;
        Position.y[eid] = ey + ny * kb;
        if (Movement.speed[eid] !== undefined) {
          if (Movement.homeX[eid] !== undefined) Movement.homeX[eid]! += nx * kb;
          if (Movement.homeY[eid] !== undefined) Movement.homeY[eid]! += ny * kb;
        }
      }

      // Slow (set hitFlashTimer as visual indicator, reduce speed)
      if (options?.slowPercent && options?.slowDuration) {
        const currentSpeed = Movement.speed[eid];
        if (currentSpeed !== undefined) {
          Movement.speed[eid] = currentSpeed * (1 - options.slowPercent);
          // Speed will be restored by BuffSystem or a timer — for simplicity, use hitFlashTimer
          // In production, this should use the BuffSystem
        }
      }
    }
  }
  return hitCount;
}

// ============================================================
// Enemy skill particle helpers
// ============================================================

export function createSkillParticles(
  world: TowerWorld,
  x: number, y: number,
  effectType: number,
  color: { r: number; g: number; b: number },
  radius: number,
  duration: number,
  targetX: number = x,
  targetY: number = y,
): void {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Category, { value: CategoryVal.Effect });
  world.addComponent(eid, EnemySkillParticleEffect, {
    effectType,
    duration,
    elapsed: 0,
    radius,
    targetX,
    targetY,
    colorR: color.r,
    colorG: color.g,
    colorB: color.b,
    seed: Math.random() * 1000,
  });
}

function findNearestTarget(
  world: TowerWorld,
  sourceEid: number,
  radius: number,
  predicate: (eid: number) => boolean,
): number | null {
  const sx = Position.x[sourceEid] ?? 0;
  const sy = Position.y[sourceEid] ?? 0;
  const all = allPositionedQuery(world.world);
  let best: number | null = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const eid of all) {
    if (eid === sourceEid) continue;
    if ((Health.current[eid] ?? 0) <= 0) continue;
    if (!predicate(eid)) continue;

    const dx = (Position.x[eid] ?? 0) - sx;
    const dy = (Position.y[eid] ?? 0) - sy;
    const distSq = dx * dx + dy * dy;
    if (distSq <= radius * radius && distSq < bestDistSq) {
      best = eid;
      bestDistSq = distSq;
    }
  }

  return best;
}

function findWeakestPlayerTarget(world: TowerWorld, sourceEid: number, radius: number): number | null {
  const sx = Position.x[sourceEid] ?? 0;
  const sy = Position.y[sourceEid] ?? 0;
  const all = allPositionedQuery(world.world);
  let best: number | null = null;
  let bestHpRatio = Number.POSITIVE_INFINITY;

  for (const eid of all) {
    if (eid === sourceEid) continue;
    if ((Health.current[eid] ?? 0) <= 0) continue;
    if (Faction.value[eid] !== FactionVal.Justice) continue;

    const dx = (Position.x[eid] ?? 0) - sx;
    const dy = (Position.y[eid] ?? 0) - sy;
    if (dx * dx + dy * dy > radius * radius) continue;

    const ratio = (Health.current[eid] ?? 0) / Math.max(1, Health.max[eid] ?? 1);
    if (ratio < bestHpRatio) {
      best = eid;
      bestHpRatio = ratio;
    }
  }

  return best;
}

function flashEntity(eid: number, duration: number): void {
  if (Visual.hitFlashTimer[eid] !== undefined) {
    Visual.hitFlashTimer[eid] = Math.max(Visual.hitFlashTimer[eid] ?? 0, duration);
  }
}

function applyTemporaryArmor(eid: number, amount: number, duration: number): void {
  Health.armor[eid] = (Health.armor[eid] ?? 0) + amount;
  const bonuses = temporaryArmorBonuses.get(eid) ?? [];
  bonuses.push({ amount, timer: duration });
  temporaryArmorBonuses.set(eid, bonuses);
}

// ============================================================
// Skill handlers
// ============================================================

type SkillHandler = (
  world: TowerWorld,
  bossEid: number,
  skill: BossSkillConfig,
  phase: number,
) => void;

/** Summon units around the boss */
const handleSummon: SkillHandler = (world, bossEid, skill, _phase) => {
  const count = skill.value;
  const bx = Position.x[bossEid] ?? 0;
  const by = Position.y[bossEid] ?? 0;
  const faction = Faction.value[bossEid] ?? FactionVal.Evil;

  // Infer unit type from skill ID
  const unitTypeMap: Record<string, { name: string; color: string; hp: number; atk: number; speed: number; size: number }> = {
    summon_grunts: { name: '小兵', color: '#ef5350', hp: 50, atk: 5, speed: 80, size: 24 },
    summon_burrow_worm: { name: '钻地蠕虫', color: '#8b5a2b', hp: 70, atk: 8, speed: 90, size: 30 },
    summon_kraken: { name: '海妖触手', color: '#5b3a7f', hp: 280, atk: 30, speed: 30, size: 44 },
    summon_drones: { name: '反建筑工蜂', color: '#ffa000', hp: 130, atk: 35, speed: 80, size: 26 },
    summon_brood_mother: { name: '菌母蘑菇', color: '#8d6e63', hp: 380, atk: 0, speed: 0, size: 44 },
    mass_summon: { name: '虚空奴仆', color: '#4a148c', hp: 80, atk: 10, speed: 75, size: 20 },
  };

  const unitInfo = unitTypeMap[skill.id] ?? { name: '召唤物', color: '#ffffff', hp: 50, atk: 5, speed: 60, size: 20 };

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 40 + Math.random() * 40;
    const sx = bx + Math.cos(angle) * dist;
    const sy = by + Math.sin(angle) * dist;

    spawnMinion(world, sx, sy, {
      ...unitInfo,
      faction,
      canAttackBuildings: skill.id === 'summon_drones',
      attackRange: skill.id === 'summon_drones' ? 32 : 32,
    });
  }

  createSkillParticles(
    world,
    bx,
    by,
    EnemySkillParticleEffectVal.Summon,
    { r: 180, g: 120, b: 255 },
    90,
    0.8,
  );
  Sound.play(getSummonSfx(skill.id));
  triggerScreenShake(world, 2, 0.2, 12);
};


/** AOE damage with optional knockback/slow */
const handleAoeAttack: SkillHandler = (world, bossEid, skill, _phase) => {
  const bx = Position.x[bossEid] ?? 0;
  const by = Position.y[bossEid] ?? 0;
  const radius = skill.range;
  const damage = skill.value;

  // Determine effects based on skill ID
  let knockback = 0;
  let slowPercent = 0;
  let slowDuration = 0;
  let color = { r: 255, g: 100, b: 50 };
  let soundKey: SfxKey = 'boss_devour_impact';

  switch (skill.id) {
    case 'ground_slam':
      knockback = 0; slowPercent = 0.5; slowDuration = 2;
      color = { r: 200, g: 150, b: 50 }; break;
    case 'frost_slam':
      knockback = 0; slowPercent = 0.5; slowDuration = 3;
      color = { r: 100, g: 180, b: 255 }; soundKey = 'boss_phase_ice'; break;
    case 'ground_quake':
      knockback = 80; slowPercent = 0; slowDuration = 0;
      color = { r: 160, g: 140, b: 100 }; break;
    case 'tidal_wave':
      knockback = 100; slowPercent = 0; slowDuration = 0;
      color = { r: 30, g: 120, b: 220 }; soundKey = 'boss_missile_impact'; break;
    case 'void_eruption':
      knockback = 60; slowPercent = 0; slowDuration = 0;
      color = { r: 100, g: 20, b: 160 }; soundKey = 'boss_phase_void'; break;
  }

  // Damage enemies (faction = Player/Justice)
  dealAoeDamage(world, bx, by, radius, damage, FactionVal.Justice, {
    knockback, slowPercent, slowDuration, falloff: true,
  });

  // Also damage player towers
  const towers = towerQuery(world.world);
  for (let i = 0; i < towers.length; i++) {
    const tid = towers[i]!;
    const hp = Health.current[tid];
    if (hp === undefined || hp <= 0) continue;
    const tx = Position.x[tid] ?? 0;
    const ty = Position.y[tid] ?? 0;
    const dx = tx - bx;
    const dy = ty - by;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= radius) {
      const dmg = Math.round(damage * (1 - dist / radius));
      if (dmg > 0) Health.current[tid] = Math.max(0, hp - dmg);
    }
  }

  createSkillParticles(world, bx, by, EnemySkillParticleEffectVal.AoeSlam, color, radius, 0.7);
  Sound.play(soundKey);
  triggerScreenShake(world, 6, 0.4, 15);
};

/** Buff nearby friendly enemies */
const handleWarCry: SkillHandler = (world, bossEid, skill, _phase) => {
  const bx = Position.x[bossEid] ?? 0;
  const by = Position.y[bossEid] ?? 0;
  const radius = skill.range;
  const bossFaction = Faction.value[bossEid] ?? FactionVal.Evil;

  const allEntities = allPositionedQuery(world.world);
  for (let i = 0; i < allEntities.length; i++) {
    const eid = allEntities[i]!;
    if (eid === bossEid) continue;
    const hp = Health.current[eid];
    if (hp === undefined || hp <= 0) continue;
    if (Faction.value[eid] !== bossFaction) continue;

    const ex = Position.x[eid] ?? 0;
    const ey = Position.y[eid] ?? 0;
    const dx = ex - bx;
    const dy = ey - by;
    if (Math.sqrt(dx * dx + dy * dy) <= radius) {
      // +30% speed, +20% ATK
      if (Movement.speed[eid] !== undefined) {
        Movement.speed[eid] = Movement.speed[eid]! * 1.3;
      }
      if (Attack.damage[eid] !== undefined) {
        Attack.damage[eid] = Math.round(Attack.damage[eid]! * 1.2);
      }
    }
  }

  createSkillParticles(world, bx, by, EnemySkillParticleEffectVal.WarCry, { r: 255, g: 200, b: 50 }, radius, 0.9);
  Sound.play('boss_phase_enrage');
  triggerScreenShake(world, 3, 0.3, 10);
};

/** Mass petrify — stun all towers in range */
const handleMassPetrify: SkillHandler = (world, bossEid, skill, _phase) => {
  const bx = Position.x[bossEid] ?? 0;
  const by = Position.y[bossEid] ?? 0;
  const radius = skill.range;

  const towers = towerQuery(world.world);
  let petrified = 0;
  for (let i = 0; i < towers.length; i++) {
    const tid = towers[i]!;
    const hp = Health.current[tid];
    if (hp === undefined || hp <= 0) continue;
    const tx = Position.x[tid] ?? 0;
    const ty = Position.y[tid] ?? 0;
    const dx = tx - bx;
    const dy = ty - by;
    if (Math.sqrt(dx * dx + dy * dy) <= radius) {
      // Set hitFlashTimer as petrify visual indicator
      Visual.hitFlashTimer[tid] = skill.duration ?? 4;
      petrified++;
    }
  }

  if (petrified > 0) {
    createSkillParticles(world, bx, by, EnemySkillParticleEffectVal.Petrify, { r: 180, g: 180, b: 180 }, radius, 1.0);
    Sound.play(getPhaseSfx(skill.id));
    triggerScreenShake(world, 4, 0.3, 8);
  }
};

/** Debuff towers — reduce ATK */
const handleRealityWarp: SkillHandler = (world, bossEid, skill, _phase) => {
  const count = skill.value; // number of towers to debuff
  const towers = towerQuery(world.world);

  // Find strongest towers by ATK
  const sorted: number[] = [];
  for (let i = 0; i < towers.length; i++) {
    const tid = towers[i]!;
    if ((Health.current[tid] ?? 0) > 0) sorted.push(tid);
  }
  sorted.sort((a, b) => (Attack.damage[b] ?? 0) - (Attack.damage[a] ?? 0));

  const targets = sorted.slice(0, count);
  for (const tid of targets) {
    // -50% ATK
    if (Attack.damage[tid] !== undefined) {
      Attack.damage[tid] = Math.round(Attack.damage[tid]! * 0.5);
    }
    // Visual indicator
    Visual.hitFlashTimer[tid] = skill.duration ?? 8;
  }

  if (targets.length > 0) {
    createSkillParticles(
      world,
      Position.x[bossEid] ?? 0,
      Position.y[bossEid] ?? 0,
      EnemySkillParticleEffectVal.RealityWarp,
      { r: 180, g: 80, b: 255 },
      skill.range || 180,
      1.0,
    );
    Sound.play(getPhaseSfx(skill.id));
    triggerScreenShake(world, 5, 0.4, 12);
  }
};

/** Self-destruct timer — countdown to defeat */
const handleSelfDestruct: SkillHandler = (_world, bossEid, skill, _phase) => {
  Boss.selfDestructTimer[bossEid] = skill.value; // e.g. 20 seconds
};

const handleSingleTargetDamage: SkillHandler = (world, casterEid, skill, _phase) => {
  const target = findWeakestPlayerTarget(world, casterEid, skill.range);
  if (target === null) return;

  Health.current[target] = Math.max(0, (Health.current[target] ?? 0) - skill.value);
  flashEntity(target, skill.duration ?? 0.25);

  const x = Position.x[target] ?? Position.x[casterEid] ?? 0;
  const y = Position.y[target] ?? Position.y[casterEid] ?? 0;
  createSkillParticles(
    world,
    Position.x[casterEid] ?? x,
    Position.y[casterEid] ?? y,
    EnemySkillParticleEffectVal.ArcaneBolt,
    { r: 190, g: 80, b: 255 },
    36,
    0.45,
    x,
    y,
  );
  Sound.play('mage_attack');
};

const handleSelfGuard: SkillHandler = (world, casterEid, skill, _phase) => {
  const bonus = skill.value;
  applyTemporaryArmor(casterEid, bonus, skill.duration ?? 1);
  flashEntity(casterEid, skill.duration ?? 1);
  createSkillParticles(
    world,
    Position.x[casterEid] ?? 0,
    Position.y[casterEid] ?? 0,
    EnemySkillParticleEffectVal.Guard,
    { r: 120, g: 210, b: 255 },
    52,
    Math.max(0.6, skill.duration ?? 1),
  );
  Sound.play('arcane_shield');
};

const handleChargeStrike: SkillHandler = (world, casterEid, skill, _phase) => {
  const target = findNearestTarget(
    world,
    casterEid,
    skill.range,
    (eid) => Faction.value[eid] === FactionVal.Justice,
  );
  if (target === null) return;

  const tx = Position.x[target] ?? 0;
  const ty = Position.y[target] ?? 0;
  const sx = Position.x[casterEid] ?? tx;
  const sy = Position.y[casterEid] ?? ty;
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const nx = dx / dist;
  const ny = dy / dist;

  Position.x[casterEid] = sx + nx * Math.min(skill.range, dist);
  Position.y[casterEid] = sy + ny * Math.min(skill.range, dist);
  Health.current[target] = Math.max(0, (Health.current[target] ?? 0) - skill.value);
  Position.x[target] = tx + nx * 48;
  Position.y[target] = ty + ny * 48;
  flashEntity(target, 0.4);
  createSkillParticles(
    world,
    sx,
    sy,
    EnemySkillParticleEffectVal.Charge,
    { r: 255, g: 180, b: 60 },
    56,
    0.45,
    Position.x[casterEid] ?? sx,
    Position.y[casterEid] ?? sy,
  );
  Sound.play('enemy_attack');
};

const handleTowerDebuff: SkillHandler = (world, casterEid, skill, _phase) => {
  const target = findNearestTarget(
    world,
    casterEid,
    skill.range,
    (eid) => hasComponent(world.world, Tower, eid),
  );
  if (target === null) return;

  if (Attack.attackSpeed[target] !== undefined && skill.id === 'snowblind') {
    Attack.attackSpeed[target] = Math.max(0.1, Attack.attackSpeed[target]! * 0.5);
  }
  if (Attack.damage[target] !== undefined && skill.id === 'building_lock') {
    Attack.targetId[casterEid] = target;
  }
  flashEntity(target, skill.duration ?? 1);
  createSkillParticles(
    world,
    Position.x[casterEid] ?? 0,
    Position.y[casterEid] ?? 0,
    EnemySkillParticleEffectVal.Debuff,
    { r: 120, g: 210, b: 255 },
    42,
    skill.duration ?? 2,
    Position.x[target] ?? 0,
    Position.y[target] ?? 0,
  );
  Sound.play('stun_apply');
};

const handleSporeSpawn: SkillHandler = (world, casterEid, skill, _phase) => {
  const bx = Position.x[casterEid] ?? 0;
  const by = Position.y[casterEid] ?? 0;
  const count = Math.max(1, Math.round(skill.value));
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    spawnMinion(world, bx + Math.cos(angle) * 48, by + Math.sin(angle) * 48, {
      hp: 60,
      atk: 6,
      speed: 80,
      name: '孢子幼体',
      color: '#a5d6a7',
      size: 20,
      faction: Faction.value[casterEid] ?? FactionVal.Evil,
    });
  }
  createSkillParticles(world, bx, by, EnemySkillParticleEffectVal.Summon, { r: 120, g: 220, b: 120 }, 64, 0.7);
  Sound.play(getSummonSfx(skill.id));
};

const handlePoisonPool: SkillHandler = (world, casterEid, skill, _phase) => {
  const target = findNearestTarget(
    world,
    casterEid,
    skill.range,
    (eid) => Faction.value[eid] === FactionVal.Justice,
  );
  if (target === null) return;
  const x = Position.x[target] ?? 0;
  const y = Position.y[target] ?? 0;
  Health.current[target] = Math.max(0, (Health.current[target] ?? 0) - skill.value);
  createSkillParticles(world, x, y, EnemySkillParticleEffectVal.PoisonPool, { r: 100, g: 190, b: 60 }, 44, skill.duration ?? 3);
  Sound.play('poison_hit');
};

const handleSlimePulse: SkillHandler = (world, bossEid, skill, _phase) => {
  const x = Position.x[bossEid] ?? 0;
  const y = Position.y[bossEid] ?? 0;
  dealAoeDamage(world, x, y, skill.range, skill.value, FactionVal.Justice, {
    slowPercent: 0.35,
    slowDuration: skill.duration ?? 4,
    damageType: DamageTypeVal.Magic,
  });
  createSkillParticles(world, x, y, EnemySkillParticleEffectVal.PoisonPool, { r: 100, g: 220, b: 100 }, skill.range, skill.duration ?? 4);
  createSkillParticles(world, x, y, EnemySkillParticleEffectVal.AoeSlam, { r: 100, g: 220, b: 100 }, skill.range, 0.5);
  Sound.play('boss_phase_enrage');
};

const handleTargetedMissile: SkillHandler = (world, bossEid, skill, _phase) => {
  const target = findNearestTarget(world, bossEid, skill.range, (eid) => hasComponent(world.world, Tower, eid))
    ?? findNearestTarget(world, bossEid, skill.range, (eid) => Faction.value[eid] === FactionVal.Justice);
  if (target === null) return;
  const x = Position.x[target] ?? 0;
  const y = Position.y[target] ?? 0;
  dealAoeDamage(world, x, y, 80, skill.value, FactionVal.Justice, { falloff: true });
  createSkillParticles(world, x, y, EnemySkillParticleEffectVal.Missile, { r: 255, g: 80, b: 40 }, 80, Math.max(0.8, skill.duration ?? 2));
  Sound.play('boss_missile_impact');
  triggerScreenShake(world, 7, 0.4, 16);
};

const handleDarkDevour: SkillHandler = (world, bossEid, skill, _phase) => {
  const bx = Position.x[bossEid] ?? 0;
  const by = Position.y[bossEid] ?? 0;
  const all = allPositionedQuery(world.world);
  let devoured = 0;
  for (const eid of all) {
    if (eid === bossEid) continue;
    if ((Health.current[eid] ?? 0) <= 0) continue;
    if (hasComponent(world.world, Boss, eid)) continue;
    if (Category.value[eid] === CategoryVal.Objective) continue;
    const dx = (Position.x[eid] ?? 0) - bx;
    const dy = (Position.y[eid] ?? 0) - by;
    if (dx * dx + dy * dy <= skill.range * skill.range) {
      Health.current[eid] = 0;
      world.destroyEntity(eid);
      devoured++;
    }
  }
  if (devoured > 0) {
    Health.current[bossEid] = Math.min(
      Health.max[bossEid] ?? Health.current[bossEid] ?? 0,
      (Health.current[bossEid] ?? 0) + (Health.max[bossEid] ?? 0) * (skill.value / 100) * devoured,
    );
  }
  createSkillParticles(world, bx, by, EnemySkillParticleEffectVal.DarkDevour, { r: 80, g: 0, b: 140 }, skill.range, 0.9);
  Sound.play('boss_devour_impact');
  triggerScreenShake(world, 8, 0.5, 12);
};

const handlePassiveWarning: SkillHandler = (world, casterEid, skill, _phase) => {
  flashEntity(casterEid, Math.max(0.5, skill.duration ?? 0.5));
  createSkillParticles(
    world,
    Position.x[casterEid] ?? 0,
    Position.y[casterEid] ?? 0,
    EnemySkillParticleEffectVal.Warning,
    { r: 255, g: 90, b: 40 },
    Math.max(32, skill.range || 40),
    0.35,
  );
};

const handleAuraParticles: SkillHandler = (world, casterEid, skill, _phase) => {
  const isHeal = skill.id === 'heal_aura' || skill.id === 'revive_aura' || skill.id === 'revive';
  const isFrost = skill.id === 'frost_aura';
  const effectType = isHeal
    ? EnemySkillParticleEffectVal.HealAura
    : isFrost
      ? EnemySkillParticleEffectVal.FrostAura
      : EnemySkillParticleEffectVal.Guard;
  const color = isHeal
    ? { r: 120, g: 220, b: 120 }
    : isFrost
      ? { r: 120, g: 210, b: 255 }
      : { r: 255, g: 230, b: 120 };
  createSkillParticles(
    world,
    Position.x[casterEid] ?? 0,
    Position.y[casterEid] ?? 0,
    effectType,
    color,
    Math.max(32, skill.range || 72),
    Math.max(0.9, skill.duration ?? 1.2),
  );
  if (isHeal) Sound.play('soldier_heal');
};

const handleGenericSkillParticles: SkillHandler = (world, casterEid, skill, _phase) => {
  let effectType: number = EnemySkillParticleEffectVal.Warning;
  let color = { r: 220, g: 120, b: 255 };
  if (skill.id.includes('burrow')) {
    effectType = EnemySkillParticleEffectVal.AoeSlam;
    color = { r: 160, g: 110, b: 60 };
  } else if (skill.id.includes('void') || skill.id.includes('blink')) {
    effectType = EnemySkillParticleEffectVal.RealityWarp;
    color = { r: 150, g: 70, b: 255 };
  } else if (skill.id.includes('petrify') || skill.id.includes('polymorph')) {
    effectType = EnemySkillParticleEffectVal.Petrify;
    color = { r: 180, g: 180, b: 180 };
  } else if (skill.id.includes('curse') || skill.id.includes('mark')) {
    effectType = EnemySkillParticleEffectVal.Debuff;
    color = { r: 190, g: 60, b: 255 };
  } else if (skill.id.includes('tendril')) {
    effectType = EnemySkillParticleEffectVal.DarkDevour;
    color = { r: 90, g: 40, b: 140 };
  }

  createSkillParticles(
    world,
    Position.x[casterEid] ?? 0,
    Position.y[casterEid] ?? 0,
    effectType,
    color,
    Math.max(36, skill.range || 64),
    Math.max(0.5, skill.duration ?? 0.8),
  );
};

const handleBurrowPhase: SkillHandler = (world, casterEid, skill, _phase) => {
  if (hasComponent(world.world, Burrowed, casterEid)) return;
  if (!hasComponent(world.world, Movement, casterEid)) return;

  const currentAlpha = Visual.alpha[casterEid] ?? 1;
  const currentLayer = Layer.value[casterEid] ?? LayerVal.Ground;
  world.addComponent(casterEid, Burrowed, {
    distanceRemaining: Math.max(1, skill.value || 3),
    trailEmitTimer: 0,
    originalAlpha: currentAlpha,
    originalLayer: currentLayer,
  });
  if (hasComponent(world.world, Layer, casterEid)) {
    Layer.value[casterEid] = LayerVal.BelowGrid;
  }
  if (hasComponent(world.world, Visual, casterEid)) {
    Visual.alpha[casterEid] = 0;
    Visual.hitFlashTimer[casterEid] = 0;
  }

  createSkillParticles(
    world,
    Position.x[casterEid] ?? 0,
    Position.y[casterEid] ?? 0,
    EnemySkillParticleEffectVal.BurrowTrail,
    { r: 150, g: 105, b: 55 },
    32,
    0.45,
  );
};

// ============================================================
// Skill handler registry
// ============================================================

const SKILL_HANDLERS: Record<string, SkillHandler> = {
  // Summon skills
  summon_grunts: handleSummon,
  summon_burrow_worm: handleSummon,
  summon_desert_beetles: handleSummon,
  summon_skeletons: handleSummon,
  summon_kraken: handleSummon,
  summon_drones: handleSummon,
  summon_brood_mother: handleSummon,
  mass_summon: handleSummon,
  spore_spawn: handleSporeSpawn,
  // AOE skills
  ground_slam: handleAoeAttack,
  frost_slam: handleAoeAttack,
  ground_quake: handleAoeAttack,
  tidal_wave: handleAoeAttack,
  void_eruption: handleAoeAttack,
  slime_split_pulse: handleSlimePulse,
  targeted_missile: handleTargetedMissile,
  dark_devour: handleDarkDevour,
  // Buff/debuff skills
  war_cry: handleWarCry,
  mass_petrify: handleMassPetrify,
  reality_warp: handleRealityWarp,
  polymorph_mushroom: handleRealityWarp, // uses same pattern
  shield_wall: handleSelfGuard,
  carapace_guard: handleSelfGuard,
  frost_guard: handleSelfGuard,
  arcane_bolt: handleSingleTargetDamage,
  piercing_lance: handleSingleTargetDamage,
  frost_pierce: handleSingleTargetDamage,
  snowblind: handleTowerDebuff,
  building_lock: handleTowerDebuff,
  acid_pool: handlePoisonPool,
  blight_pool: handlePoisonPool,
  yeti_charge: handleChargeStrike,
  brine_ram: handleChargeStrike,
  rail_charge: handleChargeStrike,
  unstable_countdown: handlePassiveWarning,
  spore_burst: handlePassiveWarning,
  blood_rebirth: handlePassiveWarning,
  frost_aura: handleAuraParticles,
  heal_aura: handleAuraParticles,
  shield_aura: handleAuraParticles,
  revive_aura: handleAuraParticles,
  revive: handleAuraParticles,
  burrow_phase: handleBurrowPhase,
  void_blink: handleGenericSkillParticles,
  curse_volatile: handleGenericSkillParticles,
  mark_for_destruction: handleGenericSkillParticles,
  petrify: handleGenericSkillParticles,
  polymorph_sheep: handleGenericSkillParticles,
  tendril_grab: handleGenericSkillParticles,
  // Special
  self_destruct_timer: handleSelfDestruct,
};

// ============================================================
// EnemySkillSystem
// ============================================================

export class EnemySkillSystem implements System {
  readonly name = 'EnemySkillSystem';

  update(world: TowerWorld, dt: number): void {
    this.tickTemporaryArmor(dt);
    this.updateGenericEnemies(world, dt);
    const bosses = bossQuery(world.world);

    for (let i = 0; i < bosses.length; i++) {
      const eid = bosses[i]!;
      const hp = Health.current[eid];
      if (hp === undefined || hp <= 0) continue;

      // Only process data-driven bosses (bossType === 0xFF)
      if (Boss.bossType[eid] !== 0xFF && Boss.bossType[eid] !== ABYSS_LORD_BOSS_TYPE) continue;

      const configId = entityConfigId.get(eid);
      if (!configId) continue;

      const config = unitConfigRegistry.get(configId);
      if (!config) continue;

      // Get skills from YAML config
      const skills = config['skills'] as BossSkillConfig[] | undefined;
      if (!skills || skills.length === 0) {
        // No skills — just tick self-destruct timer if active
        this.tickSelfDestruct(world, eid, dt);
        continue;
      }

      // Tick skill cooldown timers
      this.tickSkillTimers(eid, dt);

      // Phase from Boss component
      const phase = Boss.phase[eid] ?? 1;

      // Try to execute each skill
      for (let si = 0; si < skills.length; si++) {
        const skill = skills[si]!;
        if (!this.isSkillReady(eid, si)) continue;

        // Check if boss is in range of any valid target (for offensive skills)
        const handler = SKILL_HANDLERS[skill.id];
        if (!handler) continue;

        // Execute the skill
        handler(world, eid, skill, phase);
        this.resetSkillTimer(eid, si, skill.cooldown);
        break; // only one skill per frame
      }

      // Tick self-destruct timer
      this.tickSelfDestruct(world, eid, dt);
    }
  }

  // ---- Skill timer management ----

  private tickSkillTimers(eid: number, dt: number): void {
    Boss.skillTimer0[eid] = (Boss.skillTimer0[eid] ?? 0) + dt;
    Boss.skillTimer1[eid] = (Boss.skillTimer1[eid] ?? 0) + dt;
    Boss.skillTimer2[eid] = (Boss.skillTimer2[eid] ?? 0) + dt;
  }

  private isSkillReady(eid: number, skillIndex: number): boolean {
    switch (skillIndex) {
      case 0: return (Boss.skillTimer0[eid] ?? 0) >= 0;
      case 1: return (Boss.skillTimer1[eid] ?? 0) >= 0;
      case 2: return (Boss.skillTimer2[eid] ?? 0) >= 0;
      default: return false;
    }
  }

  private resetSkillTimer(eid: number, skillIndex: number, cooldown: number): void {
    switch (skillIndex) {
      case 0: Boss.skillTimer0[eid] = -cooldown; break;
      case 1: Boss.skillTimer1[eid] = -cooldown; break;
      case 2: Boss.skillTimer2[eid] = -cooldown; break;
    }
  }

  private tickSelfDestruct(world: TowerWorld, eid: number, dt: number): void {
    const timer = Boss.selfDestructTimer[eid];
    if (timer === undefined || timer < 0) return;

    Boss.selfDestructTimer[eid] = timer - dt;
    if (Boss.selfDestructTimer[eid] <= 0) {
      // Trigger defeat — this will be handled by the Game class
      // For now, destroy all player objectives (crystal)
      const allEntities = allPositionedQuery(world.world);
      for (let j = 0; j < allEntities.length; j++) {
        const tid = allEntities[j]!;
        if (Category.value[tid] === CategoryVal.Objective) {
          Health.current[tid] = 0;
        }
      }
    }
  }

  private updateGenericEnemies(world: TowerWorld, dt: number): void {
    const enemies = skilledEnemyQuery(world.world);
    for (const eid of enemies) {
      if ((Health.current[eid] ?? 0) <= 0) continue;
      if (hasComponent(world.world, Boss, eid)) continue;

      const configId = entityConfigId.get(eid);
      if (!configId) continue;
      const config = unitConfigRegistry.get(configId);
      if (!config) continue;
      const skills = config['skills'] as BossSkillConfig[] | undefined;
      if (!skills || skills.length === 0) continue;

      const timers = this.tickGenericSkillTimers(eid, skills.length, dt);
      const phase = hasComponent(world.world, Elite, eid) ? 2 : 1;
      for (let si = 0; si < skills.length; si++) {
        const skill = skills[si]!;
        if ((timers[si] ?? 0) < 0) continue;
        const handler = SKILL_HANDLERS[skill.id];
        if (!handler) continue;
        handler(world, eid, skill, phase);
        timers[si] = -this.getGenericCooldown(skill);
        break;
      }
    }
  }

  private getGenericCooldown(skill: BossSkillConfig): number {
    if (skill.cooldown > 0) return skill.cooldown;
    switch (skill.id) {
      case 'unstable_countdown':
      case 'spore_burst':
      case 'blood_rebirth':
        return Number.POSITIVE_INFINITY;
      default:
        return 1;
    }
  }

  private tickGenericSkillTimers(eid: number, count: number, dt: number): number[] {
    let timers = genericSkillTimers.get(eid);
    if (!timers) {
      timers = Array.from({ length: count }, () => 0);
      genericSkillTimers.set(eid, timers);
      return timers;
    }

    for (let i = 0; i < count; i++) {
      timers[i] = (timers[i] ?? 0) + dt;
    }
    return timers;
  }

  private tickTemporaryArmor(dt: number): void {
    for (const [eid, bonuses] of temporaryArmorBonuses) {
      for (let i = bonuses.length - 1; i >= 0; i--) {
        const bonus = bonuses[i]!;
        bonus.timer -= dt;
        if (bonus.timer <= 0) {
          Health.armor[eid] = Math.max(0, (Health.armor[eid] ?? 0) - bonus.amount);
          bonuses.splice(i, 1);
        }
      }
      if (bonuses.length === 0) temporaryArmorBonuses.delete(eid);
    }
  }
}
