import { TowerWorld, type System } from '../core/World.js';
import { DeathEffect } from '../core/components.js';
import { clearDeathSpriteArtId } from '../utils/deathSpriteRegistry.js';

export class DeathEffectSystem implements System {
  readonly name = 'DeathEffectSystem';

  update(world: TowerWorld, dt: number): void {
    for (let eid = 0; eid < DeathEffect.duration.length; eid++) {
      if (DeathEffect.duration[eid]! > 0) {
        if ((DeathEffect.renderedFrames[eid] ?? 0) === 0) {
          continue;
        }
        DeathEffect.elapsed[eid]! += dt;
        if (DeathEffect.elapsed[eid]! >= DeathEffect.duration[eid]!) {
          clearDeathSpriteArtId(eid);
          world.destroyEntity(eid);
        }
      }
    }
  }
}
