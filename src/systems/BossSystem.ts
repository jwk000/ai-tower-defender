// ============================================================
// Tower Defender — BossSystem (v4.0)
//
// Handles 5 BOSS-specific mechanics per design/03-units.md §6:
//   0 GiantSlime — split skill: giant → 2 medium → 4 small; only small death is real Boss death
//   1 QueenWorm  — immune to towers, spawns 5 random insect units/10s
//   2 Lucifer    — Chaos faction, spawns 3 skeletons/10s (cap 12), enrage <30% HP
//   3 SuperRobot — missile bombardment at tower-dense area every 10s (2s warning)
//   4 AbyssLord  — handled by EnemySkillSystem via YAML skill dark_devour
//
// 对应设计文档:
//   design/03-units.md §6 (BOSS)
// ============================================================
import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Health, Boss, Faction, FactionVal,
  Attack, Movement, UnitTag, Visual, Category, CategoryVal,
  TargetingMark, ScreenShake, ExplosionEffect, Projectile,
  MoveModeVal, DamageTypeVal, ShapeVal, Layer, LayerVal,
  EnemySkillParticleEffect, EnemySkillParticleEffectVal, EnemyFlockMember,
} from '../core/components.js';
import { EnemyType, type MapConfig } from '../types/index.js';
import { ENEMY_ID_BY_TYPE, ENEMY_TYPE_BY_ID } from '../data/gameData.js';
import { Sound } from '../utils/Sound.js';
import { getSummonSfx } from '../utils/audioKeys.js';
import { MovementSystem } from './MovementSystem.js';
import type { BossSkillAnnouncementSystem } from './BossSkillAnnouncementSystem.js';
import { computeMissileParabola } from './AttackSystem.js';
import { SUPERROBOT_PROJECTILE_SOURCE_TYPE } from './projectileTypes.js';

// ============================================================
// Boss type enum
// ============================================================

export const BossType = {
  GiantSlime: 0,
  QueenWorm: 1,
  Lucifer: 2,
  SuperRobot: 3,
  AbyssLord: 4,
} as const;
export type BossTypeVal = (typeof BossType)[keyof typeof BossType];

const GIANT_SLIME_ENEMY_TYPE_NUM = ENEMY_TYPE_BY_ID.indexOf(EnemyType.GiantSlime);
const SKELETON_ENEMY_TYPE_NUM = ENEMY_TYPE_BY_ID.indexOf(EnemyType.Skeleton);
const QUEENWORM_SUMMON_POOL = [
  {
    type: EnemyType.DesertBeetle,
    name: '沙漠黑虫',
    hp: 40,
    armor: 2,
    magicResist: 0,
    damage: 6,
    attackSpeed: 1.5,
    range: 20,
    speed: 35,
    rewardGold: 3,
    layer: LayerVal.Ground,
    shape: ShapeVal.Circle,
    color: { r: 180, g: 120, b: 40 },
    size: 14,
    attackAnimDuration: 0.35,
  },
  {
    type: EnemyType.BurrowBeetle,
    name: '钻地甲虫',
    hp: 120,
    armor: 10,
    magicResist: 0,
    damage: 15,
    attackSpeed: 1.0,
    range: 30,
    speed: 40,
    rewardGold: 12,
    layer: LayerVal.Ground,
    shape: ShapeVal.Circle,
    color: { r: 121, g: 85, b: 72 },
    size: 18,
    attackAnimDuration: 0.4,
  },
  {
    type: EnemyType.Locust,
    name: '吸血蝗虫',
    hp: 30,
    armor: 0,
    magicResist: 0,
    damage: 10,
    attackSpeed: 1.0,
    range: 30,
    speed: 25,
    rewardGold: 4,
    layer: LayerVal.LowAir,
    shape: ShapeVal.Triangle,
    color: { r: 175, g: 180, b: 43 },
    size: 10,
    attackAnimDuration: 0.2,
  },
  {
    type: EnemyType.BombBeetle,
    name: '自爆甲虫',
    hp: 50,
    armor: 0,
    magicResist: 0,
    damage: 80,
    attackSpeed: 1.0,
    range: 60,
    speed: 50,
    rewardGold: 15,
    layer: LayerVal.Ground,
    shape: ShapeVal.Circle,
    color: { r: 255, g: 87, b: 34 },
    size: 12,
    attackAnimDuration: 0.3,
  },
] as const;

