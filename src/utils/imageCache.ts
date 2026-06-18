import { assetUrl } from './artAssets.js';
import { areArtResourcesEnabled } from './artResourceSwitch.js';

export interface ImageSourceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LoadedArtFrame {
  image: HTMLImageElement;
  source: ImageSourceRect | null;
  width: number;
  height: number;
  path: string;
  atlasId?: string;
}

export interface ArtAtlasFrameSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  sourceW?: number;
  sourceH?: number;
}

export interface ArtAtlasManifest {
  id: string;
  image: string;
  frames: Record<string, ArtAtlasFrameSpec>;
}

export interface ArtAtlasIndex {
  atlases: ArtAtlasManifest[];
}

export interface ImagePreloadResult {
  path: string;
  ok: boolean;
}

const imageCache = new Map<string, HTMLImageElement>();
const failedImages = new Set<string>();
const atlasImageCache = new Map<string, HTMLImageElement>();
const failedAtlasImages = new Set<string>();
const atlasFrames = new Map<string, { atlasId: string; imagePath: string; frame: ArtAtlasFrameSpec }>();
const atlasImagePaths = new Map<string, string>();
let atlasIndexRequested = false;
let atlasIndexLoaded = false;
let atlasIndexPromise: Promise<ArtAtlasIndex | null> | null = null;

