import { assetUrl } from './artAssets.js';

const imageCache = new Map<string, HTMLImageElement>();

export function getLoadedImage(path: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;

  const url = assetUrl(path);
  const cached = imageCache.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

  const image = new Image();
  image.src = url;
  imageCache.set(url, image);
  return null;
}

export function drawLoadedImage(
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const image = getLoadedImage(path);
  if (!image) return false;
  ctx.drawImage(image, x, y, w, h);
  return true;
}
