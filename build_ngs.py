"""Build knowledge/ngs.db from the raw NGS pulls (Heroes Profile esports API).

Input : knowledge/raw/ngs/teams/<team>_s22.json, knowledge/raw/ngs/players/<tag>_<id>_{all,s20,s21,s22}.json
Output: knowledge/ngs.db
Run   : python build_ngs.py ; python test_ngs.py
"""
import json, pathlib, re, sqlite3

ROOT = pathlib.Path(__file__).parent / "knowledge"
RAW = ROOT / "raw" / "ngs"
DB_PATH = ROOT / "ngs.db"
TEAM_NAMES = {"COSMOS": "COSMOS", "Roll1Esports": "Roll1Esports", "Phoenix_Rising_Amethyst": "Phoenix Rising Amethyst",
              "Anomaly": "Anomaly", "Can_t_Counterpick_Stupid": "Can't Counterpick Stupid", "Good_Lordy": "Good Lordy"}
PLAYER_FILE = re.compile(r"^(?P<tag>.+)_(?P<id>\d+)_(?P<scope>all|s\d+)\.json$")

SCHEMA = """
CREATE TABLE team_summary(team TEXT, season INT, wins INT, losses INT, win_rate REAL, kills INT, deaths INT, assists INT, takedowns INT, total_games INT);
CREATE TABLE team_hero(team TEXT, season INT, hero TEXT, role TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE team_map(team TEXT, season INT, map TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE team_ban(team TEXT, season INT, kind TEXT, hero TEXT, bans INT);
CREATE TABLE roster(team TEXT, season INT, battletag TEXT, blizz_id INT, games INT, most_played_hero TEXT, hero_win_rate REAL, role TEXT);
CREATE TABLE player_summary(battletag TEXT, blizz_id INT, scope TEXT, team_s22 TEXT, wins INT, losses INT, win_rate REAL, kills INT, deaths INT, assists INT, takedowns INT, total_games INT);
CREATE TABLE player_hero(battletag TEXT, blizz_id INT, scope TEXT, hero TEXT, role TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE player_map(battletag TEXT, blizz_id INT, scope TEXT, map TEXT, games INT, wins INT, losses INT, win_rate REAL);
"""


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def summary_values(d):
    return (d.get("wins"), d.get("losses"), d.get("win_rate"), d.get("kills"), d.get("deaths"), d.get("assists"),
            d.get("takedowns"), d.get("total_games"))


def load_hero_rows(db, table, keys, rows):
    for r in rows:
        db.execute(f"INSERT INTO {table} VALUES ({','.join('?' * (len(keys) + 6))})",
                   (*keys, r["hero"]["name"], r["hero"]["new_role"], r["games_played"], r["wins"], r["losses"], r["win_rate"]))


def load_map_rows(db, table, keys, rows):
    for r in rows:
        db.execute(f"INSERT INTO {table} VALUES ({','.join('?' * (len(keys) + 5))})",
                   (*keys, r["map"]["name"], r["games_played"], r["wins"], r["losses"], r["win_rate"]))


def load_team(db, path):
    team_name = TEAM_NAMES[path.name.removesuffix("_s22.json")]
    d = load(path)
    season = 22
    db.execute("INSERT INTO team_summary VALUES (?,?,?,?,?,?,?,?,?,?)",
               (team_name, season, d["wins"], d["losses"], d["win_rate"], d["kills"], d["deaths"], d["assists"], d["takedowns"], d["total_games"]))
    load_hero_rows(db, "team_hero", (team_name, season), d["heroes"])
    load_map_rows(db, "team_map", (team_name, season), d["maps"])
    for kind, rows in (("banned_by_enemies", d["enemy_ban_date"]), ("banned_by_team", d["team_ban_date"])):
        for r in rows:
            db.execute("INSERT INTO team_ban VALUES (?,?,?,?,?)", (team_name, season, kind, r["hero"]["name"], r["bans"]))
    for p in d["players"].values():
        db.execute("INSERT INTO roster VALUES (?,?,?,?,?,?,?,?)",
                   (team_name, season, p["battletag"], p["blizz_id"], p["games_played"], p["most_played_hero"]["name"],
                    p["win_rate_on_hero"], p["most_played_role"]))
    return team_name


def load_player(db, path, match):
    tag, blizz_id, scope = match["tag"], int(match["id"]), match["scope"]
    wrapper = load(path)
    d = wrapper["data"]
    db.execute("INSERT INTO player_summary VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
               (tag, blizz_id, scope, wrapper.get("team22"), *summary_values(d)))
    load_hero_rows(db, "player_hero", (tag, blizz_id, scope), d["heroes"])
    load_map_rows(db, "player_map", (tag, blizz_id, scope), d["maps"])


def build():
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    for path in sorted((RAW / "teams").glob("*_s22.json")):
        load_team(db, path)
    for path in sorted((RAW / "players").glob("*.json")):
        match = PLAYER_FILE.match(path.name)
        if match:
            load_player(db, path, match)
    db.commit()
    return db


if __name__ == "__main__":
    conn = build()
    for t in ("team_summary", "team_hero", "team_map", "team_ban", "roster", "player_summary", "player_hero", "player_map"):
        print(t, conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
