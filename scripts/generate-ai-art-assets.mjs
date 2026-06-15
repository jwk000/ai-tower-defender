#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

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
    id: 'ui_hand_panel',
    priority: 'P0',
    type: 'ui',
    output: 'public/art/ui/ui_hand_panel.png',
    size: '1536x1024',
    transparent: true,
    prompt: 'dark fantasy casual tower defense UI hand card tray background, long low horizontal base plate for five cards, lightweight translucent black iron and dark navy surface, very simple clean shape, subtle beveled rim, thin muted blue grey border, soft inner shadow, no ornate corners, no gold decoration, no runes, no icons, no text, no numbers, no card slots',
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

  // P0 enemy codex portraits.
  ...enemyPortraitAssets(),

  // P0 scene unit sprites.
  ...sceneUnitSpriteAssets(),

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
  ...pathEndpointAssets('meadow', 'muddy brown rainy grassland road with puddles'),
  ...pathEndpointAssets('desert', 'packed dark golden desert road with subtle worm tracks'),
  ...pathEndpointAssets('castle', 'dark gothic slate stone road with worn slabs'),
  ...pathEndpointAssets('wasteland', 'cracked asphalt road with dark red ash dirt'),
  ...pathEndpointAssets('abyss', 'black violet rift road with subtle glowing fissures'),
  ...sceneDecorSpriteAssets(),

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

function pathEndpointAssets(theme, material) {
  const endpoints = [
    ['endpoint_spawn', 'enemy spawn endpoint; exactly one connected edge at the path exit; portal sits outside the path flow and does not interrupt the connection'],
    ['endpoint_crystal', 'crystal base endpoint; exactly one connected edge at the path entrance; crystal base sits outside the path flow and does not cover the connection'],
  ];
  return endpoints.map(([id, endpoint]) => [
    `tile_${theme}_path_${id}`,
    'tiles',
    `${material}, ${endpoint}, top-down square endpoint tile, same uniform color and material as the directionless ${theme} path tile, soft blend into nearby path tiles, no hard seam, no border line, no text`,
  ]);
}

function sceneDecorSpriteAssets() {
  const commonDecor = [
    ['meadow', 'tree', 'gnarled dark green fantasy tree with wet bark and compact leafy crown'],
    ['meadow', 'bush', 'round dark green thorn bush cluster with wet leaf highlights'],
    ['meadow', 'flower', 'small pink wildflower cluster with dark leaves'],
    ['desert', 'rock', 'dark sandstone rock cluster with cracked faces'],
    ['desert', 'cactus', 'dark green cactus with two arms and small pale thorns'],
    ['desert', 'bones', 'bleached animal bones half buried in sand, readable simple shape'],
    ['desert', 'sand_dune', 'small crescent sand dune mound with dark golden rim'],
    ['desert', 'tunnel_entrance', 'round insect tunnel entrance with dark hole and sandy chitin rim'],
    ['desert', 'tunnel_exit', 'round insect tunnel exit with cracked sand and faint amber glow'],
    ['castle', 'pillar', 'broken gothic stone pillar with moss cracks'],
    ['castle', 'brazier', 'black iron gothic brazier with orange flame'],
    ['castle', 'rubble', 'small pile of dark castle stone rubble'],
    ['castle', 'dead_tree', 'leafless twisted dead tree with grey bark'],
    ['castle', 'wall', 'broken dark stone wall segment with jagged top'],
    ['wasteland', 'pillar', 'broken concrete pillar with blackened cracks and red ash'],
    ['wasteland', 'car', 'rusted broken compact car wreck with charcoal metal and red dust'],
    ['wasteland', 'rubble', 'wasteland concrete rubble pile with rusted rebar'],
    ['wasteland', 'scorched_tree', 'burned leafless tree stump with charcoal branches and ember cracks'],
    ['wasteland', 'volcanic_rock', 'charcoal volcanic rock with red ash cracks'],
    ['wasteland', 'lava_vent', 'small cracked lava vent with orange ember glow'],
    ['abyss', 'floating_rock', 'floating jagged void rock with violet rim light'],
    ['abyss', 'purple_flame', 'small black stone pedestal with purple flame'],
    ['abyss', 'crystal_obstacle', 'dark violet crystal cluster with pale purple highlights'],
    ['abyss', 'void_rift', 'small vertical purple black void rift energy crack'],
    ['abyss', 'reality_warp', 'compact circular reality warp distortion with violet core'],
  ];

  return commonDecor.flatMap(([theme, decorId, subject]) => {
    const variantCount = decorVariantCount(decorId);
    return Array.from({ length: variantCount }, (_, variant) => ({
      id: `decor_${theme}_${decorId}_idle_${variant}`,
      priority: 'P0',
      type: 'decor',
      output: `public/art/decor/decor_${theme}_${decorId}_idle_${variant}.png`,
      size: '1024x1024',
      transparent: true,
      prompt: [
        `${subject}, static battlefield decoration sprite`,
        `static appearance variant ${variant + 1} of ${variantCount}, same object identity, not an animation frame`,
        'single complete object, no animation frame sheet, no sequence frame, no timeline motion',
        '3/4 top-down tower defense view, centered object, fits inside one 64x64 grid tile',
        'transparent background, no ground tile, no cast shadow, no frame',
      ].join(', '),
    }));
  });
}

