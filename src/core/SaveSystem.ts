export interface OngoingRun {
  readonly currentLevelIdx: number;
  readonly gold: number;
  readonly skillPoints: number;
  readonly crystalHp: number;
  readonly savedAt: number;
}

const STORAGE_KEY = 'td_ongoing_run';

export const SaveSystem = {
  hasOngoingRun(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== null;
  },

  loadOngoingRun(): OngoingRun | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OngoingRun;
    } catch {
      return null;
    }
  },

  saveOngoingRun(run: OngoingRun): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  },

  clearOngoingRun(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
