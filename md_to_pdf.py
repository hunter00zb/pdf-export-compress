#!/usr/bin/env python3
"""
Obsidian Export PDF (+ image compress)
======================================
Markdown to PDF converter with image compression.
Designed to be called from the Obsidian plugin via CLI.

Usage:
    python3 md_to_pdf.py --md /path/to/note.md --vault /path/to/vault [--out output.pdf] [--quality 60] [--max-width 900]

Supports:
    - Obsidian wiki-links: ![[image.png]]
    - Standard Markdown images: ![alt](image.png)
    - Image compression (JPEG, quality adjustable)
    - Chinese fonts (PingFang, STHeiti, Songti)
    - Tables, code blocks, frontmatter stripping
"""

import argparse
import io
import json
import os
import re
import sys
from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate
from reportlab.platypus.frames import Frame

# ─── Font registration ────────────────────────────────────────────────────
FONT_PATHS = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/Library/Fonts/Arial Unicode MS.ttf",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
]

FONT_NORMAL = "SimHei"
FONT_BOLD = "SimHei"

_registered = False
for _fp in FONT_PATHS:
    if os.path.exists(_fp):
        try:
            pdfmetrics.registerFont(TTFont("SimHei", _fp))
            _registered = True
            break
        except Exception:
            continue

if not _registered:
    print("Warning: No Chinese font found. CJK characters may render as blanks.",
          file=sys.stderr)

# ─── Styles ───────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4

_styles = getSampleStyleSheet()


def _make_style(name, **kw):
    base = dict(
        fontName=FONT_NORMAL,
        fontSize=11,
        leading=18,
        textColor=colors.HexColor("#1a1a1a"),
    )
    base.update(kw)
    return ParagraphStyle(name, **base)


STYLE_BODY = _make_style("body")
STYLE_H1 = _make_style(
    "h1", fontSize=18, leading=26, fontName=FONT_BOLD,
    spaceAfter=8, spaceBefore=6,
)
STYLE_H2 = _make_style(
    "h2", fontSize=14, leading=22, fontName=FONT_BOLD,
    spaceAfter=4, spaceBefore=10, borderPadding=(0, 0, 2, 0),
)
STYLE_H3 = _make_style(
    "h3", fontSize=12, leading=20, fontName=FONT_BOLD,
    textColor=colors.HexColor("#333333"), spaceAfter=3, spaceBefore=8,
)
STYLE_H4 = _make_style(
    "h4", fontSize=11, leading=18, fontName=FONT_BOLD,
    textColor=colors.HexColor("#444444"), spaceAfter=2, spaceBefore=6,
)
STYLE_BULLET = _make_style(
    "bullet", leftIndent=16, bulletIndent=8, spaceBefore=1, spaceAfter=1,
)
STYLE_CODE = _make_style(
    "code", fontName="Courier", fontSize=9, leading=14,
    backColor=colors.HexColor("#f5f5f5"), leftIndent=12, rightIndent=12,
    borderPadding=6,
)

TABLE_STYLE = TableStyle([
    ("FONTNAME", (0, 0), (-1, -1), FONT_NORMAL),
    ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("LEADING", (0, 0), (-1, -1), 14),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8f0fe")),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("WORDWRAP", (0, 0), (-1, -1), "CJK"),
])

# ─── Image handling ───────────────────────────────────────────────────────

# Excalidraw rendering support
_EXCALIDRAW_SVG_RENDERER = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         "excalidraw_to_svg.py")


def _is_excalidraw(name: str) -> bool:
    """Check if the filename refers to an excalidraw diagram."""
    n = name.lower()
    return n.endswith(".excalidraw") or ".excalidraw|" in name or n.endswith(".excalidraw.md")


def _find_excalidraw_md(img_name: str, md_dir: str, vault_root: str) -> str | None:
    """Find the .excalidraw.md file for an excalidraw embed."""
    # Strip Obsidian display size modifier: ![[file.excalidraw|400]]
    base = img_name.split("|")[0].strip()

    # Try exact path / relative to MD
    candidates = [os.path.join(md_dir, base)]

    # Also try with .md extension if not already
    if not base.endswith(".md"):
        candidates.append(os.path.join(md_dir, base + ".md"))

    for c in candidates:
        if os.path.exists(c):
            return c

    # Walk nearby dirs
    name_only = os.path.basename(base)
    if not name_only.endswith(".md"):
        name_only_md = name_only + ".md"
    else:
        name_only_md = name_only

    for root, dirs, files in os.walk(md_dir):
        depth = root[len(md_dir):].count(os.sep)
        if depth > 3:
            dirs.clear()
            continue
        for f in files:
            if f == name_only or f == name_only_md:
                return os.path.join(root, f)

    print(f"  Excalidraw file not found: {base}", file=sys.stderr)
    return None


