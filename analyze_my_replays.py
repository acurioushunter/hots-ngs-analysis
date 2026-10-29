"""A player's own games from knowledge/my_replays.db (built by build_my_replays.py): how and where they die, by hero,
by map and by game phase, talents taken with their record, and the same hero across NGS for reference.

Kinds of death (all inside 15 seconds either side, from the replay's takedown list):
  alone       nobody else on either team died
  traded      at least one of them died
  first down  a teammate died after you but none before you
  late        a teammate had already died before you
Their half: the death was nearer their structures than ours (depth above 0.5, see build_my_replays.depth_fn).
Most cells rest on a handful of games: read them as leans. The replay shows when and where, not why.

Run: python -I analyze_my_replays.py [--mode "Storm League"] [--since 2025-10-29] [--hero Sylvanas] [--db path]
"""
import pathlib, sqlite3, sys
from collections import defaultdict

HERE = pathlib.Path(__file__).resolve().parent
DB = str(HERE / "knowledge" / "my_replays.db")
LG = str(HERE / "knowledge" / "ngs_league.db")
NEAR = 15
MIN_GAMES = 3


def pct(w, n):
    return f"{w}-{n - w}" + (f" ({100 * w / n:.0f}%)" if n else "")


def per(x, n):
    return f"{x / n:.2f}" if n else "-"


def section(t):
    print()
    print("=" * 8, t)


def kind(d):
    if d["our_near"] == 0 and d["their_near"] == 0:
        return "alone"
    if d["ours_before"] > 0:
        return "late"
    if d["their_near"] > 0:
        return "traded"
    return "first down"


def load(db, mode, since, hero):
    c = sqlite3.connect(db)
    c.row_factory = sqlite3.Row
    q, args = "select * from my_games where 1=1", []
    if mode:
        q += " and coalesce(hp_mode, mode) = ?"; args.append(mode)
    if since:
        q += " and date >= ?"; args.append(since)
    if hero:
        q += " and hero = ?"; args.append(hero)
    games = {r["game_id"]: dict(r) for r in c.execute(q, args)}
    deaths = defaultdict(list)
    for r in c.execute("select * from my_deaths order by game_id, n"):
        if r["game_id"] in games:
            deaths[r["game_id"]].append(dict(r))
    talents = [dict(r) for r in c.execute("select * from my_talents") if r["game_id"] in games]
    return games, deaths, talents


def league_alone(heroes):
    """NGS seasons 20 to 22, every player: deaths and alone deaths per game on each hero (same 15 second rule)."""
    if not pathlib.Path(LG).exists():
        return {}
    try:
        c = sqlite3.connect(LG)
        games = defaultdict(int)
        dth = defaultdict(int)
        for h, n, d in c.execute("select hero, count(*), sum(deaths) from lg_players p join lg_games g using(game_id) "
                                 "where g.season >= 20 group by hero"):
            games[h], dth[h] = n, d or 0
        kills = defaultdict(list)
        for gid, t, v in c.execute("select k.game_id, t, victim from lg_kills k join lg_games g using(game_id) where g.season >= 20"):
            kills[gid].append((t, v))
    except sqlite3.Error:
        return {}
    alone = defaultdict(int)
    for gid, ks in kills.items():
        ks.sort()
        for i, (t, v) in enumerate(ks):
            if v in heroes and not any(abs(t2 - t) <= NEAR for j, (t2, _) in enumerate(ks) if j != i):
                alone[v] += 1
    return {h: (games[h], dth[h], alone[h]) for h in heroes if games.get(h)}


def death_table(rows, label_of, games, deaths, min_games=MIN_GAMES):
    groups = defaultdict(list)
    for gid in rows:
        groups[label_of(games[gid])].append(gid)
    out = []
    for lab, gids in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        if len(gids) < min_games:
            continue
        ds = [d for g in gids for d in deaths[g]]
        w = sum(games[g]["win"] for g in gids)
        al = sum(1 for d in ds if kind(d) == "alone")
        th = [d for d in ds if d["depth"] is not None]
        far = sum(1 for d in th if d["depth"] > 0.5)
        out.append(f"  {lab:<24} {len(gids):>3} games {pct(w, len(gids)):<12} deaths/game {per(len(ds), len(gids)):>5}"
                   f"  alone/game {per(al, len(gids)):>5}  their half {far}/{len(th)}")
    return out


