# HotS NGS analysis (hunterstag, PRA, Division C West Season 22)

Private repo `acurioushunter/hots-ngs-analysis`. Purpose: help Hunter and his team (Phoenix Rising Amethyst) win NGS matches with draft, ban, map and comp calls. Not related to the Vision PM work.

## Standing rules (each one came from a mistake)
1. **Numbers come from a run, not from memory.** Re-run the script or query before writing a record or a percentage, and re-check every figure in a doc before committing. Several early docs had wrong numbers that a re-check caught.
2. **Recent data only for hero pools:** the last 12 months, team games, HealsOnly team games and NGS. Career numbers are mostly 2020 and misled us (Raynor, Abathur, Valla). Sylvanas replaced Raynor.
3. **Blaze stays out of every ranged count** (`analyze_ranged_by_map.py`, `analyze_wave_clear.py`, `not_ranged` in `playbook/config/our_team.json`). Do it in code, but do not write a note about it into the app, the generated facts or the documents Hunter reads: he asked for that wording to be dropped.
4. **Icy Veins tier lists are per role.** Blaze is S as an offlaner and D as a tank, and Varian, Johanna, E.T.C. and others also have several roles. Always filter `tier_entry.role`; never take a hero's last row.
5. **HealsOnly is a shared account.** Only use games with Hunter and teammates (the 71 team games). chelsi's own account is not used for Storm League.
6. **Never bypass Cloudflare.** Hunter passes the Heroes Profile check in his own Chrome; then use the tab he has open. Do not burst guessed API bodies, record the page's own request instead. If a request returns 403, stop and ask.
7. **Today's date comes from the clock**, not from a file.
8. **Prose for Hunter has no hyphens or em dashes** (he reads them as an AI giveaway). Hyphens in records like 7-2 and in hero names are fine.
9. **Say how big the sample is.** Most per map and per hero numbers rest on 2 to 12 games. Say "lean", not "rule", and say what the data cannot show (NGS pages have no timeline).
10. **Do not claim a mechanism the data does not show.** Separate "the numbers say" from "the hero kit suggests".
11. **Ranged means a ranged damage dealer.** Healers, supports and tanks that shoot from range are not counted. It comes from the hero profile (`damage.ranged_dealer`), not Heroes Profile's attack type. Marksman means a ranged dealer whose damage is mostly autos.
12. **League facts are recency weighted by season** (half life 3 seasons, newest 3 seasons shown beside), and a division sized rule only fires when the league (NGS seasons 15 to 22) backs it. Say it is an association.
13. **Hunter's hero notes win over agent readings** (`knowledge/expert/owner_hero_notes.md`, applied by `apply_owner_notes.py`). Show them as "Hunter's read".

## Start here
Read `PROJECT_STATE.md` after this file: who is on the team, where the season stands, the document map, open work, how to refresh the data, and the git routine. Hunter does not use git. At the start of a session `git pull`; when the work is done run the tests, commit with a plain message and `git push` (this repo only). The folder `C:\Users\visio\Downloads\Claude Code` is the Vision business project with its own repo and rules: do not open or change it from a HOTS session.

