import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  EnemySkillParticleEffect,
  EnemySkillParticleEffectVal,
  Position,
} from '../core/components.js';
import { Renderer } from '../render/Renderer.js';

const effectQuery = defineQuery([EnemySkillParticleEffect, Position]);

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function rand01(seed: number, index: number): number {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pushParticle(
  renderer: Renderer,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  z = 8,
): void {
  renderer.push({ shape: 'circle', x, y, size, color, alpha, z });
}

function pushStreak(
  renderer: Renderer,
  x: number,
  y: number,
  length: number,
  thickness: number,
  color: string,
  alpha: number,
  rotation: number,
  z = 8,
): void {
  renderer.push({
    shape: 'rect',
    x,
    y,
    size: thickness,
    h: length,
    color,
    alpha,
    rotation,
    z,
  });
}

export class EnemySkillParticleSystem implements System {
  readonly name = 'EnemySkillParticleSystem';

  constructor(private renderer: Renderer) {}

  update(world: TowerWorld, dt: number): void {
    const entities = effectQuery(world.world);
    for (const eid of entities) {
      EnemySkillParticleEffect.elapsed[eid]! += dt;
      const duration = EnemySkillParticleEffect.duration[eid]!;
      const elapsed = EnemySkillParticleEffect.elapsed[eid]!;
      const progress = Math.min(elapsed / Math.max(0.001, duration), 1);

      this.renderEffect(eid, progress);

      if (elapsed >= duration) {
        world.destroyEntity(eid);
      }
    }
  }

  private renderEffect(eid: number, progress: number): void {
    const type = EnemySkillParticleEffect.effectType[eid]!;
    const x = Position.x[eid] ?? 0;
    const y = Position.y[eid] ?? 0;
    const tx = EnemySkillParticleEffect.targetX[eid] ?? x;
    const ty = EnemySkillParticleEffect.targetY[eid] ?? y;
    const radius = EnemySkillParticleEffect.radius[eid] ?? 40;
    const seed = EnemySkillParticleEffect.seed[eid] ?? 1;
    const base = rgb(
      EnemySkillParticleEffect.colorR[eid] ?? 255,
      EnemySkillParticleEffect.colorG[eid] ?? 255,
      EnemySkillParticleEffect.colorB[eid] ?? 255,
    );

    switch (type) {
      case EnemySkillParticleEffectVal.ArcaneBolt:
        this.renderBeamParticles(x, y, tx, ty, progress, seed, base, '#f3e5f5');
        break;
      case EnemySkillParticleEffectVal.Guard:
        this.renderOrbitShield(x, y, radius, progress, seed, base, '#ffffff');
        break;
      case EnemySkillParticleEffectVal.Charge:
        this.renderChargeTrail(x, y, tx, ty, progress, seed, base);
        break;
      case EnemySkillParticleEffectVal.Debuff:
        this.renderFallingRunes(tx, ty, radius, progress, seed, base);
        break;
      case EnemySkillParticleEffectVal.PoisonPool:
        this.renderPoolBubbles(tx, ty, radius, progress, seed, base);
        break;
      case EnemySkillParticleEffectVal.Summon:
        this.renderSummonMotes(x, y, radius, progress, seed, base);
        break;
      case EnemySkillParticleEffectVal.AoeSlam:
        this.renderRadialBurst(x, y, radius, progress, seed, base, '#d7ccc8');
        break;
      case EnemySkillParticleEffectVal.WarCry:
        this.renderWarCry(x, y, radius, progress, seed);
        break;
      case EnemySkillParticleEffectVal.Petrify:
        this.renderPetrifyDust(x, y, radius, progress, seed);
        break;
      case EnemySkillParticleEffectVal.RealityWarp:
        this.renderWarpMotes(x, y, radius, progress, seed);
        break;
      case EnemySkillParticleEffectVal.Missile:
        this.renderMissileBlast(tx, ty, radius, progress, seed);
        break;
      case EnemySkillParticleEffectVal.DarkDevour:
        this.renderDarkDevour(x, y, radius, progress, seed);
        break;
      case EnemySkillParticleEffectVal.Warning:
        this.renderWarningSparks(x, y, radius, progress, seed, base);
        break;
      case EnemySkillParticleEffectVal.FrostAura:
        this.renderFrostAura(x, y, radius, progress, seed);
        break;
      case EnemySkillParticleEffectVal.HealAura:
        this.renderHealAura(x, y, radius, progress, seed);
        break;
    }
  }

  private renderBeamParticles(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    progress: number,
    seed: number,
    color: string,
    core: string,
  ): void {
    const dx = tx - sx;
    const dy = ty - sy;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    const alpha = 1 - progress * 0.75;
    for (let i = 0; i < 18; i++) {
      const lane = (i + progress * 8) / 18;
      const jitter = (rand01(seed, i) - 0.5) * 28 * (1 - progress * 0.4);
      const px = sx + dx * lane + Math.cos(angle) * jitter;
      const py = sy + dy * lane + Math.sin(angle) * jitter;
      pushParticle(this.renderer, px, py, 5 + rand01(seed, i + 20) * 6, i % 3 === 0 ? core : color, alpha, 12);
    }
    pushStreak(this.renderer, (sx + tx) / 2, (sy + ty) / 2, Math.hypot(dx, dy), 3, color, alpha * 0.45, angle, 11);
  }

  private renderOrbitShield(
    x: number,
    y: number,
    radius: number,
    progress: number,
    seed: number,
    color: string,
    highlight: string,
  ): void {
    const alpha = 1 - progress * 0.7;
    for (let i = 0; i < 26; i++) {
      const a = i * 0.74 + progress * Math.PI * 4 + seed;
      const r = radius * (0.55 + 0.18 * Math.sin(progress * Math.PI * 3 + i));
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.72, 5 + (i % 4), i % 5 === 0 ? highlight : color, alpha, 10);
    }
  }

  private renderChargeTrail(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    progress: number,
    seed: number,
    color: string,
  ): void {
    const dx = tx - sx;
    const dy = ty - sy;
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    for (let i = 0; i < 22; i++) {
      const t = i / 22;
      const spread = (rand01(seed, i) - 0.5) * 36;
      const px = sx + dx * t - dx * progress * 0.12 + Math.cos(angle) * spread;
      const py = sy + dy * t - dy * progress * 0.12 + Math.sin(angle) * spread;
      pushStreak(this.renderer, px, py, 22 * (1 - t * 0.5), 4, color, (1 - progress) * (0.25 + t * 0.55), angle, 9);
    }
  }

  private renderFallingRunes(
    x: number,
    y: number,
    radius: number,
    progress: number,
    seed: number,
    color: string,
  ): void {
    for (let i = 0; i < 18; i++) {
      const ox = (rand01(seed, i) - 0.5) * radius * 1.3;
      const startY = y - radius * 0.8 - rand01(seed, i + 50) * 40;
      const py = startY + progress * radius * 1.5;
      pushParticle(this.renderer, x + ox, py, 4 + (i % 3) * 2, color, 1 - progress * 0.55, 11);
      pushStreak(this.renderer, x + ox, py - 8, 18, 2, color, (1 - progress) * 0.55, 0, 10);
    }
  }

  private renderPoolBubbles(
    x: number,
    y: number,
    radius: number,
    progress: number,
    seed: number,
    color: string,
  ): void {
    const alpha = 1 - progress * 0.45;
    for (let i = 0; i < 32; i++) {
      const a = rand01(seed, i) * Math.PI * 2;
      const r = Math.sqrt(rand01(seed, i + 30)) * radius * 0.75;
      const rise = ((progress * 1.7 + rand01(seed, i + 60)) % 1) * 28;
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55 - rise, 6 + rand01(seed, i + 90) * 10, color, alpha * (1 - rise / 32), 7);
    }
  }

  private renderSummonMotes(
    x: number,
    y: number,
    radius: number,
    progress: number,
    seed: number,
    color: string,
  ): void {
    for (let i = 0; i < 34; i++) {
      const a = i * 0.61 + seed;
      const r = radius * (1 - progress) * (0.35 + rand01(seed, i) * 0.7);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r, 5 + (i % 5), color, 0.9 - progress * 0.35, 9);
    }
  }

  private renderRadialBurst(
    x: number,
    y: number,
    radius: number,
    progress: number,
    seed: number,
    color: string,
    dust: string,
  ): void {
    for (let i = 0; i < 42; i++) {
      const a = i * 0.42 + rand01(seed, i) * 0.2;
      const r = radius * Math.pow(progress, 0.62) * (0.35 + rand01(seed, i + 20) * 0.75);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * 0.62;
      pushParticle(this.renderer, px, py, 7 + rand01(seed, i + 40) * 10, i % 4 === 0 ? dust : color, (1 - progress) * 0.7, 8);
    }
  }

  private renderWarCry(x: number, y: number, radius: number, progress: number, seed: number): void {
    for (let i = 0; i < 36; i++) {
      const a = i * 0.55;
      const r = radius * (0.2 + progress * 0.85) * (0.65 + rand01(seed, i) * 0.35);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55, 8 + (i % 3) * 4, i % 2 ? '#ffca28' : '#fff8e1', 1 - progress * 0.65, 10);
    }
  }

  private renderPetrifyDust(x: number, y: number, radius: number, progress: number, seed: number): void {
    for (let i = 0; i < 40; i++) {
      const a = rand01(seed, i) * Math.PI * 2;
      const r = radius * rand01(seed, i + 11);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6 - progress * 16, 5 + rand01(seed, i + 22) * 9, i % 3 === 0 ? '#eeeeee' : '#9e9e9e', 1 - progress * 0.5, 10);
    }
  }

  private renderWarpMotes(x: number, y: number, radius: number, progress: number, seed: number): void {
    for (let i = 0; i < 44; i++) {
      const a = i * 0.53 + progress * Math.PI * 3;
      const r = radius * (0.25 + rand01(seed, i) * 0.85) * (1 - progress * 0.25);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a * 1.7) * r * 0.5, 4 + (i % 5), i % 4 === 0 ? '#ffffff' : '#ab47bc', 0.9 - progress * 0.45, 10);
    }
  }

  private renderMissileBlast(x: number, y: number, radius: number, progress: number, seed: number): void {
    this.renderRadialBurst(x, y, radius, progress, seed, '#ff5722', '#795548');
    for (let i = 0; i < 18; i++) {
      const a = rand01(seed, i) * Math.PI * 2;
      const r = radius * (0.1 + progress * rand01(seed, i + 3));
      pushStreak(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r, 28, 4, '#ffcc80', (1 - progress) * 0.55, a, 11);
    }
  }

  private renderDarkDevour(x: number, y: number, radius: number, progress: number, seed: number): void {
    for (let i = 0; i < 58; i++) {
      const a = i * 0.47 + seed;
      const r = radius * (1 - progress) * (0.35 + rand01(seed, i) * 0.7);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 7 + (i % 4), i % 5 === 0 ? '#ede7f6' : '#4a148c', 0.95 - progress * 0.4, 12);
    }
  }

  private renderWarningSparks(x: number, y: number, radius: number, progress: number, seed: number, color: string): void {
    for (let i = 0; i < 20; i++) {
      const a = i * 0.9 + progress * Math.PI * 5;
      const r = radius * (0.3 + rand01(seed, i) * 0.5);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r, 4 + (i % 3), i % 2 ? color : '#fff3e0', 1 - progress * 0.35, 10);
    }
  }

  private renderFrostAura(x: number, y: number, radius: number, progress: number, seed: number): void {
    for (let i = 0; i < 30; i++) {
      const a = i * 0.7 + progress * Math.PI * 2;
      const r = radius * (0.35 + rand01(seed, i) * 0.6);
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.65, 4 + (i % 4), i % 3 === 0 ? '#ffffff' : '#81d4fa', 0.65, 8);
    }
  }

  private renderHealAura(x: number, y: number, radius: number, progress: number, seed: number): void {
    for (let i = 0; i < 28; i++) {
      const a = rand01(seed, i) * Math.PI * 2;
      const r = radius * rand01(seed, i + 13);
      const rise = ((progress * 2 + rand01(seed, i + 26)) % 1) * 34;
      pushParticle(this.renderer, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.55 - rise, 5 + (i % 4), i % 2 ? '#66bb6a' : '#e8f5e9', 0.75 * (1 - rise / 40), 9);
    }
  }
}
