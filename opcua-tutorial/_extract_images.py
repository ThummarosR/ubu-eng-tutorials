"""Extract embedded images from the OPC UA brochure PDF.

Strategy:
- Walk each page, list embedded images with size + dimensions.
- Skip tiny ones (< 5KB or < 100px wide) — those are decorative bullets/icons.
- Save the rest with a name like p07_img02.png so we can map back to pages.
- Print a manifest at the end.
"""
import fitz
from pathlib import Path

PDF = r"C:\Users\Thummaros\Desktop\OPC-UA-Interoperability-For-Industrie4-and-IoT-EN.pdf"
OUT = Path(r"C:\Users\Thummaros\Desktop\school-agent-platform\labwork-tutorials\opcua-tutorial\images\raw")
OUT.mkdir(parents=True, exist_ok=True)

MIN_W = 200
MIN_BYTES = 8 * 1024  # 8KB

doc = fitz.open(PDF)
manifest = []
saved = 0
skipped = 0

for pi, page in enumerate(doc, start=1):
    images = page.get_images(full=True)
    for ii, img in enumerate(images, start=1):
        xref = img[0]
        try:
            pix = fitz.Pixmap(doc, xref)
        except Exception as e:
            skipped += 1
            continue

        w, h = pix.width, pix.height
        if w < MIN_W:
            skipped += 1
            pix = None
            continue

        # CMYK / alpha handling
        if pix.n - pix.alpha >= 4:
            pix = fitz.Pixmap(fitz.csRGB, pix)

        # Write to memory first to check size
        png_bytes = pix.tobytes("png")
        if len(png_bytes) < MIN_BYTES:
            skipped += 1
            pix = None
            continue

        name = f"p{pi:02d}_img{ii:02d}.png"
        (OUT / name).write_bytes(png_bytes)
        manifest.append((name, pi, w, h, len(png_bytes)))
        saved += 1
        pix = None

print(f"Saved {saved} images, skipped {skipped} (too small)")
print(f"Output: {OUT}")
print()
print(f"{'File':<22} {'Page':>4} {'WxH':>12} {'KB':>6}")
print("-" * 50)
for name, pi, w, h, sz in manifest:
    print(f"{name:<22} {pi:>4} {w:>5}x{h:<5} {sz/1024:>6.1f}")
