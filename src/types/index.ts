// ============================================================
// Tower Defender — Core Type Definitions
// ============================================================

// ---- ECS Core ----

/** Unique entity identifier */
export type EntityId = number;

/** Component tag (no data — used for type filtering) */
export interface Component {
  readonly type: string;
}

/** System processes entities matching its required components */
export interface System {
  readonly name: string;
  /** Required component types to process an entity */
  readonly requiredComponents: readonly string[];
  /** Called once per frame with matching entities */
  update(entities: EntityId[], deltaTime: number): void;
}

// ---- Grid & Map ----

export enum TileType {
  Empty = 'empty',
  Path = 'path',
  Blocked = 'blocked',
  Base = 'base',
  Spawn = 'spawn',
}

export interface Tile {
  type: TileType;
  row: number;
  col: number;
}

export interface SceneLayout {
  offsetX: number;
  offsetY: number;
  cols: number;
  rows: number;
  tileSize: number;
  mapPixelW: number;
  mapPixelH: number;
}

export enum ObstacleType {
  // Plains
  Tree = 'tree',
  Bush = 'bush',
  Flower = 'flower',
  // Desert
  Rock = 'rock',
  Cactus = 'cactus',
  Bones = 'bones',
  // Tundra
  IceCrystal = 'ice_crystal',
  SnowTree = 'snow_tree',
  FrozenRock = 'frozen_rock',
  // Volcano
  LavaVent = 'lava_vent',
  ScorchedTree = 'scorched_tree',
  VolcanicRock = 'volcanic_rock',
  // Castle
  Pillar = 'pillar',
  Brazier = 'brazier',
  Rubble = 'rubble',
  // ---- v3.2 8 关 roguelike 装饰（不影响 gameplay，DecorationSystem fallback 到通用几何） ----
  // 关 2 沙漠虫潮
  SandDune = 'sand_dune',
  TunnelEntrance = 'tunnel_entrance',
  TunnelExit = 'tunnel_exit',
  // 关 3 极地暴雪
  IcePillar = 'ice_pillar',
  SnowPile = 'snow_pile',
  IceTile = 'ice_tile',
  // 关 4 失落神庙
  TemplePillar = 'temple_pillar',
  AncientStatue = 'ancient_statue',
  VineOvergrowth = 'vine_overgrowth',
  // 关 5 沉没港口
  ShipWreck = 'ship_wreck',
  DockCrate = 'dock_crate',
  Buoy = 'buoy',
  TideShoal = 'tide_shoal',
  // 关 6 齿轮工厂
  ConveyorBelt = 'conveyor_belt',
  GearDecoration = 'gear_decoration',
  SteamPipe = 'steam_pipe',
  CoalPile = 'coal_pile',
  // 关 7 孢子菌林
  MushroomCluster = 'mushroom_cluster',
  SporePod = 'spore_pod',
  MoldSpawner = 'mold_spawner',
  HyphalRoot = 'hyphal_root',
  // 关 8 异界终战
  AlienPillar = 'alien_pillar',
  CorruptedObelisk = 'corrupted_obelisk',
  VoidRift = 'void_rift',
  RealityWarp = 'reality_warp',
  // ---- v4.0 通用装饰物（跨主题） ----
  // 城堡/古堡
  DeadTree = 'dead_tree',
  Wall = 'wall',
  // 废土
  Car = 'car',
  // 深渊
  FloatingRock = 'floating_rock',
  PurpleFlame = 'purple_flame',
  CrystalObstacle = 'crystal_obstacle',
}

export interface ObstaclePlacement {
  row: number;
  col: number;
  type: ObstacleType;
}

// ---- 场景表现增强 ----

/** 环境生物类型 */
export enum AmbientCreatureType {
  Bird = 0,            // 小鸟
  Butterfly = 1,       // 蝴蝶
  Squirrel = 2,        // 松鼠（平原）
  Lizard = 3,          // 蜥蜴（沙漠）
  Penguin = 4,         // 企鹅（冰原）
  Firefly = 5,         // 萤火虫（火山/夜晚）
  Rat = 6,             // 老鼠（城堡）
  // 通用
  GrassBlade = 10,     // 草丛叶片（微动）
  FloatingDust = 11,   // 漂浮尘埃/花粉
}

/** 环境生物预设活动路径 */
export interface CreaturePath {
  type: AmbientCreatureType;
  /** 路径点序列（像素坐标，非网格坐标） */
  waypoints: { x: number; y: number }[];
  /** true = 循环路径，false = 来回走动 */
  loop: boolean;
}

