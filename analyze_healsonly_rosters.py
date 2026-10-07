"""Roster analysis of the games hunterstag played with the shared HealsOnly account (Storm League).

Input : knowledge/raw/healsonly/matches/<replayID>.json  (compact match/single responses)
        knowledge/hots_knowledge.db (hero roles from Icy Veins)
Run   : python analyze_healsonly_rosters.py
"""
import collections, glob, json, pathlib, re, sqlite3, unicodedata

ROOT = pathlib.Path(__file__).parent / "knowledge"
ME = "hunterstag"
TEAMMATES = ("HealsOnly", "Ltlbearista", "SoulShepherd", "NorthrnTouch", "ZergPern")
COUNTERS_OF_HANZO = {"Genji", "Illidan", "Zeratul"}  # Icy Veins "Hanzo is countered by"


def norm(name):
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]", "", name.lower())


def hero_roles():
    db = sqlite3.connect(ROOT / "hots_knowledge.db")
    return {norm(n): r for n, r in db.execute("SELECT name, role FROM hero")}


def load_games():
    games = []
    for path in sorted(glob.glob(str(ROOT / "raw" / "healsonly" / "matches" / "*.json"))):
        games.append(json.loads(pathlib.Path(path).read_text(encoding="utf-8")))
    return games


def my_side(game):
    me = next((p for p in game["players"] if p["tag"] == ME), None)
    if me is None:
        return None
    mine = [p for p in game["players"] if p["team"] == me["team"]]
    enemy = [p for p in game["players"] if p["team"] != me["team"]]
    return me, mine, enemy


def record(games):
    wins = sum(g["me"]["won"] for g in games)
    return f"{wins}-{len(games) - wins}"


def build_rows(games):
    rows = []
    for g in games:
        side = my_side(g)
        if side is None:
            continue
        me, mine, enemy = side
        rows.append({"id": g["replay"], "game": g, "me": me, "mine": mine, "enemy": enemy,
                     "mates": {p["tag"] for p in mine}, "length": g["length"]})
    return rows


def minutes(text):
    m = re.match(r"(\d+) minutes? (\d+) seconds?", text or "")
    return int(m.group(1)) + int(m.group(2)) / 60 if m else None


def pick_order(row):
    picks = [d for d in row["game"]["draft"] if str(d["type"]) == "1"]
    mine = {p["hero"] for p in row["mine"]}
    order = [i + 1 for i, d in enumerate(picks) if d["hero"] == row["me"]["hero"]]
    return order[0] if order else None


def party_size(row):
    colors = collections.Counter(p["party"] for p in row["mine"] if p["party"])
    return max(colors.values()) if colors else 1


def main():
    rows = [r for r in build_rows(load_games()) if "HealsOnly" in r["mates"]]  # HealsOnly on your team
    roles = hero_roles()
    print(f"games loaded: {len(rows)}; record {record([{'me': r['me']} for r in rows])}")

    print("\n== who was on your team (games and record) ==")
    for t in TEAMMATES:
        sub = [{"me": r["me"]} for r in rows if t in r["mates"]]
        print(f"  with {t:13} {len(sub):3} games  {record(sub) if sub else '-'}")
    print("  with HealsOnly AND Ltlbearista AND SoulShepherd:",
          record([{'me': r['me']} for r in rows if {"HealsOnly", "Ltlbearista", "SoulShepherd"} <= r["mates"]]),
          len([r for r in rows if {"HealsOnly", "Ltlbearista", "SoulShepherd"} <= r["mates"]]), "games")

    print("\n== premade size on your side ==")
    by_party = collections.defaultdict(list)
    for r in rows:
        by_party[party_size(r)].append({"me": r["me"]})
    for k, v in sorted(by_party.items()):
        print(f"  {k}-stack  {len(v):3} games  {record(v)}")

    print("\n== your hero by draft pick number (1 = first pick of the game) ==")
    by_pick = collections.defaultdict(list)
    for r in rows:
        by_pick[pick_order(r)].append({"me": r["me"]})
    for k, v in sorted(by_pick.items(), key=lambda kv: (kv[0] is None, kv[0])):
        print(f"  pick {k}  {len(v):3} games  {record(v)}")

    print("\n== Hanzo games ==")
    for r in sorted((r for r in rows if r["me"]["hero"] == "Hanzo"), key=lambda r: r["game"]["date"]):
        enemy = [p["hero"] for p in r["enemy"]]
        counters = sorted(set(enemy) & COUNTERS_OF_HANZO)
        front = sum(1 for p in r["mine"] if roles.get(norm(p["hero"])) in ("tank", "bruiser"))
        print(f"  {r['game']['date'][:10]} {r['game']['map'][:12]:12} {'W' if r['me']['won'] else 'L'} {r['length'] or '':>18} pick#{pick_order(r)} "
              f"deaths {r['me']['d']} frontline {front} counters {counters or '-'} mates {sorted(r['mates'] & set(TEAMMATES) - {'HealsOnly'})}")
        print("      team: " + ", ".join(p["hero"] for p in r["mine"] if p["tag"] != ME) + " | enemy: " + ", ".join(p["hero"] for p in r["enemy"]))

    print("\n== frontline (tank + bruiser) count on your team vs result, all heroes ==")
    by_front = collections.defaultdict(list)
    for r in rows:
        front = sum(1 for p in r["mine"] if roles.get(norm(p["hero"])) in ("tank", "bruiser"))
        by_front[front].append({"me": r["me"]})
    for k, v in sorted(by_front.items()):
        print(f"  {k} frontline  {len(v):3} games  {record(v)}")

    print("\n== game length buckets (minutes) ==")
    by_len = collections.defaultdict(list)
    for r in rows:
        m = minutes(r["length"])
        if m is not None:
            by_len["<15" if m < 15 else "15-20" if m < 20 else "20-25" if m < 25 else "25+"].append({"me": r["me"]})
    for k in ("<15", "15-20", "20-25", "25+"):
        if by_len[k]:
            print(f"  {k:6} {len(by_len[k]):3} games  {record(by_len[k])}")


if __name__ == "__main__":
    main()
