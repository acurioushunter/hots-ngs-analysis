# CCS, the whole picture: every game, Cosmos, and the Garden of Terror loss

Built from all 18 CCS games (Season 22, Division C West) with `python analyze_ccs_full.py`, the draft tables in `knowledge/ngs_div.db`, and Icy Veins matchup and map notes. NGS pages have no timeline, so anything about "who led when" is your memory, not something I can check. Small samples throughout.

## The short version
1. **CCS is 12-6. All six losses share two things: they died far more (9.5 more deaths than the other team on average) and the opponent had Brightwing or Anduin.** CCS is **3-6 against a Brightwing or Anduin team and 9-0 against every other healer** (Stukov, Rehgar, Tyrande, Malfurion, Whitemane, Auriel, Ana). Part of that is who plays Brightwing (Cosmos, us), but across the whole division Brightwing and Anduin teams are also 27-20 against 29-36 for the rest.
2. **Against us it is the same split.** We are 2-1 against CCS when Ltlbearista plays Brightwing and 0-3 when he plays Rehgar (twice) or Stukov.
3. **Cosmos beat them three times (Tomb, Towers, Infernal Shrines) and lost to them twice (Towers, Volskaya).** The two CCS wins came after they **banned Tassadar, Anub'arak and Valla** and drafted Sylvanas, Whitemane, Lunara and Muradin.
4. **Garden of Terror, the fight picture:** Qhira did **53k fight damage, two thirds of our whole team's 81k**. CCS dealt 5.0k fight damage a minute to our 3.5k and 264k total hero damage to our 188k. Our tank (E.T.C.) died 6 times and spent 4.4 of the 24 minutes dead. Camps (35 v 34) and structure damage (3.4k v 3.0k a minute, in our favor) were even at the end.
5. **What did separate the teams was experience and clear:** CCS 3.33k a minute against our 2.69k, and minion damage 18.2k against 12.0k, with Ragnaros alone at 265k minion damage, 351k siege and 34k experience.
6. **When CCS loses, every one of their five players' deaths roughly doubles** (Valkamer 1.6 to 3.2, WitsEnd 1.2 to 3.2, UnicycleYay 1.6 to 3.2, ûltear 1.7 to 3.5, ShadowDroid 1.2 to 2.3).

