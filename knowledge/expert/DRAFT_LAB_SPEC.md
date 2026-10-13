# Draft Lab: build spec (2026-10-08)

A general purpose Heroes of the Storm draft and meta tool, published as one self contained HTML artifact. Anyone can use it. It is NOT tied to one team: no hero names, team names or "our" wording in the core. A team can be loaded as an optional Team Profile (example profile for Phoenix Rising Amethyst is built from `playbook/config/our_team.json`).

## Voice and content rules (from the owner, Hunter)
- Prose has no hyphens used as dashes and no em dashes. Hyphens inside hero names (Li-Ming, Anub'arak), scores like 7-2, and words that need them are fine. Use commas, colons, periods.
- State sample sizes (n games) next to every data driven number. n under 8 is shown as "low sample", wording is "lean" not "rule".
- Separate "the numbers say" (from games) from "the hero kit suggests" (matrix, tagged kit) from "coach judgment" (tagged judgment). Do not claim a mechanism the data does not show.
- Do NOT write that any specific hero "is not ranged" or similar team specific quirks. Ranged is expressed with the matrix fields (range_class, dmg_profile burst or sustain, ratings).
- Honest uncertainty: the hero matrix is a draft, mostly judgment. Show the source tag and let the user override any rating (stored locally with try/catch around browser storage).

## Data (all inputs already on disk)
- `knowledge/expert/hero_matrix_draft.json`: 91 heroes. Fields in `hero_matrix_README.md` (role, sub_role, dmg_profile, pct_damage, range_class, ratings: camp_clear wave_clear teamfight engage peel self_sustain mobility ease_of_execution objective_burst siege, comp_fit list, notes, `extra` object with cc, power spike, pick_risk, skill floor/ceiling, counters_per_icy_veins and so on, source tags per group).
- `knowledge/expert/league_games.json`: compact game rows, about 2,000 to 3,500 games. Row = [league, season, division, map, winner(0/1), first_pick(0/1/null), length_sec, team0, team1, picks0[5], picks1[5], bans0[], bans1[], date, lvl10_lead0_seconds]. League is "NGS" (seasons 21, 22, all divisions: Nexus, Heroic, A, B East/West, C, C East/West, D) or "HL" (Heroes Lounge EU amateur, seasons 29 and 30, divisions "EU Div 1" to "EU Div 5"). first_pick is null for HL. Pick lists are in pick order within a team.
- Research notes (source tagged, rewrite lightly into the Learn tab): `meta_snapshot.md`, `draft_theory.md`, `map_strategy.md`, `concepts.md`, `hero_insights.md`, `data_findings.md` (one division only, background).
- Maps: take the list from the games data.

## Filter bar (global, every analysis tab uses it)
League (NGS, HL) and Season, Division: all multi select with chips, quick presets ("Everything", "NGS latest season", "Low divisions only"). Always show "N games in selection" and warn when small. Optional map filter. Filters can be combined, e.g. NGS S21 + S22 + HL S30.

## Tabs
1. **Draft**: the live draft board. Pick map (or "unknown map"), pick which side is "my team", enter bans and picks for both sides in order (click hero search, tap to place, undo, reset). Format selector with the NGS style default (3 bans each, A1, B2, A2, ... assumption documented in the UI) and a free form mode. Shows: next up suggestions for picks and bans with a clear score breakdown per suggestion (win rate shrunk toward 50%, map fit, comp need, counter value, synergy, pick risk, optional team pool and skill setting), comp read for both sides (archetype, what it is strong or weak against, missing pieces: wave clear, camp clear, engage, peel, healing, CC, burst or sustain damage), and a "what their picks mean" panel. Skill setting (Beginner to Pro) reweights ease_of_execution and risk. Copy summary button.
2. **Maps**: every map: what comp archetypes win there in the selected data (n shown), most common winning comps, objective and rotation notes from `map_strategy.md`, wave clear and camp clear priorities, and a "build for this map" suggestion built from matrix attributes.
3. **Counters**: archetype versus archetype win rate matrix from the data (n, low sample flags), hero versus hero lookups, "what beats this comp" for a comp the user enters, plus plain language why (kit suggests) kept separate from the numbers.
4. **Heroes**: searchable and filterable hero browser: role, sub role, burst/sustain, range class, all ratings as bars with source tags, extras, counters and synergies, pick rate, ban rate, win rate in the selection, best maps, common partners. Sort by anything. Compare two or three heroes side by side. Rating overrides editor.
5. **Meta**: pick, ban and win rates for the selection, top bans, flex picks, first pick pressure, trends across selected seasons, first pick team win rate (n), time to level 10 lead versus winning (n), and what the selected data cannot show.
6. **Scout**: pick any team name in the selection and see its record, favourite maps and comps, signature heroes, first pick and ban habits, where it lost, and suggested bans and answers against it, always with n.
7. **Team**: optional Team Profile: player names, roles, hero pools (comfort levels). Import and export as JSON. Feeds Draft suggestions and shows pool coverage versus archetypes. Includes a load example button.
8. **Learn**: draft theory, concepts, hero insights, glossary of the attributes, and how to read the tool. All with source tags.
9. **About**: data sources, what is measured versus judged, sample size warning, dataset sizes, last built date, known limits.

## Engine rules
- Pure JS in one module usable by Node tests and the page. Deterministic. No network at runtime.
- Win rate shrinkage toward 0.5 with a prior of about 10 games. Always return n and a low sample flag (n < 8).
- Archetype classifier from matrix fields (comp_fit votes, engage, peel, wave_clear, range_class, dmg_profile, pct_damage), documented and tested; it returns primary archetype, scores, reasons and missing pieces.
- Recommendation score is a transparent sum of named components, each returned so the UI can show them.
- Every function takes the filtered game list as a parameter.

## Design
Follow the `artifact-design` skill (load it before writing the page): tokens on :root with dark mode, readable on phone width with a 16px gutter, no horizontal page scroll, one self contained HTML file under the size limit, no external scripts unless pinned to an allowed CDN version. Hero art is not available: use role coloured chips with initials. Keep it fast with about 3,000 games and 91 heroes.
