# Handoff 2026-10-14 (takedown combos)
- `build_ngs_league.py` now keeps `lg_kills` (game, time, killing side, victim hero, killer heroes). `build_playbook.py` `league_combos` writes `data.combos` {"A|B": [games, wins, small kills, kills with A, with B, with both]}, small kills = three or fewer heroes on the takedown (big fights put everyone on every kill, lift there is 1.0 for all pairs). `E.combo(a,b)` in `playbook/engine.js` returns the lift; `E.heroIntel` adds a "Seen:" line when lift is 1.15 or more with 15 or more shared kills.
- Result is modest: Stukov with Varian is 143 shared small kills against 119 expected (1.2x), 150 games. The export lists assisters too and has no CC or setup order, so "seen" means kills together, not "Stukov set it up".
- Still open: banner records in the Drafter's most banned lists, ratings clamp, team name changes seasons 15 to 22.

# Handoff 2026-10-14 (end of session: dossiers, ban win rates, seasons 15 to 22)
Live artifact is v20 or later and carries everything below. All tests print OK (`node test_engine.js`, `node test_draftlab.js`, `node test_hotstools.js`, `python test_playbook.py`).

**Built this session**
- Drafter: map bans for both teams (Setup card), heavier counter, ranged cap, role stacking and second healer penalties, ban and pick dossiers (`E.heroIntel`, `E.banIntel`, `E.fearList`), LOW VALUE BAN flag, "What they may be worried about" on their ban turns.
- Team `log` rows (one per game) in `data.json` feed the dossiers. Heroes carry `kit` (hero matrix: crowd control, comp fit, global Storm League rates) and `obs` (measured from every NGS replay: games, wins, crowd control seconds per game, first blood rate). `data.h2h` holds hero against hero records (n 12 or more) from seasons 15 to 22.
- Pick scoring uses measured head to head when n is 40 or more, as the edge against the hero's own overall rate (so a hero that does worse than usual against their pick loses points); Icy Veins lists are the fallback.
- Draft Lab: "Banner won" (banning side record) in Meta, Maps, Heroes (detail and trend), Scout and ban suggestions. Preset "NGS last three seasons".
- League data: NGS replay exports for seasons 15 to 22 are in `knowledge/raw/ngs_export/` (zips and extracted folders, git ignored, 1.8 GB). `python -I build_ngs_league.py 15=knowledge/raw/ngs_export/season-15 ... 22=...` is now incremental (only the seasons named are replaced). Then `python -I build_league_export.py` (9,000 plus games) then `python build_hotstools.py --all --personal`. Older seasons are NGS pages' own export: no Heroes Profile ids beyond the toon id, but the toon id is the same number.
- Drafter Team tab: "Seasons 15 to 20" chip adds each player's older hero records (merged regular and playoff games, key `old`, built from `ngs_league.db`).

