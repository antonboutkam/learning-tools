"""Maak een compacte, statische catalogus van de meegeleverde Fritzing-onderdelen.

Gebruik: python3 build_library.py
"""

import json
from pathlib import Path
from xml.etree import ElementTree as ET

BASE = Path(__file__).resolve().parent
PARTS = BASE / "fritzing" / "parts"
OUTPUT = BASE / "library.json"
SVGS = {path.relative_to(PARTS).as_posix() for path in (PARTS / "svg").glob("**/*.svg")}


def image_path(section, image):
    if not image:
        return None
    target = Path("svg") / section / image
    if target.as_posix() not in SVGS:
        return None
    return (Path("fritzing") / "parts" / target).as_posix()


entries = []
for section in ("core", "contrib", "user", "obsolete"):
    for source in sorted((PARTS / section).glob("*.fzp")):
        try:
            root = ET.parse(source).getroot()
        except ET.ParseError:
            continue
        title = (root.findtext("title") or source.stem).strip()
        family = next((p.text for p in root.findall("./properties/property") if p.get("name") == "family"), None)
        breadboard = root.find("./views/breadboardView/layers")
        icon = root.find("./views/iconView/layers")
        image = image_path(section, breadboard.get("image") if breadboard is not None else None)
        icon_image = image_path(section, icon.get("image") if icon is not None else None)
        entries.append({
            "id": f"{section}/{source.name}",
            "title": title,
            "category": (family or "Overig").strip(),
            "section": section,
            "tags": [tag.text.strip() for tag in root.findall("./tags/tag") if tag.text],
            "image": image,
            "icon": icon_image or image,
        })

section_order = {"core": 0, "contrib": 1, "user": 2, "obsolete": 3}
entries.sort(key=lambda item: (not bool(item["image"]), section_order[item["section"]], item["category"].casefold(), item["title"].casefold(), item["id"]))
OUTPUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(entries)} onderdelen; {sum(bool(item['image']) for item in entries)} met breadboard-SVG; {OUTPUT.stat().st_size} bytes")
