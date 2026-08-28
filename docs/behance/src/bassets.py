"""Inline everything the boards need.

    python3 docs/behance/src/bassets.py

Writes bassets.json beside this file: the display face, the app's own Tamil
face, and every screen capture at twice the width it is printed at, because
the boards render at deviceScaleFactor 2.

Archivo ships in two subsets here. Latin carries the alphabet; latin-ext
carries the rupee sign. Without the second one every ₹ falls back to another
font and sits at a different weight beside its own digits — on a case study
about money typography, of all things.
"""

import base64
import json
import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent
CAPS = REPO / '.caps'
APP_FONTS = REPO / 'public' / 'fonts'

FACES = {
    'archivo': HERE / 'fonts' / 'archivo-latin.woff2',
    'archivo_ext': HERE / 'fonts' / 'archivo-latin-ext.woff2',
    'noto-sans-tamil-tamil-400-normal': APP_FONTS / 'noto-sans-tamil-tamil-400-normal.woff2',
    'noto-sans-tamil-tamil-700-normal': APP_FONTS / 'noto-sans-tamil-tamil-700-normal.woff2',
}

# 960 source px covers the widest device frame on any board, at 2x.
WIDTH = 960


def main() -> None:
    if not CAPS.exists():
        raise SystemExit(f'no captures at {CAPS} — run docs/behance/src/capture.mjs first')

    out = {'fonts': {}, 'shots': {}}
    for name, path in FACES.items():
        out['fonts'][name] = base64.b64encode(path.read_bytes()).decode()

    for p in sorted(CAPS.glob('*.png')):
        im = Image.open(p).convert('RGB')
        w = min(WIDTH, im.width)
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        tmp = CAPS / f'_{p.stem}.webp'
        im.save(tmp, 'WEBP', quality=88, method=6)
        out['shots'][p.stem] = base64.b64encode(tmp.read_bytes()).decode()
        tmp.unlink()

    (HERE / 'bassets.json').write_text(json.dumps(out))
    total = sum(len(v) for v in out['fonts'].values()) + sum(len(v) for v in out['shots'].values())
    print(f'{len(out["shots"])} shots, {len(out["fonts"])} faces, {total / 1024 / 1024:.2f} MB inlined')


if __name__ == '__main__':
    main()
