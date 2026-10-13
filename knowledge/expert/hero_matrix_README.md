# Hero matrix (draft)
File: hero_matrix_draft.json, built by build_hero_matrix_draft.py from hero_matrix_data.py (authored table), playbook/library.json and hots_knowledge.db. 91 heroes, general purpose, not tied to one team.
Scale for all ratings: 1 poor, 2 below average, 3 average, 4 strong, 5 elite among all heroes. For ease_of_execution 5 means easy to play well.
Core fields: role (Icy Veins), sub_role, dmg_profile (burst, sustain, mixed), pct_damage (true if a base ability or talent deals percent of max Health to heroes, pct_damage_basis names them), range_class by auto attack (melee, short about 3 to 5, medium about 6, long 7 or more).
Ratings: camp_clear (solo mercenary camps), wave_clear (minion waves), teamfight (impact in 5v5), engage (starts or forces fights), peel (protects allies from dive), self_sustain, mobility, ease_of_execution, objective_burst (burns bosses, shrines and structures fast), siege (safely takes down towers and forts).
comp_fit: dive, poke, pick, sustain/attrition, 4 man push/split, deathball, wave clear siege. strengths_note and weaknesses_note: one sentence each.
Source tags (source object): every rating group has basis and confidence (low, med, high).
 kit: my keyword scan of ability text agreed with the rating (mobility, engage, self_sustain, camp_clear, wave_clear, objective_burst, siege) or the value was read from text (pct_damage, cc fields). Only counted when the scan is clear, so it is a weak proof.
 data: Heroes Profile patch stats (meta block: 2.57 and 2.57 plus 2.55) and Icy Veins matchup lists and tiers. These do not set kit ratings. confidence rests on sample size.
 judgment: my HotS game knowledge, used for everything else. Low confidence is set for odd kits (Medivh, Cho, Gall, Probius, Murky, Nova, Samuro, Lost Vikings, Abathur, Chen).
Extras (object "extra"), added at the coordinator's request:
 disengage_tools 1 to 5: tools to escape or stop a dive (anti dive).
 global_presence 1 to 5: roams the map or joins far fights.
 merc_camp_control 1 to 5: captures camps and bosses and makes siege camps matter.
 power_spike: early, mid (levels 10 to 13), late (20) or flat.
 build_dependence 1 to 5: how much the hero needs a specific talent build.
 mana_dependence 1 to 5: how fast a mana shortage hurts the hero.
 solo_lane_viability 1 to 5: can hold a lane alone.
 pick_risk: safe, medium or high risk if the pick goes wrong.
 skill_floor and skill_ceiling 1 to 5: ease of basic competence, and reward for mastery.
 ult_type: teamfight, pick, utility or defense, push or global, duel or dive.
 healer_dependence 1 to 5: how much the hero needs a healer to function.
 vulnerable_to: CC and effect types that hurt the hero most (stun, silence, blind, root, slow, displacement, kiting, dive, burst, poke, antiheal, percent damage, area damage, detection).
 cc_types_base_kit and cc_types_talent_only: CC types found in ability text, or only available through talents. cc_amount 0 to 5: number of abilities with hard CC (kit scan).
 stealth_or_cloak and grants_vision_or_reveal: booleans, judgment.
 objective_notes: short note on objective use (mounts, soak, turn ins, bosses).
 counters_per_icy_veins, countered_by_per_icy_veins, synergies_per_icy_veins: from the Icy Veins counter and synergy lists, lists are partial and one sided.
Caveats: Cho and Gall are one game hero (Cho'gall) so patch stats are shared. Ratings are a first draft for tuning, not measured values.