/** 环境生物配置 */
export interface AmbientCreatureConfig {
  birds: { min: number; max: number };
  groundAnimals: {
    types: AmbientCreatureType[];
    count: number;
    spawnChance: number;  // 每波刷新概率 (0-1)
  };
  grassBlades: { enabled: boolean; density: number };  // density: 0-1
  floatingDust: { enabled: boolean };
}

/** 全屏环境特效开关 */
export interface EnvironmentFXConfig {
  sunRays: boolean;
  cloudShadows: boolean;
  windLines: boolean;
  vignette: boolean;
  heatShimmer: boolean;
  waterShimmer: boolean;
  cameraBreathing: boolean;
}

export interface MoonlightConfig {
  enabled: boolean;
  /** 兼容旧配置；当前 shader 不使用该值绘制棋盘内部提亮层 */
  ambientAlpha: number;
  /** 棋盘 bloom 光晕强度，建议 0.08-0.30 */
  bloomAlpha: number;
}

export interface FogOverlayConfig {
  enabled: boolean;
}

export interface MapLightingConfig {
  moonlight?: Partial<MoonlightConfig>;
  fogOverlay?: Partial<FogOverlayConfig>;
}

export interface MapConfig {
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileType[][];
  /** Runtime art theme used by tile texture selection. */
  artTheme?: TileArtTheme;
  spawns?: import('../level/graph/types.js').SpawnPoint[];
  pathGraph?: import('../level/graph/types.js').PathGraph;
  tileColors?: Partial<Record<TileType, string>>;
  altSpawnPoints?: GridPos[];
  sceneDescription?: string;
  obstaclePlacements?: ObstaclePlacement[];
  neutralUnits?: Array<{
    type: 'trap' | 'spring' | 'chest';
    row: number; col: number;
    config?: Record<string, number>;
  }>;
  /** 动态环境生物配置 */
  ambientCreatures?: AmbientCreatureConfig;
  /** 全屏环境特效开关 */
  environmentFX?: EnvironmentFXConfig;
  /** 棋盘光照配置 */
  lighting?: MapLightingConfig;
  /** 生物活动预设路径 */
  creaturePaths?: CreaturePath[];
}

export interface GridPos {
  row: number;
  col: number;
}

// ---- Building / Tower ----

export enum TowerType {
  Arrow = 'arrow',
  Ballista = 'ballista',
  Cannon = 'cannon',
  Laser = 'laser',
  Bat = 'bat',
  Missile = 'missile',
  Ice = 'ice',
  Fire = 'fire',
  Poison = 'poison',
  Lightning = 'lightning',
}

export interface TowerConfig {
  type: TowerType;
  name: string;
  cost: number;
  hp: number;
  atk: number;
  attackSpeed: number;
  range: number;
  damageType: 'physical' | 'magic' | 'true';
  upgradeCosts: number[];
  upgradeAtkBonus: number[];
  upgradeRangeBonus: number[];
  color: string;
  size?: number;
  shape?: ShapeType;
  outline?: boolean;
  visualParts?: UnitVisualParts;
  /** 建造耗时（秒）— 安装后到可攻击之间的延迟。省略则按默认值 2.0s。 */
  buildTime?: number;
  splashRadius?: number;
  stunDuration?: number;
  slowPercent?: number;
  slowMaxStacks?: number;
  slowDuration?: number;
  freezeDuration?: number;
  freezeChance?: number;
  chainCount?: number;
  chainCountByLevel?: number[];
  chainDecay?: number;
  canTargetLowAir?: boolean;
  chainRange?: number;
  lightningStormCooldown?: number;
  lightningStormDamage?: number;
  // Bat tower specific
  batCount?: number;
  batCountByLevel?: number[];
  batReplenishCD?: number;
  batHP?: number;
  batHPByLevel?: number[];
  batDamage?: number;
  batDamageByLevel?: number[];
  batAttackRange?: number;
  batAttackRangeByLevel?: number[];
  batAttackSpeed?: number;
  batAttackSpeedByLevel?: number[];
  batSpeed?: number;
  // Vine tower specific (DOT)
  dotDamage?: number;
  dotDuration?: number;
  dotMaxStacks?: number;
  // Command tower specific (aura buff)
  auraRadius?: number;
  auraAtkSpeedBonus?: number;
  auraRangeBonus?: number;
  auraAtkBonus?: number;
  // Ballista tower specific (piercing sniper)
  pierceCount?: number;
  armorPenetration?: number;
  // Missile tower specific (v1.1 strategic weapon)
  cantTargetFlying?: boolean;        // 不能命中飞行敌（地面爆炸不伤飞行）
  centerBonusRadiusRatio?: number;   // L5+ 热压：中心加成半径占爆炸半径的比例
  centerBonusMultiplier?: number;    // L5+ 热压：中心加成伤害倍数
  // Multi-shot: 同时发射的弹丸数量（按等级递增）
  projectileCount?: number[];        // index 0=L1, 1=L2, ... 不设置则默认 [1]
}

