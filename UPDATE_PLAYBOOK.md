# Updating the draft playbook

The draft tool (`draft_tool_artifact.html` for the published page, `draft_tool.html` for any browser) is generated. Never edit it by hand. Everything it knows comes from three places.

| What | Where | Edit by hand? |
|---|---|---|
| Game data: every draft, ban, pick and player line | `knowledge/ngs_div.db`, built from `knowledge/raw/ngs/matches/*.json` | No, rebuilt from the saved match pages |
| Icy Veins: counters, synergies, map advice, tier lists by role | `knowledge/hots_knowledge.db` | No |
| Hero, map and guide library: overviews, talents, abilities, builds, tier lists, matchups | `knowledge/hots_knowledge.db` plus `knowledge/icy_build_codes.txt`, built by `build_library.py` into `playbook/library.json` | Build codes: yes, add or replace lines in `icy_build_codes.txt`. Everything else no |
| Written draft tips | `playbook/notes/draft_tips.md` | Yes (no hyphens or dashes in prose, the test checks) |
| Our roster and hero pools | `playbook/config/our_team.json` | Yes |
| Judgment calls (who to ban, healer rules, ranged limits per map), each with a reason and where the evidence is | `playbook/config/rules.json` | Yes |
| Written lessons per opponent and per map | `playbook/notes/teams/<team>.md`, `playbook/notes/maps/<map>.md` | Yes |

## After every match night
1. Get the new games. In your own Chrome pass the Heroes Profile check, then ask Claude to pull the new division games. It runs `scripts/hp_pull_division.js` (with `python receiver.py` running and the list from `python scripts/known_games.py`), which compares the site's division match list with `knowledge/raw/ngs/matches/` and saves what is missing.
2. Rebuild and check:
   ```
   python build_ngs_division.py
   python test_ngs_division.py
   python build_playbook.py
   python test_playbook.py
   node test_engine.js
   ```
   All three tests must print OK. `test_playbook.py` fails if `data.json` is stale against the database.
3. Update the written lessons if the match taught something: add a line to the team note, and add or change a rule in `rules.json` (keep `why` and `evidence`).
4. Republish `draft_tool_artifact.html` over the same artifact link so phones keep the same URL. The data inside the page is a snapshot, so a page that was not republished shows old numbers (the header shows the newest game it knows).

## Build codes
`knowledge/icy_build_codes.txt` holds Icy Veins builds as in game import codes (`[T2121334,Sylvanas]`) with the date Icy last updated each one. The builder decodes each digit against the Icy talent table (the digits are the option positions for levels 1, 4, 7, 10, 13, 16, 20; Chromie and The Lost Vikings have their own levels, handled automatically). A code that does not fit the talent table is printed as "build code problem" and left out, and `test_playbook.py` fails. Codes more than a year old, or older than the hero's last Icy talent page change, are flagged in the tool. To add a source such as Fan HotS or Heroes Profile builds, add lines in the same layout (`Label<TAB>[Tcode,Slug]<TAB>Mon D YYYY`) or extend `decode_builds` in `build_library.py`.

## New season or a new division
1. Pull the new games into `knowledge/raw/ngs/matches/` (move the old season's files to a folder like `knowledge/raw/ngs/season_22/` first, or the two seasons mix) and rebuild `ngs_div.db`.
2. Edit `playbook/config/our_team.json`: `team`, `season`, `division`, `next_opponent`, the roster tags and pools. Keep `not_ranged` (Blaze).
3. Check `rules.json`: rules scoped to a team name only apply when that team is the opponent, so old opponents' rules simply stay quiet. Delete rules whose evidence no longer holds.
4. Run the build and the three tests. Opponent fact sheets appear in `facts/teams/` and map sheets in `facts/maps/` automatically for every team in the database.

## How the recommendations work (so you can tune them)
- Our pick score for a hero: how well the best player for it fits (pool tier, this season's NGS record, Storm League record, Icy Veins tier for that player's role on this map) plus counters and synergy with what is on the board, composition needs (marksmen, ranged limits per map, healer and front line), rule bonuses, and timing (lock before a late ban, how hard the hero is to replace).
- Our ban score for a hero: how much the opponent relies on it (games, wins and rating, discounted when the player is clearly worse on it than on his other heroes), their first pick habit, whether it counters our picks, plus rule bonuses. Heroes in our pools are never suggested as bans unless a rule says so.
- The weights are in `rules.json` under `weights`. Every recommendation prints its reasons, so a surprising order can be traced to a number.
- Changing the model itself means editing `playbook/engine.js`; `node test_engine.js` then shows what moved.

## Known limits
- NGS match pages have no timeline, so nothing knows who led at ten minutes.
- Most records are 1 to 12 games.
- Only one division is in the database at a time. Other divisions need their own pull before their teams can be added.
