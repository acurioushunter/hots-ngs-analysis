# Burst, poke and sustained damage: what the data says about our drafts

You asked me to look at burst versus sustained damage instead of just auto attackers, because a Gul'dan can poke out a tank as well as a Valla can. The match pages give every player's damage **inside** and **outside** team fights, so I used that. `python analyze_poke_vs_burst.py` reprints the main numbers. 56 games, Division C West Season 22. Small samples, treat as leans.

## How I measured it
- **Poke** = hero damage dealt outside team fights, per minute. That is the chip damage that wears down a tank or healer before a fight.
- **Fight damage** = hero damage inside team fights, per minute. That is the burst or sustained damage that punishes an overextension and wins the fight.
- **Marksman** = an auto attack ranged hero. My list (a judgment call): Greymane, Valla, Raynor, Tychus, Lunara, Hanzo, Cassia, Sylvanas, Zul'jin, Fenix, Falstad.
- **Real damage dealer** = averages 2,400 or more hero damage per minute in this division.

## Your heroes and the ones you worry about (per minute, this division)
| Hero | Games | Poke | Fight damage | What it is |
|---|---|---|---|---|
| **Chromie** | 10 | **2,393** | 787 | Pure poker, the least fight damage of any ranged hero |
| **Junkrat** | 8 | 2,334 | 750 | Pure poker |
| Gul'dan | 6 | 2,262 | 1,284 | Both. The highest total hero damage |
| Tassadar | 13 | 2,206 | 1,167 | Both |
| Hanzo | 9 | 2,035 | 1,127 | Both |
| Li-Ming | 14 | 1,975 | 1,108 | Both |
| Kael'thas | 12 | 1,911 | 1,118 | Both |
| Tychus | 24 | 1,636 | 1,300 | Both, leans fight |
| Sylvanas | 26 | 1,538 | 1,349 | Both, leans fight |
| Lunara | 14 | 1,432 | 1,433 | Both |
| **Greymane** | 11 | 1,270 | 1,290 | Mostly fight, **not a heavy poker** |
| **Valla** | 8 | 1,059 | 1,357 | Mostly fight, **not a heavy poker** |
| **Thrall** | 8 | 1,100 | **1,464** | Fight damage, little poke |
| Johanna | 31 | 365 | 1,412 | Fight damage |
| Leoric | 23 | 679 | 761 | Low both (a clearer, not a damage dealer) |
| Blaze | 22 | 645 | 749 | Low both |
| Brightwing, Rehgar | | 213, 231 | 178, 258 | Healers |
So the heroes that actually chip a tank down in this division are the **ability pokers** (Chromie, Junkrat, Gul'dan, Tassadar, Hanzo, Li-Ming, Kael'thas), not Greymane and Valla. Your point is right: a Gul'dan or a Kael'thas outpokes a Valla, and they are the ones a tank has to worry about. Chromie and Junkrat chip hard but do little in fights, so they need a partner that punishes. Thrall punishes (1.5k a minute in fights) but barely pokes.

## What the actual poke margin does in a game
- The team that dealt more poke damage won **39 of 56** games. The team with more fight damage won 36.
- **Poke margin to results:** +3k or more 5-0, +1k to +3k 23-8, within 1k 20-20, -1k to -3k 8-23, -3k or worse 0-5. A 1k edge is 28-8 and a 1k deficit is 8-28.
- **PRA:** with a poke edge of 1k or more we are **9-2**, with a deficit of 1k or more **1-5**.
- **Last night's Tomb loss (23345):** we were outpoked 4.3k to 6.2k a minute (a deficit of 1.9k) even though we outfought them (6.9k to 5.3k). That is exactly your picture: Cosmos chipped us with Kael'thas, Greymane and Brightwing, we had no ranged poke to answer, and we only won the fights that happened.

