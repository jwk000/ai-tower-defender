import { describe, expect, it, beforeEach } from 'vitest';
import { addComponent } from 'bitecs';
import { Container } from 'pixi.js';

import { createTowerWorld, type TowerWorld } from '../../core/World.js';
import {
  BossPhase,
  BossTag,
  Crystal,
  DeadTag,
  Health,
  Position,
  Projectile,
} from '../../core/components.js';
import { CombatFeedbackRenderer } from '../CombatFeedbackRenderer.js';

function spawnHealthEntity(world: TowerWorld, x: number, y: number, hp: number): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  addComponent(world, Health, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  return eid;
}

describe('CombatFeedbackRenderer', () => {
  let world: TowerWorld;
  let parent: Container;
  let system: CombatFeedbackRenderer;

  beforeEach(() => {
    world = createTowerWorld();
    parent = new Container();
    system = new CombatFeedbackRenderer(parent);
  });

  it('renders floating damage text when health drops', () => {
    const eid = spawnHealthEntity(world, 100, 120, 20);
    system.update(world, 0.016);

    Health.current[eid] = 15;
    system.update(world, 0.016);

    expect(system.layer.children.some((child) => child.constructor.name === 'Text')).toBe(true);
  });

  it('renders projectile impact when projectile disappears', () => {
    const eid = world.addEntity();
    addComponent(world, Position, eid);
    addComponent(world, Projectile, eid);
    Position.x[eid] = 30;
    Position.y[eid] = 40;

    system.update(world, 0.016);
    world.destroyEntity(eid);
    world.flushDeferred();
    system.update(world, 0.016);

    expect(system.layer.children.some((child) => child.constructor.name === 'Graphics')).toBe(true);
  });

  it('renders death mark for entities carrying DeadTag', () => {
    const eid = spawnHealthEntity(world, 55, 66, 10);
    system.update(world, 0.016);
    addComponent(world, DeadTag, eid);

    system.update(world, 0.016);

    expect(system.layer.children.some((child) => child.constructor.name === 'Graphics')).toBe(true);
  });

  it('shows boss bar for alive boss entities', () => {
    const eid = spawnHealthEntity(world, 0, 0, 100);
    addComponent(world, BossTag, eid);
    addComponent(world, BossPhase, eid);
    BossPhase.value[eid] = 2;
    Health.current[eid] = 75;

    system.update(world, 0.016);

    expect(system.layer.children.some((child) => child.constructor.name === 'Text')).toBe(true);
  });

  it('flashes when crystal health drops', () => {
    const eid = spawnHealthEntity(world, 10, 10, 5);
    addComponent(world, Crystal, eid);
    Crystal.radius[eid] = 12;
    system.update(world, 0.016);

    Health.current[eid] = 4;
    system.update(world, 0.016);

    expect(system.layer.children.length).toBeGreaterThan(0);
  });
});
