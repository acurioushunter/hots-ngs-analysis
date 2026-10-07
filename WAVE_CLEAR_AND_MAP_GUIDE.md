# Wave clear, camps and objectives: what wins in Division C West and how we draft for it

Built from all 56 Season 22 games (`knowledge/ngs_div.db`, per minute numbers from each player's own stats) plus the Icy Veins map guides. Rerun `python analyze_wave_clear.py` for the raw tables. Everything here is correlation from small samples: winners naturally take more camps, towers and experience, so read it as "what our wins and losses look like", not proof of cause.

## The short version
1. **Raw minion damage does not decide games here.** The team with more minion damage won only 22 of 56 games. The team with more **camp damage** won 50 of 56, more **structure damage** 50, more **experience** 49, more **takedowns** 49.
2. **The heroes that clear well still matter a little, and on Tomb a lot.** Teams with two or more strong wave clear heroes (3,500 or more minion damage per minute) won 55% of games, teams with one or none 45%. On **Tomb of the Spider Queen teams with only one such hero were 0-3**.
3. **Last night's Tomb loss was not a clear gap in total wave clear** (Cosmos 17.1k per minute against our 16.1k, and we had more experience and structure damage). It was **who** cleared. Cosmos had three heroes at 4.1k to 5.4k per minute (Kael'thas, Greymane, Yrel). We had two (Leoric 5.9k and Thrall 5.1k, both melee), while Sylvanas cleared only 1.7k, Tyrael 2.6k and Rehgar 0.9k. They also took far more camps (140k camp damage against our 110k). Whether we lost early towers cannot be seen in this data (NGS gives no timeline), but the shape matches what you saw.
4. **Against CCS the macro was even, and we lost on deaths.** In our six games the teams were within 6% on minion damage, 1% on camp damage and 3% on experience. In all four losses we died 15 to 18 times against 5 to 11 for CCS. In the two wins we died 7 and 2 times.
5. **Sylvanas is not a wave clear hero by minion damage** (2.0k per minute across 26 games, and 1.7k for Hunter in Tomb). She is a push, camp and structure hero: Possession on enemy minions, 1.3k structure and 1.5k camp damage per minute in this division, and in Storm League last year 25.4k structure damage a game (Junkrat 17.2k). In Tomb last night Hunter's structure damage per minute (0.90k) matched the best on our team. On a map that says "avoid low wave clear", the clear has to come from the other four players.

## What predicts a win (56 games)
| Stat | Team with more of it won |
|---|---|
| Minion damage | 22 of 56 |
| Camp damage | 50 of 56 |
| Structure damage | 50 of 56 |
| Experience contribution | 49 of 56 |
| Takedowns | 49 of 56 |

**Number of strong wave clear heroes on a team** (strong heroes: Blaze, Dehaka, Gazlowe, Gul'dan, Junkrat, Kael'thas, Kerrigan, Leoric, Lunara, Orphea, Ragnaros, Rexxar, Sonya, Tassadar, Thrall, Yrel):
- All maps: 0 high clear: 4-6, 1 high clear: 21-25, 2 high clear: 28-22, 3+ high clear: 3-3
- Tomb of the Spider Queen only: 1 high clear: 0-3, 2 high clear: 8-5, 3+ high clear: 1-1

## How PRA wins and loses (23 games)
| | Wins (14) | Losses (9) |
|---|---|---|
| Average length | 16.9 min | 22.0 min |
| Team deaths | 5.4 | 15.3 |
| Camp damage per min (us v them) | 6.6k v 3.3k | 4.8k v 6.2k |
| Structure damage per min | 6.0k v 1.2k | 2.2k v 4.6k |
| Experience per min | 3.14k v 2.68k | 2.80k v 3.03k |

We are a **snowball team**: we win fast games and lose the long ones, with nearly three times the deaths. Every player dies about three times as often in losses as in wins (hunterstag 1.1 to 3.7, chelsi 0.7 to 2.4, SoulShepherd 1.8 to 4.1, NorthrnTouch 1.2 to 3.2, Ltlbearista 0.6 to 1.9). We also win the camp fight when we win and lose it when we lose, so camps are worth contesting on purpose.

## Wave clear by hero (this division, 4 or more games)
Minion damage per minute is the wave clear measure and camp damage per minute is mercenary camps. "Ours" is the player who has the hero in the pool we use.

