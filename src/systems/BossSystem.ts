// ============================================================
// Tower Defender — BossSystem (v4.0)
//
// Handles 5 BOSS-specific mechanics per design/03-units.md §6:
//   0 GiantSlime — death split: giant → 2 medium → 4 small (2 levels)
//   1 QueenWorm  — immune to towers, spawns 3 beetles/15s
//   2 Lucifer    — Chaos faction, spawns 3 skeletons/10s (cap 12), enrage <30% HP
//   3 SuperRobot — missile bombardment at tower-dense area every 10s (2s warning)
//   4 AbyssLord  — 5s annihilation (150px radius), heals 2% max HP per kill
//
// 对应设计文档:
//   design/03-units.md §6 (BOSS)
// ============================================================
import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Health, Boss, Faction, FactionVal,
  Attack, Movement, UnitTag, Visual, Category, CategoryVal,
  Tower, TargetingMark, ScreenShake,
  MoveModeVal, DamageTypeVal, ShapeVal, Layer, LayerVal,
} from '../core/components.js';
import { Sound } from '../utils/Sound.js';

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

// ============================================================
// Bitecs queries
// ============================================================

const bossQuery = defineQuery([Position, Health, Boss, Faction]);
const towerQuery = defineQuery([Position, Tower]);
const allPositionedQuery = defineQuery([Position]);

// ============================================================
// Constants
// ============================================================

/** GiantSlime split child HP/ATK by level */
const SLIME_SPLIT_STATS: Record<number, { hp: number; atk: number }> = {
  1: { hp: 200, atk: 15 },  // medium (splitCount=1)
  2: { hp: 80, atk: 12 },   // small (splitCount=2)
};

const QUEENWORM_SPAWN_INTERVAL = 15;   // seconds
const LUCIFER_SPAWN_INTERVAL_NORMAL = 10;
const LUCIFER_SPAWN_INTERVAL_ENRAGE = 5;
const LUCIFER_SKELETON_CAP = 12;
const LUCIFER_ENRAGE_HP_RATIO = 0.3;
const SUPERROBOT_MISSILE_INTERVAL = 10;
const SUPERROBOT_WARNING_DURATION = 2;
const ABYSSLORD_ANNIHILATE_INTERVAL = 5;
const ABYSSLORD_ANNIHILATE_RADIUS = 150;
const ABYSSLORD_HEAL_RATIO = 0.02;     // 2% max HP per kill

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

// ============================================================
// BossSystem
// ============================================================

export class BossSystem implements System {
  readonly name = 'BossSystem';

  /** World reference for use in spawn helpers */
  private world: TowerWorld | null = null;

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

      // GiantSlime (0): handle death split
      if (bossType === BossType.GiantSlime) {
        if (hp !== undefined && hp <= 0) {
          this.handleGiantSlimeDeath(world, eid);
          continue; // entity destroyed, skip further processing
        }
      }

      // Skip dead bosses (other types handled by HealthSystem)
      if (hp === undefined || hp <= 0) continue;

      // Tick ability timer for alive bosses
      Boss.abilityTimer[eid] = (Boss.abilityTimer[eid] ?? 0) + dt;
      Boss.spawnTimer[eid] = (Boss.spawnTimer[eid] ?? 0) + dt;

