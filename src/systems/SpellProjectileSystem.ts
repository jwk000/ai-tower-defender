// ============================================================
// SpellProjectileSystem — 技能卡投射物动画系统
//
// 处理火球术、剑雨、暴风雪、炸弹等技能卡的飞行动画和爆炸效果。
// 设计：火球从手牌飞向目标，剑雨从天而降，暴风雪旋风效果，炸弹抛物线。
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position,
  Visual,
  SpellProjectile,
  SpellEffect,
  UnitTag,
  Health,
  Movement,
  DamageTypeVal,
  ShapeVal,
  ExplosionEffect,
} from '../core/components.js';
import { Renderer } from '../render/Renderer.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { Sound } from '../utils/Sound.js';

// Spell type constants
const SPELL_FIREBALL = 0;
const SPELL_ARROW_RAIN = 1;
const SPELL_BLIZZARD = 2;
const SPELL_BOMB = 3;

const projectileQuery = defineQuery([SpellProjectile, Position]);
const effectQuery = defineQuery([SpellEffect, Position]);

export class SpellProjectileSystem implements System {
  readonly name = 'SpellProjectileSystem';

  constructor(private renderer: Renderer) {}

  update(world: TowerWorld, dt: number): void {
    this.updateProjectiles(world, dt);
    this.updateEffects(world, dt);
  }

  // ============================================================
  // Projectile Updates (flying phase)
  // ============================================================

  private updateProjectiles(world: TowerWorld, dt: number): void {
    const entities = projectileQuery(world.world);

    for (const eid of entities) {
      SpellProjectile.elapsed[eid]! += dt;

      const duration = SpellProjectile.duration[eid]!;
      const elapsed = SpellProjectile.elapsed[eid]!;
      const progress = Math.min(elapsed / duration, 1);

      const startX = SpellProjectile.startX[eid]!;
      const startY = SpellProjectile.startY[eid]!;
      const targetX = SpellProjectile.targetX[eid]!;
      const targetY = SpellProjectile.targetY[eid]!;
      const spellType = SpellProjectile.spellType[eid]!;

      // Calculate current position with interpolation
      let currentX: number;
      let currentY: number;

      switch (spellType) {
        case SPELL_FIREBALL:
          // Fireball: linear interpolation with slight arc
          currentX = startX + (targetX - startX) * progress;
          currentY = startY + (targetY - startY) * progress - Math.sin(progress * Math.PI) * 30;
          break;

        case SPELL_ARROW_RAIN:
          // Arrows: fall from above
          currentX = targetX + (Math.random() - 0.5) * 20;
          currentY = startY + (targetY - startY) * progress;
          break;

        case SPELL_BLIZZARD:
          // Blizzard: spiral towards target
          const angle = progress * Math.PI * 4;
          const radius = 50 * (1 - progress);
          currentX = targetX + Math.cos(angle) * radius;
          currentY = targetY + Math.sin(angle) * radius - 50 * (1 - progress);
          break;

        case SPELL_BOMB:
          // Bomb: parabolic trajectory
          currentX = startX + (targetX - startX) * progress;
          currentY = startY + (targetY - startY) * progress - Math.sin(progress * Math.PI) * 60;
          break;

        default:
          currentX = startX + (targetX - startX) * progress;
          currentY = startY + (targetY - startY) * progress;
      }

      // Update position
      Position.x[eid] = currentX;
      Position.y[eid] = currentY;

      // Render the projectile
      this.renderProjectile(eid, spellType, currentX, currentY, progress);

      // Check if reached target
      if (progress >= 1) {
        // Transition to effect phase
        this.spawnEffect(world, eid, spellType, targetX, targetY);
        world.destroyEntity(eid);
      }
    }
  }

  // ============================================================
  // Effect Updates (explosion/area effect phase)
  // ============================================================

  private updateEffects(world: TowerWorld, dt: number): void {
    const entities = effectQuery(world.world);

    for (const eid of entities) {
      SpellEffect.elapsed[eid]! += dt;

      const duration = SpellEffect.duration[eid]!;
      const elapsed = SpellEffect.elapsed[eid]!;
      const progress = Math.min(elapsed / duration, 1);
      const spellType = SpellEffect.spellType[eid]!;
      const x = Position.x[eid]!;
      const y = Position.y[eid]!;
      const radius = SpellEffect.radius[eid]!;

      // Deal damage on first frame
      if (SpellEffect.hasDealtDamage[eid] === 0) {
        this.dealAreaDamage(world, eid, x, y, radius, spellType);
        SpellEffect.hasDealtDamage[eid] = 1;
      }

      // Render effect
      this.renderEffect(spellType, x, y, radius, progress);

      // Destroy when complete
      if (progress >= 1) {
        world.destroyEntity(eid);
      }
    }
  }

  // ============================================================
  // Rendering
  // ============================================================

