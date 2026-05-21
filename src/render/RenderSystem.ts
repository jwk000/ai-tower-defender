import { defineQuery, hasComponent } from 'bitecs';

import type { TowerWorld } from '../core/World.js';
import {
  Attack,
  BossPhase,
  BossTag,
  Burn,
  EliteTag,
  Movement,
  Poison,
  Position,
  SelectedTag,
  Shield,
  Visual,
  Vulnerable,
} from '../core/components.js';
import type { System, SystemPhase } from '../core/pipeline.js';

export interface StatusSnapshot {
  readonly isSlowed: boolean;
  readonly isBurning: boolean;
  readonly isPoisoned: boolean;
  readonly hasShield: boolean;
  readonly isVulnerable: boolean;
}

export interface VisualSnapshot {
  readonly shape: number;
  readonly color: number;
  readonly size: number;
  readonly isElite: boolean;
  readonly isBoss: boolean;
  readonly bossPhase: number;
  readonly isSelected: boolean;
  readonly attackRange: number;
  readonly status: StatusSnapshot;
}

export interface EntityViewSink {
  createView(eid: number, visual: VisualSnapshot): void;
  updateView(eid: number, x: number, y: number): void;
  destroyView(eid: number): void;
  updateVisual?(eid: number, visual: VisualSnapshot): void;
  sortByY(): void;
  hasView(eid: number): boolean;
}

const renderQuery = defineQuery([Position, Visual]);

export class RenderSystem implements System {
  readonly name = 'RenderSystem';
  readonly phase: SystemPhase = 'render';

  private readonly tracked = new Set<number>();

  constructor(private readonly sink: EntityViewSink) {}

  update(world: TowerWorld, _dt: number): void {
    const eids = renderQuery(world);
    const seen = new Set<number>();

    for (let i = 0; i < eids.length; i++) {
      const eid = eids[i]!;
      seen.add(eid);

      const visual = {
        shape: Visual.shape[eid]!,
        color: Visual.color[eid]!,
        size: Visual.size[eid]!,
        isElite: hasComponent(world, EliteTag, eid),
        isBoss: hasComponent(world, BossTag, eid),
        bossPhase: hasComponent(world, BossPhase, eid) ? BossPhase.value[eid]! : 0,
        isSelected: hasComponent(world, SelectedTag, eid),
        attackRange: hasComponent(world, Attack, eid) ? Attack.range[eid]! : 0,
        status: {
          isSlowed: (Movement.slowDuration[eid] ?? 0) > 0,
          isBurning: (Burn.duration[eid] ?? 0) > 0,
          isPoisoned: (Poison.duration[eid] ?? 0) > 0,
          hasShield: (Shield.duration[eid] ?? 0) > 0 && (Shield.current[eid] ?? 0) > 0,
          isVulnerable: (Vulnerable.duration[eid] ?? 0) > 0,
        },
      } satisfies VisualSnapshot;

      if (!this.sink.hasView(eid)) {
        this.sink.createView(eid, visual);
        this.tracked.add(eid);
      } else {
        this.sink.updateVisual?.(eid, visual);
      }

      this.sink.updateView(eid, Position.x[eid]!, Position.y[eid]!);
    }

    for (const eid of this.tracked) {
      if (!seen.has(eid)) {
        this.sink.destroyView(eid);
        this.tracked.delete(eid);
      }
    }

    this.sink.sortByY();
  }
}
