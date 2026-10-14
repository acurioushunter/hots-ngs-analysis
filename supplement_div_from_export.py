"""Fill the Division C West games that the Heroes Profile pages do not have yet from the NGS replay export.

The Heroes Profile match pages (knowledge/ngs_div.db) are pulled by hand in Hunter's Chrome, so they lag the replay export. This builds
knowledge/ngs_div_plus.db = a copy of ngs_div.db plus every C West season 22 game in knowledge/ngs_league.db that is dated after the
newest Heroes Profile game. ngs_div.db itself is never changed. Run by build_playbook.py; run alone: python -I supplement_div_from_export.py

What a filled in game carries and what it lacks (be honest about it, CLAUDE.md rules 1 and 9):
  has    teams, map, winner, who had first pick, bans and picks in draft order, per player hero, takedowns, assists, deaths, hero damage,
         siege damage, healing, damage taken, experience, camps, time dead
  lacks  the Heroes Profile rating (each player's own average on their other games is used so team averages do not move), the round and
         series (map picks and map bans of those series are unknown), talent names, minion and camp damage split, level
Filled in games have replay_id 9,000,000 and up and series starting "export:". Macro numbers per hero and per map skip them.
"""
import pathlib, shutil, sqlite3

KN = pathlib.Path(__file__).resolve().parent / "knowledge"
SUPP = 9_000_000
DIVISION, SEASON = "C West", 22
FIRST_SLOTS, SECOND_SLOTS = [5, 8, 9, 14, 15], [6, 7, 12, 13, 16]       # NGS draft order, see the existing games
FIRST_BANS, SECOND_BANS = [1, 3, 11], [2, 4, 10]


def build():
    src, dst = KN / "ngs_div.db", KN / "ngs_div_plus.db"
    shutil.copyfile(src, dst)
    lg_path = KN / "ngs_league.db"
    if not lg_path.exists():
        return 0
    db, lg = sqlite3.connect(dst), sqlite3.connect(lg_path)
    newest = db.execute("SELECT MAX(substr(date_utc, 1, 10)) FROM ngs_game").fetchone()[0] or ""
    rows = lg.execute("SELECT game_id, date, map, length_sec, team0, team1, winner, first_pick FROM lg_games "
                      "WHERE season=? AND division=? AND date>? ORDER BY date, game_id", (SEASON, DIVISION, newest)).fetchall()
    # a player's usual rating, so a game without one does not move the averages
    usual = {}
    for tag, r in db.execute("SELECT battletag, AVG(rating) FROM ngs_player_game WHERE rating IS NOT NULL GROUP BY battletag"):
        usual[tag] = r
    n = 0
    for i, (gid, date, mp, length, t0, t1, win, fp) in enumerate(rows):
        rid = SUPP + i
        names = (t0, t1)
        if win is None:
            continue
        db.execute("INSERT INTO ngs_game(replay_id, date_utc, round, game, map, length_sec, team0, team1, winner, loser, first_pick_team, map_pick_team, series) "
                   "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (rid, date + " 23:59:00", None, None, mp, int(length or 0), t0, t1, names[win], names[1 - win],
                    names[fp] if fp is not None else None, None, f"export:{date}:{t0} v {t1}"))
        for side in (0, 1):
            order = [h for (h,) in lg.execute("SELECT hero FROM lg_picks WHERE game_id=? AND team=? ORDER BY pick_no", (gid, side))]
            played = [h for (h,) in lg.execute("SELECT hero FROM lg_players WHERE game_id=? AND team=?", (gid, side)) if h]
            spare = [h for h in played if h not in order]
            order = [h if h else (spare.pop(0) if spare else None) for h in order]   # a pick the export could not name: the hero played that was never listed
            slots = (FIRST_SLOTS if fp == side else SECOND_SLOTS)
            for slot, hero in zip(slots, order):
                if hero is None:
                    continue
                db.execute("INSERT INTO ngs_pick(replay_id, team, slot, hero) VALUES(?,?,?,?)", (rid, names[side], slot, hero))
            bans = [h for (h,) in lg.execute("SELECT hero FROM lg_bans WHERE game_id=? AND team=? AND hero IS NOT NULL ORDER BY ban_no", (gid, side))]
            for slot, hero in zip(FIRST_BANS if fp == side else SECOND_BANS, bans):
                db.execute("INSERT INTO ngs_hero_ban(replay_id, team, slot, hero) VALUES(?,?,?,?)", (rid, names[side], slot, hero))
        for (side, hero, name, td, dths, asst, siege, hd, heal, taken, xp, camps, dead) in lg.execute(
                "SELECT team, hero, name, takedowns, deaths, assists, siege, hero_dmg, healing, dmg_taken, xp_contrib, merc_caps, time_dead "
                "FROM lg_players WHERE game_id=?", (gid,)):
            db.execute("INSERT INTO ngs_player_game(replay_id, team, battletag, hero, won, rating, level, kills, assists, takedowns, deaths, hero_damage, "
                       "siege_damage, structure_damage, minion_damage, creep_damage, healing, damage_taken, xp_contribution, merc_camps, time_dead) "
                       "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                       (rid, names[side], name, hero, int(win == side), usual.get(name), None, None, asst, td, dths, hd, siege, None, None, None, heal, taken, xp, camps, dead))
        n += 1
    db.commit()
    db.close()
    return n


if __name__ == "__main__":
    print("games filled in from the replay export:", build())
