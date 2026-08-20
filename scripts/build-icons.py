#!/usr/bin/env python3
"""Regenerate the PWA icon set from assets/logo.png.

    python3 scripts/build-icons.py

The logo is a 3D render, not a vector, so every icon is resampled from the
master rather than redrawn. Three decisions are baked into the numbers below:

  - Every icon is opaque. iOS paints a transparent apple-touch icon black, and
    a maskable icon is clipped to a launcher shape, so both need full bleed;
    making the plain icons match keeps one appearance everywhere.

  - Palette PNG with Floyd-Steinberg dithering, not truecolor. The render is a
    smooth gradient, so undithered quantisation bands visibly across the bag
    face and the receipt. Dithered at 255 colours it is indistinguishable at
    icon sizes and costs a third of the bytes (55 KB against 144 KB at 512px),
    which matters because the whole shell is precached, sometimes over 2G.

  - The maskable safe zone is a circle of diameter 0.8w, so the artwork would
    have to sit inside the inscribed square (0.566w) to be provably safe. The
    art is taller than it is wide and its bounding-box corners are empty, so
    0.60 still keeps every opaque pixel inside the circle: half-diagonal 202px
    against a 205px safe radius.
"""

import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
MASTER = ROOT / 'assets' / 'logo.png'
OUT = ROOT / 'public' / 'icons'

# name -> (canvas px, longest side of the artwork as a fraction of the canvas)
ICONS = {
    'icon-512.png': (512, 0.88),
    'icon-192.png': (192, 0.88),
    'icon-maskable-512.png': (512, 0.60),
    'apple-touch-icon.png': (180, 0.82),
    'icon-32.png': (32, 0.94),
}


def build(art: Image.Image, size: int, scale: float) -> Image.Image:
    box = round(size * scale)
    w, h = art.size
    nw, nh = (box, round(h * box / w)) if w >= h else (round(w * box / h), box)
    nw, nh = max(1, nw), max(1, nh)
    canvas = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    canvas.alpha_composite(art.resize((nw, nh), Image.LANCZOS), ((size - nw) // 2, (size - nh) // 2))
    return canvas.convert('RGB').convert(
        'P', palette=Image.ADAPTIVE, colors=255, dither=Image.FLOYDSTEINBERG
    )


def main() -> None:
    master = Image.open(MASTER).convert('RGBA')
    art = master.crop(master.getbbox())
    for name, (size, scale) in ICONS.items():
        path = OUT / name
        build(art, size, scale).save(path, 'PNG', optimize=True)
        print(f'{name:24s} {size:>4}px  {path.stat().st_size / 1024:6.1f} KB')
    total = sum(f.stat().st_size for f in OUT.glob('*.png'))
    print(f'\ntotal {total / 1024:.1f} KB precached')


if __name__ == '__main__':
    main()
