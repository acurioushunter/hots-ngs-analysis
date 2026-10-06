# Heroes of the Storm knowledge base

Built from Icy Veins on 2026-10-06 (patch 2.57 era). Everything here came from the live pages, not from memory.

## What is in it
| Data | Count | Where |
|---|---|---|
| Heroes (guide, abilities and talents pages) | 91 | `raw/heroes/*.json`, tables `hero`, `hero_section`, `talent` |
| Synergy and counter heroes plus the written advice | 91 | `raw/matchups.json`, tables `matchup`, `matchup_note` |
| Map guides | 15 | `raw/maps/*.json`, tables `map`, `map_section` |
| Tier lists: general, master, ARAM, Quick Match, one per map | 19 | `raw/tierlists/*.json`, tables `tier_list`, `tier_entry` |
| Hunter's verified percent damage talent slots | 11 | table `verified_pct_talent` |
| Full text search over every page | all | table `search` (SQLite FTS5) |

The database is `hots_knowledge.db`. Ask it with `python ../kb.py` (see the top of `kb.py` for commands).

## Rebuild
```
python build_knowledge.py     # raw JSON to hots_knowledge.db
python test_knowledge.py      # must print OK
```
`receiver.py` is only needed to scrape again (see below). It listens on 127.0.0.1:8765 and writes under `knowledge/raw/` only.

## Rules for trusting the data
1. **Talent slot = left to right order on Icy Veins**, 1 based. `talent.slot` is that order. The 11 slots Hunter confirmed are checked against the scrape by `test_knowledge.py`, so a page redesign breaks the test instead of silently shifting slots.
2. **Check the date.** Every hero has `guide_updated` and `talents_updated` taken from the page changelog. Sixty or so pages are 2025 or 2026. Older ones lag the current patch. Tychus talents are from 2021, so treat them as least reliable.
3. **`talent.pct_health_text = 1` is a candidate, not a verdict.** It means the text has a "N% of ... maximum or current Health" phrase and mentions damage. It catches all 11 verified talents but also some heals and shields. `kb.py pct` lists them and marks the verified ones.
4. **Tier lists are Icy Veins opinion**, per list and per date. They are not our Div C West data. Our own results live in `hots_s22.db`.
5. Heroes in two roles appear twice in a tier list (once per role).
6. The older `*_UNVERIFIED` guides from another AI were proven wrong in places and are not used here.

## How to scrape again
Icy Veins had no Cloudflare check. Open Chrome with the Claude in Chrome extension, start `python receiver.py`, and run the page scripts from a tab on icy-veins.com. Chrome will ask once to allow the site to reach your local network. Heroes Profile does have a Cloudflare check, so pass it yourself in Chrome first and never bypass it.

## Ideas to add later
Icy Veins general guides (mechanics, glossary), patch notes, your own Heroes Profile history into `hots_s22.db`, and a draft helper that joins `matchup`, `tier_entry` and our opponent reports.
