import { describe, expect, it } from 'vitest';
import { TowerWorld, defineQuery } from '../core/World.js';
import { BossSkillAnnouncement } from '../core/components.js';
import { BossSkillAnnouncementSystem } from './BossSkillAnnouncementSystem.js';

const announcementQuery = defineQuery([BossSkillAnnouncement]);

describe('BossSkillAnnouncementSystem', () => {
  it('Boss技能提示持续10秒后销毁', () => {
    const world = new TowerWorld();
    const system = new BossSkillAnnouncementSystem();

    system.show(world, '虫群孵化', '每10秒在女王周围召唤5只随机虫族单位；塔仍无法锁定女王', 10);
    expect(announcementQuery(world.world).length).toBe(1);

    system.update(world, 9.9);
    expect(announcementQuery(world.world).length).toBe(1);

    system.update(world, 0.2);
    world.cleanupDeadEntities();
    expect(announcementQuery(world.world).length).toBe(0);
  });
});