def _render_excalidraw_as_svg(excalidraw_md_path: str) -> str | None:
    """Extract Excalidraw JSON from .excalidraw.md and render to SVG."""
    try:
        content = Path(excalidraw_md_path).read_text(encoding="utf-8")
    except Exception as e:
        print(f"  Failed to read {excalidraw_md_path}: {e}", file=sys.stderr)
        return None

    json_str = None

    # Try compressed-json format (Obsidian Excalidraw plugin)
    match = re.search(r'```compressed-json\s*\n(.*?)\n```', content, re.DOTALL)
    if match:
        try:
            from lzstring import LZString
            # Strip whitespace/newlines from compressed base64 data
            compressed = re.sub(r'\s+', '', match.group(1))
            json_str = LZString.decompressFromBase64(compressed)
            if json_str:
                print(f"  Decompressed {len(compressed)} → {len(json_str)} chars")
        except ImportError:
            print("  lzstring not available for compressed-json", file=sys.stderr)
        except Exception as e:
            print(f"  LZ decompress failed: {e}", file=sys.stderr)

    # Try plain JSON format (excalidraw-cli / manual)
    if not json_str:
        match = re.search(r'```json\s*\n(.*?)\n```', content, re.DOTALL)
        if match:
            json_str = match.group(1).strip()

    # Last resort: find JSON object directly
    if not json_str:
        match = re.search(r'\{[^{]*"elements"\s*:\s*\[.*?\}[^}]*\}', content, re.DOTALL)
        if match:
            json_str = match.group(0)

    if not json_str:
        print(f"  No JSON found in {excalidraw_md_path}", file=sys.stderr)
        return None

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error in {excalidraw_md_path}: {e}", file=sys.stderr)
        return None

    elements = data.get("elements", [])
    if not elements and isinstance(data, list):
        elements = data

    if not elements:
        print(f"  No elements in {excalidraw_md_path}", file=sys.stderr)
        return None

    # Import and render
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from excalidraw_to_svg import render_elements_to_svg

    print(f"  Rendering {len(elements)} Excalidraw elements → SVG")
    return render_elements_to_svg(elements)


def _svg_to_png(svg_str: str, scale: float = 2.0) -> io.BytesIO | None:
    """Convert SVG string to PNG bytes using resvg."""
    try:
        import resvg_py
        png_bytes = resvg_py.svg_to_bytes(svg_str, zoom=2)
        buf = io.BytesIO(png_bytes)
        buf.seek(0)
        return buf
    except ImportError:
        print("  resvg-py not available, falling back to cairosvg", file=sys.stderr)
        try:
            import cairosvg
            png_bytes = cairosvg.svg2png(bytestring=svg_str.encode("utf-8"), scale=scale)
            buf = io.BytesIO(png_bytes)
            buf.seek(0)
            return buf
        except ImportError:
            print("  No SVG→PNG renderer available", file=sys.stderr)
            return None


def _render_excalidraw(excalidraw_md_path: str, max_width: int) -> io.BytesIO | None:
    """Full pipeline: .excalidraw.md → SVG → PNG."""
    svg = _render_excalidraw_as_svg(excalidraw_md_path)
    if not svg:
        return None

    png_buf = _svg_to_png(svg)
    if not png_buf:
        return None

    # Resize if needed
    try:
        with Image.open(png_buf) as im:
            if im.width > max_width:
                ratio = max_width / im.width
                new_size = (max_width, int(im.height * ratio))
                im = im.resize(new_size, Image.LANCZOS)
                out = io.BytesIO()
                im.save(out, format="PNG")
                out.seek(0)
                return out
        png_buf.seek(0)
        return png_buf
    except Exception as e:
        print(f"  Excalidraw resize failed: {e}", file=sys.stderr)
        return None