      // Dispatch to specific boss handler
      switch (bossType) {
        case BossType.GiantSlime:
          // GiantSlime has no periodic ability — only death split
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

        case BossType.AbyssLord:
          this.handleAbyssLord(world, eid, dt);
          break;

        default:
          // unknown boss type — no-op
          break;
      }
    }
  }

  // ============================================================
  // GiantSlime (0) — death split
  // ============================================================

  /**
   * On death: split into 2 smaller slimes.
   * Giant (splitCount=0) → 2 medium (splitCount=1)
   * Medium (splitCount=1) → 2 small (splitCount=2)
   * Small (splitCount=2) → no further split
   */
  private handleGiantSlimeDeath(world: TowerWorld, eid: number): void {
    const sc = Boss.splitCount[eid] ?? 0;
    if (sc >= 2) {
      // Small slime — no further split, just destroy
      world.destroyEntity(eid);
      return;
    }

    const stats = SLIME_SPLIT_STATS[sc + 1];
    if (!stats) {
      world.destroyEntity(eid);
      return;
    }

    const x = Position.x[eid] ?? 0;
    const y = Position.y[eid] ?? 0;
    const faction = Faction.value[eid] ?? FactionVal.Evil;

    // Spawn 2 child slimes
    for (let i = 0; i < 2; i++) {
      this.spawnSlimeChild(world, x, y, stats.hp, stats.atk, sc + 1, faction);
    }

    Sound.play('boss_split');
    triggerScreenShake(world, 3, 0.3, 10);

    // Destroy original
    world.destroyEntity(eid);
  }

  private spawnSlimeChild(
    world: TowerWorld,
    centerX: number, centerY: number,
    hp: number, atk: number, splitCount: number,
    faction: number,
  ): number {
    // Random position within 60px of death location
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 40; // 20-60px
    const x = centerX + Math.cos(angle) * dist;
    const y = centerY + Math.sin(angle) * dist;

    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, Health, {
      current: hp, max: hp, armor: 0, magicResist: 0,
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
    });
    world.addComponent(eid, Faction, { value: faction });
    world.addComponent(eid, Category, { value: CategoryVal.Enemy });
    world.addComponent(eid, Layer, { value: LayerVal.Ground });
    world.addComponent(eid, UnitTag, {
      isEnemy: 1,
      isBoss: 1,
      atk,
      rewardGold: splitCount === 2 ? 15 : 30,
    });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 100, colorG: 200, colorB: 100,
      size: splitCount === 1 ? 24 : 16, // smaller for deeper splits
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
      alertRange: 200,
      cooldownTimer: 0,
      targetId: 0,
      targetSelection: 0, // Nearest
      attackMode: 0,       // SingleTarget
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
    });
    world.addComponent(eid, Movement, {
      speed: splitCount === 1 ? 13 : 15, // smaller = slightly faster
      currentSpeed: 15,
      moveMode: MoveModeVal.FollowPath,
      targetX: 0,
      targetY: 0,
      pathIndex: 0,
      progress: 0,
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

    // Spawn minions every 15s
    const spawnTimer = Boss.spawnTimer[eid] ?? 0;
    if (spawnTimer >= QUEENWORM_SPAWN_INTERVAL) {
      Boss.spawnTimer[eid] = 0;
      this.spawnQueenWormMinions(world, eid);
      Sound.play('boss_summon');
      triggerScreenShake(world, 2, 0.2, 12);
    }
  }

  private spawnQueenWormMinions(world: TowerWorld, bossEid: number): void {
    const x = Position.x[bossEid] ?? 0;
    const y = Position.y[bossEid] ?? 0;
    const faction = Faction.value[bossEid] ?? FactionVal.Evil;

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 30;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;

      const eid = world.createEntity();
      world.addComponent(eid, Position, { x: sx, y: sy });
      world.addComponent(eid, Health, {
        current: 40, max: 40, armor: 2, magicResist: 0,
      });
      world.addComponent(eid, Faction, { value: faction });
      world.addComponent(eid, Category, { value: CategoryVal.Enemy });
      world.addComponent(eid, Layer, { value: LayerVal.Ground });
      world.addComponent(eid, UnitTag, {
        isEnemy: 1,
        atk: 6,
        rewardGold: 3,
      });
      world.addComponent(eid, Visual, {
        shape: ShapeVal.Circle,
        colorR: 180, colorG: 120, colorB: 40,
        size: 14,
        alpha: 1,
        facing: 1,
      });
      world.addComponent(eid, Attack, {
        damage: 6,
        attackSpeed: 1.5,
        range: 20,
        damageType: DamageTypeVal.Physical,
        isRanged: 0,
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
        speed: 35,
        currentSpeed: 35,
        moveMode: MoveModeVal.FollowPath,
        targetX: 0, targetY: 0, pathIndex: 0, progress: 0,
        homeX: sx, homeY: sy, moveRange: 0,
      });
      world.setDisplayName(eid, '沙漠黑虫');
    }
  }

  // ============================================================
  // Lucifer (2) — summon skeletons + enrage
  // ============================================================

  private handleLucifer(world: TowerWorld, eid: number, dt: number): void {
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
      }
    }

    const spawnTimer = Boss.spawnTimer[eid] ?? 0;
    if (spawnTimer >= interval) {
      Boss.spawnTimer[eid] = 0;
      this.spawnLuciferSkeletons(world, eid);
      Sound.play('boss_summon');
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

    for (let i = 0; i < spawnCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const sx = x + Math.cos(angle) * dist;
      const sy = y + Math.sin(angle) * dist;

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
        atk: 8,
        rewardGold: 5,
      });
      world.addComponent(eid, Visual, {
        shape: ShapeVal.Circle,
        colorR: 200, colorG: 200, colorB: 200,
        size: 14,
        alpha: 1,
        facing: 1,
      });
      world.addComponent(eid, Attack, {
        damage: 8,
        attackSpeed: 1.0,
        range: 30,
        damageType: DamageTypeVal.Physical,
        isRanged: 0,
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
        targetX: 0, targetY: 0, pathIndex: 0, progress: 0,
        homeX: sx, homeY: sy, moveRange: 0,
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
      const target = this.findTowerDenseArea(world);
      if (target) {
        // Create TargetingMark at target location (2s warning)
        this.createMissileWarning(world, eid, target.x, target.y);
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
        Sound.play('boss_missile');
        triggerScreenShake(world, 8, 0.5, 20);
        this.detonateMissile(world, eid);
        Boss.abilityTimer[eid] = 0;
        Boss.phase[eid] = 0;
      }
    }
  }

  /** Find the tower with the most nearby towers (within 3 tiles = 192px) */
  private findTowerDenseArea(world: TowerWorld): { x: number; y: number } | null {
    const towers = towerQuery(world.world);
    if (towers.length === 0) return null;

    let bestDensity = -1;
    let bestTower: number | null = null;

    for (let i = 0; i < towers.length; i++) {
      const tid = towers[i]!;
      const tx = Position.x[tid] ?? 0;
      const ty = Position.y[tid] ?? 0;
      let count = 0;

      for (let j = 0; j < towers.length; j++) {
        if (i === j) continue;
        const otherId = towers[j]!;
        const ox = Position.x[otherId] ?? 0;
        const oy = Position.y[otherId] ?? 0;
        const dx = tx - ox;
        const dy = ty - oy;
        if (Math.sqrt(dx * dx + dy * dy) <= 192) {
          count++;
        }
      }

      if (count > bestDensity) {
        bestDensity = count;
        bestTower = tid;
      }
    }

    if (bestTower === null) return null;
    return {
      x: Position.x[bestTower] ?? 0,
      y: Position.y[bestTower] ?? 0,
    };
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
      blastRadius: 80,
      pulsePhase: 0,
      ringRotation: 0,
    });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 255, colorG: 60, colorB: 60,
      size: 80,
      alpha: 0.5,
      outline: 1,
      facing: 1,
    });
    world.addComponent(eid, Category, { value: CategoryVal.Effect });
    world.setDisplayName(eid, '导弹预警');
    return eid;
  }

  /** Detonate missile at the target location — AOE damage in 80px radius */
  private detonateMissile(world: TowerWorld, bossEid: number): void {
    // The missile targets the "tower-dense area" found during targeting.
    // Since we don't store the target position on the boss, we need another approach.
    // We'll re-find the tower-dense area and explode there.
    // This is a simplification; ideally the target position would be stored.
    const target = this.findTowerDenseArea(world);
    if (!target) return;

    const centerX = target.x;
    const centerY = target.y;
    const blastRadius = 80;
    const centerDamage = 80;

    // Find all entities in blast radius
    const allEntities = allPositionedQuery(world.world);
    for (let i = 0; i < allEntities.length; i++) {
      const eid = allEntities[i]!;
      if (eid === bossEid) continue; // don't damage self
      if (Health.current[eid] === undefined || Health.current[eid]! <= 0) continue;

      const ex = Position.x[eid] ?? 0;
      const ey = Position.y[eid] ?? 0;
      const dx = ex - centerX;
      const dy = ey - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= blastRadius) {
        // Linear falloff: centerDamage at center, 0 at edge
        const falloff = 1 - dist / blastRadius;
        const damage = Math.round(centerDamage * falloff);
        if (damage > 0) {
          Health.current[eid] = (Health.current[eid]!) - damage;
        }
      }
    }

    // Clean up any TargetingMark entities
    this.cleanupTargetingMarks(world);
  }

  /** Remove all TargetingMark entities from the world */
  private cleanupTargetingMarks(world: TowerWorld): void {
    const allEntities = allPositionedQuery(world.world);
    for (let i = 0; i < allEntities.length; i++) {
      const eid = allEntities[i]!;
      if (hasComponent(world.world, TargetingMark, eid) && Category.value[eid] === CategoryVal.Effect) {
        world.destroyEntity(eid);
      }
    }
  }

  // ============================================================
  // AbyssLord (4) — annihilation (150px) + heal
  // ============================================================

  private handleAbyssLord(world: TowerWorld, eid: number, _dt: number): void {
    const abilityTimer = Boss.abilityTimer[eid] ?? 0;
    if (abilityTimer >= ABYSSLORD_ANNIHILATE_INTERVAL) {
      Boss.abilityTimer[eid] = 0;
      Sound.play('boss_devour');
      triggerScreenShake(world, 12, 0.8, 15);
      this.performAbyssAnnihilation(world, eid);
    }
  }

  private performAbyssAnnihilation(world: TowerWorld, bossEid: number): void {
    const bx = Position.x[bossEid] ?? 0;
    const by = Position.y[bossEid] ?? 0;
    const radius = ABYSSLORD_ANNIHILATE_RADIUS;

    const allEntities = allPositionedQuery(world.world);
    let killCount = 0;
    const toDestroy: number[] = [];

    for (let i = 0; i < allEntities.length; i++) {
      const eid = allEntities[i]!;
      if (eid === bossEid) continue;
      if (Health.current[eid] === undefined || Health.current[eid]! <= 0) continue;

      // Exclude other bosses
      if (hasComponent(world.world, Boss, eid)) continue;

      // Exclude objectives (crystal)
      if (Category.value[eid] === CategoryVal.Objective) continue;

      const ex = Position.x[eid] ?? 0;
      const ey = Position.y[eid] ?? 0;
      const dx = ex - bx;
      const dy = ey - by;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        toDestroy.push(eid);
      }
    }

    // Destroy all entities in range
    for (const eid of toDestroy) {
      Health.current[eid] = 0;
      world.destroyEntity(eid);
      killCount++;
    }

    // Heal: 2% max HP per kill
    if (killCount > 0) {
      const maxHp = Health.max[bossEid] ?? 0;
      const healAmount = Math.round(maxHp * ABYSSLORD_HEAL_RATIO * killCount);
      const currentHp = Health.current[bossEid] ?? 0;
      Health.current[bossEid] = Math.min(maxHp, currentHp + healAmount);
    }
  }
}
