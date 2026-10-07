# HotS NGS analysis (hunterstag, PRA, Division C West Season 22)

Private repo `acurioushunter/hots-ngs-analysis`. Purpose: help Hunter and his team (Phoenix Rising Amethyst) win NGS matches with draft, ban, map and comp calls. Not related to the Vision PM work.

## Standing rules (each one came from a mistake)
1. **Numbers come from a run, not from memory.** Re-run the script or query before writing a record or a percentage, and re-check every figure in a doc before committing. Several early docs had wrong numbers that a re-check caught.
2. **Recent data only for hero pools:** the last 12 months, team games, HealsOnly team games and NGS. Career numbers are mostly 2020 and misled us (Raynor, Abathur, Valla). Sylvanas replaced Raynor.
3. **Blaze is not a ranged hero.** He is an offlaner and his range is too short to count. Every ranged count treats him as melee (`analyze_ranged_by_map.py`, `analyze_wave_clear.py`).
4. **Icy Veins tier lists are per role.** Blaze is S as an offlaner and D as a tank, and Varian, Johanna, E.T.C. and others also have several roles. Always filter `tier_entry.role`; never take a hero's last row.
5. **HealsOnly is a shared account.** Only use games with Hunter and teammates (the 71 team games). chelsi's own account is not used for Storm League.
6. **Never bypass Cloudflare.** Hunter passes the Heroes Profile check in his own Chrome; then use the tab he has open. Do not burst guessed API bodies, record the page's own request instead. If a request returns 403, stop and ask.
7. **Today's date comes from the clock**, not from a file.
8. **Prose for Hunter has no hyphens or em dashes** (he reads them as an AI giveaway). Hyphens in records like 7-2 and in hero names are fine.
9. **Say how big the sample is.** Most per map and per hero numbers rest on 2 to 12 games. Say "lean", not "rule", and say what the data cannot show (NGS pages have no timeline).
10. **Do not claim a mechanism the data does not show.** Separate "the numbers say" from "the hero kit suggests".

## Start here
Read `PROJECT_STATE.md` after this file: who is on the team, where the season stands, the document map, open work, how to refresh the data, and the git routine. Hunter does not use git. At the start of a session `git pull`; when the work is done run the tests, commit with a plain message and `git push` (this repo only). The folder `C:\Users\visio\Downloads\Claude Code` is the Vision business project with its own repo and rules: do not open or change it from a HOTS session.

## Where things are
- Start with `CCS_DRAFT_CHEAT_SHEET.md` (next opponent), then `CCS_FULL_PICTURE.md`, `QHIRA_DEEP_DIVE.md`, `COMP_AND_POKE_INSIGHTS.md`, `DRAFT_LESSONS_AND_COMPS_BY_MAP.md`, `WAVE_CLEAR_AND_MAP_GUIDE.md`, `RECENT_FORM_AND_POOLS.md` (Hunter and chelsi pools), `COSMOS_MATCH_PREP.md`, `PLAYOFFS.md`, `NGS_DIVISION_SUMMARY.md`.
- Superseded: `TONIGHT_PLAN.md`, parts of `HUNTER_DEEP_DIVE.md` (banners say so).
- Databases in `knowledge/`: `ngs_div.db` (every division game: drafts, bans, per player stats), `hunter_hp.db` (Hunter's 4,735 Heroes Profile games), `players_hp.db` and `ngs.db` (other players), `hots_knowledge.db` (Icy Veins heroes, maps, counters, tier lists).
- Raw JSON in `knowledge/raw/`. Analysis scripts at the top level (`analyze_*.py`), builders `build_*.py`, checks `test_*.py` (all must print OK after a rebuild).
- Pull and resume notes: `PULL_STATUS.md`. New NGS games: `ngs_games_to_raw.py`, then `build_ngs_division.py` and `test_ngs_division.py`.

## Draft Room (the real time draft tool)
- `python build_playbook.py` regenerates `playbook/data.json`, `facts/teams/*.md`, `facts/maps/*.md`, `draft_tool.html` (stand alone) and `draft_tool_artifact.html` (the page fragment published as the phone artifact). Then `python test_playbook.py` and `node test_engine.js`.
- Judgment lives in `playbook/config/our_team.json` (pools), `playbook/config/rules.json` (rules with reasons and evidence) and `playbook/notes/`. Engine is `playbook/engine.js`, UI is `playbook/app.html`. How to update: `UPDATE_PLAYBOOK.md`.
- Published phone artifact (private): https://claude.ai/artifact/QuQ1FdsJfFn7sH3988KrYU. To update it, publish `draft_tool_artifact.html` with that `url` (read it first). Do not create a second artifact.
- Never edit the generated files by hand. A hero named in config must exist or the build stops.

## State as of 2026-10-07
- 56 of 56 Division C West games on Heroes Profile are on disk (through 23347, the Oct 6 PRA v Cosmos match). Six Good Lordy games are not on Heroes Profile.
- Hunter's Storm League data ends Oct 5.
- Next opponent: CCS (Can't Counterpick Stupid), the likely final. PRA beat Cosmos 2-1 on Oct 6 (Cosmos won Tomb).
