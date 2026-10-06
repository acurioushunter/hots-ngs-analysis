"""Build knowledge/players_hp.db from the raw Storm League pulls of the other Div C West players.

Input : knowledge/raw/players_hp/<tag>_<id>/{overview_all,sl_profile,sl_heroes,sl_maps,sl_roles,sl_heroes_s32..s34}.json
Output: knowledge/players_hp.db
Run   : python build_players_hp.py ; python test_players_hp.py
"""
import json, pathlib, re, sqlite3

ROOT = pathlib.Path(__file__).parent / "knowledge"
RAW = ROOT / "raw" / "players_hp"
DB_PATH = ROOT / "players_hp.db"
DIR_NAME = re.compile(r"^(?P<tag>.+)_(?P<id>\d+)$")
SEASON_FILES = {"s34": "sl_heroes_s34.json", "s33": "sl_heroes_s33.json", "s32": "sl_heroes_s32.json"}

SCHEMA = """
CREATE TABLE sp_player(tag TEXT, blizz_id INT, sl_wins INT, sl_losses INT, sl_win_rate REAL, sl_mmr INT, sl_rank TEXT,
                       all_wins INT, all_losses INT, all_win_rate REAL);
CREATE TABLE sp_hero(tag TEXT, blizz_id INT, scope TEXT, hero TEXT, role TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE sp_map(tag TEXT, blizz_id INT, map TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE sp_role(tag TEXT, blizz_id INT, role TEXT, games INT, wins INT, losses INT, win_rate REAL);
"""


def load_list(path):
    """Return the JSON list in path, or None when the file is missing or holds an error message."""
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else None


def load_profile(path):
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) and "wins" in data else None


def player_row(tag, blizz_id, sl, overall):
    mmr = sl.get("sl_mmr_data") if isinstance(sl.get("sl_mmr_data"), dict) else {}
    return (tag, blizz_id, sl["wins"], sl["losses"], sl["win_rate"], mmr.get("mmr"), mmr.get("rank_tier"),
            overall["wins"] if overall else None, overall["losses"] if overall else None, overall["win_rate"] if overall else None)


def load_heroes(db, tag, blizz_id, scope, rows):
    for r in rows:
        if r.get("games_played"):
            db.execute("INSERT INTO sp_hero VALUES (?,?,?,?,?,?,?,?,?)",
                       (tag, blizz_id, scope, r["name"], r["hero"]["new_role"], r["games_played"], r["wins"], r["losses"], r["win_rate"]))


def load_named(db, table, tag, blizz_id, rows):
    for r in rows:
        if r.get("games_played"):
            db.execute(f"INSERT INTO {table} VALUES (?,?,?,?,?,?,?)",
                       (tag, blizz_id, r["name"], r["games_played"], r["wins"], r["losses"], r["win_rate"]))


def load_player(db, folder, match):
    tag, blizz_id = match["tag"], int(match["id"])
    sl = load_profile(folder / "sl_profile.json")
    if sl is None:
        print(f"skip {tag}: no sl_profile")
        return
    db.execute("INSERT INTO sp_player VALUES (?,?,?,?,?,?,?,?,?,?)", player_row(tag, blizz_id, sl, load_profile(folder / "overview_all.json")))
    for scope, name in (("sl", "sl_heroes.json"), *SEASON_FILES.items()):
        rows = load_list(folder / name)
        if rows is not None:
            load_heroes(db, tag, blizz_id, scope, rows)
    for table, name in (("sp_map", "sl_maps.json"), ("sp_role", "sl_roles.json")):
        rows = load_list(folder / name)
        if rows is not None:
            load_named(db, table, tag, blizz_id, rows)


def build():
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    for folder in sorted(RAW.iterdir()):
        match = DIR_NAME.match(folder.name)
        if folder.is_dir() and match:
            load_player(db, folder, match)
    db.commit()
    return db


if __name__ == "__main__":
    conn = build()
    for t in ("sp_player", "sp_hero", "sp_map", "sp_role"):
        print(t, conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
