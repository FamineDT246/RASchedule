"""Extract tables and text from the uploaded Robot Adventure schedule PDF."""
import pdfplumber
import json
from pathlib import Path

PDF_PATH = "/home/z/my-project/upload/DOC-20260708-WA0015..pdf"
OUT_DIR = Path("/home/z/my-project/scripts/extracted")
OUT_DIR.mkdir(parents=True, exist_ok=True)

all_text = []
all_tables = []

with pdfplumber.open(PDF_PATH) as pdf:
    for i, page in enumerate(pdf.pages, 1):
        text = page.extract_text() or ""
        all_text.append(f"\n\n========== PAGE {i} ==========\n{text}")
        tables = page.extract_tables()
        for j, tbl in enumerate(tables, 1):
            all_tables.append({
                "page": i,
                "table_index": j,
                "rows": tbl,
            })

(OUT_DIR / "text.txt").write_text("".join(all_text), encoding="utf-8")
(OUT_DIR / "tables.json").write_text(
    json.dumps(all_tables, indent=2, ensure_ascii=False), encoding="utf-8"
)

print(f"Pages: {len(all_text)}")
print(f"Tables found: {len(all_tables)}")
for t in all_tables:
    print(f"  - Page {t['page']} Table {t['table_index']}: {len(t['rows'])} rows x {len(t['rows'][0]) if t['rows'] else 0} cols")
print(f"\nText length: {sum(len(t) for t in all_text)} chars")
print(f"\nOutputs:")
print(f"  {OUT_DIR / 'text.txt'}")
print(f"  {OUT_DIR / 'tables.json'}")
