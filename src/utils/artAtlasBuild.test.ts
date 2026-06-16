import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface AtlasManifest {
  id: string;
  image: string;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
}

interface AtlasIndex {
  atlases: AtlasManifest[];
}

const atlasIndexPath = join(process.cwd(), 'public/art/atlases/index.json');

function readAtlasIndex(): AtlasIndex {
  return JSON.parse(readFileSync(atlasIndexPath, 'utf8')) as AtlasIndex;
}

function frameKeys(index: AtlasIndex): string[] {
  return index.atlases.flatMap((atlas) => Object.keys(atlas.frames));
}

describe('art atlas build output', () => {
  it('packs enemy unit frames by level instead of mixed unit atlases', () => {
    const index = readAtlasIndex();
    const atlasIds = index.atlases.map((atlas) => atlas.id);

    expect(atlasIds.some((id) => /^units_\d+$/.test(id))).toBe(false);
    expect(atlasIds).toContain('level_01_enemies');
    expect(atlasIds).toContain('level_02_enemies');
    expect(atlasIds.some((id) => id.startsWith('level_03_enemies'))).toBe(true);
    expect(atlasIds.some((id) => id.startsWith('level_04_enemies'))).toBe(true);
    expect(atlasIds.some((id) => id.startsWith('level_05_enemies'))).toBe(true);
    expect(atlasIds.some((id) => id.startsWith('player_units_'))).toBe(true);
  });

  it('uses dark_priest asset keys for the enemy priest and removes the stale priest enemy key', () => {
    const frames = frameKeys(readAtlasIndex());

    expect(frames).toContain('/art/units/unit_enemy_dark_priest_idle_0.png');
    expect(frames).not.toContain('/art/units/unit_enemy_priest_idle_0.png');
    expect(existsSync(join(process.cwd(), 'public/art/enemies/enemy_dark_priest.png'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'public/art/enemies/enemy_priest.png'))).toBe(false);
  });

  it('packs dynamically summoned enemy unit frames referenced by boss skills', () => {
    const frames = frameKeys(readAtlasIndex());

    expect(frames).toContain('/art/units/unit_enemy_skeleton_idle_0.png');
    expect(frames).toContain('/art/units/unit_enemy_skeleton_attack_1.png');
    expect(existsSync(join(process.cwd(), 'public/art/enemies/enemy_skeleton.png'))).toBe(true);
  });
});
