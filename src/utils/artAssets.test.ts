import { describe, expect, it } from 'vitest';
import { assetUrl, enemyArtPath, unitArtPath } from './artAssets.js';

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
});
