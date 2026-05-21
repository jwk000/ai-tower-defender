import yaml from 'js-yaml';
import { z } from 'zod';

import type { UnitConfig } from '../factories/UnitFactory.js';
import type { CardConfig } from '../unit-system/CardRegistry.js';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeColor(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && HEX_RE.test(raw)) {
    const hex = raw.slice(1);
    const full = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
    return parseInt(full, 16);
  }
  throw new Error(`[loader] invalid color value: ${JSON.stringify(raw)}`);
}

const StatsSchema = z
  .object({
    hp: z.number().nonnegative(),
    atk: z.number().nonnegative().optional(),
    attackSpeed: z.number().nonnegative().optional(),
    range: z.number().nonnegative().optional(),
    speed: z.number().nonnegative().optional(),
  })
  .passthrough();

const SHAPE_ALIASES: Readonly<Record<string, 'rect' | 'circle' | 'triangle'>> = {
  rect: 'rect',
  rectangle: 'rect',
  square: 'rect',
  circle: 'circle',
  hexagon: 'circle',
  triangle: 'triangle',
};

const VisualSchema = z
  .object({
    shape: z.string().transform((raw, ctx) => {
      const mapped = SHAPE_ALIASES[raw];
      if (!mapped) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `[loader] unknown visual.shape '${raw}'; allowed: ${Object.keys(SHAPE_ALIASES).join(', ')}`,
        });
        return z.NEVER;
      }
      return mapped;
    }),
    color: z.union([z.number(), z.string()]),
    size: z.number().positive(),
  })
  .passthrough();

const RuleSchema = z
  .object({
    handler: z.string().optional(),
    type: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough()
  .transform((raw) => {
    const handler = raw.handler ?? raw.type;
    if (!handler) {
      throw new Error('[loader] lifecycle rule must have `handler` or `type` field');
    }
    const { handler: _h, type: _t, params, ...extras } = raw as Record<string, unknown>;
    const mergedParams = { ...(params ?? {}), ...extras };
    return Object.keys(mergedParams).length > 0
      ? { handler, params: mergedParams }
      : { handler };
  });

const LifecycleSchema = z
  .object({
    onCreate: z.array(RuleSchema).optional(),
    onDeath: z.array(RuleSchema).optional(),
    onHit: z.array(RuleSchema).optional(),
    onAttack: z.array(RuleSchema).optional(),
    onKill: z.array(RuleSchema).optional(),
    onUpgrade: z.array(RuleSchema).optional(),
    onDestroy: z.array(RuleSchema).optional(),
    onEnter: z.array(RuleSchema).optional(),
    onLeave: z.array(RuleSchema).optional(),
  })
  .passthrough();

const ChargeSchema = z
  .object({
    multiplier: z.number().positive(),
    duration: z.number().nonnegative(),
    cooldown: z.number().nonnegative(),
  })
  .passthrough();

const SupportSchema = z
  .object({
    radius: z.number().positive(),
    shieldAmount: z.number().int().positive(),
    duration: z.number().positive(),
    interval: z.number().positive(),
  })
  .passthrough();

const SummonSchema = z
  .object({
    radius: z.number().nonnegative(),
    interval: z.number().positive(),
    unitId: z.string(),
  })
  .passthrough();

const UnitDocSchema = z
  .object({
    id: z.string(),
    category: z.enum(['Tower', 'Soldier', 'Enemy', 'Building', 'Trap', 'Neutral', 'Objective']),
    faction: z.enum(['Player', 'Enemy', 'Neutral']),
    isBoss: z.boolean().optional(),
    stats: StatsSchema,
    visual: VisualSchema,
    charge: ChargeSchema.optional(),
    support: SupportSchema.optional(),
    summon: SummonSchema.optional(),
    lifecycle: LifecycleSchema.optional(),
  })
  .passthrough();

function isUnitLikeRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.category === 'string' && typeof obj.faction === 'string';
}

export function parseUnitConfig(yamlText: string): UnitConfig {
  const doc = yaml.load(yamlText);
  const parsed = UnitDocSchema.parse(doc);
  const lifecycle = parsed.lifecycle
    ? Object.fromEntries(
        Object.entries(parsed.lifecycle).filter(([, v]) => Array.isArray(v)),
      )
    : undefined;
  return {
    id: parsed.id,
    ...(typeof (doc as Record<string, unknown> | null | undefined)?.name === 'string'
      ? { name: (doc as Record<string, unknown>).name as string }
      : {}),
    category: parsed.category,
    faction: parsed.faction,
    ...(parsed.isBoss ? { isBoss: true } : {}),
    stats: {
      hp: parsed.stats.hp,
      atk: parsed.stats.atk ?? 0,
      attackSpeed: parsed.stats.attackSpeed ?? 0,
      range: parsed.stats.range ?? 0,
      speed: parsed.stats.speed ?? 0,
    },
    visual: {
      shape: parsed.visual.shape,
      color: normalizeColor(parsed.visual.color),
      size: parsed.visual.size,
    },
    ...(parsed.charge ? { charge: parsed.charge } : {}),
    ...(parsed.support ? { support: parsed.support } : {}),
    ...(parsed.summon ? { summon: parsed.summon } : {}),
    ...(lifecycle ? { lifecycle: lifecycle as UnitConfig['lifecycle'] } : {}),
  };
}

export interface ParseUnitsBatchOptions {
  readonly onSkip?: (id: string, error: unknown) => void;
}

export function parseUnitConfigsFromYaml(
  yamlText: string,
  opts: ParseUnitsBatchOptions = {},
): UnitConfig[] {
  const docs = yaml.loadAll(yamlText);
  const out: UnitConfig[] = [];
  const tryParse = (id: string, entry: unknown) => {
    try {
      out.push(parseUnitConfig(yaml.dump(entry, { lineWidth: -1 })));
    } catch (err) {
      opts.onSkip?.(id, err);
    }
  };
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    if (isUnitLikeRecord(doc)) {
      const rawId = (doc as Record<string, unknown>).id;
      const fallbackId = typeof rawId === 'string' ? rawId : '<top-level>';
      tryParse(fallbackId, doc);
      continue;
    }
    for (const [id, value] of Object.entries(doc as Record<string, unknown>)) {
      if (!isUnitLikeRecord(value)) continue;
      tryParse(id, { id, ...value });
    }
  }
  return out;
}

const CardDocSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(['unit', 'spell', 'trap', 'production']),
    energyCost: z.number().nonnegative(),
    unitConfigId: z.string().optional(),
    spellEffectId: z.string().optional(),
  })
  .passthrough();

export interface ParseCardOptions {
  idFallback?: string;
}

export function parseCardConfig(yamlText: string, opts: ParseCardOptions = {}): CardConfig {
  const doc = yaml.load(yamlText) as Record<string, unknown> | null | undefined;
  if (doc && typeof doc === 'object' && 'type' in doc && (doc as { type: unknown }).type === 'shop_item') {
    throw new Error('[loader] unsupported card type: shop_item (MVP excludes shop cards from combat hand, see 48 §3)');
  }
  const parsed = CardDocSchema.parse(doc);
  const id = parsed.id ?? opts.idFallback;
  if (!id) {
    throw new Error('[loader] card YAML must have `id` field or caller must pass { idFallback }');
  }
  const card: CardConfig = {
    id,
    type: parsed.type,
    energyCost: parsed.energyCost,
    ...(parsed.unitConfigId ? { unitConfigId: parsed.unitConfigId } : {}),
    ...(parsed.spellEffectId ? { spellEffectId: parsed.spellEffectId } : {}),
  };
  return card;
}

const PathNodeSchema = z
  .object({
    id: z.string(),
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    role: z.enum(['spawn', 'crystal_anchor', 'waypoint', 'merge', 'portal']).optional(),
    spawnId: z.string().optional(),
    teleportTo: z.string().optional(),
  })
  .passthrough();

const WaveGroupSchema = z
  .object({
    enemyType: z.string(),
    count: z.number().int().positive(),
    spawnInterval: z.number().nonnegative(),
  })
  .passthrough();

