import { defineQuery, hasComponent } from 'bitecs';
import { Container, Graphics, Text } from 'pixi.js';

import {
  BossPhase,
  BossTag,
  Crystal,
  DeadTag,
  Health,
  Position,
  Projectile,
} from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

interface PositionSample {
  readonly x: number;
  readonly y: number;
}

interface ImpactSample extends PositionSample {
  ttl: number;
}

interface HurtSample extends PositionSample {
  ttl: number;
  readonly amount: number;
}

interface DeathSample extends PositionSample {
  ttl: number;
}

interface SpellImpactSample extends PositionSample {
  ttl: number;
  readonly radius: number;
}

interface BossBarSample {
  readonly current: number;
  readonly max: number;
  readonly phase: number;
}

const IMPACT_TTL = 0.12;
const HURT_TTL = 0.35;
const DEATH_TTL = 0.28;
const SPELL_IMPACT_TTL = 0.22;
const CRYSTAL_FLASH_TTL = 0.2;
const DEFAULT_BOSS_BAR_WIDTH = 180;
const DEFAULT_BOSS_BAR_HEIGHT = 10;
const DEFAULT_SPELL_IMPACT_RADIUS = 48;

export class CombatFeedbackRenderer implements System {
  readonly name = 'CombatFeedbackRenderer';
  readonly phase = 'render' as const;

  readonly layer: Container;

  private readonly projectilePositions = new Map<number, PositionSample>();
  private readonly healthValues = new Map<number, number>();
  private readonly deadSeen = new Set<number>();
  private readonly impacts: ImpactSample[] = [];
  private readonly hurts: HurtSample[] = [];
  private readonly deaths: DeathSample[] = [];
  private readonly spellImpacts: SpellImpactSample[] = [];

  private crystalFlashLeft = 0;
  private crystalHealth = new Map<number, number>();
  private bossBar?: Graphics;
  private bossBarLabel?: Text;

  constructor(parent: Container) {
    this.layer = new Container();
    this.layer.sortableChildren = false;
    parent.addChild(this.layer);
  }

  recordSpellImpact(x: number, y: number, radius = DEFAULT_SPELL_IMPACT_RADIUS): void {
    this.spellImpacts.push({ x, y, radius, ttl: SPELL_IMPACT_TTL });
  }

  update(world: TowerWorld, dt: number): void {
    this.captureProjectileHits(world);
    this.captureHealthChanges(world);
    this.captureDeaths(world);
    this.captureCrystalHits(world);
    const bossBar = this.captureBossBar(world);
    this.draw(dt, bossBar);
  }

  private captureProjectileHits(world: TowerWorld): void {
    const projectiles = projectileQuery(world);
    const aliveNow = new Set<number>();

    for (let i = 0; i < projectiles.length; i++) {
      const eid = projectiles[i]!;
      aliveNow.add(eid);
      this.projectilePositions.set(eid, {
        x: Position.x[eid] ?? 0,
        y: Position.y[eid] ?? 0,
      });
    }

    for (const [eid, pos] of this.projectilePositions) {
      if (aliveNow.has(eid)) continue;
      this.impacts.push({ x: pos.x, y: pos.y, ttl: IMPACT_TTL });
      this.projectilePositions.delete(eid);
    }
  }

  private captureHealthChanges(world: TowerWorld): void {
    const mortals = healthQuery(world);
    const aliveNow = new Set<number>();

    for (let i = 0; i < mortals.length; i++) {
      const eid = mortals[i]!;
      aliveNow.add(eid);
      const current = Health.current[eid] ?? 0;
      const previous = this.healthValues.get(eid);
      if (previous !== undefined && current < previous && hasComponent(world, Position, eid)) {
        const delta = previous - current;
        if (delta > 0) {
          this.hurts.push({
            x: Position.x[eid] ?? 0,
            y: Position.y[eid] ?? 0,
            ttl: HURT_TTL,
            amount: delta,
          });
        }
      }
      this.healthValues.set(eid, current);
    }

    for (const eid of this.healthValues.keys()) {
      if (aliveNow.has(eid)) continue;
      this.healthValues.delete(eid);
    }
  }

  private captureDeaths(world: TowerWorld): void {
    const corpses = deadQuery(world);
    const seenNow = new Set<number>();

    for (let i = 0; i < corpses.length; i++) {
      const eid = corpses[i]!;
      seenNow.add(eid);
      if (this.deadSeen.has(eid)) continue;
      this.deadSeen.add(eid);
      if (!hasComponent(world, Position, eid)) continue;
      this.deaths.push({
        x: Position.x[eid] ?? 0,
        y: Position.y[eid] ?? 0,
        ttl: DEATH_TTL,
      });
    }

    for (const eid of this.deadSeen) {
      if (seenNow.has(eid) || world.isDestroyed(eid)) continue;
      this.deadSeen.delete(eid);
    }
  }

  private captureCrystalHits(world: TowerWorld): void {
    const crystals = crystalQuery(world);
    const aliveNow = new Set<number>();

    for (let i = 0; i < crystals.length; i++) {
      const eid = crystals[i]!;
      aliveNow.add(eid);
      const current = Health.current[eid] ?? 0;
      const previous = this.crystalHealth.get(eid);
      if (previous !== undefined && current < previous) {
        this.crystalFlashLeft = CRYSTAL_FLASH_TTL;
      }
      this.crystalHealth.set(eid, current);
    }

    for (const eid of this.crystalHealth.keys()) {
      if (aliveNow.has(eid)) continue;
      this.crystalHealth.delete(eid);
    }
  }

