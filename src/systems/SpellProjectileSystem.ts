// ============================================================
// SpellProjectileSystem — 技能卡投射物动画系统
//
// 处理火球术、剑雨、暴风雪、炸弹等技能卡的飞行动画和爆炸效果。
// 设计：火球从手牌飞向目标，剑雨从天而降，暴风雪全屏覆盖，炸弹抛物线。
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position,
  SpellProjectile,
  SpellEffect,
  UnitTag,
  Health,
  DamageTypeVal,
  ScreenShake,
  Soldier,
  Tower,
} from '../core/components.js';
import { Renderer } from '../render/Renderer.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { Sound } from '../utils/Sound.js';
import { RenderSystem } from './RenderSystem.js';

// Spell type constants
const SPELL_FIREBALL = 0;
const SPELL_ARROW_RAIN = 1;
const SPELL_BLIZZARD = 2;
const SPELL_BOMB = 3;
const SPELL_EARTHQUAKE = 4;
const BLIZZARD_DAMAGE_TICKS = 5;
const ARROW_RAIN_WAVE_STARTS = [0, 0.45] as const;
const ARROW_RAIN_WAVE_FALL_TIME = 0.24;
const ARROW_RAIN_ARROW_COLOR = '#d32f2f';
const ARROW_RAIN_ARROW_TAIL = 'rgba(211, 47, 47, 0)';
const ARROW_RAIN_TRAIL_COLOR = '#ffcdd2';

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
    RenderSystem.tileJitter.intensity = 0;

    for (const eid of entities) {
      SpellEffect.elapsed[eid]! += dt;

      const duration = SpellEffect.duration[eid]!;
      const elapsed = SpellEffect.elapsed[eid]!;
      const progress = Math.min(elapsed / duration, 1);
      const spellType = SpellEffect.spellType[eid]!;
      const x = Position.x[eid]!;
      const y = Position.y[eid]!;
      const radius = SpellEffect.radius[eid]!;

      if (spellType === SPELL_EARTHQUAKE) {
        this.updateEarthquakeDamage(world, eid, x, y, radius);
      } else if (spellType === SPELL_BLIZZARD) {
        this.updateBlizzardDamage(world, eid, x, y, radius);
      } else if (spellType === SPELL_ARROW_RAIN) {
        this.updateArrowRainDamage(world, eid, x, y, radius);
      } else if (SpellEffect.hasDealtDamage[eid] === 0) {
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
          const tx = ax + 36;
          const ty = ay + 108;
          const a = localProgress < 0.05 ? localProgress / 0.05 : 1;
          this.renderArrowRainArrow(ax, ay, tx, ty, 24, a * 0.9, z);
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
        for (let wave = 0; wave < ARROW_RAIN_WAVE_STARTS.length; wave++) {
          const waveStart = ARROW_RAIN_WAVE_STARTS[wave]!;
          const waveLocal = progress * 0.8 - waveStart;
          if (waveLocal < -0.04) continue;

          for (let i = 0; i < 16; i++) {
            const globalIndex = wave * 16 + i;
            const col = (i % 8) - 3.5;
            const row = Math.floor(i / 8) - 0.5;
            const fall = Math.max(0, Math.min(1, waveLocal / ARROW_RAIN_WAVE_FALL_TIME));
            const impactX = x + col * 24 + Math.sin(globalIndex * 12.9898) * 11;
            const impactY = y + row * 42 + Math.cos(globalIndex * 7.233) * 9;
            const ax = impactX - 72 * (1 - fall);
            const ay = impactY - 210 * (1 - fall);
            if (fall < 1) {
              this.renderArrowRainArrow(ax, ay, impactX + 28, impactY + 96, 25, 0.92, z + 2);
            } else {
              const dust = Math.max(0, 1 - (waveLocal - ARROW_RAIN_WAVE_FALL_TIME) / 0.42);
              this.renderer.push({
                shape: 'circle',
                x: impactX,
                y: impactY,
                size: 7 + (1 - dust) * 10,
                color: '#b0bec5',
                alpha: dust * 0.28,
                z,
              });
              this.renderer.push({
                shape: 'rect',
                x: impactX,
                y: impactY + 6,
                size: 2,
                h: 24,
                color: '#795548',
                alpha: dust * 0.82,
                rotation: -0.28,
                z: z + 1,
              });
            }
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
        const entrance = Math.min(progress / 0.04, 1);
        const windAlpha = Math.max(0, alpha) * Math.max(0.72, entrance);
        const isGlobal = radius >= Math.max(RenderSystem.sceneW, RenderSystem.sceneH);
        const areaX = isGlobal ? RenderSystem.sceneOffsetX : x - radius;
        const areaY = isGlobal ? RenderSystem.sceneOffsetY : y - radius;
        const areaW = isGlobal ? RenderSystem.sceneW : radius * 2;
        const areaH = isGlobal ? RenderSystem.sceneH : radius * 2;
        if (isGlobal) {
          this.renderer.push({
            shape: 'rect',
            x: areaX + areaW / 2,
            y: areaY + areaH / 2,
            size: areaW,
            h: areaH,
            color: '#90caf9',
            alpha: windAlpha * 0.12,
            z,
          });
          this.renderer.push({
            shape: 'rect',
            x: areaX + areaW / 2,
            y: areaY + areaH / 2,
            size: areaW,
            h: areaH,
            color: '#e3f2fd',
            alpha: windAlpha * 0.08,
            z: z + 1,
          });
        }
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
        for (let i = 0; i < 96; i++) {
          const phase = (progress * 4.6 + i * 0.037) % 1;
          const laneSeed = (i * 53) % 101 / 100;
          const diagonal = phase * (areaW + areaH * 0.55);
          const baseX = isGlobal
            ? areaX - areaH * 0.25 + diagonal
            : x - radius * 1.15 + phase * radius * 2.3;
          const baseY = isGlobal
            ? areaY + laneSeed * areaH
            : y - radius * 0.9 + laneSeed * radius * 1.8;
          const gustX = baseX + Math.sin(progress * 32 + i * 1.7) * 22;
          const gustY = baseY + Math.sin(phase * Math.PI * 2 + i) * 18;
          if (gustX < areaX - 40 || gustX > areaX + areaW + 40 || gustY < areaY - 40 || gustY > areaY + areaH + 40) continue;
          const size = i % 6 === 0 ? 8 : 3 + (i % 4);
          this.renderer.push({
            shape: i % 6 === 0 ? 'diamond' : 'circle',
            x: gustX,
            y: gustY,
            size,
            color: i % 6 === 0 ? '#e1f5fe' : '#ffffff',
            alpha: windAlpha * (0.34 + (i % 5) * 0.07),
            z: z + 2,
          });
          if (i % 4 === 0) {
            this.renderer.push({
              shape: 'rect', x: gustX - 16, y: gustY + 2,
              size: 48 + (i % 3) * 18,
              h: 2 + (i % 2),
              color: '#e1f5fe',
              alpha: windAlpha * 0.22,
              rotation: 0,
              z: z + 1,
            });
          }
        }
        for (let i = 0; i < 72; i++) {
          const phase = (progress * 3.4 + i * 0.023) % 1;
          const laneSeed = (i * 47) % 103 / 102;
          const baseX = isGlobal
            ? areaX - 60 + phase * (areaW + 120)
            : x - radius + phase * radius * 2;
          const baseY = isGlobal
            ? areaY + laneSeed * areaH
            : y - radius + laneSeed * radius * 2;
          const flakeX = baseX + Math.sin(progress * 18 + i * 0.9) * 16;
          const flakeY = baseY + Math.sin(progress * 9 + i * 1.3) * 22;
          if (flakeX < areaX - 40 || flakeX > areaX + areaW + 40 || flakeY < areaY - 40 || flakeY > areaY + areaH + 40) continue;

          const flakeSize = 9 + (i % 5) * 2;
          const flakeAlpha = windAlpha * (0.62 + (i % 4) * 0.08);
          this.renderer.push({
            shape: 'diamond',
            x: flakeX,
            y: flakeY,
            size: flakeSize,
            color: i % 3 === 0 ? '#e3f2fd' : '#ffffff',
            alpha: flakeAlpha,
            z: z + 4,
          });
          this.renderer.push({
            shape: 'rect',
            x: flakeX,
            y: flakeY,
            size: flakeSize * 1.8,
            h: 2,
            color: '#ffffff',
            alpha: flakeAlpha * 0.72,
            rotation: 0,
            z: z + 4,
          });
          this.renderer.push({
            shape: 'rect',
            x: flakeX,
            y: flakeY,
            size: flakeSize * 1.4,
            h: 2,
            color: '#e1f5fe',
            alpha: flakeAlpha * 0.62,
            rotation: Math.PI / 2,
            z: z + 4,
          });
        }
        for (let i = 0; i < 16; i++) {
          const angle = progress * Math.PI * 4.5 + i * Math.PI * 0.2;
          const dist = isGlobal
            ? Math.min(areaW, areaH) * (0.12 + (i % 8) * 0.04)
            : radius * (0.25 + (i % 5) * 0.12);
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

      case SPELL_EARTHQUAKE: {
        const z = 8;
        const boardX = RenderSystem.sceneOffsetX;
        const boardY = RenderSystem.sceneOffsetY;
        const boardW = RenderSystem.sceneW;
        const boardH = RenderSystem.sceneH;
        const centerX = boardX + boardW / 2;
        const centerY = boardY + boardH / 2;
        const elapsed = progress * 3.0;
        const quakeAlpha = Math.max(0, 1 - progress * 0.42);
        const pulse = Math.abs(Math.sin(elapsed * Math.PI * 2));
        const jitterIntensity = (1 - progress * 0.45) * (2.5 + pulse * 3.5);
        RenderSystem.tileJitter.intensity = Math.max(RenderSystem.tileJitter.intensity, jitterIntensity);
        RenderSystem.tileJitter.seed = elapsed * 42;

        this.renderer.push({
          shape: 'rect',
          x: centerX,
          y: centerY,
          size: boardW,
          h: boardH,
          color: '#3e2723',
          alpha: quakeAlpha * 0.18,
          z,
        });

        for (let i = 0; i < 9; i++) {
          const lane = (i - 4) / 4;
          const crackProgress = Math.min(1, progress * 2.4 - i * 0.035);
          if (crackProgress <= 0) continue;
          const startX = centerX + lane * boardW * 0.35;
          const startY = boardY + boardH * 0.06;
          const length = boardH * (0.28 + crackProgress * 0.62);
          const wobble = Math.sin(elapsed * 9 + i * 2.1) * 18;
          const rotation = lane * 0.24 + Math.sin(i * 1.9) * 0.13;
          this.renderer.push({
            shape: 'rect',
            x: startX + wobble,
            y: startY + length / 2,
            size: 8 + (i % 3) * 3,
            h: length,
            color: '#1b0f0a',
            alpha: quakeAlpha * 0.82,
            rotation,
            z: z + 2,
          });
          this.renderer.push({
            shape: 'rect',
            x: startX + wobble + 8,
            y: startY + length * 0.56,
            size: 4,
            h: length * 0.5,
            color: '#ffb74d',
            alpha: quakeAlpha * 0.2,
            rotation: rotation + 0.18,
            z: z + 3,
          });
        }

        for (let i = 0; i < 28; i++) {
          const dustPhase = (progress * 1.7 + i * 0.071) % 1;
          const dustX = boardX + ((Math.sin(i * 19.19) * 0.5 + 0.5) * boardW);
          const dustY = boardY + ((Math.cos(i * 11.73) * 0.5 + 0.5) * boardH);
          this.renderer.push({
            shape: 'circle',
            x: dustX + Math.sin(elapsed * 8 + i) * 18,
            y: dustY - dustPhase * 24,
            size: 10 + dustPhase * 24,
            color: '#8d6e63',
            alpha: quakeAlpha * (1 - dustPhase) * 0.26,
            z: z + 1,
          });
        }
        break;
      }
    }
  }

  private renderArrowRainArrow(x: number, y: number, targetX: number, targetY: number, size: number, alpha: number, z: number): void {
    const angle = Math.atan2(targetY - y, targetX - x);
    this.renderer.push({
      shape: 'rect',
      x: x - Math.cos(angle) * 30,
      y: y - Math.sin(angle) * 30,
      size: 2,
      h: 62,
      color: ARROW_RAIN_TRAIL_COLOR,
      alpha: alpha * 0.24,
      rotation: angle + Math.PI / 2,
      z: z - 1,
    });
    this.renderer.push({
      shape: 'arrow',
      x,
      y,
      targetX,
      targetY,
      size,
      color: ARROW_RAIN_ARROW_COLOR,
      arrowGradientTail: ARROW_RAIN_ARROW_TAIL,
      arrowShaftWidthRatio: 0.08,
      arrowHeadWidthRatio: 0.26,
      arrowLengthScale: 1.45,
      alpha,
      z,
    });
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
      duration: isFireball ? 1.0 : (spellType === SPELL_BOMB ? 0.5 : spellType === SPELL_EARTHQUAKE ? 3.0 : 0.8),
      elapsed: 0,
      radius: SpellProjectile.radius[projectileId]!,
      damage: SpellProjectile.damage[projectileId]!,
      hasDealtDamage: 0,
    });

    // Screen shake for impactful spells
    if (isFireball || spellType === SPELL_BOMB || spellType === SPELL_EARTHQUAKE) {
      const shakeEid = world.createEntity();
      world.addComponent(shakeEid, ScreenShake, {
        intensity: spellType === SPELL_EARTHQUAKE ? 10 : isFireball ? 4 : 6,
        duration: spellType === SPELL_EARTHQUAKE ? 3.0 : isFireball ? 0.3 : 0.5,
        elapsed: 0,
        frequency: spellType === SPELL_EARTHQUAKE ? 18 : isFireball ? 40 : 30,
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
      case SPELL_EARTHQUAKE:
        Sound.play('exploder_boom');
        break;
    }
  }

  spawnGlobalEffect(world: TowerWorld, spellType: number, damage: number, duration: number): void {
    const effectId = world.createEntity();
    world.addComponent(effectId, Position, {
      x: RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2,
      y: RenderSystem.sceneOffsetY + RenderSystem.sceneH / 2,
    });
    world.addComponent(effectId, SpellEffect, {
      spellType,
      duration,
      elapsed: 0,
      radius: Math.max(RenderSystem.sceneW, RenderSystem.sceneH),
      damage,
      hasDealtDamage: 0,
    });

    const shakeEid = world.createEntity();
    world.addComponent(shakeEid, ScreenShake, {
      intensity: spellType === SPELL_BLIZZARD ? 3 : 12,
      duration: spellType === SPELL_BLIZZARD ? 0.25 : duration,
      elapsed: 0,
      frequency: spellType === SPELL_BLIZZARD ? 26 : 20,
    });
    Sound.play(spellType === SPELL_BLIZZARD ? 'ice_hit' : 'skill_earthquake');
  }

  private updateEarthquakeDamage(world: TowerWorld, effectId: number, x: number, y: number, radius: number): void {
    const elapsed = SpellEffect.elapsed[effectId]!;
    const dealtTicks = SpellEffect.hasDealtDamage[effectId]!;
    const dueTicks = Math.min(3, Math.floor(elapsed));
    for (let tick = dealtTicks + 1; tick <= dueTicks; tick++) {
      this.dealAreaDamage(world, effectId, x, y, radius, SPELL_EARTHQUAKE);
    }
    SpellEffect.hasDealtDamage[effectId] = dueTicks;
  }

  private updateArrowRainDamage(world: TowerWorld, effectId: number, x: number, y: number, radius: number): void {
    const elapsed = SpellEffect.elapsed[effectId]!;
    const dealtTicks = SpellEffect.hasDealtDamage[effectId]!;
    let dueTicks = dealtTicks;

    for (let i = dealtTicks; i < ARROW_RAIN_WAVE_STARTS.length; i++) {
      const damageTime = ARROW_RAIN_WAVE_STARTS[i]! + ARROW_RAIN_WAVE_FALL_TIME;
      if (elapsed >= damageTime) {
        this.dealAreaDamage(world, effectId, x, y, radius, SPELL_ARROW_RAIN);
        dueTicks = i + 1;
      }
    }

    SpellEffect.hasDealtDamage[effectId] = dueTicks;
  }

  private updateBlizzardDamage(world: TowerWorld, effectId: number, x: number, y: number, radius: number): void {
    const elapsed = SpellEffect.elapsed[effectId]!;
    const dealtTicks = SpellEffect.hasDealtDamage[effectId]!;
    const dueTicks = Math.min(BLIZZARD_DAMAGE_TICKS, Math.floor(elapsed) + 1);
    for (let tick = dealtTicks + 1; tick <= dueTicks; tick++) {
      this.dealAreaDamage(world, effectId, x, y, radius, SPELL_BLIZZARD);
    }
    SpellEffect.hasDealtDamage[effectId] = dueTicks;
  }

  private dealAreaDamage(world: TowerWorld, effectId: number, x: number, y: number, radius: number, spellType: number): void {
    const damage = SpellEffect.damage[effectId]!;
    const damageType = spellType === SPELL_FIREBALL ? DamageTypeVal.Magic :
                       spellType === SPELL_BLIZZARD ? DamageTypeVal.Magic :
                       spellType === SPELL_EARTHQUAKE ? DamageTypeVal.Physical :
                       DamageTypeVal.Physical;

    for (let eid = 1; eid < Position.x.length; eid++) {
      if (!this.canSpellDamageTarget(world, spellType, eid)) continue;
      if ((Health.current[eid] ?? 0) <= 0) continue;
      const px = Position.x[eid] ?? 0;
      const py = Position.y[eid] ?? 0;
      const dist = Math.hypot(px - x, py - y);
      if (dist < radius || spellType === SPELL_EARTHQUAKE || spellType === SPELL_BLIZZARD) {
        applyDamageToTarget(world, eid, damage, damageType);
      }
    }
  }

  private canSpellDamageTarget(world: TowerWorld, spellType: number, eid: number): boolean {
    if (spellType === SPELL_EARTHQUAKE) return true;
    if (spellType === SPELL_BLIZZARD) {
      if (hasComponent(world.world, Tower, eid)) return false;
      return UnitTag.isEnemy[eid] === 1 || hasComponent(world.world, Soldier, eid);
    }
    return UnitTag.isEnemy[eid] === 1;
  }
}
