"""A light single file copy of the Draft Room (HotS Drafter): hots_drafter_lite.html.

Keeps the draft board, recommendations, Prep, heroes, maps and learn pages, the next opponent and our team. Drops what is only needed for browsing
other teams and long reading: the league wide team and player tables (data.league, 2.3 MB: the Team tab then offers only our team and the
division teams already in the data), hero ability text and build write ups (the hero sheet shows builds and talents, not the Abilities tab).
Reads playbook/data.json and playbook/library.json, so run build_playbook.py first."""
import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import build_playbook as bp

data = json.loads((ROOT / "playbook" / "data.json").read_text(encoding="utf-8"))
lib = json.loads((ROOT / "playbook" / "library.json").read_text(encoding="utf-8"))
data.pop("league", None)
for h in lib["heroes"].values():
    h.pop("abilities", None)
    h.pop("build_notes", None)
frag = bp.build_tool(data, lib)
page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
        + frag + "</body></html>")
out = ROOT / "hots_drafter_lite.html"
out.write_text(page, encoding="utf-8")
print("hots_drafter_lite.html %.2f MB (full draft_tool.html %.2f MB)" % (out.stat().st_size / 1e6, (ROOT / "draft_tool.html").stat().st_size / 1e6))
