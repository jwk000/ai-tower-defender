import { describe, expect, it } from 'vitest';
import { assetUrl, cardArtPath, enemyArtPath, objectiveArtPath, objectiveFxArtPath, spellEffectArtPath, spellProjectileArtPath, unitArtPath } from './artAssets.js';

describe('artAssets', () => {
  it('resolves public art paths against the Vite base URL', () => {
    expect(assetUrl('/art/cards/card_arrow_tower.png', '/ai-tower-defender/')).toBe('/ai-tower-defender/art/cards/card_arrow_tower.png');
    expect(assetUrl('art/ui/ui_panel_dark.png', '/ai-tower-defender/')).toBe('/ai-tower-defender/art/ui/ui_panel_dark.png');
  });

  it('keeps absolute and inline image URLs unchanged', () => {
    expect(assetUrl('https://example.com/art.png')).toBe('https://example.com/art.png');
    expect(assetUrl('//cdn.example.com/art.png')).toBe('//cdn.example.com/art.png');
    expect(assetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(assetUrl('blob:http://localhost/image')).toBe('blob:http://localhost/image');
  });

  it('maps YAML card config IDs to generated card art names', () => {
    expect(cardArtPath('swordsman_card')).toBe('/art/cards/card_swordsman.png');
    expect(cardArtPath('arrow_tower_card')).toBe('/art/cards/card_arrow_tower.png');
    expect(cardArtPath('card_swordsman')).toBe('/art/cards/card_swordsman.png');
  });

  it('builds enemy codex art paths', () => {
    expect(enemyArtPath('goblin')).toBe('/art/enemies/enemy_goblin.png');
    expect(assetUrl(enemyArtPath('abyss_lord'), '/ai-tower-defender/')).toBe('/ai-tower-defender/art/enemies/enemy_abyss_lord.png');
  });

  it('builds scene unit sprite art paths', () => {
    expect(unitArtPath('tower_arrow')).toBe('/art/units/unit_tower_arrow_idle_0.png');
    expect(unitArtPath('goblin', 'idle', 1)).toBe('/art/units/unit_goblin_idle_1.png');
  });

  it('builds objective body and loop effect art paths', () => {
    expect(objectiveArtPath('crystal')).toBe('/art/objectives/objective_crystal.png');
    expect(objectiveArtPath('crystal_low_hp')).toBe('/art/objectives/objective_crystal_low_hp.png');
    expect(objectiveArtPath('spawn_portal')).toBe('/art/objectives/objective_spawn_portal.png');
    expect(objectiveFxArtPath('crystal_aura')).toBe('/art/fx/fx_crystal_aura_loop_0.png');
    expect(objectiveFxArtPath('spawn_portal')).toBe('/art/fx/fx_spawn_portal_loop_0.png');
  });

  it('keeps spell runtime effects particle-only', () => {
    expect(spellProjectileArtPath(0)).toBeNull();
    expect(spellProjectileArtPath(1)).toBeNull();
    expect(spellProjectileArtPath(2)).toBeNull();
    expect(spellProjectileArtPath(3)).toBeNull();
    expect(spellEffectArtPath(0)).toBeNull();
    expect(spellEffectArtPath(99)).toBeNull();
  });
});
