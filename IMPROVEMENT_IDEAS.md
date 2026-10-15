# HotS Drafter: improvement ideas (audit of 2026-10-15)

## Status (2026-10-15, first implementation pass)

Done and tested (`test_engine.js`, `test_playbook.py`, `test_hotstools.js`, `test_draftlab.js` all OK):
- **1** Hero against hero edges shrink toward the hero's own weighted rate with a prior of 300 weighted games (about 800 raw). Pick scoring caps each pair at 1 point and the total at 2. A reason line prints only when the shrunk edge is 1.5 points or more. Ban dossier thresholds follow.
- **2** Coin toss advice shrinks team records toward 50% (prior 20 games) and says "toss up" unless a 4 point gap survives. The card shows the league first pick rate.
- **3** Map table shrinks each team's map record toward its own overall rate (prior 8 games) and marks thin cells (`thin`). The league per hero per map column is not done (see below).
- **4** One ranged penalty sized by the measured gap (0.8 to 3 points). No second role stacking penalty on the same pick.
- **8** The tier tag on a card uses the role the assigned player plays the hero in.
- **9 (part)** The Storm League window is today minus 365 days from the clock in the build.
- **12 (part)** Each card shows "players" against "board and league" points and a "close call" tag within 1 point of the top option.
- **15** The second healer line carries the league number.
- **16** Retired rules are skipped, the dead marksman bonus is removed, double healer drafts say there is no heal read.

Second pass (2026-10-15, see `IMPROVEMENT_IDEAS_PASS2.md`): **7** backtest done (`backtest_terms.py`, 1,421 held out games); matchup factor halved, heal lens shown but not scored. **9** player record now read against the player's own rate (prior 30) and the deaths line is role aware. **11** weak flag is role adjusted. **5** League read label fixed (weighting still open). **6** dropped: the backtest found no reliable map signal.

Not done yet: 5 (weighting), 9 (season weights in the Team window), 10, 13, 14.

---

Read only audit. Nothing in the tool was changed. Every number below comes from a run on 2026-10-15 against `playbook/data.json` (built 2026-10-14, 65 Division C West games, newest 2026-10-14) and `knowledge/expert/league_games.json` (8,255 NGS games, seasons 15 to 22). The audit scripts are throwaway files in the session scratchpad, not in the repo.

Effort: **S** is an hour or two in one file plus tests, **M** is half a day or touches the build and the page, **L** is a day or more.

Ranked by how much each one can change a real draft call, weighed against effort.

---

## 1. Hero against hero edges are mostly noise and lean against strong heroes (S)

**What happens.** `E.h2h` in `playbook/engine.js` shrinks a matchup toward 50% with a prior of 10 games, then subtracts the hero's own overall rate (`obs`, unweighted, all seasons). Pick scoring adds `edge × 20` (capped at about 2 points) for every enemy pick with 40 or more games, and prints a "does better / does worse" line when the edge is 3 points or more.

**What the numbers say.**
- Over 1,323 hero pairs with 40 or more games, the spread of edges is almost exactly what coin flips would produce. Share of the spread that is real: 6% at 40 to 80 games, 14% at 80 to 300 games, 32% at 300 or more. The real spread of a matchup is only about 1.5 to 2 points.
- The engine keeps 80% of an observed edge at 40 games. Measured, it should keep about 6 to 15%.
- Shrinking toward 50% and then comparing with the hero's own rate builds in a lean: heroes whose base is under 46% get a mean edge of +2.2 points against everyone (raw data says +0.5), heroes over 54% get −1.1 (raw −0.3). 192 and 281 hero pairs.
- 54% of all pairs print a reason line, so the "Why" list fills with noise.
- On a five hero CCS style board (Johanna, Lunara, Hanzo, Brightwing, Gazlowe) the head to head total for our pool runs from +5.1 (Tassadar) to −2.6 (Stukov). That swing is larger than the gap between a primary and a secondary pool hero (2 points).

**Idea.** Shrink toward the hero's own rate (the Draft Lab already does this with log5), use a prior in the hundreds of games (estimated from the data: roughly 800), compare a weighted rate with a weighted base, gate on weighted games rather than raw games, cap the total over all five enemies, and only print a line when the shrunk edge clears about 2 points. `E.banIntel` (25 games, 3 points) and `E.healLens` (60 sides, 4 points) need the same treatment.

**Limits.** This is an association across all divisions. It cannot show why a matchup goes one way.

## 2. Coin toss advice rests on 7 to 15 games (S)

**What happens.** `E.tossAdvice` compares our record with first pick against their record as map picker (and the reverse), with a 2 game Laplace prior, and calls it when the gap is 4 points.

**What the numbers say.** Against CCS it says "first" because PRA is 8-7 with first pick (15 games) and CCS is 3-4 as map picker (7 games). League wide the first pick side won 49.4% over 8,255 NGS games, 50.5% over 2,364 games in seasons 20 to 22. So the league shows no first pick edge, and a 15 game record cannot find one.

