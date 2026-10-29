"""Checks for build_my_replays.py, run on the Season 22 NGS export (Hunter's games) into a temporary database.
Run: python -I test_my_replays.py   (prints OK; skips when the export folder is not on this machine)"""
import json, pathlib, sqlite3, sys, tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_my_replays as B

S22 = HERE / "knowledge" / "raw" / "ngs_export" / "season-22"
TOON = "1-Hero-1-8186800"
fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


def main():
    if not (S22 / "matches.ldb").exists():
        print("OK (skipped: no Season 22 export on this machine)")
        return
    out = pathlib.Path(tempfile.mkdtemp()) / "t.db"
    # the same folder twice: every game must be kept once
    B.main([str(S22), str(S22), "--toon", TOON, "--out", str(out)])
    c = sqlite3.connect(out)
    n, dsum, wins = c.execute("select count(*), sum(deaths), sum(win) from my_games").fetchone()
    check(n == 25, f"expected 25 Season 22 games for Hunter, got {n}")
    check(c.execute("select count(distinct game_id) from my_games").fetchone()[0] == n, "duplicate game ids")
    check(c.execute("select count(*) from my_deaths").fetchone()[0] == dsum, "death rows do not match the Deaths stat")
    for gid, k, d in c.execute("select g.game_id, count(d.n), g.deaths from my_games g left join my_deaths d using(game_id) group by 1"):
        check(k == d, f"{gid}: {k} death rows, stat says {d}")
    bad = c.execute("select count(*) from my_deaths d join my_games g using(game_id) where d.t < 0 or d.t > g.length_sec + 5").fetchone()[0]
    check(bad == 0, f"{bad} deaths outside the game")
    check(c.execute("select count(*) from my_deaths where depth is null or depth < -1 or depth > 2").fetchone()[0] == 0, "depth missing or out of range")
    # no timer only when the game ended before the respawn
    odd = c.execute("select count(*) from my_deaths d join my_games g using(game_id) where (d.time_dead is null and d.t < g.length_sec - 120)"
                    " or d.time_dead <= 0 or d.time_dead > 120").fetchone()[0]
    check(odd == 0, f"{odd} respawn timers missing or odd")
    check({r[0] for r in c.execute("select distinct mode from my_games")} == {"Custom"}, "NGS games should read as Custom")
    # talents: at most seven a game, Chromie on her own levels, names resolved for the heroes Icy Veins lists
    check(c.execute("select max(k) from (select count(*) k from my_talents group by game_id)").fetchone()[0] <= 7, "more than seven talents")
    ch = {r[0] for r in c.execute("select distinct level from my_talents where hero='Chromie'")}
    check(not ch or ch <= {1, 2, 5, 8, 11, 14, 18}, f"Chromie talent levels {ch}")
    check(c.execute("select talent from my_talents where internal='JunkratRIPTire'").fetchone()[0] == "RIP-Tire", "talent name lookup")
    check(c.execute("select talent from my_talents where internal='ChromieAProperGreeting'").fetchone()[0] == "A Proper Greeting", "talent name fallback")
    allies = json.loads(c.execute("select allies from my_games limit 1").fetchone()[0])
    check(len(allies) == 4 and "hunterstag" not in allies, f"allies {allies}")
    # against the league database built from the same export
    lg = HERE / "knowledge" / "ngs_league.db"
    if lg.exists():
        l = sqlite3.connect(lg)
        theirs = {gid.removeprefix("ngs_s22_"): d for gid, d in l.execute(
            "select game_id, deaths from lg_players where toon=? and game_id like 'ngs_s22_%'", (TOON,))}
        mine = {gid.removeprefix("season-22_"): d for gid, d in c.execute("select game_id, deaths from my_games")}
        check(len(theirs) >= 20 and set(theirs) <= set(mine), "league games missing from the replay build")
        check(all(mine[k] == v for k, v in theirs.items()), "deaths differ from ngs_league.db")
    c.close()
    if fails:
        print("FAIL")
        for f in fails:
            print("  ", f)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
