import type { LevelConfig } from '../../types/index.js';
import { LEVEL_01 } from './level-01.js';
import { LEVEL_02 } from './level-02.js';
import { LEVEL_03 } from './level-03.js';
import { LEVEL_04 } from './level-04.js';
import { LEVEL_05 } from './level-05.js';
import { loadLevelsFromYaml } from './yamlBridge.js';

/**
 * 关卡配置列表 (v4.0)
 *
 * 优先使用 TS 文件数据（LevelConfig 格式，typecheck 验证）。
 * 若 TS 文件为空桩（tiles 为空），回退到 YAML 加载。
 */
function loadLevels(): LevelConfig[] {
  const tsLevels = [LEVEL_01, LEVEL_02, LEVEL_03, LEVEL_04, LEVEL_05];

  // 检查 TS 文件是否包含有效数据（至少有一关 tiles 非空）
  const hasTsData = tsLevels.some((l) => l.map.tiles.length > 0);
  if (hasTsData) {
    return tsLevels;
  }

  try {
    const yamlLevels = loadLevelsFromYaml();
    if (yamlLevels.length > 0) return yamlLevels;
  } catch (err) {
    console.warn('[levels] YAML fallback failed:', err);
  }

  return tsLevels;
}

export const LEVELS: LevelConfig[] = loadLevels();
