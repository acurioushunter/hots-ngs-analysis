"""Print the players (battletag, Heroes Profile id) in the saved NGS games that have no Storm League MMR yet.
Usage: python scripts/sl_mmr_todo.py   -> JSON list for PL in scripts/hp_pull_sl_mmr.js (players already in knowledge/raw/sl_mmr/ or players_hp/ are skipped)."""
import glob, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "knowledge"
have = set()
for p in glob.glob(str(ROOT / "raw" / "players_hp" / "*_*")):
    have.add(pathlib.Path(p).name.rsplit("_", 1)[1])
for p in glob.glob(str(ROOT / "raw" / "sl_mmr" / "*.json")):
    have.add(pathlib.Path(p).stem)
have.add("8186800")  # hunterstag has his own full pull
need = {}
for d in ("matches", "other_divisions"):
    for f in glob.glob(str(ROOT / "raw" / "ngs" / d / "*.json")):
        for side in json.loads(pathlib.Path(f).read_text(encoding="utf-8"))["players"]:
            for p in side:
                if p.get("blizz_id") and str(p["blizz_id"]) not in have:
                    need[p["battletag"]] = p["blizz_id"]
print(json.dumps([[k, v] for k, v in need.items()], ensure_ascii=True, separators=(",", ":")))
