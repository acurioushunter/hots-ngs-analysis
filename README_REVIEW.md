# HotS Tools: review package

Read this first. It is written for a reviewer who writes software and does not need to know the game.

## What it is
A draft and scouting tool for Heroes of the Storm competitive play (NGS, the Nexus Gaming Series). Hunter (hunterstag) plays on Phoenix Rising Amethyst in Division C West. The tool helps the team decide bans, picks, maps and comps against a specific opponent, and helps a player see their own results.

Open `hots_tools.html` in a browser. It is one file, no server, no account, no network calls. Everything is embedded: the data, the engine and the pages.

## Where to look
| Path | What it is |
|---|---|
| `hots_tools.html` | the built, shareable app (generated, do not edit) |
| `playbook/engine.js` | the draft engine: pick and ban scoring, comp checks, dossiers. Pure functions over one data object, tested with node |
| `playbook/app.html` | the Draft Room UI (vanilla JS, template strings) |
| `playbook/config/` | judgment the data cannot give: player pools (`our_team.json`), rules with reasons and evidence (`rules.json`) |
| `build_playbook.py` | builds `playbook/data.json` from the databases and the knowledge files, then the Draft Room pages |
| `hotstools/` | the shell that puts the Draft Room, the Draft Lab and My Games in one page, plus the My Games engine (`mygames/engine.js`) |
| `draftlab/` | the league wide analysis app (hero matrix, archetypes, counters, scouting) |
| `knowledge/expert/hero_profiles/` | one JSON profile per hero (91): how it deals damage, how healing meets it, what it is good and bad into, plus lens values |
| `knowledge/expert/lenses.json` | the catalog of lenses (the axes a draft is reasoned on) |
| `knowledge/expert/owner_hero_notes.md` and `owner_combos.json` | the owner's own game knowledge, kept in his words and applied as flagged corrections |
| `test_*.py`, `test_*.js` | the checks. All must print OK |

## Data sources (no data files are in this package)
- NGS match pages for seasons 21 and 22 (Heroes Profile), with drafts, bans and per player stats.
- NGS replay exports for seasons 15 to 22: about 8,250 drafted 5v5 games with takedown lists, timelines and per hero damage, healing, siege and crowd control seconds. Built into `knowledge/ngs_league.db` by `build_ngs_league.py`.
- Icy Veins hero guides, abilities, talents, maps and tier lists (`hots_knowledge.db`).
- Heroes Profile Storm League data for Hunter's own 4,700 games (personal edition only, not in this package).
The raw files and databases are left out on purpose: they are large and one holds the owner's game history.

## How the numbers are treated
- Sample sizes are shown next to rates. Most per map and per hero numbers rest on 2 to 12 games, so the wording is "lean", not "rule".
- League facts use a recency weight by season (half life 3 seasons, `season_weight` in `build_playbook.py`) and show the newest 3 seasons beside the weighted number. All replays are one game patch, so the season is the time unit.
- Rates that go into scoring are shrunk toward 50% for small samples.
- The tool separates "the numbers say" (measured) from "the hero kit suggests" (reading of ability text) from "Hunter's read" (the owner's judgment). The profile card labels the third.

## What was rebuilt this week, and why
1. The old ranged count used the game's attack type, so ranged healers counted as ranged damage dealers. Ranged now means a ranged damage dealer from the hero profile (31 heroes). League wide, 3 or more ranged damage dealers won 43% over 427 sides, zero won 54% over 215, one or two sit at 50%. The older division sized rules (written on 12 games) are retired.
2. Hero profiles for all 91 heroes, written by reading each hero's full ability and talent text beside measured per minute damage, healing, siege and damage taken, and checked against league win rates.
3. A heal lens: for damage dealing heroes, the record against each class of enemy healer. Measured first, with the profile's judgment as the fallback when the sample is thin.
4. Takedown pairs from the replay kill lists (kills with three or fewer heroes on them, as large fights put everyone on every kill).
5. A lens catalog (32 lenses in 8 families: damage, front line, kills, healers and supports, crowd control, map and macro, game flow, weaknesses) so drafts are not reasoned on healing and range alone. All 91 heroes are classified on it, with a note and a list of gaps where the catalog could not say something. The league association of each lens value with winning drafts is in `data.comps.lens_signal` and shown as the "Lens read" on the Our comp card (sustained damage heroes, chip poke, front line health and wave clear stand out; associations, not causes).

## How to run and verify
```
python build_playbook.py            # data.json + Draft Room (needs the databases, not in this package)
python build_hotstools.py --all     # the master page
python test_playbook.py ; node test_engine.js ; node test_hotstools.js ; node test_draftlab.js ; python test_hero_profiles.py
```
Without the databases you can still read the code, run `node test_engine.js` against the shipped `playbook/data.json`, and open the app.

## Known limits and open work
- Lens values were written from the profiles and measured stats with a spot read of the text, and several answers were forced to the nearest catalog value (see each profile's `lens_gaps`). New catalog values exist for those gaps; a reclassification of the forced ones is the next pass.
- Hero ratings (1 to 5) are mostly judgment from ability text. They are tagged by source, not measured outcomes.
- Healing blunting looks real for damage over time heroes (Lunara 54% into single target burst healers against 44% into AoE sustain healers, about 170 sides each) but does not separate damage dealers cleanly league wide. Treat it as a per hero lean.
- Hogger, Imperius and Xal'atath have thin ability text or no measured block, so their profiles are low or medium confidence and flagged.
- Observational data: a healer pick is correlated with the rest of the comp, so enemy healer effects are not clean experiments.
- Agents wrote the first pass of the hero profiles from text. The owner's notes override them where they differ and are marked as his.

## Privacy
This package contains no personal game history, no databases and no raw exports. The player names that appear are public NGS team rosters.