function normalizePath(path: string): string {
  if (/^(?:https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `/${path.replace(/^\//, '')}`;
}

function loadImage(cache: Map<string, HTMLImageElement>, failures: Set<string>, path: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;

  const url = assetUrl(path);
  if (failures.has(url)) return null;

  const cached = cache.get(url);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;

  const image = new Image();
  image.onerror = (): void => {
    failures.add(url);
  };
  image.src = url;
  cache.set(url, image);
  return null;
}

function preloadImage(cache: Map<string, HTMLImageElement>, failures: Set<string>, path: string): Promise<ImagePreloadResult> {
  if (typeof Image === 'undefined') return Promise.resolve({ path, ok: false });

  const url = assetUrl(path);
  if (failures.has(url)) return Promise.resolve({ path, ok: false });

  const cached = cache.get(url);
  if (cached?.complete) {
    return Promise.resolve({ path, ok: cached.naturalWidth > 0 });
  }

  const image = cached ?? new Image();
  if (!cached) {
    cache.set(url, image);
  }

  return new Promise<ImagePreloadResult>((resolve) => {
    image.onload = (): void => resolve({ path, ok: image.naturalWidth > 0 });
    image.onerror = (): void => {
      failures.add(url);
      resolve({ path, ok: false });
    };
    if (!cached) {
      image.src = url;
    }
    if (image.complete) {
      resolve({ path, ok: image.naturalWidth > 0 });
    }
  }).then(async (result) => {
    if (!result.ok) return result;
    if (typeof image.decode !== 'function') return result;
    try {
      await image.decode();
      return result;
    } catch {
      return result;
    }
  });
}

function loadAtlasIndex(): Promise<ArtAtlasIndex | null> {
  if (atlasIndexPromise) return atlasIndexPromise;
  atlasIndexRequested = true;
  if (typeof fetch === 'undefined') {
    atlasIndexPromise = Promise.resolve(null);
    return atlasIndexPromise;
  }

  atlasIndexPromise = fetch(assetUrl('/art/atlases/index.json'))
    .then((res) => res.ok ? res.json() as Promise<ArtAtlasIndex> : null)
    .then((index) => {
      if (!index) return null;
      registerArtAtlasIndex(index);
      atlasIndexLoaded = true;
      return index;
    })
    .catch(() => {
      // 图集索引是可选资源；缺失时继续走单图加载。
      return null;
    });
  return atlasIndexPromise;
}

function requestAtlasIndex(): void {
  if (atlasIndexRequested) return;
  void loadAtlasIndex();
}

export function registerArtAtlasManifest(manifest: ArtAtlasManifest): void {
  atlasImagePaths.set(manifest.id, manifest.image);
  for (const [framePath, frame] of Object.entries(manifest.frames)) {
    atlasFrames.set(normalizePath(framePath), {
      atlasId: manifest.id,
      imagePath: manifest.image,
      frame,
    });
  }
}

export function registerArtAtlasIndex(index: ArtAtlasIndex): void {
  for (const manifest of index.atlases) {
    registerArtAtlasManifest(manifest);
  }
  atlasIndexLoaded = true;
}

export function clearArtAtlasRegistryForTests(): void {
  atlasFrames.clear();
  atlasImageCache.clear();
  failedAtlasImages.clear();
  imageCache.clear();
  failedImages.clear();
  atlasIndexRequested = false;
  atlasIndexLoaded = false;
  atlasIndexPromise = null;
  atlasImagePaths.clear();
}

export async function preloadArtAtlases(): Promise<void> {
  if (!areArtResourcesEnabled()) return;
  await loadAtlasIndex();
  if (typeof Image === 'undefined') return;
  for (const imagePath of atlasImagePaths.values()) {
    loadImage(atlasImageCache, failedAtlasImages, imagePath);
  }
}

export async function preloadArtAtlasesById(atlasIds: readonly string[]): Promise<ImagePreloadResult[]> {
  if (!areArtResourcesEnabled()) return [];
  await loadAtlasIndex();
  if (typeof Image === 'undefined') return [];

  const uniquePaths = new Set<string>();
  for (const atlasId of atlasIds) {
    const path = atlasImagePaths.get(atlasId);
    if (path) uniquePaths.add(path);
  }

  return Promise.all(
    [...uniquePaths].map((imagePath) => preloadImage(atlasImageCache, failedAtlasImages, imagePath)),
  );
}

export async function preloadArtAtlasIndex(): Promise<void> {
  if (!areArtResourcesEnabled()) return;
  await loadAtlasIndex();
}

export function isArtAtlasIndexLoaded(): boolean {
  return atlasIndexLoaded;
}

export function getLoadedImage(path: string): HTMLImageElement | null {
  if (!areArtResourcesEnabled()) return null;
  requestAtlasIndex();
  return loadImage(imageCache, failedImages, path);
}

export function getLoadedImageFrame(path: string): LoadedArtFrame | null {
  if (!areArtResourcesEnabled()) return null;
  requestAtlasIndex();

  const normalizedPath = normalizePath(path);
  const atlasRef = atlasFrames.get(normalizedPath);
  if (atlasRef) {
    const atlasImage = loadImage(atlasImageCache, failedAtlasImages, atlasRef.imagePath);
    if (atlasImage) {
      return {
        image: atlasImage,
        source: {
          x: atlasRef.frame.x,
          y: atlasRef.frame.y,
          w: atlasRef.frame.w,
          h: atlasRef.frame.h,
        },
        width: atlasRef.frame.sourceW ?? atlasRef.frame.w,
        height: atlasRef.frame.sourceH ?? atlasRef.frame.h,
        path: normalizedPath,
        atlasId: atlasRef.atlasId,
      };
    }

    if (!failedAtlasImages.has(assetUrl(atlasRef.imagePath))) return null;
  }

  const image = loadImage(imageCache, failedImages, path);
  if (!image) return null;
  const width = Number(image.naturalWidth || image.width);
  const height = Number(image.naturalHeight || image.height);
  if (width <= 0 || height <= 0) return null;
  return {
    image,
    source: null,
    width,
    height,
    path: normalizedPath,
  };
}

export function drawImageFrame(
  ctx: CanvasRenderingContext2D,
  frame: LoadedArtFrame,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (frame.source) {
    ctx.drawImage(
      frame.image,
      frame.source.x,
      frame.source.y,
      frame.source.w,
      frame.source.h,
      x,
      y,
      w,
      h,
    );
    return;
  }
  ctx.drawImage(frame.image, x, y, w, h);
}

export function drawLoadedImage(
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const frame = getLoadedImageFrame(path);
  if (!frame) return false;
  drawImageFrame(ctx, frame, x, y, w, h);
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
  const frame = getLoadedImageFrame(path);
  if (!frame) return false;

  const sourceX = frame.source?.x ?? 0;
  const sourceY = frame.source?.y ?? 0;
  const sw = frame.width;
  const sh = frame.height;
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
    ctx.drawImage(frame.image, sourceX + sx, sourceY + sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
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
