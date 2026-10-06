"""Build knowledge/hots_knowledge.db from the Icy Veins JSON in knowledge/raw/.

Run: python build_knowledge.py
Tables: hero, hero_section, talent, matchup, matchup_note, map, map_section,
        tier_list, tier_entry, verified_pct_talent, search (FTS5 over all text).
"""
import json, re, sqlite3, pathlib
from datetime import datetime

ROOT = pathlib.Path(__file__).parent / "knowledge"
RAW = ROOT / "raw"
DB_PATH = ROOT / "hots_knowledge.db"

SCHEMA = """
CREATE TABLE hero(slug TEXT PRIMARY KEY, name TEXT, role TEXT, guide_url TEXT, abilities_url TEXT, talents_url TEXT,
                  guide_updated TEXT, abilities_updated TEXT, talents_updated TEXT);
CREATE TABLE hero_section(slug TEXT, page TEXT, ord INT, title TEXT, text TEXT);
CREATE TABLE talent(slug TEXT, level INT, slot INT, marker TEXT, name TEXT, text TEXT, pct_health_text INT);
CREATE TABLE matchup(slug TEXT, kind TEXT, other_slug TEXT);
CREATE TABLE matchup_note(slug TEXT, kind TEXT, text TEXT);
CREATE TABLE map(slug TEXT PRIMARY KEY, name TEXT, url TEXT, updated TEXT);
CREATE TABLE map_section(map TEXT, ord INT, title TEXT, text TEXT);
CREATE TABLE tier_list(name TEXT PRIMARY KEY, url TEXT, updated TEXT);
CREATE TABLE tier_entry(list_name TEXT, tier TEXT, role TEXT, hero TEXT, ban INT);
CREATE TABLE verified_pct_talent(hero TEXT, level INT, slot INT, talent TEXT, note TEXT, source TEXT);
CREATE VIRTUAL TABLE search USING fts5(kind, ref, title, text);
"""

# Slots verified by Hunter / Icy Veins in the Cowork session (HANDOFF.md). slot = left to right on Icy Veins.
VERIFIED_PCT = [
    ("hanzo", 16, 3, "Giant Slayer", "Hunter confirmed Hanzo slot order"),
    ("greymane", 10, 2, "Cursed Bullet", "Greymane has two percent damage abilities"),
    ("greymane", 16, 3, "Alpha Killer", ""),
    ("greymane", 20, 2, "Gilnean Roulette", ""),
    ("leoric", 13, 3, "Spectral Leech", "Leoric can go drain life or auto attack build"),
    ("leoric", 16, 1, "Crushing Hope", ""),
    ("tychus", 16, 2, "Titan Grenade", "Icy Veins page from 2021, least reliable; maybe bad into Deathwing (unverified)"),
    ("tychus", 16, 3, "Sizzlin' Attacks", "Icy Veins page from 2021, least reliable"),
    ("zuljin", 16, 1, "No Mercy!", "Only vs Grievous marked targets; Zul'jin is not always percent damage"),
    ("sylvanas", 1, 3, "Overwhelming Affliction", "Needs a slow, useless vs Deathwing; rarely taken, W's L1 talent is best now"),
    ("valla", 16, 3, "Manticore", ""),
]

# Candidate flag only: a "N% of ... maximum/current Health" phrase that also mentions damage. Includes some heals/shields.
PCT_HEALTH = re.compile(r"\d+(?:\.\d+)?%\s+of\s+(?:[\w']+\W+){0,4}?(?:maximum|max|current)\s+Health", re.I)
DAMAGE_WORD = re.compile(r"damag", re.I)
CHANGELOG_LINE = re.compile(r"^(\d{1,2} \w{3}\.? \d{4}) \(([^)]*)\)", re.M)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_date(text):
    return datetime.strptime(text.replace(".", ""), "%d %b %Y").date().isoformat()


def latest_by_page(sections):
    """Latest changelog date per page kind: 'talents', 'abilities', 'this'."""
    latest = {}
    for sec in sections:
        if sec["title"] != "Changelog":
            continue
        for date_text, page in CHANGELOG_LINE.findall(sec["text"]):
            kind = page.split()[0]
            iso = parse_date(date_text)
            latest[kind] = max(latest.get(kind, ""), iso)
    return latest


MARKER_GLYPHS = re.compile(r"^[✓✔✗✘?︎️\s]+")


