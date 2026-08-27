"""Inline everything the boards need: the display face, the product's own Tamil
face, and every screen capture at twice its printed width (the boards render at
deviceScaleFactor 2)."""
import base64, json, pathlib
from PIL import Image

HERE = pathlib.Path('.')
CAPS = HERE / 'caps'
FONTS_APP = pathlib.Path('/home/user/KBS/public/fonts')

out = {'fonts': {}, 'shots': {}}
out['fonts']['archivo'] = base64.b64encode((HERE / 'fonts/archivo-latin.woff2').read_bytes()).decode()
for n in ['noto-sans-tamil-tamil-400-normal', 'noto-sans-tamil-tamil-700-normal',
          'noto-sans-tamil-latin-400-normal', 'noto-sans-tamil-latin-700-normal']:
    out['fonts'][n] = base64.b64encode((FONTS_APP / f'{n}.woff2').read_bytes()).decode()

# every capture, at 2x the widest size it is printed at
WIDTH = 2 * 480  # 960 source px covers every device frame on every board
for p in sorted(CAPS.glob('*.png')):
    if p.name.startswith(('_', 'probe')):
        continue
    im = Image.open(p).convert('RGB')
    w = min(WIDTH, im.width)
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    buf = HERE / f'_b_{p.stem}.webp'
    im.save(buf, 'WEBP', quality=88, method=6)
    out['shots'][p.stem] = base64.b64encode(buf.read_bytes()).decode()

(HERE / 'bassets.json').write_text(json.dumps(out))
total = sum(len(v) for v in out['fonts'].values()) + sum(len(v) for v in out['shots'].values())
print(f'{len(out["shots"])} shots, {len(out["fonts"])} fonts, {total/1024/1024:.2f} MB base64')
