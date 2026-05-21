import { addComponent, hasComponent, removeComponent } from 'bitecs';
import { Container, Graphics } from 'pixi.js';

import type { TowerWorld } from '../core/World.js';
import { SelectedTag, VisualShape } from '../core/components.js';
import type { EntityViewSink, VisualSnapshot } from './RenderSystem.js';

const STATUS_RING_WIDTH = 2;
const STATUS_RING_GAP = 3;
const RANGE_RING_COLOR = 0x80cbc4;
const SELECTION_RING_COLOR = 0xfff176;
const STATUS_RING_COLORS = {
  slow: 0x42a5f5,
  burn: 0xff7043,
  poison: 0x66bb6a,
  shield: 0x80deea,
  vulnerable: 0xab47bc,
} as const;

export class EntityRenderer implements EntityViewSink {
  readonly container: Container;
  private readonly views = new Map<number, Graphics>();
  private readonly eidByGraphic = new Map<Graphics, number>();
  private readonly world: TowerWorld;

  constructor(parent: Container, world: TowerWorld) {
    this.world = world;
    this.container = new Container();
    this.container.sortableChildren = false;
    this.container.eventMode = 'static';
    this.container.hitArea = { contains: () => true };
    this.container.on('pointerdown', (event) => {
      let node = event.target as Graphics | Container | null;
      while (node && !(node instanceof Graphics)) {
        node = node.parent as Container | null;
      }
      const graphic = node instanceof Graphics ? node : null;
      const eid = graphic ? this.eidByGraphic.get(graphic) ?? null : null;
      for (const [targetEid] of this.views) {
        if (hasComponent(this.world, SelectedTag, targetEid)) {
          removeComponent(this.world, SelectedTag, targetEid);
        }
      }
      if (eid !== null) addComponent(this.world, SelectedTag, eid);
    });
    parent.addChild(this.container);
  }

  hasView(eid: number): boolean {
    return this.views.has(eid);
  }

  createView(eid: number, visual: VisualSnapshot): void {
    const g = new Graphics();
    g.eventMode = 'static';
    g.cursor = 'pointer';
    drawShape(g, visual);
    this.views.set(eid, g);
    this.eidByGraphic.set(g, eid);
    this.container.addChild(g);
  }

  updateView(eid: number, x: number, y: number): void {
    const g = this.views.get(eid);
    if (!g) return;
    g.x = x;
    g.y = y;
  }

  updateVisual(eid: number, visual: VisualSnapshot): void {
    const g = this.views.get(eid);
    if (!g) return;
    drawShape(g, visual);
  }

  destroyView(eid: number): void {
    const g = this.views.get(eid);
    if (!g) return;
    this.container.removeChild(g);
    this.eidByGraphic.delete(g);
    g.destroy();
    this.views.delete(eid);
  }

  sortByY(): void {
    const children = this.container.children as Graphics[];
    children.sort((a, b) => a.y - b.y);
    for (let i = 0; i < children.length; i++) {
      this.container.setChildIndex(children[i]!, i);
    }
  }
}

function drawShape(g: Graphics, visual: VisualSnapshot): void {
  g.clear();
  const half = visual.size / 2;
  if (visual.isSelected && visual.attackRange > 0) {
    g.circle(0, 0, visual.attackRange);
    g.stroke({ width: 2, color: RANGE_RING_COLOR, alpha: 0.24 });
  }
  if (visual.isSelected) {
    g.circle(0, 0, half + 10);
    g.stroke({ width: 3, color: SELECTION_RING_COLOR, alpha: 0.95 });
  }
  drawStatusRings(g, half, visual.status);
  if (visual.isBoss) {
    const outerColor = visual.bossPhase === 3 ? 0xff1744 : 0xffd54f;
    const innerColor = visual.bossPhase === 2 ? 0x42a5f5 : visual.bossPhase === 3 ? 0xff8a65 : 0xff7043;
    g.circle(0, 0, half + 8);
    g.stroke({ width: 5, color: outerColor, alpha: 0.98 });
    g.circle(0, 0, half + 2);
    g.stroke({ width: 3, color: innerColor, alpha: 0.95 });
  } else if (visual.isElite) {
    g.circle(0, 0, half + 4);
    g.stroke({ width: 3, color: 0xffd54f, alpha: 0.95 });
  }
  switch (visual.shape) {
    case VisualShape.Square:
      g.rect(-half, -half, visual.size, visual.size);
      break;
    case VisualShape.Triangle:
      g.moveTo(0, -half).lineTo(half, half).lineTo(-half, half).closePath();
      break;
    case VisualShape.Circle:
    default:
      g.circle(0, 0, half);
      break;
  }
  g.fill({ color: visual.color, alpha: 1 });
}

function drawStatusRings(g: Graphics, half: number, status: VisualSnapshot['status']): void {
  const ringColors: number[] = [];
  if (status.isSlowed) ringColors.push(STATUS_RING_COLORS.slow);
  if (status.isBurning) ringColors.push(STATUS_RING_COLORS.burn);
  if (status.isPoisoned) ringColors.push(STATUS_RING_COLORS.poison);
  if (status.hasShield) ringColors.push(STATUS_RING_COLORS.shield);
  if (status.isVulnerable) ringColors.push(STATUS_RING_COLORS.vulnerable);

  for (let i = 0; i < ringColors.length; i++) {
    g.circle(0, 0, half + 6 + i * STATUS_RING_GAP);
    g.stroke({ width: STATUS_RING_WIDTH, color: ringColors[i]!, alpha: 0.95 });
  }
}
