export interface RunSnapshot {
  readonly version: 1;
  readonly savedAt: number;
  readonly phase: 'LevelMap';
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly crystalHpMax: number;
  readonly skillTreeUnlocked: string[];
  readonly deck: {
    readonly drawPile: string[];
    readonly discardPile: string[];
  };
}

/** @deprecated 旧格式，迁移期保留 */
export interface OngoingRun {
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly savedAt: number;
}

const STORAGE_KEY = 'td_run_v1';
const LEGACY_KEY = 'td_ongoing_run';

export const SaveSystem = {
  hasSavedRun(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  },

  /** @deprecated 用 hasSavedRun() */
  hasOngoingRun(): boolean {
    return SaveSystem.hasSavedRun();
  },

  loadRun(): RunSnapshot | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as RunSnapshot;
      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  },

  /** @deprecated 用 loadRun() */
  loadOngoingRun(): OngoingRun | null {
    const snap = SaveSystem.loadRun();
    if (!snap) return null;
    return {
      currentLevelIdx: snap.currentLevelIdx,
      gold: snap.gold,
      skillPoints: snap.skillPoints,
      crystalHp: snap.crystalHp,
      savedAt: snap.savedAt,
    };
  },

  saveRun(snapshot: RunSnapshot): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  },

  /** @deprecated 用 saveRun() */
  saveOngoingRun(run: OngoingRun): void {
    SaveSystem.saveRun({
      version: 1,
      savedAt: run.savedAt,
      phase: 'LevelMap',
      currentLevelIdx: run.currentLevelIdx,
      gold: run.gold,
      skillPoints: run.skillPoints,
      crystalHp: run.crystalHp,
      crystalHpMax: run.crystalHp,
      skillTreeUnlocked: [],
      deck: { drawPile: [], discardPile: [] },
    });
  },

  clearRun(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  },

  /** @deprecated 用 clearRun() */
  clearOngoingRun(): void {
    SaveSystem.clearRun();
  },
};
