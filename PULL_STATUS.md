# Data pull status and how to resume

Last updated 2026-10-06.

## Done
| Data | Where | Notes |
|---|---|---|
| Icy Veins: 91 heroes, 15 maps, 19 tier lists, 15 general guides | `knowledge/raw/`, `knowledge/hots_knowledge.db` | Complete |
| hunterstag Heroes Profile, all game types and Storm League only | `knowledge/raw/hunter/hp/`, `knowledge/hunter_hp.db` | 4,735 games in the match history |
| NGS Div C West season 22: 6 teams, 38 players, each player all time plus seasons 20, 21, 22 | `knowledge/raw/ngs/`, `knowledge/ngs.db` | Complete |
| Storm League overview, hero, map, role stats and seasons 32 to 34 hero stats for 16 other players | `knowledge/raw/players_hp/` | See below |

Players finished in `players_hp`: Tauros, HarkinEH, MooseCannons, TebbyBear33, Korosive, Mosley, SilverJackal, Icon, Nae, oddthought, Imbuement, Valkamer, UnicycleYay, ultear, WitsEnd, ShadowDroid.

## Still to do (Heroes Profile stopped answering with a Cloudflare challenge after about 130 requests)
1. **Storm League pulls for 21 players:** Jaws (3 of 8 files done), Zephy, Hiscabibbel, YataGarasu, Edawg187, Batlin, moon, Xylophone, Cymfonique, OnyxBat, Grombri, Ltlbearista, SoulShepherd, chelsi, NorthrnTouch, R1EZad, R1ERockYourW, R1EJuaneba, Shadowleaves, Vacuity, Xehlyv. Four of these are on PRA (Ltlbearista, SoulShepherd, chelsi, NorthrnTouch).
2. **hunterstag Storm League talents** for 10 heroes that hit the rate limit: Tassadar, Thrall, Tychus, Tyrael, Valla, Varian, Xul, Yrel, Zarya, Zul'jin. Valla and Tychus matter most.
3. **Compact database for `players_hp`** (a `build_players_hp.py` plus test, same style as `build_hunter.py`). Do this after step 1.
4. If usage is tight, skip steps 1 and 3 for non PRA, non upcoming opponents. The NGS data is the most relevant and it is complete.
5. Seasons 20 and 21 of the other NGS divisions, and the six missing Good Lordy games, are not pulled.

## How to resume
1. In your own Chrome, open https://www.heroesprofile.com and pass the Cloudflare check yourself. Never bypass it.
2. Start the receiver: `python receiver.py` (writes only under `knowledge/raw/`).
3. Open a Heroes Profile tab, allow the local network pop up once, and paste `scripts/hp_pull_players.js` into the console after editing its `PL` list to the remaining players. It makes one request about every 2.5 seconds, stops on a challenge, and backs off on rate limits.
4. Rebuild: `python build_knowledge.py`, `python build_hunter.py`, `python build_ngs.py` and run the three `test_*.py` files. All must print OK.
5. Stop the receiver when done.

## Heroes Profile API notes (learned the slow way)
- Player endpoints are `POST /api/v1/player`, `player/heroes/all`, `player/maps/all`, `player/roles/all`, `player/matchups`, `player/talents` (needs `hero`), `player/match/history` (needs `pagination_page`, 100 games a page), `player/friendfoe` (type `friend` or `enemy`). Some return 202 with a `job_id`; poll `GET /api/v1/global/status/<job_id>`.
- Body fields: `battletag, blizz_id, region, game_type (list: qm ud hl tl sl ar), hero, role, game_map, minimumgames, type, page, season, start_date, end_date`. Storm League season ids: 34 is 2026 Season 3, 33 is Season 2, 32 is Season 1.
- NGS endpoints are `esports/ngs/division/single` (`division`, `season`), `esports/single/team` and `esports/single/player` (`esport:"NGS"`, `division`, `team` or `battletag` and `blizz_id`, `season`, `series`, `tournament`).
- Do not guess request bodies in a burst. That is what triggered the first Cloudflare challenge. Record the page's own request in a hidden frame instead.
