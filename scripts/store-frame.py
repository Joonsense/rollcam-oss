# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1"]
# ///
"""Store screenshots 1080x1920: caption on darkroom black + the app screen.
uv run scripts/store-frame.py           (reads store/out/raw-*, writes store/out/screenshot-N.png)
uv run scripts/store-frame.py --lang en|ja (store/out/<lang>/raw-* -> store/out/<lang>/screenshot-N.png, captions in that language;
                                         play-publish uses a language folder when it has screenshots)"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "store" / "out"
FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
W, H = 1080, 1920
BG = (14, 13, 12)
CAPS = [
    ("raw-1-camera.png", "하루에 딱 한 장", "찍기 전에는 오늘의 필름을 몰라요"),
    ("raw-2-developed.png", "필름은 날씨가 고릅니다", "찍고 나면 왜 그 필름인지 한 줄로"),
    ("raw-3-roll.png", "한 달이면 36칸 롤", "못 찍은 날은 그날 하늘 색으로"),
    ("raw-4-filmbook.png", "날씨마다 오는 필름을 모으세요", "어떤 날씨에 어떤 필름이 오는지"),
    ("raw-5-print.jpg", "인화지 한 장으로 공유", "필름·날짜·그날 날씨까지"),
]
# English UI screens from a restored demo roll (scripts/demo-roll.py --zip en) on a release build
CAPS_EN = [
    ("raw-1-developed.png", "One photo a day", "The weather picks the film, and tells you why"),
    ("raw-2-photo.png", "Film that fits the day", "Golden Roll at sunset, Rainy Mono in the rain"),
    ("raw-3-roll.png", "A roll for every month", "Missed days keep the color of their sky"),
    ("raw-4-filmbook.png", "Collect every film", "Each kind of weather brings its own"),
    ("raw-5-lines.png", "A line for every day", "Then play the month back like a film"),
]
CAPS_JA = [
    ("raw-1-developed.png", "一日一枚だけのカメラ", "フィルムは天気が選び、理由を一行で"),
    ("raw-2-photo.png", "その日に合うフィルム", "夕焼けには Golden Roll、雨には Rainy Mono"),
    ("raw-3-roll.png", "ひと月で一本のロール", "撮らなかった日は、その日の空の色で"),
    ("raw-4-filmbook.png", "フィルムを集める", "天気ごとにやってくるフィルムがある"),
    ("raw-5-lines.png", "毎日に一行を", "そしてひと月を映画のように再生"),
]
JA_FONT = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc", "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"
LANG = sys.argv[sys.argv.index("--lang") + 1] if "--lang" in sys.argv else None


def font(size, bold):
    if LANG == "ja":
        return ImageFont.truetype(JA_FONT[0 if bold else 1], size)
    # AppleSDGothicNeo.ttc: index 6 = Bold, 0 = Regular (macOS ordering)
    return ImageFont.truetype(FONT, size, index=6 if bold else 0)


def main():
    out = OUT / LANG if LANG else OUT
    for i, (raw, title, sub) in enumerate({"en": CAPS_EN, "ja": CAPS_JA}.get(LANG, CAPS), 1):
        canvas = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(canvas)
        ft, fs = font(76, True), font(40, False)
        d.text((W / 2, 170), title, font=ft, fill=(242, 236, 228), anchor="mm")
        d.text((W / 2, 262), sub, font=fs, fill=(255, 154, 60), anchor="mm")
        shot = Image.open(out / raw).convert("RGB")
        if raw.endswith(".jpg"):
            # a share image, not a phone screen: as large as fits under the caption
            k = min((H - 380) / shot.height, (W - 120) / shot.width)
        else:
            # phone screen: drop the status bar, keep the app
            shot = shot.crop((0, 90, shot.width, shot.height))
            target_h = H - 360
            k = target_h / shot.height
        shot = shot.resize((int(shot.width * k), int(shot.height * k)), Image.LANCZOS)
        x, y = (W - shot.width) // 2, 330
        # soft shadow + rounded mask
        r = 44
        mask = Image.new("L", shot.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], radius=r, fill=255)
        sh = Image.new("L", (W, H), 0)
        ImageDraw.Draw(sh).rounded_rectangle([x - 6, y + 10, x + shot.width + 6, y + shot.height + 18], radius=r, fill=150)
        canvas.paste((0, 0, 0), (0, 0), sh.filter(ImageFilter.GaussianBlur(24)))
        canvas.paste(shot, (x, y), mask)
        d.rounded_rectangle([x, y, x + shot.width - 1, y + shot.height - 1], radius=r, outline=(42, 38, 34), width=3)
        canvas.save(out / f"screenshot-{i}.png")
    print("screens", len(CAPS))


main()


def feature():
    """Play feature graphic 1024x500."""
    g = Image.new("RGB", (1024, 500), BG)
    icon = Image.open(ROOT / "store" / "icon-512.png").convert("RGB").resize((380, 380), Image.LANCZOS)
    g.paste(icon, (60, 60))
    d = ImageDraw.Draw(g)
    d.text((480, 170), "ROLLCAM", font=font(84, True), fill=(242, 236, 228))
    d.text((484, 280), "하루 한 장,", font=font(40, False), fill=(255, 154, 60))
    d.text((484, 334), "필름은 날씨가 고른다", font=font(40, False), fill=(255, 154, 60))
    g.save(ROOT / "store" / "feature-1024x500.png")
    print("feature")


if not LANG:
    feature()
