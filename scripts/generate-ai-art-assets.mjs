#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PROGRESS_PATH = resolve(ROOT, 'art-generation-progress.json');
const MODEL_LOCK = 'azure/gpt-image-2';
const STYLE_PREFIX = [
  'dark fantasy casual tower defense game art',
  'stylized 2D hand-painted game asset',
  'clean bold readable silhouette',
  'high contrast rim light',
  'dark navy mood',
  'mobile game friendly',
  'no text, no watermark, no logo',
].join(', ');
const NEGATIVE_PROMPT = [
  'photorealistic',
  'cinematic poster',
  'complex background',
  'tiny details',
  'horror gore',
  'realistic blood',
  'messy silhouette',
  'blurry',
  'low contrast',
  'text',
  'letters',
  'numbers',
  'watermark',
  'logo',
].join(', ');

const assets = [
  // P0 UI base.
  {
    id: 'ui_panel_dark',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_panel_dark.png',
    size: '1024x1024',
    transparent: true,
    prompt: 'dark fantasy casual game UI panel, black iron and dark navy material, subtle brushed metal texture, thin antique gold border, clean 8px rounded corners, 9-slice source, transparent outside, no text, no icons',
  },
  {
    id: 'ui_button_green',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_button_green.png',
    size: '1024x1024',
    transparent: true,
    prompt: 'dark fantasy casual game UI button, emerald green accent, black iron bevel, subtle inner glow, clean readable shape, 9-slice source, transparent outside, no text, no symbol',
  },
  {
    id: 'ui_hud_bar',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_hud_bar.png',
    size: '1536x1024',
    transparent: true,
    prompt: 'dark fantasy casual game top HUD bar, long horizontal black iron strip, dark navy inset panels, thin antique gold separators, lightweight and readable, transparent outside, no text, no icons',
  },
  {
    id: 'ui_card_frame_common',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_card_frame_common.png',
    size: '1024x1536',
    transparent: true,
    prompt: 'vertical tower defense card frame, black iron border, common rarity white subtle glow, illustration window, cost badge socket, name bar and description area left blank, transparent outside, no text, no numbers',
  },
  {
    id: 'ui_card_frame_rare',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_card_frame_rare.png',
    size: '1024x1536',
    transparent: true,
    prompt: 'vertical tower defense card frame, black iron border, rare rarity blue rune glow, illustration window, cost badge socket, name bar and description area left blank, transparent outside, no text, no numbers',
  },
  {
    id: 'ui_card_frame_epic',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_card_frame_epic.png',
    size: '1024x1536',
    transparent: true,
    prompt: 'vertical tower defense card frame, black iron border, epic rarity purple arcane glow, illustration window, cost badge socket, name bar and description area left blank, transparent outside, no text, no numbers',
  },
  {
    id: 'ui_card_frame_legendary',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_card_frame_legendary.png',
    size: '1024x1536',
    transparent: true,
    prompt: 'vertical tower defense card frame, black iron border, legendary rarity antique gold radiant glow, illustration window, cost badge socket, name bar and description area left blank, transparent outside, no text, no numbers',
  },

  // P0 cards.
  ['card_arrow_tower', 'cards', '192x160 game card art of wood and black iron arrow tower with twin bow arms, glowing cyan arrow loaded upward, small quiver silhouettes'],
  ['card_cannon_tower', 'cards', '192x160 game card art of heavy black iron cannon tower, round barrel, orange muzzle flare, chunky armor plates'],
  ['card_ice_tower', 'cards', '192x160 game card art of jagged ice crystal tower, pale blue frost mist, snowflake shards around the top'],
  ['card_lightning_tower', 'cards', '192x160 game card art of tesla coil lightning tower, yellow electric arcs, copper antenna, glowing coil crown'],
  ['card_laser_tower', 'cards', '192x160 game card art of arcane laser tower with cyan crystal core, thin purple beam charging upward, orbiting light dots'],
  ['card_bat_tower', 'cards', '192x160 game card art of gothic bat tower, purple bat wings, single red eye core, small bat silhouettes'],
  ['card_ballista_tower', 'cards', '192x160 game card art of heavy ballista tower, wide crossbow arms, oversized blue energy bolt, siege base'],
  ['card_missile_tower', 'cards', '192x160 game card art of missile launch tower, angled launch tubes, one missile lifting off with orange flame trail'],
  ['card_fire_tower', 'cards', '192x160 game card art of flame tower made of stacked fire shapes, orange red ember sparks, molten base'],
  ['card_poison_tower', 'cards', '192x160 game card art of toxic alchemy tower, green venom sac, dripping poison drops, sickly mist'],
  ['card_swordsman', 'cards', '192x160 game card art of brave swordsman, red steel highlights, broad stance, raised long sword'],
  ['card_archer', 'cards', '192x160 game card art of green hooded archer drawing a bow, arrow aimed forward, agile silhouette'],
  ['card_shield_guard', 'cards', '192x160 game card art of armored shield guard, large cyan tower shield, short sword, defensive stance'],
  ['card_priest', 'cards', '192x160 game card art of white robed priest, golden healing staff, soft holy aura, calm support pose'],
  ['card_engineer', 'cards', '192x160 game card art of orange hard hat engineer, large wrench, small gears and repair sparks'],
  ['card_assassin', 'cards', '192x160 game card art of shadow assassin with twin purple daggers, crouched stealth pose, smoke trail'],
  ['card_mage', 'cards', '192x160 game card art of purple mage with pointed hat, glowing staff crystal, swirling arcane orb'],
  ['card_spike_trap', 'cards', '192x160 game card art of three dark metal spikes bursting from cracked ground, trap mechanism visible'],
  ['card_bear_trap', 'cards', '192x160 game card art of open bear trap with jagged metal jaws, central trigger plate, dark iron'],
  ['card_tar_pit', 'cards', '192x160 game card art of bubbling black tar pit, sticky tendrils, viscous dark surface'],
  ['card_boulder', 'cards', '192x160 game card art of large cracked grey boulder, heavy obstacle silhouette, small stone fragments'],
  ['card_fireball', 'cards', '192x160 game card art of massive flaming fireball, spiral flames and ember trail, impact energy'],
  ['card_arrow_rain', 'cards', '192x160 game card art of rain of sharp arrows falling from above, stormy dark sky, bright metal arrowheads'],
  ['card_blizzard', 'cards', '192x160 game card art of blizzard vortex, swirling snow, blue white ice shards, freezing wind spiral'],
  ['card_bomb', 'cards', '192x160 game card art of round black bomb with lit fuse, sparks and imminent explosion glow'],
  ['card_emergency_shield', 'cards', '192x160 game card art of red crystal protected by blue shield bubble, hexagonal barrier pattern'],
  ['card_arrow_boost', 'cards', '192x160 game card art of single arrow empowered by green magical runes, precision aura'],
  ['card_shield_boost', 'cards', '192x160 game card art of golden reinforced shield, radiant protective ward, sturdy dark metal rim'],
  ['card_gold_rush', 'cards', '192x160 game card art of pile of gold coins sparkling, dark fantasy treasure glow, bouncing coin shapes'],
  ['card_speed_boost', 'cards', '192x160 game card art of boots surrounded by cyan wind trails, swift movement effect, curved speed lines'],
  ['card_gold_mine', 'cards', '192x160 game card art of small dark gold mine building, glowing ore vein, mine cart silhouette'],
  ['card_energy_tower', 'cards', '192x160 game card art of arcane energy tower, blue violet crystal battery, pulsing mana ring'],

  // P0 tiles.
  ['tile_meadow_buildable', 'tiles', seamlessTile('dark rainy grass tile with short moss and wet highlights')],
  ['tile_meadow_path', 'tiles', seamlessTile('muddy brown path tile with puddles and worn footprints, path texture flows continuously across all four edges')],
  ['tile_meadow_obstacle', 'tiles', seamlessTile('dark wet rock and thorn bush obstacle ground, no large object cut off at the edges')],
  ['tile_desert_buildable', 'tiles', seamlessTile('dark golden sand tile with sparse cracked texture')],
  ['tile_desert_path', 'tiles', seamlessTile('packed desert road tile with worm track marks, path texture flows continuously across all four edges')],
  ['tile_desert_obstacle', 'tiles', seamlessTile('sandstone rock and insect burrow obstacle ground, no large object cut off at the edges')],
  ['tile_castle_buildable', 'tiles', seamlessTile('cold grey stone courtyard tile with moss cracks')],
  ['tile_castle_path', 'tiles', seamlessTile('dark slate path tile, worn gothic stone slabs, path texture flows continuously across all four edges')],
  ['tile_castle_obstacle', 'tiles', seamlessTile('black ruined wall rubble obstacle ground, no large object cut off at the edges')],
  ['tile_wasteland_buildable', 'tiles', seamlessTile('charcoal wasteland ground tile with red ash dust')],
  ['tile_wasteland_path', 'tiles', seamlessTile('cracked asphalt road tile with dark red dirt, path texture flows continuously across all four edges')],
  ['tile_wasteland_obstacle', 'tiles', seamlessTile('rusted metal debris and broken concrete obstacle ground, no large object cut off at the edges')],
  ['tile_abyss_buildable', 'tiles', seamlessTile('dark purple void stone tile with faint violet cracks')],
  ['tile_abyss_path', 'tiles', seamlessTile('black violet rift path tile with glowing edge fissures, path texture flows continuously across all four edges')],
  ['tile_abyss_obstacle', 'tiles', seamlessTile('jagged abyss crystal and void rock obstacle ground, no large object cut off at the edges')],
  ...pathConnectorAssets('meadow', 'muddy brown rainy grassland road with puddles'),
  ...pathConnectorAssets('desert', 'packed dark golden desert road with subtle worm tracks'),
  ...pathConnectorAssets('castle', 'dark gothic slate stone road with worn slabs'),
  ...pathConnectorAssets('wasteland', 'cracked asphalt road with dark red ash dirt'),
  ...pathConnectorAssets('abyss', 'black violet rift road with subtle glowing fissures'),

  // P1 backgrounds.
  ['bg_meadow', 'backgrounds', 'rainy night grassland battlefield, distant mountains, low heavy clouds, low contrast center area for gameplay readability, stronger atmosphere at edges', '16:9'],
  ['bg_desert', 'backgrounds', 'dark gold desert battlefield, heat haze, dunes, insect burrow silhouettes, low contrast center area for gameplay readability', '16:9'],
  ['bg_castle', 'backgrounds', 'gothic ruined castle battlefield at night, crescent moon, fog, dead trees, low contrast center area for gameplay readability', '16:9'],
  ['bg_wasteland', 'backgrounds', 'post apocalyptic red mist battlefield, broken city skyline, smoke columns, low contrast center area for gameplay readability', '16:9'],
  ['bg_abyss', 'backgrounds', 'purple black void abyss battlefield, floating rocks, violet rift glow, low contrast center area for gameplay readability', '16:9'],

  // P1 buffs.
  ['buff_sharpshooter', 'buffs', 'two crossed arrows with cyan speed trails, dark fantasy buff icon'],
  ['buff_ice_heart', 'buffs', 'blue frozen heart crystal, frost aura, dark fantasy buff icon'],
  ['buff_flame_power', 'buffs', 'burning orange flame core, ember burst, dark fantasy buff icon'],
  ['buff_iron_wall', 'buffs', 'black iron wall shield, rivets, sturdy defensive icon'],
  ['buff_quick_march', 'buffs', 'marching boot with green wind trail, speed buff icon'],
  ['buff_gold_reserve', 'buffs', 'dark leather coin pouch spilling gold coins, economy buff icon'],
  ['buff_reinforced_arrow', 'buffs', 'reinforced arrowhead with blue rune glow, range buff icon'],
  ['buff_magic_surge', 'buffs', 'purple mana surge spiral, arcane energy icon'],
  ['buff_double_bounty', 'buffs', 'two gold coins with dark gold glow, bounty buff icon'],
  ['buff_unbreakable_wall', 'buffs', 'large unbroken shield with crack marks and golden glow'],
  ['buff_arcane_wisdom', 'buffs', 'open arcane book with purple light, wisdom buff icon'],
  ['buff_tactical_master', 'buffs', 'tactical board with four small cards, strategy buff icon, no text'],

  // P1 VFX.
  ['fx_fire_explosion_charge_0', 'fx', 'orange red fire spell charging orb, ember particles, transparent background'],
  ['fx_fire_explosion_impact_1', 'fx', 'orange red fire explosion ring, ember particles, transparent background'],
  ['fx_arrow_rain_impact_1', 'fx', 'multiple arrow impact streaks, sharp white motion trails, transparent background'],
  ['fx_ice_burst_impact_1', 'fx', 'blue white frost burst, ice shard circle, snow mist, transparent background'],
  ['fx_bomb_explosion_impact_1', 'fx', 'dark smoke and orange blast, chunky stylized explosion, transparent background'],
  ['fx_poison_cloud_loop_0', 'fx', 'sickly green poison cloud, bubbling droplets, soft edge transparent background'],
  ['fx_lightning_chain_loop_0', 'fx', 'yellow lightning bolt chain, sharp electric arcs, transparent background'],
  ['fx_laser_beam_loop_0', 'fx', 'cyan purple horizontal laser beam, bright core and soft glow, transparent background'],
  ['fx_magic_shield_loop_0', 'fx', 'blue magic shield bubble, hexagonal shimmer, transparent background'],
  ['fx_heal_aura_loop_0', 'fx', 'soft golden healing particles, upward motes, circular aura, transparent background'],
].map((asset) => Array.isArray(asset) ? expandTuple(asset) : asset);

