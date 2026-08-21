#!/usr/bin/env python3
"""scaffold.py — 3D World one-command starter.

Reads a brand-brief.json and scaffolds a complete, ready-to-render project:
the folder structure, a filled manifest.json, an index.html wired to the
engine, the scrub-engine itself, and a prompts/ folder with the exact still +
connector prompts the agent should feed to its image tool.

After scaffolding, the only remaining work is (1) generate the stills with the
image tool using prompts/*.txt, then (2) render each into a real scrubbable
video clip with motion_render.py. Both steps are printed as next steps.

Usage:
  python3 scripts/scaffold.py brand-brief.json            # -> ./site
  python3 scripts/scaffold.py brand-brief.json -o ./myweb # custom output dir
  python3 scripts/scaffold.py --example                   # write an example brief

brand-brief.json schema (all optional except brand.name + sections):
{
  "brand":    { "name", "pitch", "page_title", "background", "accent" },
  "palette":  ["#hex", ...],
  "style":    { "art_direction": "clay diorama|papercraft|glossy toy|neon night|
                 isometric sci-fi|watercolor|photoreal|...", "style_preamble": "..." },
  "mode":     "video",            // video (default) | image
  "runway":   700,  "crossfade": 0.15,
  "camera":   "fly-through",      // informational (affects suggested moves only)
  "sections": [ { "id","label","eyebrow","title","body","tags[]",
                  "subject", "move","duration","scroll","linger" } ],
  "connector_motifs": ["dense cloud bank", ...],   // N-1 motifs
  "cta":      { "eyebrow","headline","sub","button","href","showAt" }
}
"""
import argparse
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)          # 3d-world/
ENGINE_SRC = os.path.join(SKILL, "references", "scrub-engine.js")
TEMPLATE = os.path.join(SKILL, "references", "index-template.html")

ART_PREAMBLES = {
    "clay diorama": "Isometric low-poly 3D diorama floating as a small rounded island on a plain solid {BG} background with a soft contact shadow beneath it. Soft matte clay 3D render, rounded toy-model shapes, gentle warm studio lighting, soft long shadows, tilt-shift miniature look.",
    "papercraft": "Isometric layered paper-craft diorama on a plain solid {BG} background, matte cardstock, clean die-cut edges, subtle drop shadows between layers.",
    "glossy toy": "Isometric glossy vinyl-toy diorama on a plain solid {BG} background, smooth plastic shading, soft rim light, collectible figurine look.",
    "claymation": "Isometric stop-motion clay set on a plain solid {BG} background, visible thumbprints, handmade plasticine texture, soft studio softbox light.",
    "neon night": "Isometric miniature at night on a plain solid {BG} background, warm interior glow and neon signage, moody rim light, wet reflective ground.",
    "isometric sci-fi": "Isometric hard-surface sci-fi diorama on a plain solid {BG} background, matte gunmetal-and-accent panels, soft rim light, tiny glowing status lights, spacecraft and machinery.",
    "watercolor": "Hand-painted watercolor storybook illustration on a plain solid {BG} background, soft granulated paper texture, gentle ink outlines, airy pastel light.",
    "photoreal": "Ultra-photorealistic architectural photography, cinematic wide-angle, warm golden-hour light, natural materials, restrained designer furnishings, editorial magazine quality, shallow depth of field, no people.",
}

DEFAULT_MOVE = {
    "first": "push",
    "last": "rise",
    "mid": "drift",
}


def build_style_preamble(brief):
    style = brief.get("style", {}) or {}
    if style.get("style_preamble"):
        return style["style_preamble"].rstrip()
    bg = brief.get("brand", {}).get("background", "#0B1E3A")
    palette = brief.get("palette", [])
    ad = (style.get("art_direction") or "clay diorama").strip().lower()
    # map slightly loose names
    for key in ART_PREAMBLES:
        if key in ad or ad in key:
            ad = key
            break
    preamble = ART_PREAMBLES.get(ad, ART_PREAMBLES["clay diorama"]).format(BG=bg)
    tail = "Cohesive color palette of %s." % (", ".join(palette)) if palette else ""
    no_text = "Highly detailed, centered composition, absolutely no text, no letters, no numbers, no logos, no watermark."
    return " ".join(x for x in (preamble, tail, no_text) if x)