const WaveSchema = z
  .object({
    waveNumber: z.number().int().positive(),
    spawnDelay: z.number().nonnegative(),
    enemies: z.array(WaveGroupSchema).min(1),
    isBossWave: z.boolean().optional(),
  })
  .passthrough();

const SpawnPointSchema = z
  .object({
    id: z.string(),
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
  })
  .passthrough();

const AvailableSchema = z
  .object({
    towers: z.array(z.string()).optional(),
    units: z.array(z.string()).optional(),
    cards: z.array(z.string()).optional(),
  })
  .passthrough();

const ModifierPoolSchema = z.array(z.string());

const LevelDocSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
    map: z
      .object({
        cols: z.number().int().positive(),
        rows: z.number().int().positive(),
        tileSize: z.number().positive(),
        spawns: z.array(SpawnPointSchema).optional(),
        pathGraph: z
          .object({
            nodes: z.array(PathNodeSchema).min(1),
            edges: z.array(z.object({ from: z.string(), to: z.string() }).passthrough()),
          })
          .passthrough(),
      })
      .passthrough(),
    waves: z.array(WaveSchema).min(1, '[loader] level YAML must define at least 1 wave'),
    starting: z.object({ gold: z.number().nonnegative(), energy: z.number().nonnegative() }).passthrough().optional(),
    available: AvailableSchema.optional(),
    modifierPool: ModifierPoolSchema.optional(),
  })
  .passthrough();

export interface LevelWaveGroup {
  readonly enemyId: string;
  readonly count: number;
  readonly interval: number;
}

export interface LevelWave {
  readonly waveNumber: number;
  readonly startDelay: number;
  readonly groups: LevelWaveGroup[];
  readonly isBossWave?: boolean;
}

export interface LevelSpawnPoint {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly pathIndexStart: number;
}

export interface LevelWeatherConfig {
  readonly pool: readonly string[];
  readonly initial?: string;
}

export interface LevelObstacleConfig {
  readonly type: string;
  readonly row: number;
  readonly col: number;
}

export interface LevelPortalVisualConfig {
  readonly row: number;
  readonly col: number;
  readonly kind: 'entry' | 'exit' | 'bidirectional';
}

export interface LevelAvailable {
  readonly towers: readonly string[];
  readonly units: readonly string[];
  readonly cards: readonly string[];
}

export interface LevelModifierPoolEntry {
  readonly id: string;
}

export interface LevelConfig {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly sceneDescription?: string;
  readonly tileSize: number;
  readonly mapCols: number;
  readonly mapRows: number;
  readonly tiles: readonly (readonly string[])[];
  readonly tileColors: Readonly<Record<string, number>>;
  readonly obstacles: readonly LevelObstacleConfig[];
  readonly portals: readonly LevelPortalVisualConfig[];
  readonly path: Array<{ x: number; y: number }>;
  readonly crystal: { row: number; col: number };
  readonly spawns: readonly LevelSpawnPoint[];
  readonly waves: LevelWave[];
  readonly modifierPool: readonly LevelModifierPoolEntry[];
  readonly startingGold?: number;
  readonly startingEnergy?: number;
  readonly available: LevelAvailable;
  readonly weather?: LevelWeatherConfig;
}

