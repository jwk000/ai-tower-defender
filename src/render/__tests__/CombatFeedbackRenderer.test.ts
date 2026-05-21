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
import { Renderer } from '../Renderer.js';

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

  it('renders spell impact ring when a spell landing is recorded', () => {
    system.recordSpellImpact(120, 140, 64);
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

describe('Renderer weather animation', () => {
  it('animates weather overlay over time after drawing level background', () => {
    const renderer = new Renderer({
      canvas: {} as HTMLCanvasElement,
      worldWidth: 21 * 64,
      worldHeight: 9 * 64,
      cellSize: 64,
    });

    renderer.drawLevelBackground({
      mapCols: 2,
      mapRows: 2,
      tileSize: 64,
      tiles: [
        ['spawn', 'path'],
        ['empty', 'base'],
      ],
      tileColors: {
        empty: 0x304b3d,
        path: 0x9c7b63,
        spawn: 0xff8f00,
        base: 0x1e88e5,
      },
      weather: { pool: ['rain'], initial: 'rain' },
      obstacles: [{ type: 'ice_tile', row: 1, col: 0 }],
    });

    const before = (renderer as unknown as { weatherState: { time: number } | null }).weatherState?.time ?? -1;
    renderer.tickWeather(0.5);
    const after = (renderer as unknown as { weatherState: { time: number } | null }).weatherState?.time ?? -1;

    expect(after).toBeGreaterThan(before);
  });

  it('creates front/back drift layers for animated weather', () => {
    const renderer = new Renderer({
      canvas: {} as HTMLCanvasElement,
      worldWidth: 21 * 64,
      worldHeight: 9 * 64,
      cellSize: 64,
    });

    renderer.drawLevelBackground({
      mapCols: 2,
      mapRows: 2,
      tileSize: 64,
      tiles: [
        ['spawn', 'path'],
        ['empty', 'base'],
      ],
      tileColors: {
        empty: 0x304b3d,
        path: 0x9c7b63,
        spawn: 0xff8f00,
        base: 0x1e88e5,
      },
      weather: { pool: ['blizzard'], initial: 'blizzard' },
    });

    const layers = (renderer as unknown as { weatherState: { layers: readonly { kind: string; speed: number }[] } | null }).weatherState?.layers ?? [];

    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ kind: 'back' });
    expect(layers[1]).toMatchObject({ kind: 'front' });
    expect(layers[1]?.speed).toBeGreaterThan(layers[0]?.speed ?? 0);
  });

  it('creates animated overlay state for special terrain obstacles', () => {
    const renderer = new Renderer({
      canvas: {} as HTMLCanvasElement,
      worldWidth: 2 * 64,
      worldHeight: 2 * 64,
      cellSize: 64,
    });

    renderer.drawLevelBackground({
      mapCols: 2,
      mapRows: 2,
      tileSize: 64,
      tiles: [
        ['path', 'empty'],
        ['empty', 'base'],
      ],
      tileColors: {
        empty: 0x304b3d,
        path: 0x9c7b63,
        base: 0x1e88e5,
      },
      obstacles: [
        { type: 'conveyor_belt', row: 0, col: 0 },
        { type: 'spore_pod', row: 1, col: 0 },
        { type: 'water_pool', row: 0, col: 1 },
        { type: 'ice_tile', row: 1, col: 1 },
      ],
    });

    const state = renderer as unknown as {
      terrainEffectState: {
        time: number;
        cells: readonly { type: string; row: number; col: number }[];
      } | null;
    };

    expect(state.terrainEffectState?.cells).toHaveLength(4);
    expect(state.terrainEffectState?.cells.map((cell) => cell.type)).toEqual([
      'conveyor_belt',
      'water_pool',
      'spore_pod',
      'ice_tile',
    ]);
  });

  it('advances special terrain overlay time during ticks', () => {
    const renderer = new Renderer({
      canvas: {} as HTMLCanvasElement,
      worldWidth: 2 * 64,
      worldHeight: 2 * 64,
      cellSize: 64,
    });

    renderer.drawLevelBackground({
      mapCols: 2,
      mapRows: 2,
      tileSize: 64,
      tiles: [
        ['path', 'empty'],
        ['empty', 'base'],
      ],
      tileColors: {
        empty: 0x304b3d,
        path: 0x9c7b63,
        base: 0x1e88e5,
      },
      obstacles: [{ type: 'water_pool', row: 0, col: 1 }],
    });

    const state = renderer as unknown as {
      terrainEffectState: { time: number } | null;
    };
    const before = state.terrainEffectState?.time ?? -1;
    renderer.tickWeather(0.25);
    const after = state.terrainEffectState?.time ?? -1;

    expect(after).toBeGreaterThan(before);
  });

  it('adds portal-like directional feedback for conveyor cells and stronger ambient motion for terrain', () => {
    const renderer = new Renderer({
      canvas: {} as HTMLCanvasElement,
      worldWidth: 2 * 64,
      worldHeight: 2 * 64,
      cellSize: 64,
    });

    renderer.drawLevelBackground({
      mapCols: 2,
      mapRows: 2,
      tileSize: 64,
      tiles: [
        ['path', 'empty'],
        ['empty', 'base'],
      ],
      tileColors: {
        empty: 0x304b3d,
        path: 0x9c7b63,
        base: 0x1e88e5,
      },
      obstacles: [
        { type: 'conveyor_belt', row: 0, col: 0 },
        { type: 'spore_pod', row: 1, col: 0 },
        { type: 'water_pool', row: 0, col: 1 },
        { type: 'ice_tile', row: 1, col: 1 },
      ],
    });

    const state = renderer as unknown as {
      terrainEffectState: {
        cells: readonly { type: string; row: number; col: number }[];
      } | null;
    };

    expect(state.terrainEffectState?.cells).toContainEqual({ type: 'conveyor_belt', row: 0, col: 0, direction: 'right' });
    expect(state.terrainEffectState?.cells).toContainEqual({ type: 'spore_pod', row: 1, col: 0 });
    expect(state.terrainEffectState?.cells).toContainEqual({ type: 'water_pool', row: 0, col: 1 });
    expect(state.terrainEffectState?.cells).toContainEqual({ type: 'ice_tile', row: 1, col: 1 });
  });

  it('accepts obstacle overlays for special tiles', () => {
    const renderer = new Renderer({
      canvas: {} as HTMLCanvasElement,
      worldWidth: 2 * 64,
      worldHeight: 2 * 64,
      cellSize: 64,
    });

    expect(() => renderer.drawLevelBackground({
      mapCols: 2,
      mapRows: 2,
      tileSize: 64,
      tiles: [
        ['path', 'empty'],
        ['empty', 'base'],
      ],
      tileColors: {
        empty: 0x304b3d,
        path: 0x9c7b63,
        base: 0x1e88e5,
      },
      obstacles: [
        { type: 'conveyor_belt', row: 0, col: 0 },
        { type: 'spore_pod', row: 1, col: 0 },
        { type: 'water_pool', row: 0, col: 1 },
      ],
    })).not.toThrow();
  });
});