**Not done, in rough order of value**
1. Takedown timing combos from the export (`takedowns` has victim, killers, time and position; `lg_timeline` keeps only the first). Would turn "kit suggests" combo lines into "seen in X of Y games" (the Roll1 Stukov ban reasoning).
2. Win rate on bans: done in the Lab; the Drafter `expectOppBans` chips and `leagueMapCard` "Most banned" could show banner records too.
3. Ratings clamp from `audit_hero_ratings.py --flags` (see the earlier handoff below), `plays_as` roles.
4. Team name changes across seasons 15 to 22 (`build_team_aliases.py` only covers 21 to 22), so older team histories are by player id only.
5. HeroesToolChest heroes-data for exact kit numbers (needs Hunter's yes before downloading).
6. Sources considered but not checked: Liquipedia HotS (events, brackets), Heroes Lounge match history (`heroeslounge.db` holds some), HotS Logs style sites. Chrome is available to look things up. Reading Cloudflare protected pages stays in Hunter's own Chrome.

**Gotchas**
- Bash heredocs that hold a lot of quotes failed in this environment: write patch scripts to the scratchpad with the Write tool and run them.
- `test_draftlab.js` and `test_engine.js` assertions that counted seasons or the top pick were loosened when more data arrived; if a count test breaks after a data refresh, check whether the data or the test is stale before editing.
- Publish with `hots_tools_artifact.html` to the url in CLAUDE.md (read it first).

---

# Update 2026-10-14 (Drafter depth)
- Map bans for both teams in the Draft tab Setup card; map list and "maps left" follow them.
- Pick advice: counters, ranged cap, role stacking and second healer penalties are heavier; CCS healer rule also penalizes Rehgar and Stukov (0-3).
- Ban and pick dossiers: every team now carries `log` (one row per game: map, result, first pick, both sides' picks and bans). `E.heroIntel`, `E.banIntel` and `E.fearList` in `playbook/engine.js` turn it into win rates with and without a hero, conditions (map, first pick), partners, "kit suggests" combos (hard crowd control with dive partners) and style fit. Heroes carry `kit` from `knowledge/expert/hero_matrix_draft.json`. The Draft tab shows a "Ban dossier" per ban and "What they may be worried about" on their ban turns.
- Still open: win rate on bans elsewhere in the Lab (see the 2026-10-14 handoff below), series level combo detection from takedown data.

# Handoff 2026-10-13 (HotS Tools, read this first)

**The two apps are now one.** `hots_tools.html` (built by `python build_hotstools.py --all`) holds the Draft Room, the Draft Lab, My Games and the Learn pages behind one navigation. Read `HOTS_TOOLS.md`. The artifact link in `CLAUDE.md` should carry it: publish `hots_tools_artifact.html` over that link (read the live artifact first).

**Done this session:** My Games (import, overview, heroes, maps, habits, pool coach, send pool to the draft board), Review a draft, the league read inside the Draft Room, the Ratings tab on hero sheets, early lead statistics from replay timelines in the Meta tab, the correct NGS draft order in the Draft Lab, a refreshed league dataset (2,210 games), the PRA and CCS deep dive (`PRA_CCS_DEEP_DIVE.md`, with timelines in section 8).

**Verified live (Oct 13):** the My Games console snippet. One request to `player/match/history` with the snippet's body returned 200 (100 games a page, 48 pages for 4,741 games) and the fields it packs are all present. The full multi page loop and file download were not run end to end.

**Open ideas:** use takedown times and positions from the replay export (who died first, where fights happened); a per player view of the replay export for any NGS player; refresh the example games in My Games; replay export for Heroes Lounge does not exist.

---

# Handoff 2026-10-12 (the Draft Room, still true)

**What exists now.** The tool is called **HotS Drafter** (page title). It works for any NGS team: Team tab picks the team, who you are, and a data window (NGS seasons 21 and 22, regular season and playoffs, Storm League scopes and MMR). Live link in `CLAUDE.md`; republish by publishing `draft_tool_artifact.html` to that link (read it first).

**Data on disk** (all rebuilt, all tests pass, see `CLAUDE.md` "State as of"):
- Season 22: all 500 game ids, 7 divisions (`build_ngs_season.py`, `test_ngs_season.py`).
- Season 21 from Heroes Profile: complete, all 868 ids saved and 867 games built (one forfeit skipped). Nothing left to pull for NGS seasons 21 and 22.
- Storm League MMR for all 363 Season 22 players (`knowledge/sl_mmr.json`), Storm League only.
- Hunter's Heroes Profile games to Oct 12 (4,741), profile and hero tables refreshed.
- Team name changes inferred from shared players (`build_team_aliases.py`).

**How to pull more safely.** Hunter passes Cloudflare in his own Chrome. Run `python receiver.py`, then a small page script in a light Heroes Profile tab (the FAQ page). One request every 4 seconds, stop on a 403 and ask. Do not let him refresh that tab while it runs (it kills the script). Scripts: `scripts/hp_pull_sl_mmr.js`, `scripts/sl_mmr_todo.py`, `scripts/hp_pull_division.js`.

**Rebuild order after new data:** `build_ngs_season.py` (and `21`), `build_team_aliases.py`, `build_sl_mmr.py`, `build_hunter.py`, `build_playbook.py`, then every `test_*.py` and `node test_engine.js`, commit, push, republish.

**Ideas not built:** pull the rest of Season 21, a series result history across sessions, head to head for cross division playoff pairs, Storm League hero data for other divisions (only Division C West players have it).

---

# Project state and handoff (read after CLAUDE.md)

Written 2026-10-07, state updated 2026-10-12. This is what a new session needs to carry on without the chat history.

## Who
- **Hunter** (hunterstag#1314) plays a roaming ranged assassin for **Phoenix Rising Amethyst (PRA)** in Nexus Gaming Series (NGS) **Division C West, Season 22**. He is not a programmer and does not use git: Claude handles all of it (see "Git" below).
- Teammates: **chelsi** (damage, Tychus and Thrall), **SoulShepherd** (offlaner, "Soul"), **NorthrnTouch** (tank, "Northern"), **Ltlbearista** (healer, "Bear"). Hunter has also mentioned "Zerg", a teammate or sub whose role was never confirmed. Ask if it matters. Pools, with evidence, are in `playbook/config/our_team.json` and `RECENT_FORM_AND_POOLS.md`.
- Hunter wants plain explanations, honest uncertainty, and options with reasons. He corrects numbers quickly, so check every figure before writing it down (several documents were fixed after he caught an error).

## Where the season stands (verified from `knowledge/ngs_div.db`)
- 60 games, six teams, newest game 23372 (Good Lordy v Anomaly, Oct 9). PRA's last match was Oct 6 v Cosmos (won 2-1).
- Records: Cosmos 14-7, PRA 14-9, CCS 14-6, Good Lordy 9-8, Roll1Esports 5-14, Anomaly 4-16.
- **Next opponent: CCS (Can't Counterpick Stupid)**, the likely final. The date is not known. The match is a best of 3. The coin toss winner chooses first pick or map pick.
- Six Good Lordy games are not on Heroes Profile and cannot be pulled.

## The documents (what each is for)
| Read this | For |
|---|---|
| `CCS_DRAFT_CHEAT_SHEET.md` | The decisions for the CCS match: toss, bans, picks by slot, map tiers, map playbook |
| `CCS_FULL_PICTURE.md` | Every CCS game, Cosmos v CCS, the healer pattern, the Garden loss in detail |
| `QHIRA_DEEP_DIVE.md` | Why banning Qhira does not help |
| `COMP_AND_POKE_INSIGHTS.md` | Poke versus fight damage, marksmen, what predicts wins |
| `DRAFT_LESSONS_AND_COMPS_BY_MAP.md`, `WAVE_CLEAR_AND_MAP_GUIDE.md` | Comps and wave clear by map |
| `RECENT_FORM_AND_POOLS.md` | Hunter and chelsi pools (last 12 months only) |
| `COSMOS_MATCH_PREP.md`, `PLAYOFFS.md`, `NGS_DIVISION_SUMMARY.md` | Cosmos, playoff structure, division habits |
| `facts/teams/*.md`, `facts/maps/*.md` | Generated fact sheets (do not edit them, edit the notes under `playbook/notes/`) |
| `UPDATE_PLAYBOOK.md` | How the Draft Room tool is updated |
| `HANDOFF.md`, `TONIGHT_PLAN.md`, `HUNTER_DEEP_DIVE.md` | Older. Banners say where they are superseded |

## The Draft Room (phone and PC tool)
Generated by `python build_playbook.py` from the databases plus `playbook/config/` and `playbook/notes/`. Published privately as an artifact (link in `CLAUDE.md`); `draft_tool.html` is the same page for any browser. Tests: `python test_playbook.py` and `node test_engine.js`. See `UPDATE_PLAYBOOK.md`.

Tabs (added 2026-10-07): **Draft** (board, recommendations, comp meter, "what their picks mean", final plan with builds, copy summary, hero browser), **Prep** (opponent, now with "answers in our pools"), **Heroes** (all 91 heroes with search, role filter, tier lists, sort), **Maps** (all 15 maps, Icy Veins guide, tiers, our numbers), **Learn** (draft tips, guides, glossary), **About**. Any hero name in the tool opens a hero sheet: overview, builds, talents, abilities, matchups, maps, team.

The hero, map and guide content is built by `build_library.py` (called by `build_playbook.py`) into `playbook/library.json` and embedded in the page. Build codes are in `knowledge/icy_build_codes.txt` (Hunter's Icy Veins sheet, pasted 2026-10-07, 141 codes). Written draft tips are `playbook/notes/draft_tips.md`.

**Fan HotS tier list:** `knowledge/fanhots_tiers.json`, read from the image Hunter shared on 2026-10-07 (the image has portraits only). The icons were matched to Icy Veins portraits by script (portraits are saved locally in `knowledge/raw/portraits/`, not in git because it is Blizzard artwork), then checked by eye. 18 cells carry `check: true` because the match was weak or resolved by elimination; ask Hunter to confirm those. If he shares a newer image, redo the match the same way.

**Heroes Profile global stats:** `knowledge/raw/hp_global/` holds the Global Hero Stats table for Storm League as Hunter filtered it: `hero_stats_2.57.json` (newest minor patch alone) and `hero_stats_2.57_plus_2.55.json` (2.57.0.98348, 98304, 98285 and the last 2.55 patch together, about 6,500 games per hero on average). Saved from the page table in Hunter's Chrome (one page load, no API calls) through `receiver.py`. Shown in the hero sheets and the Heroes tab. Refresh each patch the same way and rename the file.

**Build code freshness:** on 2026-10-07 only 9 of the 141 codes were both under a year old and newer than their hero's Icy talent page; 120 were over a year old (many from 2020). The tool flags them. Real current patch builds need another source (Fan HotS or Heroes Profile).

## Open work, roughly in order
1. After each match: pull the new games, rebuild, retest, republish the artifact (steps below).
2. Write `playbook/notes/teams/cosmos.md` (the CCS note exists, the other opponents have none). The tool works without them but the pre-match page is thinner.
3. Hunter's Storm League data ends Oct 5. Refresh `knowledge/hunter_hp.db` if his recent Storm League form matters.
4. Tune the recommendation weights (`playbook/config/rules.json`) after Hunter and his captain use the tool in a real draft, and add any rule they say was missing.
5. Ideas Hunter has raised: Fan HotS builds per hero, and Heroes Profile talent builds for the current patch (per hero pages, needs paid access for the full set, so ask first and never burst requests). The Fan HotS tier list is done (see below). A shared live draft board for the whole team (needs the artifact `db` capability) is possible but not built.
6. Optional: earlier seasons or other divisions for deeper opponent history; practice picks the team wants to test (Raynor, Azmodan, Chen).

## Refreshing the game data (how it was done)
The sites are behind Cloudflare. **Hunter passes the check himself in his own Chrome and leaves the tab open. Claude never bypasses it.** If a request returns 403, stop and ask him to pass it again.
1. Start `python receiver.py` (a small local server that writes under `knowledge/raw/`; Chrome asks once to allow local network access and Hunter clicks Allow).
2. `python scripts/known_games.py` lists the games already saved. Put that list in `scripts/hp_pull_division.js`, set `DRY = false`, and run it in the Heroes Profile tab (through the Claude in Chrome extension, using the tab Hunter has verified). It saves each missing match page to `knowledge/raw/ngs/matches/<id>.json`.
3. Rebuild and test: `python build_ngs_division.py`, `python test_ngs_division.py`, `python build_playbook.py`, `python test_playbook.py`, `node test_engine.js`.
4. Stop the receiver. Commit and push. Republish `draft_tool_artifact.html` to the artifact link.
The pull script's dry run parses the same response the earlier manual pull used, but its last run was stopped by Cloudflare (the check had expired), so start the first real use with `DRY = true`. Heroes Profile API notes (request bodies, 202 job polling, 429 backoff) are in `PULL_STATUS.md`. Another pull helper: `scripts/hp_pull_players.js`.

## Environment
- Windows 11. Python 3.12 using only the standard library. Node 24 is used only for `test_engine.js`.
- The Claude in Chrome extension and the built-in browser are both available in the desktop app. If more than one Chrome is connected, ask which one to use first.
- Not in git on purpose: `hots_project_bundle.tar.gz` and `knowledge/raw/hunter/hp/*/match_history/` (large per game histories). The database built from them, `knowledge/hunter_hp.db`, is in git, so a fresh clone still works. Rebuilding that database from scratch needs a new pull.

## Git (Hunter does not do this, Claude does)
- Start of a session: `git pull`. When the work is done: run the tests, `git add` what changed, commit with a plain message, `git push`. This repo only (`acurioushunter/hots-ngs-analysis`).
- The folder `C:\Users\visio\Downloads\Claude Code` is the Vision business project with its own repo and its own rules. Do not open, read or change it from a HOTS session.
- Never commit secrets or cookies. The scraped pages in `knowledge/raw/` are public game data.

## Handoff 2026-10-14 (unfinished round: filters, ban win rates, ratings)
Live artifact is still v15 and works. Nothing below is built, tested, committed or published.

**Edited in source only (untested):**
- `hotstools/mygames/ui.js`: mode chips have an "All modes" chip, a click from "all" isolates that mode, chip counts follow period and roles, "Show all games" button, period counts back from the newest game.
- `hotstools/shell.js`: About has "Reset my choices" (keeps games) and "Remove everything".
- `hotstools/shell.css`: `.chip.dim`.
- Blaze ranged wording removed from `playbook/app.html`, `build_playbook.py`, rules, notes, cheat sheets, `CLAUDE.md` (code still keeps him out of ranged counts).
- New `audit_hero_ratings.py` (NGS S21+S22 player rows vs the rating table; `--flags`, `--json`).

**Next steps, in order:**
1. `python build_hotstools.py --all --personal`, then `node test_hotstools.js`, `node test_draftlab.js`, `node test_engine.js`, `python test_playbook.py`. Fix any test that asserted the old Blaze text. Check the filter bar in the browser pane (SL chip, All modes, Show all games, Reset my choices).
2. Win rate on bans (not started). Places: Drafter `recCard` ban reasons, `expectOppBans` chips, "Most banned" in `leagueMapCard`, last season "Banned most", hero list; Lab `draft.js` suggestion line (shows shrunk rate, add record), `meta.js` Most banned and trends, `maps.js` top bans, scout "Heroes they ban". Engine items need `wins` added in `recommendBans`, `metaSummary` trends topBans and `mapSummary` topBans. Show raw WR with record (w-l) and a low sample flag.
3. Commit, push, publish `hots_tools_artifact.html` to the existing artifact url (read it first).
4. Ratings (Hunter deferred this): run `python audit_hero_ratings.py --flags`. Clamp rule: keep the authored value unless games contradict it by 2 or more steps, then move to within 1 step. Known fixes: Abathur camp 5 to 2 and merc_camp_control 5 to 2 (guide: cannot solo a lane), Hanzo and Li-Ming camp up, Dehaka camp down and wave up, Leoric wave up, Greymane camp 5, Raynor camp 5, Sylvanas wave down, Xul camp down. Camp uses creep damage per minute, not captures (healers inflate captures). Add `plays_as` (Offlaner for Blaze and others) from the Icy Veins general tier list roles. Three reviewer agents died on the usage limit before writing their files; rerun them if wanted (brief: check non measurable ratings against hero_section and talent text, no edits).
5. Optional data: HeroesToolChest heroes-data2 (MIT, has 2.57.0.98348 as patch files on top of full 2.55.16.97039) for exact kit numbers. Needs Hunter's yes before downloading. Heroes Profile API is paid; reading its pages stays with Hunter's own Chrome (rule 6).

**Maps:** two map bans per team is already how the Prep tab works. Tighten: map picks skip any map the opponent has ever banned, not just their top two.