export function parseLevelConfig(yamlText: string): LevelConfig {
  const doc = yaml.load(yamlText);
  const parsed = LevelDocSchema.parse(doc);
  const tileSize = parsed.map.tileSize;
  const nodesById = new Map(parsed.map.pathGraph.nodes.map((n) => [n.id, n]));
  const edges = parsed.map.pathGraph.edges;
  const anchorNodes = parsed.map.pathGraph.nodes.filter((n) => n.role === 'crystal_anchor');
  const spawnNodes = parsed.map.pathGraph.nodes.filter((n) => n.role === 'spawn');
  if (anchorNodes.length === 0) {
    throw new Error('[loader] level pathGraph must contain a node with role=crystal_anchor');
  }
  if (spawnNodes.length === 0) {
    throw new Error('[loader] level pathGraph must contain at least 1 spawn node');
  }
  if (edges.length === 0) {
    throw new Error('[loader] level pathGraph must contain at least 1 edge');
  }
  const anchor = anchorNodes[0]!;
  const spawnIds = new Set((parsed.map.spawns ?? []).map((spawn) => spawn.id));
  const outgoingCount = new Map<string, number>();
  for (const node of parsed.map.pathGraph.nodes) outgoingCount.set(node.id, 0);
  for (const node of parsed.map.pathGraph.nodes) {
    if (node.role === 'spawn' && !node.spawnId) {
      throw new Error(`[loader] spawn node '${node.id}' must define spawnId`);
    }
    if (node.role === 'spawn' && node.spawnId && !spawnIds.has(node.spawnId)) {
      throw new Error(`[loader] spawn node '${node.id}' references unknown spawnId '${node.spawnId}'`);
    }
    if (!node.teleportTo) continue;
    const target = nodesById.get(node.teleportTo);
    if (!target) {
      throw new Error(`[loader] teleportTo target '${node.teleportTo}' referenced by '${node.id}' does not exist`);
    }
  }
  for (const edge of edges) {
    if (!nodesById.has(edge.from)) {
      throw new Error(`[loader] edge.from '${edge.from}' does not exist in pathGraph.nodes`);
    }
    if (!nodesById.has(edge.to)) {
      throw new Error(`[loader] edge.to '${edge.to}' does not exist in pathGraph.nodes`);
    }
    outgoingCount.set(edge.from, (outgoingCount.get(edge.from) ?? 0) + 1);
  }
  for (const node of parsed.map.pathGraph.nodes) {
    if (node.role === 'crystal_anchor' || node.role === 'portal') continue;
    if ((outgoingCount.get(node.id) ?? 0) <= 0) {
      throw new Error(`[loader] non-crystal node '${node.id}' must have at least 1 outgoing edge`);
    }
  }
  for (const spawnNode of spawnNodes) {
    const reachable = anchorNodes.some((anchorNode) => {
      try {
        orderPath(edges, spawnNode.id, anchorNode.id, nodesById);
        return true;
      } catch {
        return false;
      }
    });
    if (!reachable) {
      throw new Error(`[loader] spawn node '${spawnNode.id}' cannot reach any crystal_anchor`);
    }
  }
  const ordered = orderPath(edges, spawnNodes[0]!.id, anchor.id, nodesById);
  const orderedNodeIds = ordered.map((n) => n.id);
  const pathNodeIndexById = new Map(orderedNodeIds.map((id, index) => [id, index]));
  const path = ordered.map((n) => ({
    x: n.col * tileSize + tileSize / 2,
    y: n.row * tileSize + tileSize / 2,
  }));
  const waves: LevelWave[] = parsed.waves.map((w) => ({
    waveNumber: w.waveNumber,
    startDelay: w.spawnDelay,
    groups: w.enemies.map((g) => ({ enemyId: g.enemyType, count: g.count, interval: g.spawnInterval })),
    ...(w.isBossWave ? { isBossWave: true } : {}),
  }));
  const spawns: LevelSpawnPoint[] = (parsed.map.spawns ?? []).map((s) => {
    const pathNode = parsed.map.pathGraph.nodes.find((node) => node.spawnId === s.id)
      ?? parsed.map.pathGraph.nodes.find((node) => node.role === 'spawn' && node.row === s.row && node.col === s.col);
    const pathIndexStart = pathNode ? ((pathNodeIndexById.get(pathNode.id) ?? 0) + 1) : 0;
    return {
      id: s.id,
      row: s.row,
      col: s.col,
      x: s.col * tileSize + tileSize / 2,
      y: s.row * tileSize + tileSize / 2,
      pathIndexStart,
    };
  });
  const available: LevelAvailable = {
    towers: parsed.available?.towers ?? [],
    units: parsed.available?.units ?? [],
    cards: parsed.available?.cards ?? [],
  };
  const tileColors = Object.fromEntries(
    Object.entries(((parsed.map as Record<string, unknown>).tileColors ?? {}) as Record<string, unknown>)
      .map(([key, value]) => [key, normalizeColor(value)]),
  );
  const obstacles = ((((parsed.map as Record<string, unknown>).obstacles ?? []) as unknown[])
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      type: typeof entry.type === 'string' ? entry.type : 'unknown',
      row: typeof entry.row === 'number' ? entry.row : -1,
      col: typeof entry.col === 'number' ? entry.col : -1,
    }))
    .filter((entry) => entry.row >= 0 && entry.col >= 0));
  const portalKindsByCell = new Map<string, LevelPortalVisualConfig['kind']>();
  const setPortalKind = (row: number, col: number, next: 'entry' | 'exit') => {
    const key = `${row},${col}`;
    const prev = portalKindsByCell.get(key);
    portalKindsByCell.set(
      key,
      !prev || prev === next ? next : 'bidirectional',
    );
  };
  for (const node of parsed.map.pathGraph.nodes) {
    if (!node.teleportTo) continue;
    setPortalKind(node.row, node.col, 'entry');
    const target = nodesById.get(node.teleportTo);
    if (target) setPortalKind(target.row, target.col, 'exit');
  }
  const portals = [...portalKindsByCell.entries()].map(([key, kind]) => {
    const parts = key.split(',');
    return { row: Number(parts[0] ?? 0), col: Number(parts[1] ?? 0), kind };
  });
  return {
    id: parsed.id,
    ...(parsed.name ? { name: parsed.name } : {}),
    ...(parsed.description ? { description: parsed.description } : {}),
    ...(typeof (doc as Record<string, unknown> | null | undefined)?.sceneDescription === 'string'
      ? { sceneDescription: (doc as Record<string, unknown>).sceneDescription as string }
      : {}),
    ...((((doc as Record<string, unknown> | null | undefined)?.weather as Record<string, unknown> | undefined)?.pool instanceof Array)
      ? {
          weather: {
            pool: ((((doc as Record<string, unknown>).weather as Record<string, unknown>).pool) as unknown[])
              .filter((v): v is string => typeof v === 'string'),
            ...((typeof (((doc as Record<string, unknown>).weather as Record<string, unknown>).initial) === 'string')
              ? { initial: ((doc as Record<string, unknown>).weather as Record<string, unknown>).initial as string }
              : {}),
          },
        }
      : {}),
    tileSize,
    mapCols: parsed.map.cols,
    mapRows: parsed.map.rows,
    tiles: (((parsed.map as Record<string, unknown>).tiles ?? []) as string[][]).map((row) => [...row]),
    tileColors,
    obstacles,
    portals,
    path,
    crystal: { row: anchor.row, col: anchor.col },
    spawns,
    waves,
    modifierPool: (parsed.modifierPool ?? []).map((id) => ({ id })),
    ...(parsed.starting?.gold !== undefined ? { startingGold: parsed.starting.gold } : {}),
    ...(parsed.starting?.energy !== undefined ? { startingEnergy: parsed.starting.energy } : {}),
    available,
  };
}

