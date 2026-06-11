#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SIZE = 512;

const outputs = {
  crystal: resolve(ROOT, 'public/art/objectives/objective_crystal.png'),
  crystalLow: resolve(ROOT, 'public/art/objectives/objective_crystal_low_hp.png'),
  spawn: resolve(ROOT, 'public/art/objectives/objective_spawn_portal.png'),
  crystalFx: resolve(ROOT, 'public/art/fx/fx_crystal_aura_loop_0.png'),
  spawnFx: resolve(ROOT, 'public/art/fx/fx_spawn_portal_loop_0.png'),
};

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function writePng(path, sample) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  let off = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[off++] = 0;
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b, a] = sample(x + 0.5, y + 0.5);
      raw[off++] = clamp255(r);
      raw[off++] = clamp255(g);
      raw[off++] = clamp255(b);
      raw[off++] = clamp255(a);
    }
  }
  writeFileSync(path, Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mix(a, b, t) {
  return a.map((v, i) => v * (1 - t) + b[i] * t);
}

function over(dst, src) {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return [0, 0, 0, 0];
  return [
    (src[0] * sa + dst[0] * da * (1 - sa)) / outA,
    (src[1] * sa + dst[1] * da * (1 - sa)) / outA,
    (src[2] * sa + dst[2] * da * (1 - sa)) / outA,
    outA * 255,
  ];
}

function signedDistanceToPolygon(px, py, points) {
  let inside = false;
  let minDist = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const wx = px - a[0];
    const wy = py - a[1];
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
    const dx = px - (a[0] + vx * t);
    const dy = py - (a[1] + vy * t);
    minDist = Math.min(minDist, Math.hypot(dx, dy));
    if (((a[1] > py) !== (b[1] > py)) && px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside ? -minDist : minDist;
}

function diamondPoints(cx, cy, w, h) {
  return [
    [cx, cy - h / 2],
    [cx + w / 2, cy],
    [cx, cy + h / 2],
    [cx - w / 2, cy],
  ];
}

function drawPolygon(color, points, fill) {
  return (x, y) => {
    const d = signedDistanceToPolygon(x, y, points);
    if (d > 1.25) return [0, 0, 0, 0];
    const edge = Math.max(0, Math.min(1, 0.5 - d / 2.5));
    const [r, g, b] = typeof fill === 'function' ? fill(x, y) : fill;
    return [r, g, b, color[3] * edge];
  };
}

function glow(cx, cy, radius, color, power = 2) {
  return (x, y) => {
    const d = Math.hypot(x - cx, y - cy) / radius;
    if (d >= 1) return [0, 0, 0, 0];
    const a = Math.pow(1 - d, power) * color[3];
    return [color[0], color[1], color[2], a];
  };
}

function ring(cx, cy, radius, width, color) {
  return (x, y) => {
    const d = Math.abs(Math.hypot(x - cx, y - cy) - radius);
    if (d > width) return [0, 0, 0, 0];
    const a = (1 - d / width) * color[3];
    return [color[0], color[1], color[2], a];
  };
}

function compose(layers) {
  return (x, y) => layers.reduce((dst, layer) => over(dst, layer(x, y)), [0, 0, 0, 0]);
}

function crystalAsset(lowHp = false) {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const deep = lowHp ? [152, 17, 17] : [74, 29, 143];
  const mid = lowHp ? [239, 68, 68] : [124, 58, 237];
  const light = lowHp ? [254, 202, 202] : [196, 181, 253];
  const gold = [252, 211, 77];
  const body = drawPolygon([255, 255, 255, 255], diamondPoints(cx, cy + 10, 178, 292), (x, y) => {
    const t = Math.max(0, Math.min(1, (y - 120) / 270));
    const side = Math.abs(x - cx) / 95;
    return mix(light, mix(mid, deep, t), Math.min(0.55, side * 0.55));
  });
  const core = drawPolygon([255, 255, 255, 170], diamondPoints(cx, cy + 2, 82, 152), (x, y) => {
    const t = Math.max(0, Math.min(1, (y - 160) / 200));
    return mix(light, mid, t);
  });
  const layers = [
    glow(cx, cy + 34, 198, [...light, 70], 2.4),
    glow(cx, cy + 28, 124, [...mid, 86], 1.7),
    body,
    core,
    drawPolygon([255, 255, 255, 130], diamondPoints(cx - 32, cy - 40, 28, 86), [255, 255, 255]),
    drawPolygon([255, 255, 255, 90], diamondPoints(cx + 34, cy - 7, 22, 118), [255, 255, 255]),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = i / 6 * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 103;
      const y = cy + Math.sin(a) * 134 + 10;
      return drawPolygon([255, 255, 255, 210], diamondPoints(x, y, 24, 24), gold);
    }),
  ];
  return compose(layers);
}

function crystalFxAsset() {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const layers = [
    glow(cx, cy, 234, [196, 181, 253, 78], 2.7),
    ring(cx, cy, 154, 13, [252, 211, 77, 102]),
    ring(cx, cy, 205, 8, [167, 139, 250, 70]),
    ...Array.from({ length: 12 }, (_, i) => {
      const a = i / 12 * Math.PI * 2;
      const r = i % 2 === 0 ? 176 : 132;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.74;
      return drawPolygon([255, 255, 255, 160], diamondPoints(x, y, 18, 18), [255, 255, 255]);
    }),
  ];
  return compose(layers);
}

function spawnPortalAsset() {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const layers = [
    glow(cx, cy, 218, [10, 0, 0, 235], 1.0),
    glow(cx, cy, 174, [20, 0, 18, 255], 0.8),
    ring(cx, cy, 190, 22, [255, 23, 68, 190]),
    ring(cx, cy, 142, 18, [255, 82, 82, 130]),
    ...Array.from({ length: 14 }, (_, i) => {
      const a = i / 14 * Math.PI * 2 + 0.55;
      const x = cx + Math.cos(a) * 145;
      const y = cy + Math.sin(a) * 145;
      return drawPolygon([255, 255, 255, 170], diamondPoints(x, y, 34, 56), i % 2 ? [255, 82, 82] : [120, 15, 30]);
    }),
    glow(cx, cy, 70, [255, 255, 255, 120], 1.4),
  ];
  return compose(layers);
}

function spawnFxAsset() {
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const layers = [
    glow(cx, cy, 248, [255, 23, 68, 74], 2.5),
    ring(cx, cy, 214, 10, [255, 23, 68, 120]),
    ring(cx, cy, 164, 7, [255, 138, 128, 82]),
    ...Array.from({ length: 18 }, (_, i) => {
      const a = i / 18 * Math.PI * 2;
      const r = 112 + (i % 4) * 28;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      return drawPolygon([255, 255, 255, 120], diamondPoints(x, y, 14, 14), i % 3 === 0 ? [255, 255, 255] : [255, 82, 82]);
    }),
  ];
  return compose(layers);
}

writePng(outputs.crystal, crystalAsset(false));
writePng(outputs.crystalLow, crystalAsset(true));
writePng(outputs.spawn, spawnPortalAsset());
writePng(outputs.crystalFx, crystalFxAsset());
writePng(outputs.spawnFx, spawnFxAsset());

for (const file of Object.values(outputs)) {
  console.log(file);
}
