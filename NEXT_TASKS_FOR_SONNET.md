# Next tasks for HotS Drafter (brief for an implementing session)

Read `CLAUDE.md` (standing rules), then `PROJECT_STATE.md` (top entries of 2026-10-15), then `IMPROVEMENT_IDEAS_PASS2.md` (backtest table and ranked list). Start with `git pull`. Today's date comes from the clock. Never open the "Claude Code" folder.

**Rules that bite here:** numbers come from a run, never from memory; say the sample size; prose shown to Hunter has no hyphens or em dashes (records like 7-2 are fine); separate "the numbers say" from "the kit suggests"; Blaze stays out of ranged counts but no note about it goes in the app; never edit generated files (`draft_tool*.html`, `hots_tools*.html`, `playbook/data.json`, `facts/`) by hand.

**After every task:** `python build_playbook.py`, `python test_playbook.py`, `node test_engine.js`, `python build_hotstools.py --all --personal`, `node test_hotstools.js`, `node test_draftlab.js`. All must print OK. Add a test for each new behaviour in `test_engine.js` (engine) or `test_playbook.py` (build). If a test breaks because the data changed, explain it in the commit and the handoff, never loosen it quietly. Commit with a plain message after each task, `git push`. Do not republish the phone artifact unless Hunter asks.

**Where things are:** engine `playbook/engine.js` (pure functions, `E.*`), UI `playbook/app.html`, build `build_playbook.py`, held out backtest `backtest_terms.py` (results in `knowledge/backtest_terms.json`, exposed as `data.backtest` with one slope per term). Team game log rows (`data.teams[name].log`) carry map, date, won, fp, picks, opp_picks, bans, bans1, bans2, opp_bans.

## Tasks, in order

### 1. Swap low value stats (S)
In `playbook/app.html`:
- `intelBlock`: the chip "Storm League N%" should say "Storm League, all ranks N%" with a title attribute explaining it is not NGS.
- `E.heroIntel` in `engine.js`: move the crowd control rank and first blood line to the end of `numbers` so win rates come first.
- `compCard` footnote: say the "Strong clear" and "Damage dealers" counts come from the division and may rest on 3 games per hero.
- Test: the intel chip text contains "all ranks".

### 2. Printable one page series plan (S to M)
New "Series plan" button on the Prep (overview) page in `app.html` that opens a print friendly view (CSS `@media print`, one page). Contents, all from existing engine calls: `E.tossAdvice(opp)` with both records and games, `E.mapPlan(opp)` bans and picks with each team's record and games, top 5 of `E.expectOppBans` round one and their top 5 first picks (`E.expectOppPicks` at slot 5 or 6), our lock early heroes (pick recs flagged LOCK), and the CCS notes if the opponent is CCS. Each number shows its sample. Test: a pure function `E.seriesPlan(opp)` returns those pieces and is covered in `test_engine.js`.

### 3. Post game review (M)
After a draft is complete (`finalCard` in `app.html`), add "How the draft compared": for each of our slots, the hero we took and the tool's top 3 at that moment (replay the actions with `E.clone` and `E.recommendPicks` / `E.recommendBans` before each of our slots), plus where our choice ranked. Add `E.reviewDraft(st)` in the engine returning `[{slot, type, took, rank, top3}]`. Wording: "the tool would have leaned", never "mistake". Test with a complete simulated draft (`E.simulate`): every one of our slots ranks 1.

### 4. Season weights in the Team data window (M)
`applyTeam` in `app.html` (around the `ngs_by` merge) adds seasons with equal weight. Weight each key by `0.5 ** ((22 - season) / 3)` (half life 3 seasons, as `season_weight` in `build_playbook.py`; read the newest season from `data.comps.newest`, `old` counts as season 18). Keep integer `g` and `w` for display, add `wg` and `ww` (weighted) and have `E.poolScore` use the weighted pair when present. Test: a player with only old season games gets less evidence weight than the same record this season.

### 5. Recency in the Draft Lab cards inside the Drafter (M)
`leagueCard`, `sRatings` "League games" and `leagueMapCard` call the Draft Lab engine (`draftlab/engine.js`) over every NGS game with equal weight (60% of games are seasons 15 to 18). Simplest honest fix: pass the Drafter only games from the newest 3 seasons (`L.filterGames(data.games, { leagues: ["NGS"] })` then filter `g.season >= newest - 2`) and say so in each card's label with the game count. Run `node test_draftlab.js`.

### 6. Why we lost, from the timeline (M, only if time)
`knowledge/ngs_league.db` table `lg_timeline` has experience lead at 5, 10, 15 minutes, first fort, wipes, merc uptime for replay export games only. In `build_playbook.py`, attach these to the matching `log` rows of our team where a game id match exists (export games have replay ids 9,000,000 and up in `ngs_div_plus.db`; check `supplement_div_from_export.py` for the mapping). In the UI show, per lost game: "behind by N experience at 10 minutes, first fort lost at M:SS, K wipes". Say what happened, not why. Mark games with no timeline.

When done: update the Status block at the top of `IMPROVEMENT_IDEAS_PASS2.md` and add a dated entry at the top of `PROJECT_STATE.md`, commit, push.