def main(argv):
    opts = {"--mode": None, "--since": None, "--hero": None, "--db": DB}
    for i in range(0, len(argv) - 1, 2):
        if argv[i] in opts:
            opts[argv[i]] = argv[i + 1]
    games, deaths, talents = load(opts["--db"], opts["--mode"], opts["--since"], opts["--hero"])
    if not games:
        sys.exit("no games match")
    gids = sorted(games, key=lambda g: games[g]["date"])
    n = len(gids)
    w = sum(games[g]["win"] for g in gids)

    section("Sample")
    print(f"  {n} games, {pct(w, n)}, {games[gids[0]]['date'][:10]} to {games[gids[-1]]['date'][:10]}")
    by_mode = defaultdict(list)
    for g in gids:
        by_mode[games[g]["hp_mode"] or games[g]["mode"]].append(g)
    for m, gs in sorted(by_mode.items(), key=lambda kv: -len(kv[1])):
        print(f"  {m:<16} {len(gs):>4} games {pct(sum(games[g]['win'] for g in gs), len(gs))}")
    mins = sum(games[g]["length_sec"] or 0 for g in gids) / 60

    section("Deaths")
    alld = [d for g in gids for d in deaths[g]]
    print(f"  {len(alld)} deaths, {per(len(alld), n)} a game, {per(len(alld) * 10, mins)} every 10 minutes played")
    for lab, res in (("wins", 1), ("losses", 0)):
        gs = [g for g in gids if games[g]["win"] == res]
        ds = [d for g in gs for d in deaths[g]]
        print(f"  in {lab:<7} {len(gs):>3} games, {per(len(ds), len(gs))} deaths a game, "
              f"{per(sum(1 for d in ds if kind(d) == 'alone'), len(gs))} alone a game")
    kinds = defaultdict(int)
    for d in alld:
        kinds[kind(d)] += 1
    print("  kinds: " + ", ".join(f"{k} {kinds[k]}" for k in ("alone", "traded", "first down", "late")))
    th = [d for d in alld if d["depth"] is not None]
    print(f"  in their half: {sum(1 for d in th if d['depth'] > 0.5)} of {len(th)}; "
          f"past the middle of their structures: {sum(1 for d in th if d['depth'] > 1)}")
    behind = sum(1 for d in alld if d["level_diff"] is not None and d["level_diff"] <= -2)
    print(f"  while two or more levels behind: {behind}; while ahead: {sum(1 for d in alld if (d['level_diff'] or 0) > 0)}")
    for lo, hi, lab in ((0, 600, "0 to 10 min"), (600, 1200, "10 to 20 min"), (1200, 99999, "after 20 min")):
        ds = [d for d in alld if lo <= d["t"] < hi]
        al = sum(1 for d in ds if kind(d) == "alone")
        print(f"  {lab:<13} {len(ds):>3} deaths ({per(len(ds), n)} a game), alone {al}")
    # does an early alone death go with losing? (association only)
    early = [g for g in gids if any(kind(d) == "alone" and d["t"] < 1200 for d in deaths[g])]
    clean = [g for g in gids if g not in early]
    print(f"  games with an alone death before 20 min: {pct(sum(games[g]['win'] for g in early), len(early))}; "
          f"without: {pct(sum(games[g]['win'] for g in clean), len(clean))}")

    section(f"Heroes ({MIN_GAMES} or more games)")
    for line in death_table(gids, lambda g: g["hero"], games, deaths):
        print(line)

    section(f"Maps ({MIN_GAMES} or more games)")
    for line in death_table(gids, lambda g: g["map"], games, deaths):
        print(line)

    section("Killed by (heroes on most of your deaths)")
    kb = defaultdict(int)
    for d in alld:
        for h in filter(None, (d["killers"] or "").split("|")):
            kb[h] += 1
    print("  " + ", ".join(f"{h} {c}" for h, c in sorted(kb.items(), key=lambda kv: -kv[1])[:10]))

    section(f"Talents (heroes with {MIN_GAMES} or more games)")
    hero_games = defaultdict(int)
    for g in gids:
        hero_games[games[g]["hero"]] += 1
    cells = defaultdict(lambda: [0, 0])
    for t in talents:
        if hero_games[t["hero"]] >= MIN_GAMES:
            c = cells[(t["hero"], t["level"], t["talent"])]
            c[0] += 1
            c[1] += t["win"]
    last = None
    for (h, lv, name), (k, wn) in sorted(cells.items()):
        if h != last:
            print(f"  {h} ({hero_games[h]} games)")
            last = h
        print(f"    {lv:>2}  {name:<28} {pct(wn, k)}")

    section("Same hero across NGS, seasons 20 to 22 (every player)")
    heroes = [h for h, c in hero_games.items() if c >= MIN_GAMES]
    lg = league_alone(set(heroes))
    for h in sorted(heroes, key=lambda h: -hero_games[h]):
        gs = [g for g in gids if games[g]["hero"] == h]
        ds = [d for g in gs for d in deaths[g]]
        # the league list only keeps takedowns with a hero on the kill, so count yours the same way
        al = sum(1 for d in ds if kind(d) == "alone" and d["n_killers"])
        if h in lg:
            lgn, lgd, lga = lg[h]
            print(f"  {h:<12} you: {len(gs)} games, {per(len(ds), len(gs))} deaths and {per(al, len(gs))} alone a game;"
                  f"  NGS: {lgn} games, {per(lgd, lgn)} deaths and {per(lga, lgn)} alone a game")


if __name__ == "__main__":
    main(sys.argv[1:])