## The catch: picking more poke heroes does not buy it
I checked whether you can see this at draft time by adding up each hero's usual poke. **It does not predict the result** (draft poke edge +1.5k or more went 7-6, a deficit of 1.5k or worse 6-7; the correlation with winning is 0.07). The draft explains only part of the actual margin (correlation 0.46), and the actual margin is tied to winning (0.50), so most of the poke margin comes from **who controls the map and who is ahead**, not from the five hero picks. Total damage and a "punish score" at draft time do not predict either.
That means "draft more poke" is not a rule. What it points to is **play**: not letting them chip us for free (staying out of range of their pokers, using the tank's engage and vision to force them back, and pushing waves so they cannot stand in front of us).

## What does predict the result at draft time
| Signal | Record | Notes |
|---|---|---|
| **2 or more marksmen** on the team | **13-6 (68%)** | 1 marksman is 36-42 (46%), 0 is 7-8 |
| Facing 2 or more marksmen with 1 or none of our own | **5-12** | with 1 marksman it is 3-9 |
| **Exactly 2 real damage dealers** (2,400+ a minute) | **37-23 (62%)** | with only 1 it is **12-22 (35%)**, with 3 it is 3-5 |
| Tomb: 3 or more ranged heroes | 8-4 | 2 or fewer 1-5 |
| Garden of Terror: 2 or fewer ranged | 3-0 | 3 or more 1-4 |
| Icy Veins counters, net in our favor | 24-20 (55%) | a small edge. Net against 20-24 |
| Tank plus bruiser count (1, 2, 3) | 3-2, 49-49, 4-5 | not a signal |
| One healer or support v two | 54-53 v 2-3 | not a signal |
| First pick v map pick | CCS 9-2 and 3-4, PRA 7-7 and 7-2, COSMOS 7-3 and 7-4 | team specific |
**Comp styles (our hero tags):** the pure poke and siege comps are **2-12**. Brawl and sustain comps are 7-2 against them, balanced 3-0, dive 2-0. Poke alone loses to the comps that run it down.
**Greymane and Valla in this division:** Greymane is 8-3 (73%), Valla is 2-6 (25%). Teams facing Greymane are 3-8. Icy Veins counters to Greymane are Brightwing, Johanna, Muradin, Arthas, Uther, The Butcher and Xul. Valla is countered by Greymane, Illidan, Nova, The Butcher, Valeera and Zeratul.

## Your Hunter and chelsi combinations
| Hunter + chelsi | Marksmen | Real damage dealers | Our record together | Comment |
|---|---|---|---|---|
| **Sylvanas + Tychus** | **2** | 2 | 2-1 | The safest shape: two auto attackers, both poke and fight |
| Sylvanas + Thrall | 1 | 2 | 1-1 | Last night's Tomb loss was this shape plus Leoric, Rehgar and Tyrael |
| Sylvanas + Chromie | 1 | 2 | 2-1 | Fine, Chromie adds the poke |
| Chromie (Hunter) + Tychus | 1 | 2 | 1-0 | Won on Dragon Shire |
| Li-Ming + Tychus | 1 | 2 | 1-1 | Won on Battlefield of Eternity |
| Junkrat + Thrall | 0 | 2 | 2-0 | Junkrat is the poke |
| **Chromie + Thrall** | **0** | 2 | never played | Your concern. Chromie pokes (2.4k) and Thrall punishes (1.5k), but nobody auto attacks, so we would be a 0 marksman team facing 2 or more marksmen, a 2-3 situation for any team |
What I would do with that:
- **If you take Chromie or Orphea or Junkrat (the ability pokers), pair them with an auto attacker** (Tychus or Sylvanas on the other side) so the team has 2 marksmen or 2 real damage dealers who can both poke and fight.
- **If the enemy shows Greymane, Hanzo, Lunara or two marksmen:** get a marksman of our own, plus a counter from Icy Veins (Brightwing and Johanna counter Greymane and both are in our pool), and keep the tank healthy rather than fighting at a range deficit.
- **Do not draft Chromie and Thrall together** unless the enemy has at most one marksman and we have two other sources of poke or a marksman.
- **Do not draft one real damage dealer.** Teams with one are 12-22. We have two (Hunter and chelsi) only if both are on high damage heroes (Raynor, Falstad and Leoric are not).

## Caveats
- Hero averages come from this division's 56 games, so a hero with a few games (Orphea has 3) is not reliable.
- NGS match pages have no early game timeline, so "feels bad in the early game" cannot be measured. These numbers are whole game.
- The marksman list and the 2,400 line are my judgment, not Icy Veins.
