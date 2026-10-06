"""Ask the HotS knowledge base. Examples:
  python kb.py hero hanzo          overview, strengths, matchups, maps, tips
  python kb.py talents hanzo       every talent by tier, left to right slot order
  python kb.py counters hanzo      who counters him, who synergizes
  python kb.py map hanamura-temple map guide text
  python kb.py tier general [role] tier list (general, master, aram, quick-match, or a map slug)
  python kb.py pct                 talents that look like percent health damage
  python kb.py search "blind"      full text search across everything
"""
import sqlite3, sys, pathlib

DB = pathlib.Path(__file__).parent / "knowledge" / "hots_knowledge.db"


def rows(sql, *args):
    return sqlite3.connect(DB).execute(sql, args).fetchall()


def show_hero(slug):
    name, role, updated = rows("SELECT name, role, guide_updated FROM hero WHERE slug=?", slug)[0]
    print(f"{name} ({role}), guide updated {updated}")
    for title, text in rows("SELECT title, text FROM hero_section WHERE slug=? AND page='guide' AND title NOT IN ('Changelog') ORDER BY ord", slug):
        print(f"\n## {title}\n{text}")


def show_talents(slug):
    tdate = rows("SELECT talents_updated FROM hero WHERE slug=?", slug)[0][0]
    print(f"talents page last updated {tdate}")
    for level, slot, marker, text, pct in rows("SELECT level, slot, marker, text, pct_health_text FROM talent WHERE slug=? ORDER BY level, slot", slug):
        print(f"L{level} slot {slot} [{marker}]{' [%HP?]' if pct else ''} {text}")


def show_counters(slug):
    for kind in ("synergy", "counter"):
        heroes = [r[0] for r in rows("SELECT other_slug FROM matchup WHERE slug=? AND kind=?", slug, kind)]
        print(f"{kind}: {', '.join(heroes)}")
        print(rows("SELECT text FROM matchup_note WHERE slug=? AND kind=?", slug, kind)[0][0], "\n")


def show_map(slug):
    for title, text in rows("SELECT title, text FROM map_section WHERE map=? ORDER BY ord", slug):
        print(f"\n## {title}\n{text}")


def show_tier(name, role=None):
    sql = "SELECT tier, role, hero, ban FROM tier_entry WHERE list_name=?" + (" AND lower(role) LIKE ?" if role else "") + " ORDER BY tier, role"
    for tier, r, hero, ban in rows(sql, name, *([f"%{role.lower()}%"] if role else [])):
        print(f"{tier:7} {r:16} {hero}{'  BAN' if ban else ''}")


def show_pct():
    for slug, level, slot, name in rows("SELECT slug, level, slot, name FROM talent WHERE pct_health_text=1 ORDER BY slug, level"):
        verified = rows("SELECT 1 FROM verified_pct_talent WHERE hero=? AND level=? AND slot=?", slug, level, slot)
        print(f"{slug:14} L{level:<2} slot {slot} {name}{'  (verified)' if verified else ''}")


def show_search(term):
    for kind, ref, title, snip in rows("SELECT kind, ref, title, snippet(search, 3, '[', ']', '...', 18) FROM search WHERE search MATCH ? LIMIT 25", term):
        print(f"{kind}/{ref} - {title}: {snip}")


COMMANDS = {"hero": show_hero, "talents": show_talents, "counters": show_counters, "map": show_map,
            "tier": show_tier, "pct": show_pct, "search": show_search}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]](*sys.argv[2:])