// ============================================================
// Bitecs queries
// ============================================================

const bossQuery = defineQuery([Position, Health, Boss, Faction]);
const allPositionedQuery = defineQuery([Position]);
const justiceCombatantQuery = defineQuery([Position, Health, Faction, Category]);

// ============================================================
// Constants
// ============================================================

const QUEENWORM_SPAWN_INTERVAL = 10;   // seconds
const QUEENWORM_SPAWN_COUNT = 5;
const QUEENWORM_SKILL_NAME = '虫群孵化';
const QUEENWORM_SKILL_DESCRIPTION = '每10秒在女王周围召唤5只随机虫族单位；塔仍无法锁定女王';
const LUCIFER_SUMMON_SKILL_NAME = '召唤骷髅大军';
const LUCIFER_SUMMON_SKILL_DESCRIPTION = '在路西法周围召唤3个骷髅；低血量强化后冷却缩短至5秒';
const LUCIFER_SPAWN_INTERVAL_NORMAL = 10;
const LUCIFER_SPAWN_INTERVAL_ENRAGE = 5;
const LUCIFER_SKELETON_CAP = 12;
const LUCIFER_ENRAGE_HP_RATIO = 0.3;
const LUCIFER_SUMMON_CAST_DURATION = 2;
const LUCIFER_SKELETON_VISUAL_SIZE = 28;
const LUCIFER_SKELETON_SPAWN_RADIUS = 96;
const LUCIFER_SKELETON_SPREAD_ARC = (Math.PI * 2) / 3;
const LUCIFER_SKELETON_FLOCK_ID_BASE = 9000;
const SUPERROBOT_MISSILE_INTERVAL = 10;
const SUPERROBOT_WARNING_DURATION = 2;
const SUPERROBOT_SKILL_NAME = '远程导弹轰炸';
const SUPERROBOT_SKILL_DESCRIPTION = '锁定塔和士兵密集区域，2秒预警后发射导弹造成范围伤害';
export const SUPERROBOT_ATTACK_RANGE_RATIO = 1 / 3;
const SUPERROBOT_MISSILE_SPEED = 760;
const SUPERROBOT_MISSILE_DAMAGE = 80;
const SUPERROBOT_MISSILE_RADIUS = 80;
const SUPERROBOT_MISSILE_SIZE = 34;
const SLIME_CHILD_STATS: Record<number, { hp: number; atk: number; size: number; speed: number }> = {
  1: { hp: 200, atk: 15, size: 86, speed: 20 },
  2: { hp: 80, atk: 12, size: 58, speed: 28 },
};

// ============================================================
// Screen shake helper
// ============================================================

function triggerScreenShake(world: TowerWorld, intensity: number, duration: number, frequency: number): void {
  const eid = world.createEntity();
  world.addComponent(eid, ScreenShake, {
    intensity,
    duration,
    elapsed: 0,
    frequency,
  });
}

function spawnBossSkillBurst(
  world: TowerWorld,
  x: number,
  y: number,
  radius: number,
  color: { r: number; g: number; b: number },
  duration = 0.65,
): void {
  const effectId = world.createEntity();
  world.addComponent(effectId, Position, { x, y });
  world.addComponent(effectId, Category, { value: CategoryVal.Effect });
  world.addComponent(effectId, ExplosionEffect, {
    duration,
    elapsed: 0,
    radius: Math.max(10, radius * 0.18),
    maxRadius: radius,
    colorR: color.r,
    colorG: color.g,
    colorB: color.b,
  });
  world.addComponent(effectId, Visual, {
    shape: ShapeVal.Circle,
    colorR: color.r,
    colorG: color.g,
    colorB: color.b,
    size: radius * 2,
    alpha: 0.55,
    outline: 1,
    facing: 1,
    hitFlashTimer: 0,
    idlePhase: 0,
    bobPhase: 0,
    breathPhase: 0,
    attackAnimTimer: 0,
    attackAnimDuration: 0,
    partsId: 0,
  });

  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = radius * 0.35;
    const pid = world.createEntity();
    world.addComponent(pid, Position, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist * 0.7,
    });
    world.addComponent(pid, Category, { value: CategoryVal.Effect });
    world.addComponent(pid, Visual, {
      shape: i % 2 === 0 ? ShapeVal.Diamond : ShapeVal.Triangle,
      colorR: color.r,
      colorG: color.g,
      colorB: color.b,
      size: 10,
      alpha: 0.75,
      outline: 0,
      facing: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
      bobPhase: 0,
      breathPhase: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0,
      partsId: 0,
    });
    world.addComponent(pid, ExplosionEffect, {
      duration,
      elapsed: 0,
      radius: 4,
      maxRadius: 24,
      colorR: color.r,
      colorG: color.g,
      colorB: color.b,
    });
  }
}