// ---- Enemy ----

export enum EnemyType {
  // 绿野仙踪（怪兽族）
  Goblin = 'goblin',
  Boar = 'boar',
  Elephant = 'elephant',
  Giant = 'giant',
  GiantSlime = 'giant_slime',
  // 沙漠虫潮（虫族）
  DesertBeetle = 'desert_beetle',
  BurrowBeetle = 'burrow_beetle',
  Locust = 'locust',
  BombBeetle = 'bomb_beetle',
  QueenBeetle = 'queen_beetle',
  // 黑暗古堡（黑暗族）
  Werewolf = 'werewolf',
  VampireBat = 'vampire_bat',
  Wizard = 'wizard',
  DarkPriest = 'dark_priest',
  Frankenstein = 'frankenstein',
  Lucifer = 'lucifer',
  Skeleton = 'skeleton',
  // 末日废土（机械族）
  Plane = 'plane',
  Tank = 'tank',
  OilTruck = 'oil_truck',
  RobotDog = 'robot_dog',
  GiantRobot = 'giant_robot',
  Drone = 'drone',
  SuperRobot = 'super_robot',
  // 深渊裂隙
  AbyssLord = 'abyss_lord',
}

export interface EnemyConfig {
  type: string;
  name: string;
  hp: number;
  speed: number;
  atk: number;
  defense: number;
  magicResist: number;
  damageType?: 'physical' | 'magic' | 'true';
  attackRange: number;
  attackSpeed: number;
  canAttackBuildings: boolean;
  rewardGold: number;
  /** v5.1 掉落金币随机方差（0-1），默认 0.2 即 ±20% */
  goldVariance?: number;
  color: string;
  radius: number;
  description?: string;
  isBoss?: boolean;
  bossType?: string;
  splitCount?: number;
  bossPhase2HpRatio?: number;
  /** 死亡时触发的特殊效果类型 */
  specialOnDeath?: 'explode';
  /** 死亡爆炸伤害 */
  deathDamage?: number;
  /** 死亡爆炸半径 */
  deathRadius?: number;
  /** 热气球专用：炸弹伤害 */
  bombDamage?: number;
  /** 热气球专用：投弹间隔(秒) */
  bombInterval?: number;
  /** 热气球专用：炸弹爆炸半径 */
  bombRadius?: number;
  /** 萨满专用：治疗量/次 */
  healAmount?: number;
  /** 萨满专用：治疗间隔(秒) */
  healInterval?: number;
  /** 萨满专用：治疗光环半径 */
  healRadius?: number;
  /** 萨满专用：光环移速加成 */
  auraSpeedBonus?: number;
  /** 萨满专用：光环攻击加成 */
  auraAttackBonus?: number;
  /** 萨满专用：光环半径 */
  auraRadius?: number;
  /** 铁甲巨兽专用：冲锋速度加成 */
  chargeSpeedBonus?: number;
  /** 铁甲巨兽专用：冲锋冷却(秒) */
  chargeCooldown?: number;
  /** 铁甲巨兽专用：冲锋持续时间(秒) */
  chargeDuration?: number;
  /** 铁甲巨兽专用：眩晕抵抗(0-1, 0=正常 1=免疫) */
  stunResist?: number;
  /** 铁甲巨兽专用：冰冻抵抗(秒, 免疫时长减免) */
  freezeResist?: number;
  /** 基础几何形状：'circle' / 'rect' / 'hexagon' 等。默认 'circle'（敌人历史上是圆形） */
  shape?: ShapeType;
  /** 视觉部件配置（武器/身体细节/徽记）— 不填则由程序化美术生成器补齐 */
  visualParts?: UnitVisualParts;
  /** 攻击动画时长（秒）— 用于挥砍/拉弓等武器动作。默认 0.3 秒；0 则不播放武器挥砍 */
  attackAnimDuration?: number;
}

// ---- Unit ----

export enum UnitType {
  ShieldGuard = 'shield_guard',
  Swordsman = 'swordsman',
  Archer = 'archer',
  Priest = 'priest',
  Assassin = 'assassin',
  Mage = 'mage',
}

