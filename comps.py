"""Team comp analysis: python3 comps.py "PHOENIX RISING AMETHYST" """
import sqlite3, sys
from collections import Counter, defaultdict
from hero_tags import HEROES

def style_counts(heroes):
    counts = Counter()
    for hero in heroes:
        counts.update(HEROES[hero][1][:2])
    return counts

def role_counts(heroes):
    return Counter(HEROES[h][0] for h in heroes)

STYLE_GROUPS = {"Poke / siege": {"poke"}, "Dive / engage": {"dive", "engage"}, "Brawl / sustain": {"brawl", "sustain"}}

def group_scores(heroes):
    """Primary tag counts 2 points, secondary 1, summed per style group."""
    scores = Counter()
    for hero in heroes:
        for position, tag in enumerate(HEROES[hero][1][:2]):
            for group, tags in STYLE_GROUPS.items():
                if tag in tags:
                    scores[group] += 2 - position
    return scores

def classify(heroes):
    """Name the comp by its leading style group, or Balanced when two groups are within 1 point."""
    ranked = group_scores(heroes).most_common()
    if not ranked:
        return "Balanced"
    if len(ranked) > 1 and ranked[0][1] - ranked[1][1] < 2:
        return "Balanced"
    return ranked[0][0]

def structure(heroes):
    r = role_counts(heroes)
    healers = r["Healer"] + r["Support"]
    front = r["Tank"] + r["Bruiser"]
    return f"{front} frontline / {healers} heal+support / {r['Ranged'] + r['Melee']} damage"

def load_comps(db):
    comps = defaultdict(dict)
    for gid, team, hero in db.execute("SELECT game_id,team,hero FROM player_game"):
        comps[gid].setdefault(team, []).append(hero)
    return comps

def tally(rows):
    wins = sum(w for w, _ in rows)
    return f"{wins}-{len(rows) - wins}"

def print_table(title, header, rows):
    print(f"\n## {title}\n| {' | '.join(header)} |\n|{'---|' * len(header)}")
    for r in rows:
        print("| " + " | ".join(str(c) for c in r) + " |")

def team_comp_report(db, team):
    comps = load_comps(db)
    games = db.execute("SELECT tg.game_id,tg.opponent,tg.won,tg.map,game.date FROM team_game tg JOIN game USING(game_id) WHERE tg.team=? ORDER BY game_id", (team,)).fetchall()
    detail, by_own, by_opp, by_matchup, by_struct, by_push, by_sustain = [], defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    for gid, opp, won, map_name, date in games:
        mine, theirs = comps[gid][team], comps[gid][opp]
        own_style, opp_style = classify(mine), classify(theirs)
        by_own[own_style].append((won, gid)); by_opp[opp_style].append((won, gid))
        by_matchup[(own_style, opp_style)].append((won, gid)); by_struct[structure(mine)].append((won, gid))
        by_push[style_counts(mine)["push"]].append((won, gid)); by_sustain[style_counts(mine)["sustain"]].append((won, gid))
        detail.append((gid, date[:10], "W" if won else "L", opp, map_name, own_style, ", ".join(mine), opp_style, ", ".join(theirs)))
    print(f"# Comp analysis: {team}")
    print_table("Our comp style", ["style", "record"], [(k, tally(v)) for k, v in sorted(by_own.items())])
    print_table("Enemy comp style", ["style", "our record vs it"], [(k, tally(v)) for k, v in sorted(by_opp.items())])
    print_table("Matchups (ours vs theirs)", ["ours", "theirs", "record"], [(a, b, tally(v)) for (a, b), v in sorted(by_matchup.items())])
    print_table("Comp structure", ["frontline / heal / damage", "record"], [(k, tally(v)) for k, v in sorted(by_struct.items())])
    print_table("Wave clear / push heroes in our comp", ["heroes with push tag", "record"], [(k, tally(v)) for k, v in sorted(by_push.items())])
    print_table("Sustain (healing or self sustain) in our comp", ["heroes with sustain tag", "record"], [(k, tally(v)) for k, v in sorted(by_sustain.items())])
    print_table("Every game", ["game", "date", "res", "opponent", "map", "our style", "our comp", "their style", "their comp"], detail)

if __name__ == "__main__":
    team_comp_report(sqlite3.connect("hots_s22.db"), sys.argv[1] if len(sys.argv) > 1 else "PHOENIX RISING AMETHYST")