export interface ParseCardsBatchOptions {
  readonly onSkip?: (id: string, error: unknown) => void;
}

export function parseCardConfigsFromYaml(
  yamlText: string,
  opts: ParseCardsBatchOptions = {},
): CardConfig[] {
  const docs = yaml.loadAll(yamlText);
  const out: CardConfig[] = [];
  const tryParse = (id: string, entry: unknown) => {
    try {
      out.push(parseCardConfig(yaml.dump(entry, { lineWidth: -1 }), { idFallback: id }));
    } catch (err) {
      opts.onSkip?.(id, err);
    }
  };
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const obj = doc as Record<string, unknown>;
    if (typeof obj.type === 'string' && typeof obj.energyCost === 'number') {
      const id = typeof obj.id === 'string' ? obj.id : '<top-level>';
      tryParse(id, obj);
      continue;
    }
    for (const [id, value] of Object.entries(obj)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      if (typeof v.type !== 'string' || typeof v.energyCost !== 'number') continue;
      tryParse(id, v);
    }
  }
  return out;
}

export function loadCardConfigsForLevel(
  level: LevelConfig,
  yamlFiles: ReadonlyMap<string, string>,
): CardConfig[] {
  const all = new Map<string, CardConfig>();
  for (const text of yamlFiles.values()) {
    for (const cfg of parseCardConfigsFromYaml(text)) {
      all.set(cfg.id, cfg);
    }
  }
  const explicitIds = level.available.cards;
  const derivedIds = level.available.towers.map((t) => `${t}_tower_card`);
  const needed = explicitIds.length > 0 ? [...explicitIds] : derivedIds;
  const out: CardConfig[] = [];
  for (const id of needed) {
    const cfg = all.get(id);
    if (!cfg) {
      throw new Error(`[loader] loadCardConfigsForLevel: missing CardConfig for '${id}' (required by level '${level.id}')`);
    }
    out.push(cfg);
  }
  return out;
}