export interface UnitConfig {
  type: UnitType;
  name: string;
  hp: number;
  atk: number;
  attackSpeed: number;
  attackRange: number;
  speed: number;
  defense: number;
  damageType?: 'physical' | 'magic' | 'true';
  popCost: number;
  color: string;
  size: number;
  skillId: string;
  cost: number;
  moveRange: number;
  alertRange?: number; // detection radius for soldier AI alert behavior (default 0)
  tauntCapacity?: number; // 嘲讽光环标记：>0 表示可自动嘲讽，同一盾卫同时只维持 1 个目标（默认 0 = 无嘲讽）
  tauntCapacityPerLevel?: number; // 旧配置兼容字段；当前不再限制嘲讽数量
  splashRadius?: number; // 近战 AOE 半径（px），>0 时每次攻击对周围目标造成 60% 溅射伤害
  splashDamage?: number; // 近战 AOE 固定溅射伤害，未配置时使用攻击力 60%
  critChance?: number; // 暴击概率（0-1）
  critMultiplier?: number; // 普通暴击倍率
  critSuperChance?: number; // 强暴击概率（0-1），在未触发普通暴击时判定
  critSuperMultiplier?: number; // 强暴击倍率
  executeThreshold?: number; // 处决阈值：目标当前 HP / max HP 低于该比例时触发
  executeNormalOnly?: boolean; // true = 只处决普通敌人，不处决 Boss/精英
  teleportOnExecute?: boolean; // 处决时瞬移到目标旁
  debuffId?: string; // 攻击命中时施加的负面 buff id
  debuffAttribute?: string; // 负面 buff 影响的属性
  debuffValue?: number; // 负面 buff 数值
  debuffDuration?: number; // 负面 buff 持续时间
  debuffIsPercent?: boolean; // 负面 buff 是否百分比
  periodicSpellCooldown?: number; // 周期施法间隔（秒）
  periodicSpellDamage?: number; // 周期法术伤害
  periodicSpellRadius?: number; // 周期法术半径
  healAmount?: number; // 治疗量
  healCooldown?: number; // 治疗间隔（秒）
  healRange?: number; // 治疗范围
  repairAmount?: number; // 修塔量
  repairRange?: number; // 修塔范围
  maxLevel?: number; // 等级上限（默认 3）
  upgradeCosts?: readonly number[]; // 各级升级费用：[1→2, 2→3, ...]（长度 = maxLevel - 1）
  upgradeHpBonus?: readonly number[]; // 每级升级增加的最大 HP
  upgradeAtkBonus?: readonly number[]; // 每级升级增加的攻击力
  upgradeTauntCapacityBonus?: readonly number[]; // 旧配置兼容字段；当前不再限制嘲讽数量
  /** 基础几何形状：'circle' / 'rect' / 'hexagon' 等。默认 'rect'（士兵历史上是方块） */
  shape?: ShapeType;
  /** 视觉部件配置（武器/身体细节/徽记）— 不填则由程序化美术生成器补齐 */
  visualParts?: UnitVisualParts;
  /** 攻击动画时长（秒）— 用于挥砍/拉弓等武器动作。默认 0.3 秒；0 则不播放武器挥砍 */
  attackAnimDuration?: number;
  /** 目标选择策略（默认 'nearest'） */
  targetSelection?: string;
  canTargetLowAir?: boolean;
}

// ---- Trap ----

export interface TrapConfig {
  type: string;
  name: string;
  hp: number;
  defense?: number;
  magicResist?: number;
  damagePerSecond: number;
  radius: number;
  cooldown: number;
  maxTriggers: number;
  color: string;
  size: number;
  cost: number;
  shape?: ShapeType;
  outline?: boolean;
  visualParts?: UnitVisualParts;
  layer?: string;
  // 机关特有可选属性
  rootDuration?: number;
  stunDuration?: number;
  damage?: number;
  bossImmune?: boolean;
  slowPercent?: number;
  slowDuration?: number;
  killChance?: number;
  pushDistance?: number;
  pullDistance?: number;
  range?: number;
}

// ---- Production ----

export type ProductionType = string;

export interface ProductionConfig {
  type: ProductionType;
  name: string;
  cost: number;
  hp: number;
  resourceType: 'gold' | 'energy';
  baseRate: number;
  upgradeRateBonus: number;
  upgradeCosts: number[];
  maxLevel: number;
  color: string;
}

// ---- Buff ----

export enum BuffAttribute {
  HP = 'hp',
  ATK = 'atk',
  Speed = 'speed',
  Defense = 'defense',
  Range = 'range',
  AttackSpeed = 'attack_speed',
}

// ---- Weather ----

