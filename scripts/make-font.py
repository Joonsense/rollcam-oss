# /// script
# requires-python = ">=3.11"
# dependencies = ["fonttools>=4.47"]
# ///
"""Dev only: subset Pretendard (SIL OFL 1.1) to what the share image draws:
all 11,172 Hangul syllables, ASCII and a little punctuation. (0.3.x shipped
only the 2,350 KS X 1001 syllables, so a line like '똠양꿍' lost letters in
share images; every syllable costs about 1MB a weight.) The OFL reserves the name "Pretendard" for unmodified fonts, so
the subset is renamed "RollcamSans"; assets/fonts/OFL.txt carries the license.
uv run scripts/make-font.py <Pretendard-Regular.otf> <Pretendard-Bold.otf>"""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'fonts'
FAMILY = 'RollcamSans'


def hangul() -> str:
    return ''.join(chr(c) for c in range(0xAC00, 0xD7A4))


TEXT = hangul() + ''.join(chr(c) for c in range(0x20, 0x7F)) + '·°—–…‘’“”%/·'


def rename(font: TTFont, style: str) -> None:
    names = {1: FAMILY, 2: style, 3: f'{FAMILY}-{style};subset of Pretendard 1.3.9', 4: f'{FAMILY} {style}', 6: f'{FAMILY}-{style}', 16: FAMILY, 17: style}
    table = font['name']
    for rec in list(table.names):
        if rec.nameID in names or rec.nameID in (21, 22):
            table.removeNames(nameID=rec.nameID)
    for nid, val in names.items():
        table.setName(val, nid, 3, 1, 0x409)
        table.setName(val, nid, 1, 0, 0)
    if 'CFF ' in font:
        cff = font['CFF '].cff
        cff.fontNames = [f'{FAMILY}-{style}']
        top = cff.topDictIndex[0]
        top.FamilyName = FAMILY
        top.FullName = f'{FAMILY} {style}'


for src, style in zip(sys.argv[1:3], ('Regular', 'Bold')):
    opts = subset.Options()
    opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl']
    opts.name_IDs = ['*']
    font = TTFont(src)
    sub = subset.Subsetter(opts)
    sub.populate(text=TEXT)
    sub.subset(font)
    rename(font, style)
    out = OUT / f'{FAMILY}-{style}.otf'
    font.save(out)
    hangul = sum(1 for c in font.getBestCmap() if 0xAC00 <= c <= 0xD7A3)
    print(out.name, out.stat().st_size, 'bytes,', hangul, 'hangul')