## 1. All 18 CCS games
Per minute totals (CCS first, opponent second), fight damage and poke in k.
| Game | Date | Map | Opponent | Result | Length | Deaths | Fight dmg | Poke | Struct dmg |
|---|---|---|---|---|---|---|---|---|---|
| 22944 | Aug 19 | Sky Temple | PRA | L | 15:24 | 19-7 | 4.7-4.3 | 4.6-7.2 | 1.6-5.0 |
| 22945 | Aug 19 | Dragon Shire | PRA | W | 26:32 | 9-18 | 4.6-4.5 | 6.6-6.3 | 5.5-2.9 |
| 22946 | Aug 19 | Alterac Pass | PRA | W | 23:22 | 6-15 | 5.7-4.6 | 6.0-7.5 | 5.9-1.3 |
| 22998 | Aug 25 | Tomb | **Cosmos** | **L** | 17:45 | 13-6 | 5.4-6.2 | 5.4-4.3 | 4.3-4.8 |
| 22999 | Aug 25 | Towers of Doom | **Cosmos** | **L** | 17:50 | 18-2 | 4.9-5.6 | 3.2-5.3 | 0.5-1.0 |
| 23087 | Sep 4 | Infernal Shrines | Roll1 | W | 15:19 | 6-15 | 5.3-5.9 | 3.2-2.5 | 6.9-0.0 |
| 23088 | Sep 4 | Towers of Doom | Roll1 | W | 17:19 | 10-16 | 7.5-5.2 | 5.1-4.9 | 6.3-6.5 |
| 23115 | Sep 9 | Tomb | Anomaly | W | 12:35 | 2-14 | 4.5-2.9 | 4.6-3.0 | 8.2-0.5 |
| 23116 | Sep 9 | Towers of Doom | Anomaly | W | 23:07 | 13-17 | 5.3-5.1 | 5.8-2.7 | 4.2-3.5 |
| 23167 | Sep 16 | Dragon Shire | Good Lordy | L | 14:17 | 13-2 | 3.7-5.8 | 5.6-2.7 | 1.2-7.6 |
| 23168 | Sep 16 | Battlefield of Eternity | Good Lordy | W | 18:00 | 11-17 | 7.1-6.6 | 4.4-3.7 | 4.9-0.1 |
| 23169 | Sep 16 | Towers of Doom | Good Lordy | W | 15:12 | 3-12 | 6.8-5.4 | 4.4-2.7 | 1.2-1.0 |
| 23229 | Sep 23 | Volskaya | PRA | L | 18:12 | 10-2 | 5.6-5.8 | 6.2-5.0 | 1.7-8.0 |
| 23230 | Sep 23 | Garden of Terror | PRA | W | 24:20 | 11-15 | 5.0-3.5 | 5.8-4.3 | 3.0-3.4 |
| 23231 | Sep 23 | Infernal Shrines | PRA | W | 15:21 | 5-17 | 8.0-5.9 | 6.0-4.4 | 10.6-1.6 |
| 23307 | Oct 2 | Infernal Shrines | **Cosmos** | **L** | 24:57 | 18-15 | 5.5-4.7 | 2.4-5.2 | 3.5-4.1 |
| 23308 | Oct 2 | Towers of Doom | **Cosmos** | W | 15:55 | 5-16 | 5.9-6.1 | 4.8-4.7 | 4.4-2.1 |
| 23309 | Oct 2 | Volskaya | **Cosmos** | W | 19:41 | 5-14 | 6.1-6.6 | 6.9-5.3 | 8.4-2.3 |
- **Mean differences, CCS minus opponent.** In 12 wins: deaths -8.3, structure damage +3.7k a minute, camp damage +2.0k, experience +0.5k, takedowns +36. In 6 losses: deaths +9.5, structure damage -2.9k, minion damage -2.3k, experience -0.6k, takedowns -40.
- **Fight damage and poke are small in both** (about +0.8k in wins and -0.5k in losses). They win the game by winning fights and then taking structures; the six losses are not a poke problem.
- **Maps for CCS:** Towers of Doom 4-1 (the loss was Cosmos), Infernal Shrines 2-1 (the loss was Cosmos), Dragon Shire 1-1, Tomb 1-1, Volskaya 1-1, Sky Temple 0-1, Alterac 1-0, Battlefield of Eternity 1-0, Garden 1-0.

## 2. The six CCS losses, drafts and bans
| Game | Map | Opponent draft | CCS draft | CCS bans, opp bans |
|---|---|---|---|---|
| 22944 | Sky Temple | Junkrat, **Brightwing**, Anub'arak, Tychus, Sonya (PRA) | Johanna, Sylvanas, Tyrande, Ragnaros, Nazeebo | Stukov, Dehaka, Thrall / Falstad, Rehgar, Hammer |
| 22998 | Tomb | Johanna, Tassadar, **Brightwing**, Blaze, Tychus (Cosmos) | Qhira, Kael'thas, Stukov, E.T.C., Gazlowe | Sylvanas, Whitemane, Thrall / Valla, Garrosh, Varian |
| 22999 | Towers | Kael'thas, Anub'arak, **Anduin**, Greymane, Blaze (Cosmos) | Johanna, Dehaka, Qhira, Tyrande, Zul'jin | Sylvanas, Brightwing, Tychus / Garrosh, Li-Ming, Rehgar |
| 23167 | Dragon Shire | Johanna, Jaina, Falstad, Leoric, **Anduin** (Good Lordy) | Dehaka, Lunara, Hanzo, Brightwing, Garrosh | Lost Vikings, Zeratul, Chen / Chromie, Stukov, Varian |
| 23229 | Volskaya | Johanna, Sylvanas, Leoric, **Brightwing**, Thrall (PRA) | Lunara, Blaze, Garrosh, Anduin, Hanzo | Junkrat, Chromie, Tychus / Li-Ming, Qhira, Hammer |
| 23307 | Shrines | Anub'arak, **Brightwing**, Tassadar, Valla, Rexxar (Cosmos) | Qhira, Lunara, Garrosh, Whitemane, Sonya | Blaze, Kael'thas, Sylvanas / Arthas, Johanna, Gazlowe |
Shape of the six: **Johanna or Anub'arak up front (6 of 6), a mobile healer (Brightwing or Anduin, 6 of 6), and a high output mage or marksman (Tassadar, Kael'thas, Jaina, Sylvanas, Valla, Tychus).** CCS's own healers in those six were Tyrande twice, Stukov, Brightwing, Anduin and Whitemane. The Brightwing and Anduin pattern is the repeated one I can rely on, but it is 9 games that went 3-6, and two of the three CCS wins came in the same match against Cosmos (see below). CCS also owns Johanna and Anub'arak, which Icy Veins lists as counters to Brightwing, so the pairing is not a free answer for them.