function decorVariantCount(decorId) {
  return {
    tree: 2,
    bush: 2,
    flower: 2,
    cactus: 2,
    tunnel_entrance: 3,
    tunnel_exit: 3,
    brazier: 3,
    dead_tree: 2,
    scorched_tree: 2,
    lava_vent: 4,
    floating_rock: 2,
    purple_flame: 3,
    crystal_obstacle: 2,
    void_rift: 4,
    reality_warp: 4,
  }[decorId] ?? 1;
}

function enemyPortraitAssets() {
  const enemies = [
    ['goblin', 'red goblin raider, sharp ears, small rusty dagger, mischievous grin'],
    ['boar', 'wild armored boar, heavy tusks, charging pose, brown bristles'],
    ['elephant', 'iron armored elephant, thick plates, heavy trunk, slow tank silhouette'],
    ['giant', 'grassland giant brute, huge fists, mossy shoulder stones, massive readable body'],
    ['desert_beetle', 'black desert beetle, sandy shell, small mandibles, insect legs tucked in'],
    ['burrow_beetle', 'burrowing beetle, thick chitin drill horn, earth dust, sturdy shell'],
    ['locust', 'bloodsucking locust, thin wings, long legs, lime green highlights'],
    ['bomb_beetle', 'explosive beetle, orange glowing abdomen, danger sparks, round chitin body'],
    ['werewolf', 'dark werewolf, hunched pose, claws, brown fur, moonlit rim light'],
    ['vampire_bat', 'vampire bat, purple wings spread, red eyes, small fangs'],
    ['wizard', 'dark wizard enemy, purple hood, crooked staff, arcane orb glow'],
    ['priest', 'dark priest enemy, pale robe, black halo, cursed healing staff'],
    ['frankenstein', 'green stitched monster, bulky shoulders, metal bolts, slow heavy pose'],
    ['plane', 'wasteland attack plane, chunky stylized fuselage, red warning light, stub wings'],
    ['tank', 'dark compact tank, heavy treads, large cannon, charcoal armor'],
    ['oil_truck', 'rusty oil truck, round tank trailer, orange hazard glow, compact toy-like shape'],
    ['robot_dog', 'mechanical dog, angular metal legs, red sensor eye, fast low silhouette'],
    ['giant_robot', 'giant robot enemy, broad metal torso, glowing furnace core, heavy arms'],
    ['drone', 'small attack drone, cyan lens, four rotors, dark metal shell'],
    ['giant_slime', 'giant slime boss, green translucent blob, crown-like spikes, huge cute menacing shape'],
    ['queen_beetle', 'beetle queen boss, red royal chitin, large mandibles, crown horn, many legs'],
    ['lucifer', 'dark demon lord boss, red black horns, bat wings, ember aura, not gore'],
    ['super_robot', 'super robot boss, huge black steel body, red core, missile pods, massive silhouette'],
    ['abyss_lord', 'abyss lord boss, purple void armor, single glowing eye, tentacle-like cloak, eldritch but readable'],
  ];
  return enemies.map(([id, prompt]) => [
    `enemy_${id}`,
    'enemies',
    `transparent-background enemy codex portrait, centered full-body ${prompt}, dark fantasy casual tower defense style, simple pose, no ground, no shadow, no frame`,
  ]);
}