| Hero | Type | Games | Minion damage per min | Camp damage per min | Structure damage per min | Win rate | Ours |
|---|---|---|---|---|---|---|---|
| Ragnaros | Melee | 9 | 8,333 | 1,830 | 472 | 44% |  |
| Leoric | Melee | 23 | 6,529 | 625 | 672 | 61% | SoulShepherd |
| Tassadar | Ranged | 13 | 5,520 | 1,046 | 1,067 | 54% | chelsi |
| Gazlowe | Melee | 7 | 5,433 | 1,452 | 1,658 | 43% |  |
| Blaze | Ranged | 22 | 5,407 | 879 | 574 | 36% | SoulShepherd |
| Dehaka | Melee | 19 | 5,356 | 829 | 402 | 63% | SoulShepherd |
| Sonya | Melee | 10 | 4,648 | 2,188 | 768 | 50% |  |
| Yrel | Melee | 4 | 4,512 | 452 | 204 | 25% |  |
| Kael'thas | Ranged | 12 | 4,312 | 1,336 | 1,201 | 67% |  |
| Junkrat | Ranged | 8 | 4,247 | 1,459 | 1,128 | 62% | hunterstag |
| Thrall | Melee | 8 | 4,124 | 348 | 727 | 38% | chelsi |
| Gul'dan | Ranged | 6 | 4,067 | 1,358 | 1,457 | 50% | chelsi |
| Lunara | Ranged | 14 | 3,970 | 1,685 | 1,594 | 71% |  |
| Tychus | Ranged | 24 | 3,265 | 1,490 | 1,489 | 58% | hunterstag, chelsi |
| Falstad | Ranged | 10 | 3,228 | 1,210 | 698 | 40% |  |
| Artanis | Melee | 4 | 3,165 | 1,685 | 450 | 50% |  |
| Chromie | Ranged | 10 | 3,007 | 1,296 | 699 | 40% | hunterstag, chelsi |
| Li-Ming | Ranged | 14 | 2,902 | 1,564 | 1,338 | 50% |  |
| Jaina | Ranged | 11 | 2,834 | 1,559 | 814 | 27% |  |
| Greymane | Ranged | 11 | 2,815 | 2,272 | 1,191 | 73% |  |
| Johanna | Melee | 31 | 2,738 | 397 | 513 | 58% | NorthrnTouch |
| Raynor | Ranged | 7 | 2,338 | 2,387 | 1,610 | 71% |  |
| Stitches | Melee | 6 | 2,161 | 494 | 314 | 50% | SoulShepherd |
| Hanzo | Ranged | 9 | 2,092 | 1,596 | 623 | 33% |  |
| Sylvanas | Ranged | 26 | 1,986 | 1,473 | 1,326 | 58% | hunterstag |
| Arthas | Melee | 8 | 1,943 | 515 | 609 | 38% |  |
| Mei | Ranged | 5 | 1,783 | 217 | 98 | 0% |  |
| Valla | Ranged | 8 | 1,722 | 1,996 | 498 | 25% |  |
| Qhira | Melee | 5 | 1,603 | 1,018 | 367 | 40% |  |
| Varian | Melee | 11 | 1,576 | 265 | 288 | 55% | NorthrnTouch |
| Auriel | Ranged | 5 | 1,283 | 412 | 193 | 20% |  |
| E.T.C. | Melee | 12 | 1,082 | 508 | 421 | 42% | NorthrnTouch |
| Rehgar | Melee | 15 | 1,046 | 1,366 | 435 | 53% | Ltlbearista |
| Brightwing | Ranged | 23 | 1,036 | 821 | 298 | 61% | Ltlbearista |
| Garrosh | Melee | 6 | 1,029 | 223 | 228 | 17% |  |
| Anub'arak | Melee | 16 | 987 | 316 | 406 | 56% | NorthrnTouch |
| Diablo | Melee | 6 | 985 | 497 | 363 | 33% |  |
| Anduin | Ranged | 24 | 865 | 637 | 223 | 54% | Ltlbearista |
| Muradin | Melee | 12 | 836 | 419 | 379 | 75% | NorthrnTouch |
| Tyrande | Ranged | 10 | 736 | 402 | 191 | 20% |  |
| Stukov | Melee | 11 | 648 | 705 | 263 | 36% | Ltlbearista |
| Whitemane | Ranged | 10 | 611 | 358 | 192 | 50% |  |
| Malfurion | Ranged | 4 | 337 | 241 | 303 | 50% |  |

