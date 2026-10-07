# hunterstag deep dive: Hanzo, your hero pool, and the PRA team picture

Written 2026-10-06. Sources: your 4,735 Heroes Profile games (2,364 Storm League), the Season 22 NGS games we have (53 total, 20 are PRA), NGS records for all 38 players, and Icy Veins.
Every number below came from a query on the databases in this repo (`knowledge/hunter_hp.db`, `hots_s22.db`, `knowledge/ngs.db`, `knowledge/players_hp.db`).

## The short version

1. **You do not play Hanzo badly.** Your Storm League kills (4.7), takedowns (13.4) and hero damage (72.8k) match your Junkrat, and your 47.5% beats every other Hanzo main in Div C West (Imbuement 43.7% over 396 games, HarkinEH 46.0% over 259). Across the other 37 players, Hanzo wins only 43.3% of 953 Storm League games, 23rd out of 24 ranged assassins with at least 300 games.
2. **Hanzo costs you about 7 points per game.** Your Storm League win rate on everything else is 54.2%, on Hanzo it is 47.5%. Over 316 Hanzo games that is roughly 21 wins you would have had on an average pick.
3. **The damage is fine, the map presence is not.** On Hanzo your team reaches level 10 first only 51% of the time (Junkrat 63%, Sylvanas 59%), you clear waves at the same rate as Sylvanas but take only half to two thirds of the structure damage of your other ranged assassins, and you die 3 or more times in 53% of games. With 2 deaths or fewer you win 68%, with 3 or more you win 30%.
4. **Two fixes are in your hands:** take Explosive Arrows at level 4 instead of Serrated Arrows (+5 points, about 40% more minion damage), and play Hanzo only on maps with tight terrain (Dragon Shire, Towers of Doom, Sky Temple).
5. **Your best path to winning is Junkrat, Raynor, Valla and Abathur in Storm League, and Junkrat or Sylvanas locked early in NGS.**

## Part 1: Why Hanzo is not winning

### 1a. Your output matches your best hero (Storm League, career)
| | Hanzo | Junkrat | Sylvanas | Raynor |
|---|---|---|---|---|
| Games | 316 | 325 | 172 | 176 |
| Win rate | 47.5% | 62.5% | 54.1% | 61.4% |
| Kills per game | 4.7 | 4.7 | 4.8 | 4.4 |
| Takedowns per game | 13.4 | 14.1 | 12.8 | 12.4 |
| Hero damage per game | 72.8k | 74.2k | 67.3k | 50.6k |
| Deaths per game | 2.7 | 1.9 | 2.9 | 2.6 |
| Time dead per game | 108 s | 75 s | 105 s | 94 s |

Your hunch that you get plenty of kills and damage is correct. Win or lose, your Hanzo hero damage is almost identical (73.8k in wins, 71.9k in losses). What changes between wins and losses is kills (6.1 vs 3.5) and deaths (1.9 vs 3.5), not damage.

### 1b. The macro numbers (the part your team is feeling)
| | Hanzo | Junkrat | Sylvanas | Raynor | Valla | Cassia |
|---|---|---|---|---|---|---|
| Team reaches level 10 first | **50.6%** | 63.4% | 59.3% | 55.1% | 54.5% | 65.4% |
| Minion damage per level | 2,411 | 4,211 | 2,400 | 1,974 | 2,224 | 2,421 |
| Structure damage per level | **490** | 864 | 1,074 | 1,035 | 999 | 763 |
| Experience contribution per level | 545 | 713 | 644 | 632 | n/a | n/a |
| Merc camp captures per game | **4.4** | 3.7 | 3.5 | 6.0 | 3.8 | 4.1 |
| Camp (creep) damage per game | 30.4k | 24.0k | 20.4k | 37.1k | 27.4k | 22.4k |
| Win rate when your team hits level 10 first | 57.5% | 76.2% | 67.6% | 73.2% | n/a | n/a |
| Win rate when it does not | 37.2% | 38.7% | 34.3% | 46.8% | n/a | n/a |

What this says:
- **You do camp.** Your Hanzo takes more camps than your Junkrat or Sylvanas, so the hunch that you skip camps is not what the numbers show.
- **You do not take structures.** Your structure damage is about half of Sylvanas, Raynor and Valla. Towers and forts are how a lead becomes a won game.
- **Your wave clear is average for a marksman**, but Junkrat is an outlier at 75% more minion damage per level. When your teammates compare Hanzo to Junkrat they are comparing against the best wave clearer you play.
- **You convert leads worse.** When your team gets to level 10 first you win 57.5% on Hanzo, 76% on Junkrat. When you are behind, Hanzo is no worse than your other heroes. So Hanzo games are lost in the part where you should be closing out a lead.
- The level 10 stat belongs to the whole team, so it is a signal, not proof that your soaking caused it.

