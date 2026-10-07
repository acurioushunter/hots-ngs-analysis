"""Turn the raw Heroes Profile pulls for hunterstag into hunter_hp.db.

Input : knowledge/raw/hunter/hp/{all,sl}/*.json   (all = every game type, sl = Storm League only)
Output: knowledge/hunter_hp.db
Run   : python build_hunter.py ; python test_hunter.py
"""
import json, pathlib, sqlite3

ROOT = pathlib.Path(__file__).parent / "knowledge"
RAW = ROOT / "raw" / "hunter" / "hp"
DB_PATH = ROOT / "hunter_hp.db"
SCOPES = ("all", "sl")
TIERS = ("level_one", "level_four", "level_seven", "level_ten", "level_thirteen", "level_sixteen", "level_twenty")

SCHEMA = """
CREATE TABLE hp_profile(scope TEXT, key TEXT, value TEXT);
CREATE TABLE hp_hero(scope TEXT, hero TEXT, role TEXT, games INT, wins INT, losses INT, win_rate REAL, kda REAL, kdr REAL,
                     avg_kills REAL, avg_deaths REAL, avg_takedowns REAL, avg_hero_damage REAL, avg_siege_damage REAL, avg_healing REAL);
CREATE TABLE hp_map(scope TEXT, map TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE hp_role(scope TEXT, role TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE hp_matchup(scope TEXT, hero TEXT, ally_games INT, ally_wins INT, ally_win_rate REAL, enemy_games INT, enemy_wins INT, enemy_win_rate REAL);
CREATE TABLE hp_friend(scope TEXT, kind TEXT, battletag TEXT, games INT, wins INT, losses INT, win_rate REAL);
CREATE TABLE hp_talent(scope TEXT, hero TEXT, level INT, slot INT, talent TEXT, games INT, wins INT, losses INT, win_rate REAL, popularity REAL);
CREATE TABLE hp_build(scope TEXT, hero TEXT, games INT, wins INT, win_rate REAL, l1 TEXT, l4 TEXT, l7 TEXT, l10 TEXT, l13 TEXT, l16 TEXT, l20 TEXT);
CREATE TABLE hp_game(replay_id INT PRIMARY KEY, game_type TEXT, date TEXT, map TEXT, hero TEXT, role TEXT, won INT,
                     level INT, kills INT, assists INT, takedowns INT, deaths INT, hero_damage INT, siege_damage INT, healing INT,
                     damage_taken INT, xp_contribution INT, time_spent_dead INT, time_on_fire INT, first_to_ten INT,
                     player_mmr INT, hero_mmr INT, role_mmr INT, mmr_change REAL, award TEXT,
                     minion_damage INT, creep_damage INT, structure_damage INT, summon_damage INT, merc_camp_captures INT,
                     watch_tower_captures INT, time_cc_enemy_heroes INT, escapes INT, vengeance INT, outnumbered_deaths INT,
                     teamfight_hero_damage INT, teamfight_damage_taken INT, multikill INT, regen_globes INT, town_kills INT,
                     highest_kill_streak INT, physical_damage INT, spell_damage INT,
                     l1 TEXT, l4 TEXT, l7 TEXT, l10 TEXT, l13 TEXT, l16 TEXT, l20 TEXT);
"""


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def scalar_items(d):
    return [(k, v) for k, v in d.items() if isinstance(v, (int, float, str)) and not isinstance(v, bool)]


def load_profile(db, scope, profile):
    db.executemany("INSERT INTO hp_profile VALUES (?,?,?)", [(scope, k, str(v)) for k, v in scalar_items(profile)])
    for mode in ("qm", "ud", "hl", "tl", "sl", "ar"):
        mmr = profile.get(f"{mode}_mmr_data")
        if isinstance(mmr, dict):
            db.executemany("INSERT INTO hp_profile VALUES (?,?,?)", [(scope, f"{mode}_{k}", str(v)) for k, v in scalar_items(mmr)])


def load_heroes(db, scope, rows):
    for r in rows:
        db.execute("INSERT INTO hp_hero VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (scope, r["name"], r["hero"]["new_role"], r["games_played"], r["wins"], r["losses"], r["win_rate"],
                    r["kda"], r["kdr"], r.get("avg_kills"), r.get("avg_deaths"), r.get("avg_takedowns"),
                    r.get("avg_hero_damage"), r.get("avg_siege_damage"), r.get("avg_healing")))


