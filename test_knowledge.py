"""Sanity checks for hots_knowledge.db. Run: python test_knowledge.py"""
import sqlite3, pathlib

db = sqlite3.connect(pathlib.Path(__file__).parent / "knowledge" / "hots_knowledge.db")
failures = []

def check(ok, msg):
    if not ok:
        failures.append(msg)

# 1. Every verified percent damage slot must match the scraped talent at that slot.
for hero, level, slot, name, _note in db.execute("SELECT hero,level,slot,talent,note FROM verified_pct_talent"):
    row = db.execute("SELECT name FROM talent WHERE slug=? AND level=? AND slot=?", (hero, level, slot)).fetchone()
    check(row is not None and row[0] == name, f"verified {hero} L{level} slot {slot} expected {name!r}, scraped {row}")

# 1b. The text rule must recall every verified percent damage talent.
missed = db.execute("SELECT v.hero,v.level,v.talent FROM verified_pct_talent v JOIN talent t ON t.slug=v.hero AND t.level=v.level AND t.slot=v.slot WHERE t.pct_health_text=0").fetchall()
check(not missed, f"pct_health_text misses verified talents: {missed}")

# 2. Hanzo layout confirmed by Hunter: tier sizes 3,3,3,2,3,3,4.
sizes = [n for _, n in db.execute("SELECT level, COUNT(*) FROM talent WHERE slug='hanzo' GROUP BY level ORDER BY level")]
check(sizes == [3, 3, 3, 2, 3, 3, 4], f"hanzo tier sizes {sizes}")

# 3. Every hero has a role, talents in all 7 tiers, and at least one synergy and counter.
for slug, in db.execute("SELECT slug FROM hero"):
    tiers = db.execute("SELECT COUNT(DISTINCT level) FROM talent WHERE slug=?", (slug,)).fetchone()[0]
    check(tiers == 7, f"{slug} has {tiers} talent tiers")
    for kind in ("synergy", "counter"):
        n = db.execute("SELECT COUNT(*) FROM matchup WHERE slug=? AND kind=?", (slug, kind)).fetchone()[0]
        check(n > 0, f"{slug} has no {kind} heroes")
check(not db.execute("SELECT 1 FROM hero WHERE role IS NULL OR role=''").fetchall(), "hero without role")

# 4. Matchup and tier entries must point at real heroes.
for table, col in (("matchup", "other_slug"), ("tier_entry", "hero")):
    bad = db.execute(f"SELECT DISTINCT {col} FROM {table} WHERE {col} NOT IN (SELECT slug FROM hero)").fetchall()
    check(not bad, f"{table}.{col} unknown heroes: {bad}")

print("FAILED:" if failures else "OK", *failures, sep="\n")
raise SystemExit(bool(failures))
