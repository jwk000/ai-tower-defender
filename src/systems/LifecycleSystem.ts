import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Health,
  UnitTag,
  Attack,
  DeathEffect,
  ExplosionEffect,
  Position,
  Visual,
  Category,
  CategoryVal,
  ShapeVal,
  Tower,
  Trap,
  enemyQuery,
  Boss,
  DisintegrateEffect,
} from '../core/components.js';
import { ruleEngine } from '../core/RuleEngine.js';
import { EnemyType, TowerType, UnitType } from '../types/index.js';
import { UNIT_TYPE_BY_ID } from '../data/gameData.js';
import { registerDeathSpriteArtId } from '../utils/deathSpriteRegistry.js';
import { BossType } from './BossSystem.js';

const healthUnitQuery = defineQuery([Health, UnitTag]);

const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,
  TowerType.Cannon,
  TowerType.Ice,
  TowerType.Lightning,
  TowerType.Laser,
  TowerType.Bat,
  TowerType.Missile,
  TowerType.Fire,
  TowerType.Poison,
  TowerType.Ballista,
];

const TRAP_TYPE_BY_ID = ['spike_trap', 'bear_trap', 'tar_pit', 'boulder'] as const;

const ENEMY_TYPE_BY_ID: EnemyType[] = [
  EnemyType.Goblin,
  EnemyType.Boar,
  EnemyType.Elephant,
  EnemyType.Giant,
  EnemyType.DesertBeetle,
  EnemyType.BurrowBeetle,
  EnemyType.Locust,
  EnemyType.BombBeetle,
  EnemyType.Werewolf,
  EnemyType.VampireBat,
  EnemyType.Wizard,
  EnemyType.Priest,
  EnemyType.Frankenstein,
  EnemyType.Plane,
  EnemyType.Tank,
  EnemyType.OilTruck,
  EnemyType.RobotDog,
  EnemyType.GiantRobot,
  EnemyType.Drone,
  EnemyType.GiantSlime,
  EnemyType.QueenBeetle,
  EnemyType.Lucifer,
  EnemyType.SuperRobot,
  EnemyType.AbyssLord,
];

/**
 * 生命周期系统 — 检测单位死亡/创建事件，分发给 RuleEngine
 *
 * onDeath: 派发事件 → 创建死亡特效 → 销毁实体
 * onCreate: 追踪首次出现的实体，派发一次性事件
 */
export class LifecycleSystem implements System {
  readonly name = 'LifecycleSystem';

  private clearingEnemiesAfterBossDeath = false;

  private getSceneUnitArtId(world: TowerWorld, eid: number): string | null {
    if (hasComponent(world.world, Tower, eid)) {
      const towerType = TOWER_TYPE_BY_ID[Tower.towerType[eid]!];
      return towerType ? `tower_${towerType}` : null;
    }
    if (hasComponent(world.world, Trap, eid)) {
      return TRAP_TYPE_BY_ID[Trap.trapType[eid] ?? 0] ?? 'spike_trap';
    }
    if (hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Soldier) {
      return UNIT_TYPE_BY_ID[UnitTag.unitTypeNum[eid] ?? 0] ?? UnitType.ShieldGuard;
    }
    if (hasComponent(world.world, Category, eid) && Category.value[eid] === CategoryVal.Enemy) {
      return `enemy_${ENEMY_TYPE_BY_ID[UnitTag.unitTypeNum[eid] ?? 0] ?? EnemyType.Goblin}`;
    }
    return null;
  }