## 3. Cosmos against CCS: the two matches
**Aug 25: Cosmos 2-0**
| Game | Map | First pick, map pick | Cosmos draft | CCS draft | Bans |
|---|---|---|---|---|---|
| Tomb | Tomb | Cosmos picked first, CCS picked the map | Johanna, Tassadar, Brightwing, Blaze, Tychus | Qhira, Kael'thas, Stukov, E.T.C., Gazlowe | Cosmos banned Valla, Garrosh, Varian. CCS banned Sylvanas, Whitemane, Thrall |
| Towers | Towers | CCS first pick, Cosmos map | Kael'thas, Anub'arak, Anduin, Greymane, Blaze | Johanna, Dehaka, Qhira, Tyrande, Zul'jin | Cosmos banned Garrosh, Li-Ming, Rehgar. CCS banned Sylvanas, Brightwing, Tychus |
**Oct 2: CCS 2-1**
| Game | Map | CCS first pick, Cosmos map | Cosmos draft | CCS draft | Bans |
|---|---|---|---|---|---|
| Shrines | Shrines | yes | Anub'arak, Brightwing, Tassadar, Valla, Rexxar | Qhira, Lunara, Garrosh, Whitemane, Sonya | CCS banned Blaze, Kael'thas, Sylvanas. Cosmos banned Arthas, Johanna, Gazlowe. **Cosmos won** |
| Towers | Towers | yes | Kael'thas, Brightwing, Stitches, Gazlowe, Zul'jin | Sylvanas, Whitemane, Dehaka, Lunara, Muradin | **CCS banned Tassadar, Anub'arak, Valla.** Cosmos banned Johanna, Arthas, Garrosh. **CCS won** |
| Volskaya | Volskaya | yes | Arthas, Anduin, Tychus, Thrall, Orphea | Sylvanas, Gazlowe, Whitemane, Gul'dan, Muradin | CCS banned Anub'arak, Tassadar, Valla. Cosmos banned Johanna, Li-Ming, Lunara. **CCS won** |
What it says:
- **Cosmos beat CCS on Tomb, Towers and Infernal Shrines, and lost on Towers and Volskaya.** All three Cosmos wins had **Anub'arak or Johanna, Brightwing or Anduin, and Tassadar or Kael'thas**, with a clear and push hero (Blaze twice, Rexxar). CCS played Qhira in all three (Tomb slot 6, Towers slot 9, Shrines slot 5) and Cosmos won the fights every time.
- **After losing game 1 on Oct 2, CCS banned Tassadar, Anub'arak and Valla** (the three Cosmos heroes that carried the win) and **won twice with Sylvanas, Whitemane and Lunara**, and left Qhira out. Cosmos kept Brightwing and Anduin, so the answer was removing the carries, not the healer.
- **Cosmos banned Garrosh in 3 of 5 games** and Johanna in all three on Oct 2. Garrosh is Valkamer's third hero and is on Qhira's counter list, so these bans also hit what CCS wants.
- **What this means for us:** CCS has shown how it beats Cosmos (ban the carries, play Sylvanas and Whitemane) and how Cosmos beats CCS (Anub'arak or Johanna, Brightwing, a big mage). If we face Cosmos in the final the reverse is also true. If CCS are our opponent, we should copy the Cosmos recipe, not the Cosmos Qhira bait.

## 4. Healer pattern in detail
| Opposing healer in a CCS game | Games | CCS result |
|---|---|---|
| Brightwing | 6 | 2-4 |
| Anduin | 3 | 1-2 |
| Stukov | 2 | 2-0 |
| Rehgar | 2 | 2-0 |
| Tyrande, Malfurion, Whitemane, Auriel, Ana | 1 each | 5-0 |
- Against **us** CCS is 3-0 when we play Rehgar or Stukov, 1-2 when we play Brightwing (we won Sky Temple and Volskaya, and lost Alterac in 23 minutes with 15 deaths).
- Division wide, Brightwing teams are 14-9, Anduin teams 13-11, Tyrande 2-8, Auriel 1-4, Stukov 4-7, Rehgar 8-7, Whitemane 5-5. A team with Brightwing or Anduin is 27-20 (57%) against 29-36 (45%) with any other healer.
- **Why, probably:** both are the mobile peel healers (Emerald Wind, Polymorph, Anduin's Lightbomb and Prayer of Mending, knockback and root), which is the same kind of crowd control Icy Veins lists as Qhira's weakness and also makes Qhira and ShadowDroid dives hard to finish. This is my read of the kits plus the numbers, not a stat in the data.
- **What we do:** Brightwing should be our first healer choice against CCS. It has been banned only once (Aug 25 Towers, round one, by CCS against Cosmos), never against us. Lock it by slot 9 (first pick) or 7 (second pick) and put the tank after it.

## 5. CCS players: what changes in a loss
Per game averages, wins (12) against losses (6).
| Player | Damage a minute | Fight damage a minute | Deaths | Rating |
|---|---|---|---|---|
| Valkamer | 1,859 to 1,420 | 1,424 to 1,062 | 1.6 to 3.2 | 63 to 45 |
| ShadowDroid | 1,946 to 1,456 | 920 to 748 | 1.2 to 2.3 | 71 to 63 |
| WitsEnd | 2,782 to 1,995 | 1,404 to 844 | 1.2 to 3.2 | 70 to 48 |
| UnicycleYay | 3,427 to 2,921 | 1,633 to 1,663 | 1.6 to 3.2 | 67 to 50 |
| ûltear | 1,645 to 1,700 | 752 to 801 | 1.7 to 3.5 | 62 to 47 |
- **WitsEnd collapses the most** (damage down 28%, rating 70 to 48), and the collapse is in fights. When WitsEnd is dead or off Lunara the team loses.
- **ShadowDroid is the steadiest** (rating 63 in losses) and the most carried by his own clear (5.7k minion damage a minute). He is the player we cannot outfarm, so deny him Gazlowe and keep a counter ready for Dehaka.
- **UnicycleYay's fight damage is the same in wins and losses (1.63k against 1.66k);** the difference is deaths. He dies twice as much and gives up poke.

## 6. The Garden of Terror game (Sep 22 game 2, a loss, 24:20)
**Rosters**
| Team | Player | Hero | Role | K/D/A | Damage | Fight damage | Taken | Healing | Minion | Camp damage | Camps | Time dead | Rating |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CCS | UnicycleYay | Qhira | Melee assassin | 6/2/9 | 77.6k | 53.4k | 63k | 0 (self 22.9k) | 65.9k | 27.4k | 8 | 72s | 71 |
| CCS | ûltear | Li-Ming | Ranged assassin | 5/3/9 | 63.6k | 32.0k | 34.9k | 0 | 59.5k | 39.8k | 5 | 130s | 56 |
| CCS | WitsEnd | Tyrande | Healer | 3/1/10 | 57.0k | 13.0k | 29.6k | 56.9k | 22.2k | 9.2k | 7 | 41s | 68 |
| CCS | ShadowDroid | Ragnaros | Bruiser | 1/3/10 | 41.7k | 7.0k | 35.9k | 0 | **265.6k** | 52.2k | 8 | 140s | 65 |
| CCS | Valkamer | Anub'arak | Tank | 0/2/14 | 24.1k | 15.0k | 70.4k | 0 | 29.1k | 10.3k | 6 | 82s | 58 |
| **PRA** | chelsi | Tychus | Ranged assassin | 4/3/6 | 83.7k | 27.0k | 49.8k | 0 | 97.7k | 28.2k | 6 | 102s | 55 |
| **PRA** | hunterstag | Sylvanas | Ranged assassin | 5/2/5 | 51.5k | 21.0k | 37.5k | 0 | 47.8k | 36.7k | 9 | 124s | 57 |
| **PRA** | SoulShepherd | Blaze | Offlaner | 0/2/8 | 33.2k | 20.0k | 84.2k | 0 | 112.2k | 25.7k | 6 | 124s | 63 |
| **PRA** | NorthrnTouch | E.T.C. | Tank | 1/6/7 | 16.0k | 11.0k | 74.5k | 0 | 22.1k | 5.2k | 4 | **266s** | 47 |
| **PRA** | Ltlbearista | Rehgar | Healer | 1/2/9 | 3.7k | 2.0k | 43.8k | 115.7k | 11.7k | 32.2k | 10 | 104s | 57 |
**Draft:** CCS bans Junkrat, Chromie, Thrall. Ours: Johanna, Hammer, Sonya. CCS first picked Qhira (slot 5) and then took Anub'arak, Li-Ming, Ragnaros and Tyrande. Icy Veins lists synergy for Qhira with Anub'arak, and for Tyrande with Anub'arak and Li-Ming, so this is a synergy comp. It also fits Icy Veins' Garden advice (clear camps, double bruiser, siege damage, split push) exactly, with Ragnaros as the split pusher.

**Where your read matches the numbers**
- **Qhira pulled the damage.** Her 53.4k fight damage was 66% of our whole team's 81k and double our best (Tychus 27k). She also did 27k to camps and cleared 66k of minions, so she was soaking and fighting at once.
- **We could not fight.** Their fight damage was 5.0k a minute to our 3.5k, total hero damage 264k to 188k, and they spent 7.8 minutes dead to our 12.0. Our healer and tank put out 20k of hero damage between them while their Tyrande and Anub'arak put out 81k (Tyrande's 57k was the third highest on her team).
- **Our front line was alone.** E.T.C. died 6 times and was dead 4.4 of 24 minutes; Blaze took 84k damage. Qhira took only 63k (Anub'arak 70k, Blaze 84k, E.T.C. 75k), so she was not the one absorbing the damage, but she was the one who could not be killed: 72 seconds dead for the whole game.
- **Self healing helped her:** 23k, the highest on her team. Her self healing was 12k to 15k in the Cosmos losses and 23k to 25k in her two wins, so it follows how well she is doing.
- **Ragnaros stalled and cleared.** 265k minion damage (over 4 times Li-Ming) and 34k experience contribution, more than double anyone on our team (best 18k). CCS out-experienced us 3.33k to 2.69k a minute and out-cleared us 18.2k to 12.0k.

**Where the data says something different**
- **The healer that saved kills was Tyrande, not Whitemane.** Whitemane (ûltear) was in game 3. In game 2 ûltear was on Li-Ming. Sylvanas was our hero in the Garden game (their Sylvanas was UnicycleYay in game 3), so I think you are blending the two games. The two hero comparisons you want are therefore "Li-Ming and Ragnaros space" for Garden and "Sylvanas and Lunara space" for game 3 (Shrines).
- **Camps and structures were not what we led at the end.** Camps captured were 35 (us) to 34 (them), camp damage 5.3k to 5.7k a minute, structure damage 3.4k to 3.0k a minute in our favor. If we led early, it left no trace in the totals: the lead evaporated through fights and experience. I cannot see the timing.
- **Our tank and offlaner did their jobs on the map but not in the fights.** Blaze (63 rating) was our best rated player and took 84k damage, and Rehgar captured 10 camps. The two players who lost the fights were E.T.C. (6 deaths) and our fight damage (Tychus and Sylvanas 48k together against Qhira 53k alone).

**What we could have done in the draft (within our pool)**
- **Qhira and Anub'arak counters:** Icy Veins lists E.T.C. and Diablo as counters to Qhira, and Leoric, Varian and Valla (among others) as counters to Anub'arak. E.T.C. is the listed Qhira answer and still went 1/6/7 with a 47 rating here, so the listing alone is not enough. Varian (NorthrnTouch's 61% pool) or Leoric (SoulShepherd) answer Anub'arak, who is the hero Qhira, Tyrande and Li-Ming all pair with. These are guide matchups, not tested in our games.
- **Ragnaros:** Icy Veins lists Stukov, Chen, Garrosh, Lunara and Jaina as counters. **Stukov (Ltlbearista) and Chen (chelsi, 3-1, 5.2 kills a game)** are the in pool answers. Chen also counters Li-Ming. A Chen and Stukov Garden draft takes away their two clear and objective engines.
- **Tyrande** is countered by Anub'arak, Muradin, Zeratul, Maiev, Fenix and Lunara; **Muradin (NorthrnTouch, NGS 4-0)** is the one we play.
- **Ranged count:** we had three ranged heroes (Tychus, Sylvanas and Blaze, who counts as ranged on Heroes Profile). On Garden teams with three or more ranged heroes are 1-4 and teams with two or fewer are 3-0. CCS had two (Li-Ming, Tyrande). So this draft was in the losing bucket for the map before the first fight.
- **Consider banning Ragnaros or Qhira?** Ragnaros has been banned by nobody against CCS (we banned Johanna, Hammer, Sonya). If Garden is the map, **Ragnaros is a better ban than Sonya**, since it was the clear and experience engine that decided that game.

## 7. What to do about it (plans for the CCS series)
1. **Brightwing first.** Lock it with the early picks. If Brightwing is gone, take Rehgar only with a plan for the early game (we are 0-3 with Rehgar or Stukov against them).
2. **Bans:** Johanna and Lunara as in the cheat sheet, and add **Ragnaros on Garden**. Hunter's Sylvanas has never been on their ban list against us (they only banned it against Cosmos).
3. **Play the CCS losing formula back at them:** a tank with a stun (Varian, Muradin, Johanna if she is open), Brightwing, a ranged poker, a clearer who can stand up to ShadowDroid (Leoric, Blaze or Tassadar), and kill WitsEnd's Lunara or Tyrande first.
4. **Do not leave the tank alone in fights.** In our four losses to CCS NorthrnTouch died 2, 3, 6 and 5 times. If he picks Varian, ping Qhira when she shows; if Qhira is on the map, no one dives past our front.
5. **Do not copy the Cosmos Qhira bait without the carries.** Cosmos beats CCS with Anub'arak, Brightwing and a mage; the part we can use is that CCS dies more.
6. **Win by deaths:** CCS loses when each of their players dies 2 to 3 times more. Fight near our structures and our camps, and do not feed WitsEnd or ShadowDroid.

## Limits
- Eighteen CCS games, five Qhira games, six losses. The healer split is 9 games against 9, and CCS's opponents in the 9-0 group are mostly weaker teams.
- No timeline. I cannot see who led at 10 minutes, which fight started the snowball, or what Ragnaros was doing on the map. Your account of those parts stands.
- Counter lists come from Icy Veins guides, not from our data.
