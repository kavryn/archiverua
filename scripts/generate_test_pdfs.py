#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["reportlab"]
# ///
"""Generate sample PDFs named like 'АББР фонд-опис-справа. Якась назва.pdf'.

Run: uv run generate_test_pdfs.py
"""
import random
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

OUT_DIR = Path(__file__).resolve().parent / "tmp-pdfs"
COUNT = 20

ARCHIVES = [
    "ЦДІАК", "ЦДІАЛ", "ЦДАВО", "ЦДАГОУ", "ДААРК", "ДАВіО", "ДАВоО",
    "ДАДнО", "ДАДоО", "ДАЖО", "ДАЗкО", "ДАЗпО", "ДАІФО", "ДАКО", "ДАК",
    "ДАКрО", "ДАЛуО", "ДАЛО", "ДАМО", "ДАОО", "ДАПО", "ДАРО", "ДАС",
    "ДАСО", "ДАТО", "ДАХО", "ДАХеО", "ДАХмО", "ДАЧкО", "ДАЧвО", "ДАЧгО",
    "ІР НБУВ", "ГДА СБУ", "КУІзА",
]

TITLES = [
    "Тест",
    "Документи",
    "Перевірка"
]


def sanitize(name: str) -> str:
    return name.replace("/", "_").replace("\\", "_")


def main() -> None:
    OUT_DIR.mkdir(exist_ok=True)
    rng = random.Random(42)

    for i in range(COUNT):
        archive = rng.choice(ARCHIVES)
        fond = rng.randint(1, 999)
        opys = rng.randint(1, 50)
        sprava = rng.randint(1, 5000)
        title = rng.choice(TITLES)
        filename = f"{archive} {fond}-{opys}-{sprava}. {title}.pdf"
        path = OUT_DIR / sanitize(filename)

        c = canvas.Canvas(str(path), pagesize=A4)
        w, h = A4
        c.setFont("Helvetica-Bold", 16)
        c.drawString(60, h - 80, f"Test PDF #{i + 1}")
        c.setFont("Helvetica", 12)
        c.drawString(60, h - 110, f"fond={fond}, opys={opys}, sprava={sprava}")
        c.drawString(60, h - 140, "Placeholder content for development.")
        c.showPage()
        c.save()
        print(f"  v {path.name}")

    print(f"\nGenerated {COUNT} PDFs in {OUT_DIR}")


if __name__ == "__main__":
    main()
