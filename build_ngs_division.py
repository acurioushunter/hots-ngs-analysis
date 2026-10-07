"""Build knowledge/ngs_div.db from the saved NGS match pages of one division (Division C West, Season 22).

Input : knowledge/raw/ngs/matches/<replayID>.json  (match/single responses, esport NGS)
Output: knowledge/ngs_div.db  tables ngs_game, ngs_hero_ban, ngs_pick, ngs_map_ban, ngs_player_game
Run   : python build_ngs_division.py ; python test_ngs_division.py
"""
import datetime, json, pathlib, re, sqlite3

ROOT = pathlib.Path(__file__).parent / "knowledge"
MATCHES = ROOT / "raw" / "ngs" / "matches"
DB_PATH = ROOT / "ngs_div.db"
TIERS = ("level_one", "level_four", "level_seven", "level_ten", "level_thirteen", "level_sixteen", "level_twenty")

SCHEMA = """
CREATE TABLE ngs_game(replay_id INT PRIMARY KEY, date_utc TEXT, round TEXT, game INT, map TEXT, length_sec INT,
                      team0 TEXT, team1 TEXT, winner TEXT, loser TEXT, first_pick_team TEXT, map_pick_team TEXT, series TEXT);
CREATE TABLE ngs_hero_ban(replay_id INT, team TEXT, slot INT, hero TEXT);
CREATE TABLE ngs_pick(replay_id INT, team TEXT, slot INT, hero TEXT);
CREATE TABLE ngs_map_ban(series TEXT, round TEXT, team TEXT, ban_no INT, map TEXT);
CREATE TABLE ngs_player_game(replay_id INT, team TEXT, battletag TEXT, hero TEXT, won INT, rating INT, level INT, kills INT, assists INT,
                             takedowns INT, deaths INT, hero_damage INT, siege_damage INT, structure_damage INT, minion_damage INT,
                             creep_damage INT, healing INT, damage_taken INT, xp_contribution INT, merc_camps INT, time_dead INT,
                             award TEXT, l1 TEXT, l4 TEXT, l7 TEXT, l10 TEXT, l13 TEXT, l16 TEXT, l20 TEXT);
"""


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def seconds(text):
    m = re.match(r"(\d+) minutes? (\d+) seconds?", text or "")
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


def hero_name(entry):
    return entry["hero"] if isinstance(entry["hero"], str) else entry["hero"]["name"]


def team_labels(match):
    names = match["team_names"]
    return [names["team_one"]["team_name"], names["team_two"]["team_name"]]


def series_key(round_no, teams):
    return f"R{round_no}:" + " v ".join(sorted(teams))


def insert_game(db, replay_id, match, round_no, game_no):
    teams = team_labels(match)
    winner, first = int(match["winner"]), int(match["first_pick"])
    key = series_key(round_no, teams)
    db.execute("INSERT INTO ngs_game VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (replay_id, match["game_date"], round_no, game_no, match["game_map"]["name"], seconds(match["game_length"]),
                teams[0], teams[1], teams[winner], teams[1 - winner], teams[first], teams[1 - first], key))
    return teams, key


FIRST_PICK_PICK_SLOTS = {5, 8, 9, 14, 15}


def insert_drafts(db, replay_id, match, teams):
    banned_by = {hero_name(b): teams[b["team"]] for side in match["replay_bans"] for b in side}
    picked_by = {p["hero"]["name"]: teams[p["team"]] for side in match["players"] for p in side}
    first = teams[int(match["first_pick"])]
    second = teams[1 - int(match["first_pick"])]
    for d in sorted(match["draft_order"], key=lambda d: d["pick_number"]):
        hero, slot = hero_name(d), d["pick_number"] + 1
        if hero == "No Pick":
            continue
        if str(d["type"]) == "0":
            db.execute("INSERT INTO ngs_hero_ban VALUES (?,?,?,?)", (replay_id, banned_by.get(hero), slot, hero))
        else:
            # A hero drafted but swapped out before the game is not on any roster: fall back to the slot rule.
            team = picked_by.get(hero) or (first if slot in FIRST_PICK_PICK_SLOTS else second)
            db.execute("INSERT INTO ngs_pick VALUES (?,?,?,?)", (replay_id, team, slot, hero))


def insert_players(db, replay_id, match, teams):
    for side in match["players"]:
        for p in side:
            s = p["score"]
            talents = [(p.get("talents") or {}).get(t) for t in TIERS]
            db.execute("INSERT INTO ngs_player_game VALUES (" + ",".join("?" * 29) + ")",
                       (replay_id, teams[p["team"]], p["battletag"], p["hero"]["name"], int(p["winner"]), p["total_rank"], s.get("level"),
                        s["kills"], s["assists"], s["takedowns"], s["deaths"], s["hero_damage"], s["siege_damage"], s["structure_damage"],
                        s["minion_damage"], s["creep_damage"], s.get("healing"), s["damage_taken"], s["experience_contribution"],
                        s["merc_camp_captures"], s["time_spent_dead"], s.get("match_award"), *[t["title"] if t else None for t in talents]))


def insert_map_bans(db, key, round_no, match, seen):
    if key in seen or not match.get("map_bans"):
        return
    seen.add(key)
    for side in ("team_zero_ban_data", "team_one_ban_data"):
        data = match["map_bans"][side]
        for n, field in ((1, "map_ban_one"), (2, "map_ban_two")):
            if data.get(field):
                db.execute("INSERT INTO ngs_map_ban VALUES (?,?,?,?,?)", (key, round_no, data["name"], n, data[field]["name"]))


def round_and_game(match, replay_id):
    entry = next(g for g in match["match_games"] if g["replayID"] == replay_id)
    return str(entry["round"]), int(entry["game"])


def build():
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    seen = set()
    for path in sorted(MATCHES.glob("*.json"), key=lambda p: int(p.stem)):
        replay_id, match = int(path.stem), load(path)
        round_no, game_no = round_and_game(match, replay_id)
        teams, key = insert_game(db, replay_id, match, round_no, game_no)
        insert_drafts(db, replay_id, match, teams)
        insert_players(db, replay_id, match, teams)
        insert_map_bans(db, key, round_no, match, seen)
    db.commit()
    return db


if __name__ == "__main__":
    conn = build()
    for table in ("ngs_game", "ngs_hero_ban", "ngs_pick", "ngs_map_ban", "ngs_player_game"):
        print(table, conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
