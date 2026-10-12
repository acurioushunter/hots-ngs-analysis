"""Build knowledge/ngs_season.db: every NGS Season 22 game we have saved, all divisions (same tables as ngs_div.db plus division and season).

Input : knowledge/raw/ngs/matches/*.json and knowledge/raw/ngs/other_divisions/*.json (match/single responses)
Output: knowledge/ngs_season.db  tables ngs_game (with division), ngs_hero_ban, ngs_pick, ngs_map_ban, ngs_player_game (with blizz_id)
Run   : python build_ngs_season.py [season] ; python test_ngs_season.py   (season 21 reads knowledge/raw/ngs/season21/ into ngs_season21.db)
Division comes from the match page itself (team_names.*.division). Forfeits (no draft) are skipped.
"""
import collections, json, pathlib, sqlite3, sys

import build_ngs_division as D

ROOT = pathlib.Path(__file__).parent / "knowledge"
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 22
if SEASON == 22:
    FOLDERS = [ROOT / "raw" / "ngs" / "matches", ROOT / "raw" / "ngs" / "other_divisions"]
    DB_PATH = ROOT / "ngs_season.db"
else:
    FOLDERS = [ROOT / "raw" / "ngs" / f"season{SEASON}"]
    DB_PATH = ROOT / f"ngs_season{SEASON}.db"

SCHEMA = D.SCHEMA.replace("series TEXT);", "series TEXT, division TEXT, season INT);").replace(
    "award TEXT, l1 TEXT", "award TEXT, blizz_id INT, l1 TEXT")


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def division_names():
    """team -> division name from the replay export, when we have it."""
    path = ROOT / "ngs_league.db"
    if not path.exists():
        return {}
    db = sqlite3.connect(path)
    votes = collections.defaultdict(collections.Counter)
    for t0, t1, div in db.execute("SELECT team0, team1, division FROM lg_games WHERE season=? AND division IS NOT NULL", (SEASON,)):
        votes[t0][div] += 1
        votes[t1][div] += 1
    return {t: c.most_common(1)[0][0] for t, c in votes.items()}


def groups(pairs):
    """Connected groups of teams that played each other."""
    adj = collections.defaultdict(set)
    for a, b in pairs:
        adj[a].add(b); adj[b].add(a)
    seen, out = set(), []
    for t in adj:
        if t in seen:
            continue
        stack, comp = [t], set()
        while stack:
            x = stack.pop()
            if x in comp:
                continue
            comp.add(x); stack.extend(adj[x] - comp)
        seen |= comp
        out.append(comp)
    return out


def build():
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    seen_series = set()
    skipped = []
    paths = {}
    for folder in FOLDERS:
        for p in folder.glob("*.json"):
            paths[int(p.stem)] = p
    for replay_id in sorted(paths):
        match = load(paths[replay_id])
        if match.get("first_pick") not in (0, 1) or not match.get("draft_order"):
            skipped.append(replay_id)   # forfeit or no draft recorded: not a played game
            continue
        round_no, game_no = D.round_and_game(match, replay_id)
        teams = D.team_labels(match)
        division = match["team_names"]["team_one"].get("division")
        winner, first = int(match["winner"]), int(match["first_pick"])
        key = D.series_key(round_no, teams)
        db.execute("INSERT INTO ngs_game VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (replay_id, match["game_date"], round_no, game_no, match["game_map"]["name"], D.seconds(match["game_length"]),
                    teams[0], teams[1], teams[winner], teams[1 - winner], teams[first], teams[1 - first], key, division, SEASON))
        D.insert_drafts(db, replay_id, match, teams)
        for side in match["players"]:
            for p in side:
                s = p["score"]
                talents = [(p.get("talents") or {}).get(t) for t in D.TIERS]
                db.execute("INSERT INTO ngs_player_game VALUES (" + ",".join("?" * 30) + ")",
                           (replay_id, teams[p["team"]], p["battletag"], p["hero"]["name"], int(p["winner"]), p["total_rank"], s.get("level"),
                            s["kills"], s["assists"], s["takedowns"], s["deaths"], s["hero_damage"], s["siege_damage"], s["structure_damage"],
                            s["minion_damage"], s["creep_damage"], s.get("healing"), s["damage_taken"], s["experience_contribution"],
                            s["merc_camp_captures"], s["time_spent_dead"], s.get("match_award"), p.get("blizz_id"),
                            *[t["title"] if t else None for t in talents]))
        D.insert_map_bans(db, key, round_no, match, seen_series)
    if skipped:
        print("skipped (forfeit, no draft):", skipped)
    # two different players can use the same battletag (different Heroes Profile ids). Tell them apart with "#id", except in Division C West
    # where the hand tuned pools and ngs_div.db use the plain tag.
    clash = [t for (t,) in db.execute("SELECT battletag FROM ngs_player_game WHERE blizz_id IS NOT NULL GROUP BY battletag HAVING COUNT(DISTINCT blizz_id) > 1")]
    for tag in clash:
        db.execute("""UPDATE ngs_player_game SET battletag = battletag || ' #' || blizz_id
                      WHERE battletag = ? AND replay_id NOT IN (SELECT replay_id FROM ngs_game WHERE division = 'C West')""", (tag,))
    if clash:
        print("battletags used by more than one player:", clash)
    db.commit()
    return db


if __name__ == "__main__":
    conn = build()
    for table in ("ngs_game", "ngs_hero_ban", "ngs_pick", "ngs_map_ban", "ngs_player_game"):
        print(table, conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
    for div, g, t in conn.execute("SELECT division, COUNT(*), COUNT(DISTINCT team0) FROM ngs_game GROUP BY division ORDER BY division"):
        print(f"  {div}: {g} games")
