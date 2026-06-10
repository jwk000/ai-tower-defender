import type { TileArtTheme } from '../types/index.js';

export function cardArtPath(cardId: string): string {
  return `/art/cards/${cardId}.png`;
}

export function buffArtPath(buffId: string): string {
  return `/art/buffs/${buffId}.png`;
}

export function uiArtPath(assetId: string): string {
  return `/art/ui/${assetId}.png`;
}

export function backgroundArtPath(theme: string | TileArtTheme | undefined): string {
  const normalized = (theme ?? 'meadow').toLowerCase();
  const artTheme = normalized === 'plains' ? 'meadow' : normalized;
  return `/art/backgrounds/bg_${artTheme}.webp`;
}

export function spellProjectileArtPath(spellType: number): string | null {
  switch (spellType) {
    case 0: return '/art/fx/fx_fire_explosion_charge_0.png';
    case 1: return '/art/fx/fx_arrow_rain_impact_1.png';
    case 2: return '/art/fx/fx_ice_burst_impact_1.png';
    case 3: return '/art/fx/fx_bomb_explosion_impact_1.png';
    default: return null;
  }
}

export function spellEffectArtPath(spellType: number): string | null {
  switch (spellType) {
    case 0: return '/art/fx/fx_fire_explosion_impact_1.png';
    case 1: return '/art/fx/fx_arrow_rain_impact_1.png';
    case 2: return '/art/fx/fx_ice_burst_impact_1.png';
    case 3: return '/art/fx/fx_bomb_explosion_impact_1.png';
    default: return null;
  }
}
