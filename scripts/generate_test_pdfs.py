#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["reportlab", "pillow"]
# ///
"""Generate sample PDFs named like 'АББР фонд-опис-справа. Якась назва.pdf'.

Generates two kinds of files so both upload code paths can be exercised:

  * small  — a single-page vector PDF, a few KB. Below the 5 MiB threshold, so
             the app uploads it directly (non-chunked).
  * large  — padded with incompressible random-noise images to exceed a target
             size (default 6 MiB), so the app switches to the chunked path.
             Use --large-mb above 10 to also exercise the async assembly path.

Run:
  uv run generate_test_pdfs.py                  # 10 small + 2 large (~6 MiB)
  uv run generate_test_pdfs.py --small 5 --large 3 --large-mb 12
  uv run generate_test_pdfs.py --small 0 --large 1   # just one big file
"""
import argparse
import io
import math
import os
import random
from pathlib import Path

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

OUT_DIR = Path(__file__).resolve().parent / "tmp-pdfs"

# Matches LARGE_FILE_THRESHOLD / CHUNK_SIZE in src/upload/upload.ts (5 MiB).
CHUNK_THRESHOLD_BYTES = 5 * 1024 * 1024

# Side length of each random-noise image used to pad large PDFs. Random RGB data
# is incompressible, so each image contributes ~ px * px * 3 bytes to the file,
# which lets us hit a target size in a predictable number of pages.
NOISE_PX = 1024
PER_NOISE_BYTES = NOISE_PX * NOISE_PX * 3

ARCHIVES = [
    "ЦДІАК", "ЦДІАЛ", "ЦДАВО", "ЦДАГОУ", "ДААРК", "ДАВіО", "ДАВоО",
    "ДАДнО", "ДАДоО", "ДАЖО", "ДАЗкО", "ДАЗпО", "ДАІФО", "ДАКО", "ДАК",
    "ДАКрО", "ДАЛуО", "ДАЛО", "ДАМО", "ДАОО", "ДАПО", "ДАРО", "ДАС",
    "ДАСО", "ДАТО", "ДАХО", "ДАХеО", "ДАХмО", "ДАЧкО", "ДАЧвО", "ДАЧгО",
    "ІР НБУВ", "ГДА СБУ", "КУІзА",
]

SMALL_TITLES = ["Тест", "Документи", "Перевірка"]
LARGE_TITLES = ["Великий скан", "Багатосторінкова справа", "Скан-копія"]


def sanitize(name: str) -> str:
    return name.replace("/", "_").replace("\\", "_")


def render_pdf(meta: dict, label: str, noise_images: int, rng: random.Random) -> bytes:
    """Render a PDF to bytes: one text page plus `noise_images` padding pages."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 16)
    c.drawString(60, h - 80, label)
    c.setFont("Helvetica", 12)
    c.drawString(60, h - 110, f"fond={meta['fond']}, opys={meta['opys']}, sprava={meta['sprava']}")
    c.drawString(60, h - 140, "Placeholder content for development.")
    c.showPage()

    for _ in range(noise_images):
        # Fresh random bytes per page so nothing dedupes/compresses away.
        data = rng.randbytes(PER_NOISE_BYTES)
        img = Image.frombytes("RGB", (NOISE_PX, NOISE_PX), data)
        c.drawImage(ImageReader(img), 0, 0, width=w, height=h, preserveAspectRatio=False)
        c.showPage()

    c.save()
    return buf.getvalue()


def build_pdf_bytes(meta: dict, label: str, target_bytes: int | None, rng: random.Random) -> bytes:
    """Build a PDF, padding with noise pages until it reaches target_bytes (if set)."""
    if target_bytes is None:
        return render_pdf(meta, label, noise_images=0, rng=rng)

    n = max(1, math.ceil(target_bytes / PER_NOISE_BYTES))
    # Image encoding overhead is hard to predict exactly; render and, if we fell
    # short, add pages for the remaining deficit and retry. Converges in 1-2 passes.
    while True:
        data = render_pdf(meta, label, noise_images=n, rng=rng)
        if len(data) >= target_bytes:
            return data
        n += max(1, math.ceil((target_bytes - len(data)) / PER_NOISE_BYTES))


def make_meta(rng: random.Random) -> dict:
    return {
        "archive": rng.choice(ARCHIVES),
        "fond": rng.randint(1, 999),
        "opys": rng.randint(1, 50),
        "sprava": rng.randint(1, 5000),
    }


def write_pdf(out_dir: Path, meta: dict, title: str, idx: int, target_bytes: int | None, rng: random.Random) -> Path:
    filename = f"{meta['archive']} {meta['fond']}-{meta['opys']}-{meta['sprava']}. {title}.pdf"
    path = out_dir / sanitize(filename)
    label = f"Test PDF #{idx}"
    data = build_pdf_bytes(meta, label, target_bytes, rng)
    path.write_bytes(data)
    return path


def human_size(num: int) -> str:
    mib = num / (1024 * 1024)
    return f"{mib:.1f} MiB" if mib >= 1 else f"{num / 1024:.0f} KiB"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--small", type=int, default=10, help="number of small (non-chunked) PDFs (default 10)")
    parser.add_argument("--large", type=int, default=2, help="number of large (chunked) PDFs (default 2)")
    parser.add_argument(
        "--large-mb", type=float, default=6.0,
        help="target size of each large PDF in MiB (default 6.0; >10 also exercises async assembly)",
    )
    parser.add_argument("--out", type=Path, default=OUT_DIR, help=f"output directory (default {OUT_DIR})")
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducible names (default 42)")
    args = parser.parse_args()

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)

    target_bytes = round(args.large_mb * 1024 * 1024)
    if args.large > 0 and target_bytes <= CHUNK_THRESHOLD_BYTES:
        print(
            f"  ! --large-mb {args.large_mb} is below the {CHUNK_THRESHOLD_BYTES // (1024 * 1024)} MiB "
            "chunk threshold; these files will NOT be chunked."
        )

    idx = 0
    for _ in range(args.small):
        idx += 1
        path = write_pdf(out_dir, make_meta(rng), rng.choice(SMALL_TITLES), idx, None, rng)
        print(f"  ✓ small  {human_size(path.stat().st_size):>9}  {path.name}")

    for _ in range(args.large):
        idx += 1
        path = write_pdf(out_dir, make_meta(rng), rng.choice(LARGE_TITLES), idx, target_bytes, rng)
        print(f"  ✓ large  {human_size(path.stat().st_size):>9}  {path.name}")

    print(f"\nGenerated {args.small} small + {args.large} large PDFs in {out_dir}")


if __name__ == "__main__":
    main()
