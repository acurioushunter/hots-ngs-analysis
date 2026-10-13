# DraftLabEngine API

File: `draftlab/engine.js`. UMD module: `const E = require('./draftlab/engine.js')` in Node, global `DraftLabEngine` in the browser. No dependencies, no network, deterministic. Games and data objects are cached by array identity, so never mutate arrays returned by the engine; always call `filterGames` to get a fresh array.

## Conventions
- **Sides** are team indexes `0` and `1` (order of the two teams in a game row). In a live draft, `state.firstPick` says which index is team A (the side with first pick).
- **Rates**: `winRate` is raw wins / n (null when n is 0). `shrunk` is `(wins + 10 * 0.5) / (n + 10)`. Map splits and head to head use other centres, stated below.
- **Sample flags**: every data driven object has `n` and `low` (true when n < 8). Show "low sample" and the words "lean", not "rule".
- **basis** on components, needs and reasons: `'data'` (games or Icy Veins list data), `'kit'` (ability text scan), `'judgment'` (authored rating). Show it as a tag.
- **Argument order**: functions that need the hero matrix take `data` first, functions that only need games take `games` first.
- Hero names are exactly the matrix keys, for example `"Lúcio"`, `"Li-Ming"`, `"Anub'arak"`, `"The Lost Vikings"`.

## Constants (exported)
`PRIOR` (10), `MAP_PRIOR` (20), `LOW_N` (8), `ARCHETYPES` (array of 7 labels: `dive`, `poke`, `pick`, `sustain/attrition`, `4 man push/split`, `deathball`, `wave clear siege`), `SKILLS` (`['beginner','intermediate','advanced','pro']`), `WEIGHTS` (score weights, overridable per call with `opts.weights`), `MAP_PROFILES` (judgment: attributes each map rewards), `LIMITS` (array of strings for the "what the data cannot show" box).

## Data and filters

### `createData({ matrix, games })` returns `data`
`matrix` is the parsed `hero_matrix_draft.json`; `games` is the parsed `league_games.json` (array rows). Returns:
```
data = {
  heroes:    { "Jaina": { name, role, sub_role, dmg_profile, range_class, ratings:{...}, comp_fit:[...], extra:{...}, source:{...}, meta:{...}, ... }, ... },
  heroNames: [sorted names],
  games:     [game, ...],            // see below
  byHero:    { hero: [gameId,...] }, byTeam: { team: [gameId,...] }, byMap: { map: [gameId,...] },
  options:   { leagues:[{value,n}], seasons:[{value,n}], leagueSeasons:[{value:'NGS:21',n}],
               divisions:[{league,value,n}], maps:[{value,n}], teams:[{value,n}] },   // teams sorted by n desc
  matrixMeta: matrix._meta
}
game = { id, league:'NGS'|'HL', season:21, division, map, winner:0|1, firstPick:0|1|null, length(sec),
         teams:[t0,t1], picks:[[5],[5]] (pick order), bans:[[...],[...]], date, lvl10Lead:number|null,
         key:'NGS S21', arch:[primaryArchetypeSide0, primaryArchetypeSide1] }
```
Row count is never hard coded, so more Heroes Lounge rows can be added to `league_games.json` and everything follows.

### `filterGames(games, filters)` returns `game[]`
`filters = { leagues:['NGS'], seasons:[21,22], leagueSeasons:['NGS:21','HL:30'], divisions:['A'], maps:['Dragon Shire'], teams:['name'] }`. All keys optional; absent or empty means no restriction; keys combine with AND; values within a key combine with OR; case insensitive; `teams` matches either side. Use `leagueSeasons` for presets like "NGS S21 + S22 + HL S30".
```js
const sel = E.filterGames(data.games, { leagueSeasons: ['NGS:22'], divisions: ['Nexus','Heroic'] });
```

### `selectionInfo(games)` returns `{ n, byLeague:{NGS:n,HL:n}, level:'tiny'|'small'|'ok', message }`
`tiny` is under 30 games, `small` under 150. Show `message` next to "N games in selection".

