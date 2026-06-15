// ============================================================
// SpellProjectileSystem — 技能卡投射物动画系统
//
// 处理火球术、剑雨、暴风雪、炸弹等技能卡的飞行动画和爆炸效果。
// 设计：火球从手牌飞向目标，剑雨从天而降，暴风雪旋风效果，炸弹抛物线。
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position,
  SpellProjectile,
  SpellEffect,
  UnitTag,
  Health,
  Movement,
  DamageTypeVal,
  ScreenShake,
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
      case SPELL_FIREBALL: {
        // ── Burning Fireball: multi-layer flame core + particle trail ──
        const elapsed = SpellProjectile.elapsed[eid]!;
        const flicker = 0.85 + 0.15 * Math.sin(elapsed * 18);
        const pulse = 0.9 + 0.1 * Math.sin(elapsed * 12);
        const z = 7; // Above ground entities

        // Outer flame aura (large, soft, flickering)
        this.renderer.push({
          shape: 'circle', x, y,
          size: 44 * flicker,
          color: '#ff3d00',
          alpha: 0.2 * pulse,
          z,
        });
        this.renderer.push({
          shape: 'circle', x, y,
          size: 34 * flicker,
          color: '#ff6d00',
          alpha: 0.3 * pulse,
          z,
        });

        // Flame wisps (4 small circles around edge, rotating)
        for (let w = 0; w < 4; w++) {
          const wAngle = elapsed * 5 + w * Math.PI * 0.5;
          const wDist = 14 + Math.sin(elapsed * 8 + w) * 4;
          const wx = x + Math.cos(wAngle) * wDist;
          const wy = y + Math.sin(wAngle) * wDist;
          this.renderer.push({
            shape: 'circle',
            x: wx, y: wy,
            size: 8 + Math.sin(elapsed * 12 + w) * 3,
            color: '#ff9100',
            alpha: 0.5,
            z,
          });
        }

        // Inner fire core
        this.renderer.push({
          shape: 'circle', x, y,
          size: 20 * pulse,
          color: '#ff9800',
          alpha: 0.85,
          z: z + 1,
        });
        this.renderer.push({
          shape: 'circle', x, y,
          size: 12 * flicker,
          color: '#ffc107',
          alpha: 0.9,
          z: z + 2,
        });
        // White-hot center
        this.renderer.push({
          shape: 'circle', x, y,
          size: 6 * pulse,
          color: '#fff9c4',
          alpha: 1,
          z: z + 3,
        });
        // ── Particle trail: 6 flame particles trailing behind ──
        for (let i = 0; i < 6; i++) {
          const t = Math.max(0, progress - (i + 1) * 0.03);
          const spreadAngle = i * 1.2 + Math.sin(elapsed * 14 + i * 2.5) * 0.5;
          const spreadDist = (i + 1) * 3 + Math.sin(elapsed * 8 + i) * 4;
          const startX = SpellProjectile.startX[eid]!;
          const startY = SpellProjectile.startY[eid]!;
          const targetX = SpellProjectile.targetX[eid]!;
          const targetY = SpellProjectile.targetY[eid]!;
          const tX = startX + (targetX - startX) * t;
          const tY = startY + (targetY - startY) * t - Math.sin(t * Math.PI) * 30;
          const pX = tX + Math.cos(spreadAngle) * spreadDist;
          const pY = tY + Math.sin(spreadAngle) * spreadDist;
          const tSize = 10 - i * 1.2;
          const tAlpha = 0.6 - i * 0.08;
          // Outer glow
          this.renderer.push({
            shape: 'circle', x: pX, y: pY,
            size: tSize * 1.6,
            color: '#ff3d00',
            alpha: tAlpha * 0.3,
            z: z - 1,
          });
          // Core
          this.renderer.push({
            shape: 'circle', x: pX, y: pY,
            size: tSize,
            color: '#ff9800',
            alpha: tAlpha,
            z,
          });
        }
        break;
      }

      case SPELL_ARROW_RAIN: {
        const elapsed = SpellProjectile.elapsed[eid]!;
        const startX = SpellProjectile.startX[eid]!;
        const startY = SpellProjectile.startY[eid]!;
        const targetX = SpellProjectile.targetX[eid]!;
        const targetY = SpellProjectile.targetY[eid]!;
        const z = 8;
        for (let i = 0; i < 14; i++) {
          const lane = i - 6.5;
          const localProgress = Math.max(0, Math.min(1, progress * 1.35 - i * 0.025));
          const drift = Math.sin(elapsed * 9 + i * 1.7) * 8;
          const ax = startX + lane * 13 + drift;
          const ay = startY + (targetY - startY) * localProgress;
          const tx = targetX + lane * 9 - 22;
          const ty = ay + 56;
          const a = localProgress < 0.05 ? localProgress / 0.05 : 1;
          this.renderer.push({
            shape: 'arrow',
            x: ax,
            y: ay,
            targetX: tx,
            targetY: ty,
            size: 28,
            color: '#d7ccc8',
            arrowGradientTail: 'rgba(215, 204, 200, 0)',
            alpha: a * 0.88,
            z,
          });
          this.renderer.push({
            shape: 'rect',
            x: ax + 6,
            y: ay - 18,
            size: 3,
            h: 34,
            color: '#f5f5f5',
            alpha: a * 0.22,
            rotation: -0.45,
            z: z - 1,
          });
        }
        break;
      }

      case SPELL_BLIZZARD: {
        const elapsed = SpellProjectile.elapsed[eid]!;
        const z = 8;
        for (let i = 0; i < 18; i++) {
          const swirl = progress * Math.PI * 7 + i * 0.75;
          const r = 14 + (i % 6) * 7 + (1 - progress) * 20;
          const windX = progress * 60;
          const sx = x + Math.cos(swirl) * r + windX - 30;
          const sy = y + Math.sin(swirl) * r * 0.45 + Math.sin(elapsed * 14 + i) * 5;
          this.renderer.push({
            shape: i % 3 === 0 ? 'diamond' : 'circle',
            x: sx,
            y: sy,
            size: 3 + (i % 4) * 1.6,
            color: i % 3 === 0 ? '#e3f2fd' : '#bbdefb',
            alpha: 0.35 + (i % 5) * 0.08,
            z,
          });
        }
        for (let i = 0; i < 4; i++) {
          this.renderer.push({
            shape: 'rect',
            x: x - 42 + i * 26 + Math.sin(elapsed * 6 + i) * 6,
            y: y - 12 + i * 5,
            size: 38 + i * 8,
            h: 3,
            color: '#e1f5fe',
            alpha: 0.18,
            rotation: -0.28,
            z: z - 1,
          });
        }
        break;
      }

      case SPELL_BOMB: {
        const spin = progress * Math.PI * 2;
        // Bomb: dark circle with fuse
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: 16,
          color: '#424242',
          alpha,
          z: 8,
        });
        this.renderer.push({
          shape: 'rect',
          x: x + Math.cos(spin) * 10,
          y: y - 9 + Math.sin(spin) * 3,
          size: 10,
          h: 3,
          color: '#795548',
          alpha: 0.9,
          rotation: spin,
          z: 9,
        });
        // Fuse spark
        this.renderer.push({
          shape: 'circle',
          x: x + 6, y: y - 8,
          size: 4,
          color: '#ffeb3b',
          alpha: 0.5 + Math.sin(progress * Math.PI * 10) * 0.5,
          z: 10,
        });
        break;
      }
    }
  }

  private renderEffect(spellType: number, x: number, y: number, radius: number, progress: number): void {
    const alpha = 1 - progress;

    switch (spellType) {
      case SPELL_FIREBALL: {
        // ── Fireball Impact: flash → shockwave → ground fire → smoke ──
        const z = 6;

        // Phase 1: Bright flash (0-0.15s)
        if (progress < 0.15) {
          const flashProgress = progress / 0.15;
          const flashAlpha = (1 - flashProgress) * 0.9;
          const flashSize = radius * (1.5 - flashProgress * 0.8);
          // White core
          this.renderer.push({
            shape: 'circle', x, y,
            size: flashSize,
            color: '#ffffff',
            alpha: flashAlpha,
            z: z + 5,
          });
          // Yellow burst
          this.renderer.push({
            shape: 'circle', x, y,
            size: flashSize * 1.4,
            color: '#ffeb3b',
            alpha: flashAlpha * 0.7,
            z: z + 4,
          });
        }

        // Phase 2: Expanding fire ring (0-1.0s)
        const ringProgress = Math.min(progress / 0.6, 1);
        const easeOut = 1 - Math.pow(1 - ringProgress, 2); // ease-out quad
        const ringRadius = radius * easeOut;
        const ringAlpha = (1 - progress) * 0.7;

        // Outer shockwave ring
        this.renderer.push({
          shape: 'circle', x, y,
          size: ringRadius * 2.2,
          color: '#ff5722',
          alpha: ringAlpha * 0.35,
          stroke: '#ff5722',
          strokeWidth: 3,
          z,
        });
        // Inner fire fill
        this.renderer.push({
          shape: 'circle', x, y,
          size: ringRadius * 1.5,
          color: '#ff6d00',
          alpha: ringAlpha * 0.45,
          z: z + 1,
        });
        // Core heat glow
        this.renderer.push({
          shape: 'circle', x, y,
          size: ringRadius * 0.7,
          color: '#ffab40',
          alpha: ringAlpha * 0.5,
          z: z + 2,
        });

        // Phase 3: Ground flame scatter (0.1-1.0s) — 8 flame patches
        if (progress > 0.05) {
          const flameProgress = (progress - 0.05) / 0.95;
          for (let i = 0; i < 8; i++) {
            const fAngle = (i / 8) * Math.PI * 2 + i * 0.3;
            const fDist = radius * (0.3 + flameProgress * 0.9);
            const fX = x + Math.cos(fAngle) * fDist;
            const fY = y + Math.sin(fAngle) * fDist - flameProgress * 8; // slight drift up
            const fFade = Math.max(0, 1 - flameProgress * 1.1);
            const fPulse = 0.8 + 0.2 * Math.sin(Date.now() * 0.015 + i * 2);
            // Flame glow
            this.renderer.push({
              shape: 'circle', x: fX, y: fY,
              size: 14 * fFade * fPulse,
              color: '#ff6d00',
              alpha: fFade * 0.5,
              z: z + 1,
            });
            // Flame core
            this.renderer.push({
              shape: 'circle', x: fX, y: fY,
              size: 8 * fFade * fPulse,
              color: '#ffc107',
              alpha: fFade * 0.7,
              z: z + 2,
            });
          }
        }

        // Phase 4: Rising smoke (0.1-1.0s) — 5 dark particles
        if (progress > 0.1) {
          const smokeProgress = (progress - 0.1) / 0.9;
          for (let i = 0; i < 5; i++) {
            const sAngle = (i / 5) * Math.PI * 2 + 0.5;
            const sDist = radius * 0.4 + smokeProgress * radius * 0.6 + i * 12;
            const sX = x + Math.cos(sAngle) * sDist + Math.sin(smokeProgress * 3 + i) * 15;
            const sY = y + Math.sin(sAngle) * sDist * 0.5 - smokeProgress * 25;
            const sFade = Math.max(0, 1 - smokeProgress * 1.0);
            this.renderer.push({
              shape: 'circle', x: sX, y: sY,
              size: 10 + smokeProgress * 16,
              color: '#212121',
              alpha: sFade * 0.35,
              z: z + 3,
            });
            this.renderer.push({
              shape: 'circle', x: sX + 3, y: sY - 2,
              size: 6 + smokeProgress * 10,
              color: '#424242',
              alpha: sFade * 0.25,
              z: z + 3,
            });
          }
        }
        break;
      }

      case SPELL_ARROW_RAIN: {
        const z = 7;
        const volleyProgress = Math.min(progress / 0.62, 1);
        for (let i = 0; i < 32; i++) {
          const col = (i % 8) - 3.5;
          const row = Math.floor(i / 8) - 1.5;
          const delay = (i % 5) * 0.035;
          const fall = Math.max(0, Math.min(1, volleyProgress * 1.2 - delay));
          const impactX = x + col * 24 + Math.sin(i * 12.9898) * 11;
          const impactY = y + row * 25 + Math.cos(i * 7.233) * 9;
          const ax = impactX - 54 * (1 - fall);
          const ay = impactY - 170 * (1 - fall);
          if (fall < 1) {
            this.renderer.push({
              shape: 'arrow',
              x: ax,
              y: ay,
              targetX: impactX + 8,
              targetY: impactY + 42,
              size: 30,
              color: '#eceff1',
              arrowGradientTail: 'rgba(236, 239, 241, 0)',
              alpha: 0.92,
              z: z + 2,
            });
          } else {
            const dust = Math.max(0, 1 - (progress - 0.48 - delay) / 0.45);
            this.renderer.push({
              shape: 'circle',
              x: impactX,
              y: impactY,
              size: 8 + (1 - dust) * 12,
              color: '#b0bec5',
              alpha: dust * 0.3,
              z,
            });
            this.renderer.push({
              shape: 'rect',
              x: impactX,
              y: impactY + 4,
              size: 3,
              h: 20,
              color: '#795548',
              alpha: dust * 0.9,
              rotation: -0.18,
              z: z + 1,
            });
          }
        }
        const ringAlpha = Math.max(0, 1 - progress * 1.8);
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: radius * (1.25 + progress * 0.35),
          color: '#cfd8dc',
          alpha: ringAlpha * 0.12,
          stroke: '#eceff1',
          strokeWidth: 2,
          z,
        });
        break;
      }

      case SPELL_BLIZZARD: {
        const z = 7;
        const windAlpha = Math.max(0, alpha);
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: radius * (1.6 + progress * 0.25),
          color: '#90caf9',
          alpha: windAlpha * 0.16,
          z,
        });
        this.renderer.push({
          shape: 'circle',
          x, y,
          size: radius * (1.95 + progress * 0.15),
          color: '#e3f2fd',
          alpha: windAlpha * 0.08,
          stroke: '#bbdefb',
          strokeWidth: 3,
          z: z + 1,
        });
        for (let i = 0; i < 42; i++) {
          const phase = (progress * 2.2 + i * 0.061) % 1;
          const band = i % 6;
          const lane = band - 2.5;
          const gustX = x - radius * 0.95 + phase * radius * 1.9;
          const gustY = y + lane * 24 + Math.sin(phase * Math.PI * 2 + i) * 18;
          const size = i % 4 === 0 ? 7 : 3 + (i % 3);
          this.renderer.push({
            shape: i % 4 === 0 ? 'diamond' : 'circle',
            x: gustX,
            y: gustY,
            size,
            color: i % 4 === 0 ? '#e1f5fe' : '#ffffff',
            alpha: windAlpha * (0.3 + (i % 5) * 0.06),
            z: z + 2,
          });
          if (i % 5 === 0) {
            this.renderer.push({
              shape: 'rect',
              x: gustX - 10,
              y: gustY + 2,
              size: 34,
              h: 3,
              color: '#e1f5fe',
              alpha: windAlpha * 0.16,
              rotation: -0.32,
              z: z + 1,
            });
          }
        }
        for (let i = 0; i < 10; i++) {
          const angle = progress * Math.PI * 3.5 + i * Math.PI * 0.2;
          const dist = radius * (0.25 + (i % 5) * 0.12);
          this.renderer.push({
            shape: 'diamond',
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist * 0.55,
            size: 8 + (i % 3) * 3,
            color: '#b3e5fc',
            alpha: windAlpha * 0.48,
            z: z + 3,
          });
        }
        break;
      }

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
    const isFireball = spellType === SPELL_FIREBALL;
    world.addComponent(effectId, Position, { x, y });
    world.addComponent(effectId, SpellEffect, {
      spellType,
      duration: isFireball ? 1.0 : (spellType === SPELL_BOMB ? 0.5 : 0.8),
      elapsed: 0,
      radius: SpellProjectile.radius[projectileId]!,
      damage: SpellProjectile.damage[projectileId]!,
      hasDealtDamage: 0,
    });

    // Screen shake for impactful spells
    if (isFireball || spellType === SPELL_BOMB) {
      const shakeEid = world.createEntity();
      world.addComponent(shakeEid, ScreenShake, {
        intensity: isFireball ? 4 : 6,
        duration: isFireball ? 0.3 : 0.5,
        elapsed: 0,
        frequency: isFireball ? 40 : 30,
      });
    }

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
