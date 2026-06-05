import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYamlToModel } from '../levelModel.js';
import { modelToLevelConfig } from '../modelToLevelConfig.js';
import { TileType } from '../../../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

function luminance(hex: string): number {
  const r = channel(hex, 1);
  const g = channel(hex, 3);
  const b = channel(hex, 5);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function blueDominance(hex: string): number {
  const r = channel(hex, 1);
  const g = channel(hex, 3);
  const b = channel(hex, 5);
  return b - Math.max(r, g);
}

describe('level-05 月光配置', () => {
  it('从 YAML 加载到运行时 MapConfig', () => {
    const yaml = readFileSync(
      path.join(__dirname, '..', '..', '..', 'config', 'levels', 'level-05.yaml'),
      'utf-8',
    );

    const config = modelToLevelConfig(parseYamlToModel(yaml));

    expect(config.map.lighting?.moonlight).toEqual({
      enabled: true,
      ambientAlpha: 0.16,
      bloomAlpha: 0.22,
    });
  });

  it('棋盘格子颜色足够浅且不能过蓝', () => {
    const yaml = readFileSync(
      path.join(__dirname, '..', '..', '..', 'config', 'levels', 'level-05.yaml'),
      'utf-8',
    );

    const config = modelToLevelConfig(parseYamlToModel(yaml));
    const empty = config.map.tileColors?.[TileType.Empty];
    const pathColor = config.map.tileColors?.[TileType.Path];

    expect(empty).toBeDefined();
    expect(pathColor).toBeDefined();
    expect(luminance(empty!)).toBeGreaterThanOrEqual(70);
    expect(luminance(pathColor!)).toBeGreaterThanOrEqual(95);
    expect(blueDominance(empty!)).toBeLessThanOrEqual(35);
    expect(blueDominance(pathColor!)).toBeLessThanOrEqual(35);
  });
});