function spawnSkeletonBurrowDust(world: TowerWorld, x: number, y: number): void {
  const effectId = world.createEntity();
  world.addComponent(effectId, Position, { x, y });
  world.addComponent(effectId, Category, { value: CategoryVal.Effect });
  world.addComponent(effectId, EnemySkillParticleEffect, {
    effectType: EnemySkillParticleEffectVal.BurrowTrail,
    duration: 0.9,
    elapsed: 0,
    radius: 46,
    targetX: x,
    targetY: y,
    colorR: 38,
    colorG: 34,
    colorB: 30,
    seed: Math.random(),
  });
}

// ============================================================
// BossSystem
// ============================================================

export class BossSystem implements System {
  readonly name = 'BossSystem';

  /** World reference for use in spawn helpers */
  private world: TowerWorld | null = null;

  constructor(
    private bossSkillAnnouncements?: BossSkillAnnouncementSystem,
    private map?: MapConfig,
  ) {}

  // ============================================================
  // System.update
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    this.world = world;
    const bosses = bossQuery(world.world);

    for (let i = 0; i < bosses.length; i++) {
      const eid = bosses[i]!;
      const hp = Health.current[eid];
      const bossType = Boss.bossType[eid] ?? 0;

      // GiantSlime (0): non-final split layers are handled here as a skill, not real death
      if (bossType === BossType.GiantSlime) {
        if (hp !== undefined && hp <= 0 && (Boss.splitCount[eid] ?? 0) < 2) {
          this.handleGiantSlimeDeath(world, eid);
          continue;
        }
      }

      // Skip dead bosses (other types handled by HealthSystem)
      if (hp === undefined || hp <= 0) continue;

      // Tick ability timer for alive bosses
      Boss.abilityTimer[eid] = Math.min(0, Boss.abilityTimer[eid] ?? 0) < 0
        ? Math.min(0, (Boss.abilityTimer[eid] ?? 0) + dt)
        : (Boss.abilityTimer[eid] ?? 0) + dt;
      Boss.spawnTimer[eid] = (Boss.spawnTimer[eid] ?? 0) + dt;

      // Dispatch to specific boss handler
      switch (bossType) {
        case BossType.GiantSlime:
          // GiantSlime has no periodic ability; split is triggered by non-final lethal damage
          break;

        case BossType.QueenWorm:
          this.handleQueenWorm(world, eid, dt);
          break;

        case BossType.Lucifer:
          this.handleLucifer(world, eid, dt);
          break;

        case BossType.SuperRobot:
          this.handleSuperRobot(world, eid, dt);
          break;

        default:
          // unknown boss type — no-op
          break;
      }
    }
  }

  // ============================================================
  // GiantSlime (0) — split skill
  // ============================================================

  /**
   * Non-final lethal damage triggers split, not real Boss death.
   * Giant (splitCount=0) -> 2 medium (splitCount=1)
   * Medium (splitCount=1) -> 2 small (splitCount=2)
   * Small (splitCount=2) uses LifecycleSystem real death and clears the field.
   */
  private handleGiantSlimeDeath(world: TowerWorld, eid: number): void {
    const splitCount = Boss.splitCount[eid] ?? 0;
    const x = Position.x[eid] ?? 0;
    const y = Position.y[eid] ?? 0;
    const faction = Faction.value[eid] ?? FactionVal.Evil;
    const nextSplitCount = splitCount + 1;
    const childStats = SLIME_CHILD_STATS[nextSplitCount] ?? SLIME_CHILD_STATS[2]!;

    spawnBossSkillBurst(world, x, y, 130, { r: 90, g: 220, b: 90 }, 0.7);
    for (let i = 0; i < 2; i++) {
      this.spawnSlimeChild(world, x, y, childStats.hp, childStats.atk, childStats.size, childStats.speed, nextSplitCount, faction);
    }
    Sound.play('boss_split');
    triggerScreenShake(world, 3, 0.3, 10);
    world.destroyEntity(eid);
  }

  private spawnSlimeChild(
    world: TowerWorld,
    centerX: number,
    centerY: number,
    hp: number,
    atk: number,
    size: number,
    speed: number,
    splitCount: number,
    faction: number,
  ): number {
    const x = centerX;
    const y = centerY;
    const pathLocation = MovementSystem.findNearestPathLocation(world, x, y, 64);

    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, Health, {
      current: hp,
      max: hp,
      armor: 0,
      magicResist: 0,
    });
    world.addComponent(eid, Boss, {
      bossType: BossType.GiantSlime,
      splitCount,
      abilityTimer: 0,
      spawnTimer: 0,
      phase: 1,
      phase2HpRatio: 0.5,
      transitionTimer: 0,
      immuneToTowers: 0,
      skillTimer0: 0,
      skillTimer1: 0,
      skillTimer2: 0,
      selfDestructTimer: -1,
    });
    world.addComponent(eid, Faction, { value: faction });
    world.addComponent(eid, Category, { value: CategoryVal.Enemy });
    world.addComponent(eid, Layer, { value: LayerVal.Ground });
    world.addComponent(eid, UnitTag, {
      isEnemy: 1,
      isBoss: 1,
      unitTypeNum: GIANT_SLIME_ENEMY_TYPE_NUM,
      atk,
      rewardGold: splitCount === 2 ? 15 : 30,
    });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 100,
      colorG: 200,
      colorB: 100,
      size,
      alpha: 1,
      outline: 0,
      facing: 1,
    });
    world.addComponent(eid, Attack, {
      damage: atk,
      attackSpeed: 0.5,
      range: 50,
      damageType: DamageTypeVal.Physical,
      isRanged: 0,
      canTargetLowAir: 0,
      alertRange: 200,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0,
      attackMode: 0,
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
    });
    world.addComponent(eid, Movement, {
      speed,
      currentSpeed: speed,
      moveMode: MoveModeVal.FollowPath,
      targetX: 0,
      targetY: 0,
      pathIndex: pathLocation.pathIndex,
      progress: pathLocation.progress,
      spawnIdx: pathLocation.spawnIdx,
      homeX: x,
      homeY: y,
      moveRange: 0,
    });

    world.setDisplayName(eid, splitCount === 1 ? '中型史莱姆' : '小型史莱姆');
    return eid;
  }

  // ============================================================
  // QueenWorm (1) — tower immunity + minion spawning
  // ============================================================

  private handleQueenWorm(world: TowerWorld, eid: number, _dt: number): void {
    // Set tower immunity flag
    Boss.immuneToTowers[eid] = 1;

    // Spawn minions every 10s
    const spawnTimer = Boss.spawnTimer[eid] ?? 0;
    if (spawnTimer >= QUEENWORM_SPAWN_INTERVAL) {
      Boss.spawnTimer[eid] = 0;
      this.bossSkillAnnouncements?.show(world, QUEENWORM_SKILL_NAME, QUEENWORM_SKILL_DESCRIPTION, 10);
      spawnBossSkillBurst(world, Position.x[eid] ?? 0, Position.y[eid] ?? 0, 110, { r: 230, g: 180, b: 40 }, 0.7);
      this.spawnQueenWormMinions(world, eid);
      Sound.play(getSummonSfx('summon_desert_beetles'));
      triggerScreenShake(world, 2, 0.2, 12);
    }
  }

  private spawnQueenWormMinions(world: TowerWorld, bossEid: number): void {
    const x = Position.x[bossEid] ?? 0;
    const y = Position.y[bossEid] ?? 0;
    const faction = Faction.value[bossEid] ?? FactionVal.Evil;

    for (let i = 0; i < QUEENWORM_SPAWN_COUNT; i++) {
      const template = QUEENWORM_SUMMON_POOL[Math.floor(Math.random() * QUEENWORM_SUMMON_POOL.length)]!;
      const angle = (i / QUEENWORM_SPAWN_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 30;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;

      const eid = world.createEntity();
      world.addComponent(eid, Position, { x: sx, y: sy });
      world.addComponent(eid, Health, {
        current: template.hp,
        max: template.hp,
        armor: template.armor,
        magicResist: template.magicResist,
      });
      world.addComponent(eid, Faction, { value: faction });
      world.addComponent(eid, Category, { value: CategoryVal.Enemy });
      world.addComponent(eid, Layer, { value: template.layer });
      world.addComponent(eid, UnitTag, {
        isEnemy: 1,
        unitTypeNum: ENEMY_ID_BY_TYPE[template.type],
        atk: template.damage,
        rewardGold: template.rewardGold,
      });
      world.addComponent(eid, Visual, {
        shape: template.shape,
        colorR: template.color.r,
        colorG: template.color.g,
        colorB: template.color.b,
        size: template.size,
        alpha: 1,
        outline: 1,
        facing: 1,
        hitFlashTimer: 0,
        idlePhase: 0,
        bobPhase: 0,
        breathPhase: Math.random() * Math.PI * 2,
        attackAnimTimer: 0,
        attackAnimDuration: template.attackAnimDuration,
        partsId: 0,
      });
      world.addComponent(eid, Attack, {
        damage: template.damage,
        attackSpeed: template.attackSpeed,
        range: template.range,
        damageType: DamageTypeVal.Physical,
        isRanged: template.range > 60 ? 1 : 0,
        canTargetLowAir: 0,
        alertRange: 150,
        cooldownTimer: 0,
        targetId: 0,
        targetSelection: 0,
        attackMode: 0,
        splashRadius: 0,
        chainCount: 0,
        chainRange: 0,
        chainDecay: 0,
        drainPercent: 0,
      });
      world.addComponent(eid, Movement, {
        speed: template.speed,
        currentSpeed: template.speed,
        moveMode: MoveModeVal.FollowPath,
        targetX: 0, targetY: 0, pathIndex: 0, progress: 0, spawnIdx: 0,
        homeX: sx, homeY: sy, moveRange: 0,
      });
      world.setDisplayName(eid, template.name);
    }
  }

  // ============================================================
  // Lucifer (2) — summon skeletons + enrage
  // ============================================================

  private handleLucifer(world: TowerWorld, eid: number, dt: number): void {
    if ((Boss.abilityTimer[eid] ?? 0) < 0) {
      if (hasComponent(world.world, Movement, eid)) {
        Movement.currentSpeed[eid] = 0;
      }
      return;
    }

    const hpRatio = (Health.current[eid] ?? 0) / Math.max(1, Health.max[eid] ?? 1);
    const isEnraged = hpRatio < LUCIFER_ENRAGE_HP_RATIO;
    const interval = isEnraged ? LUCIFER_SPAWN_INTERVAL_ENRAGE : LUCIFER_SPAWN_INTERVAL_NORMAL;

    // Enrage: ATK +50% (only apply once when transitioning)
    if (isEnraged) {
      // Mark enraged state in transitionTimer (0=normal, 1=enraged)
      if (Boss.transitionTimer[eid] === 0) {
        Boss.transitionTimer[eid] = 1;
        const currentDmg = Attack.damage[eid] ?? 40;
        Attack.damage[eid] = Math.round(currentDmg * 1.5);

        // Visual: red explosion + screen shake
        const ex = Position.x[eid] ?? 0;
        const ey = Position.y[eid] ?? 0;
        spawnBossSkillBurst(world, ex, ey, 140, { r: 200, g: 30, b: 30 }, 1.0);
        Sound.play('boss_phase_enrage');
        triggerScreenShake(world, 6, 0.5, 15);
      }
    }

    const spawnTimer = Boss.spawnTimer[eid] ?? 0;
    if (spawnTimer >= interval) {
      Boss.spawnTimer[eid] = 0;
      Boss.abilityTimer[eid] = -LUCIFER_SUMMON_CAST_DURATION;
      if (hasComponent(world.world, Movement, eid)) {
        Movement.currentSpeed[eid] = 0;
      }
      this.bossSkillAnnouncements?.show(world, LUCIFER_SUMMON_SKILL_NAME, LUCIFER_SUMMON_SKILL_DESCRIPTION, 10);
      spawnBossSkillBurst(world, Position.x[eid] ?? 0, Position.y[eid] ?? 0, 120, { r: 156, g: 39, b: 176 }, 0.7);
      this.spawnLuciferSkeletons(world, eid);
      Sound.play(getSummonSfx('summon_skeletons'));
    }
  }

  /**
   * Count existing skeletons belonging to Lucifer.
   * Skeletons are identified as: Faction=Chaos, UnitTag.isEnemy=1, Health>0, no Boss component.
   */
  private countLuciferSkeletons(world: TowerWorld): number {
    let count = 0;
    const allEntities = allPositionedQuery(world.world);
    for (let i = 0; i < allEntities.length; i++) {
      const eid = allEntities[i]!;
      if (Health.current[eid] !== undefined && Health.current[eid]! <= 0) continue;
      if (hasComponent(world.world, Boss, eid)) continue;
      if (Faction.value[eid] === FactionVal.Chaos && UnitTag.isEnemy[eid] === 1) {
        count++;
      }
    }
    return count;
  }

  private spawnLuciferSkeletons(world: TowerWorld, bossEid: number): void {
    const currentCount = this.countLuciferSkeletons(world);
    const spawnCount = Math.min(3, LUCIFER_SKELETON_CAP - currentCount);
    if (spawnCount <= 0) return;

    const x = Position.x[bossEid] ?? 0;
    const y = Position.y[bossEid] ?? 0;
    const baseAngle = Math.random() * Math.PI * 2;

    for (let i = 0; i < spawnCount; i++) {
      const angle = baseAngle + i * LUCIFER_SKELETON_SPREAD_ARC;
      const dist = LUCIFER_SKELETON_SPAWN_RADIUS + Math.random() * 28;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;
      const pathLocation = MovementSystem.findNearestPathLocation(world, sx, sy, 64);

      spawnSkeletonBurrowDust(world, sx, sy);

      const eid = world.createEntity();
      world.addComponent(eid, Position, { x: sx, y: sy });
      world.addComponent(eid, Health, {
        current: 60, max: 60, armor: 0, magicResist: 0,
      });
      world.addComponent(eid, Faction, { value: FactionVal.Chaos });
      world.addComponent(eid, Category, { value: CategoryVal.Enemy });
      world.addComponent(eid, Layer, { value: LayerVal.Ground });
      world.addComponent(eid, UnitTag, {
        isEnemy: 1,
        unitTypeNum: SKELETON_ENEMY_TYPE_NUM,
        atk: 8,
        rewardGold: 5,
      });
      world.addComponent(eid, Visual, {
        shape: ShapeVal.Circle,
        colorR: 200, colorG: 200, colorB: 200,
        size: LUCIFER_SKELETON_VISUAL_SIZE,
        alpha: 1,
        facing: 1,
      });
      world.addComponent(eid, Attack, {
        damage: 8,
        attackSpeed: 1.0,
        range: 30,
        damageType: DamageTypeVal.Physical,
        isRanged: 0,
        canTargetLowAir: 0,
        alertRange: 150,
        cooldownTimer: 0,
        targetId: 0,
        targetSelection: 0,
        attackMode: 0,
        splashRadius: 0,
        chainCount: 0,
        chainRange: 0,
        chainDecay: 0,
        drainPercent: 0,
      });
      world.addComponent(eid, Movement, {
        speed: 50,
        currentSpeed: 50,
        moveMode: MoveModeVal.FollowPath,
        targetX: 0,
        targetY: 0,
        pathIndex: pathLocation.pathIndex,
        progress: pathLocation.progress,
        spawnIdx: pathLocation.spawnIdx,
        homeX: sx, homeY: sy, moveRange: 0,
      });
      world.addComponent(eid, EnemyFlockMember, {
        flockId: LUCIFER_SKELETON_FLOCK_ID_BASE + bossEid,
        memberIndex: i,
        groupSize: spawnCount,
        anchorOffsetX: sx - pathLocation.projectedX,
        anchorOffsetY: sy - pathLocation.projectedY,
        velocityX: 0,
        velocityY: 0,
      });
      world.setDisplayName(eid, '骷髅');
    }
  }

  // ============================================================
  // SuperRobot (3) — missile bombardment at tower-dense area
  // ============================================================

  /** Track active TargetingMark entity ID per boss (stored in transitionTimer). 0 = no active mark. */
  private handleSuperRobot(world: TowerWorld, eid: number, _dt: number): void {
    const abilityTimer = Boss.abilityTimer[eid] ?? 0;

    // Phase 0: idle, wait for interval
    if (abilityTimer >= SUPERROBOT_MISSILE_INTERVAL) {
      // Find tower-dense area and launch missile
      const target = this.findTowerDenseArea(world, eid);
      if (target) {
        // Create TargetingMark at target location (2s warning)
        const markId = this.createMissileWarning(world, eid, target.x, target.y);
        Boss.transitionTimer[eid] = markId;
        spawnBossSkillBurst(world, Position.x[eid] ?? 0, Position.y[eid] ?? 0, 100, { r: 255, g: 23, b: 68 }, 0.55);
        this.bossSkillAnnouncements?.show(world, SUPERROBOT_SKILL_NAME, SUPERROBOT_SKILL_DESCRIPTION, 10);
        Sound.play('boss_missile_warning');
        // Reset abilityTimer and enter warning phase
        Boss.abilityTimer[eid] = 0;
        Boss.phase[eid] = 1; // 1 = warning phase
      } else {
        // No towers to target — skip this cycle
        Boss.abilityTimer[eid] = 0;
      }
    }

    // Phase 1: warning phase — wait for 2s then detonate
    if (Boss.phase[eid] === 1) {
      const warnTimer = Boss.abilityTimer[eid] ?? 0;
      if (warnTimer >= SUPERROBOT_WARNING_DURATION) {
        this.launchSuperRobotMissile(world, eid);
        Boss.abilityTimer[eid] = 0;
        Boss.phase[eid] = 0;
      }
    }
  }

  /** Find the best Justice tower/soldier cluster inside SuperRobot's limited attack range. */
  private findTowerDenseArea(world: TowerWorld, bossEid: number): { x: number; y: number } | null {
    const combatants = justiceCombatantQuery(world.world).filter((eid) => (
      Faction.value[eid] === FactionVal.Justice
      && (Health.current[eid] ?? 0) > 0
      && (
        Category.value[eid] === CategoryVal.Tower
        || Category.value[eid] === CategoryVal.Soldier
      )
    ));
    if (combatants.length === 0) return null;

    let bestTowerDensity = -1;
    let bestSoldierDensity = -1;
    let bestTarget: number | null = null;
    const bossX = Position.x[bossEid] ?? 0;
    const bossY = Position.y[bossEid] ?? 0;
    const attackRange = this.getSuperRobotAttackRange(world);

    for (let i = 0; i < combatants.length; i++) {
      const target = combatants[i]!;
      const tx = Position.x[target] ?? 0;
      const ty = Position.y[target] ?? 0;
      const bdx = tx - bossX;
      const bdy = ty - bossY;
      if (bdx * bdx + bdy * bdy > attackRange * attackRange) continue;

      let towerDensity = Category.value[target] === CategoryVal.Tower ? 1 : 0;
      let soldierDensity = Category.value[target] === CategoryVal.Soldier ? 1 : 0;

      for (let j = 0; j < combatants.length; j++) {
        if (i === j) continue;
        const otherId = combatants[j]!;
        const ox = Position.x[otherId] ?? 0;
        const oy = Position.y[otherId] ?? 0;
        const dx = tx - ox;
        const dy = ty - oy;
        if (Math.sqrt(dx * dx + dy * dy) <= 192) {
          if (Category.value[otherId] === CategoryVal.Tower) {
            towerDensity++;
          } else if (Category.value[otherId] === CategoryVal.Soldier) {
            soldierDensity++;
          }
        }
      }

      if (
        towerDensity > bestTowerDensity
        || (towerDensity === bestTowerDensity && soldierDensity > bestSoldierDensity)
      ) {
        bestTowerDensity = towerDensity;
        bestSoldierDensity = soldierDensity;
        bestTarget = target;
      }
    }

    if (bestTarget === null) return null;
    return {
      x: Position.x[bestTarget] ?? 0,
      y: Position.y[bestTarget] ?? 0,
    };
  }

  private getSuperRobotAttackRange(world: TowerWorld): number {
    return Math.max(1, (this.map?.cols ?? 12) * (this.map?.tileSize ?? 64) * SUPERROBOT_ATTACK_RANGE_RATIO);
  }

  /** Create a TargetingMark entity at the target location for visual warning */
  private createMissileWarning(
    world: TowerWorld,
    _bossEid: number,
    x: number, y: number,
  ): number {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, TargetingMark, {
      blastRadius: SUPERROBOT_MISSILE_RADIUS,
      pulsePhase: 0,
      ringRotation: 0,
    });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 255, colorG: 60, colorB: 60,
      size: SUPERROBOT_MISSILE_RADIUS,
      alpha: 0.5,
      outline: 1,
      facing: 1,
    });
    world.addComponent(eid, Category, { value: CategoryVal.Effect });
    world.setDisplayName(eid, '导弹预警');
    return eid;
  }

  /** Launch a visible rusty missile projectile from SuperRobot to its warned target. */
  private launchSuperRobotMissile(world: TowerWorld, bossEid: number): void {
    let markId = Boss.transitionTimer[bossEid] ?? 0;
    if (markId <= 0 || !hasComponent(world.world, TargetingMark, markId)) {
      const target = this.findTowerDenseArea(world, bossEid);
      if (!target) return;
      markId = this.createMissileWarning(world, bossEid, target.x, target.y);
    }

    const fromX = Position.x[bossEid] ?? 0;
    const fromY = Position.y[bossEid] ?? 0;
    const targetX = Position.x[markId] ?? fromX;
    const targetY = Position.y[markId] ?? fromY;
    const { totalTime, vyInitial } = computeMissileParabola(fromX, fromY, targetX, targetY, SUPERROBOT_MISSILE_SPEED);
    const projectileId = world.createEntity();

    world.addComponent(projectileId, Position, { x: fromX, y: fromY });
    world.addComponent(projectileId, Projectile, {
      speed: SUPERROBOT_MISSILE_SPEED,
      damage: SUPERROBOT_MISSILE_DAMAGE,
      damageType: DamageTypeVal.Physical,
      targetId: markId,
      sourceId: bossEid,
      fromX,
      fromY,
      shape: ShapeVal.Diamond,
      colorR: 150,
      colorG: 72,
      colorB: 36,
      size: SUPERROBOT_MISSILE_SIZE,
      splashRadius: SUPERROBOT_MISSILE_RADIUS,
      stunDuration: 0,
      slowPercent: 0,
      slowMaxStacks: 0,
      freezeDuration: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      isChain: 0,
      chainIndex: 0,
      drainAmount: 0,
      sourceTowerType: SUPERROBOT_PROJECTILE_SOURCE_TYPE,
      debuffSlot: 0,
      debuffValue: 0,
      debuffDuration: 0,
      debuffIsPercent: 0,
      targetX,
      targetY,
      flightTime: 0,
      totalTime,
      vyInitial,
      dirX: 0,
      dirY: 0,
    });
    world.addComponent(projectileId, Visual, {
      shape: ShapeVal.Diamond,
      colorR: 150,
      colorG: 72,
      colorB: 36,
      size: SUPERROBOT_MISSILE_SIZE,
      alpha: 1,
      outline: 1,
      facing: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
      bobPhase: 0,
      breathPhase: 0,
      attackAnimTimer: 0,
      attackAnimDuration: 0,
      partsId: 0,
    });
    world.addComponent(projectileId, Layer, { value: LayerVal.Ground });
    world.setDisplayName(projectileId, '超级机器人导弹');
    Boss.transitionTimer[bossEid] = 0;
    Sound.play('boss_missile');
  }

}
