#!/usr/bin/env python3
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
UNIT_DIR = ROOT / "public" / "art" / "units"


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    return bbox if bbox is not None else (0, 0, image.width, image.height)


def fit_layer(
    image: Image.Image,
    scale_x: float,
    scale_y: float,
    offset_x: int,
    offset_y: int,
    rotate: float = 0,
    alpha: float = 1,
    brightness: float = 1,
    saturation: float = 1,
) -> Image.Image:
    canvas = Image.new("RGBA", image.size, (0, 0, 0, 0))
    bbox = alpha_bbox(image)
    subject = image.crop(bbox)
    new_w = max(1, round(subject.width * scale_x))
    new_h = max(1, round(subject.height * scale_y))
    subject = subject.resize((new_w, new_h), Image.Resampling.LANCZOS)
    if rotate:
      subject = subject.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    if brightness != 1:
      subject = ImageEnhance.Brightness(subject).enhance(brightness)
    if saturation != 1:
      subject = ImageEnhance.Color(subject).enhance(saturation)
    if alpha != 1:
      a = subject.getchannel("A").point(lambda p: int(p * alpha))
      subject.putalpha(a)

    cx = (bbox[0] + bbox[2]) // 2 + offset_x
    cy = (bbox[1] + bbox[3]) // 2 + offset_y
    x = round(cx - subject.width / 2)
    y = round(cy - subject.height / 2)
    canvas.alpha_composite(subject, (x, y))
    return canvas


def tint(image: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (*color, 0))
    mask = image.getchannel("A").point(lambda p: int(p * alpha / 255))
    overlay.putalpha(mask)
    out = image.copy()
    out.alpha_composite(overlay)
    return out


def glow(image: Image.Image, color: tuple[int, int, int], radius: float, alpha: int) -> Image.Image:
    mask = image.getchannel("A").filter(ImageFilter.GaussianBlur(radius))
    layer = Image.new("RGBA", image.size, (*color, 0))
    layer.putalpha(mask.point(lambda p: int(p * alpha / 255)))
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    out.alpha_composite(layer)
    out.alpha_composite(image)
    return out


def sample_color(image: Image.Image, rng: random.Random, bbox: tuple[int, int, int, int]) -> tuple[int, int, int]:
    for _ in range(40):
      x = rng.randrange(bbox[0], bbox[2])
      y = rng.randrange(bbox[1], bbox[3])
      r, g, b, a = image.getpixel((x, y))
      if a > 80:
        return r, g, b
    return (110, 120, 135)


def death_shards(image: Image.Image, seed: str, count: int = 14) -> Image.Image:
    out = Image.new("RGBA", image.size, (0, 0, 0, 0))
    bbox = alpha_bbox(image)
    rng = random.Random(seed)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(out)
    cx = (bbox[0] + bbox[2]) / 2
    cy = (bbox[1] + bbox[3]) / 2
    radius = max(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 0.42
    for i in range(count):
      angle = (i / count) * math.tau + rng.uniform(-0.22, 0.22)
      dist = radius * rng.uniform(0.55, 1.05)
      x = cx + math.cos(angle) * dist
      y = cy + math.sin(angle) * dist * 0.72 + rng.uniform(6, 18)
      size = rng.uniform(3.0, 8.0)
      color = sample_color(image, rng, bbox)
      points = [
        (x + math.cos(angle) * size, y + math.sin(angle) * size),
        (x + math.cos(angle + 2.25) * size * 0.75, y + math.sin(angle + 2.25) * size * 0.75),
        (x + math.cos(angle - 2.25) * size * 0.75, y + math.sin(angle - 2.25) * size * 0.75),
      ]
      draw.polygon(points, fill=(*color, rng.randrange(80, 155)))
    return out


def make_attack_frames(uid: str, idle0: Image.Image, idle1: Image.Image) -> tuple[Image.Image, Image.Image]:
    attack0 = fit_layer(idle0, 0.98, 0.98, -4, 3, rotate=-2, brightness=1.04)
    attack0 = glow(attack0, (80, 170, 255), 5, 55)
    attack1 = fit_layer(idle1, 1.08, 0.96, 8, -2, rotate=3, brightness=1.15, saturation=1.08)
    attack1 = tint(attack1, (255, 225, 120), 38)
    attack1 = glow(attack1, (255, 195, 80), 7, 82)
    return attack0, attack1


def make_death_frames(uid: str, idle0: Image.Image, idle1: Image.Image) -> tuple[Image.Image, Image.Image]:
    death0 = fit_layer(idle0, 1.0, 0.94, -2, 8, rotate=8, alpha=0.78, brightness=0.72, saturation=0.72)
    death0 = tint(death0, (70, 80, 105), 62)
    death1 = fit_layer(idle1, 1.16, 0.68, 2, 30, rotate=14, alpha=0.42, brightness=0.48, saturation=0.45)
    shards = death_shards(idle0, uid)
    death1.alpha_composite(shards)
    death1 = glow(death1, (85, 120, 180), 3, 35)
    return death0, death1


def main() -> None:
    idle0_files = sorted(UNIT_DIR.glob("unit_*_idle_0.png"))
    written = 0
    for idle0_path in idle0_files:
      uid = idle0_path.name[len("unit_") : -len("_idle_0.png")]
      idle1_path = UNIT_DIR / f"unit_{uid}_idle_1.png"
      if not idle1_path.exists():
        raise FileNotFoundError(idle1_path)
      idle0 = Image.open(idle0_path).convert("RGBA")
      idle1 = Image.open(idle1_path).convert("RGBA")
      frames = {
        "attack_0": make_attack_frames(uid, idle0, idle1)[0],
        "attack_1": make_attack_frames(uid, idle0, idle1)[1],
        "death_0": make_death_frames(uid, idle0, idle1)[0],
        "death_1": make_death_frames(uid, idle0, idle1)[1],
      }
      for suffix, image in frames.items():
        out = UNIT_DIR / f"unit_{uid}_{suffix}.png"
        image.save(out)
        written += 1
    print(f"generated {written} action frames for {len(idle0_files)} units")


if __name__ == "__main__":
    main()
