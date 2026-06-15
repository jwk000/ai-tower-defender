import type { LevelFormModel, MapModel } from './levelModel.js';
import {
  ObstacleType, LevelTheme, TowerType, UnitType, WeatherType, EnemyType,
  type LevelConfig, type MapConfig, type WaveConfig, type WaveEnemyGroup,
  type ObstaclePlacement,
} from '../../types/index.js';
import { resolveMapArtTheme } from '../../utils/pathTileTexture.js';

const ALL_TOWER_TYPES = Object.values(TowerType);

const THEME_MAP: Record<string, LevelTheme> = {
  plains: LevelTheme.Plains,
  desert: LevelTheme.Desert,
  tundra: LevelTheme.Tundra,
  volcano: LevelTheme.Volcano,
  castle: LevelTheme.Castle,
  wasteland: LevelTheme.Wasteland,
  abyss: LevelTheme.Abyss,
};

const WEATHER_MAP: Record<string, WeatherType> = {
  sunny: WeatherType.Sunny,
  rain: WeatherType.Rain,
  fog: WeatherType.Fog,
  snow: WeatherType.Snow,
  night: WeatherType.Night,
  redmist: WeatherType.RedMist,
  red_mist: WeatherType.RedMist,
  sandstorm: WeatherType.Sandstorm,
  blizzard: WeatherType.Blizzard,
  storm: WeatherType.Storm,
  smog: WeatherType.Smog,
  spore_mist: WeatherType.SporeMist,
  void: WeatherType.Void,
};

const VALID_OBSTACLE_TYPES = new Set<string>(Object.values(ObstacleType));

function adaptMap(m: MapModel, theme: LevelTheme): MapConfig {
  const obstaclePlacements: ObstaclePlacement[] | undefined = m.obstacles
    ?.filter((o): o is { type: string; row: number; col: number } =>
      typeof o.type === 'string' && VALID_OBSTACLE_TYPES.has(o.type) &&
      typeof o.row === 'number' && typeof o.col === 'number'
    )
    .map((o) => ({ type: o.type as ObstacleType, row: o.row, col: o.col }));

  return {
    name: m.__extras?.['name'] as string | undefined ?? '',
    cols: m.cols,
    rows: m.rows,
    tileSize: m.tileSize,
    tiles: m.tiles as MapConfig['tiles'],
    artTheme: resolveMapArtTheme(theme),
    spawns: m.spawns,
    pathGraph: m.pathGraph,
    tileColors: m.tileColors as MapConfig['tileColors'] | undefined,
    lighting: m.lighting as MapConfig['lighting'] | undefined,
    obstaclePlacements: obstaclePlacements?.length ? obstaclePlacements : undefined,
  };
}

function adaptWave(w: LevelFormModel['waves'][number]): WaveConfig {
  const enemies: WaveEnemyGroup[] = w.enemies.map((e) => ({
    enemyType: e.enemyType as EnemyType,
    count: e.count,
    spawnInterval: e.spawnInterval,
    spawnId: e.spawnId,
  }));
  const wave: WaveConfig = { waveNumber: w.waveNumber, spawnDelay: w.spawnDelay, enemies };
  if (w.isBossWave) wave.isBossWave = true;
  if (typeof w.__extras?.reward === 'number') wave.reward = w.__extras.reward;
  if (typeof w.__extras?.spawnPointIndex === 'number') wave.spawnPointIndex = w.__extras.spawnPointIndex;
  return wave;
}

export function modelToLevelConfig(model: LevelFormModel): LevelConfig {
  const theme: LevelTheme = (model.theme ? THEME_MAP[model.theme] : undefined) ?? LevelTheme.Plains;

  const availableTowers: TowerType[] = model.available?.towers?.length
    ? (model.available.towers as TowerType[])
    : ALL_TOWER_TYPES;

  const availableUnits: UnitType[] = (model.available?.units ?? []) as UnitType[];

  const weatherPool = model.weather?.pool
    ?.map((w) => WEATHER_MAP[w.toLowerCase()])
    .filter((w): w is WeatherType => w !== undefined);

  const weatherInitial = model.weather?.initial
    ? WEATHER_MAP[model.weather.initial.toLowerCase()]
    : undefined;

  const config: LevelConfig = {
    id: model.id,
    name: model.name,
    theme,
    description: model.description ?? '',
    map: adaptMap(model.map, theme),
    waves: model.waves.map(adaptWave),
    startingGold: model.starting?.gold ?? 200,
    availableTowers,
    availableUnits,
    unlockStarsRequired: 0,
    unlockPrevLevelId: null,
  };

  if (model.sceneDescription) config.sceneDescription = model.sceneDescription;
  if (weatherPool?.length) config.weatherPool = weatherPool;
  if (weatherInitial) config.weatherFixed = weatherInitial;
  if (model.weather?.changeInterval !== undefined) config.weatherChangeInterval = model.weather.changeInterval;

  // v6.0: 过关界面配置（来自 __extras）
  if (model.__extras?.victory) {
    const victoryRaw = model.__extras.victory as Record<string, unknown>;
    const defeatRaw = model.__extras?.defeat as Record<string, unknown> | undefined;
    if (defeatRaw?.story) {
      victoryRaw.defeatStory = defeatRaw.story;
    }
    config.victory = victoryRaw as unknown as LevelConfig['victory'];
  }

  return config;
}
