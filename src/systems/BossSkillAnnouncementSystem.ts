// ============================================================
// Tower Defender — BossSkillAnnouncementSystem
//
// Boss 技能提示：在棋盘上方显示技能名和描述，10 秒后消失。
// bitecs 组件只保存生命周期，字符串内容保存在系统内 Map。
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import {
  BossSkillAnnouncement,
  Position,
  bossSkillAnnouncementQuery,
} from '../core/components.js';
import { RenderSystem } from './RenderSystem.js';

const DEFAULT_DURATION = 10;
const TITLE_FONT_SIZE = 22;
const DESC_FONT_SIZE = 14;
const PANEL_W = 520;
const PANEL_H = 72;

type AnnouncementText = {
  title: string;
  description: string;
};

export class BossSkillAnnouncementSystem implements System {
  readonly name = 'BossSkillAnnouncementSystem';

  private texts = new Map<number, AnnouncementText>();

  update(world: TowerWorld, dt: number): void {
    const entities = bossSkillAnnouncementQuery(world.world);
    for (const eid of entities) {
      const lifetime = BossSkillAnnouncement.lifetime[eid]! + dt;
      const maxLifetime = BossSkillAnnouncement.maxLifetime[eid]!;

      if (lifetime >= maxLifetime) {
        this.texts.delete(eid);
        world.destroyEntity(eid);
        continue;
      }

      BossSkillAnnouncement.lifetime[eid] = lifetime;
      const progress = lifetime / maxLifetime;
      BossSkillAnnouncement.alpha[eid] = progress < 0.1
        ? progress / 0.1
        : progress > 0.85
          ? 1 - (progress - 0.85) / 0.15
          : 1;
    }
  }

  show(
    world: TowerWorld,
    title: string,
    description: string,
    duration: number = DEFAULT_DURATION,
  ): void {
    const eid = world.createEntity();
    const x = RenderSystem.sceneOffsetX + RenderSystem.sceneW / 2;
    const y = Math.max(54, RenderSystem.sceneOffsetY - 34);
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, BossSkillAnnouncement, {
      lifetime: 0,
      maxLifetime: duration,
      alpha: 0,
    });
    this.texts.set(eid, { title, description });
  }

  renderAll(world: TowerWorld, ctx: CanvasRenderingContext2D): void {
    const entities = bossSkillAnnouncementQuery(world.world);
    if (entities.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const eid of entities) {
      const text = this.texts.get(eid);
      if (!text) continue;

      const x = Position.x[eid];
      const y = Position.y[eid];
      if (x === undefined || y === undefined) continue;

      const alpha = BossSkillAnnouncement.alpha[eid] ?? 1;
      this.drawAnnouncement(ctx, x, y, text.title, text.description, alpha);
    }

    ctx.restore();
  }

  private drawAnnouncement(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    title: string,
    description: string,
    alpha: number,
  ): void {
    const panelX = x - PANEL_W / 2;
    const panelY = y - PANEL_H / 2;

    ctx.fillStyle = `rgba(24, 18, 14, ${alpha * 0.72})`;
    ctx.fillRect(panelX, panelY, PANEL_W, PANEL_H);
    ctx.strokeStyle = `rgba(255, 190, 70, ${alpha * 0.9})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, PANEL_W, PANEL_H);

    ctx.font = `bold ${TITLE_FONT_SIZE}px sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.85})`;
    ctx.strokeText(title, x, y - 13);
    ctx.fillStyle = `rgba(255, 214, 108, ${alpha})`;
    ctx.fillText(title, x, y - 13);

    ctx.font = `${DESC_FONT_SIZE}px sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(0, 0, 0, ${alpha * 0.75})`;
    ctx.strokeText(description, x, y + 17);
    ctx.fillStyle = `rgba(255, 246, 218, ${alpha})`;
    ctx.fillText(description, x, y + 17);
  }
}
