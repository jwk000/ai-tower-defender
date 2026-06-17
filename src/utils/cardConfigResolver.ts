import { cardConfigRegistry, type CardConfig } from '../config/cardRegistry.js';

export function getCardConfigIdCandidates(cardId: string): string[] {
  const candidates = [cardId, `${cardId}_card`];
  if (cardId.startsWith('card_')) {
    candidates.push(`${cardId.slice(5)}_card`);
  } else if (cardId.endsWith('_card')) {
    candidates.push(`card_${cardId.slice(0, -'_card'.length)}`);
  } else {
    candidates.push(`card_${cardId}`);
  }

  return [...new Set(candidates)];
}

export function resolveCardConfig(cardId: string): CardConfig | undefined {
  for (const candidate of getCardConfigIdCandidates(cardId)) {
    const config = cardConfigRegistry.get(candidate);
    if (config) return config;
  }
  return undefined;
}