One correction to something I almost told you: games where your Hanzo has under 9k experience win only 31%, but that is mostly game length. Those are short games that ended early. Inside the same game length your win rate does not move with experience. I would not coach on that number.

### 1c. Deaths decide it
| Deaths in the game | 0 | 1 | 2 | 3 | 4 | 5 | 6+ |
|---|---|---|---|---|---|---|---|
| Hanzo games | 32 | 58 | 58 | 65 | 52 | 31 | 20 |
| Win rate | 91% | 71% | 52% | 43% | 29% | 10% | 20% |

- 2 deaths or fewer: **67.6%** (148 games). 3 deaths or more: **29.8%** (168 games).
- You have 3 or more deaths in **53%** of Hanzo games. Junkrat is 30%, Sylvanas 52%, Raynor 47%.
- 46 of your 316 Hanzo games ended before level 18, and you won 9 of them. Junkrat has 44 such games and won 24. Early blowouts on Hanzo are almost always lost.
- Hanzo is the squishiest hero you play and Icy Veins lists "no self sustain, very squishy" as his weakness. Fighting at the front of the pack, which you described, is where the deaths come from.

### 1d. The hero is weak at this skill level, and getting weaker for you
- Across the 37 other players' Storm League games Hanzo is 43.3% (953 games), against Raynor 53.8%, Junkrat 52.4%, Falstad 53.0%, Cassia 52.2%. Only Genji (40.7%) is lower.
- Icy Veins places Hanzo in Tier B on the general list and Tier S on the master list. The master list is written for much higher players than this bracket.
- Your Hanzo by year: 2025 **50.5%** (194 games), 2026 **42.5%** (120 games). By quarter: 51% (Oct to Dec 2025), 45%, 42%, 39% in 2026. Your overall rating went up over the same time (2,808 to 2,863) while your Hanzo rating fell from 2,685 in February to 2,565 now. Your last 50 Hanzo games are 21-29.
- Since July 1 you are 8-14 on Hanzo and 80-58 on everything else.

### 1e. Talents: Explosive Arrows is the wave clear talent
Icy Veins says Explosive Arrows has better wave clear than Serrated Arrows and Serrated is only good on Battlefield of Eternity and Hanamura Temple.
| Level 4 choice | Games | Win rate | Minion damage |
|---|---|---|---|
| Explosive Arrows | 180 | 49.4% | 58.4k |
| Serrated Arrows | 131 | 44.3% | 41.8k |

Serrated is 42% of your Hanzo games and it clears 28% fewer minions than Explosive. In games that reached level 20 (to remove the "short games lose" effect): Explosive with Giant Slayer 54.5% (66 games), Explosive with Piercing Arrows 53.7% (41), Serrated with Giant Slayer 46.3% (41), Serrated with Piercing Arrows 50.0% (30).
Also: Ninja Assassin at level 13 is 56.9% over 51 games against Fleet of Foot at 45.8% over 264 games. That is a small sample, worth testing, not a rule.
Giant Slayer (48.4%) and Piercing Arrows (50.0%) are not meaningfully different.
You take Simple Geometry (the Scatter Arrow quest) at level 1 in 98% of games. Icy Veins calls that Scatter Arrow build the hardest of the three and says it works best on maps with narrow corridors, which matches the map results.

### 1f. Maps (Storm League career)
| Map | Games | Win rate |
|---|---|---|
| Dragon Shire | 35 | 65.7% |
| Towers of Doom | 22 | 63.6% |
| Sky Temple | 28 | 57.1% |
| Garden of Terror | 30 | 50.0% |
| Cursed Hollow | 54 | 48.1% |
| Alterac Pass | 40 | 47.5% |
| Infernal Shrines | 26 | 42.3% |
| Battlefield of Eternity | 30 | 36.7% |
| Tomb of the Spider Queen | 21 | 28.6% |
| Volskaya Foundry | 13 | 15.4% |

Icy Veins: Hanzo does well on maps where objectives sit in small areas and terrain walls limit movement, and struggles on maps with large open areas. Your results agree.

### 1g. Your hunches, graded
| Hunch | Verdict | Evidence |
|---|---|---|
| "I get plenty of kills and damage on Hanzo" | **Confirmed** | 4.7 kills and 72.8k damage, same as Junkrat |
| "I fight instead of soaking or doing camps" | **Half right** | You take more camps than Junkrat, but almost no structures, and your team reaches level 10 first only 51% of the time |
| "My team says we lack wave clear" | **Partly right** | Hanzo is tagged poke and burst with no push in our tag list, and Serrated Arrows cuts your wave clear by 28% |
| "My team says we lack damage" | **Not supported** | Your hero damage matches Junkrat's; your 3 or more deaths in 53% of games is the bigger leak |
| "Chelsi fights and skips camps and offlane soak" | **No evidence either way** | NGS: PRA is 8-2 with chelsi on Tychus or Thrall. Storm League: the shared HealsOnly account's macro numbers in your games are normal (part 3) |

