#!/usr/bin/env python3
"""
Excalidraw JSON → SVG renderer

Converts .excalidraw elements (rectangles, text, arrows) to SVG.
Designed for professional-style diagrams (roughness=0, straight lines).
Integrated into the pdf-export-compress pipeline.
"""
import json
import sys
import os
from pathlib import Path

# Map Excalidraw fontFamily to SVG font-family
FONT_MAP = {2: "Helvetica", 1: "Virgil", 3: "Cascadia"}


def escape_xml(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def render_elements_to_svg(elements, padding=40, bg="#ffffff"):
    """Render Excalidraw elements to SVG string."""
    if not elements:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'

    # First pass: compute bounding box (all elements use absolute coordinates)
    min_x, min_y, max_x, max_y = float("inf"), float("inf"), 0, 0
    for el in elements:
        el_type = el.get("type", "")
        x, y = el.get("x", 0), el.get("y", 0)
        w, h = el.get("width", 0), el.get("height", 0)
        if w <= 0 and el_type == "text":
            txt = el.get("text", "")
            if not txt:
                continue
            font_sz = el.get("fontSize", 14)
            w = max(len(txt) * font_sz * 0.6, 100)
            h = font_sz * 1.4
        if el_type == "rectangle":
            label = el.get("label")
            if label and isinstance(label, dict):
                lt = label.get("text", "")
                lfs = label.get("fontSize", 14)
                lw = max(len(lt) * lfs * 0.65, w)
                w = max(w, lw)
        if w > 0 and h > 0:
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x + w)
            max_y = max(max_y, y + h)

    if min_x == float("inf"):
        return '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'

    svg_w = max_x - min_x + padding * 2
    svg_h = max_y - min_y + padding * 2

    # Collect containerId text mappings
    container_texts = {}  # rect_id -> [text_elements]
    for el in elements:
        if el.get("type") == "text" and el.get("containerId"):
            cid = el["containerId"]
            container_texts.setdefault(cid, []).append(el)

    # Build SVG
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{svg_w}" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}">',
        f'<rect width="{svg_w}" height="{svg_h}" fill="{bg}"/>',
    ]

    def tx(x):
        return x - min_x + padding

    def ty(y):
        return y - min_y + padding

    for el in elements:
        el_type = el.get("type", "")

        if el_type == "rectangle":
            x, y, w, h = el.get("x", 0), el.get("y", 0), el.get("width", 0), el.get("height", 0)
            bg_c = el.get("backgroundColor", "transparent")
            stroke_c = el.get("strokeColor", "#000")
            sw = el.get("strokeWidth", 1)
            fill = el.get("fillStyle", "solid")
            roughness = el.get("roughness", 0)
            roundness = el.get("roundness", {})
            rn_type = roundness.get("type", 1) if isinstance(roundness, dict) else 1

            rx = 0 if rn_type == 1 else (8 if rn_type == 3 else 2)

            rx_svg = tx(x)
            ry_svg = ty(y)

            if fill == "solid" and bg_c != "transparent":
                parts.append(
                    f'<rect x="{rx_svg}" y="{ry_svg}" width="{w}" height="{h}" '
                    f'rx="{rx}" ry="{rx}" fill="{bg_c}" stroke="{stroke_c}" stroke-width="{sw}"/>'
                )
            else:
                parts.append(
                    f'<rect x="{rx_svg}" y="{ry_svg}" width="{w}" height="{h}" '
                    f'rx="{rx}" ry="{rx}" fill="none" stroke="{stroke_c}" stroke-width="{sw}"/>'
                )

            # Render label (if any)
            label = el.get("label")
            if label and isinstance(label, dict) and not container_texts.get(el.get("id")):
                lt = label.get("text", "")
                lfs = label.get("fontSize", 14)
                lc = label.get("strokeColor", "#000")
                ff = FONT_MAP.get(el.get("fontFamily", 2), "Helvetica")
                ta = "middle"  # label is centered by default
                lx = tx(x) + w / 2
                # Baseline = top of rect + half height + ~0.3*fontSize
                # This visually centers single-line text within the rectangle
                ly = ty(y) + h / 2 + lfs * 0.35
                parts.append(
                    f'<text x="{lx}" y="{ly}" text-anchor="{ta}" '
                    f'font-family="{ff}" font-size="{lfs}" fill="{lc}">{escape_xml(lt)}</text>'
                )

            # Render bound texts (containerId) — use absolute coordinates
            ct = container_texts.get(el.get("id"), [])
            for te in ct:
                ttxt = te.get("text", "")
                tfs = te.get("fontSize", 13)
                tc = te.get("strokeColor", "#000")
                tff = FONT_MAP.get(te.get("fontFamily", 2), "Helvetica")
                tta = te.get("textAlign", "center")
                tva = te.get("verticalAlign", "top")

                # text x/y are ABSOLUTE coordinates (not relative to container)
                ctx = tx(te.get("x", 0))
                cty = ty(te.get("y", 0))
                tw = te.get("width", w)

                anchor_map = {"center": "middle", "left": "start", "right": "end"}
                anchor = anchor_map.get(tta, "middle")
                text_x = ctx
                if anchor == "middle":
                    text_x = ctx + tw / 2
                elif anchor == "end":
                    text_x = ctx + tw

                # Avoid dominant-baseline (inconsistent across SVG renderers).
                # Use y-offset to simulate vertical alignment:
                #   top    → baseline = y + fontSize
                #   middle → baseline = y + fontSize * 0.35 (visual center)
                #   bottom → baseline = y
                if tva == "top":
                    text_y = cty + tfs
                elif tva == "middle":
                    text_y = cty + tfs * 0.35
                else:
                    text_y = cty

                parts.append(
                    f'<text x="{text_x}" y="{text_y}" '
                    f'text-anchor="{anchor}" '
                    f'font-family="{tff}" font-size="{tfs}" fill="{tc}">{escape_xml(ttxt)}</text>'
                )

        elif el_type == "arrow":
            points = el.get("points", [])
            x, y, w, h = el.get("x", 0), el.get("y", 0), el.get("width", 0), el.get("height", 0)
            stroke_c = el.get("strokeColor", "#000")
            sw = el.get("strokeWidth", 1)
            stroke_dash = el.get("strokeStyle", "solid")

            if points and len(points) >= 2:
                # Arrow coordinates are relative to the arrow's own bounding box
                p0x = tx(x + points[0][0])
                p0y = ty(y + points[0][1])
                p1x = tx(x + points[-1][0])
                p1y = ty(y + points[-1][1])

                dash_str = 'stroke-dasharray="6,4"' if stroke_dash == "dashed" else ""
                arrowhead = el.get("endArrowhead", "")
                marker_id = None
                if arrowhead == "arrow":
                    marker_id = f"arrow_{hash(p1x)}_{hash(p1y)}"
                    arrow_color = stroke_c
                    parts.insert(2,
                        f'<defs><marker id="{marker_id}" markerWidth="8" markerHeight="8" '
                        f'refX="7" refY="4" orient="auto">'
                        f'<polygon points="0,0 8,4 0,8" fill="{arrow_color}"/>'
                        f'</marker></defs>'
                    )

                line = (
                    f'<line x1="{p0x}" y1="{p0y}" x2="{p1x}" y2="{p1y}" '
                    f'stroke="{stroke_c}" stroke-width="{sw}" '
                )
                if dash_str:
                    line += dash_str + " "
                if marker_id:
                    line += f'marker-end="url(#{marker_id})" '
                line += "/>"
                parts.append(line)

            # Arrow label
            label = el.get("label")
            if label and isinstance(label, dict):
                lt = label.get("text", "")
                lfs = label.get("fontSize", 12)
                lc = label.get("strokeColor", stroke_c)
                ff = "Helvetica"
                if points and len(points) >= 2:
                    mid_x = tx(x + (points[0][0] + points[-1][0]) / 2)
                    mid_y = ty(y + (points[0][1] + points[-1][1]) / 2) - 8
                    parts.append(
                        f'<text x="{mid_x}" y="{mid_y}" text-anchor="middle" '
                        f'font-family="{ff}" font-size="{lfs}" fill="{lc}">{escape_xml(lt)}</text>'
                    )

        elif el_type == "text" and not el.get("containerId"):
            # Standalone text
            x, y, w, h = el.get("x", 0), el.get("y", 0), el.get("width", 0), el.get("height", 0)
            txt = el.get("text", "")
            fs = el.get("fontSize", 14)
            tc = el.get("strokeColor", "#000")
            ff = FONT_MAP.get(el.get("fontFamily", 2), "Helvetica")
            ta = el.get("textAlign", "left")
            anchor = {"center": "middle", "left": "start", "right": "end"}.get(ta, "start")

            lines = txt.split("\n")
            if lines:
                lh = fs * 1.4
                for li, line_text in enumerate(lines):
                    parts.append(
                        f'<text x="{tx(x)}" y="{ty(y + li * lh + fs)}" '
                        f'text-anchor="{anchor}" font-family="{ff}" font-size="{fs}" fill="{tc}">'
                        f'{escape_xml(line_text)}</text>'
                    )

    parts.append("</svg>")
    return "\n".join(parts)


def main():
    if len(sys.argv) < 2:
        print("Usage: excalidraw_to_svg.py <input.excalidraw> [output.svg]", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace(".excalidraw", ".svg")

    with open(input_file, "r") as f:
        data = json.load(f)

    elements = data.get("elements", [])
    if not elements and isinstance(data, list):
        elements = data

    print(f"Rendering {len(elements)} elements → {output_file}")
    svg = render_elements_to_svg(elements)
    Path(output_file).write_text(svg, encoding="utf-8")
    print(f"✅ SVG: {len(svg)} bytes")


if __name__ == "__main__":
    main()