def _find_image(img_name: str, md_dir: str, vault_root: str) -> str | None:
    """Search for an image across Obsidian-relevant paths."""
    candidates = [
        os.path.join(md_dir, img_name),
    ]

    # Also search current directory with common attachment patterns
    name_only = os.path.basename(img_name)

    # Walk current directory (shallow: 2 levels)
    for root, dirs, files in os.walk(md_dir):
        depth = root[len(md_dir):].count(os.sep)
        if depth > 2:
            dirs.clear()
            continue
        for f in files:
            if f == name_only:
                candidates.append(os.path.join(root, f))

    # Check vault root directly (Obsidian default: pasted images go here)
    if vault_root and os.path.isdir(vault_root) and vault_root != md_dir:
        candidates.append(os.path.join(vault_root, img_name))

    # Walk vault attachment subdirs
    if vault_root and os.path.isdir(vault_root) and vault_root != md_dir:
        attachment_dirs = ["attachments", "assets", "images", "img", "pics"]
        for ad in attachment_dirs:
            ad_path = os.path.join(vault_root, ad)
            if os.path.isdir(ad_path):
                for root, dirs, files in os.walk(ad_path):
                    depth = root[len(ad_path):].count(os.sep)
                    if depth > 3:
                        dirs.clear()
                        continue
                    for f in files:
                        if f == name_only:
                            candidates.append(os.path.join(root, f))

    for c in candidates:
        if os.path.exists(c):
            return c

    print(f"  Image not found: {img_name}", file=sys.stderr)
    return None


def _compress_image(img_path: str, max_width: int, quality: int) -> io.BytesIO | None:
    """Compress an image and return a BytesIO buffer."""
    try:
        with Image.open(img_path) as im:
            # Handle EXIF rotation
            if hasattr(im, "_getexif") and im._getexif():
                from PIL import ImageOps
                im = ImageOps.exif_transpose(im)
            # Convert to RGB
            if im.mode in ("RGBA", "P"):
                im = im.convert("RGB")
            # Resize if wider than max
            if im.width > max_width:
                ratio = max_width / im.width
                new_size = (max_width, int(im.height * ratio))
                im = im.resize(new_size, Image.LANCZOS)
            # Save as JPEG
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=quality, optimize=True)
            buf.seek(0)
            return buf
    except Exception as e:
        print(f"  Image processing failed {img_path}: {e}", file=sys.stderr)
        return None


def _make_image(img_name: str, md_dir: str, vault_root: str,
                max_width: int, quality: int):
    """Find, compress, and return a ReportLab Image flowable.
    Handles: images (.png/.jpg/...) and excalidraw diagrams (.excalidraw/.excalidraw.md)
    """
    from reportlab.platypus import Image as RLImage

    # ═══ Excalidraw rendering ═══
    if _is_excalidraw(img_name):
        print(f"  Excalidraw embed: {img_name}")
        exc_path = _find_excalidraw_md(img_name, md_dir, vault_root)
        if not exc_path:
            return None
        buf = _render_excalidraw(exc_path, max_width)
        if not buf:
            return None
        avail_w = PAGE_W - 4 * cm
        with Image.open(buf) as tmp:
            w_px, h_px = tmp.size
        buf.seek(0)
        scale = min(avail_w / w_px, 1.0)
        return RLImage(buf, width=w_px * scale, height=h_px * scale)

    # ═══ Normal image ═══
    found = _find_image(img_name, md_dir, vault_root)
    if not found:
        return None

    # SVG rendering (PIL cannot open SVG natively)
    if found.lower().endswith('.svg'):
        from pathlib import Path as _Path
        svg_content = _Path(found).read_text(encoding='utf-8')
        buf = _svg_to_png(svg_content)
        if not buf:
            return None
        # Resize + JPEG compress the rendered PNG for PDF
        with Image.open(buf) as im:
            w_px, h_px = im.size
            if im.width > max_width:
                ratio = max_width / im.width
                im = im.resize((max_width, int(im.height * ratio)), Image.LANCZOS)
                w_px, h_px = im.size
            if im.mode in ("RGBA", "P"):
                im = im.convert("RGB")
            out = io.BytesIO()
            im.save(out, format="JPEG", quality=quality, optimize=True)
            out.seek(0)
            buf = out
        avail_w = PAGE_W - 4 * cm
        scale = min(avail_w / w_px, 1.0)
        return RLImage(buf, width=w_px * scale, height=h_px * scale)

    buf = _compress_image(found, max_width, quality)
    if not buf:
        return None

    # Calculate display size
    avail_w = PAGE_W - 4 * cm
    with Image.open(buf) as tmp:
        w_px, h_px = tmp.size
    buf.seek(0)

    scale = min(avail_w / w_px, 1.0)
    return RLImage(buf, width=w_px * scale, height=h_px * scale)


