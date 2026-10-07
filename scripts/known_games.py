"""Print the replay ids of the NGS games already saved, as a JSON list, for scripts/hp_pull_division.js.
Run: python scripts/known_games.py"""
import json, pathlib
d = pathlib.Path(__file__).resolve().parent.parent / "knowledge" / "raw" / "ngs" / "matches"
print(json.dumps(sorted(int(p.stem) for p in d.glob("*.json"))))