function sceneUnitSpriteAssets() {
  const units = [
    ['tower_arrow', '128x128 arrow tower scene sprite, compact wooden and black iron base, twin bow arms, cyan arrow tip'],
    ['tower_cannon', '128x128 cannon tower scene sprite, squat black iron cannon base, round barrel, orange ember muzzle'],
    ['tower_ice', '128x128 ice tower scene sprite, jagged blue crystal spire, frost mist, readable silhouette'],
    ['tower_lightning', '128x128 lightning tower scene sprite, copper coil antenna, yellow electric arcs, dark base'],
    ['tower_laser', '128x128 laser tower scene sprite, cyan crystal core, purple lens, angular dark metal base'],
    ['tower_bat', '128x128 gothic bat tower scene sprite, purple bat wing roof, red eye core'],
    ['tower_missile', '128x128 missile tower scene sprite, dark launch tubes, small red missile tips, orange ignition glow'],
    ['tower_fire', '128x128 fire tower scene sprite, stacked flame brazier, molten dark base, ember sparks'],
    ['tower_poison', '128x128 poison tower scene sprite, green venom bulb, alchemy glass, toxic drops'],
    ['tower_ballista', '128x128 ballista tower scene sprite, heavy crossbow arms, blue siege bolt, dark wood frame'],
    ['shield_guard', '128x128 shield guard scene sprite, armored defender, large cyan shield, short sword'],
    ['swordsman', '128x128 swordsman scene sprite, red steel accents, broad stance, raised long sword'],
    ['archer', '128x128 archer scene sprite, green hood, bow drawn, slim agile stance'],
    ['priest', '128x128 priest scene sprite, pale robe, golden healing staff, soft holy glow'],
    ['engineer', '128x128 engineer scene sprite, orange hard hat, wrench, little gear backpack'],
    ['assassin', '128x128 assassin scene sprite, dark cloak, twin purple daggers, crouched stealth pose'],
    ['mage', '128x128 mage scene sprite, purple robe, glowing staff crystal, small arcane orb'],
    ['spike_trap', '96x96 spike trap scene sprite, three dark metal spikes emerging from cracked plate'],
    ['bear_trap', '96x96 bear trap scene sprite, open jagged metal jaws, central trigger plate'],
    ['tar_pit', '96x96 tar pit scene sprite, bubbling black sticky puddle, dark oily rim'],
    ['boulder', '96x96 boulder obstacle scene sprite, cracked grey rock, heavy rounded silhouette'],
    ['gold_mine', '128x128 gold mine building scene sprite, dark mine entrance, glowing ore vein, cart'],
    ['energy_tower', '128x128 energy tower building scene sprite, blue violet crystal battery, pulsing mana ring'],
    ...enemySceneSubjects(),
  ];
  const states = ['idle_0', 'idle_1'];
  return units.flatMap(([id, prompt]) => states.map((state) => {
    const frame = state.endsWith('_1') ? 1 : 0;
    const motion = frame === 0
      ? 'animation frame 1 of 2, neutral idle pose'
      : 'animation frame 2 of 2, same design, tiny breathing pose change, slightly shifted arms or glow only';
    return {
      id: `unit_${id}_${state}`,
      priority: 'P0',
      type: 'units',
      output: `public/art/units/unit_${id}_idle_${frame}.png`,
      size: '1024x1024',
      transparent: true,
      prompt: `${prompt}, ${motion}, 3/4 top-down tower defense battlefield sprite, centered full body, transparent background, no ground, no shadow, no frame`,
    };
  }));
}

