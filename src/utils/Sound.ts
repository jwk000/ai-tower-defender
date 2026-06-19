import { getSynthUrl } from './SoundSynth.js';

export type SfxKey =
  // ═══ Legacy (5 keys — audio files need replacement for style consistency) ═══
  | 'tower_shoot'   // fallback when towerTypeVal out of range (rarely hit)
  | 'enemy_death'   // generic enemy death — synth explosion style
  | 'build_place'   // building/unit placement confirm — mechanical lock clunk
  | 'wave_start'    // wave start alarm/horn
  | 'defeat'        // defeat descending melody
  // Tower attack sounds (10 types — fire/poison/ballista synth-only)
  | 'tower_arrow'
  | 'tower_cannon'
  | 'tower_ice'
  | 'tower_lightning'
  | 'tower_laser'
  | 'tower_bat'
  | 'tower_missile'
  | 'tower_fire'
  | 'tower_poison'
  | 'tower_ballista'
  // Projectile hit sounds (8 types)
  | 'arrow_hit'
  | 'cannon_hit'
  | 'ice_hit'
  | 'lightning_hit'
  | 'missile_impact'
  | 'fire_hit'
  | 'poison_hit'
  | 'ballista_hit'
  // Game phase events
  | 'victory'
  | 'victory_meadow'
  | 'victory_desert'
  | 'victory_castle'
  | 'victory_waste'
  | 'victory_abyss'
  | 'wave_clear'
  | 'wave_boss'
  | 'countdown_tick'
  | 'countdown_go'
  // UI & building
  | 'ui_click'
  | 'ui_error'
  | 'build_deny'
  | 'upgrade'
  | 'sell'
  // Enemy events
  | 'enemy_spawn'
  | 'enemy_hit'
  | 'boss_phase2'
  | 'exploder_boom'
  | 'base_hit'
  // Economy
  | 'gold_earn'
  | 'gold_spend'
  // Skills (6 total)
  | 'skill_taunt'
  | 'skill_whirlwind'
  | 'skill_fireball'
  | 'skill_arrow_rain'
  | 'skill_blizzard'
  | 'skill_bomb'
  | 'skill_earthquake'
  // Arcane cards (3 total)
  | 'arcane_shield'
  | 'arcane_boost'
  | 'arcane_gold'
  // Status effects (4 total)
  | 'freeze_apply'
  | 'stun_apply'
  | 'poison_tick'
  | 'burn_tick'
  // Soldier events (3 total)
  | 'soldier_deploy'
  | 'soldier_death'
  | 'soldier_heal'
  // Weather
  | 'weather_change'
  // Enemy attack
  | 'enemy_attack'
  | 'mage_attack'
  // v3.0 CardDraft & BuffSelection
  | 'draft_select'
  | 'buff_select'
  // v3.0 Boss abilities
  | 'boss_split'
  | 'boss_summon'
  | 'boss_devour'
  | 'boss_missile'
  | 'boss_enter_slime'
  | 'boss_enter_beetle'
  | 'boss_enter_lucifer'
  | 'boss_enter_robot'
  | 'boss_enter_abyss'
  | 'boss_death_heavy'
  | 'boss_death_void'
  | 'boss_missile_warning'
  | 'boss_missile_impact'
  | 'boss_devour_cast'
  | 'boss_devour_impact'
  | 'boss_summon_insect'
  | 'boss_summon_undead'
  | 'boss_summon_machine'
  | 'boss_summon_void'
  | 'boss_phase_ice'
  | 'boss_phase_void'
  | 'boss_phase_enrage'
  | 'enemy_death_heavy'
  | 'enemy_death_magic'
  | 'enemy_death_machine'
  | 'enemy_death_flying'
  | 'enemy_spawn_flying'
  | 'enemy_spawn_machine'
  | 'enemy_spawn_undead'
  // Level intro
  | 'intro_tile_drop'
  | 'intro_path_break';

/** Vite base URL — adapts to deployment path (/, /repo-name/, etc.) */
const BASE = import.meta.env.BASE_URL;

