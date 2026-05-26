"""Produce web-ready, half-spread crops of the diagram pages.

For most pages, the key diagram sits on the right half (the verso/recto pair
puts text left, diagram right). For a few, the diagram spans both halves.
Each entry below says which crop to take and what to name it.
"""
from PIL import Image
from pathlib import Path

RAW = Path(r"C:\Users\Thummaros\Desktop\school-agent-platform\labwork-tutorials\opcua-tutorial\images\raw\pages")
OUT = Path(r"C:\Users\Thummaros\Desktop\school-agent-platform\labwork-tutorials\opcua-tutorial\images")
OUT.mkdir(parents=True, exist_ok=True)

# (source_file, crop, output_name, target_width)
# crop: "left" | "right" | "full" | (x1, y1, x2, y2) tuple in source pixels
JOBS = [
    # ch01 — Industrie 4.0 / IoT / M2M
    ("page03_p04-05_iot-4-m2m-venn.png", "right", "01-iot-4-m2m-venn.jpg", 900),
    # ch01 — RAMI 4.0 (already extracted as embedded image, just resize+optimize)
    # ch02 — OPC UA at a glance + layer model
    ("page13_p22-23_at-a-glance.png", "right", "02-uniform-object.jpg", 1100),
    ("page13_p22-23_at-a-glance.png", "left",  "02-layer-model.jpg",    1100),
    # ch03 — Address space tree
    ("page14_p24-25_layer-model-addressspace.png", "right", "03-address-space.jpg", 1100),
    # ch04+05 — PubSub message flow + services overview
    ("page15_p26-27_services-pubsub.png", "right", "05-pubsub-flow.jpg", 1200),
    # ch02 — Abstract UA model pyramid (left side of spread 28-29)
    ("page16_p28-29_abstract-meta-model.png", "left", "02-abstract-pyramid.jpg", 800),
    # ch06 — Security: scalable security concept
    ("page17_p30-31_security.png", "left", "06-security-layers.jpg", 1200),
    # ch08 — Field Level Communications system architecture
    ("page18_p32-33_field-level-comm.png", "full", "08-flc-architecture.jpg", 1600),
    # ch09 — Cloud reference architecture
    ("page19_p34-35_cloud-initiative.png", "full", "09-cloud-reference.jpg", 1600),
    # ch09 — Azure Industrial IoT ref architecture
    ("page36_p70-71_sap-azure.png", "right", "09-azure-ref-arch.jpg", 1300),
    # ch09 — SAP MES integration
    ("page36_p70-71_sap-azure.png", "left",  "09-sap-mes.jpg", 1100),
]

def crop_image(im: Image.Image, mode):
    w, h = im.size
    if mode == "full":
        return im
    if mode == "left":
        return im.crop((0, 0, w // 2, h))
    if mode == "right":
        return im.crop((w // 2, 0, w, h))
    if isinstance(mode, tuple):
        return im.crop(mode)
    raise ValueError(f"unknown crop: {mode}")

print(f"{'output':<32} {'WxH':>14} {'KB':>6}")
print("-" * 56)
total = 0
for src, crop, name, target_w in JOBS:
    im = Image.open(RAW / src).convert("RGB")
    im = crop_image(im, crop)
    # Resize maintaining aspect
    ratio = target_w / im.width
    new_h = int(im.height * ratio)
    im = im.resize((target_w, new_h), Image.LANCZOS)
    # Strip white margins on left/right (best-effort)
    out_path = OUT / name
    im.save(out_path, "JPEG", quality=82, optimize=True, progressive=True)
    sz = out_path.stat().st_size
    total += sz
    print(f"{name:<32} {target_w:>5}x{new_h:<6} {sz/1024:>6.1f}")

# Also copy the RAMI 4.0 diagram from the embedded extraction
src_rami = Path(r"C:\Users\Thummaros\Desktop\school-agent-platform\labwork-tutorials\opcua-tutorial\images\raw\p04_img01.png")
if src_rami.exists():
    im = Image.open(src_rami).convert("RGB")
    if im.width > 900:
        ratio = 900 / im.width
        im = im.resize((900, int(im.height * ratio)), Image.LANCZOS)
    out_path = OUT / "01-rami-4.0.jpg"
    im.save(out_path, "JPEG", quality=85, optimize=True)
    sz = out_path.stat().st_size
    total += sz
    print(f"{'01-rami-4.0.jpg':<32} {im.width:>5}x{im.height:<6} {sz/1024:>6.1f}")

print("-" * 56)
print(f"{'TOTAL':<32} {'':>14} {total/1024:>6.1f}")
