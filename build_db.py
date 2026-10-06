"""Parse raw_games.txt into a SQLite database (hots_s22.db)."""
import sqlite3, re, sys

FIRST_PICK_BAN_SLOTS = {1, 3, 11}
OTHER_BAN_SLOTS = {2, 4, 10}

def parse_team_header(text):
    name, order, result = text.rsplit(":", 2)
    return name, order == "F", result == "W"

def parse_draft(draft_text):
    for item in draft_text.split(","):
        slot, kind, hero = re.match(r"(\d+)([bp])(.*)", item).groups()
        yield int(slot), kind, hero

def parse_players(players_text):
    for item in players_text.split(","):
        name, hero, rating, kills, takedowns, deaths = item.split("~")
        yield name, hero, int(rating), int(kills), int(takedowns), int(deaths)

def parse_line(line):
    game_id, date, map_name, length, heads, draft, players, status = line.rstrip("\n").split("|")
    if status != "ok":
        raise ValueError(f"game {game_id} flagged {status}")
    teams = [parse_team_header(h) for h in heads.split("/")]
    mins, secs = length.split(":")
    return dict(game_id=int(game_id), date=date, map=map_name,
                seconds=int(mins) * 60 + int(secs), teams=teams,
                draft=list(parse_draft(draft)), players=list(parse_players(players)))

SCHEMA = """
CREATE TABLE game(game_id INTEGER PRIMARY KEY, date TEXT, map TEXT, seconds INTEGER, winner TEXT, loser TEXT, first_pick_team TEXT, map_pick_team TEXT);
CREATE TABLE team_game(game_id INT, team TEXT, opponent TEXT, won INT, first_pick INT, map TEXT);
CREATE TABLE ban(game_id INT, team TEXT, opponent TEXT, slot INT, hero TEXT, game_won INT);
CREATE TABLE pick(game_id INT, team TEXT, opponent TEXT, slot INT, hero TEXT, game_won INT);
CREATE TABLE player_game(game_id INT, team TEXT, opponent TEXT, player TEXT, hero TEXT, rating INT, kills INT, takedowns INT, deaths INT, game_won INT, map TEXT, seconds INT);
"""

FIRST_PICK_PICK_SLOTS = {5, 8, 9, 14, 15}

def pick_team(roster, slot, hero, first_team, map_team):
    """Team that played the hero; falls back to the slot rule if the hero was swapped out."""
    for team, heroes in roster.items():
        if hero in heroes:
            return team
    return first_team if slot in FIRST_PICK_PICK_SLOTS else map_team

def insert_game(db, g):
    (name1, first1, won1), (name2, first2, won2) = g["teams"]
    first_team, map_team = (name1, name2) if first1 else (name2, name1)
    winner, loser = (name1, name2) if won1 else (name2, name1)
    db.execute("INSERT INTO game VALUES(?,?,?,?,?,?,?,?)", (g["game_id"], g["date"], g["map"], g["seconds"], winner, loser, first_team, map_team))
    opp = {name1: name2, name2: name1}
    for name, first, won in g["teams"]:
        db.execute("INSERT INTO team_game VALUES(?,?,?,?,?,?)", (g["game_id"], name, opp[name], int(won), int(first), g["map"]))
    # players: first five belong to team listed first, last five to the second
    roster = {}
    for i, (player, hero, rating, k, td, d) in enumerate(g["players"]):
        team = name1 if i < 5 else name2
        won = int(team == winner)
        roster.setdefault(team, {})[hero] = player
        db.execute("INSERT INTO player_game VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (g["game_id"], team, opp[team], player, hero, rating, k, td, d, won, g["map"], g["seconds"]))
    for slot, kind, hero in g["draft"]:
        if kind == "b":
            team = first_team if slot in FIRST_PICK_BAN_SLOTS else map_team
            db.execute("INSERT INTO ban VALUES(?,?,?,?,?,?)", (g["game_id"], team, opp[team], slot, hero, int(team == winner)))
        else:
            team = pick_team(roster, slot, hero, first_team, map_team)
            db.execute("INSERT INTO pick VALUES(?,?,?,?,?,?)", (g["game_id"], team, opp[team], slot, hero, int(team == winner)))

def build(raw_path, db_path):
    db = sqlite3.connect(db_path)
    db.executescript("DROP TABLE IF EXISTS game;DROP TABLE IF EXISTS team_game;DROP TABLE IF EXISTS ban;DROP TABLE IF EXISTS pick;DROP TABLE IF EXISTS player_game;" + SCHEMA)
    with open(raw_path, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                insert_game(db, parse_line(line))
    db.commit()
    return db

if __name__ == "__main__":
    db = build("raw_games.txt", "hots_s22.db")
    for table in ("game", "team_game", "ban", "pick", "player_game"):
        print(table, db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
