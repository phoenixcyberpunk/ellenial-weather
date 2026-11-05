"""Turns Ellen's 1024 px Procreate drawings in this folder into the page's icons in icons/w/.
Each drawing is re-centred in the same 840 px window and saved at 144 px (3x of 48).
Wind is drawn with thin strokes, so it is thickened first to match the others' weight.
Run from the repo root:  python3 art/weather-icons/build.py
"""
import os
from PIL import Image, ImageFilter

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SRC, "..", "..", "icons", "w")
NAMES = ["sun", "clear", "mix-day", "mix-night", "cloudy", "rain", "snow", "wind", "breeze"]
SIZE = 144
THICKEN = {"wind": 17}  # px of dilation at 1024 px
WINDOW = 840  # px of the 1024 canvas shown; the drawings fill roughly 700–800 of it

os.makedirs(OUT, exist_ok=True)
for name in NAMES:
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
    if name in THICKEN:
        r, g, b = 0x7F, 0xA9, 0x8E  # Wind sage
        a = im.getchannel("A").filter(ImageFilter.MaxFilter(THICKEN[name])).filter(ImageFilter.GaussianBlur(1.5))
        im = Image.new("RGBA", im.size, (r, g, b, 0)); im.putalpha(a)
    # Same window for every icon, so the sizes Ellen drew stay relative to each other
    # (a wide cloud stays as big as the sun); each drawing is only re-centred in it.
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    side = max(WINDOW, int(max(x1 - x0, y1 - y0) * 1.04))
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(im.crop((x0, y0, x1, y1)), ((side - (x1 - x0)) // 2, (side - (y1 - y0)) // 2))
    sq.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, name + ".png"), optimize=True)
    print(name, os.path.getsize(os.path.join(OUT, name + ".png")), "bytes")