function seamlessTile(subject) {
  return `${subject}, top-down square seamless tile texture, continuous edges on all four sides, tileable 3x3 without visible seams, low detail, no border line, no isolated object cut off at edges`;
}

function pathConnectorAssets(theme, material) {
  const connectors = [
    ['straight_h', 'horizontal straight path; connected edges: west and east; north and south edges are normal ground'],
    ['straight_v', 'vertical straight path; connected edges: north and south; west and east edges are normal ground'],
    ['corner_ne', 'corner path; connected edges: north and east; south and west edges are normal ground'],
    ['corner_es', 'corner path; connected edges: east and south; north and west edges are normal ground'],
    ['corner_sw', 'corner path; connected edges: south and west; north and east edges are normal ground'],
    ['corner_wn', 'corner path; connected edges: west and north; east and south edges are normal ground'],
    ['tee_n', 'three-way path; connected edges: west, east, and south; north edge is normal ground'],
    ['tee_e', 'three-way path; connected edges: north, south, and west; east edge is normal ground'],
    ['tee_s', 'three-way path; connected edges: west, east, and north; south edge is normal ground'],
    ['tee_w', 'three-way path; connected edges: north, south, and east; west edge is normal ground'],
    ['cross', 'crossroad path; connected edges: north, east, south, and west'],
    ['endpoint_spawn', 'enemy spawn endpoint; exactly one connected edge at the path exit; portal sits outside the path flow and does not interrupt the connection'],
    ['endpoint_crystal', 'crystal base endpoint; exactly one connected edge at the path entrance; crystal base sits outside the path flow and does not cover the connection'],
  ];
  return connectors.map(([id, connector]) => [
    `tile_${theme}_path_${id}`,
    'tiles',
    `${material}, ${connector}, top-down square path connector tile, path centerline meets the exact center of every connected edge, all connected edges use the same path width, same edge wear and same material color as other ${theme} path tiles, unconnected edges must not show path texture, connected edges align seamlessly with matching path tiles, no hard seam, no border line, no text`,
  ]);
}

