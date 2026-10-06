"""Scouting report for one team: python3 report.py COSMOS"""
import sqlite3, sys

def rows(db, sql, *args):
    return db.execute(sql, args).fetchall()

def record(won, total):
    return f"{won}-{total - won}"

def section(title, header, data):
    print(f"\n## {title}\n| {' | '.join(header)} |\n|{'---|' * len(header)}")
    for row in data:
        print("| " + " | ".join(str(c) for c in row) + " |")

def team_report(db, team):
    overall = rows(db, "SELECT COUNT(*), SUM(won) FROM team_game WHERE team=?", team)[0]
    print(f"# {team}: {record(overall[1], overall[0])} overall")
    section("Maps", ["map", "record"], [(m, record(w, n)) for m, n, w in rows(db, "SELECT map,COUNT(*),SUM(won) FROM team_game WHERE team=? GROUP BY map ORDER BY 2 DESC", team)])
    section("Record by draft side", ["side", "record"], [("first pick" if f else "map pick", record(w, n)) for f, n, w in rows(db, "SELECT first_pick,COUNT(*),SUM(won) FROM team_game WHERE team=? GROUP BY first_pick", team)])
    section("Heroes opponents ban against them (team record when banned)", ["hero", "times", "record"],
            [(h, n, record(n - bw, n)) for h, n, bw in rows(db, "SELECT hero,COUNT(*),SUM(game_won) FROM ban WHERE opponent=? GROUP BY hero ORDER BY 2 DESC LIMIT 10", team)])
    section("Their bans", ["hero", "times", "record"], [(h, n, record(w, n)) for h, n, w in rows(db, "SELECT hero,COUNT(*),SUM(game_won) FROM ban WHERE team=? GROUP BY hero ORDER BY 2 DESC LIMIT 8", team)])
    section("Their picks", ["hero", "times", "record"], [(h, n, record(w, n)) for h, n, w in rows(db, "SELECT hero,COUNT(*),SUM(game_won) FROM pick WHERE team=? GROUP BY hero ORDER BY 2 DESC LIMIT 12", team)])
    section("Players by hero", ["player", "hero", "games", "record", "avg rating"],
            [(p, h, n, record(w, n), int(r)) for p, h, n, w, r in rows(db, "SELECT player,hero,COUNT(*),SUM(game_won),AVG(rating) FROM player_game WHERE team=? GROUP BY player,hero HAVING COUNT(*)>=2 ORDER BY player,3 DESC", team)])
    section("Losses", ["game", "date", "map", "beat them", "their bans vs us"],
            [(g, d[:10], m, o, b) for g, d, m, o, b in rows(db, "SELECT g.game_id,g.date,g.map,g.winner,(SELECT group_concat(hero) FROM ban b WHERE b.game_id=g.game_id AND b.team=g.winner) FROM game g WHERE loser=? ORDER BY 1", team)])

if __name__ == "__main__":
    team_report(sqlite3.connect("hots_s22.db"), sys.argv[1] if len(sys.argv) > 1 else "COSMOS")