## Shared helpers
- `shrink(wins, n, prior=10, center=0.5)` returns number.
- `rate(wins, n, center=0.5, prior=10)` returns `{ n, wins, winRate, shrunk, low }`.

## Hero and map statistics

### `heroStats(games)` returns `{ n, list, byHero }`
Each entry: `{ hero, n, picks, wins, winRate, shrunk, low, bans, pickRate, banRate, presence, avgPickOrder (1 to 5), openers (times picked first by a side) }`. Rates are fractions (0.25 = 25%) of games in the selection. `list` is sorted by presence (picks + bans) descending.

### `mapHeroStats(games, map)` returns `{ map, n, list, byHero }`
Same entry fields for games on that map, plus `overall` (hero's shrunk rate over all given games), `mapShrunk` (map win rate shrunk toward `overall` with prior 20), `delta` (`mapShrunk - overall`). Sorted by picks.

### `heroDetail(games, hero)` returns
`{ hero, stat (heroStats entry), bestMaps:[{map,n,wins,winRate,shrunk,low,delta}] (best delta first), archetypes:[{arch,n,wins,winRate,shrunk,low}], partners:[pairSynergy results, most games first, 10], bestPartners (n>=3, best lift, 5), bestAgainst, worstAgainst (heroVsHero results, n>=3, 5 each) }`.

### `heroTrend(games, hero)` returns `[{ key:'NGS S21', games, picks, wins, winRate, shrunk, low, bans, pickRate, banRate }]` sorted by key.

### `heroVsHero(games, a, b)` returns
`{ a, b, n, aWins, bWins, winRate, expected, shrunk, lift, low }`. `n` counts games where a and b were on opposite sides. `expected` is the log5 chance for a from the two heroes' own shrunk rates; `shrunk` pulls the head to head toward `expected` with prior 10; `lift = shrunk - expected` (positive means a does better than the heroes' base rates predict). `heroVsList(games, hero, minN=1)` returns the same objects against every opponent sorted by lift.

### `pairSynergy(games, a, b)` returns
`{ a, b, n, wins, winRate, expected (mean of shrunk rates), shrunk, lift, low }` for the two on the same team. `synergyList(games, hero, minN=1)` returns these for every partner sorted by lift.

## Compositions

### `archetypeOf(data, heroNames)` returns
```
{ primary, secondary (or null, when within 75% of primary), label ('dive' or 'dive / pick'),
  scores:{archetype: number}, ranked:[{arch,score}], rawScores,
  reasons:[{text, value, basis}] (for primary and secondary),
  needs:[need,...], missing:[need,...] (needs not ok), count, partial (true when under 5 heroes) }
```
`heroNames` may be 0 to 5 names (unknown names ignored). Empty input gives `primary: null`. Method: each hero votes for its `comp_fit` labels, team features add or subtract small amounts, then the roster average per hero is subtracted so a label means "more of this than a typical comp". Scores are therefore relative and can be negative.

### `compNeeds(data, heroNames)` returns `need[]` sorted by severity
`need = { key, label, status:'ok'|'thin'|'missing', severity (0 to about 1.2), have, target, note, basis }`. Keys: `wave_clear`, `camp_clear`, `engage`, `peel`, `objective_burst`, `siege`, `healing`, `cc`, `frontline`, `range`, `damage_mix`. Severity rises as slots fill and is 0 for an empty team.

### `compRead(data, games, names, enemyNames)` returns
`{ archetype (archetypeOf result), vulnerabilities:[{type,heroes,basis}] (vulnerable_to types shared by 2+ heroes), strongAgainst:[{arch,n,wins,shrunk,low}], weakAgainst:[...], versusEnemy: {enemyArchetype,n,wins,shrunk,low,mirror} | null, note }`. Strong means shrunk >= 52% in the selection, weak means <= 48%. Results, not causes.