# ─── Markdown parsing ─────────────────────────────────────────────────────


def _escape_xml(text: str) -> str:
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace("\u2b50", "\u2605")  # star emoji
    return text


def _md_inline(text: str) -> str:
    """Process inline Markdown formatting."""
    text = re.sub(r'\*\*\*(.*?)\*\*\*',
                  lambda m: f'<b><i>{_escape_xml(m.group(1))}</i></b>', text)
    text = re.sub(r'\*\*(.*?)\*\*',
                  lambda m: f'<b>{_escape_xml(m.group(1))}</b>', text)
    text = re.sub(r'\*(.*?)\*',
                  lambda m: f'<i>{_escape_xml(m.group(1))}</i>', text)
    text = re.sub(r'`([^`]+)`',
                  lambda m: f'<font name="Courier" size="9" color="#c7254e">{_escape_xml(m.group(1))}</font>', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)',
                  lambda m: f'<u>{_escape_xml(m.group(1))}</u>', text)
    return text


def _parse_table(lines: list[str]):
    """Parse Markdown table lines into a ReportLab Table."""
    data = []
    for line in lines:
        if re.match(r'^\s*\|[-:| ]+\|\s*$', line):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        row = []
        for c in cells:
            clean = re.sub(r'\*\*(.*?)\*\*', r'\1', c)
            clean = re.sub(r'<br\s*/?>', '<br/>', clean)
            clean = _escape_xml(clean)
            p = Paragraph(clean, ParagraphStyle(
                "table_cell", fontName=FONT_NORMAL,
                fontSize=9, leading=14,
                textColor=colors.HexColor("#1a1a1a"),
                wordWrap="CJK",
            ))
            row.append(p)
        data.append(row)

    if not data:
        return None

    avail = PAGE_W - 4 * cm
    n_cols = max(len(r) for r in data)
    col_w = [avail / n_cols] * n_cols

    for r in data:
        while len(r) < n_cols:
            r.append("")

    tbl = Table(data, colWidths=col_w, repeatRows=1, hAlign="LEFT")
    tbl.setStyle(TABLE_STYLE)
    return tbl


def parse_markdown(md_text: str, md_dir: str, vault_root: str,
                   max_width: int, quality: int) -> list:
    """Parse Markdown text into a list of ReportLab Flowables."""
    story = []
    lines = md_text.splitlines()
    i = 0
    in_code_block = False
    code_lines: list[str] = []
    table_lines: list[str] = []

    def flush_table():
        if table_lines:
            tbl = _parse_table(table_lines)
            if tbl:
                story.append(Spacer(1, 4))
                story.append(tbl)
                story.append(Spacer(1, 6))
            table_lines.clear()

    while i < len(lines):
        line = lines[i]

        # Code block
        if line.strip().startswith("```"):
            flush_table()
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                code_text = _escape_xml('\n'.join(code_lines))
                has_cjk = any(ord(ch) > 127 for ch in code_text)
                font_name = "SimHei" if has_cjk else "Courier"
                font_size = "9" if has_cjk else "8"
                code_para = code_text.replace('\n', '<br/>')
                p = Paragraph(
                    f'<font name="{font_name}" size="{font_size}">{code_para}</font>',
                    STYLE_CODE,
                )
                story.append(Spacer(1, 4))
                story.append(p)
                story.append(Spacer(1, 4))
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Table row
        if line.strip().startswith("|"):
            table_lines.append(line)
            i += 1
            continue
        else:
            flush_table()

        stripped = line.strip()

        # Horizontal rule
        if re.match(r'^---+$', stripped) or re.match(r'^\*\*\*+$', stripped):
            story.append(HRFlowable(
                width="100%", thickness=0.5,
                color=colors.HexColor("#dddddd"),
                spaceAfter=4, spaceBefore=4,
            ))
            i += 1
            continue

        # Obsidian wiki-link image: ![[image.png]] or ![[image.png|alt]]
        img_match = re.match(r'!\[\[(.+?)\]\]', stripped)
        if img_match:
            img_ref = img_match.group(1)
            # Handle ![[image.png|alt text]]
            img_name = img_ref.split('|')[0].strip()
            rl_img = _make_image(img_name, md_dir, vault_root, max_width, quality)
            if rl_img:
                story.append(Spacer(1, 6))
                story.append(rl_img)
                story.append(Spacer(1, 6))
            i += 1
            continue

        # Standard Markdown image: ![alt](path)
        std_img_match = re.match(r'!\[.*?\]\((.+?)\)', stripped)
        if std_img_match:
            img_path = std_img_match.group(1)
            rl_img = _make_image(img_path, md_dir, vault_root, max_width, quality)
            if rl_img:
                story.append(Spacer(1, 6))
                story.append(rl_img)
                story.append(Spacer(1, 6))
            i += 1
            continue

        # Heading
        h_match = re.match(r'^(#{1,4})\s+(.*)', stripped)
        if h_match:
            level = len(h_match.group(1))
            title = _md_inline(_escape_xml(h_match.group(2)))
            st = [STYLE_H1, STYLE_H2, STYLE_H3, STYLE_H4][min(level - 1, 3)]
            if level == 1:
                story.append(Spacer(1, 10))
            story.append(Paragraph(title, st))
            i += 1
            continue

        # Unordered list
        bullet_match = re.match(r'^[-*+]\s+(.*)', stripped)
        if bullet_match:
            text = _md_inline(_escape_xml(bullet_match.group(1)))
            story.append(Paragraph(f'\u2022 {text}', STYLE_BULLET))
            i += 1
            continue

        # Ordered list
        ol_match = re.match(r'^(\d+)\.\s+(.*)', stripped)
        if ol_match:
            n = ol_match.group(1)
            text = _md_inline(_escape_xml(ol_match.group(2)))
            story.append(Paragraph(f'{n}. {text}', STYLE_BULLET))
            i += 1
            continue

        # Empty line
        if not stripped:
            story.append(Spacer(1, 6))
            i += 1
            continue

        # Paragraph
        text = _md_inline(_escape_xml(stripped))
        story.append(Paragraph(text, STYLE_BODY))
        i += 1

    flush_table()
    return story


