"""Turn saved NGS match/single responses into raw_games.txt and talents_raw.txt lines.

Input : knowledge/raw/ngs/matches/<replayID>.json (one match/single response per game)
Output: appends new games to raw_games.txt and talents_raw.txt (games already present are skipped)
Run   : python ngs_games_to_raw.py ; python build_db.py
"""
import datetime, json, pathlib

ROOT = pathlib.Path(__file__).parent
MATCHES = ROOT / "knowledge" / "raw" / "ngs" / "matches"
TIERS = ("level_one", "level_four", "level_seven", "level_ten", "level_thirteen", "level_sixteen", "level_twenty")
CENTRAL_OFFSET = datetime.timedelta(hours=-5)  # NGS dates are UTC, raw_games.txt uses Central (CDT)


def local_date(utc_text):
    when = datetime.datetime.strptime(utc_text, "%Y-%m-%d %H:%M:%S") + CENTRAL_OFFSET
    return when.strftime("%m/%d/%Y %I:%M:%S %p")


def length_text(text):
    minutes, seconds = [int(p) for p in text.replace("minutes", "").replace("minute", "").replace("seconds", "").replace("second", "").split()]
    return f"{minutes}:{seconds}"


def team_names(match):
    names = match["team_names"]
    return [names["team_one"]["team_name"].upper(), names["team_two"]["team_name"].upper()]


def team_header(name, is_first, won):
    return f"{name}:{'F' if is_first else 'M'}:{'W' if won else 'L'}"


def draft_text(match):
    parts = []
    for d in sorted(match["draft_order"], key=lambda d: d["pick_number"]):
        hero = d["hero"] if isinstance(d["hero"], str) else d["hero"]["name"]
        if hero == "No Pick":  # a skipped ban, not a hero
            continue
        kind = "b" if str(d["type"]) == "0" else "p"
        parts.append(f"{d['pick_number'] + 1}{kind}{hero}")
    return ",".join(parts)


def player_text(p):
    s = p["score"]
    return f"{p['battletag']}~{p['hero']['name']}~{p['total_rank']}~{s['kills']}~{s['takedowns']}~{s['deaths']}"


def talent_code(p):
    letters = []
    for tier in TIERS:
        t = (p.get("talents") or {}).get(tier)
        letters.append(chr(ord("a") + int(t["sort"])) if t else "a")
    return "".join(letters)


def convert(replay_id, match):
    names = team_names(match)
    first, winner = int(match["first_pick"]), int(match["winner"])
    order = [winner, 1 - winner]  # winner listed first, like the existing file
    headers = "/".join(team_header(names[t], t == first, t == winner) for t in order)
    players = [p for t in order for p in match["players"][t]]
    raw = "|".join([str(replay_id), local_date(match["game_date"]), match["game_map"]["name"], length_text(match["game_length"]),
                    headers, draft_text(match), ",".join(player_text(p) for p in players), "ok"])
    talents = f"{replay_id}|" + ",".join(f"{p['battletag']}~{p['hero']['name']}~{talent_code(p)}" for p in players)
    return raw, talents


def known_ids(path):
    return {line.split("|")[0] for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def main():
    raw_path, talents_path = ROOT / "raw_games.txt", ROOT / "talents_raw.txt"
    have = known_ids(raw_path)
    new_raw, new_talents = [], []
    for path in sorted(MATCHES.glob("*.json"), key=lambda p: int(p.stem)):
        if path.stem in have:
            continue
        raw, talents = convert(path.stem, json.loads(path.read_text(encoding="utf-8")))
        new_raw.append(raw)
        new_talents.append(talents)
    for path, lines in ((raw_path, new_raw), (talents_path, new_talents)):
        if lines:
            with open(path, "a", encoding="utf-8") as f:
                f.write("\n".join(lines) + "\n")
    print(f"added {len(new_raw)} games")


if __name__ == "__main__":
    main()
