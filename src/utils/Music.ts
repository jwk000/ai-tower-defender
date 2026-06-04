export type BgmKey =
  | 'main_menu'
  | 'battle_default'
  | 'battle_intense'
  | 'battle_meadow'
  | 'battle_desert'
  | 'battle_castle'
  | 'battle_waste'
  | 'battle_abyss'
  | 'battle_snow'
  | 'battle_lava'
  | 'wave_break'
  | 'victory'
  | 'defeat'
  | 'endless';

/** Vite base URL — adapts to deployment path (/, /repo-name/, etc.) */
const BASE = import.meta.env.BASE_URL;

const BGM_PATH: Record<BgmKey, string> = {
  main_menu: 'bgm/main_menu.ogg',
  battle_default: 'bgm/battle_default.ogg',
  battle_intense: 'bgm/battle_intense.mp3',
  battle_meadow: 'bgm/battle_meadow.mp3',
  battle_desert: 'bgm/battle_desert.mp3',
  battle_castle: 'bgm/battle_castle.ogg',
  battle_waste: 'bgm/battle_waste.ogg',
  battle_abyss: 'bgm/battle_abyss.mp3',
  battle_snow: 'bgm/battle_meadow.mp3',
  battle_lava: 'bgm/battle_abyss.mp3',
  wave_break: 'bgm/wave_break.ogg',
  victory: 'bgm/victory.ogg',
  defeat: 'bgm/defeat.mp3',
  endless: 'bgm/endless.ogg',
};

/** Cross-fade an audio element's volume over a given duration in seconds. */
function crossFadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  duration: number,
  onComplete?: () => void,
): void {
  if (duration <= 0) {
    audio.volume = to;
    onComplete?.();
    return;
  }
  const start = performance.now();
  const step = (): void => {
    const elapsed = (performance.now() - start) / 1000;
    const t = Math.min(elapsed / duration, 1);
    audio.volume = from + (to - from) * t;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  };
  requestAnimationFrame(step);
}

/**
 * Background music manager.
 *
 * Plays looping BGM tracks with cross-fade transitions.  BGM is
 * streamed via HTMLAudioElement and looped (loop=true).  Volume
 * and mute state are independent of the Sound (SFX) system.
 */
export class Music {
  private static currentAudio: HTMLAudioElement | null = null;
  private static nextAudio: HTMLAudioElement | null = null;
  private static currentKey: BgmKey | null = null;
  private static volume = 0.4;
  private static muted = false;

  // ─── public API ────────────────────────────────────────────

  /** Start playing a BGM track, cross-fading from the current one. */
  static play(key: BgmKey, fadeIn = 0.3): void {
    if (Music.currentKey === key) return;
    Music.stopCurrent(fadeIn);

    const audio = new Audio(BASE + BGM_PATH[key]);
    audio.loop = true;
    audio.volume = 0;
    audio.play().catch(() => {});
    Music.currentAudio = audio;
    Music.currentKey = key;
    Music.nextAudio = null;

    if (!Music.muted && fadeIn > 0) {
      crossFadeVolume(audio, 0, Music.volume, fadeIn, () => {
        if (Music.muted) audio.volume = 0;
      });
    } else if (!Music.muted) {
      audio.volume = Music.volume;
    }
  }

  /** Stop current BGM with optional fade-out. */
  static stop(fadeOut = 0.3): void {
    Music.stopCurrent(fadeOut);
    Music.currentKey = null;
  }

  /** Set BGM volume (0–1). Independent of SFX volume. */
  static setVolume(v: number): void {
    Music.volume = Math.max(0, Math.min(1, v));
    if (Music.currentAudio && !Music.muted) {
      Music.currentAudio.volume = Music.volume;
    }
  }

  /** Get current BGM volume. */
  static getVolume(): number {
    return Music.volume;
  }

  /** Mute / unmute BGM (does not affect SFX). */
  static setMuted(m: boolean): void {
    Music.muted = m;
    const audio = Music.currentAudio;
    if (!audio) return;
    // crossFade to avoid audible clicks
    if (m) {
      crossFadeVolume(audio, audio.volume, 0, 0.15);
    } else {
      crossFadeVolume(audio, 0, Music.volume, 0.15);
    }
  }

  static isMuted(): boolean {
    return Music.muted;
  }

  /** Which track is currently playing (null if none). */
  static getCurrentKey(): BgmKey | null {
    return Music.currentKey;
  }

  /** Map a level number (1-5) to its themed BGM key. */
  static getLevelBgm(levelId: number): BgmKey {
    const map: Record<number, BgmKey> = {
      1: 'battle_meadow',
      2: 'battle_desert',
      3: 'battle_castle',
      4: 'battle_waste',
      5: 'battle_abyss',
    };
    return map[levelId] ?? 'battle_default';
  }

  // ─── internal ──────────────────────────────────────────────

  private static stopCurrent(fadeOut: number): void {
    const audio = Music.currentAudio;
    Music.currentAudio = null;
    Music.nextAudio = null;
    if (!audio) return;

    const dispose = (): void => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };

    if (fadeOut > 0 && audio.volume > 0) {
      const from = audio.volume;
      crossFadeVolume(audio, from, 0, fadeOut, dispose);
    } else {
      dispose();
    }
  }
}