# ─── Main ─────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(
        description="Obsidian Export PDF (+ image compress) - MD to PDF with image compression"
    )
    parser.add_argument("--md", required=True, help="Path to the Markdown file")
    parser.add_argument("--vault", required=True, help="Path to the Obsidian vault root")
    parser.add_argument("--out", help="Output PDF path (default: same dir as MD, same basename)")
    parser.add_argument("--quality", type=int, default=60,
                        help="JPEG compression quality 0-100 (default: 60)")
    parser.add_argument("--max-width", type=int, default=900,
                        help="Max image width in pixels (default: 900)")

    args = parser.parse_args()

    md_path = args.md
    vault_root = args.vault
    quality = max(0, min(100, args.quality))
    max_width = args.max_width

    if not os.path.exists(md_path):
        print(f"Error: Markdown file not found: {md_path}", file=sys.stderr)
        sys.exit(1)

    md_dir = os.path.dirname(os.path.abspath(md_path))

    # Determine output path
    if args.out:
        out_path = args.out
    else:
        basename = os.path.splitext(os.path.basename(md_path))[0]
        out_path = os.path.join(md_dir, basename + '.pdf')

    # Read Markdown
    print(f"Reading: {md_path}")
    md_text = Path(md_path).read_text(encoding="utf-8")

    # ═══ Excalidraw guard: bail out early if any excalidraw refs found ═══
    excalidraw_refs = re.findall(r'!\[\[[^]]*\.excalidraw[^]]*\]\]', md_text)
    if excalidraw_refs:
        print("", file=sys.stderr)
        print("⚠️  检测到 Excalidraw 格式图片，无法直接导出 PDF。", file=sys.stderr)
        print("", file=sys.stderr)
        for ref in excalidraw_refs:
            print(f"    {ref}", file=sys.stderr)
        print("", file=sys.stderr)
        print("操作提示：请在 Obsidian 中将 Excalidraw 图导出为 PNG，", file=sys.stderr)
        print("再替换 MD 中的引用，然后重新执行导出。", file=sys.stderr)
        print("", file=sys.stderr)
        sys.exit(1)

    # Strip YAML frontmatter
    if md_text.startswith("---"):
        end = md_text.find("---", 3)
        if end != -1:
            md_text = md_text[end + 3:].lstrip()

    # Parse
    print("Parsing Markdown...")
    story = parse_markdown(md_text, md_dir, vault_root, max_width, quality)

    if not story:
        print("Warning: No content found after parsing.", file=sys.stderr)

    # Generate PDF
    print(f"Generating PDF: {out_path}")
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2.5 * cm, bottomMargin=2.5 * cm,
        title=os.path.basename(md_path),
    )
    doc.build(story)

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"Done! PDF size: {size_mb:.1f} MB")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