def write_prompts(out_prompts, brief, preamble, connectors):
    os.makedirs(out_prompts, exist_ok=True)
    files = []
    for s in brief["sections"]:
        path = os.path.join(out_prompts, "still_%s.txt" % s["id"])
        with open(path, "w") as f:
            f.write("%s\nSubject: %s" % (preamble, s.get("subject", s["id"])))
        files.append(path)
    for i, motif in enumerate(connectors, 1):
        path = os.path.join(out_prompts, "conn_%d.txt" % i)
        with open(path, "w") as f:
            f.write("Abstract seamless transition frame: %s filling the entire frame edge to edge, like flying into it, no ground, no horizon. %s"
                    % (motif, preamble))
        files.append(path)
    return files


def build_manifest(brief, connectors):
    sections = []
    n = len(brief["sections"])
    for idx, s in enumerate(brief["sections"]):
        move = s.get("move") or (DEFAULT_MOVE["last"] if idx == n - 1
                                 else DEFAULT_MOVE["first"] if idx == 0 else DEFAULT_MOVE["mid"])
        sections.append({
            "id": s["id"],
            "label": s.get("label", "%02d" % (idx + 1)),
            "eyebrow": s.get("eyebrow", ""),
            "title": s.get("title", ""),
            "body": s.get("body", ""),
            "tags": s.get("tags", []),
            "still": "img/%s.jpg" % s["id"],
            "clip": "video/%s.mp4" % s["id"],
            "poster": "img/%s.jpg" % s["id"],
            "duration": s.get("duration", 6),
            "scroll": s.get("scroll", 1.2),
            "linger": s.get("linger", 0.8),
            "_move": move,          # used by the printed render step; harmless in manifest
        })
    conns = []
    for i, motif in enumerate(connectors, 1):
        conns.append({
            "id": "c%d" % i,
            "label": motif,
            "still": "img/conn%d.jpg" % i,
            "clip": "video/conn%d.mp4" % i,
            "poster": "img/conn%d.jpg" % i,
            "duration": 2.4,
            "_move": "push",
            "_z1": 1.5,
        })
    manifest = {
        "version": 1,
        "mode": brief.get("mode", "video"),
        "runway": brief.get("runway", 700),
        "crossfade": brief.get("crossfade", 0.15),
        "background": brief.get("brand", {}).get("background", "#0B1E3A"),
        "brand": {"name": brief["brand"]["name"]},
        "sections": sections,
        "connectors": conns,
        "cta": brief.get("cta", {}),
    }
    return manifest


def write_index(out_index, brief):
    with open(TEMPLATE) as f:
        html = f.read()
    brand = brief.get("brand", {})
    name = brand.get("name", "Brand")
    replacements = {
        "{{BRAND_NAME}}": name,
        "{{PAGE_TITLE}}": brand.get("page_title", "Scroll World"),
        "{{ONE_LINE_PITCH}}": brand.get("pitch", ""),
        "{{BG_HEX}}": brand.get("background", "#0B1E3A"),
        "{{YEAR}}": "2026",
        "scrub-engine.js": "js/scrub-engine.js",
    }
    for k, v in replacements.items():
        html = html.replace(k, v)
    # set mode to manifest value so engine honors it
    mode = brief.get("mode", "video")
    html = html.replace("mode: 'auto',", "mode: '%s'," % mode)
    with open(out_index, "w") as f:
        f.write(html)


