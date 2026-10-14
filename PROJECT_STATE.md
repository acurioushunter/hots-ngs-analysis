# 2026-10-14 (games filled in from the replay export, guide)
- The Heroes Profile match pages (`ngs_div.db`) stop at Oct 10 (60 games). The replay export has five newer C West games (CCS v Anomaly 2-1 on Oct 14, PRA beat Roll1Esports 2-0 on Oct 14). `supplement_div_from_export.py` writes `knowledge/ngs_div_plus.db` (git ignored) = ngs_div.db plus those games, replay ids 9,000,000 and up, and `build_playbook.py` reads that file. Those games lack Heroes Profile ratings (each player's usual rating stands in so averages do not move), round, series, map picks and the minion and camp damage split (macro numbers skip them). Replace them with the real pages when Hunter pulls them in his Chrome: `python ngs_games_to_raw.py`, `build_ngs_division.py`, then the supplement drops the matching export games automatically (it only adds games dated after the newest page game).
- `verify_static_claims.py` caught five changed numbers after this; rules.json and the CCS note were updated (CCS 4-6 against Brightwing or Anduin teams and 12-1 against other healers, 12-2 with first pick, UnicycleYay 12-3 off Qhira, Valkamer 6-1 on Johanna).
- About page has a quick guide; Meta and other long lists scroll; Lab Scout and Opponent prep have filters.

# 2026-10-14 (scouting filters, team merges, static checks)
- **What is live and what is static.** Everything in the page is computed in the browser from data baked in at build time: the Lab (Scout, Meta, Counters) recomputes from the embedded games each time you filter, the Drafter reads `data.json`. Nothing is fetched while you use it. New games need the pull, then a rebuild, then a publish. The hand written parts are `playbook/config/rules.json`, `playbook/notes/*`, `our_team.json` and `next_opponent`; their numbers are re-checked by `python -I verify_static_claims.py` (all 18 claims matched on 2026-10-14, games through 2026-10-10).
- **Team name drift.** `team_merge.py` finds one team under two names in a season (4+ shared players, same division, never opposing) and renames to the canonical name in `ngs_league.db` and `ngs_season.db`; run by `build_playbook.py`, `build_league_export.py` and `build_ngs_league.py`. Merges: Is Shoopufff Still Inting into Is Shoopufff Inting Still, Pending into Fake Taxi (season 22), RageAgainst casing and Artemis into Cheese Counters Skill (season 16). Review `knowledge/team_merge.json`.
- **Filters.** Lab filter bar: season chips are league qualified (NGS S22, HL S30) with counts that reflect the other groups, zero chips dimmed. Lab Scout: map, result, first or second pick, last 5 to 20, league season, division, opponent, their comp, hero played, hero faced, hero banned, banned against them. Drafter Opponent prep: player, hero, playstyle, minimum hero games, weaker heroes only.
- **Build guard.** `build_hotstools.py` runs `node --check` on every UI script first. An apostrophe in a single quoted string broke the Lab for one publish (version 22) before this.

# Final pass 2026-10-14
- Gazlowe is a bruiser, not a ranged dealer (Hunter's note in `owner_hero_notes.md`, `apply_owner_notes.py`). Heroes still counted as ranged dealers that Hunter may want to review: Probius, Zagara, Tassadar, Azmodan, Sgt. Hammer, Fenix, Falstad, Junkrat, Nazeebo.
- Stale limit text fixed (About, Lab Learn, Lab Heroes, Drafter sources): replay export games do carry a timeline summary, ratings come from the hero profiles.
- Pool coach fall backs are now ranked by your results plus how much the hero plays like the banned one, each with a short reason, so every main gets its own list.
- Known and not done: team name changes across seasons (the Team list shows both "Is Shoopufff Inting Still" and "Is Shoopufff Still Inting").

# Integration pass 2026-10-14 (profiles and lenses reach the whole tool)
- Matrix overlay: `merge_profiles_into_matrix.py` (run by build_playbook, build_draftlab and build_hotstools) makes `hero_matrix_draft.json` follow the profiles: role, range, damage profile, sub role, comp fit, ratings (clamped 1 to 5; a gap of 3 or more between old and profile is the midpoint and listed in `ratings_contested`; old values under `prior`), plus labels, lenses, wants, gives, weak, owner notes. The Draft Lab archetype classifier, hero pages and My Games read it.
- Drafter: `marksman` is derived (ranged dealer, auto attacker with autos 3 or more, hybrid with 4 or more, or the old hand list), `arch` from the profile (hand lists still win). 13 marksmen now. Rules `g-marksmen` and the three `ranged_target` rules are retired in `rules.json` with the league numbers in their text (2 or more marksmen 47%, 3 or more ranged dealers 40%).
- My Games: insights show up to three best and three worst heroes (the single repeated Hanzo line is gone), pool coach "Heroes costing you games" lists up to 8 from 12 games with a Why and where drop down (style labels, Hunter's read, weakest maps, builds, open hero page), hero page shows labels and Hunter's read.
- Draft Lab hero detail: labels, Hunter's read, How it plays (lens values), contested ratings. Learn has a new native page Hero lenses (catalog, carriers per value, league read). Home and About copy updated. Docs updated: CLAUDE.md (rules 11 to 13 and the knowledge base section), HOTS_TOOLS.md, UPDATE_PLAYBOOK.md, README_REVIEW.md.
- Smoke tested in the browser pane over a local server: Learn > Hero lenses, a Draft Lab hero page, and the personal edition pool coach, no console errors.

# Lens pass done 2026-10-14 (all 91 heroes classified)
- Every profile has `lenses`, `lens_notes`, `lens_gaps` (11 agents, second run after the rate limit). `python test_hero_profiles.py` now fails on a missing lens (HERO_LENSES_REQUIRED=0 to allow). `apply_owner_notes.py` re-applies Hunter's notes and a few lens fixes (Junkrat escape strong, Deathwing unstoppable, Diablo and Garrosh catcher, `bodies` lens) after any re-run of the lens agents.
- League read: `data.comps.lens_signal` (`league_lens_signal` in `build_playbook.py`; 370 lens value and count pairs tested, kept |z| 3.3 or more, 28 items) and `data.lens_catalog`. `E.lensRead(st, side)` and the "Lens read" block in the Our comp card. Strongest associations: 3 or more sustained damage heroes 52.7% v 48.1% (6,724 sides, newest seasons +4.7), chip poke damage worse (48.8% v 53.1%), guaranteed damage (autos) 3 or more better, 3 or more heroes giving wave clear better, big health in the comp better, relies on healer worse. Not causal.
- Catalog now has new values from the agents' gaps (blind, interruption, global pressure, displacement, damage fueled healers, burst follow up, enabler, pull pick, lane bully, double soaker, ally only CC denial, second body, knockback only) and a `bodies` lens. Existing answers were forced to the nearest old value for these (Whitemane `burst_single`, Raynor and Lucio `soft_only`, Kharazim `dive_bruiser`, Butcher `dive_bruiser`, Maiev `initiator`, Tyrael `not_a_healer`). NEXT PASS: a small agent per family to re-answer only the lenses that gained values (use each profile's `lens_gaps` and `lens_notes`), then rerun the lens signal. Also: `build_variants` (Varian, Sonya, Zul'jin, Thrall change role by heroic or talent) and `map_notes` (Ragnaros Lava Wave on Tomb) as profile fields, and the Drafter comp checker that adds needs against gives (`team_needs`, `team_gives`) and weaknesses against what they bring.
- Owner review still open: Hogger and Imperius profiles (low confidence, thin text), Xal'atath (no measured block), Valeera and Li Li (low win rate, medium confidence).

# Owner notes, lens catalog, review package 2026-10-14 (read first)
- Hunter's hero notes are saved verbatim in `knowledge/expert/owner_hero_notes.md`; `apply_owner_notes.py` (rerunnable) puts the cleaned reads into each profile as `owner_notes` (shown as "Hunter's read" on the hero sheet), fixes roles (Cho, Blaze, Hogger, Imperius, D.Va, Deathwing, Thrall, Varian, Sonya are bruisers; Gall ranged assassin; Varian flexes to tank with Taunt), Orphea as a ranged damage dealer, and a few healer scores (Stukov sustain 3 and burst 3, Tyrande sustain 3, Whitemane burst 5, Rehgar burst 3). His known combos and counters are `knowledge/expert/owner_combos.json`, read by `E.ownerCombos` and shown in the Our comp card.
- Lens catalog: `knowledge/expert/lenses.json` (31 lenses, 8 families). The classification pass (a `lenses` object in every profile) was started with 11 agents and ALL FAILED on the account session limit (resets 2:10pm Chicago); nothing was written. Brief: scratchpad `brief2.txt` text is in this note: add a `lenses` object (single or multi values from the catalog), `lens_notes`, `lens_gaps` to each profile; spawn the same 11 groups (bruisers A and B, healers A and B, melee assassins, tanks A, tanks B plus supports, ranged A to D, slugs in the hero_profiles folder). Then `HERO_LENSES_REQUIRED=1 python test_hero_profiles.py`. Hunter's notes add one value to add to `frontline_style`: a tank that catches and kills (Diablo, Garrosh), and `deathwing` style "cannot be stunned" is `anti_cc: unstoppable`.
- Next after lenses: test each lens against league wins by season and map (`data.comps` style cells), then a comp checker in the Drafter (needs against gives, vulnerabilities against what they bring).
- Review package: `python make_review_zip.py` writes `HotS_Tools_review_<date>.zip` (app, README_REVIEW.md, source, profiles; no databases, no raw data, no personal edition).

# Hero profiles 2026-10-14 (deep hero knowledge base, done for all 91 heroes)
- `knowledge/expert/hero_profiles/<slug>.json`, spec in `knowledge/expert/HERO_PROFILE_SPEC.md`, check with `python test_hero_profiles.py`. Written by reading each hero's Icy Veins guide, abilities and every talent (dumped from `hots_knowledge.db`) beside the hero's measured NGS numbers; confidence and `unsure` fields say where the reading is soft (Hogger, Imperius, Xal'atath, Valeera, Cho and Gall, Rehgar's attack type).
- `build_playbook.py attach_profiles` puts a compact `profile` on every hero, sets `ranged` to the profile's `ranged_dealer` (a ranged healer, support or tank is NOT a ranged damage dealer; 31 heroes now; old attack type kept as `hp_ranged`), `carry`, and `hclass` for healers (`aoe_sustain` Brightwing, Lucio, Stukov, Auriel; `burst_single` Uther, Ana, Anduin; `sustain_single` Malfurion, Deckard, Alexstrasza, Li Li; `other`).
- League facts rebuilt on that: ranged dealer count buckets are 0, 1, 2, 3+. Three or more ranged damage dealers won 43% over 427 sides (39% in the newest 3 seasons), zero won 54% over 215, one or two are flat at 50%. The old division ranged rules in `rules.json` (`ranged_target`, min 3 on Tomb and Shrines, max 2 on Garden) were written under the old count and are no longer used by `compSummary` or pick scoring: retire them when you next edit the file.
- Heal lens: `data.comps.heal_lens[hero][hclass]` (cells as above). `E.healLens(hero, theirPicks)` prefers the measured record (60+ sides, 4 points or more off the hero's own rate) and falls back to the profile's `heal_blunted`. League wide the profile's `heal_blunted` does NOT separate heroes cleanly (all damage dealers 50% into aoe sustain against 50% into others), but damage over time and poke heroes show it: Lunara 54% into single target burst healers against 44% into AoE sustain healers (about 170 sides each), Nazeebo 55 v 51, Junkrat 54 v 51; the pooled gap for blunted 4 or more with poke 3 or more is +2.5 points plus or minus 4, so it is a lean per hero, not a law.
- Hero sheet Ratings tab now opens with the profile card ("How it plays"). Old `ratings` from `hero_matrix_draft.json` still feed the rating bars under it: next package is re-deriving those from the profiles and the clamp.
- Marksmen (`cfg.marksmen`) and archetype labels (`arch`) are still the old hand lists; two or more marksmen won 47% over 2,073 sides. Derive them from `autos_matter` and `damage.style` next.

# Recency weighting layer 2026-10-14 (package 0, done)
- Every NGS replay is one patch (2.55, a few 2.57), so patch cannot be the time unit: the season is. `season_weight` in `build_playbook.py`: half life 3 seasons (`HALF_LIFE`), newest window 3 seasons (`RECENT_SEASONS`). Season by season the ranged, healer and marksman effects wobble inside the noise (about 5 points at 100 sides); four or more ranged, two healers and a ranged lead are negative in almost every season, two or more marksmen flips sign (no stable effect).
- `data.comps` cells are [games, wins, weighted games, weighted wins, newest window games, newest window wins]; `data.h2h` entries are [games, A wins, weighted games, weighted A wins]. Read them with `E.cell(v)` (n, wr, wwr, eff, rn, rwr) and `E.h2h` (adds `eff`, `rawWr`). `E.rangedLeague` returns weighted rates and `rgap` (the gap using only the newest window). New league facts should use the same cell shape so rules can be checked against old, weighted and newest numbers.
- Rule: a division sized rule should only fire when the weighted league gap is 5 points or more and, where the newest window has 40 or more sides on each side, `rgap` does not point the other way.

# Work packages 2026-10-14 (Hunter: "build and improve, do not go lazy"; fork one session per package)
Done in the first pass: ranged advice is now evidence based. `build_playbook.py league_comps` writes `data.comps` (16,500 NGS sides: win rate by ranged count, ranged difference, healers, marksmen, tanks, role shapes, overall and per map). `E.rangedLeague` and `E.rangedText` in `playbook/engine.js`; `compSummary` returns `notes` as well as `warnings`; a division rule only warns when the league gap on that map is 5 points or more, otherwise it is a note and the pick bonus counts a quarter. The Our comp card has a league table (`compLeague` in `playbook/app.html`). Finding: 3 or more ranged does NOT win on Tomb (50% v 51%); only 4 or more ranged is clearly worse (44% over 922 sides); having more ranged than the opponent loses (47.5%); two healers 45% over 479 sides; two or more marksmen 47%.

Packages left, each independent (do in this order of value):
1. **My Games, more than one hero.** `insights()` in `hotstools/mygames/engine.js` returns only the single worst hero (`neg`) and single best (`pos`), so Hanzo repeats. Return up to 3 each with a show more. In `pageCoach` (`hotstools/mygames/ui.js`) make the "Heroes costing you games" and "Hero and map pairs to avoid" rows expandable (`<details>`): by map, by role slot, build, last 10 games, who they were against if present, and what the hero does globally. Lower the bar so more than five can show (n 12 or more).
2. **Drafter rules checked against the league.** Rules in `playbook/config/rules.json` and weights in `engine.js` that carry division sized claims: marksmen "13-6 with two or more" (league: 2+ marksmen 47%, n 2,073), second healer penalty (league 45%, so the penalty may be right), role stacking, frontline. Re-derive each from `data.comps`, show n, drop or soften the ones the league does not back, add per map shapes (`comps.maps[map].shapes`). Add a "best shapes on this map" line to the Our comp card.
3. **Hero labels, ratings, archetypes.** The ratings clamp from `audit_hero_ratings.py --flags`, `plays_as` roles, archetype labels (`arch`) that read as shallow. Use `obs` (cc per game, first blood) and the kit data to give every hero 2 to 3 plain labels with numbers, in Heroes tab and hero sheets.
4. **Comps and strategies pages.** Learn and Draft Lab: comps per map from the league shapes, win rate against the other side's shape, strategies with sample sizes. Say "the numbers say" and "the kit suggests" separately.
5. **Tab by tab usability pass** in the browser pane on `hots_tools_hunter.html` (Draft, Lab, My Games, Learn): dead ends, repeated one hero lists (look for any list that takes `[0]` of a sort), missing drill downs, jargon, mobile width.
6. Banner records in `expectOppBans` chips and `leagueMapCard`, team name changes seasons 15 to 22.
Always: rebuild with `python build_playbook.py` then `python build_hotstools.py --all --personal`, run `python test_playbook.py`, `node test_engine.js`, `node test_hotstools.js`, `node test_draftlab.js`.

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
