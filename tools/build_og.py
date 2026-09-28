"""Render the PNG images of the site from their SVG sources:

    assets/img/og.png               1200x630 Open Graph / Twitter card image, from assets/img/og.svg (dark palette)
    assets/img/favicon-32.png       32x32 PNG fallback of assets/img/favicon.svg
    assets/img/apple-touch-icon.png 180x180 home-screen icon (full-bleed square: iOS rounds the corners itself)

Usage: python tools/build_og.py      (needs: pip install cairosvg, plus the native Cairo library)
"""
import sys
from pathlib import Path

import cairosvg

sys.dont_write_bytecode = True

IMG = Path(__file__).resolve().parents[1] / "assets" / "img"

# The favicon mark on a full square (no transparent corners), with some padding around the gate.
APPLE_TOUCH_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="-3 -3 38 38">
  <rect x="-3" y="-3" width="38" height="38" fill="#0f1b2d"/>
  <rect x="5" y="6" width="22" height="4" rx="1.5" fill="#fbfaf7"/>
  <rect x="8" y="10" width="4" height="16" rx="1" fill="#fbfaf7"/>
  <rect x="20" y="10" width="4" height="16" rx="1" fill="#fbfaf7"/>
  <rect x="12" y="16" width="8" height="3" rx="1" fill="#62b7d6"/>
</svg>"""

if __name__ == "__main__":
    cairosvg.svg2png(url=str(IMG / "og.svg"), write_to=str(IMG / "og.png"), output_width=1200, output_height=630)
    cairosvg.svg2png(url=str(IMG / "favicon.svg"), write_to=str(IMG / "favicon-32.png"), output_width=32, output_height=32)
    cairosvg.svg2png(bytestring=APPLE_TOUCH_SVG.encode("utf-8"), write_to=str(IMG / "apple-touch-icon.png"),
                     output_width=180, output_height=180)
    for name in ("og.png", "favicon-32.png", "apple-touch-icon.png"):
        print(IMG / name)