export enum WeatherType {
  Sunny = 'sunny',
  Rain = 'rain',
  Snow = 'snow',
  Fog = 'fog',
  Night = 'night',
  RedMist = 'red_mist',
  // ---- v3.2 8 关 roguelike 主题天气 (16-level-blueprints §0-§9) ----
  Sandstorm = 'sandstorm',   // 关 2 沙漠虫潮
  Blizzard = 'blizzard',     // 关 3 极地暴雪要塞
  Storm = 'storm',           // 关 5 沉没港口（暴雨）
  Smog = 'smog',             // 关 6 齿轮工厂（煤烟）
  SporeMist = 'spore_mist',  // 关 7 孢子菌林
  Void = 'void',             // 关 8 异界终战
}

export interface WeatherModifier {
  targetType: string;
  attribute: BuffAttribute;
  value: number;
  isPercent: boolean;
}

export interface WeatherConfig {
  type: WeatherType;
  name: string;
  modifiers: WeatherModifier[];
  screenTint: string;
  screenAlpha: number;
}

export interface BuffInstance {
  id: string;
  name: string;
  attribute: BuffAttribute;
  value: number;
  isPercent: boolean;
  duration: number;
  maxStacks: number;
  currentStacks: number;
  sourceEntityId: EntityId;
}

// ---- Skill ----

export enum SkillTrigger {
  Active = 'active',
  Passive = 'passive',
  Aura = 'aura',
  Conditional = 'conditional',
}

export interface SkillConfig {
  id: string;
  name: string;
  trigger: SkillTrigger;
  cooldown: number;
  energyCost: number;
  range: number;
  value: number;
  buffId: string | null;
  description: string;
}

// ---- Economy ----

export interface PlayerResources {
  gold: number;
  lives: number;
}

// ---- Wave ----

export interface WaveEnemyGroup {
  enemyType: string;
  count: number;
  spawnInterval: number;
  spawnId?: string;
}

export interface BossReinforcementConfig {
  /** Boss 存活期间每隔多少秒补充一轮非 Boss 敌人；默认 15 秒 */
  interval?: number;
  /** 场上非 Boss 敌人达到该数量时暂缓补充；默认 8 */
  maxAliveNonBoss?: number;
  /** 补充波组成；缺省时复用 Boss 波里已配置的非 Boss 敌人组 */
  groups?: WaveEnemyGroup[];
}

export interface WaveConfig {
  waveNumber: number;
  enemies: WaveEnemyGroup[];
  spawnDelay: number;
  isBossWave?: boolean;
  /** Boss 战中循环补充的金币敌人，避免只剩 Boss 单体拖战斗 */
  bossReinforcements?: BossReinforcementConfig;
  spawnPointIndex?: number;
  /** 波次通关奖励金币 */
  reward?: number;
}

// ---- Game State ----

export enum GamePhase {
  Deployment = 'deployment',
  Battle = 'battle',
  WaveBreak = 'wave_break', // between waves
  Victory = 'victory',
  Defeat = 'defeat',
}

// ---- Input Abstraction ----

export enum InputAction {
  PointerDown = 'pointer_down',
  PointerMove = 'pointer_move',
  PointerUp = 'pointer_up',
  // Future: LongPress, DoubleTap
}

export interface InputEvent {
  action: InputAction;
  x: number; // canvas-relative
  y: number;
}

// ---- Geometry Rendering ----

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'arrow';
export type TileArtTheme = 'meadow' | 'desert' | 'castle' | 'wasteland' | 'abyss';

export interface RenderCommand {
  shape: ShapeType;
  x: number;
  y: number;
  size: number;
  color: string;
  image?: CanvasImageSource;
  /** 图片源矩形；用于从图集大图中裁剪单帧。未设置时绘制整张 image。 */
  imageSource?: { x: number; y: number; w: number; h: number };
  /** 图片颜色叠加；用于受击、元素命中等短促状态，不影响几何 fallback 的主体选择。 */
  imageTint?: { color: string; alpha: number };
  scaleX?: number;
  alpha?: number;
  rotation?: number;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
  labelColor?: string;
  labelSize?: number;
  targetX?: number;
  targetY?: number;
  /** Arrow gradient tail color — when set, arrow shaft renders gradient from this color to `color` */
  arrowGradientTail?: string;
  /** Arrow shaft width ratio relative to size; defaults to 0.18 */
  arrowShaftWidthRatio?: number;
  /** Arrow head width ratio relative to head length; defaults to 0.4 */
  arrowHeadWidthRatio?: number;
  /** Arrow length scale relative to size; defaults to 1 */
  arrowLengthScale?: number;
  /** Arrow outer glow color; when set, arrow renders a soft halo before body/head */
  arrowGlowColor?: string;
  /** Arrow outer glow alpha; defaults to 0.28 when arrowGlowColor is set */
  arrowGlowAlpha?: number;
  /** Draw thin air-slice streaks around fast arrows */
  arrowAirStreaks?: boolean;
  h?: number;           // height for rect (defaults to size = square)
  /** 渲染层级 (z-index)，值越大越靠前。默认 5 (Ground 层) */
  z?: number;
  /** 圆形裁剪半径 — 设置后 rect 绘制会被裁剪到该圆内 */
  clipRadius?: number;
}

