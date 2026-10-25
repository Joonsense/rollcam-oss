# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1"]
# ///
"""Dev only: fill past days of a month with developed demo shots for store
screenshots.
uv run scripts/seed-demo.py <developed-dir> <YYYY-MM> <outdir>  -> jpgs + seed.sql

<developed-dir> = output of `npm run develop -- <photo> <dir> all` (the app's own
film shader via CanvasKit), files named <stem>-<film-id>.jpg. Passing a single
photo instead uses the old in-Python color-matrix port below, which no longer
matches the v0.2 shader; keep it only as a fallback."""
import json, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

LOOKS = {  # subset of src/lib/looks.ts
  'daily-negative': dict(sat=.88, contrast=.94, gain=(1.03, 1, .95), lift=(.04, .035, .03), vig=.28),
  'golden-roll': dict(sat=1.1, contrast=1.06, gain=(1.12, 1, .82), lift=(.05, .02, 0), vig=.38),
  'rainy-mono': dict(sat=0, contrast=1.05, gain=(.96, 1, 1.08), lift=(.03, .035, .05), vig=.35),
  'grey-portra': dict(sat=.85, contrast=.95, gain=(1.06, 1, .96), lift=(.05, .04, .04), vig=.3),
  'summer-kodak': dict(sat=1.28, contrast=1.08, gain=(1.06, 1.04, .9), lift=(.02, .03, .04), vig=.3),
  'winter-fuji': dict(sat=1.05, contrast=1.1, gain=(.94, 1.02, 1.08), lift=(0, .025, .04), vig=.3),
  'haze-film': dict(sat=.8, contrast=.78, gain=(1.04, 1.01, .94), lift=(.09, .08, .06), vig=.22),
  'night-tungsten': dict(sat=.95, contrast=1.12, gain=(1.08, 1, .86), lift=(0, .02, .07), vig=.45),
}
WX = {'daily-negative': (0, '평범한 오후'), 'golden-roll': (1, '해 지는 무렵'), 'rainy-mono': (63, '비 오는 오후'),
      'grey-portra': (3, '흐린 오후'), 'summer-kodak': (0, '뜨거운 한낮'), 'winter-fuji': (0, '차갑고 맑은 아침'),
      'haze-film': (45, '안개 낀 아침'), 'night-tungsten': (0, '해가 진 밤'), 'snow-pastel': (73, '눈 내리는 아침'),
      'storm-push': (95, '천둥 치는 오후'), 'motion-lofi': (1, '바람 센 오후'), 'party-flash': (0, '생일')}
NAMES = {'daily-negative': 'Daily Negative', 'golden-roll': 'Golden Roll', 'rainy-mono': 'Rainy Mono', 'grey-portra': 'Grey Portra',
         'summer-kodak': 'Summer Kodak', 'winter-fuji': 'Winter Fuji', 'haze-film': 'Haze Film', 'night-tungsten': 'Night Tungsten',
         'snow-pastel': 'Snow Pastel', 'storm-push': 'Storm Push', 'motion-lofi': 'Motion Lo-Fi', 'party-flash': 'Party Flash'}
L = (.2126, .7152, .0722)


def matrix(l):
    s, c = l['sat'], l['contrast']
    sat = [[(1 - s) * L[j] + (s if i == j else 0) for j in range(3)] for i in range(3)]
    off = .5 * (1 - c)
    m = []
    for i in range(3):
        g = l['gain'][i]
        m.append([sat[i][j] * c * g for j in range(3)] + [(off * g + l['lift'][i]) * 255])
    return m


def develop(src, film, day):
    l = LOOKS[film]
    m = matrix(l)
    im = src.convert('RGB').convert('RGB', tuple(v for row in m for v in row))
    w, h = im.size
    # vignette
    vg = Image.new('L', (w, h), 0)
    ImageDraw.Draw(vg).ellipse([-w * .25, -h * .2, w * 1.25, h * 1.2], fill=255)
    vg = vg.filter(ImageFilter.GaussianBlur(w * .12))
    dark = Image.new('RGB', (w, h), (0, 0, 0))
    im = Image.composite(im, Image.blend(im, dark, l['vig']), vg)
    # grain
    noise = Image.effect_noise((w, h), 22).convert('RGB')
    im = Image.blend(im, Image.blend(im, noise, .5), .12)
    # stamp
    d = ImageDraw.Draw(im)
    f = ImageFont.load_default(size=int(w * .035))
    t = f"'{day[2:4]} {day[5:7]} {day[8:10]}"
    tw = d.textlength(t, font=f)
    d.text((w - tw - w * .04, h - w * .08), t, fill=(255, 154, 60), font=f)
    return im


def sql_row(day, name, film, ts):
    code, why = WX.get(film, (0, '평범한 오후'))
    reason = f"{why} — '{NAMES.get(film, film)}'".replace("'", "''")
    return f"INSERT OR REPLACE INTO shots VALUES ('{day}','{name}','{film}','{reason}','{json.dumps({'code': code})}',{ts});"


def from_developed(folder, month, out):
    files = sorted(folder.glob('*.jpg'))
    rnd = random.Random(7)
    sql = []
    for d in [d for d in range(1, 22) if rnd.random() < .72]:
        day = f"{month}-{d:02d}"
        f = rnd.choice(files)
        film = next((k for k in NAMES if f.stem.endswith(k)), 'daily-negative')
        ts = 1790000000000 + d * 86400000
        name = f"{day}-{ts}.jpg"
        (out / name).write_bytes(f.read_bytes())
        sql.append(sql_row(day, name, film, ts))
    (out / 'seed.sql').write_text('\n'.join(sql) + '\n')
    print(len(sql), 'demo days')


def main():
    if Path(sys.argv[1]).is_dir():
        out = Path(sys.argv[3])
        out.mkdir(parents=True, exist_ok=True)
        return from_developed(Path(sys.argv[1]), sys.argv[2], out)
    src = Image.open(sys.argv[1])
    month, out = sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    rnd = random.Random(7)
    films = list(LOOKS)
    days = [d for d in range(1, 22) if rnd.random() < .72]
    sql = []
    W, H = src.size
    for d in days:
        day = f"{month}-{d:02d}"
        film = rnd.choice(films)
        # vary the framing a little
        k = rnd.uniform(.72, .95)
        cw, ch = int(W * k), int(H * k)
        x, y = rnd.randint(0, W - cw), rnd.randint(0, H - ch)
        im = develop(src.crop((x, y, x + cw, y + ch)).resize((900, int(900 * ch / cw))), film, day)
        ts = 1790000000000 + d * 86400000
        name = f"{day}-{ts}.jpg"
        im.save(out / name, quality=88)
        code, why = WX[film]
        wx = json.dumps({"code": code}).replace("'", "''")
        sql.append(f"INSERT OR REPLACE INTO shots VALUES ('{day}','{name}','{film}','{why} — ''{NAMES[film]}''','{wx}',{ts});")
    (out / 'seed.sql').write_text('\n'.join(sql) + '\n')
    print(len(days), 'demo days')


main()