**Idea.** Start from the league rate, shrink team records hard toward it, and in most cases say "toss up: take the map pick if one map is clearly ours, otherwise first pick for the hero you most want". Show both records with games.

## 3. Map bans and map picks rest on one to six games per map (M)

**What happens.** `E.mapTable` and `E.mapPlan` use each team's season record per map with a 2 game prior. Against CCS the tool picks Sky Temple (we are 1-1, they are 1-0) and bans Towers of Doom (we are 0-1, they are 5-1).

**What the numbers say.** Most cells are 1 to 5 games. A single game moves a map's edge by 17 to 33 points in the table.

**Idea.** Shrink each team's map record toward its own overall rate (the Lab uses a prior of 20 for map splits), and add a second column from data that is not tiny: how our likely five heroes do on that map in league games (seasons 20 to 22, weighted), plus the Icy map tiers. Show games beside every number and say "lean" when the edge rests on fewer than 5 games.

## 4. A third ranged damage dealer is penalised twice (S)

**What happens.** In `recommendPicks` a third Ranged Assassin gets −2.5 for role stacking and another −3.75 from the ranged dealer rule (weight 1.5 × 2.5).

**What the numbers say.** With Sylvanas and Chromie already picked on Tomb, every third ranged option scored between −5.9 (Cassia) and −9.7 (Jaina): effectively a veto. The league record behind it is real but modest in size: sides with 3 or more ranged damage dealers won 33% over 160 sides (weighted; the newest 3 seasons show a gap of −21 points).

**Idea.** One penalty, scaled by the measured gap and its sample, and role stacking only for what the ranged rule does not already cover. Keep the reason line with the 160 sides in it.

## 5. The league cards in the Drafter ignore recency and carry a stale label (M)

**What happens.** "League read", the Ratings tab "League games" and "League data for this map" come from the Draft Lab engine over every NGS game in `league_games.json`. That engine has no season weighting. The League read card says "seasons 21 and 22".

**What the numbers say.** The data is 8,255 NGS games from seasons 15 to 22, and 4,992 of them (60%) are seasons 15 to 18. Standing rule 12 asks for recency weighting with the newest three seasons beside. Hero and map cells shrink to the newer data quickly: the median hero and map pair has 45 games over all seasons but only 14 or 15 in seasons 20 to 22, and 72% of pairs have fewer than 30 recent games.

**Idea.** Pass the same season weight (half life 3 seasons) into the Lab functions the Drafter calls, show the newest window beside it as the comp cells already do, and fix the label. Raise the Lab's low sample flag (8 games) for anything per hero per map.

## 6. Map context in hero ratings is only the Icy tier and tiny records (M)

**What happens.** `E.poolScore` gets its map signal from the Icy Veins map tier (judgment, undated), our own Storm League map record (Hunter only, 4 or more games) and our NGS map record (2 or more games).

**What the numbers say.** The league has measured map data for every hero: for example on Tomb, Blaze 480 games (134 in seasons 20 to 22), Brightwing 307 (80), Sylvanas 286 (83), Junkrat 263 (76), Varian 208 (46). The Lab already turns it into a "does better here than elsewhere" delta with a map prior of 20.

**Idea.** Add the weighted league map delta as a small term beside the Icy tier, show both in the reason list, and say which one is measured and which is a guide's opinion.

## 7. Backtest the weights before tuning them (M to L)

**What a previous pass likely missed.** None of the tests check whether a term predicts anything. Weights such as counter 1.5, map tier 0.8, evidence 3 and the 20× head to head factor were set by hand.

**Idea.** A small script that fits the league facts on seasons 15 to 21 and scores season 22 (529 games in the export, 497 played games on the match pages): do picks with a better head to head edge, map delta, heal lens or lens read actually win more in the held out season? Keep only terms that hold up, and size them from the result. This is the honest way to answer "how much should each thing count".

## 8. The tier tag on a recommendation can differ from the tier used to score it (S)

**What happens.** The score uses the assigned player's role row (rule 4, correct). The card's tier tag uses the hero's own role, or the hero's best tier when that role has no row.

**What the numbers say.** 9 map cases for our pools, all Varian for NorthrnTouch: scored as Tank (A, B or C) but the card shows Offlaner (C or D). Example: Dragon Shire scored Tank A, shown Offlaner C.

**Idea.** Show the tier for the role the assigned player plays it in, and name the role on the tag.

## 9. Our players' records: centring, double counting, a frozen date (S to M)