// ---- Projectile ----

export interface ProjectileConfig {
  speed: number;       // pixels per second
  damage: number;
  shape: ShapeType;
  color: string;
  size: number;
}

// ---- Upgrade Visuals ----

/** Composite geometry part — a single visual element in a unit's multi-part rendering */
export interface CompositePart {
  shape: ShapeType;
  offsetX: number;   // relative to entity center
  offsetY: number;   // relative to entity center
  size: number;
  /** Rect height (defaults to size = square). Ignored for non-rect shapes. */
  h?: number;
  color: string;
  alpha?: number;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
}

/**
 * 可移动单位的视觉部件配置 — 描述身体之上的装饰元素（武器、肩甲、徽记等）。
 *
 * 渲染规则（详见 RenderSystem.drawUnitComposite）：
 * - eyes：历史兼容字段，新程序化美术规范不再生成眼睛
 * - weapon：从单位 anchor 偏移出发的矩形武器，攻击时沿 pivot 旋转挥砍
 * - bodyParts：附加身体几何（围巾/护甲条纹等），随 facing 翻转
 * - bobbing/breathing 由 RenderSystem 统一应用，无需在配置中指定
 */
export interface UnitVisualParts {
  /** @deprecated 历史兼容字段；新程序化美术规范使用装备/轮廓/核心部件识别单位，不再绘制眼睛。 */
  eyes?: {
    /** 眼睛距单位中心的 X 偏移（绝对像素，左右对称）；默认 size * 0.18 */
    offsetX?: number;
    /** 眼睛距单位中心的 Y 偏移（向上为负）；默认 -size * 0.12 */
    offsetY?: number;
    /** 眼白/巩膜半径，0 表示不画眼白只画瞳孔 */
    scleraRadius?: number;
    /** 眼白颜色，默认 #ffffff */
    scleraColor?: string;
    /** 瞳孔半径 */
    pupilRadius: number;
    /** 瞳孔颜色 */
    pupilColor: string;
  };

  /**
   * 武器：单根矩形 + 可选光晕，相对单位 anchor（默认右手 = size * 0.45, -size * 0.05）。
   * 旋转 pivot 固定在 anchor 处，挥砍角度从 restAngle 摆向 swingAngle。
   */
  weapon?: {
    /** 武器在单位坐标系中的 anchor X（相对中心，朝向为右，正值=右） */
    anchorX: number;
    /** 武器在单位坐标系中的 anchor Y（向上为负） */
    anchorY: number;
    /** 武器长度（沿其自身轴向） */
    length: number;
    /** 武器宽度 */
    width: number;
    /** 武器颜色 */
    color: string;
    /** 武器描边颜色 */
    stroke?: string;
    /** 武器描边宽度 */
    strokeWidth?: number;
    /** 武器静止时绕 anchor 的旋转角度（弧度，0 = 水平向右，向下旋转为正） */
    restAngle: number;
    /** 攻击挥砍最大角度（弧度），动画从 restAngle 平滑摆向 restAngle + swingAngle 后回弹 */
    swingAngle: number;
    /** 武器发光颜色（绘制在武器下层做光晕），undefined = 不发光 */
    glowColor?: string;
    /** 发光半径（覆盖整把武器的圆形光晕） */
    glowRadius?: number;
    /** 发光透明度，默认 0.4 */
    glowAlpha?: number;
  };

  /** 附加身体部件（肩甲、围巾、徽记等），跟随 facing 翻转 */
  bodyParts?: CompositePart[];

  /**
   * 移动晃动风格：
   * - 'walking'（默认）：地面单位 — 浅 Y bob (±2px) + X 摇摆 (±0.6px)
   * - 'floating'：空中单位 — 较深 Y bob (±4px)，无 X 摇摆（气球类）
   * - 'static'：塔/机关 — 不做行走晃动，仅保留轻微呼吸
   */
  bobStyle?: 'walking' | 'floating' | 'static';
}