  private renderProjectile(eid: number, spellType: number, x: number, y: number, progress: number): void {
    const alpha = 1;

    switch (spellType) {
      case SPELL_FIREBALL:
        // Fireball: orange-red glowing circle with trail
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: 20 + Math.sin(progress * Math.PI * 4) * 4,
          color: '#ff5722',
          alpha,
        });
        // Inner glow
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: 12,
          color: '#ffab40',
          alpha: 0.8,
        });
        // Trail particles
        for (let i = 0; i < 3; i++) {
          const trailProgress = Math.max(0, progress - i * 0.05);
          const trailX = SpellProjectile.startX[eid]! + (SpellProjectile.targetX[eid]! - SpellProjectile.startX[eid]!) * trailProgress;
          const trailY = SpellProjectile.startY[eid]! + (SpellProjectile.targetY[eid]! - SpellProjectile.startY[eid]!) * trailProgress - Math.sin(trailProgress * Math.PI) * 30;
          this.renderer.push({
            shape: 'circle',
            x: trailX, y: trailY,
            size: 8 - i * 2,
            color: '#ff9800',
            alpha: 0.4 - i * 0.1,
          });
        }
        break;

      case SPELL_ARROW_RAIN:
        // Arrow: small triangle pointing down
        this.renderer.push({
          shape: 'triangle',
          x, y,
          size: 8,
          color: '#8d6e63',
          alpha,
        });
        break;

      case SPELL_BLIZZARD:
        // Snowflake: white diamond
        this.renderer.push({
          shape: 'diamond',
          x, y,
          size: 10 + Math.sin(progress * Math.PI * 6) * 3,
          color: '#e3f2fd',
          alpha: 0.9,
        });
        break;

      case SPELL_BOMB:
        // Bomb: dark circle with fuse
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: 16,
          color: '#424242',
          alpha,
        });
        // Fuse spark
        this.renderer.push({
          shape: 'circle',
          x: x + 6, y: y - 8,
          size: 4,
          color: '#ffeb3b',
          alpha: 0.5 + Math.sin(progress * Math.PI * 10) * 0.5,
        });
        break;
    }
  }

  private renderEffect(spellType: number, x: number, y: number, radius: number, progress: number): void {
    const alpha = 1 - progress;

    switch (spellType) {
      case SPELL_FIREBALL:
        // Explosion: expanding orange-red circle
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: radius * progress * 2,
          color: '#ff5722',
          alpha: alpha * 0.6,
        });
        // Inner bright flash
        if (progress < 0.3) {
          this.renderer.push({
            shape: 'circle',
            x, y,
            size: radius * (1 - progress / 0.3),
            color: '#ffab40',
            alpha: (1 - progress / 0.3) * 0.8,
          });
        }
        break;

      case SPELL_ARROW_RAIN:
        // Multiple arrows falling
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dist = radius * progress * 0.8;
          const ax = x + Math.cos(angle) * dist;
          const ay = y + Math.sin(angle) * dist - 20 * (1 - progress);
          this.renderer.push({
            shape: 'triangle',
            x: ax, y: ay,
            size: 6,
            color: '#8d6e63',
            alpha: alpha * 0.8,
          });
        }
        break;

      case SPELL_BLIZZARD:
        // Snowstorm: multiple snowflakes swirling
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + progress * Math.PI * 4;
          const dist = radius * (0.5 + Math.sin(progress * Math.PI + i) * 0.3);
          const sx = x + Math.cos(angle) * dist;
          const sy = y + Math.sin(angle) * dist;
          this.renderer.push({
            shape: 'diamond',
            x: sx, y: sy,
            size: 8,
            color: '#e3f2fd',
            alpha: alpha * 0.7,
          });
        }
        // Central frost effect
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: radius * 0.5,
          color: '#90caf9',
          alpha: alpha * 0.3,
        });
        break;

      case SPELL_BOMB:
        // Explosion: expanding red-orange circle with debris
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: radius * progress * 2,
          color: '#ff5722',
          alpha: alpha * 0.7,
        });
        // Debris particles
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const dist = radius * progress;
          const dx = x + Math.cos(angle) * dist;
          const dy = y + Math.sin(angle) * dist;
          this.renderer.push({
            shape: 'rect',
            x: dx, y: dy,
            size: 4,
            h: 4,
            color: '#795548',
            alpha: alpha,
          });
        }
        break;
    }
  }

  // ============================================================
  // Damage & Effects
  // ============================================================

  private spawnEffect(world: TowerWorld, projectileId: number, spellType: number, x: number, y: number): void {
    const effectId = world.createEntity();
    world.addComponent(effectId, Position, { x, y });
    world.addComponent(effectId, SpellEffect, {
      spellType,
      duration: spellType === SPELL_BOMB ? 0.5 : 0.8,
      elapsed: 0,
      radius: SpellProjectile.radius[projectileId]!,
      damage: SpellProjectile.damage[projectileId]!,
      hasDealtDamage: 0,
    });

    // Play sound
    switch (spellType) {
      case SPELL_FIREBALL:
        Sound.play('exploder_boom');
        break;
      case SPELL_ARROW_RAIN:
        Sound.play('arrow_hit');
        break;
      case SPELL_BLIZZARD:
        Sound.play('ice_hit');
        break;
      case SPELL_BOMB:
        Sound.play('exploder_boom');
        break;
    }
  }

  private dealAreaDamage(world: TowerWorld, effectId: number, x: number, y: number, radius: number, spellType: number): void {
    const damage = SpellEffect.damage[effectId]!;
    const damageType = spellType === SPELL_FIREBALL ? DamageTypeVal.Magic :
                       spellType === SPELL_BLIZZARD ? DamageTypeVal.Magic :
                       DamageTypeVal.Physical;

    for (let eid = 1; eid < Position.x.length; eid++) {
      if (UnitTag.isEnemy[eid] !== 1) continue;
      if ((Health.current[eid] ?? 0) <= 0) continue;
      const px = Position.x[eid] ?? 0;
      const py = Position.y[eid] ?? 0;
      const dist = Math.hypot(px - x, py - y);
      if (dist < radius) {
        applyDamageToTarget(world, eid, damage, damageType);

        // Blizzard slow effect
        if (spellType === SPELL_BLIZZARD) {
          const curSpeed = Movement.speed[eid];
          if (curSpeed !== undefined) {
            Movement.speed[eid] = curSpeed * 0.7;
          }
        }
      }
    }
  }
}