## Where things are
- Start with `CCS_DRAFT_CHEAT_SHEET.md` (next opponent), then `CCS_FULL_PICTURE.md`, `QHIRA_DEEP_DIVE.md`, `COMP_AND_POKE_INSIGHTS.md`, `DRAFT_LESSONS_AND_COMPS_BY_MAP.md`, `WAVE_CLEAR_AND_MAP_GUIDE.md`, `RECENT_FORM_AND_POOLS.md` (Hunter and chelsi pools), `COSMOS_MATCH_PREP.md`, `PLAYOFFS.md`, `NGS_DIVISION_SUMMARY.md`.
- Superseded: `TONIGHT_PLAN.md`, parts of `HUNTER_DEEP_DIVE.md` (banners say so).
- Databases in `knowledge/`: `ngs_div.db` (every division game: drafts, bans, per player stats), `hunter_hp.db` (Hunter's 4,735 Heroes Profile games), `players_hp.db` and `ngs.db` (other players), `hots_knowledge.db` (Icy Veins heroes, maps, counters, tier lists).
- Raw JSON in `knowledge/raw/`. Analysis scripts at the top level (`analyze_*.py`), builders `build_*.py`, checks `test_*.py` (all must print OK after a rebuild).
- Pull and resume notes: `PULL_STATUS.md`. New NGS games: `ngs_games_to_raw.py`, then `build_ngs_division.py` and `test_ngs_division.py`.

## HotS Tools (the master app)
- `hots_tools.html` is the one page that holds everything: the Draft Room (HotS Drafter), the Draft Lab (league wide analysis, hero ratings, draft review), My Games (import a player's match history and get insights) and the Learn pages. Read `HOTS_TOOLS.md` for how it is put together, how to build it (`python build_hotstools.py --all`) and how to refresh its data.
- `python build_hotstools.py --personal` also builds `hots_tools_hunter.html`: the same app preloaded with Hunter's games and team. It is git ignored and not for sharing. Share `hots_tools.html` (or `hots_tools.zip`).
- Tests: `node test_hotstools.js` (My Games engine and the built page), `node test_draftlab.js`, plus the Draft Room tests below. All must print OK.
- The published artifact link (below) now carries HotS Tools. Publish `hots_tools_artifact.html` with that `url`.
- `knowledge/ngs_league.db` is built from the NGS replay export (folders in Downloads, not in git) by `build_ngs_league.py`. It has the timeline per game (`lg_timeline`) that the match pages lack.

## Hero knowledge base (profiles and lenses)
- `knowledge/expert/hero_profiles/<slug>.json` (91): damage type, poke, how healing meets it, healing block, ratings, good into and bad into, wants and gives, lens values, owner notes. Spec `HERO_PROFILE_SPEC.md`, lens catalog `lenses.json`, check `python test_hero_profiles.py`.
- `merge_profiles_into_matrix.py` overlays the profiles on `hero_matrix_draft.json` (run by the builds). `apply_owner_notes.py` re-applies Hunter's notes after any profile rewrite. Hunter's combos and counters: `knowledge/expert/owner_combos.json`.
- League facts built from them: `data.comps` (ranged dealer count, healer count, marksmen, shapes, heal lens, lens signal), `data.h2h` and `data.combos`, all in `build_playbook.py`.
- A clean shareable review package: `python make_review_zip.py`.

## Draft Room (the real time draft tool, shown in the page as HotS Drafter)
- `python build_playbook.py` regenerates `playbook/data.json`, `facts/teams/*.md`, `facts/maps/*.md`, `draft_tool.html` (stand alone) and `draft_tool_artifact.html` (the page fragment published as the phone artifact). Then `python test_playbook.py` and `node test_engine.js`.
- The hero, map and guide library (`build_library.py` into `playbook/library.json`, build codes in `knowledge/icy_build_codes.txt`, tips in `playbook/notes/draft_tips.md`) is built by the same command and shown in the Heroes, Maps and Learn tabs and the hero sheets. Build codes are mostly old, the tool flags them.
- Judgment lives in `playbook/config/our_team.json` (pools), `playbook/config/rules.json` (rules with reasons and evidence) and `playbook/notes/`. Engine is `playbook/engine.js`, UI is `playbook/app.html`. How to update: `UPDATE_PLAYBOOK.md`.
- Published phone artifact (private): https://claude.ai/artifact/QuQ1FdsJfFn7sH3988KrYU. To update it, publish `hots_tools_artifact.html` (HotS Tools, which contains the Draft Room) with that `url` (read it first). `draft_tool_artifact.html` is the Draft Room alone. Do not create a second artifact.
- Never edit the generated files by hand. A hero named in config must exist or the build stops.

## State as of 2026-10-12
- 60 of 60 Division C West games on Heroes Profile are on disk (through 23372, Good Lordy v Anomaly on Oct 9). Six Good Lordy games are not on Heroes Profile.
- Every Season 22 game across all 7 divisions is saved (500 ids, 497 played, 3 forfeits skipped): C West in `knowledge/raw/ngs/matches/`, the rest in `knowledge/raw/ngs/other_divisions/` (not in git). `python build_ngs_season.py` builds `knowledge/ngs_season.db` from both; `test_ngs_season.py` checks it.
- Hunter's game history (`hunter_hp.db`, 4,741 games) and his profile, hero, map and role summaries run to Oct 12.
- Storm League MMR for NGS players: `scripts/sl_mmr_todo.py`, `scripts/hp_pull_sl_mmr.js`, `build_sl_mmr.py` into `knowledge/sl_mmr.json` (Storm League only). All 363 Season 22 players have one.
- Season 21 from Heroes Profile: all 868 ids saved in `knowledge/raw/ngs/season21/` (gitignored), 867 games built (A 165, B East 120, B West 113, C 105, D 118, Heroic 149, Nexus 97), playoffs included. `python build_ngs_season.py 21` builds `knowledge/ngs_season21.db`; `python test_ngs_season.py 21` checks it. Last season's pages are now used for every division; the replay export `ngs_league.db` only fills gaps.
- The tool is called HotS Drafter (the page title and header). Files keep the old names (`draft_tool.html`, `build_playbook.py`).
- Team name changes are inferred from shared players by `build_team_aliases.py` into `knowledge/team_aliases.json`.
- The Draft Room has a Team tab (pick any team, who you are, data window for NGS seasons and Storm League scopes). Rules with `scope.us` only apply to that team.
- Next opponent: CCS (Can't Counterpick Stupid), the likely final. PRA beat Cosmos 2-1 on Oct 6 (Cosmos won Tomb).
- League data (Draft Lab): NGS replay exports for seasons 15 to 22 live in `knowledge/raw/ngs_export/` (git ignored). `knowledge/ngs_league.db` is built from them incrementally by `build_ngs_league.py`; `build_league_export.py` then `build_hotstools.py --all --personal` carry them into the Lab (9,000 plus games). The Drafter uses them for hero against hero records and per player older seasons. See the 2026-10-14 handoff in `PROJECT_STATE.md`.
