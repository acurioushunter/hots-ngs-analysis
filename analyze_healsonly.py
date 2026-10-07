"""Games hunterstag played with the shared HealsOnly account (Storm League).

Input : knowledge/raw/healsonly/match_history/page_*.json (HealsOnly's games), knowledge/hunter_hp.db (hunterstag's games)
Output: knowledge/healsonly_shared_games.csv and a printed summary. Run: python analyze_healsonly.py
"""
import csv, glob, json, pathlib, sqlite3, collections

ROOT = pathlib.Path(__file__).parent / "knowledge"


def healsonly_games():
    rows = []
    for page in sorted(glob.glob(str(ROOT / "raw" / "healsonly" / "match_history" / "page_*.json"))):
        rows += json.loads(pathlib.Path(page).read_text(encoding="utf-8"))["data"]
    return {r["replayID"]: r for r in rows}


def hunter_games(db):
    cols = "replay_id,date,map,hero,won,deaths,kills,takedowns,hero_damage,siege_damage,xp_contribution,minion_damage,merc_camp_captures"
    return {r[0]: r for r in db.execute(f"SELECT {cols} FROM hp_game WHERE game_type='sl'")}


def rate(rows, won_of):
    return f"{sum(won_of(r) for r in rows)}-{len(rows) - sum(won_of(r) for r in rows)}"


def main():
    ho, hunter = healsonly_games(), hunter_games(sqlite3.connect(ROOT / "hunter_hp.db"))
    shared = sorted(set(ho) & set(hunter))
    same_team = [i for i in shared if int(ho[i]["winner"]) == hunter[i][4]]
    print(f"HealsOnly games {len(ho)}, shared with hunterstag {len(shared)}, same team {len(same_team)} (record {rate(same_team, lambda i: hunter[i][4])})")
    with open(ROOT / "healsonly_shared_games.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["replay_id", "date", "map", "same_team", "hunter_hero", "hunter_won", "hunter_deaths", "healsonly_hero", "healsonly_kills", "healsonly_deaths", "healsonly_siege", "healsonly_minion", "healsonly_xp"])
        for i in shared:
            h = ho[i]
            w.writerow([i, hunter[i][1], hunter[i][2], int(i in same_team), hunter[i][3], hunter[i][4], hunter[i][5], h["hero"]["name"], h["kills"], h["deaths"], h["siege_damage"], h["minion_damage"], h["experience_contribution"]])
    by_hero = collections.defaultdict(list)
    for i in same_team:
        by_hero[hunter[i][3]].append(i)
    print("hunterstag by hero in team games:")
    for hero, ids in sorted(by_hero.items(), key=lambda kv: -len(kv[1])):
        print(f"  {hero:10} {len(ids):3} games  {rate(ids, lambda i: hunter[i][4])}")
    total_by_hero = collections.defaultdict(list)
    for i, r in hunter.items():
        total_by_hero[r[3]].append(i)
    print("same hero WITHOUT HealsOnly on the team:")
    for hero in ("Sylvanas", "Junkrat", "Hanzo"):
        outside = [i for i in total_by_hero[hero] if i not in set(same_team)]
        print(f"  {hero:10} {len(outside):3} games  {rate(outside, lambda i: hunter[i][4])}  ({100*sum(hunter[i][4] for i in outside)/len(outside):.1f}%)")


if __name__ == "__main__":
    main()