/** Per-level upgrade visual configuration */
export interface UpgradeVisualConfig {
  level: number;
  /** Scale multiplier relative to base size (L1 = 1.0) */
  scaleMultiplier: number;
  /** Extra composite parts added at this level (beyond the base shape) */
  extraParts: CompositePart[];
  /** Glow config (L3-L5) */
  glow?: {
    radius: number;
    color: string;
    alpha: number;
    pulseAmplitude?: number; // default 0.05
  };
  /** Passive visual unlock at L3 */
  passiveVisual?: {
    type: 'crit_flash' | 'aoe_ring' | 'shatter_effect' | 'arc_upgrade' | 'beam_widen' | 'bat_plus' | 'double_explosion';
    description: string;
  };
}

/** Upgrade visual registry — maps tower ID to per-level configs */
export type UpgradeVisualRegistry = Record<string, UpgradeVisualConfig[]>;

// ---- Component Types (ECS data) ----

export const CType = {
  Position: 'Position',
  Render: 'Render',
  Health: 'Health',
  Attack: 'Attack',
  Movement: 'Movement',
  Tower: 'Tower',
  Enemy: 'Enemy',
  PlayerOwned: 'PlayerOwned',
  GridOccupant: 'GridOccupant',
  Projectile: 'Projectile',
  Unit: 'Unit',
  PlayerControllable: 'PlayerControllable',
  Buff: 'Buff',
  Skill: 'Skill',
  Production: 'Production',
  Boss: 'Boss',
  EnemyAttacker: 'EnemyAttacker',
  Trap: 'Trap',
  HealingSpring: 'HealingSpring',
  GoldChest: 'GoldChest',
  DeathEffect: 'DeathEffect',
  ExplosionEffect: 'ExplosionEffect',
  // New unified unit system components
  UnitTag: 'UnitTag',
  Lifecycle: 'Lifecycle',
  BatSwarmMember: 'BatSwarmMember',
  BatTower: 'BatTower',
  LaserBeam: 'LaserBeam',
  Soldier: 'Soldier',
  Elite: 'Elite',
  CardComponent: 'CardComponent',
} as const;

export type ComponentType = (typeof CType)[keyof typeof CType];

// ---- Game Screen ----

export enum GameScreen {
  LevelSelect = 'level_select',
  Loading = 'loading',
  Battle = 'battle',
}

// ---- Level System ----

export enum LevelTheme {
  Plains = 'plains',
  Desert = 'desert',
  Tundra = 'tundra',
  Volcano = 'volcano',
  Castle = 'castle',
  Wasteland = 'wasteland',
  Abyss = 'abyss',
}

export interface LevelConfig {
  id: string;
  name: string;
  theme: LevelTheme;
  description: string;
  sceneDescription?: string;
  map: MapConfig;
  waves: WaveConfig[];
  startingGold: number;
  availableTowers: TowerType[];
  availableUnits: UnitType[];
  cardPool?: string[];
  draftPool?: string[];
  unlockStarsRequired: number;
  unlockPrevLevelId: string | null;
  weatherPool?: WeatherType[];
  weatherFixed?: WeatherType;
  weatherChangeInterval?: number;
  /** v6.0: 过关界面配置（可选，缺失时使用默认值） */
  victory?: VictoryConfig;
  /** v4.0: 水晶属性配置 */
  crystal?: {
    hp: number;
  };
}

// ============================================================
// v6.0: Victory Screen — 过关界面配置驱动
// ============================================================

/** 彩带粒子形状 */
export type ConfettiShape = 'ribbon' | 'petal' | 'sparkle' | 'fragment';

/** 彩带发射方式 */
export type ConfettiBurst = 'top_fall' | 'bottom_rise' | 'explosion_center' | 'both_sides';

/** 背景滤镜类型 */
export type VictoryFilter =
  | 'gray_tint'
  | 'rain_to_sunny'
  | 'heat_dissipate'
  | 'dawn_break'
  | 'eye_close'
  | 'rift_seal';

/** 胜利界面故事配置 */
export interface VictoryStory {
  title: string;
  paragraphs: string[];
  /** 关卡选择界面展示的摘要文本 */
  summary: string;
  /** 仅首次通关展示完整故事；重复通关只显示摘要 */
  showFullStoryOnlyFirst: boolean;
}

/** 胜利界面背景粒子 */
export interface VictoryParticle {
  type: 'sparkle' | 'glow';
  color: string;
  /** 粒子密度（相对值，实际数量 = density × 屏幕面积因子） */
  density: number;
  /** 移动速度倍率 */
  speed: number;
}

/** 胜利界面背景配置 */
export interface VictoryBackground {
  filter: VictoryFilter;
  gradient: { top: string; mid: string; bottom: string };
  particles: VictoryParticle[];
}

/** 胜利界面彩带配置 */
export interface VictoryConfetti {
  count: number;
  burst: ConfettiBurst;
  colors: string[][];
  shapes: Partial<Record<ConfettiShape, number>>;
  duration: number;
  spread: number;
}