### `readEnemy(data, games, state, side)` returns
`{ side, picks, archetype (label), count, clues:[{text,basis}], openNeeds:[{label,status,note,basis}], likelyNext:[{hero,score,n,low}] (5), note }`. Feeds the "what their picks mean" panel.

### `whatBeats(data, games, heroNames, { limit=10 })` returns
`{ archetype, archetypeAnswers:[{arch,n,wins,shrunk,low}] (archetypes facing this comp, best first), heroes:[{hero,score,n,low,components}], note }`.

### Archetype tables from games
- `archetypeStats(games)` returns `{ n, list:[{arch,n,wins,winRate,shrunk,low,share}], byArch }`. `n` counts side appearances (two per game).
- `archetypeMatchups(games)` returns `{ archetypes, table, list, n }`. `table[a][b]` is `{ a, b, n, wins, winRate, shrunk, low, mirror }` from a's side. Mirrors (`a === b`) count 0.5 wins per game and carry `mirror:true`; show them greyed.
- `archetypeByMap(games)` returns `{ [map]: { map, n, list:[{arch,n,wins,winRate,shrunk,low,share}] (best shrunk first), best } }`.
- `mapSummary(data, games, map)` returns `{ map, n, low, archetypes, winnerArchetypes:[{arch,wins}], topHeroes (12, heroStats-like with delta), bestDelta (n>=3), winningPairs:[{a,b,wins}], topBans:[{hero,bans,banRate}], profile (MAP_PROFILES entry or null), buildFor:{ map, profile, heroes:[{hero,role,fit,why,basis:'judgment'}], basis } }`. `buildFor` is the "build for this map" suggestion from matrix attributes and a judgment map profile.

## Draft formats and state

### `draftFormats()` returns `[{ id:'ngs', name, assumption, slots:[{type:'ban'|'pick', side:'A'|'B'}] }, { id:'free', name, assumption, slots:null }]`
NGS style assumption (show `assumption` in the UI): all six bans first (A, B, A, B, A, B), then picks A1, B2, A2, B2, A2, B1 (order A B B A A B B A A B). Team A is the side with first pick.

### State object (used by all recommend functions)
```
state = {
  map: 'Dragon Shire' | null,
  myTeam: 0|1,                // which side the user plays; default 0
  firstPick: 0|1,             // which side is team A; default 0
  picks: [[...],[...]],       // hero names per side, in pick order
  bans:  [[...],[...]],       // hero names per side; use '' for a skipped ban so slot counting stays right
  format: 'ngs'|'free'|formatObject,
  skill: 'beginner'|'intermediate'|'advanced'|'pro' | 1..4,
  profile: teamProfile | null,        // see normalizeProfile
  opponentTeam: 'team name' | null,   // optional; adds an Opponent habit component to bans
  side: 0|1|null,             // override the acting side (free form, or to ask about the other side)
  mode: 'pick'|'ban'|null     // free form only: what recommend() should return
}
```
`normalizeState(state)` returns the state with defaults filled.

### `nextSlot(state, format?)` returns
`{ done, free, index, type:'ban'|'pick'|null, side:0|1|null, sideLabel:'A'|'B'|null, number, label }`. Walks the format's slots and consumes the counts already in `state.picks` and `state.bans`. `done: true` when finished. Free form returns `{ free: true, type: null, side: null }`.

## Recommendations

### `recommendPicks(data, games, state, { limit?, weights? })` and `recommendBans(...)` return
```
{ kind:'pick'|'ban', side, slot (nextSlot result), sampleN (games used),
  items:[ { hero, role, score, components:[{name, value, note, basis, n?, low?}], n, low, winRate (shrunk), archetypeAfter? } ] }
```
`items` is sorted by `score` descending (ties by name). `score` equals the sum of component `value`s (rounded to 3 decimals). Heroes already picked or banned by either side are never listed. `n` is the hero's pick count in `games`; `low` is `n < 8`. Components may carry their own `n` and `low` (for example head to head games). Acting side is `state.side`, else the next slot's side, else `myTeam`. Value units are "points", about one percentage point of win rate.

