"""Optimize the user-supplied icon and poster for web use.

Source (kept as backup):
  icon.png            (1254x1254 PNG, 1.2MB)
  OPCUA Tutorial.png  (1536x1024 PNG, 2.1MB)

Outputs (in images/):
  icon-256.png        256x256 PNG  -> sidebar logo & tutorials.html card
  icon-512.png        512x512 PNG  -> retina / @2x
  poster.jpg          1200xN JPEG  -> tutorial hero featured image
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).parent
SRC_ICON = ROOT / "icon.png"
SRC_POSTER = ROOT / "OPCUA Tutorial.png"
OUT = ROOT / "images"

# Icon - PNG with reasonable transparency-friendly compression
icon = Image.open(SRC_ICON)
icon_256 = icon.resize((256, 256), Image.LANCZOS)
icon_256.save(OUT / "icon-256.png", "PNG", optimize=True)
icon_512 = icon.resize((512, 512), Image.LANCZOS)
icon_512.save(OUT / "icon-512.png", "PNG", optimize=True)

# Poster - JPEG, 1200px wide, preserve aspect
poster = Image.open(SRC_POSTER).convert("RGB")
ratio = 1200 / poster.width
new_h = int(poster.height * ratio)
poster_web = poster.resize((1200, new_h), Image.LANCZOS)
poster_web.save(OUT / "poster.jpg", "JPEG", quality=85, optimize=True, progressive=True)

print(f"icon-256.png  256x256  {(OUT / 'icon-256.png').stat().st_size/1024:.0f} KB")
print(f"icon-512.png  512x512  {(OUT / 'icon-512.png').stat().st_size/1024:.0f} KB")
print(f"poster.jpg   1200x{new_h}  {(OUT / 'poster.jpg').stat().st_size/1024:.0f} KB")