  private captureBossBar(world: TowerWorld): BossBarSample | null {
    const bosses = bossQuery(world);
    for (let i = 0; i < bosses.length; i++) {
      const eid = bosses[i]!;
      if ((Health.current[eid] ?? 0) <= 0) continue;
      return {
        current: Health.current[eid] ?? 0,
        max: Health.max[eid] ?? 1,
        phase: hasComponent(world, BossPhase, eid) ? BossPhase.value[eid] ?? 0 : 0,
      };
    }
    return null;
  }

  private draw(dt: number, bossBar: BossBarSample | null): void {
    this.layer.removeChildren().forEach((child) => child.destroy());

    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const item = this.impacts[i]!;
      item.ttl -= dt;
      if (item.ttl <= 0) {
        this.impacts.splice(i, 1);
        continue;
      }
      const progress = item.ttl / IMPACT_TTL;
      const g = new Graphics();
      g.circle(item.x, item.y, 6 + (1 - progress) * 10);
      g.stroke({ width: 2, color: 0xfff176, alpha: progress });
      this.layer.addChild(g);
    }

    for (let i = this.spellImpacts.length - 1; i >= 0; i--) {
      const item = this.spellImpacts[i]!;
      item.ttl -= dt;
      if (item.ttl <= 0) {
        this.spellImpacts.splice(i, 1);
        continue;
      }
      const progress = item.ttl / SPELL_IMPACT_TTL;
      const g = new Graphics();
      g.circle(item.x, item.y, item.radius * (0.55 + (1 - progress) * 0.45));
      g.stroke({ width: 3, color: 0xff7043, alpha: progress * 0.95 });
      g.circle(item.x, item.y, item.radius * (0.2 + (1 - progress) * 0.25));
      g.stroke({ width: 2, color: 0xffcc80, alpha: progress * 0.8 });
      this.layer.addChild(g);
    }

    for (let i = this.hurts.length - 1; i >= 0; i--) {
      const item = this.hurts[i]!;
      item.ttl -= dt;
      if (item.ttl <= 0) {
        this.hurts.splice(i, 1);
        continue;
      }
      const progress = item.ttl / HURT_TTL;
      const text = new Text({
        text: `-${item.amount}`,
        style: { fill: 0xff6b6b, fontSize: 12, fontWeight: '700' },
      });
      text.anchor.set(0.5, 1);
      text.position.set(item.x, item.y - 10 - (1 - progress) * 18);
      text.alpha = progress;
      this.layer.addChild(text);
    }

    for (let i = this.deaths.length - 1; i >= 0; i--) {
      const item = this.deaths[i]!;
      item.ttl -= dt;
      if (item.ttl <= 0) {
        this.deaths.splice(i, 1);
        continue;
      }
      const progress = item.ttl / DEATH_TTL;
      const g = new Graphics();
      g.moveTo(item.x - 8, item.y - 8).lineTo(item.x + 8, item.y + 8);
      g.moveTo(item.x + 8, item.y - 8).lineTo(item.x - 8, item.y + 8);
      g.stroke({ width: 3, color: 0xffffff, alpha: progress });
      this.layer.addChild(g);
    }

    if (this.crystalFlashLeft > 0) {
      this.crystalFlashLeft -= dt;
      const alpha = Math.max(0, this.crystalFlashLeft / CRYSTAL_FLASH_TTL) * 0.6;
      const flash = new Graphics();
      flash.rect(-2000, -2000, 4000, 4000);
      flash.fill({ color: 0x80deea, alpha });
      this.layer.addChild(flash);
    }

    if (bossBar) {
      const width = DEFAULT_BOSS_BAR_WIDTH;
      const height = DEFAULT_BOSS_BAR_HEIGHT;
      const bg = new Graphics();
      bg.roundRect(20, 20, width, height, 5);
      bg.fill({ color: 0x222222, alpha: 0.85 });
      const ratio = bossBar.max > 0 ? Math.max(0, Math.min(1, bossBar.current / bossBar.max)) : 0;
      const fill = new Graphics();
      fill.roundRect(20, 20, width * ratio, height, 5);
      fill.fill({ color: bossBar.phase >= 3 ? 0xff1744 : bossBar.phase === 2 ? 0x42a5f5 : 0xffb74d, alpha: 1 });
      const label = new Text({
        text: `Boss P${Math.max(1, bossBar.phase)} ${bossBar.current}/${bossBar.max}`,
        style: { fill: 0xffffff, fontSize: 12, fontWeight: '700' },
      });
      label.position.set(20, 2);
      this.layer.addChild(bg, fill, label);
      this.bossBar = fill;
      this.bossBarLabel = label;
    } else {
      this.bossBar = undefined;
      this.bossBarLabel = undefined;
    }
  }
}

const projectileQuery = defineQuery([Projectile, Position]);
const healthQuery = defineQuery([Health]);
const deadQuery = defineQuery([DeadTag]);
const crystalQuery = defineQuery([Crystal, Health]);
const bossQuery = defineQuery([BossTag, Health]);