def strip_marker(text):
    return MARKER_GLYPHS.sub("", text)


def talent_name(text):
    return text.split(" (Level", 1)[0].strip()


def insert_sections(db, table, key, page, sections):
    for i, s in enumerate(sections):
        if page is None:
            db.execute(f"INSERT INTO {table} VALUES (?,?,?,?)", (key, i, s["title"], s["text"]))
        else:
            db.execute(f"INSERT INTO {table} VALUES (?,?,?,?,?)", (key, page, i, s["title"], s["text"]))
        db.execute("INSERT INTO search VALUES (?,?,?,?)", (table, key, s["title"], s["text"]))


def load_hero(db, hero, role_row):
    slug = hero["slug"]
    guide_dates = latest_by_page(hero["guide"])
    abil_dates = latest_by_page(hero["abilities"])
    talent_dates = latest_by_page(hero["guide"] + hero["abilities"] + hero["talent_pages"])
    db.execute("INSERT INTO hero VALUES (?,?,?,?,?,?,?,?,?)",
               (slug, role_row["name"], role_row["role"], hero["source"]["guide"], hero["source"]["abilities"],
                hero["source"]["talents"], guide_dates.get("this"), abil_dates.get("abilities") or abil_dates.get("this"),
                talent_dates.get("talents")))
    insert_sections(db, "hero_section", slug, "guide", hero["guide"])
    insert_sections(db, "hero_section", slug, "abilities", hero["abilities"])
    insert_sections(db, "hero_section", slug, "talents", hero["talent_pages"])
    for level, slots in hero["talents"].items():
        for t in slots:
            text = strip_marker(t["text"])
            db.execute("INSERT INTO talent VALUES (?,?,?,?,?,?,?)",
                       (slug, int(level), t["slot"], t["marker"], talent_name(text), text,
                        int(bool(PCT_HEALTH.search(text) and DAMAGE_WORD.search(text)))))


def load_matchups(db, matchups):
    for slug, sides in matchups.items():
        for kind, side in (("synergy", sides["synergies"]), ("counter", sides["counters"])):
            for other in side["heroes"]:
                db.execute("INSERT INTO matchup VALUES (?,?,?)", (slug, kind, other))
            db.execute("INSERT INTO matchup_note VALUES (?,?,?)", (slug, kind, side["text"]))
            db.execute("INSERT INTO search VALUES (?,?,?,?)", ("matchup_note", slug, kind, side["text"]))


def pretty(slug):
    return slug.replace("-", " ").title()


def load_map(db, m):
    updated = max(latest_by_page(m["sections"]).values(), default=None)
    db.execute("INSERT INTO map VALUES (?,?,?,?)", (m["name"], pretty(m["name"]), m["source"], updated))
    insert_sections(db, "map_section", m["name"], None, m["sections"])


def strip_count(role):
    return re.sub(r"\s*\d+\s*Heroes?\s*$", "", role).strip()


def load_tier_list(db, tl):
    updated = max(latest_by_page(tl["sections"]).values(), default=None)
    db.execute("INSERT INTO tier_list VALUES (?,?,?)", (tl["name"], tl["source"], updated))
    for e in tl["entries"]:
        db.execute("INSERT INTO tier_entry VALUES (?,?,?,?,?)",
                   (tl["name"], e["tier"], strip_count(e["role"]), e["hero"], int(e["ban"])))
    for s in tl["sections"]:
        db.execute("INSERT INTO search VALUES (?,?,?,?)", ("tier_list", tl["name"], s["title"], s["text"]))


def build():
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA)
    roles = {r["slug"]: r for r in load(RAW / "hero_roles.json")}
    for path in sorted((RAW / "heroes").glob("*.json")):
        hero = load(path)
        load_hero(db, hero, roles[hero["slug"]])
    load_matchups(db, load(RAW / "matchups.json"))
    for path in sorted((RAW / "maps").glob("*.json")):
        load_map(db, load(path))
    for path in sorted((RAW / "tierlists").glob("*.json")):
        load_tier_list(db, load(path))
    db.executemany("INSERT INTO verified_pct_talent VALUES (?,?,?,?,?,'HANDOFF.md / Icy Veins')", VERIFIED_PCT)
    db.commit()
    return db


if __name__ == "__main__":
    conn = build()
    for table in ("hero", "hero_section", "talent", "matchup", "map", "map_section", "tier_list", "tier_entry"):
        print(table, conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