  /** 实体创建时间追踪（entityId → 创建时刻秒） */
  /** Create tower-type-specific death visual: particle burst matching tower theme */
  private createTowerDeathEffect(
    world: TowerWorld,
    x: number, y: number,
    towerType: number,
    r: number, g: number, b: number, size: number,
  ): number {
    const PI = Math.PI;
    // Configs: [count, shape, color offset (r/g/b), particle size, duration]
    const configs: Record<number, { count: number; shape: number; cr: number; cg: number; cb: number; pSize: number; dur: number }> = {
      0: { count: 8, shape: ShapeVal.Triangle, cr: 0x4f, cg: 0xc3, cb: 0xf7, pSize: 6, dur: 0.5 },   // Arrow: cyan splinters
      1: { count: 6, shape: ShapeVal.Circle,   cr: 0xff, cg: 0x8a, cb: 0x65, pSize: 8, dur: 0.6 },   // Cannon: orange rings
      2: { count: 8, shape: ShapeVal.Diamond,  cr: 0x81, cg: 0xd4, cb: 0xfa, pSize: 5, dur: 0.5 },   // Ice: diamond shards
      3: { count: 8, shape: ShapeVal.Diamond,  cr: 0xff, cg: 0xd6, cb: 0x00, pSize: 4, dur: 0.45 },  // Lightning: sparks
      4: { count: 6, shape: ShapeVal.Diamond,  cr: 0x00, cg: 0xe5, cb: 0xff, pSize: 5, dur: 0.5 },   // Laser: crystal shards
      5: { count: 8, shape: ShapeVal.Triangle, cr: 0x7c, cg: 0x4d, cb: 0xff, pSize: 6, dur: 0.5 },   // Bat: purple wings
      6: { count: 8, shape: ShapeVal.Triangle, cr: 0xd3, cg: 0x2f, cb: 0x2f, pSize: 7, dur: 0.7 },   // Missile: debris
      7: { count: 8, shape: ShapeVal.Circle,   cr: 0xff, cg: 0x57, cb: 0x22, pSize: 5, dur: 0.55 },  // Fire: embers
      8: { count: 6, shape: ShapeVal.Circle,   cr: 0x4c, cg: 0xaf, cb: 0x50, pSize: 5, dur: 0.5 },   // Poison: bubbles
      9: { count: 8, shape: ShapeVal.Triangle, cr: 0x78, cg: 0x90, cb: 0x9c, pSize: 6, dur: 0.5 },   // Ballista: metal splinters
    };

    const cfg = configs[towerType];
    if (!cfg) {
      // Fallback: generic circle
      const eid = world.createEntity();
      world.addComponent(eid, Position, { x, y });
      world.addComponent(eid, Visual, { shape: ShapeVal.Circle, colorR: r, colorG: g, colorB: b, size });
      world.addComponent(eid, DeathEffect, { duration: 0.3 });
      return eid;
    }

    // Base expanding ring
    const ringEid = world.createEntity();
    world.addComponent(ringEid, Position, { x, y });
    world.addComponent(ringEid, Visual, { shape: ShapeVal.Circle, colorR: cfg.cr, colorG: cfg.cg, colorB: cfg.cb, size });
    world.addComponent(ringEid, DeathEffect, { duration: cfg.dur });
    // Use ExplosionEffect for the ring to expand outward
    world.addComponent(ringEid, ExplosionEffect as object, { duration: cfg.dur, maxRadius: size * 1.5, elapsed: 0 });

    // Particle burst
    for (let i = 0; i < cfg.count; i++) {
      const angle = (i / cfg.count) * PI * 2 + (i * 0.3);
      const dist = size * (0.3 + (i % 3) * 0.15);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist * 0.7;
      const pEid = world.createEntity();
      world.addComponent(pEid, Position, { x: px, y: py });
      world.addComponent(pEid, Visual, {
        shape: cfg.shape,
        colorR: cfg.cr,
        colorG: cfg.cg,
        colorB: cfg.cb,
        size: cfg.pSize,
        alpha: 0.9,
      });
      world.addComponent(pEid, DeathEffect, { duration: cfg.dur - i * 0.03 });
    }
    return ringEid;
  }

  private creationTimes = new Map<number, number>();

  private isPendingSlimeSplit(world: TowerWorld, eid: number): boolean {
    if (!hasComponent(world.world, Boss, eid)) return false;
    return Boss.bossType[eid] === BossType.GiantSlime && (Boss.splitCount[eid] ?? 0) < 2;
  }

  private shouldClearEnemiesForBossDeath(world: TowerWorld, bossEid: number): boolean {
    if (!hasComponent(world.world, Boss, bossEid)) return false;
    if (Boss.bossType[bossEid] !== BossType.GiantSlime) return true;

    const bosses = defineQuery([Boss, Health])(world.world);
    for (const eid of bosses) {
      if (eid === bossEid) continue;
      if (Boss.bossType[eid] !== BossType.GiantSlime) continue;
      if (Health.current[eid] !== undefined && Health.current[eid]! > 0) {
        return false;
      }
    }
    return true;
  }

