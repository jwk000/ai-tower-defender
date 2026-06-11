import { assetUrl } from './artAssets.js';
import { areArtResourcesEnabled } from './artResourceSwitch.js';

const imageCache = new Map<string, HTMLImageElement>();

export function getLoadedImage(path: string): HTMLImageElement | null {
  if (!areArtResourcesEnabled()) return null;
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

export interface NineSliceInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function drawLoadedImage9Slice(
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
  insets: NineSliceInsets,
): boolean {
  const image = getLoadedImage(path);
  if (!image) return false;

  const sw = Number((image as HTMLImageElement).naturalWidth || (image as HTMLImageElement).width);
  const sh = Number((image as HTMLImageElement).naturalHeight || (image as HTMLImageElement).height);
  if (sw <= 0 || sh <= 0) return false;

  const sl = Math.min(insets.left, sw / 2);
  const sr = Math.min(insets.right, sw - sl);
  const st = Math.min(insets.top, sh / 2);
  const sb = Math.min(insets.bottom, sh - st);
  const dl = Math.min(sl, w / 2);
  const dr = Math.min(sr, w - dl);
  const dt = Math.min(st, h / 2);
  const db = Math.min(sb, h - dt);

  const smw = Math.max(1, sw - sl - sr);
  const smh = Math.max(1, sh - st - sb);
  const dmw = Math.max(0, w - dl - dr);
  const dmh = Math.max(0, h - dt - db);

  const draw = (sx: number, sy: number, sWidth: number, sHeight: number, dx: number, dy: number, dWidth: number, dHeight: number): void => {
    if (dWidth <= 0 || dHeight <= 0 || sWidth <= 0 || sHeight <= 0) return;
    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
  };

  draw(0, 0, sl, st, x, y, dl, dt);
  draw(sl, 0, smw, st, x + dl, y, dmw, dt);
  draw(sw - sr, 0, sr, st, x + w - dr, y, dr, dt);
  draw(0, st, sl, smh, x, y + dt, dl, dmh);
  draw(sl, st, smw, smh, x + dl, y + dt, dmw, dmh);
  draw(sw - sr, st, sr, smh, x + w - dr, y + dt, dr, dmh);
  draw(0, sh - sb, sl, sb, x, y + h - db, dl, db);
  draw(sl, sh - sb, smw, sb, x + dl, y + h - db, dmw, db);
  draw(sw - sr, sh - sb, sr, sb, x + w - dr, y + h - db, dr, db);
  return true;
}