## Part 2: Your hero pool (Storm League career, with at least 40 games)
| Hero | Games | Win rate | Deaths | Notes |
|---|---|---|---|---|
| Junkrat | 325 | **62.5%** | 1.9 | Best hero by a mile. First to ten 63%. Strong on Garden of Terror (27-5), Braxis Holdout (33-18), Alterac (20-5) |
| Valla | 55 | 61.8% | 2.5 | 7.1 kills per game, Manticore at level 16 in most games (61.5%) |
| Raynor | 176 | 61.4% | 2.6 | Best on Garden of Terror (13-2), Towers of Doom (9-2), Tomb (11-4). Avoid Volskaya (1-9) |
| Abathur | 206 | 60.7% | 0.5 | Depends on your team's healer and tank |
| Leoric | 64 | 59.4% | 3.1 | |
| Cassia | 52 | 57.7% | 3.0 | |
| Chromie | 49 | 55.1% | 2.0 | |
| Sylvanas | 172 | 54.1% | 2.9 | Best on Garden of Terror, Tomb, Alterac; weak on Cursed Hollow (4-6) and Dragon Shire (6-9) |
| Greymane | 128 | 50.0% | 3.1 | |
| Hanzo | 316 | **47.5%** | 2.7 | 13% of all your Storm League games |
| Falstad | 83 | 43.4% | 3.0 | |

