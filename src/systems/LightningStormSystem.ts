import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { LightningStorm } from '../core/components.js';
import type { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';

const stormQuery = defineQuery([LightningStorm]);

export class LightningStormSystem implements System {
  readonly name = 'LightningStormSystem';

  constructor(private renderer: Renderer) {}

  update(world: TowerWorld, dt: number): void {
    for (const eid of stormQuery(world.world)) {
      LightningStorm.elapsed[eid]! += dt;
      if (LightningStorm.elapsed[eid]! >= LightningStorm.duration[eid]!) {
        world.destroyEntity(eid);
      }
    }
  }

  render(world: TowerWorld): void {
    const ctx = this.renderer.context;
    if (!ctx) return;

    for (const eid of stormQuery(world.world)) {
      const duration = LightningStorm.duration[eid] ?? 1;
      const elapsed = LightningStorm.elapsed[eid] ?? 0;
      if (elapsed >= duration) continue;
      this.drawStorm(ctx, eid, elapsed / duration);
    }
  }

  private drawStorm(ctx: CanvasRenderingContext2D, eid: number, progress: number): void {
    const x = LightningStorm.targetX[eid] ?? 0;
    const y = LightningStorm.targetY[eid] ?? 0;
    const flashAlpha = progress < 0.18 ? (1 - progress / 0.18) * 0.72 : 0;
    const darkAlpha = Math.sin(Math.PI * Math.min(1, progress)) * 0.42;
    const boltAlpha = progress < 0.72 ? Math.max(0, 1 - progress / 0.72) : 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(2, 6, 23, ${darkAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, LayoutManager.viewportW, LayoutManager.viewportH);
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = boltAlpha;

    const topY = Math.max(-80, y - 420);
    const points = [
      { x: x - 30, y: topY },
      { x: x + 18, y: y - 260 },
      { x: x - 20, y: y - 150 },
      { x: x + 10, y: y - 58 },
      { x, y },
    ];

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff176';
    ctx.lineWidth = 18;
    this.strokePath(ctx, points);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    this.strokePath(ctx, points);

    const ringRadius = 22 + progress * 120;
    ctx.globalAlpha = boltAlpha * 0.85;
    ctx.strokeStyle = '#fffde7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = boltAlpha * 0.65;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10 + progress * 3;
      const r = 18 + i * 5 + progress * 60;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * r, y + Math.sin(angle) * r, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private strokePath(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
  }
}
