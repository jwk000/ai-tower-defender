const deathSpriteArtIds = new Map<number, string>();

export function registerDeathSpriteArtId(eid: number, artId: string | null): void {
  if (!artId) return;
  deathSpriteArtIds.set(eid, artId);
}

export function getDeathSpriteArtId(eid: number): string | null {
  return deathSpriteArtIds.get(eid) ?? null;
}

export function clearDeathSpriteArtId(eid: number): void {
  deathSpriteArtIds.delete(eid);
}
