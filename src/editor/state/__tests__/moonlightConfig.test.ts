import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYamlToModel } from '../levelModel.js';
import { modelToLevelConfig } from '../modelToLevelConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      beamAlpha: 0.28,
    });
  });
});
