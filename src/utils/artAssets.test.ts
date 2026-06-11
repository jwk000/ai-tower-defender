import { describe, expect, it } from 'vitest';
import { assetUrl, enemyArtPath, objectiveArtPath, objectiveFxArtPath, spellEffectArtPath, spellProjectileArtPath, unitArtPath } from './artAssets.js';

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

  it('builds spell projectile and impact art paths', () => {
    expect(spellProjectileArtPath(0)).toBe('/art/fx/fx_fire_explosion_charge_0.png');
    expect(spellProjectileArtPath(1)).toBe('/art/fx/fx_arrow_rain_impact_1.png');
    expect(spellProjectileArtPath(2)).toBe('/art/fx/fx_ice_burst_impact_1.png');
    expect(spellProjectileArtPath(3)).toBe('/art/fx/fx_bomb_explosion_impact_1.png');
    expect(spellEffectArtPath(0)).toBe('/art/fx/fx_fire_explosion_impact_1.png');
    expect(spellEffectArtPath(99)).toBeNull();
  });
});
