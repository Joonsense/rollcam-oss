# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""ROLLCAM icon set: one film frame with sprocket holes, a sun low in a warm sky.
uv run scripts/make-icons.py  -> assets/*.png"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "assets"
BASE = (14, 13, 12)
STRIP = (30, 27, 24)
HOLE = (14, 13, 12)
S = 4  # supersample


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def emblem(size: int, sky=True, mono=False) -> Image.Image:
    """Film frame emblem on transparent bg, drawn in a size x size box."""
    W = size * S
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # film strip band
    sw, sh = int(W * 0.86), int(W * 0.70)
    sx, sy = (W - sw) // 2, (W - sh) // 2
    col = (255, 255, 255, 255) if mono else STRIP + (255,)
    d.rounded_rectangle([sx, sy, sx + sw, sy + sh], radius=int(W * 0.06), fill=col)
    # sprocket holes
    n, hw, hh = 5, int(W * 0.075), int(W * 0.05)
    gap = (sw - n * hw) / (n + 1)
    for row_y in (sy + int(sh * 0.07), sy + sh - int(sh * 0.07) - hh):
        for i in range(n):
            x = sx + gap * (i + 1) + hw * i
            d.rounded_rectangle([x, row_y, x + hw, row_y + hh], radius=int(hh * 0.3), fill=(0, 0, 0, 0) if mono else HOLE + (255,))
    # frame window
    fw, fh = int(sw * 0.80), int(sh * 0.56)
    fx, fy = (W - fw) // 2, (W - fh) // 2
    if mono:
        d.rounded_rectangle([fx, fy, fx + fw, fy + fh], radius=int(W * 0.025), fill=(0, 0, 0, 0))
        cx, cy, r = W // 2, fy + int(fh * 0.62), int(fh * 0.24)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
        return im.resize((size, size), Image.LANCZOS)
    sky_im = Image.new("RGBA", (fw, fh))
    top, mid, bot = (58, 44, 92), (232, 120, 70), (255, 196, 110)
    for y in range(fh):
        t = y / (fh - 1)
        c = lerp(top, mid, t / 0.6) if t < 0.6 else lerp(mid, bot, (t - 0.6) / 0.4)
        ImageDraw.Draw(sky_im).line([(0, y), (fw, y)], fill=c + (255,))
    # sun + glow
    glow = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy, r = fw // 2, int(fh * 0.66), int(fh * 0.22)
    gd.ellipse([cx - r * 2, cy - r * 2, cx + r * 2, cy + r * 2], fill=(255, 210, 140, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(r * 0.8))
    sky_im = Image.alpha_composite(sky_im, glow)
    sd = ImageDraw.Draw(sky_im)
    sd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 236, 200, 255))
    # horizon
    hy = int(fh * 0.80)
    sd.rectangle([0, hy, fw, fh], fill=(40, 26, 32, 255))
    mask = Image.new("L", (fw, fh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, fw - 1, fh - 1], radius=int(W * 0.025), fill=255)
    im.paste(sky_im, (fx, fy), mask)
    return im.resize((size, size), Image.LANCZOS)


def solid(size, color):
    return Image.new("RGBA", (size, size), color + (255,))


def main():
    # iOS / generic icon: full bleed dark base + emblem
    icon = solid(1024, BASE)
    icon.alpha_composite(emblem(1024))
    icon.convert("RGB").save(OUT / "icon.png")
    # Android adaptive: content must sit inside the central 66% safe zone
    fg = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    fg.alpha_composite(emblem(320), (96, 96))
    fg.save(OUT / "android-icon-foreground.png")
    solid(512, BASE).save(OUT / "android-icon-background.png")
    mono = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    mono.alpha_composite(emblem(320, mono=True), (96, 96))
    mono.save(OUT / "android-icon-monochrome.png")
    splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    splash.alpha_composite(emblem(560), (232, 232))
    splash.save(OUT / "splash-icon.png")
    icon.convert("RGB").resize((48, 48), Image.LANCZOS).save(OUT / "favicon.png")
    # Play store hi-res icon
    (OUT.parent / "store").mkdir(exist_ok=True)
    icon.convert("RGB").resize((512, 512), Image.LANCZOS).save(OUT.parent / "store" / "icon-512.png")
    print("icons written")


main()
