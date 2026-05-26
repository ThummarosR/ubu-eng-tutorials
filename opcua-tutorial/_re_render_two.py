"""Re-render PDF pages 3 and 11 at 300 DPI so the originals are preserved
even though we already harvested the crops from them."""
import pymupdf
from pathlib import Path

PDF = r"C:\Users\Thummaros\Desktop\OPC-UA-Interoperability-For-Industrie4-and-IoT-EN.pdf"
OUT = Path(r"C:\Users\Thummaros\Desktop\school-agent-platform\labwork-tutorials\opcua-tutorial\images\raw\pages")

DPI = 300
zoom = DPI / 72
mat = pymupdf.Matrix(zoom, zoom)

doc = pymupdf.open(PDF)
for idx, label in [(3, "page03_brochure4-5_iiot-source.png"),
                   (11, "page11_brochure20-21_specparts-source.png")]:
    pix = doc[idx - 1].get_pixmap(matrix=mat, alpha=False)
    pix.save(OUT / label)
    print(f"  {label}  {pix.width}x{pix.height}")
doc.close()