export function loadUnitConfigsForLevel(
  level: LevelConfig,
  yamlFiles: ReadonlyMap<string, string>,
): Map<string, UnitConfig> {
  const all = new Map<string, UnitConfig>();
  for (const text of yamlFiles.values()) {
    for (const cfg of parseUnitConfigsFromYaml(text)) {
      all.set(cfg.id, cfg);
    }
  }
  const needed = new Set<string>();
  for (const wave of level.waves) {
    for (const group of wave.groups) needed.add(group.enemyId);
  }
  for (const tower of level.available.towers) needed.add(`${tower}_tower`);
  for (const unit of level.available.units) needed.add(unit);

  const out = new Map<string, UnitConfig>();
  for (const id of needed) {
    const cfg = all.get(id);
    if (!cfg) {
      throw new Error(`[loader] loadUnitConfigsForLevel: missing UnitConfig for '${id}' (required by level '${level.id}')`);
    }
    out.set(id, cfg);
  }
  return out;
}

const MysticEffectSchema = z
  .object({ type: z.string() })
  .passthrough();

const MysticChoiceSchema = z.object({
  id: z.string(),
  label: z.string(),
  effects: z.array(MysticEffectSchema),
});

const MysticEventDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  choices: z.array(MysticChoiceSchema).min(1),
});

export type MysticEffect = z.infer<typeof MysticEffectSchema>;
export type MysticChoice = z.infer<typeof MysticChoiceSchema>;
export type MysticEventConfig = z.infer<typeof MysticEventDocSchema>;

export function parseMysticEventConfig(yamlText: string): MysticEventConfig {
  const doc = yaml.load(yamlText);
  return MysticEventDocSchema.parse(doc);
}

const SkillNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().positive(),
  goldCost: z.number().int().nonnegative(),
  prerequisites: z.array(z.string()).default([]),
  effects: z.array(z.object({
    rule: z.string(),
  }).passthrough()),
});

const SkillTreeConfigSchema = z.object({
  nodes: z.array(SkillNodeSchema),
});

export type SkillTreeConfigFromYaml = {
  readonly unitCardId: string;
  readonly nodes: z.infer<typeof SkillNodeSchema>[];
};

export function parseSkillTreeFromUnitYaml(unitId: string, yamlText: string): SkillTreeConfigFromYaml | null {
  const docs = yaml.loadAll(yamlText);
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const record = doc as Record<string, unknown>;
    const unitEntry = record[unitId] as Record<string, unknown> | undefined;
    if (!unitEntry || typeof unitEntry !== 'object') continue;
    const raw = (unitEntry as Record<string, unknown>)['skillTree'];
    if (!raw) continue;
    const parsed = SkillTreeConfigSchema.parse(raw);
    return {
      unitCardId: unitId,
      nodes: parsed.nodes,
    };
  }
  return null;
}

function orderPath(
  edges: Array<{ from: string; to: string }>,
  startId: string,
  endId: string,
  nodes: Map<string, z.infer<typeof PathNodeSchema>>,
): Array<z.infer<typeof PathNodeSchema>> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const path: Array<z.infer<typeof PathNodeSchema>> = [];
  const visited = new Set<string>();
  let cur: string | undefined = startId;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const node = nodes.get(cur);
    if (!node) break;
    path.push(node);
    if (cur === endId) return path;
    cur = adj.get(cur)?.[0];
  }
  if (path.length === 0 || path[path.length - 1]!.id !== endId) {
    const startNode = nodes.get(startId);
    const endNode = nodes.get(endId);
    if (startNode && endNode) return [startNode, endNode];
  }
  return path;
}