function enemySceneSubjects() {
  return [
    ['enemy_goblin', '96x96 red goblin raider scene sprite, sharp ears, rusty dagger, compact body'],
    ['enemy_boar', '96x96 wild armored boar scene sprite, heavy tusks, brown bristles, charging-ready pose'],
    ['enemy_elephant', '128x128 iron armored elephant scene sprite, thick plates, heavy trunk, tank silhouette'],
    ['enemy_giant', '128x128 grassland giant brute scene sprite, huge fists, mossy shoulder stones'],
    ['enemy_desert_beetle', '96x96 black desert beetle scene sprite, sandy shell, mandibles, small legs'],
    ['enemy_burrow_beetle', '96x96 burrowing beetle scene sprite, drill horn, thick chitin shell'],
    ['enemy_locust', '96x96 bloodsucking locust scene sprite, thin wings, long legs, lime highlights'],
    ['enemy_bomb_beetle', '96x96 explosive beetle scene sprite, orange glowing abdomen, danger sparks'],
    ['enemy_werewolf', '128x128 dark werewolf scene sprite, hunched claws, brown fur, moonlit rim light'],
    ['enemy_vampire_bat', '96x96 vampire bat scene sprite, purple wings spread, red eyes, tiny fangs'],
    ['enemy_wizard', '96x96 dark wizard enemy scene sprite, purple hood, crooked staff, arcane orb'],
    ['enemy_priest', '96x96 dark priest enemy scene sprite, pale robe, black halo, cursed staff'],
    ['enemy_frankenstein', '128x128 green stitched monster scene sprite, bulky shoulders, metal bolts'],
    ['enemy_plane', '128x128 wasteland attack plane scene sprite, chunky fuselage, red warning light'],
    ['enemy_tank', '128x128 dark compact tank scene sprite, heavy treads, large cannon, charcoal armor'],
    ['enemy_oil_truck', '128x128 rusty oil truck scene sprite, round tank trailer, orange hazard glow'],
    ['enemy_robot_dog', '96x96 mechanical dog scene sprite, angular legs, red sensor eye, low fast silhouette'],
    ['enemy_giant_robot', '128x128 giant robot enemy scene sprite, metal torso, glowing furnace core, heavy arms'],
    ['enemy_drone', '96x96 small attack drone scene sprite, cyan lens, four rotors, dark metal shell'],
    ['enemy_giant_slime', '192x192 giant slime boss scene sprite, green translucent blob, crown-like spikes'],
    ['enemy_queen_beetle', '192x192 beetle queen boss scene sprite, red royal chitin, crown horn, many legs'],
    ['enemy_lucifer', '192x192 dark demon lord boss scene sprite, red black horns, bat wings, ember aura'],
    ['enemy_super_robot', '192x192 super robot boss scene sprite, huge black steel body, red core, missile pods'],
    ['enemy_abyss_lord', '192x192 abyss lord boss scene sprite, purple void armor, single glowing eye, tentacle-like cloak'],
  ];
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
    size: id.startsWith('bg_') ? '1920x1088' : '1024x1024',
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
  const isBackground = asset.id.startsWith('bg_');
  const rawOutPath = isBackground
    ? resolve(ROOT, 'tmp', 'ai-backgrounds', `${basename(asset.output, '.webp')}_raw.png`)
    : outPath;
  if (isBackground) mkdirSync(dirname(rawOutPath), { recursive: true });

  const args = ['generate', 'image', buildPrompt(asset), '--model', MODEL_LOCK, '-o', rawOutPath];
  if (asset.size) args.push('--size', asset.size);
  if (asset.aspectRatio && !isBackground) args.push('--aspect-ratio', asset.aspectRatio);
  if (asset.transparent) {
    args.push('--background', 'transparent', '--output-format', 'png');
  }
  const result = spawnSync('animal-mediakit', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = result.stderr?.trim() ?? '';
  let ok = result.status === 0 && existsSync(rawOutPath);
  if (ok && isBackground) {
    const convert = spawnSync('magick', [
      rawOutPath,
      '-gravity', 'center',
      '-crop', '1920x1080+0+0',
      '+repage',
      '-quality', '82',
      '-define', 'webp:method=6',
      outPath,
    ], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    ok = convert.status === 0 && existsSync(outPath);
    stderr = [stderr, convert.stderr?.trim()].filter(Boolean).join('\n');
    if (ok) rmSync(rawOutPath, { force: true });
  }

  return {
    ok,
    status: result.status,
    stdout: result.stdout?.trim() ?? '',
    stderr,
  };
}

function main() {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const priorityArg = process.argv.find((arg) => arg.startsWith('--priority='));
  const typeArg = process.argv.find((arg) => arg.startsWith('--type='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 5;
  const priority = priorityArg ? priorityArg.split('=')[1] : undefined;
  const type = typeArg ? typeArg.split('=')[1] : undefined;
  const progress = readProgress();
  writeProgress(progress);

  let generated = 0;
  for (const asset of assets) {
    const item = progress.assets.find((candidate) => candidate.id === asset.id);
    if (!item) continue;
    if (priority && item.priority !== priority) continue;
    if (type && item.type !== type) continue;
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
    const filters = [priority, type].filter(Boolean).join(' / ');
    console.log(filters ? `No pending assets for ${filters}.` : 'No pending assets.');
  } else {
    console.log(`Generated ${generated} asset(s) with ${MODEL_LOCK}.`);
  }
}

main();
