"""Ranged hero count by map and result, with Blaze counted as MELEE (an offlaner whose range is too short to count).

Input : knowledge/raw/ngs/matches/*.json (every Division C West Season 22 game on disk)
Run   : python analyze_ranged_by_map.py
"""
import collections, glob, json, pathlib

ROOT = pathlib.Path(__file__).parent
NOT_RANGED = {"Blaze"}  # Heroes Profile type says Ranged; hunterstag's call is that it does not count


def is_ranged(p):
    return p["hero"]["type"] == "Ranged" and p["hero"]["name"] not in NOT_RANGED


def rows():
    for path in sorted(glob.glob(str(ROOT / "knowledge" / "raw" / "ngs" / "matches" / "*.json"))):
        j = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
        names = [j["team_names"]["team_one"]["team_name"], j["team_names"]["team_two"]["team_name"]]
        sides = {0: [], 1: []}
        for side in j["players"]:
            for p in side:
                sides[p["team"]].append(p)
        for t in (0, 1):
            yield dict(gid=int(pathlib.Path(path).stem), map=j["game_map"]["name"], team=names[t], won=bool(sides[t][0]["winner"]),
                       ranged=sum(is_ranged(p) for p in sides[t]), heroes=[p["hero"]["name"] for p in sides[t]])


def rec(v):
    return f"{v[1]}-{v[0] - v[1]}"


def main():
    allrows = list(rows())
    print("games on disk:", len(allrows) // 2)
    by_map = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
    avg = collections.defaultdict(lambda: {True: [], False: []})
    for r in allrows:
        b = by_map[r["map"]]
        k = "3+" if r["ranged"] >= 3 else "2-"
        b[k][0] += 1; b[k][1] += r["won"]
        avg[r["map"]][r["won"]].append(r["ranged"])
    print(f"{'map':26} {'games':>5} {'win avg':>7} {'loss avg':>8} {'3+ ranged':>10} {'2 or fewer':>10}")
    for m, b in sorted(by_map.items(), key=lambda kv: -(kv[1]["3+"][0] + kv[1]["2-"][0])):
        w = avg[m][True]; l = avg[m][False]
        print(f"{m:26} {(b['3+'][0] + b['2-'][0]) // 2:5} {sum(w)/len(w):7.1f} {sum(l)/len(l):8.1f} {rec(b['3+']):>10} {rec(b['2-']):>10}")
    tot = collections.defaultdict(lambda: [0, 0])
    for r in allrows:
        k = min(r["ranged"], 4)
        tot[k][0] += 1; tot[k][1] += r["won"]
    print("all maps by ranged count:", {k: rec(v) for k, v in sorted(tot.items())})
    print("PRA games, ranged count and result:")
    for r in allrows:
        if r["team"] == "Phoenix Rising Amethyst":
            print(" ", r["gid"], r["map"][:14], r["ranged"], "W" if r["won"] else "L", r["heroes"])


if __name__ == "__main__":
    main()
