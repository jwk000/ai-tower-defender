import { TowerWorld, type System, defineQuery, entityExists, hasComponent } from '../core/World.js';
import { Skill, Position, Health, UnitTag, Taunted, Attack, Visual, enemyQuery, DamageTypeVal } from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { SKILL_CONFIGS } from '../data/gameData.js';
import { SkillTrigger } from '../types/index.js';
import type { SkillConfig } from '../types/index.js';
import { Sound } from '../utils/Sound.js';

// --- Skill ID Mapping (string key → bitecs ui8 value) ---

const SkillIdNum: Record<string, number> = {
  taunt: 0,
  whirlwind: 1,
  assassinate: 2,
};

/** Reverse lookup: ui8 → string skill key */
const SKILL_ID_MAP: string[] = ['taunt', 'whirlwind', 'assassinate'];

// ============================================================
// SkillSystem — 玩家技能执行（嘲讽、旋风斩、暗杀）
// ============================================================

export class SkillSystem implements System {
  readonly name = 'SkillSystem';

  private skillQuery = defineQuery([Skill]);

  constructor(private spendEnergy: (amount: number) => boolean) {}

  // ---- Update (per-frame) ----

  update(world: TowerWorld, dt: number): void {
    const entities = this.skillQuery(world.world);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      // Tick cooldown
      Skill.currentCooldown[eid] = Math.max(0, Skill.currentCooldown[eid]! - dt);

      // Apply passive skills
      const sid = Skill.skillId[eid]!;
      const key = SKILL_ID_MAP[sid];
      if (key !== undefined) {
        const config = SKILL_CONFIGS[key];
        if (config && config.trigger === SkillTrigger.Passive) {
          this.applyPassive(world, eid, config);
        }
      }
    }
  }

  // ---- Public API ----

  /** Try to activate a skill. Returns true if skill was used (cooldown reset, energy spent). */
  useSkill(entityId: number, skillId: string): boolean {
    const skillIdNum = SkillIdNum[skillId];
    if (skillIdNum === undefined) return false;
    if (Skill.skillId[entityId] !== skillIdNum) return false;
    if (Skill.currentCooldown[entityId]! > 0) return false;

    const config = SKILL_CONFIGS[skillId];
    if (!config) return false;
    if (config.trigger !== SkillTrigger.Active) return false;

    if (!this.spendEnergy(Skill.energyCost[entityId]!)) return false;

    Skill.currentCooldown[entityId] = Skill.cooldown[entityId]!;
    return true;
  }

  /** Execute taunt — enemies within range get Taunted component */
  executeTaunt(world: TowerWorld, sourceId: number, x: number, y: number, config: { range: number; value: number }): void {
    Sound.play('skill_taunt');
    const enemies = enemyQuery(world.world);
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;
      const dx = ex - x;
      const dy = ey - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= config.range) {
        world.addComponent(eid, Taunted, { sourceId, timer: config.value });
      }
    }
  }

  /** Execute whirlwind — enemies within range take direct damage */
  executeWhirlwind(world: TowerWorld, x: number, y: number, config: { range: number; value: number }): void {
    Sound.play('skill_whirlwind');
    const enemies = enemyQuery(world.world);
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;
      const dx = ex - x;
      const dy = ey - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= config.range) {
        applyDamageToTarget(world, eid, config.value, DamageTypeVal.Physical);
      }
    }
  }

  /**
   * One-shot cast: useSkill + dispatch execute* by skillId.
   * Returns true on full success (CD/energy ok AND effect applied).
   */
  castSkill(world: TowerWorld, entityId: number, skillId: string): boolean {
    if (!this.useSkill(entityId, skillId)) return false;
    const config = SKILL_CONFIGS[skillId];
    if (!config) return false;
    const x = Position.x[entityId];
    const y = Position.y[entityId];
    if (x === undefined || y === undefined) return false;
    switch (skillId) {
      case 'taunt':
        this.executeTaunt(world, entityId, x, y, { range: config.range, value: config.value });
        return true;
      case 'whirlwind':
        this.executeWhirlwind(world, x, y, { range: config.range, value: config.value });
        return true;
      case 'assassinate':
        this.executeAssassinate(world, entityId, { range: config.range, value: config.value });
        return true;
      default:
        return true;
    }
  }

  /** Check whether an entity's skill is ready to use */
  isSkillReady(entityId: number, skillId: string): boolean {
    const skillIdNum = SkillIdNum[skillId];
    if (skillIdNum === undefined) return false;
    if (Skill.skillId[entityId] !== skillIdNum) return false;
    return Skill.currentCooldown[entityId]! <= 0;
  }

  /** Execute assassinate — teleport to weakest enemy in range and deal high damage */
  executeAssassinate(world: TowerWorld, sourceId: number, config: { range: number; value: number }): void {
    Sound.play('skill_taunt'); // TODO: add assassinate SFX
    const enemies = enemyQuery(world.world);
    const sx = Position.x[sourceId];
    const sy = Position.y[sourceId];
    if (sx === undefined || sy === undefined) return;

    // Find weakest enemy (lowest HP percentage) within range
    let weakestId = 0;
    let weakestHpPercent = 1.0;

    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;
      const dx = ex - sx;
      const dy = ey - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > config.range) continue;

      const currentHp = Health.current[eid] ?? 0;
      const maxHp = Health.max[eid] ?? 1;
      const hpPercent = currentHp / maxHp;
      if (hpPercent < weakestHpPercent) {
        weakestHpPercent = hpPercent;
        weakestId = eid;
      }
    }

    if (weakestId === 0) return; // No valid target

    // Teleport soldier adjacent to target
    const tx = Position.x[weakestId]!;
    const ty = Position.y[weakestId]!;
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Place assassin at a small offset from the target (attack range)
    const approachDist = Math.min(dist - 30, dist - 5);
    const ratio = dist > 0.01 ? approachDist / dist : 0;
    Position.x[sourceId] = tx - dx * ratio;
    Position.y[sourceId] = ty - dy * ratio;

    // Deal damage: base ATK × value multiplier
    const baseAtk = Attack.damage[sourceId] ?? 0;
    const damage = Math.round(baseAtk * config.value);
    applyDamageToTarget(world, weakestId, damage, DamageTypeVal.Physical);

    // Hit flash on target
    if (Visual.hitFlashTimer[weakestId] !== undefined) {
      Visual.hitFlashTimer[weakestId] = 0.15;
    }
  }

  // ---- Private ----

  private applyPassive(_world: TowerWorld, _entityId: number, _config: SkillConfig): void {
    if (_config.id === 'taunt') {
      this.refreshTauntAura(_world, _entityId, _config);
    }
  }

  private refreshTauntAura(world: TowerWorld, sourceId: number, config: SkillConfig): void {
    if (!entityExists(world.world, sourceId)) return;
    if ((Health.current[sourceId] ?? 0) <= 0) return;

    const sx = Position.x[sourceId];
    const sy = Position.y[sourceId];
    if (sx === undefined || sy === undefined) return;

    const duration = Math.max(config.value, 0.25);
    const enemies = enemyQuery(world.world);
    let retainedTarget: number | null = null;
    let nearestTarget: number | null = null;
    let nearestDist = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      if ((Health.current[eid] ?? 0) <= 0) {
        if (hasComponent(world.world, Taunted, eid) && Taunted.sourceId[eid] === sourceId) {
          world.removeComponent(eid, Taunted);
        }
        continue;
      }

      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;

      const dx = ex - sx;
      const dy = ey - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > config.range) {
        if (hasComponent(world.world, Taunted, eid) && Taunted.sourceId[eid] === sourceId) {
          world.removeComponent(eid, Taunted);
        }
        continue;
      }

      if (retainedTarget === null && hasComponent(world.world, Taunted, eid) && Taunted.sourceId[eid] === sourceId) {
        retainedTarget = eid;
      }

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestTarget = eid;
      }
    }

    const selectedTarget = retainedTarget ?? nearestTarget;
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (!hasComponent(world.world, Taunted, eid) || Taunted.sourceId[eid] !== sourceId) continue;

      if (eid !== selectedTarget) {
        world.removeComponent(eid, Taunted);
        if (Attack.targetId[eid] === sourceId) {
          Attack.targetId[eid] = 0;
        }
      }
    }

    if (selectedTarget === null) return;

    world.addComponent(selectedTarget, Taunted, { sourceId, timer: duration });
    if (Attack.targetId[selectedTarget] !== undefined) {
      Attack.targetId[selectedTarget] = sourceId;
    }
  }
}
