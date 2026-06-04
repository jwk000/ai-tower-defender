import type { LevelConfig } from '../../types/index.js';
import { loadLevelsFromYaml } from './yamlBridge.js';

/**
 * 关卡配置列表 (v4.0)
 *
 * 统一使用 YAML 配置文件（src/config/levels/*.yaml）。
 * 关卡编辑器和主游戏共享同一份配置源。
 */
function loadLevels(): LevelConfig[] {
  return loadLevelsFromYaml();
}

export const LEVELS: LevelConfig[] = loadLevels();