function expandTuple(tuple) {
  const [id, type, prompt, aspectRatio] = tuple;
  const transparent = !id.startsWith('bg_') && !id.startsWith('tile_') && type !== 'cards';
  const extension = id.startsWith('bg_') ? 'webp' : 'png';
  return {
    id,
    priority: id.startsWith('bg_') || id.startsWith('buff_') || id.startsWith('fx_') ? 'P1' : 'P0',
    type,
    output: `public/art/${type}/${id}.${extension}`,
    size: id.startsWith('bg_') ? undefined : '1024x1024',
    aspectRatio,
    transparent,
    prompt,
  };
}

function readProgress() {
  if (!existsSync(PROGRESS_PATH)) {
    return {
      version: 1,
      modelLock: MODEL_LOCK,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totals: {},
      assets: assets.map((asset) => ({
        id: asset.id,
        output: asset.output,
        priority: asset.priority,
        type: asset.type,
        model: MODEL_LOCK,
        status: existsSync(resolve(ROOT, asset.output)) ? 'done' : 'pending',
        attempts: 0,
      })),
    };
  }
  const progress = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'));
  if (progress.modelLock !== MODEL_LOCK) {
    throw new Error(`Model lock mismatch: progress=${progress.modelLock}, script=${MODEL_LOCK}`);
  }
  const existing = new Map(progress.assets.map((item) => [item.id, item]));
  for (const asset of assets) {
    if (!existing.has(asset.id)) {
      progress.assets.push({
        id: asset.id,
        output: asset.output,
        priority: asset.priority,
        type: asset.type,
        model: MODEL_LOCK,
        status: existsSync(resolve(ROOT, asset.output)) ? 'done' : 'pending',
        attempts: 0,
      });
    }
  }
  return progress;
}