/** 胜利界面音频配置 */
export interface VictoryAudio {
  bgm: string;
  sfx: string;
}

/** 胜利界面文字样式 */
export interface VictoryTypography {
  titleColor: string[];
  panelBg: string;
  panelBorder: string;
  storyColor: string;
  accentColor: string;
}

/** v6.0: 过关界面完整配置 */
export interface VictoryConfig {
  story: VictoryStory;
  background: VictoryBackground;
  confetti: VictoryConfetti;
  audio: VictoryAudio;
  typography: VictoryTypography;
  /** v6.0: 失败时的故事文本（可选） */
  defeatStory?: VictoryStory;
}

// ============================================================
// Unit System — Unified Unit Concept
// ============================================================

/** Unit category classification */
export enum UnitCategory {
  Tower = 'tower',           // 防御塔
  Enemy = 'enemy',           // 敌人
  Soldier = 'soldier',       // 士兵（玩家单位）
  Trap = 'trap',             // 陷阱
  Decoration = 'decoration', // 场景装饰
  Objective = 'objective',   // 目标点（出生点、大本营等）
  Effect = 'effect',         // 特效单位
  Boss = 'boss',             // BOSS
}

/**
 * Unit layer - 垂直空间层级
 * 
 * 定义单位在垂直空间中的位置，影响可攻击性、碰撞检测和渲染顺序。
 * 从下到上：深渊层 → 地格下层 → 地格上层 → 地面层 → 低空层 → 太空层
 */
export enum UnitLayer {
  Abyss = 'abyss',           // 深渊层 - 无法抵达的最下层（边界层）
  BelowGrid = 'below_grid',  // 地格下层 - 被封印/隐藏的单位
  AboveGrid = 'above_grid',  // 地格上层 - 地面陷阱（如地刺）
  Ground = 'ground',         // 地面层 - 默认层级（大多数单位）
  LowAir = 'low_air',        // 低空层 - 飞行单位
  Space = 'space',           // 太空层 - 无法抵达的最上层（边界层）
}

/** Layer interaction rules */
export interface LayerInteractionConfig {
  /** 可被哪些层级攻击 */
  canBeAttackedBy: UnitLayer[];
  /** 可以攻击哪些层级 */
  canAttack: UnitLayer[];
  /** 与哪些层级有碰撞 */
  collidesWith: UnitLayer[];
}

/** Unit lifecycle events */
export enum LifecycleEvent {
  Spawn = 'spawn',         // 出生
  Death = 'death',         // 死亡（触发死亡效果）
  Destroy = 'destroy',     // 销毁（不触发死亡效果）
  Upgrade = 'upgrade',     // 升级
  Downgrade = 'downgrade', // 降级
  Attack = 'attack',       // 攻击
  Hit = 'hit',             // 受击
}

/** Unit configuration - defines all properties for a unit type */
export interface UnitTypeConfig {
  id: string;
  name: string;
  category: UnitCategory;
  description?: string;

  // Layer (vertical position)
  layer?: UnitLayer; // Default: UnitLayer.Ground

  // Base attributes
  hp: number;
  atk: number;
  defense: number;
  attackSpeed: number;
  moveSpeed: number;
  moveRange: number;
  attackRange: number;
  alertRange?: number; // detection radius for soldier AI alert behavior (default 0)
  magicResist: number;

  // Visual
  color: string;
  size: number;
  shape: ShapeType;
  visualParts?: UnitVisualParts; // 视觉部件配置（武器/身体细节/徽记）

  // AI behavior
  aiConfig: string; // AI preset ID

  // Lifecycle effects
  lifecycle: LifecycleConfig;

  // Layer interaction rules (optional, uses defaults based on layer if not specified)
  layerInteraction?: LayerInteractionConfig;

  // Special properties (category-specific)
  special?: Record<string, unknown>;

  // Economy
  cost?: number;
  sellValue?: number;
  upgradeCosts?: number[];
}

/** Lifecycle effect configuration */
export interface LifecycleConfig {
  onSpawn?: EffectConfig[];
  onDeath?: EffectConfig[];
  onDestroy?: EffectConfig[];
  onUpgrade?: EffectConfig[];
  onDowngrade?: EffectConfig[];
  onAttack?: EffectConfig[];
  onHit?: EffectConfig[];
}

/** Effect configuration */
export interface EffectConfig {
  type: string;
  params?: Record<string, unknown>;
}

// ============================================================
// v4.0 Soldier AI — 四状态机
// ============================================================

export enum SoldierState {
  Idle = 0,
  Combat = 1,
  Returning = 2,
  Healing = 3,
}