def load_named_table(db, table, scope, rows):
    for r in rows:
        db.execute(f"INSERT INTO {table} VALUES (?,?,?,?,?,?)", (scope, r["name"], r["games_played"], r["wins"], r["losses"], r["win_rate"]))


def load_matchups(db, scope, data):
    for r in data["tabledata"]:
        db.execute("INSERT INTO hp_matchup VALUES (?,?,?,?,?,?,?,?)",
                   (scope, r["name"], r.get("ally_games_played"), r.get("ally_wins"), r.get("ally_win_rate"),
                    r.get("enemy_games_played"), r.get("enemy_wins"), r.get("enemy_win_rate")))


def load_friends(db, scope, kind, rows):
    for r in rows:
        db.execute("INSERT INTO hp_friend VALUES (?,?,?,?,?,?,?)",
                   (scope, kind, r["battletag"], r["total_games_played"], r["total_wins"], r["total_losses"], r["win_rate"]))


def load_talents(db, scope, by_hero):
    for hero, data in by_hero.items():
        if "talentData" not in data:
            print(f"WARNING {scope}: talents missing for {hero} ({data}); refetch it")
            continue
        for level, entries in data["talentData"].items():
            for e in entries:
                db.execute("INSERT INTO hp_talent VALUES (?,?,?,?,?,?,?,?,?,?)",
                           (scope, hero, int(level), int(e["sort"]), e["talentInfo"]["title"], e["games_played"],
                            e["wins"], e["losses"], e["win_rate"], e["popularity"]))
        for b in data.get("buildData") or []:
            db.execute("INSERT INTO hp_build VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                       (scope, hero, b["games_played"], b["wins"], b["win_rate"], *[b[t]["title"] for t in TIERS]))


EXTRA_STATS = ("minion_damage", "creep_damage", "structure_damage", "summon_damage", "merc_camp_captures", "watch_tower_captures",
               "time_cc_enemy_heroes", "escapes", "vengeance", "outnumbered_deaths", "teamfight_hero_damage", "teamfight_damage_taken",
               "multikill", "regen_globes", "town_kills", "highest_kill_streak", "physical_damage", "spell_damage")


def game_row(g):
    talents = [(g.get(t) or {}).get("title") for t in TIERS]
    return (g["replayID"], g["game_type"]["short_name"], g["game_date"], g["game_map"]["name"], g["hero"]["name"],
            g["role"], g["winner"], g["level"], g["kills"], g["assists"], g["takedowns"], g["deaths"], g["hero_damage"],
            g["siege_damage"], g["healing"], g["damage_taken"], g["experience_contribution"], g["time_spent_dead"],
            g["time_on_fire"], g["first_to_ten"], g["player_mmr"], g["hero_mmr"], g["role_mmr"], g["player_change"],
            g["match_award"], *[g[k] for k in EXTRA_STATS], *talents)


def load_games(db, pages):
    for page in pages:
        for g in load(page)["data"]:
            db.execute("INSERT OR IGNORE INTO hp_game VALUES (" + ",".join("?" * 50) + ")", game_row(g))


def build():
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    for scope in SCOPES:
        d = RAW / scope
        if not (d / "profile.json").exists():
            continue
        load_profile(db, scope, load(d / "profile.json"))
        load_heroes(db, scope, load(d / "heroes.json"))
        load_named_table(db, "hp_map", scope, load(d / "maps.json"))
        load_named_table(db, "hp_role", scope, load(d / "roles.json"))
        load_matchups(db, scope, load(d / "matchups.json"))
        load_friends(db, scope, "friend", load(d / "friends.json"))
        load_friends(db, scope, "foe", load(d / "foes.json"))
        talents = load(d / "talents.json")
        refetched = d / "talents_missing.json"  # heroes that were rate limited on the first pull
        if refetched.exists():
            talents.update({h: v for h, v in load(refetched).items() if "talentData" in v})
        load_talents(db, scope, talents)
    # One hp_game table: the "all" history already contains every Storm League game.
    history = sorted((RAW / "all" / "match_history").glob("page_*.json")) or sorted((RAW / "sl" / "match_history").glob("page_*.json"))
    load_games(db, history)
    db.commit()
    return db


if __name__ == "__main__":
    conn = build()
    for t in ("hp_profile", "hp_hero", "hp_map", "hp_role", "hp_matchup", "hp_friend", "hp_talent", "hp_build", "hp_game"):
        print(t, conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
