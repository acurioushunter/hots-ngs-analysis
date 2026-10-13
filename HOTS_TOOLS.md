# HotS Tools: the master app

One page, `hots_tools.html`, that holds everything this repo builds for drafting, scouting and learning. It runs from a file with no server and no account. Send the single file (a zip is fine) to anyone.

## What is in it

| Section | For | Pages |
|---|---|---|
| Home | everyone | three paths, what is inside, how to read the numbers |
| Team Scout | teams | Draft room, Opponent prep, Scout any team, Counters, Review a draft, Meta, Open draft board, Team setup, Team profile |
| My Games | players | Import, Overview, Heroes, Maps, Habits, Pool coach |
| Learn | everyone | Start here, Hero guides, Hero ratings, Map guides, Map data, Drafting and strategy, Tips and glossary |
| About | everyone | sources, limits, privacy, reset |

The two older tools are inside it and still build on their own:
- **HotS Drafter** (`playbook/`, built by `build_playbook.py`): the NGS draft room. Pools, rules, opponent habits, series tracker, hero and map guides from Icy Veins.
- **Draft Lab** (`draftlab/`, built by `build_draftlab.py`): the league wide analysis. Hero matrix, archetypes, counters, meta, scouting, an open draft board and the draft review.

The shell (`hotstools/shell.*`) shows each of them in its own frame and owns the navigation, so neither app draws its own header when embedded. My Games (`hotstools/mygames/`) is native to the shell.

## How the pieces talk

- The shell builds each frame from a string with `srcdoc`. It sets `window.HOTS_EMBED`, `HOTS_APP`, `HOTS_TAB` and a `hotsPost` helper in the frame before the app loads.
- Shell to app: `postMessage({hots:1, type:'goto', tab})`, `{type:'hero', hero}` (Draft room), `{type:'profile', profile, name, use}` (Draft Lab), `{type:'theme', value}`.
- App to shell: `{type:'tab', tab}` when the app changes its own tab, so the page bar follows.
- The matrix and the games are stored once in the shell. The Draft Lab fragment leaves `/*__MATRIX__*/` and `/*__GAMES__*/` as placeholders (`draft_lab_embed.html`) and the shell fills them when it opens the frame. The draft room gets the league engine and the same data so it can give a style read and a Ratings tab.
- The theme is one set of tokens (`hotstools/shell.css`) injected into both frames after their own styles.
- Storage keys: `hots.*` (shell and My Games), `hdl.*` (Draft Lab), `ngs-draft-room-v2` (draft room). "Clear all saved data" on the About page removes them.

## Build

```
python build_hotstools.py --all      # builds the draft room, the Draft Lab and the master page
python build_hotstools.py            # only the master page (the two fragments must already be built)
python build_hotstools.py --personal # also the personal edition
node test_hotstools.js               # My Games engine and the built page (99 checks with the personal edition built)
node test_draftlab.js ; python test_playbook.py ; node test_engine.js   # the two apps as before
```

Outputs: `hots_tools.html` (tracked, stand alone) and `hots_tools_artifact.html` (the fragment for publishing, not tracked).

## The personal edition (not for sharing)

`python build_hotstools.py --personal` also writes `hots_tools_hunter.html` (and `hots_tools_hunter_artifact.html`). It is the same app with:
- the owner's whole Heroes Profile history (every mode, with replay ids) loaded in My Games, filtered to Storm League for the last year;
- Team Scout starting on Phoenix Rising Amethyst with the owner as `hunterstag`;
- the five player pools of the team as the profile on the open draft board, and the review page opening on the team.

It keeps its own storage (every key prefixed `hunter:`), so opening both editions from local files never mixes their saved data. Both files are git ignored. Do not send the personal one to anyone: it holds the owner's game history.

## Refreshing the data

1. NGS match pages from Heroes Profile: see `UPDATE_PLAYBOOK.md` (`build_ngs_season.py` for seasons 21 and 22).
2. The NGS replay export (the folders the NGS replay parser leaves, one per season, with `matches.ldb`, `hero.ldb` and others). Build the league database from both seasons:
   `python -I build_ngs_league.py 21="C:/Users/visio/Downloads/NGS-season-21" 22="C:/Users/visio/Downloads/NGS-season-22 (1)"`
   It writes `knowledge/ngs_league.db`, including a `lg_timeline` table: first kill, experience lead at 5, 10 and 15 minutes, first structure, first camp, level advantage, wipes, mercenary uptime.
3. `python -I build_league_export.py` merges the export, the Heroes Profile match pages and Heroes Lounge (`knowledge/heroeslounge.db`) into `knowledge/expert/league_games.json`. Games that only the match pages have are added, and the timeline columns ride along (columns 15 to 26).
4. `python build_hotstools.py --all`, then the tests, then publish `hots_tools_artifact.html` over the existing artifact link.

## My Games formats

Accepted by the importer: raw Heroes Profile `player/match/history` pages (one or several, pasted or as files), the HotS Tools export (`{"format":"hots-tools-games","games":[...]}`), and CSV with at least a hero and a result column. The in page snippet reads the history from the player's own Heroes Profile tab. It uses the same endpoint and body as our own pulls, and one request with that body was confirmed live on Oct 13 (200, 100 games a page). The paste and CSV routes work without it.

## Known limits

- Hero ratings (wave clear, camps and so on) are a draft matrix, mostly judgment. Every rating carries a source tag and can be overridden in the Draft Lab Heroes tab.
- The draft engine in the Draft Lab agrees only loosely with what real teams pick (the median real choice sits at about the 40th percentile of its list). The Review a draft page says so.
- Replay timelines exist for the NGS games in the replay export only. Heroes Lounge rows and games only the match pages have carry no timeline.
