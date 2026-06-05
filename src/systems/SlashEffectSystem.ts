import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { SlashEffect, Position } from '../core/components.js';
import { Renderer } from '../render/Renderer.js';

const slashQuery = defineQuery([SlashEffect, Position]);

/**
 * 渲染近战攻击的扇形刀光特效
 * 设计：几何图形拼接，扇形区域渐变透明度
 */
export class SlashEffectSystem implements System {
  readonly name = 'SlashEffectSystem';

  constructor(private renderer: Renderer) {}

  update(world: TowerWorld, dt: number): void {
    const entities = slashQuery(world.world);

    for (const eid of entities) {
      SlashEffect.elapsed[eid]! += dt;

      const duration = SlashEffect.duration[eid]!;
      const elapsed = SlashEffect.elapsed[eid]!;
      const progress = Math.min(elapsed / duration, 1);

      if (progress >= 1) {
        world.destroyEntity(eid);
        continue;
      }

      const x = Position.x[eid]!;
      const y = Position.y[eid]!;
      const radius = SlashEffect.radius[eid]!;
      const startAngle = SlashEffect.startAngle[eid]!;
      const endAngle = SlashEffect.endAngle[eid]!;
      const r = SlashEffect.colorR[eid]!;
      const g = SlashEffect.colorG[eid]!;
      const b = SlashEffect.colorB[eid]!;

      // 扇形刀光：多层弧线，从外到内渐变透明
      const alpha = (1 - progress) * 0.8;
      const currentRadius = radius * (0.5 + progress * 0.5);

      // 绘制3层扇形弧线
      for (let i = 0; i < 3; i++) {
        const layerProgress = i / 3;
        const layerRadius = currentRadius * (1 - layerProgress * 0.3);
        const layerAlpha = alpha * (1 - layerProgress * 0.4);

        // 使用多个小矩形模拟弧线
        const segments = 8;
        const angleStep = (endAngle - startAngle) / segments;

        for (let j = 0; j <= segments; j++) {
          const angle = startAngle + angleStep * j;
          const px = x + Math.cos(angle) * layerRadius;
          const py = y + Math.sin(angle) * layerRadius;

          this.renderer.push({
            shape: 'circle',
            x: px,
            y: py,
            size: 4 - i,
            color: `rgb(${r}, ${g}, ${b})`,
            alpha: layerAlpha,
          });
        }
      }
    }
  }
}