/** Resolve a relative SFX path to a full URL matching the current base. */
function sfxUrl(key: SfxKey): string {
  const path = SFX_PATH[key].replace(/^\//, '');
  return `${BASE}${path}`;
}

/**
 * Keys that have NO OGG audio file and rely entirely on SoundSynth.
 * All current runtime SFX keys have a corresponding .ogg file in public/sfx/.
 */
const SYNTH_ONLY_KEYS: ReadonlySet<SfxKey> = new Set<SfxKey>();

const SFX_PATH: Record<SfxKey, string> = {
  // Legacy
  tower_shoot: '/sfx/tower_shoot.ogg',
  enemy_death: '/sfx/enemy_death.ogg',
  build_place: '/sfx/build_place.ogg',
  wave_start: '/sfx/wave_start.ogg',
  defeat: '/sfx/defeat.ogg',
  // Tower attack
  tower_arrow: '/sfx/tower_arrow.ogg',
  tower_cannon: '/sfx/tower_cannon.ogg',
  tower_ice: '/sfx/tower_ice.ogg',
  tower_lightning: '/sfx/tower_lightning.ogg',
  tower_laser: '/sfx/tower_laser.ogg',
  tower_bat: '/sfx/tower_bat.ogg',
  tower_missile: '/sfx/tower_missile.ogg',
  // Projectile hits
  arrow_hit: '/sfx/arrow_hit.ogg',
  cannon_hit: '/sfx/cannon_hit.ogg',
  ice_hit: '/sfx/ice_hit.ogg',
  lightning_hit: '/sfx/lightning_hit.ogg',
  missile_impact: '/sfx/missile_impact.ogg',
  // Game phase
  victory: '/sfx/victory.ogg',
  victory_meadow: '/sfx/victory_meadow.ogg',
  victory_desert: '/sfx/victory_desert.ogg',
  victory_castle: '/sfx/victory_castle.ogg',
  victory_waste: '/sfx/victory_waste.ogg',
  victory_abyss: '/sfx/victory_abyss.ogg',
  wave_clear: '/sfx/wave_clear.ogg',
  wave_boss: '/sfx/wave_boss.ogg',
  countdown_tick: '/sfx/countdown_tick.ogg',
  countdown_go: '/sfx/countdown_go.ogg',
  // UI & building
  ui_click: '/sfx/ui_click.ogg',
  ui_error: '/sfx/ui_error.ogg',
  build_deny: '/sfx/build_deny.ogg',
  upgrade: '/sfx/upgrade.ogg',
  sell: '/sfx/sell.ogg',
  // Enemy
  enemy_spawn: '/sfx/enemy_spawn.ogg',
  enemy_hit: '/sfx/enemy_hit.ogg',
  boss_phase2: '/sfx/boss_phase2.ogg',
  exploder_boom: '/sfx/exploder_boom.ogg',
  base_hit: '/sfx/base_hit.ogg',
  // Economy
  gold_earn: '/sfx/gold_earn.ogg',
  gold_spend: '/sfx/gold_spend.ogg',
  // Skills
  skill_taunt: '/sfx/skill_taunt.ogg',
  skill_whirlwind: '/sfx/skill_whirlwind.ogg',
  // Weather
  weather_change: '/sfx/weather_change.ogg',
  // Enemy attack
  enemy_attack: '/sfx/enemy_attack.ogg',
  mage_attack: '/sfx/mage_attack.ogg',
  // v3.0 CardDraft & BuffSelection
  draft_select: '/sfx/draft_select.ogg',
  buff_select: '/sfx/buff_select.ogg',
  // v3.0 Boss abilities
  boss_split: '/sfx/boss_split.ogg',
  boss_summon: '/sfx/boss_summon.ogg',
  boss_devour: '/sfx/boss_devour.ogg',
  boss_missile: '/sfx/boss_missile.ogg',
  boss_enter_slime: '/sfx/boss_enter_slime.ogg',
  boss_enter_beetle: '/sfx/boss_enter_beetle.ogg',
  boss_enter_lucifer: '/sfx/boss_enter_lucifer.ogg',
  boss_enter_robot: '/sfx/boss_enter_robot.ogg',
  boss_enter_abyss: '/sfx/boss_enter_abyss.ogg',
  boss_death_heavy: '/sfx/boss_death_heavy.ogg',
  boss_death_void: '/sfx/boss_death_void.ogg',
  boss_missile_warning: '/sfx/boss_missile_warning.ogg',
  boss_missile_impact: '/sfx/boss_missile_impact.ogg',
  boss_devour_cast: '/sfx/boss_devour_cast.ogg',
  boss_devour_impact: '/sfx/boss_devour_impact.ogg',
  boss_summon_insect: '/sfx/boss_summon_insect.ogg',
  boss_summon_undead: '/sfx/boss_summon_undead.ogg',
  boss_summon_machine: '/sfx/boss_summon_machine.ogg',
  boss_summon_void: '/sfx/boss_summon_void.ogg',
  boss_phase_ice: '/sfx/boss_phase_ice.ogg',
  boss_phase_void: '/sfx/boss_phase_void.ogg',
  boss_phase_enrage: '/sfx/boss_phase_enrage.ogg',
  enemy_death_heavy: '/sfx/enemy_death_heavy.ogg',
  enemy_death_magic: '/sfx/enemy_death_magic.ogg',
  enemy_death_machine: '/sfx/enemy_death_machine.ogg',
  enemy_death_flying: '/sfx/enemy_death_flying.ogg',
  enemy_spawn_flying: '/sfx/enemy_spawn_flying.ogg',
  enemy_spawn_machine: '/sfx/enemy_spawn_machine.ogg',
  enemy_spawn_undead: '/sfx/enemy_spawn_undead.ogg',
  // Level intro
  intro_tile_drop: '/sfx/intro_tile_drop.ogg',
  intro_path_break: '/sfx/intro_path_break.ogg',
  // New tower attacks (synth-only, paths for type completeness)
  tower_fire: '/sfx/tower_fire.ogg',
  tower_poison: '/sfx/tower_poison.ogg',
  tower_ballista: '/sfx/tower_ballista.ogg',
  // New projectile hits (synth-only)
  fire_hit: '/sfx/fire_hit.ogg',
  poison_hit: '/sfx/poison_hit.ogg',
  ballista_hit: '/sfx/ballista_hit.ogg',
  // Skill cards (synth-only)
  skill_fireball: '/sfx/skill_fireball.ogg',
  skill_arrow_rain: '/sfx/skill_arrow_rain.ogg',
  skill_blizzard: '/sfx/skill_blizzard.wav',
  skill_bomb: '/sfx/skill_bomb.ogg',
  skill_earthquake: '/sfx/skill_earthquake.ogg',
  // Arcane cards (synth-only)
  arcane_shield: '/sfx/arcane_shield.ogg',
  arcane_boost: '/sfx/arcane_boost.ogg',
  arcane_gold: '/sfx/arcane_gold.ogg',
  // Status effects (synth-only)
  freeze_apply: '/sfx/freeze_apply.ogg',
  stun_apply: '/sfx/stun_apply.ogg',
  poison_tick: '/sfx/poison_tick.ogg',
  burn_tick: '/sfx/burn_tick.ogg',
  // Soldier events (synth-only)
  soldier_deploy: '/sfx/soldier_deploy.ogg',
  soldier_death: '/sfx/soldier_death.ogg',
  soldier_heal: '/sfx/soldier_heal.ogg',
};

const SFX_KEY_ALIASES: Readonly<Record<string, SfxKey>> = {
  SFX_ENEMY_DIE: 'enemy_death',
  SFX_ENEMY_SPAWN: 'enemy_spawn',
  SFX_BOSS_SPAWN: 'wave_boss',
  SFX_BOSS_DIE: 'victory',
  SFX_BOSS_PHASE2: 'boss_phase2',
  SFX_BOSS_PHASE3: 'boss_phase2',
  SFX_MAGIC_SHOOT: 'mage_attack',
  SFX_TRAP_TRIGGER: 'exploder_boom',
  SFX_CHEST_OPEN: 'gold_earn',
};

export function normalizeSfxKey(value: string): SfxKey | null {
  const fileMatch = value.match(/(?:^|\/)([a-z0-9_]+)\.(?:ogg|wav)$/);
  const key = fileMatch?.[1] ?? value;
  if (key in SFX_PATH) return key as SfxKey;
  return SFX_KEY_ALIASES[key] ?? null;
}

const PER_KEY_THROTTLE_MS: Partial<Record<SfxKey, number>> = {
  // Tower attacks — increased to reduce density when multiple towers fire
  tower_arrow: 80,
  tower_cannon: 120,
  tower_ice: 80,
  tower_lightning: 120,
  tower_laser: 150,
  tower_bat: 80,
  tower_missile: 250,
  tower_shoot: 80, // legacy
  // Hits — increased to prevent overlapping impact cacophony
  arrow_hit: 60,
  cannon_hit: 100,
  ice_hit: 80,
  lightning_hit: 120,
  missile_impact: 250,
  // Frequent events — increased to tame rapid-fire noise
  enemy_death: 80,
  enemy_hit: 50,
  gold_earn: 60,
  // Never throttle
  ui_click: 0,
  ui_error: 0,
  build_place: 0,
  build_deny: 0,
  upgrade: 0,
  sell: 0,
  wave_start: 0,
  wave_clear: 0,
  wave_boss: 0,
  countdown_tick: 0,
  countdown_go: 0,
  victory: 0,
  defeat: 0,
  enemy_spawn: 0,
  boss_phase2: 0,
  exploder_boom: 0,
  base_hit: 0,
  gold_spend: 0,
  skill_taunt: 0,
  skill_whirlwind: 0,
  weather_change: 0,
  enemy_attack: 0,
  mage_attack: 0,
  // v3.0 — immediate feedback, no throttle
  draft_select: 0,
  buff_select: 0,
  boss_split: 0,
  boss_summon: 0,
  boss_devour: 0,
  boss_missile: 0,
  boss_enter_slime: 0,
  boss_enter_beetle: 0,
  boss_enter_lucifer: 0,
  boss_enter_robot: 0,
  boss_enter_abyss: 0,
  boss_death_heavy: 0,
  boss_death_void: 0,
  boss_missile_warning: 0,
  boss_missile_impact: 0,
  boss_devour_cast: 0,
  boss_devour_impact: 0,
  boss_summon_insect: 0,
  boss_summon_undead: 0,
  boss_summon_machine: 0,
  boss_summon_void: 0,
  boss_phase_ice: 0,
  boss_phase_void: 0,
  boss_phase_enrage: 0,
  enemy_death_heavy: 120,
  enemy_death_magic: 100,
  enemy_death_machine: 120,
  enemy_death_flying: 80,
  enemy_spawn_flying: 0,
  enemy_spawn_machine: 0,
  enemy_spawn_undead: 0,
  intro_tile_drop: 0,
  intro_path_break: 80,
  // New tower attacks — moderate throttle
  tower_fire: 80,
  tower_poison: 80,
  tower_ballista: 120,
  // New hits
  fire_hit: 60,
  poison_hit: 60,
  ballista_hit: 100,
  // Skills — no throttle (infrequent)
  skill_fireball: 0,
  skill_arrow_rain: 0,
  skill_blizzard: 0,
  skill_bomb: 0,
  skill_earthquake: 0,
  // Arcane — no throttle (infrequent)
  arcane_shield: 0,
  arcane_boost: 0,
  arcane_gold: 0,
  // Status effects — heavy throttle (DOT ticks can be frequent)
  freeze_apply: 0,
  stun_apply: 0,
  poison_tick: 200,
  burn_tick: 200,
  // Soldier events — no throttle
  soldier_deploy: 0,
  soldier_death: 0,
  soldier_heal: 0,
};

/** Global concurrent sound cap: sliding-window limit to prevent audio chaos when many units fire simultaneously. */
const GLOBAL_SOUND_WINDOW_MS = 150;
const MAX_SOUNDS_IN_WINDOW = 8;
const MAX_PENDING_UNLOCK_SOUNDS = 6;

export class Sound {
  private static buffers: Partial<Record<SfxKey, HTMLAudioElement>> = {};
  private static lastPlayedAt: Partial<Record<SfxKey, number>> = {};
  private static volume = 0.6;
  private static muted = false;
  private static loaded = false;
  private static unlocked = false;
  private static pendingUnlockKeys: SfxKey[] = [];
  /** Sliding-window timestamps for global concurrent sound limiting */
  private static recentPlayTimes: number[] = [];

  static preload(): void {
    if (Sound.loaded) return;
    if (typeof Audio === 'undefined') return; // non-browser env
    for (const key of Object.keys(SFX_PATH) as SfxKey[]) {
      const audio = new Audio(sfxUrl(key));
      audio.preload = 'auto';
      audio.volume = Sound.volume;
      Sound.buffers[key] = audio;
    }
    Sound.loaded = true;
  }

  /**
   * Register one-time event listeners on the canvas to unlock audio playback.
   * Browsers block Audio.play() until the first user gesture (click/touch).
   * This plays a silent sound on the first interaction to satisfy the policy,
   * unblocking all future Sound.play() calls.
   */
  static initUnlock(canvas: HTMLCanvasElement): void {
    if (Sound.unlocked) return;
    if (typeof Audio === 'undefined') return; // non-browser env
    const handler = (): void => {
      Sound.unlocked = true;
      // Try a preloaded buffer first; fall back to creating a fresh one
      const first = Object.values(Sound.buffers).find(a => a && a.readyState >= 1);
      const fallbackKey = Object.keys(SFX_PATH)[0] as SfxKey;
      const unlockAudio = first ?? new Audio(sfxUrl(fallbackKey));
      unlockAudio.volume = 0;
      unlockAudio.play().catch(() => {});
      if (!first) {
        // Clean up the temporary element after it plays
        unlockAudio.addEventListener('ended', () => { unlockAudio.remove(); });
      }
      canvas.removeEventListener('pointerdown', handler);
      canvas.removeEventListener('touchstart', handler);
      canvas.removeEventListener('click', handler);
      Sound.flushPendingUnlockSounds();
    };
    canvas.addEventListener('pointerdown', handler);
    canvas.addEventListener('touchstart', handler);
    canvas.addEventListener('click', handler);
  }

  static play(key: SfxKey): void {
    if (Sound.muted) return;
    const normalizedKey = normalizeSfxKey(key);
    if (!normalizedKey) return;
    // Skip in non-browser environments (e.g. Node.js test runner)
    if (typeof Audio === 'undefined') return;
    if (!Sound.unlocked) {
      Sound.queuePendingUnlockSound(normalizedKey);
      return;
    }

    Sound.playNow(normalizedKey);
  }

  private static queuePendingUnlockSound(key: SfxKey): void {
    Sound.pendingUnlockKeys = Sound.pendingUnlockKeys.filter(existing => existing !== key);
    Sound.pendingUnlockKeys.push(key);
    if (Sound.pendingUnlockKeys.length > MAX_PENDING_UNLOCK_SOUNDS) {
      Sound.pendingUnlockKeys.shift();
    }
  }

  private static flushPendingUnlockSounds(): void {
    if (Sound.pendingUnlockKeys.length === 0) return;
    const keys = [...Sound.pendingUnlockKeys];
    Sound.pendingUnlockKeys.length = 0;
    for (const key of keys) {
      Sound.playNow(key);
    }
  }

  private static playNow(normalizedKey: SfxKey): void {
    const now = performance.now();

    // ── Global sliding-window cap: limit total sounds in a short window ──
    // Prune timestamps older than the window
    const cutoff = now - GLOBAL_SOUND_WINDOW_MS;
    Sound.recentPlayTimes = Sound.recentPlayTimes.filter(t => t >= cutoff);
    if (Sound.recentPlayTimes.length >= MAX_SOUNDS_IN_WINDOW) return;
    Sound.recentPlayTimes.push(now);

    // ── Per-key throttle ──
    const last = Sound.lastPlayedAt[normalizedKey] ?? 0;
    const throttle = PER_KEY_THROTTLE_MS[normalizedKey] ?? 0;
    if (now - last < throttle) return;
    Sound.lastPlayedAt[normalizedKey] = now;

    // Create fresh Audio element — more reliable than cloneNode for media elements.
    // Use synth URL for keys that have no OGG file; fall back to OGG otherwise.
    let src: string;
    if (SYNTH_ONLY_KEYS.has(normalizedKey)) {
      const synthUrl = getSynthUrl(normalizedKey);
      if (!synthUrl) return; // synth generation failed, silently skip
      src = synthUrl;
    } else {
      src = sfxUrl(normalizedKey);
    }
    const audio = new Audio(src);
    audio.volume = Sound.volume;
    void audio.play().catch(() => {});
  }

  static setVolume(v: number): void {
    Sound.volume = Math.max(0, Math.min(1, v));
    for (const audio of Object.values(Sound.buffers)) {
      if (audio) audio.volume = Sound.volume;
    }
  }

  static setMuted(m: boolean): void {
    Sound.muted = m;
  }

  static isMuted(): boolean {
    return Sound.muted;
  }

  /**
   * Diagnostic: test audio playback and report status.
   * Call `Sound.verify()` from the browser console to debug sound issues.
   */
  static verify(): void {
    if (typeof Audio === 'undefined') {
      console.error('[Sound] Audio API not available (non-browser environment?)');
      return;
    }
    console.group('[Sound] Diagnostic');
    console.log('muted:', Sound.muted);
    console.log('volume:', Sound.volume);
    console.log('loaded:', Sound.loaded);
    console.log('unlocked:', Sound.unlocked);
    console.log('buffers created:', Object.keys(Sound.buffers).length);
    console.log('OGG supported:', new Audio().canPlayType('audio/ogg'));
    console.log('MP3 supported:', new Audio().canPlayType('audio/mpeg'));

    // Test-play a sound
    const testKey = Object.keys(SFX_PATH)[0] as SfxKey | undefined;
    if (!testKey) {
      console.warn('No SFX keys defined');
      console.groupEnd();
      return;
    }
    const path = sfxUrl(testKey);
    console.log(`Test-playing "${testKey}" from ${path} ...`);
    const test = new Audio(path);
    test.volume = 0.3;
    const promise = test.play();
    if (promise !== undefined) {
      promise
        .then(() => console.log('[Sound] ✅ Play succeeded'))
        .catch((e) => console.error(`[Sound] ❌ Play blocked: ${String(e)}`));
    }
    console.groupEnd();
  }
}
