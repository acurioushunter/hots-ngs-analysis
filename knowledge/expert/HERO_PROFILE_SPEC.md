# Hero profile spec (deep hero knowledge base)

Why: the old `ranged` flag came from Heroes Profile's attack type, so a ranged healer counted as a "ranged" damage dealer, and nothing said HOW a hero deals damage or how it meets the enemy healer. A profile is one JSON file per hero in `knowledge/expert/hero_profiles/<slug>.json`.

Sources an author may use: the hero's page dump (Icy Veins guide, abilities, every talent), the measured numbers given in the brief, and well established game knowledge. Say which in `evidence`. Never invent a number. If the text does not settle a field, give your best reading and put the field name in `unsure`.

Prose fields: plain words, no hyphens or em dashes (write "to", "and", commas). Hyphens inside hero and ability names are fine.

## Fields
```
{
 "hero": "Lunara",
 "slug": "lunara",
 "role": "Ranged Assassin",                    // Tank | Bruiser | Melee Assassin | Ranged Assassin | Healer | Support
 "attack": {
   "type": "ranged" | "melee" | "hybrid",       // hybrid: switches form or stance
   "range": "melee" | "short" | "medium" | "long",
   "autos_matter": 0-5,                         // how much of its damage and value comes from basic attacks (5 = Valla, 0 = Zagara style abilities only)
   "note": ""
 },
 "damage": {
   "carry": true | false,                       // is dealing damage its main job in a draft
   "ranged_dealer": true | false,               // TRUE only when it is a damage dealer who does most of it from range. Healers, supports and tanks are FALSE even though they shoot from range
   "style": ["sustained"|"burst"|"poke"|"dot"|"aoe"|"single_target"|"percent_health"|"siege"|"zone"|"execute", up to 3],
   "poke": { "rating": 0-5, "kind": "none"|"auto"|"skillshot"|"dot"|"zone"|"global", "dodgeable": 0-5, "note": "" },   // dodgeable 5 = easily avoided
   "heal_blunted": 0-5,                         // 5 = its damage is badly blunted by healing (spread chip damage, dots, small hits); 0 = it kills through healing (burst, percent health, execute)
   "note": ""
 },
 "healing": null | {                            // Healers, and any hero whose healing is a main job
   "style": ["single_target"|"aoe"|"shield"|"burst"|"hot"|"self"|"revive"|"mobility_buff"],
   "sustain": 0-5,                              // 5 = keeps a team alive through long chip damage and poke
   "burst_heal": 0-5,                           // 5 = can undo a burst combo
   "aoe": 0-5,                                  // heals many at once
   "range": "short"|"medium"|"long",
   "mana_pressure": 0-5,
   "positioning_risk": 0-5,                     // 5 = must stand in danger to heal
   "note": ""
 },
 "ratings": { "wave_clear":0-5, "camp_clear":0-5, "siege":0-5, "teamfight":0-5, "engage":0-5, "peel":0-5, "mobility":0-5, "self_sustain":0-5, "survivability":0-5, "objective":0-5, "global_presence":0-5, "solo_lane":0-5 },
 "cc": { "hard": ["stun","root","silence","knockback","pull","blind","polymorph","fear","sleep","suppress"...], "soft": ["slow"...], "reliability": 0-5 },
 "good_into": [ { "tag": "<tag>", "why": "" } ],      // up to 5. tags: low_sustain_healer, high_sustain_healer, single_target_healer, aoe_healer, no_healer_sustain, burst_dive, poke_comp, sustain_comp, tanky_frontline, squishy_backline, kiter, assassin, cc_heavy, stealth, immobile, mobile, melee_heavy, ranged_heavy, summons, structures, global_ult, split_push, objective_race
 "bad_into": [ { "tag": "<tag>", "why": "" } ],
 "wants_from_team": [ "" ],                       // up to 4, plain phrases
 "gives_team": [ "" ],                            // up to 4
 "power_spike": "early" | "mid" | "late" | "level_10" | "level_20" | "none",
 "weaknesses": [ "" ],
 "evidence": [ "ability or talent names, guide lines, or 'game knowledge'" ],
 "confidence": "high" | "medium" | "low",
 "unsure": [ "field names the text did not settle" ]
}
```
## Worked reading (Lunara, for calibration)
Ranged auto and ability damage dealer (`ranged_dealer` true, `autos_matter` 3), `style` [dot, poke, sustained]: Nature's Toxin stacks a damage over time on a target. `poke` 4, kind dot, `dodgeable` 2 (the stacks are applied by autos and the Blossom). `heal_blunted` 4 because the damage is a spread out dot that a strong AoE or sustained healer (Brightwing, Malfurion, Stukov, Lucio) undoes, while burst healers that heal single targets (Uther, Lt. Morales) are poor at it. So `good_into` low_sustain_healer and single_target_healer, `bad_into` high_sustain_healer, aoe_healer, burst_dive and kiter chasers (Illidan, Genji).

A ranged healer such as Brightwing has `attack.type` ranged but `damage.ranged_dealer` false and a `healing` block.