function writeProgress(progress) {
  const counts = {};
  for (const item of progress.assets) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  progress.totals = counts;
  progress.updatedAt = new Date().toISOString();
  writeFileSync(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`);
}

function buildPrompt(asset) {
  const transparency = asset.transparent
    ? 'Transparent background, no cast shadow, no contact shadow, no floor plane.'
    : 'No transparent background needed.';
  return `${STYLE_PREFIX}. Asset id: ${asset.id}. Primary request: ${asset.prompt}. ${transparency} Avoid: ${NEGATIVE_PROMPT}.`;
}

function generate(asset) {
  const outPath = resolve(ROOT, asset.output);
  mkdirSync(dirname(outPath), { recursive: true });
  const args = ['generate', 'image', buildPrompt(asset), '--model', MODEL_LOCK, '-o', outPath];
  if (asset.size) args.push('--size', asset.size);
  if (asset.aspectRatio) args.push('--aspect-ratio', asset.aspectRatio);
  if (asset.transparent) {
    args.push('--background', 'transparent', '--output-format', 'png');
  } else if (asset.id.startsWith('bg_')) {
    args.push('--output-format', 'webp');
  }
  const result = spawnSync('animal-mediakit', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: result.status === 0 && existsSync(outPath),
    status: result.status,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  };
}

function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const priorityArg = process.argv.find((arg) => arg.startsWith('--priority='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 5;
  const priority = priorityArg ? priorityArg.split('=')[1] : undefined;
  const progress = readProgress();
  writeProgress(progress);

  let generated = 0;
  for (const asset of assets) {
    const item = progress.assets.find((candidate) => candidate.id === asset.id);
    if (!item) continue;
    if (priority && item.priority !== priority) continue;
    if (item.status === 'done' && existsSync(resolve(ROOT, item.output))) continue;
    if (generated >= limit) break;

    item.status = 'running';
    item.model = MODEL_LOCK;
    item.startedAt = new Date().toISOString();
    item.prompt = buildPrompt(asset);
    writeProgress(progress);

    console.log(`[generate] ${asset.id} -> ${asset.output}`);
    const result = generate(asset);
    item.attempts = (item.attempts ?? 0) + 1;
    item.finishedAt = new Date().toISOString();
    item.lastStdout = result.stdout.slice(-2000);
    item.lastStderr = result.stderr.slice(-2000);
    item.status = result.ok ? 'done' : 'failed';
    item.error = result.ok ? undefined : `animal-mediakit exited with status ${result.status}`;
    writeProgress(progress);

    if (!result.ok) {
      console.error(`[failed] ${asset.id}: ${item.error}`);
      console.error(item.lastStderr || item.lastStdout);
      process.exitCode = 1;
      return;
    }
    generated += 1;
  }

  if (generated === 0) {
    console.log(priority ? `No pending assets for ${priority}.` : 'No pending assets.');
  } else {
    console.log(`Generated ${generated} asset(s) with ${MODEL_LOCK}.`);
  }
}

main();
