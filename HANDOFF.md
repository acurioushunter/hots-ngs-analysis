# HANDOFF: Heroes of the Storm project for Hunter (Code session brief)

Read this first. Everything is in this folder. Follow Hunter's coding principles at the bottom.

## Who and what
- Hunter plays as hunterstag#1314 (BattleTag, HP player id 8186800) on Phoenix Rising Amethyst (PRA), Nexus Gaming Series (NGS) Division C West, Season 22 (6 teams).
- His role: roaming ranged assassin. Soaks the side lane the offlaner can't cover, then roams to gank the enemy offlaner. Pool: Junkrat, Sylvanas, Falstad, Hanzo, Cassia, Tychus, Raynor, Valla. Switches to Junkrat to anchor a lane (Dragon Shire, Towers of Doom). Plays Valla sticking near tank and healer.
- Teammates: damage player (Thrall, Tychus, Ragnaros, Chromie, Tassadar, Gul'dan, Sylvanas; sticks with tank and healer, can roam on Tychus), offlaner (Blaze, Leoric, Sonya), healer (Brightwing, Rehgar, Stukov, Malfurion), tank (Muradin, Johanna, Anub'arak, Stitches; NorthrnTouch is 4-0 on Muradin).
- He feels Falstad is not his best fit and wants alternatives for the roaming assassin role.
- Next match: Cosmos, Tue Oct 6 2026, 9:30 PM CDT (already scouted, report was delivered in chat).

## Goals for the next session (in priority order)
1. **Improve Hunter's Hanzo win rate.** Analyze individual performance (kills, takedowns, deaths, rating by game), map selection (Hanzo by map, both NGS and Storm League), draft conditions (first pick vs second, what comps and enemy heroes he wins or loses into, percent damage talent choice vs high health frontliners, teammate pairings, bans), and his talent builds. Compare to his other heroes and to other Hanzo players in the division. Output concrete rules: when to pick Hanzo, when not to, which maps, what to ask the team to draft around him.
2. **Build a Heroes of the Storm knowledge base from Icy Veins** (heroes, maps, general tier list, master tier list), saved to files and a database so questions can be answered from it later. Plan below.
3. **Keep and extend the NGS database** (Div C West S22) and a draft helper: for an opponent, give bans, picks, maps, comp style matchups, weak spots, and our best answers.
4. **Scout tough opponents**: Cosmos and Can't Counterpick Stupid (CCS), then Roll1 (R1E), Anomaly, Good Lordy. Also PRA's own strengths and weaknesses.

## What exists in this folder
| file | purpose |
|---|---|
| raw_games.txt | 53 games: `id|date|map|mm:ss|TeamA:F/M:W/L/TeamB:...|draft|players name~hero~rating~k~td~d|ok` |
| talents_raw.txt | `gameid|player~hero~code7,...` talent codes (letters, see below) |
| build_db.py | builds hots_s22.db (tables game, team_game, ban, pick, player_game) |
| report.py TEAM | per team report (maps, side, bans, picks, players by hero, losses); outputs pra_report.md, ccs_report.md |
| hero_tags.py | HEROES = {hero: (official role, [primary tag, secondary tag])}; tags poke, dive, engage, brawl, push, sustain, burst |
| comps.py TEAM | comp style classification and matchups; outputs pra_comps.md, cosmos_comps.md |
| hp_vs_pct.py | enemy high health hero (Stitches, Diablo, Muradin, Deathwing) vs our percent damage hero present |
| pct_talents.py | decodes which percent damage talents were taken, from Icy Veins slot order |
| hp_vs_pct_talents.py | same matchup question counting only talents actually taken |
| comp_styles_guide.md | general comp style notes (from general knowledge, not Icy Veins) |
| *_UNVERIFIED files | another AI's guides and slot spreadsheets. Proven wrong in places. DO NOT USE. |

Not saved to files, so re-pull: hunterstag's Heroes Profile pages (general, NGS, season 22, all NGS seasons, Storm League) and his NGS profile. These were read in chat only.