  private killRemainingEnemiesAfterBossDeath(world: TowerWorld, bossEid: number): void {
    if (this.clearingEnemiesAfterBossDeath) return;
    this.clearingEnemiesAfterBossDeath = true;
    const enemies = enemyQuery(world.world);
    for (const enemyId of enemies) {
      if (enemyId === bossEid) continue;
      if (UnitTag.isEnemy[enemyId] !== 1) continue;
      if (Health.current[enemyId] === undefined || Health.current[enemyId]! <= 0) continue;
      Health.current[enemyId] = 0;
    }
  }

  update(world: TowerWorld, _dt: number): void {
    const entities = healthUnitQuery(world.world);
    const now = performance.now() / 1000;

    for (const eid of entities) {
      const currentHp = Health.current[eid];

      if (currentHp !== undefined && currentHp <= 0) {
        if (this.isPendingSlimeSplit(world, eid)) {
          continue;
        }
        ruleEngine.dispatch(world.world, eid, 'onDeath', { time: now });
        if (this.shouldClearEnemiesForBossDeath(world, eid)) {
          this.killRemainingEnemiesAfterBossDeath(world, eid);
        }

        // 清除指向该实体的所有 enemy Attack.targetId 引用，避免实体回收后下一帧
        // 错误地对新占用该 entity slot 的实体执行 releaseTaunt（attackerCount-- 错乱）
        const enemies = enemyQuery(world.world);
        for (const enemyId of enemies) {
          if (Attack.targetId[enemyId] === eid) {
            Attack.targetId[enemyId] = 0;
          }
        }

        const posX = Position.x[eid] ?? 0;
        const posY = Position.y[eid] ?? 0;
        const colorR = Visual.colorR[eid] ?? 255;
        const colorG = Visual.colorG[eid] ?? 0;
        const colorB = Visual.colorB[eid] ?? 0;
        const size = Visual.size[eid] ?? 24;
        const deathArtId = this.getSceneUnitArtId(world, eid);
        const isEnemy = UnitTag.isEnemy[eid] === 1;

        // Tower-specific death effects: burst of particles matching tower theme
        const isTower = hasComponent(world.world, Tower, eid);
        if (isTower) {
          const towerType = Tower.towerType[eid] ?? 0;
          const effectEid = this.createTowerDeathEffect(world, posX, posY, towerType, colorR, colorG, colorB, size);
          registerDeathSpriteArtId(effectEid, deathArtId);
        } else {
          const effectEid = world.createEntity();
          world.addComponent(effectEid, Position, { x: posX, y: posY });
          world.addComponent(effectEid, Visual, {
            shape: ShapeVal.Circle,
            colorR,
            colorG,
            colorB,
            size,
          });
          world.addComponent(effectEid, DeathEffect, { duration: 0.3 });
          if (isEnemy) {
            world.addComponent(effectEid, DisintegrateEffect, {
              shardCount: hasComponent(world.world, Boss, eid) ? 18 : 10,
              radius: hasComponent(world.world, Boss, eid) ? Math.max(size * 1.4, 120) : Math.max(size, 28),
              colorR: 170,
              colorG: 170,
              colorB: 170,
            });
          }
          registerDeathSpriteArtId(effectEid, deathArtId);
        }

        world.destroyEntity(eid);
      } else if (currentHp !== undefined && currentHp > 0) {
        // 首次见到该实体 → 派发 onCreate 事件（仅一次）
        if (!this.creationTimes.has(eid)) {
          this.creationTimes.set(eid, now);
          ruleEngine.dispatch(world.world, eid, 'onCreate', { time: now });
        }
      }
    }
    this.clearingEnemiesAfterBossDeath = false;

    // 清理已被销毁实体的追踪记录
    const currentEids = new Set(entities);
    for (const eid of this.creationTimes.keys()) {
      if (!currentEids.has(eid)) {
        this.creationTimes.delete(eid);
      }
    }
  }
}
