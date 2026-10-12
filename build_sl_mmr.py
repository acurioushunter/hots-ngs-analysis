"""Collect Storm League MMR for NGS players into knowledge/sl_mmr.json (blizz_id -> [mmr, rank, wins, losses]).
Only Storm League (game type sl) is used, never the other game types.
Sources : knowledge/raw/players_hp/<tag>_<id>/sl_profile.json (earlier pulls), knowledge/raw/hunter/hp/sl/profile.json,
          knowledge/raw/sl_mmr/<id>.json (one small player/sl response per player, from scripts/hp_pull_sl_mmr.js)
Run     : python build_sl_mmr.py
"""
import glob, json, pathlib, re

ROOT = pathlib.Path(__file__).parent / "knowledge"


def rd(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def row(j):
    m = j.get("sl_mmr_data") if isinstance(j.get("sl_mmr_data"), dict) else None
    if not m or m.get("mmr") is None:
        return None
    return [m["mmr"], m.get("rank_tier"), m.get("win"), m.get("loss")]


def main():
    out = {}
    for p in glob.glob(str(ROOT / "raw" / "players_hp" / "*" / "sl_profile.json")):
        bid = pathlib.Path(p).parent.name.rsplit("_", 1)[1]
        r = row(rd(p))
        if r:
            out[bid] = r
    for p in glob.glob(str(ROOT / "raw" / "sl_mmr" / "*.json")):
        d = rd(p)
        r = row(d["profile"]) if d.get("profile") else None
        if r and d.get("blizz_id"):
            out[str(d["blizz_id"])] = r
    hp = ROOT / "raw" / "hunter" / "hp" / "sl" / "profile.json"
    if hp.exists():
        r = row(rd(hp))
        if r:
            out["8186800"] = r
    (ROOT / "sl_mmr.json").write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(len(out), "players with a Storm League MMR")


if __name__ == "__main__":
    main()