def main():
    ap = argparse.ArgumentParser(description="Scaffold a 3D World project from a brand-brief.json.")
    ap.add_argument("brief", nargs="?", help="path to brand-brief.json")
    ap.add_argument("-o", "--out", default="site", help="output directory (default: ./site)")
    ap.add_argument("--example", action="store_true", help="write an example brand-brief.json and exit")
    args = ap.parse_args()

    if args.example:
        example = {
            "brand": {"name": "Northlight Expeditions", "pitch": "One world. One journey.",
                      "page_title": "One World. One Journey.",
                      "background": "#0B1E3A", "accent": "#6FC7C0"},
            "palette": ["#0B1E3A", "#6FC7C0", "#8DFCA1", "#F5EDE0", "#C88A5A"],
            "style": {"art_direction": "clay diorama"},
            "mode": "video", "runway": 700, "crossfade": 0.15, "camera": "fly-through",
            "sections": [
                {"id": "trailhead", "label": "01 — Trailhead", "eyebrow": "DAY 01",
                 "title": "Where the journey starts", "body": "A warm lodge and a winding trail.",
                 "tags": ["Lodges", "Dawn"],
                 "subject": "a warm mountain lodge with a winding trail, string lights, and morning mist"},
                {"id": "valley", "label": "02 — The Crossing", "eyebrow": "DAY 02",
                 "title": "Cross the glacier lake", "body": "Turquoise water and wildflower meadows.",
                 "tags": ["Glacier Lake", "Wildflowers"],
                 "subject": "a turquoise glacier lake with a wooden canoe, wildflower meadows, and distant peaks"},
                {"id": "camp", "label": "03 — Base Camp", "eyebrow": "THE FINALE",
                 "title": "Warm fire. Full sky.", "body": "This is what we came for.",
                 "tags": ["Campfire", "Aurora"],
                 "subject": "a cozy base camp with a campfire, tents, and a telescope under the aurora"},
            ],
            "connector_motifs": ["dense cloud bank", "radiant light tunnel"],
            "cta": {"eyebrow": "READY WHEN YOU ARE", "headline": "See it for real.",
                    "sub": "One continuous flight. Your brand could be next.",
                    "button": "Plan your expedition", "href": "https://example.com", "showAt": 0.94},
        }
        with open("brand-brief.example.json", "w") as f:
            json.dump(example, f, indent=2)
        print("wrote brand-brief.example.json — copy it, fill it in, then:")
        print("  python3 scripts/scaffold.py brand-brief.json -o site")
        return

    if not args.brief:
        ap.error("pass a brand-brief.json (or --example to get a template)")

    with open(args.brief) as f:
        brief = json.load(f)
    if "brand" not in brief or "sections" not in brief or not brief["sections"]:
        sys.exit("error: brief needs 'brand.name' and a non-empty 'sections' list")

    out = args.out
    for sub in ("img", "video", "js", "prompts"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    # copy engine
    shutil.copy(ENGINE_SRC, os.path.join(out, "js", "scrub-engine.js"))

    connectors = brief.get("connector_motifs") or ["dense cloud bank"] * max(0, len(brief["sections"]) - 1)
    connectors = connectors[: max(0, len(brief["sections"]) - 1)]
    if len(connectors) < len(brief["sections"]) - 1:
        connectors += ["dense cloud bank"] * (len(brief["sections"]) - 1 - len(connectors))

    preamble = build_style_preamble(brief)
    prompt_files = write_prompts(os.path.join(out, "prompts"), brief, preamble, connectors)

    manifest = build_manifest(brief, connectors)
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    write_index(os.path.join(out, "index.html"), brief)

    # ---- next steps ----
    move_by_id = {s["id"]: s["_move"] for s in manifest["sections"]}
    dur_by_id = {s["id"]: s["duration"] for s in manifest["sections"]}

    disp = out if os.path.isabs(out) else "./%s" % out
    print("Scaffolded project in %s" % disp)
    print("  js/scrub-engine.js  (copied engine)")
    print("  manifest.json       (mode=%s)" % manifest["mode"])
    print("  index.html          (wired to engine + manifest)")
    print("  img/  video/  prompts/")
    print()
    print("NEXT STEPS — this is what the agent must do to finish:")
    print("1. Generate stills with the image tool, one per file in prompts/ (the style")
    print("   preamble is already embedded in every prompt file). Save each to:")
    for s in brief["sections"]:
        print("     img/%s.jpg  <- prompts/still_%s.txt" % (s["id"], s["id"]))
    for i in range(1, len(connectors) + 1):
        print("     img/conn%d.jpg  <- prompts/conn_%d.txt" % (i, i))
    print("2. Render each still into a real scrubbable clip (Mode A):")
    for s in brief["sections"]:
        print("     python3 scripts/motion_render.py img/%s.jpg video/%s.mp4 --move %s --dur %s"
              % (s["id"], s["id"], move_by_id[s["id"]], dur_by_id[s["id"]]))
    for i in range(1, len(connectors) + 1):
        print("     python3 scripts/motion_render.py img/conn%d.jpg video/conn%d.mp4 --move push --z1 1.5 --dur 2.4" % (i, i))
    print("3. Serve it:  python3 -m http.server 8000  (from %s)" % disp)
    print("   Scroll the hero to confirm it scrubs smoothly. Then add the rest of the")
    print("   page's content below the world, per SKILL.md.")


if __name__ == "__main__":
    main()