Pick components (always all present, value 0 with an explanatory note when not applicable): Win rate (shrunk), Map fit (games), Map fit (attributes), Comp need, Counter value (games), Counter value (matchup lists), Synergy (games), Synergy (lists), Exposure to enemy tools, Pick risk, Skill level fit, Team pool, Archetype matchup (games).

Ban components: Strength (win rate shrunk), Contest rate, Map fit (games), Threat to my picks (games), Threat to my picks (lists), Fills their open needs, Opponent habit, My pool protection.

### `recommend(data, games, state, opts)` returns the pick or ban result for `nextSlot`; in free form it uses `state.mode` (default pick). Returns `{ kind: null, items: [] }` when the draft is done.

### Team profile
`normalizeProfile(profile)` accepts `{ pool: { "Valla": 3, "Muradin": 1 } }` or `{ players:[{ name, role, pool:[{hero, comfort} | 'Hero'] }] }`. Comfort 1 can play it, 2 comfortable, 3 best hero (string entries count as 2). Returns `{ pool, players, any }`. The Team pool component applies only when the acting side equals `myTeam`; with a loaded pool, a hero outside it gets a small penalty. `poolCoverage(data, profile)` returns `{ byArchetype:{arch:[{hero,comfort}]}, byRole:{role:[...]}, unknownHeroes, basis }`.

## Scouting and meta

### `scoutTeam(games, teamName)` returns
```
{ team, found, record:{n,wins,losses,winRate,shrunk,low,team}, byMap:[{map,n,wins,winRate,shrunk,low}],
  archetypes:[{arch,n,wins,...}], heroes:[{hero,n,wins,share,winRate,shrunk,low}] (by games played),
  bans:[{hero,n,share,low}] (their bans), bansAgainst:[...] (bans others used against them),
  firstPick:{ known, hadFirstPick, winsWithFirstPick, hadSecond, winsWithSecond, withFirst:rate, withSecond:rate },
  openers:[{hero,n,share,low}] (their first pick when they have first pick),
  losses:{ n, byMap:[{map,losses}], heroes:[{hero,losses}] },
  suggestedBans:[{hero,score,n,wins,share,low,why}],
  suggestedAnswers:{ mainArchetype, archetypes:[{arch,n,wins,shrunk,low}] (best against their main archetype), heroes:[{hero,n,wins,vs:[...],shrunk,low}] },
  note }
```
Matching is case insensitive on the team name. `listTeams(games)` returns `[{ team, n }]` by games played.

### `metaSummary(games)` returns
`{ n, selection (selectionInfo), topPicked, topBanned, bestWinRate, worstWinRate (n>=10), flexPicks:[{hero,picks,archetypes,spread}] (hero seen in 3+ archetypes at 20%+ each), firstPick:{n,wins,winRate,shrunk,low,note} (NGS only), lvl10:{n,wins,winRate,shrunk,low,ties,buckets:[{label,n,wins,winRate,shrunk,low}],note} (team that reached level 10 first, positive lvl10Lead means team 0), trends:[{key,n,topPicks,topBans}], avgLengthSec, maps:[{map,n,share}], archetypes, limits:[string] }`. Hero entries are heroStats entries.

## Example
```js
const data = E.createData({ matrix, games });
const sel = E.filterGames(data.games, { leagues: ['NGS'] });
const state = { map: 'Cursed Hollow', myTeam: 0, firstPick: 0, picks: [['Johanna'], []], bans: [['Tracer'], []], skill: 'advanced' };
const next = E.nextSlot(state);                    // { type:'ban', side:1, label:'Team B ban 1', ... }
const rec = E.recommend(data, sel, state, { limit: 8 });
rec.items[0];  // { hero:'...', score: 7.12, n: 54, low: false, components:[{name:'Win rate (shrunk)', value:3.2, note:'...', basis:'data', n:54, low:false}, ...] }
const read = E.compRead(data, sel, state.picks[0], state.picks[1]);
```
