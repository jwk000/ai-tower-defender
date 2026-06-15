import type { TileArtTheme } from '../types/index.js';

export function assetUrl(path: string, base = ((import.meta as any).env?.BASE_URL ?? '/')): string {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\//, '')}`;
}

export function cardArtPath(cardId: string): string {
  const artId = cardId.endsWith('_card')
    ? `card_${cardId.slice(0, -'_card'.length)}`
    : cardId;
  return `/art/cards/${artId}.png`;
}

export function buffArtPath(buffId: string): string {
  return `/art/buffs/${buffId}.png`;
}

export function enemyArtPath(enemyId: string): string {
  return `/art/enemies/enemy_${enemyId}.png`;
}

export function unitArtPath(unitId: string, state = 'idle', frame = 0): string {
  return `/art/units/unit_${unitId}_${state}_${frame}.png`;
}

export function uiArtPath(assetId: string): string {
  return `/art/ui/${assetId}.png`;
}

export function objectiveArtPath(assetId: 'crystal' | 'crystal_low_hp' | 'spawn_portal'): string {
  return `/art/objectives/objective_${assetId}.png`;
}

export function objectiveFxArtPath(assetId: 'crystal_aura' | 'spawn_portal'): string {
  return `/art/fx/fx_${assetId}_loop_0.png`;
}

export function backgroundArtPath(theme: string | TileArtTheme | undefined): string {
  const normalized = (theme ?? 'meadow').toLowerCase();
  const artTheme = normalized === 'plains' ? 'meadow' : normalized;
  return `/art/backgrounds/bg_${artTheme}.webp`;
}

export function spellProjectileArtPath(spellType: number): string | null {
  void spellType;
  return null;
}

export function spellEffectArtPath(spellType: number): string | null {
  void spellType;
  return null;
}
