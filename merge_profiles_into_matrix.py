"""Overlay the deep hero profiles (knowledge/expert/hero_profiles) on the hero matrix (knowledge/expert/hero_matrix_draft.json).

The matrix feeds the Draft Lab (archetype classifier, hero pages, needs, counters), My Games (worth learning next, similar heroes) and the
Drafter kit lines. The profiles are the better source: written from the whole ability and talent text beside measured numbers, with the
owner's corrections applied. This script makes the matrix agree with them. It is idempotent: the first run keeps the old values under
`prior` (per hero) and later runs overlay again from the profiles, so it is safe to run before every build.

What changes per hero:
  role, range_class, dmg_profile, sub_role, comp_fit      from the profile (comp_fit mapped to the seven archetype names the Lab uses)
  ratings (wave_clear, camp_clear, teamfight, engage, peel, self_sustain, mobility, siege, objective_burst, ease_of_execution)  1 to 5, clamped
  extra (global_presence, solo_lane_viability, power_spike, vulnerable_to)
  new: labels (plain words), lenses (the lens values), owner_notes, profile_confidence, flex_roles
Run: python merge_profiles_into_matrix.py [--report]
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
MATRIX = ROOT / "knowledge" / "expert" / "hero_matrix_draft.json"
PROFILES = ROOT / "knowledge" / "expert" / "hero_profiles"

SHARED = {"wave_clear": "wave_clear", "camp_clear": "camp_clear", "teamfight": "teamfight", "engage": "engage", "peel": "peel",
          "self_sustain": "self_sustain", "mobility": "mobility", "siege": "siege", "objective": "objective_burst"}
EASE = {"low": 5, "medium": 3, "high": 2, "team_dependent": 3}
AFFINITY = {"poke_siege": ["poke", "wave clear siege"], "dive_burst": ["dive"], "sustain_teamfight": ["sustain/attrition"],
            "split_push": ["4 man push/split"], "pick_catch": ["pick"], "zone_control": ["deathball"], "global_macro": ["4 man push/split"],
            "anti_tank": ["pick"], "cheese": ["pick"]}
VULN = {"dive": "dive", "poke": "poke", "hard_cc": "stun", "stealth": "detection", "kiting": "kiting", "zoning": "zoning"}


def clamp(v):
    return max(1, min(5, int(round(v))))


def sub_role(p):
    L, role = p["lenses"], p["role"]
    hc = L.get("healer_class")
    if role == "Healer":
        return {"burst_single": "burst healer", "sustain_single": "sustain healer", "aoe_sustain": "aoe sustain healer", "shield_absorb": "shield healer",
                "hit_and_run": "mobile healer", "utility_support": "utility healer", "damage_fueled": "damage fueled healer", "aoe_burst": "aoe burst healer",
                "pre_placed": "zone healer"}.get(hc, "healer")
    fs, kp, dd = L.get("frontline_style"), L.get("kill_pattern"), L.get("damage_delivery")
    if role == "Tank":
        return {"initiator": "initiator tank", "anchor_peeler": "peel tank", "disruptor": "disruptor tank", "catcher": "catcher tank",
                "zone_controller": "zone tank", "brawler_sustain": "sustain tank", "dive_bruiser": "dive tank"}.get(fs, "tank")
    if role == "Bruiser":
        if L.get("lane_role") == "split_pusher" or fs == "split_pusher":
            return "split pusher bruiser"
        return {"dive_bruiser": "dive bruiser", "brawler_sustain": "brawler bruiser", "initiator": "initiating bruiser", "zone_controller": "zone bruiser",
                "disruptor": "disruptor bruiser"}.get(fs, "bruiser")
    if role == "Melee Assassin":
        return {"backline_dive": "dive assassin", "stealth_ambush": "stealth assassin", "flank_pick": "flank assassin", "cc_chain": "catch assassin",
                "attrition": "duelist assassin", "burst_snipe": "burst assassin"}.get(kp, "melee assassin")
    if role == "Support":
        return "utility support"
    if dd == "auto_attacker":
        return "marksman"
    return {"ability_caster": "burst mage" if L.get("damage_timing") == "burst_window" else "mage", "summoner": "summoner", "zone_trap": "zone mage",
            "channel": "channel caster", "hybrid": "hybrid damage dealer", "melee_brawler": "brawler"}.get(dd, "ranged assassin")


def dmg_profile(p):
    t = p["lenses"].get("damage_timing")
    if not p["damage"].get("carry") and p["lenses"].get("damage_delivery") == "utility_minimal":
        return "mixed"
    return {"burst_window": "burst", "execute_finisher": "burst", "sustained_dps": "sustain", "chip_poke": "sustain",
            "dot_stacking": "sustain", "ramp_up": "mixed"}.get(t, "mixed")


def labels(p):
    L, d = p["lenses"], p["damage"]
    out = [sub_role(p)]
    if d.get("ranged_dealer"):
        out.append("ranged damage dealer")
    elif d.get("carry"):
        out.append("melee damage dealer")
    t = L.get("damage_timing")
    out.append({"burst_window": "burst damage", "sustained_dps": "sustained damage", "chip_poke": "chip poke", "dot_stacking": "damage over time",
                "execute_finisher": "finisher", "ramp_up": "ramp up damage"}.get(t, ""))
    if d.get("heal_blunted", 0) >= 4:
        out.append("blunted by healing")
    if d.get("heal_blunted", 5) <= 1:
        out.append("kills through healing")
    if L.get("escape") == "none":
        out.append("no escape")
    if L.get("lane_role") in ("solo_laner", "split_pusher"):
        out.append("lane hero")
    seen, res = set(), []
    for x in out:
        if x and x not in seen:
            seen.add(x); res.append(x)
    return res[:5]


def main(report=False):
    m = json.loads(MATRIX.read_text(encoding="utf-8"))
    H = m["heroes"]
    diffs, n = [], 0
    for f in sorted(PROFILES.glob("*.json")):
        p = json.loads(f.read_text(encoding="utf-8"))
        h = p.get("hero")
        if h not in H or not isinstance(p.get("lenses"), dict):
            continue
        e = H[h]
        e.setdefault("prior", {k: e.get(k) for k in ("role", "sub_role", "range_class", "dmg_profile", "comp_fit")} | {"ratings": dict(e.get("ratings", {}))})
        r, ex = e.setdefault("ratings", {}), e.setdefault("extra", {})
        e.pop("ratings_contested", None)
        for src, dst in SHARED.items():
            new = clamp(p["ratings"].get(src, 3))
            old = e["prior"]["ratings"].get(dst)
            if old is not None and abs(old - new) >= 2:
                diffs.append((h, dst, old, new))
            if old is not None and abs(old - new) >= 3:
                # the two sources disagree by 3 or more: take the midpoint and flag it so a reviewer can look
                e.setdefault("ratings_contested", {})[dst] = {"matrix_before": old, "profile": new}
                new = clamp((old + new) / 2)
            r[dst] = new
        r["ease_of_execution"] = EASE.get(p["lenses"].get("execution_demand"), r.get("ease_of_execution", 3))
        ex["global_presence"] = clamp(p["ratings"].get("global_presence", 1))
        ex["solo_lane_viability"] = clamp(p["ratings"].get("solo_lane", 1))
        ex["power_spike"] = p.get("power_spike", ex.get("power_spike"))
        vu = [VULN[v] for v in p["lenses"].get("vulnerable_to", []) if v in VULN]
        if vu:
            ex["vulnerable_to"] = vu
        e["role"] = p["role"]
        e["range_class"] = p["attack"].get("range", e.get("range_class"))
        e["dmg_profile"] = dmg_profile(p)
        e["sub_role"] = sub_role(p)
        cf = []
        for a in p["lenses"].get("comp_affinity", []):
            for x in AFFINITY.get(a, []):
                if x not in cf:
                    cf.append(x)
        e["comp_fit"] = cf or e["prior"].get("comp_fit") or []
        e["labels"] = labels(p)
        e["lenses"] = p["lenses"]
        e["wants"] = p.get("wants_from_team", [])
        e["gives"] = p.get("gives_team", [])
        e["weak"] = p.get("weaknesses", [])
        e["good_into"] = p.get("good_into", [])
        e["bad_into"] = p.get("bad_into", [])
        e["heal_blunted"] = p["damage"].get("heal_blunted")
        e["profile_confidence"] = p.get("confidence")
        if p.get("owner_notes"):
            e["owner_notes"] = p["owner_notes"]
        if p.get("flex_roles"):
            e["flex_roles"] = p["flex_roles"]
        n += 1
    m["_profile_overlay"] = {"heroes": n, "note": "role, range, damage profile, sub role, comp fit and ratings come from knowledge/expert/hero_profiles; the matrix values before the overlay are kept under each hero's prior"}
    MATRIX.write_text(json.dumps(m, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"profile overlay on the hero matrix: {n} heroes, {len(diffs)} ratings moved by 2 or more")
    if report:
        for d in sorted(diffs, key=lambda x: -abs(x[2] - x[3]))[:40]:
            print("  ", d)
    return n


if __name__ == "__main__":
    main("--report" in sys.argv)