**Safe clear versus melee clear.** The ranged strong clearers are Tassadar, Kael'thas, Junkrat, Gul'dan and Lunara. Leoric, Gazlowe, Dehaka, Thrall, Ragnaros, Sonya and Yrel are melee, and Blaze is short range. They clear a lot but have to walk into lane. Against poke (Kael'thas, Greymane, Li-Ming, Hanzo, Lunara) a melee clearer takes damage while clearing and a ranged one does not. This part is reasoning, not something the stats can prove.

## Our players and CCS players (this division)
**PRA**

| Player | Games | Rating | Minion per min | Camps per min | Structure per min | XP per min | Deaths |
|---|---|---|---|---|---|---|---|
| SoulShepherd | 23 | 64 | 5,577 | 981 | 986 | 933 | 2.7 |
| chelsi | 23 | 63 | 3,858 | 1,504 | 1,384 | 633 | 1.4 |
| hunterstag | 23 | 58 | 2,896 | 1,691 | 1,271 | 654 | 2.1 |
| NorthrnTouch | 23 | 62 | 1,765 | 527 | 529 | 455 | 2.0 |
| Ltlbearista | 23 | 58 | 826 | 1,221 | 374 | 333 | 1.1 |

**CCS**

| Player | Games | Rating | Minion per min | Camps per min | Structure per min | XP per min | Deaths |
|---|---|---|---|---|---|---|---|
| ShadowDroid | 18 | 68 | 5,709 | 1,900 | 1,199 | 1,000 | 1.6 |
| WitsEnd | 18 | 63 | 3,102 | 1,248 | 1,223 | 612 | 1.8 |
| UnicycleYay | 15 | 61 | 2,350 | 882 | 1,115 | 567 | 2.1 |
| Valkamer | 16 | 58 | 1,829 | 443 | 576 | 524 | 2.0 |
| ûltear | 18 | 57 | 1,682 | 665 | 579 | 389 | 2.3 |

- **Our wave clear engine is SoulShepherd (5.6k), then chelsi (3.9k) and you (2.9k).** Hunter leads the team in camp damage (1.7k), so your job is camps, structures and kills, not clearing.
- **CCS's engine is ShadowDroid (5.7k minion, 1.9k camps, the highest experience on their team).** WitsEnd on Lunara adds 4.0k. Valkamer (1.8k), ûltear (1.7k) and UnicycleYay (2.4k) clear little.

## Tomb of the Spider Queen: what the map wants
Icy Veins: **prefer** impassable terrain effects, poke tools for the objective, quests to stack, strong late game, sustain, vision and **high wave clear**. **Avoid** weak late game, **low wave clear** and effects relying on bushes. Win conditions: the map objective (Webweavers, paid for with gems) or the boss camp.
- This division, Tomb: PRA 3-1, COSMOS 4-1, CCS 1-1.
- Last night's loss (23345, 29:35, the longest Tomb game): our per minute totals were minion 16.1k, camps 3.7k, structure 3.2k and experience 3.1k, against Cosmos 17.1k, 4.7k, 2.6k and 2.7k. Cosmos took 30k more camp damage. Deaths: Leoric 5 and Tyrael 6 for us, Greymane 5 and Brightwing and Muradin 4 each for Cosmos. We lost the late game with a Sylvanas that never cleared.
- **Draft for Tomb:** at least two high clear heroes and at least one ranged. With Hunter on Sylvanas (2.0k per minute), chelsi should be a ranged clearer (Tassadar 5.5k, Gul'dan 4.1k or Chromie 3.0k) and SoulShepherd Leoric or Blaze. Brightwing and Rehgar are right for sustain but add almost no clear (about 1.0k).
- **If Hunter has no Junkrat, Orphea (3.7k minion damage a minute, 70.6% in Storm League over the last year) or Chromie (3.0k, 80%) clear better than Sylvanas,** and you won on Chromie last night. Tomb is Hunter's worst big map in Storm League over the last year (31-39), though Orphea, Chromie and Tychus are 5-3 there.
- **Do not combine low clear heroes everywhere** (for example Sylvanas, a Muradin or Johanna tank and a healer). That leaves SoulShepherd clearing alone.

## Map by map (Icy Veins draft advice and the three team records)
| Map | Icy Veins prefers | Icy Veins avoids | PRA | CCS | COSMOS |
|---|---|---|---|---|---|
| Alterac Pass | Anchor Heroes for clearing Mercenary Camps Global presence Point control for Boss Camp Poke tools for Objective Self-sustain Split-push Tools for solo-capturing the Objective | Core backdoor | 1-1 | 1-0 | 0-0 |
| Battlefield of Eternity | Displacements into Immortal's Stun Poke tools for Objective Quests to stack on Heroes Race damage for Immortal Strong early game Vision tools | Weak early game | 1-1 | 1-0 | 0-2 |
| Braxis Holdout | Gankers Global presence Point control for Boss Camp Point control for Objective Quests to stack on Heroes Strong early game Sustain damage/healing Moderate waveclear | Mana-intensive Heroes Weak early game | 0-1 | 0-0 | 1-0 |
| Cursed Hollow | Heroes for clearing Mercenary Camps Effects relying on impassable terrain Global presence Point control for Boss Camp Poke tools for Objective Split-push Vision tools | Quests to stack on Heroes | 1-0 | 0-0 | 1-0 |
| Dragon Shire | Anchor Heroes for clearing Mercenary Camps Effects relying on impassable terrain Gankers Global presence Point control for Objective Strong late game Sustain damage/healing Vision tools | Weak late game | 2-1 | 1-1 | 0-1 |
| Garden of Terror | Heroes for clearing Mercenary Camps Double Bruiser Effects relying on impassable terrain Gankers Global presence Poke tools for Objective Strong late game Siege damage for Structures Split-push Tools for solo-capturing the Objective Vision tools | Weak late game Quests to stack on Heroes | 3-1 | 1-0 | 0-1 |
| Infernal Shrines | Double Healer Effects relying on impassable terrain Quests to stack on Heroes Strong late game High waveclear | Weak late game | 1-2 | 2-1 | 5-0 |
| Sky Temple | Heroes for clearing Mercenary Camps Gankers Global presence Point control for Boss Camp Split-push | Quests to stack on Heroes | 1-0 | 0-1 | 0-0 |
| Tomb of the Spider Queen | Effects relying on impassable terrain Poke tools for Objective Quests to stack on Heroes Strong late game Sustain damage/healing Vision tools High waveclear | Weak late game Low waveclear Effects relying on bushes | 3-1 | 1-1 | 4-1 |
| Towers of Doom | Heroes for clearing Mercenary Camps Gankers Global presence Offlaner who can double soak Poke tools for Objective Strong late game | Core backdoor Weak late game | 0-1 | 4-1 | 2-1 |
| Volskaya Foundry | Strong late game Siege damage for Structures Sustain damage/healing | Effects relying on bushes Effects relying on impassable terrain Weak late game | 1-0 | 1-1 | 1-1 |

## Plan against CCS (final), by likely map
We ban **Towers of Doom and Infernal Shrines** (their best, and they never ban them). CCS usually bans Braxis Holdout plus Cursed Hollow or Alterac Pass. Likely maps left: Tomb, Sky Temple, Garden of Terror, Dragon Shire, Volskaya, Battlefield of Eternity.

| Map | CCS | PRA | What the map wants | Our approach |
|---|---|---|---|---|
| **Sky Temple** | 0-1 | 1-0 | Camp clearers, gankers, split push | Our best fit. Sylvanas is 7-4 there in Storm League over the last year. Leoric or Blaze clear, Thrall or Tychus push |
| **Tomb** | 1-1 | 3-1 | High wave clear, late game, sustain | Two high clear heroes with one ranged (see above). Their clear is ShadowDroid and WitsEnd only, so ban Lunara and Gazlowe |
| **Garden of Terror** | 1-0 | 3-1 | Camp clearers, siege, split push, double bruiser | Hunter is 44-26 there in Storm League over the last year (Junkrat 11-1, Sylvanas 6-6) and we have won there 3 times. Camps decide it |
| **Dragon Shire** | 1-1 | 2-1 | Camp clearers, strong late game, sustain | They beat us there. Keep a sustain healer and a durable shrine holder |
| **Volskaya** | 1-1 | 1-0 | Late game, siege damage, sustain | Hunter is 28-31 there in Storm League over the last year (Sylvanas 4-3). Sylvanas only, or ban it |
| Battlefield of Eternity | 1-0 | 1-1 | Strong early game, quests, poke | We win it fast (13:30 last night). Keep Tychus and Johanna |

## The checklist
1. **Count the clear before locking the last picks:** two heroes at 3,500 or more per minute, at least one ranged. If SoulShepherd is the only one, chelsi must be a clearer.
2. **Hunter's job is camps, structures and kills.** Sylvanas gives structure pressure (Possession) and camps. If he needs to clear for himself, Orphea or Chromie do it better.
3. **Win the camp fight on purpose.** In our wins we out camp them 6.6k to 3.3k, in our losses we are out camped 4.8k to 6.2k.
4. **Keep the deaths down.** 13 of our 14 wins came with 9 or fewer team deaths (the exception was a 22 death Tomb win), and we have never lost with fewer than 10. In all four losses to CCS we died 15 or more times.
5. **Aim at CCS's weak links.** In their six losses one of ûltear, WitsEnd, Valkamer or UnicycleYay had the lowest rating, usually with 4 to 6 deaths (ûltear on Nazeebo scored 32 with 6 deaths in our Aug 18 win).