**What the numbers say and the code does.**
- Records are smoothed toward 50% with a 2 game prior, not toward the player's own rate. Our pool heroes have 0 to 12 NGS games each this season (Hunter: Sylvanas 10, Junkrat 6, Chromie 2, the rest 0 or 1; Ltlbearista: Brightwing 12, Rehgar 8, Anduin 4).
- NGS overall, NGS on this map, Storm League overall and Storm League on this map are all added, so the same games count twice.
- Only Hunter has Storm League data in the score (`sl_source`). The other four have none, so his heroes get terms theirs cannot get. The effect is small today (about +0.3 on Sylvanas).
- `sl_since` is fixed at 2025-10-07 in `our_team.json`. Today the window is 12 months and 8 days and grows every day. Rules 2 and 7 say the last 12 months, from the clock.
- The Team tab data window adds the chosen NGS seasons with equal weight, including seasons 15 to 20 ("old"), so old seasons can outweigh this one.
- A player with more than 3.5 deaths a game loses 0.5, whatever the role. Melee assassins average 3.35 deaths in the division, healers 1.70.

**Idea.** Centre on the player's own rate, use the map record only as a difference from the overall, compute `sl_since` as today minus 365 days in the build, and weight seasons in the data window by the same half life.

## 10. Opponent habits ignore the map and when games were played (M)

**What happens.** `expectOppPicks` scores a hero by picks at this slot × 3 plus games; `expectOppBans` by ban count plus bans against us. Neither looks at the map, and a game from week 1 counts the same as last week.

**What the numbers say.** Opponents have 17 to 23 games this season, so a map split is thin, but the hand written CCS rules (Ragnaros on Garden and Sky Temple, Hanzo on Dragon Shire and Volskaya, Gazlowe on Tomb) show the map matters for them. The team `log` already holds the map per game; the dates are on `h2h` rows but not on `log` rows.

**Idea.** Add map and date to `log`, give games on this map extra weight (with a small sample note), and weight recent games more. The simulated draft would follow.

## 11. Heroes Profile rating is compared across roles (S)

**What happens.** The "weak" flag (leave it open, do not ban) fires when a player's rating on a hero is 6 or more below his other heroes. Ban threat scales with rating.

**What the numbers say.** Average division rating by role: Support 70.8, Bruiser 60.6, Ranged Assassin 59.5, Healer 57.4, Melee Assassin 57.4, Tank 55.2. Weak flags: 4 of 49 tank rows against 1 of 110 ranged rows. A player who flexes to tank looks "weak" partly because tanks rate lower.

**Idea.** Compare each rating with the division (or league) average for that hero or role before flagging or scaling.

## 12. Show how sure a recommendation is, and when it is a coin flip (M)

**What the numbers say.** First pick on Garden against CCS: Sylvanas 8.94, Brightwing 8.93. On Tomb: Sylvanas 9.27, Brightwing 7.70, Blaze 7.32. The page shows a ranked list and a bar either way. Most of each score is the pool tag (primary 5, secondary 3), which is the team's own judgment; measured terms move it by about 1.

**Idea.** On each card, split the score into "your pool tags", "your games", "league data" and "rules", and mark options within about 1 point as "close, pick by comfort". This makes a surprising order easy to trace, as `UPDATE_PLAYBOOK.md` promises.

## 13. The matchup views show Icy lists while the score uses games (S to M)

**What happens.** The hero sheet Matchups tab and "What their picks mean" show only Icy Veins counter lists. The pick score uses measured league head to head whenever there are 40 or more games, and falls back to Icy only otherwise.

**Idea.** After item 1, show the measured edge with games beside the Icy list, and say which one the score used.

## 14. Stats on the cards that help a draft call little (S)

- **Storm League win rate chip** (all ranks, newest patches) on every dossier: a different game mode and skill band. The NGS weighted win rate is a better chip.
- **Crowd control seconds rank and first blood rate** in every dossier: interesting, but not a draft decision. Keep them in the hero sheet.
- **"Strong clear" and "Damage dealers"** in the comp meter use division per minute numbers with as few as 3 games per hero. Use league numbers or the profile's wave clear rating.
- **Missing and useful:** the hero's NGS ban rate on this map (the Lab has it), and the hard to replace loss in points (shown only when above 1.2 and the opponent takes it often).

## 15. Second healer penalty: the reason text promises maps that do not exist (S)

**What happens.** −3 for any second healer, with the text "only wanted on double healer maps", but no map ever lifts it.

**What the numbers say.** Two healers won 45% over 479 sides league wide. Per map the samples are 8 to 88 sides and no map clearly favours it (best: Volskaya 54% over 42, Cursed Hollow 55% over 12).

**Idea.** Keep the penalty, change the text to the league number, and size it from the measured gap.

## 16. Housekeeping (S)

- `E.rulesFor` does not skip rules marked `retired`. Today they do nothing because the code that read them is gone, but a future edit could bring them back silently.
- The engine still carries the marksman bonus with the text "13-6 with two or more" (rule `g-marksmen` is retired with `n: 0`, so it never fires). Delete it.
- `healLens` only reads when the enemy has exactly one healer, so double healer drafts get no heal read at all. Say so in the card.

---

### What the data cannot show
NGS match pages have no timeline; the replay export has a timeline summary but no crowd control order, so "who set up whom" stays a kit reading. Every league number here is an association across all divisions, not proof of a cause, and most team and player records still rest on 2 to 12 games.
