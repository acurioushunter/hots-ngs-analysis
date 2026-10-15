# HotS Drafter: second pass (2026-10-15)

Hunter asked for this pass to be built straight through, so the top items were implemented right after the findings instead of waiting for a pick. All numbers come from `python -I backtest_terms.py` (output in `knowledge/backtest_terms.json`) and the build on 2026-10-15.

## How the backtest works
League facts (matchups, ranged gap, heal lens, lens signal, map delta, hero rates) are fitted on earlier NGS seasons only, then scored on a season the fit never saw: train 15 to 20 and test 21 (897 games), train 15 to 21 and test 22 (524 games), 1,421 held out games in all. Player terms use only games played before each test game. For each term the script reports the **calibration slope**: actual win shift per point of predicted win shift. 1 means the term is honest, 0 means no signal, 0.5 means it is twice as confident as it should be. The 95% interval comes from 1,000 bootstrap resamples of test games. It also reports the change in log loss against a coin flip, using the slope fitted on the other season. These are associations: a term that predicts wins may stand in for something else in the draft.

| Term | Slope | 95% interval | Games with a signal | Verdict |
|---|---|---|---|---|
| Player's overall rate (skill) | 0.28 | 0.23 to 0.32 | 1,421 | Strongest predictor, about 14 points of win shift per standard deviation |
| Player's record on the hero, read against their own rate | 0.35 | 0.23 to 0.46 | 1,421 | Real but overstated about 3 times with a 10 game prior |
| Player's record on the hero, against 50% (old method) | 0.22 | 0.18 to 0.26 | 1,421 | Mostly measures the player's skill, not the hero |
| Player comfort (log of games on the hero) | 0.01 per unit | 0.005 to 0.015 | 1,421 | Small, real |
| Hero against hero edge (first pass shrink) | 0.45 | 0.25 to 0.67 | 1,421 | Real, about twice too confident |
| Lens read | 0.39 | 0.16 to 0.61 | 1,421 | Real, about 2.5 times too confident |
| Hero's own league rate | 0.40 | 0.16 to 0.65 | 1,421 | Real alone, but overlaps the matchup term in a joint fit |
| Three or more ranged dealers | 1.9 | 0.5 to 3.1 | 21 | Backs the penalty, very small sample |
| Hero on this map (league delta) | 0.14 | minus 0.06 to 0.38 | 1,421 | No reliable signal, log loss got worse |
| Heal lens | minus 0.2 | minus 0.7 to 0.3 | 774 | No signal |
| Ban threat (opponent games on banned heroes) | about 0 | about 0 | 1,409 | No signal |

## Ranked list
S is an hour or two, M is half a day, L is a day or more. Risk means the risk of making a number look more certain than it is.

1. **Hero against hero weight halved** (S, done). Per pair factor 30 to 15, caps kept. Slope 0.45.
2. **Heal lens taken out of the score** (S, done). Still shown, with "shown only: this read did not predict wins in held out seasons". Slope minus 0.2 over 774 games.
3. **Player record read against the player's own rate** (S, done). Prior 30 games instead of a 2 game Laplace toward 50%; the map record now moves the score only by its gap from the same hero's record, so the same games no longer count twice. The reason line shows the player's rate on all heroes.
4. **Role aware deaths line** (S, done). Fires above the division average for the hero's role plus 1.5, with 3 or more games, and says so in the reason. Division averages: melee assassins 3.35 deaths a game, tanks 2.53, healers 1.70.
5. **Role adjusted weak flag** (S, done). Ratings are compared after removing the role gap (supports average 70.8, tanks 55.2). 10 of 78 player hero rows with 3 or more games are flagged. UnicycleYay on Qhira (5 games) is no longer flagged; the hand written CCS Qhira rule still discounts that ban.
6. **League read label** (S, done). It now states the seasons from the data (15 to 22) and that every season counts the same.
7. **Ban suggestions lean on volume that does not predict wins** (M, next, risk high). Threat is mostly games played times win rate. Lower the volume weight, show the ban's own league "banner won" record beside it, and say bans are a lean.
8. **Lens read text should say the gap is about 40% of what it shows** (S, next, risk medium). Or shrink the shown numbers by the slope.
9. **Opponent tendency by map and by recency** (original 10; M, next). Add map and date to the team log and weight recent games. It is what a player looks at between games.
10. **Post game review** (M). After a game, compare our picks and bans with the tool's top three at each slot, and show both records. Uses the series tracker that already exists.
11. **Printable one page series plan** (S to M). Toss call, map bans and picks with games, their likely first picks and bans per map, our lock early heroes.
12. **Why we lost, from the replay timeline** (M, risk high). Only games in the replay export have `lg_timeline` (experience lead at 5, 10, 15 minutes, first fort, wipes). Say what happened, not why.
13. **Personal improvement view per player** (M to L). Deaths and damage against the division average for the role, last 10 games trend with a sample warning. My Games already does part of this for Storm League.
14. **Season weights in the Team data window** (rest of original 9; M). The window adds old seasons with equal weight.
15. **Recency weights in the Draft Lab cards** (original 5; M). Label fixed; the weighting itself is still open.
16. **Matchup views show the measured edge** (original 13; S) and **swap low value chips** (original 14; S).
17. **League map delta as a pick term** (original 6): **dropped**. The backtest found no reliable signal.

## What the data cannot show
NGS match pages have no timeline. The replay export has a timeline summary but no crowd control order. Every league number is an association across all divisions, and most of our team records still rest on 2 to 12 games.
