"""Render selected PDF pages as PNG (diagrams are vector, so embedded-image
extraction misses them).

Spread layout: each PDF page is a 2-brochure-page spread. We render at
~150 DPI for readable diagrams.
"""
import pymupdf
from pathlib import Path

PDF = r"C:\Users\Thummaros\Desktop\OPC-UA-Interoperability-For-Industrie4-and-IoT-EN.pdf"
OUT = Path(r"C:\Users\Thummaros\Desktop\school-agent-platform\labwork-tutorials\opcua-tutorial\images\raw\pages")
OUT.mkdir(parents=True, exist_ok=True)

# PDF page -> brochure spread label
PAGES = {
    3: "p04-05_iot-4-m2m-venn",
    13: "p22-23_at-a-glance",
    14: "p24-25_layer-model-addressspace",
    15: "p26-27_services-pubsub",
    16: "p28-29_abstract-meta-model",
    17: "p30-31_security",
    18: "p32-33_field-level-comm",
    19: "p34-35_cloud-initiative",
    36: "p70-71_sap-azure",
    11: "p18-19_history-facts",
}

DPI = 300
zoom = DPI / 72
mat = pymupdf.Matrix(zoom, zoom)

doc = pymupdf.open(PDF)
for idx, label in PAGES.items():
    page = doc[idx - 1]  # 0-based
    pix = page.get_pixmap(matrix=mat, alpha=False)
    name = f"page{idx:02d}_{label}.png"
    pix.save(OUT / name)
    print(f"  {name}  {pix.width}x{pix.height}  {(OUT/name).stat().st_size/1024:.0f} KB")
doc.close()
print(f"\nDone. Output: {OUT}")
