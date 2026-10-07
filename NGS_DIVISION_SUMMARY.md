# Division C West, Season 22: every game, bans and all

Source: the NGS match pages on Heroes Profile (esport NGS), saved one file per game in `knowledge/raw/ngs/matches/` (56 games, rounds 1 to 9). Built into `knowledge/ngs_div.db` by `build_ngs_division.py`, checked by `test_ngs_division.py` (it agrees with the older `hots_s22.db` on every winner, hero list and hero ban for the original 53 games).
Tables: `ngs_game` (map, length, winner, first and map pick team, round, game), `ngs_hero_ban` and `ngs_pick` (with slot and team), `ngs_map_ban` (per series), `ngs_player_game` (rating, kills, assists, takedowns, deaths, hero damage, siege, minions, camps, experience, talents).

## Why six games are missing
Good Lordy forfeited two matches: **round 1 v CCS** and **round 2 v Roll1Esports**. Forfeits have no games, which is the six games Heroes Profile never had. Everything else played through round 9 is here. Round 9 so far is only PRA v COSMOS.
Also: in game 2 of the Oct 6 match (23346) COSMOS meant to ban Johanna but missed the click, so the draft shows a skipped ban. PRA did not take advantage, so Johanna stayed unbanned and unpicked.

## Map ban habits (two bans per team per series, 23 series)
| Team | Series | Bans, most to least |
|---|---|---|
| **COSMOS** | 9 | **Alterac Pass 9 of 9**, Garden of Terror 5, Dragon Shire 4 |
| **CCS** | 7 | **Braxis Holdout 6**, Cursed Hollow 4, then one each of Tomb, Dragon Shire, Battlefield of Eternity, Alterac Pass. **Never Towers of Doom or Infernal Shrines** |
| **PRA** | 9 | Towers of Doom 6, Battlefield of Eternity 5, Volskaya 3, Braxis Holdout 3, Infernal Shrines 1 |
| Good Lordy | 6 | Tomb 6 of 6, Sky Temple 6 of 6 |
| Roll1Esports | 7 | Braxis Holdout 6, Garden of Terror 4 |
| Anomaly | 8 | Spread out (Towers of Doom 3) |
What teams ban against PRA: Tomb 3, Sky Temple 3, Braxis Holdout 3, Alterac Pass 3, Garden of Terror 2.
What teams ban against CCS: Alterac Pass 4, Sky Temple 3, Battlefield of Eternity 2.
What teams ban against COSMOS: Towers of Doom 4, Tomb 4, Braxis Holdout 4, Battlefield of Eternity 3, Infernal Shrines 2.

## Hero ban habits
| Team | Round one (slots 1 to 4) | Round two (slots 10 and 11) |
|---|---|---|
| **COSMOS** (21 games) | Stukov 7, Johanna 6, Junkrat 5, Lost Vikings 3, Garrosh 3 | Lunara 3, Stitches 2, Qhira 2, Leoric 2 |
| **CCS** (18 games) | Junkrat 5, Lost Vikings 4, Chromie 3, Zeratul, Valla, Thrall, Tassadar, Sylvanas 2 each | **Thrall 5, Tychus 3**, Valla 2, Chen 2, Anub'arak 2 |
| **PRA** (23 games) | Johanna 6, Anub'arak 6, Stukov 5, Falstad 5, Lost Vikings 4, Qhira 4 | Sgt. Hammer 5, Anduin 4, Stukov 3, Deathwing 3 |
Bans against PRA by all opponents: Junkrat 15, Tychus 6, Thrall 5, Chromie 5, Sylvanas 4, Stitches 4, Dehaka 4, Ragnaros 3.

## What it means for the final and the semifinal
- **CCS leaves Towers of Doom and Infernal Shrines alone,** and those are two of its best maps (4-1 and 2-1, and 2-0 when it picks). We ban both. They will probably ban Braxis Holdout plus Cursed Hollow or Alterac Pass, which are not maps we need.
- **COSMOS bans Alterac Pass every time,** so do not count on it. They have never banned Infernal Shrines (their 5-0 map), Tomb, Volskaya or Towers of Doom, so those are open for them to pick. We ban Infernal Shrines.
- **COSMOS bans Junkrat in round one half the time and Johanna 6 times,** so expect NorthrnTouch's Johanna to be contested.