## Data facts and gotchas
- 53 games captured. Standings imply 59: six Good Lordy games are missing from Heroes Profile.
- Draft slot rules: first pick team bans slots 1, 3, 11 and picks 5, 8, 9, 14, 15. Other team bans 2, 4, 10 and picks 6, 7, 12, 13, 16. First pick team is the team that did NOT pick the map.
- Talent codes: 7 characters for tiers L1, L4, L7, L10, L13, L16, L20. Letter a = not taken, b = slot 1, c = slot 2, d = 3, e = 4, f = 5 (slots are 1 based in the in game order). Greymane codes can have only 6 characters followed by `-`, meaning L20 unknown (3 builds: games 23072, 23088, 23166).
- Heroes Profile match pages `https://www.heroesprofile.com/Esports/NGS/Match/Single/<id>` render client side. Reading `document.body.innerText` works. Output blockers: text that looks like cookies or query strings gets blocked, and output truncates near 1.4k characters, which is why codes are letter encoded.
- Cloudflare challenge on Heroes Profile: if a page returns a challenge, STOP and ask Hunter to pass it in his own Chrome. Never bypass it.
- Past transcription errors found: 23088 Vacuity Li-Ming kills (1 should be 6), 23032 MooseCannons (Muradin, not Anub'arak). Always validate pick vs player hero and re-check numbers.
- The shell cannot reach icy-veins.com or heroesprofile.com. Use the Claude in Chrome browser tools (or WebFetch for Icy Veins, which summarizes through a small model, so it is lossy for slot order). Do not close Hunter's own open tabs; open new ones.
- Official roles (Icy Veins): Gazlowe Bruiser; Tassadar Ranged Assassin; Stukov and Tyrande Healers; Abathur and The Lost Vikings Support.

## Verified percent damage talent slots (Icy Veins, slot = left to right)
Hanzo L16 slot 3 Giant Slayer (Hunter confirmed Hanzo order: L1 Q/W/auto = 1/2/3; L4 same; L7 Sharpened Arrowheads 3; L10 Dragonstrike 1, Dragon's Arrow 2; L13 Natural Agility 2, Mounted Archery 3; L16 Flawless Technique 1, Piercing Arrows 2, Giant Slayer 3; L20 Dragon Awakens 1, Play of the Game 2, Bullseye 3, Perfect Agility 4).
Greymane L10 slot 2 Cursed Bullet, L16 slot 3 Alpha Killer, L20 slot 2 Gilnean Roulette. Leoric L13 slot 3 Spectral Leech, L16 slot 1 Crushing Hope. Tychus L16 slot 2 Titan Grenade, slot 3 Sizzlin' Attacks (page from 2021, least reliable). Zul'jin L16 slot 1 No Mercy (only vs Grievous marked). Sylvanas L1 slot 3 Overwhelming Affliction (needs a slow, useless vs Deathwing). Valla L16 slot 3 Manticore.
Hunter's notes: Greymane has two percent damage abilities, Leoric can go drain life or auto attack build, Tychus may be bad into Deathwing (unverified), Zul'jin is not always percent damage, Sylvanas rarely takes L1 percent damage because W's L1 talent is best now. Icy Veins pages carry update dates and some lag the current patch (2.57), so store the date with every note.

## Findings so far (use as hypotheses to test)
- PRA is 12-8. By side: 6-2 when we pick the map, 6-6 on first pick. Maps: Garden of Terror 3-1, Tomb 3-0, Infernal Shrines 1-2, Towers of Doom 0-1, Braxis Holdout 0-1, Battlefield of Eternity 0-1.
- Opponents ban Junkrat against us most (12 times, we are 7-5). Thrall banned 5 times, we are 1-4 in those games.
- CCS is 12-6: Towers of Doom 4-1, 9-2 on first pick but only 3-4 when they pick the map.
- Cosmos loses to Muradin and Stitches comps (4 of 5 losses), is 0-2 with poke/siege comps, 3-4 vs high health frontliners, and has not banned Muradin or Stitches much.
- Across all teams, enemy high health hero present AND we had a percent damage talent actually taken: 8-7. No effective percent damage talent: 0-6. Only 15 games, treat as a hint.

## Plan for the Icy Veins knowledge base
- Scope: about 90 heroes x (strategy page + talent page), about 15 to 20 maps, the general and master tier lists. Roughly 220 pages.
- Do it with parallel helper agents, each taking a batch, writing one compact notes file per hero in a fixed format: role, abilities, strengths and weaknesses, counters and synergies, good maps, talent slots by tier, percent damage flags, source URL and page update date. Then merge into a folder plus a small database (tables hero, talent, map, tier_entry) and an index.
- Fetch pages in Chrome with a new tab; page text is returned in full, so write notes to disk immediately and never hold many pages in context.
- Save the final knowledge base somewhere permanent (Hunter's Google Drive or a published artifact) because the workspace is temporary.
- Flag stale pages (Tychus talents 2021) and treat slot orders from Icy Veins as the verified source, never the UNVERIFIED files.

## Hanzo analysis checklist
1. Pull all of Hunter's Hanzo games: NGS all seasons (HP and NGS profile), Storm League, current season. Win rate by map, side, comp style, enemy comp, enemy percent damage or high health heroes, teammates, game length, talent build, rating, kills, deaths.
2. Compare Storm League (more accurate comparison per Hunter) to NGS.
3. Compare to his other heroes (Junkrat, Sylvanas, Valla, Cassia, Tychus, Raynor, Falstad) and to other Hanzo players in Div C.
4. Check draft conditions: first pick vs second pick, whether bans land on Hanzo, tank and healer pairings, whether the enemy has dive, blind, or Deathwing.
5. Check talent choices against the slot table (Giant Slayer vs frontlines, etc.).
6. Produce a short list of rules and a map pick/avoid list.

## Hunter's coding principles (follow in all code)
DRY, KISS, YAGNI, single responsibility, small focused functions, clear names, guard clauses, fail fast, handle errors explicitly, write tests for important logic, least surprise, minimize side effects, prefer immutability, separate concerns, minimize dependencies, readability over cleverness, SOLID.
Writing style for messages to Hunter: no hyphens or em dashes in prose; he reads them as an AI giveaway.