If you moved half of your Hanzo games to a pick that wins at your average non Hanzo rate (54.2%) you would win about 10 more games out of every 316, and about 20 more at Junkrat or Raynor rates.
In NGS (all seasons), you are 50-25. Junkrat 13-2, Sylvanas 11-6, Falstad 8-3, Greymane 4-5, Valla 2-4 (so Valla's Storm League strength has not carried over), Hanzo 2-1.

## Part 3: The team this season (NGS Season 22, 20 PRA games)
These are small samples, treat them as leans.

**Map pick and draft side.** PRA is **6-2 when we pick the map** and **6-6 when the other team does** (that is also when we pick first). Best map when we choose it: Garden of Terror (3-1). Infernal Shrines is 0-2 when the other team picks it and 1-0 when we do.

**When you pick.** Your hero in the first picks of the draft (slots 5 to 7): **9-4**. Mid picks (slots 8, 9, 12, 13): 2-1. Last picks (slots 14 to 16): **1-3**, and those were Chromie, Mephisto and Falstad, the leftovers.
Icy Veins says to pick Hanzo late, to avoid being countered by Genji, Illidan or Zeratul. The NGS data says late picks for you tend to be leftovers. Both can be true: lock Sylvanas or Junkrat early, and keep Hanzo for a counter pick when the draft has already shown you which assassins they have.

**Bans.** Opponents banned Junkrat in **12 of 20** games (we went 7-5 then, 5-3 when it stayed open). Cosmos banned it in both games against us.

**Wave clear in our own comps.** Using our hero tags, comps with 0 push heroes went **1-2**, with 1 went 5-3, with 2 went 6-3. Your Sylvanas, Junkrat and Raynor count as push heroes, Hanzo does not. Comps with 2 frontline, 1 healer and 2 damage are 9-7, with 3 frontline, 1 healer and 1 damage 3-1.

**Damage pairs (you and chelsi).**
| You | Chelsi | Record |
|---|---|---|
| Junkrat | Thrall or Tychus | 4-0 |
| Sylvanas | Tychus | 2-1 |
| Sylvanas | Chromie | 2-1 |
| Sylvanas | Thrall or Gul'dan | 2-0 |
| Sylvanas | Ragnaros | 0-1 |
| Falstad | Gul'dan, Tassadar or Tychus | 1-2 |

Chelsi on **Tychus or Thrall: 8-2**. Chelsi on any other hero: 4-6.

**Your Storm League games with the HealsOnly account.** HealsOnly is a shared account (1,162 Storm League games, 54.1%), and most of its games are with other people (Zooke 655 games, Rwcw1984 631). You and the account shared 73 games, 71 on the same team. Those 71 games are the group you described:
| Your hero in those games | Games | Record | Same hero without the group |
|---|---|---|---|
| Sylvanas | 33 | **23-10 (70%)** | 70-69 (50.4%) over 139 games |
| Junkrat | 12 | 8-4 (67%) | 195-118 (62.3%) over 313 games |
| **Hanzo** | 10 | **3-7 (30%)** | 147-159 (48.0%) over 306 games |
| Everything else | 16 | 10-6 | |

- **The group wins:** 44-27 (62%) together versus 53% in your other Storm League games. Sylvanas with them is your best result of any hero.
- **Hanzo does not improve with them,** it gets worse (3-7). So the Hanzo problem is not random teammates. It follows the hero.
- **The account's own macro numbers do not show the gap you suspected.** In your 71 games its player averaged 74k siege damage, 51.6k minion damage and 11.0k experience, against 67k, 45.6k and 10.9k in its other games. Camps are slightly lower (2.7 vs 3.0 a game). I cannot say who was playing the account in each game, and I do not have the rosters yet (the roster pull was interrupted by a Cloudflare check after 47 of 73 games), so treat this as "no evidence for the hunch", not as a clear verdict.
- **Its best heroes in your games:** Thrall 9 games 78%, Arthas 5 games 80%, Sylvanas 7 games 71%. The weakest were Tyrael (1-3) and Johanna (1-2).
- The 71 games, with both sides' heroes for your side, are in `knowledge/healsonly_shared_games.csv`.

**Rosters for those 71 games** (the full match data is in `knowledge/raw/healsonly/matches/`, one file per game, and `python analyze_healsonly_rosters.py` reprints everything below):
| With on your team | Games | Record |
|---|---|---|
| Ltlbearista | 22 | 14-8 |
| SoulShepherd | 20 | 12-8 |
| NorthrnTouch | 12 | 9-3 |
| ZergPern | 6 | 3-3 |
| HealsOnly, Ltlbearista and SoulShepherd together | 17 | 11-6 |

- **Premade size:** 5-stack 34-22 (56 games), 4-stack 6-2, 3-stack 4-1, 2-stack 0-2.
- **Game length:** under 15 minutes 9-1, 15 to 20 minutes 22-11, 20 to 25 minutes 10-10, over 25 minutes 3-5. Your group wins by ending games early, and loses the long ones. A slow scaling poke hero like Hanzo (average 19.5 minutes) is working against the group's tempo.
- **Your hero as the first pick of the game:** 9-3. As the fifth pick: 8-7. As the ninth pick: 3-4.
- **Frontline (tank plus bruiser) on your team:** 1 frontline 1-4, 2 frontline 38-22, 3 frontline 5-1.
- **Your 10 Hanzo games with this group (3-7):** every one had a second ranged assassin on your team. With Sylvanas as that partner you were 3-1. With anyone else (Falstad twice, Lunara twice, Nazeebo, Valla) you were 0-6. Six games is far too few to call it a rule, but it is the one pairing that worked.
- **Enemy had Genji, Illidan or Zeratul** (the heroes Icy Veins lists as Hanzo counters): in none of the 10 Hanzo games, so counters do not explain the losses either.

**Your usual Storm League stack (all time):** Ltlbearista 538 games (53.2%), SoulShepherd 404 (50.7%), NorthrnTouch 62 (61.3%). Ltlbearista is mostly Brightwing, Anduin, Rehgar. SoulShepherd is Stitches, Anub'arak, Leoric, Blaze.

## What to do about it
1. **Make Junkrat, Raynor, Valla, Sylvanas and Abathur your Storm League defaults.** Use Hanzo as a deliberate pick, not a habit.
2. **If you do play Hanzo:** only on Dragon Shire, Towers of Doom or Sky Temple (all three are 57% or better for you), take Explosive Arrows at level 4, try Ninja Assassin at 13, and ask for a wave clear partner (Junkrat, Azmodan, Sylvanas, Raynor, Zagara) so the comp is not poke with no push. Avoid Volskaya, Tomb and Battlefield of Eternity.
3. **Treat 2 deaths as your cap.** At 2 or fewer you win 68%. Use Natural Agility earlier, and stay behind the tank in fights. This is the largest single lever in the data.
4. **Give Hanzo a job between fights:** take one lane's towers while the tank holds the other, instead of waiting for the next fight. The structure damage gap (490 per level vs about 1,000 on Sylvanas and Raynor) is where a lead is being left on the table.
5. **With your usual group:** Sylvanas is 23-10 and Junkrat 8-4, Hanzo 3-7. Lock Sylvanas or Junkrat when you queue together.
6. **In NGS:** win the map pick, lock Sylvanas or Junkrat in your first pick slot, and expect Junkrat to be banned. Ask chelsi to stay on Tychus or Thrall.
7. **Watch three of your recent Hanzo losses** and count how many of your deaths came while no one else was in the fight. If most were solo deaths, the deaths cap is the fix. If most were fights that your team started without you, the fix is communication.

## What this cannot tell us
- Storm League games in Heroes Profile do not include who was on your team or the enemy team, so I cannot say which teammate or comp lost a given Hanzo game.
- The level 10 numbers are team numbers, so they are suggestive, not proof of cause.
- The NGS samples are 20 games for PRA and 3 for Hanzo.
- The deaths and macro numbers describe patterns that were also present in your other heroes, just smaller.
- Patch changes are not in the data. Your drop in 2026 could be a Hanzo patch change that I cannot see here.
