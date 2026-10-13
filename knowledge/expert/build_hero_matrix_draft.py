"""Builds knowledge/expert/hero_matrix_draft.json from playbook/library.json, hots_knowledge.db and hero_matrix_data.py.
Run from the repo root: python knowledge/expert/build_hero_matrix_draft.py
Python stdlib only. Kit tags come from keyword scans of ability text (see README); everything else is judgment."""
import json, os, re, sqlite3, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_matrix_data import H

lib = json.load(open(os.path.join(ROOT, "playbook", "library.json"), encoding="utf-8"))["heroes"]
db = sqlite3.connect(os.path.join(ROOT, "knowledge", "hots_knowledge.db"))
roles = dict(db.execute("select slug,role from hero"))
verified = {r[0] for r in db.execute("select hero from verified_pct_talent")}
slug2name = {h["slug"]: n for n, h in lib.items()}
ROLE_LABEL = {"tank": "Tank", "bruiser": "Bruiser", "melee-assassin": "Melee Assassin",
              "ranged-assassin": "Ranged Assassin", "healer": "Healer", "support": "Support"}
KEYS = ["camp_clear", "wave_clear", "teamfight", "engage", "peel", "self_sustain", "mobility",
        "ease_of_execution", "objective_burst", "siege"]
COMP = {"D": "dive", "P": "poke", "K": "pick", "S": "sustain/attrition", "4": "4 man push/split",
        "B": "deathball", "W": "wave clear siege"}
SPIKE = {"E": "early", "M": "mid (levels 10 to 13)", "L": "late (level 20)", "F": "flat"}
RISK = {"S": "safe", "M": "medium", "H": "high risk"}
ULT = {"T": "teamfight", "P": "pick", "U": "utility or defense", "G": "push or global", "D": "duel or dive"}
LOW = {"Medivh", "Cho", "Gall", "Probius", "Murky", "Nova", "Samuro", "The Lost Vikings", "Abathur", "Chen"}
HIGH = {"Arthas", "Johanna", "Muradin", "Diablo", "Jaina", "Kael'thas", "Li-Ming", "Hanzo", "Valla", "Raynor",
        "Illidan", "Tracer", "Uther", "Malfurion", "Rehgar", "Brightwing", "Sylvanas", "Azmodan", "Nazeebo",
        "Zeratul", "Leoric", "Stitches", "E.T.C.", "Anub'arak", "Garrosh", "Thrall", "Tychus", "Lunara",
        "Auriel", "Li Li", "Falstad", "Kerrigan", "Jaina", "Junkrat", "Lúcio"}

CC_PATTERNS = {"stun": r"\bstun", "root": r"\broot", "silence": r"silenc", "knockback": r"knock", "pull": r"\bpull|drag",
               "fear": r"\bfear|\bsleep|polymorph|\btaunt", "blind": r"\bblind", "slow": r"\bslow"}
HARD = ["stun", "root", "silence", "knockback", "pull", "fear", "blind"]


def fix(name):
    return "Lúcio" if name.startswith("L") and "cio" in name else name


def base_conf(n):
    return "low" if n in LOW else ("high" if n in HIGH else "med")


def count_abilities(ab, pat):
    return sum(1 for a in ab if re.search(pat, a["text"], re.I))


PCT_RE = re.compile(r"\d+(\.\d+)?% of (the )?([\w']+ ){0,2}(maximum|max) Health", re.I)
PCT_MANUAL = {"Kharazim": ["Seven-Sided Strike"]}  # 7% of max Health per strike, sentence lacks the word damage
STEALTH = {"Zeratul", "Nova", "Valeera", "Samuro", "Tyrande"}
VISION = {"Abathur", "Probius", "Tyrande", "Zagara", "Medivh", "Gazlowe", "Lunara", "The Lost Vikings"}


def pct_basis(h):
    found = []
    for t in h["talents"]:
        for o in t["opts"]:
            for s in re.split(r"(?<=[.!?])\s+", o["text"]):
                if PCT_RE.search(s) and re.search(r"damage|burns", s, re.I) and not re.search(r"shield|absorb|barrier", s, re.I) \
                        and not re.search(r"heal(s|ing)? .{0,40}" + PCT_RE.pattern, s, re.I):
                    found.append(o["name"]); break
    for a in h["abilities"]:
        for s in re.split(r"(?<=[.!?])\s+", a["text"]):
            if PCT_RE.search(s) and re.search(r"damage", s, re.I) and not re.search(r"shield|absorb|barrier|heal", s, re.I):
                found.append(a["title"]); break
    return list(dict.fromkeys(found))


# reverse counter map: who each hero counters according to Icy Veins counter lists
countered_by, synergy, counters = {}, {}, {}
for slug, kind, other in db.execute("select slug,kind,other_slug from matchup"):
    if slug not in slug2name or other not in slug2name:
        continue
    a, b = slug2name[slug], slug2name[other]
    if kind == "counter":
        countered_by.setdefault(a, []).append(b)
        counters.setdefault(b, []).append(a)
    else:
        synergy.setdefault(a, []).append(b)

out, missing = {}, []
for raw_name, h in sorted(lib.items()):
    n = fix(raw_name)
    key = "Lúcio" if n == "Lúcio" else raw_name
    if key not in H:
        missing.append(raw_name); continue
    sub, dmg, rng, rat, comps, strength, weak, extra = H[key]
    ratings = dict(zip(KEYS, [int(x) for x in rat.split()]))
    assert len(ratings) == 10 and all(1 <= v <= 5 for v in ratings.values()), n
    ab = h["abilities"]
    conf = base_conf(key)
    cj = lambda: {"basis": "judgment", "confidence": conf}
    ck = lambda hi=False: {"basis": "kit", "confidence": "high" if (hi and conf == "high") else "med"}

    # kit cross checks on ratings
    mob = count_abilities(ab, r"dash|leap|jump|teleport|blink|vault|tunnel|\bfly|flies|flight|lunge|charge toward|Unstoppable|Movement Speed")
    eng = count_abilities(ab, r"stun|root|knock|\bpull|\bfear|sleep|taunt|silenc|polymorph|blind")
    sus = count_abilities(ab, r"heal|shield|absorb|armor|invulnerab|Unstoppable|untarget|restore")
    merc = count_abilities(ab, r"mercenar|camp")
    mini = count_abilities(ab, r"minion")
    struct = count_abilities(ab, r"structure|tower|fort|keep|gate")
    src = {"classification": cj(), "comp_fit": cj(), "strengths_weaknesses": {"basis": "kit", "confidence": "med"},
           "teamfight": cj(), "peel": cj(), "ease_of_execution": cj()}
    r = ratings
    src["mobility"] = ck() if (r["mobility"] >= 4 and mob >= 3) or (r["mobility"] <= 2 and mob <= 1) else cj()
    src["engage"] = ck() if (r["engage"] >= 4 and eng >= 3) or (r["engage"] <= 2 and eng <= 2) else cj()
    src["self_sustain"] = ck() if (r["self_sustain"] >= 4 and sus >= 4) or (r["self_sustain"] <= 2 and sus <= 1) else cj()
    src["camp_clear"] = ck() if r["camp_clear"] >= 4 and merc >= 3 else cj()
    src["wave_clear"] = ck() if r["wave_clear"] >= 4 and mini >= 5 else cj()
    src["objective_burst"] = ck() if r["objective_burst"] >= 4 and struct >= 5 else cj()
    src["siege"] = ck() if r["siege"] >= 4 and struct >= 5 else cj()

    pb = pct_basis(h)
    for x in PCT_MANUAL.get(key, []):
        if x not in pb: pb.append(x)
    pct = bool(pb)
    src["pct_damage"] = {"basis": "kit", "confidence": "high" if pct else "med"}

    # extras
    head, vul, objn = extra.split("|")
    t = head.split()
    ex = {
        "disengage_tools": int(t[0]), "global_presence": int(t[1]), "merc_camp_control": int(t[2]),
        "power_spike": SPIKE[t[3]], "build_dependence": int(t[4]), "mana_dependence": int(t[5]),
        "solo_lane_viability": int(t[6]), "pick_risk": RISK[t[7]], "skill_floor": int(t[8]),
        "skill_ceiling": int(t[9]), "ult_type": ULT[t[10]], "healer_dependence": int(t[11]),
        "vulnerable_to": vul.split(","), "objective_notes": objn,
    }
    ab_text = " ".join(a["text"] for a in ab)
    tal_text = " ".join(o["text"] for tt in h["talents"] for o in tt["opts"])
    kit_cc = [k for k, p in CC_PATTERNS.items() if count_abilities(ab, p)]
    tal_cc = [k for k, p in CC_PATTERNS.items() if k not in kit_cc and re.search(p, tal_text, re.I)]
    hard_n = sum(1 for a in ab if any(re.search(CC_PATTERNS[k], a["text"], re.I) for k in HARD))
    ex["cc_types_base_kit"] = kit_cc
    ex["cc_types_talent_only"] = tal_cc
    ex["cc_amount"] = 0 if hard_n == 0 else (1 if hard_n == 1 else 2 if hard_n == 2 else 3 if hard_n == 3 else 4 if hard_n <= 5 else 5)
    ex["stealth_or_cloak"] = key in STEALTH
    ex["grants_vision_or_reveal"] = key in VISION
    ex["counters_per_icy_veins"] = sorted(counters.get(raw_name, []))
    ex["countered_by_per_icy_veins"] = sorted(countered_by.get(raw_name, []))
    ex["synergies_per_icy_veins"] = sorted(synergy.get(raw_name, []))
    ex["extra_source"] = {
        "cc_types_base_kit": {"basis": "kit", "confidence": "med"}, "cc_types_talent_only": {"basis": "kit", "confidence": "med"},
        "cc_amount": {"basis": "kit", "confidence": "med"}, "stealth_or_cloak": {"basis": "judgment", "confidence": "high"},
        "grants_vision_or_reveal": {"basis": "judgment", "confidence": "med"},
        "counters_per_icy_veins": {"basis": "data", "confidence": "med"},
        "countered_by_per_icy_veins": {"basis": "data", "confidence": "med"},
        "synergies_per_icy_veins": {"basis": "data", "confidence": "med"},
    }
    for k in ["disengage_tools", "global_presence", "merc_camp_control", "power_spike", "build_dependence", "mana_dependence",
              "solo_lane_viability", "pick_risk", "skill_floor", "skill_ceiling", "ult_type", "healer_dependence",
              "vulnerable_to", "objective_notes"]:
        ex["extra_source"][k] = {"basis": "judgment", "confidence": conf}

    # meta from patch stats and tier list
    hp = h.get("hp") or {}
    now, deep = hp.get("now"), hp.get("deep")
    tiers = [x["tier"] + " as " + x["role"] for x in (h.get("tiers") or {}).get("general", {}).values()] if isinstance(
        (h.get("tiers") or {}).get("general"), dict) else []
    gm = (deep or {}).get("games", 0) or 0
    meta = {"patch_257": now, "patch_257_plus_255": deep, "icy_veins_tier_general": tiers}
    if not now or not deep:
        missing.append(raw_name + " (patch stats)")
    src["meta"] = {"basis": "data", "confidence": "high" if gm >= 1000 else ("med" if gm >= 300 else "low")}

    out[n] = {
        "role": ROLE_LABEL[roles[h["slug"]]], "sub_role": sub, "dmg_profile": dmg, "pct_damage": pct,
        "pct_damage_basis": pb, "range_class": rng,
        "ratings": ratings, "comp_fit": [COMP[c] for c in comps],
        "strengths_note": strength, "weaknesses_note": weak,
        "extra": ex, "meta": meta, "source": src,
    }

# prose check: no hyphens or em dashes in notes
bad = []
names = set(out) | {"E.T.C."}
for n, o in out.items():
    for f in ("strengths_note", "weaknesses_note", "sub_role"):
        s = o[f]
        for nm in sorted(names, key=len, reverse=True):
            s = s.replace(nm, "")
        if "-" in s or "—" in s or "–" in s:
            bad.append((n, f, o[f]))
    if "-" in o["extra"]["objective_notes"] or "-" in "".join(o["extra"]["vulnerable_to"]):
        bad.append((n, "extra", o["extra"]["objective_notes"]))
if bad:
    print("HYPHEN PROBLEMS"); [print(b) for b in bad]; sys.exit(1)

verified_miss = [v for v in verified if not out[slug2name[v]]["pct_damage"]] if all(v in slug2name for v in verified) else "slug mismatch"
doc = {"_meta": {"built": datetime.date.today().isoformat(), "heroes": len(out),
                 "scale": "ratings 1 (poor) to 5 (elite); see hero_matrix_README.md",
                 "notes": "Cho and Gall are one in game hero (Cho'gall) with two bodies; Icy Veins and Heroes Profile list them together, so their patch stats are shared."},
       "heroes": out}
path = os.path.join(ROOT, "knowledge", "expert", "hero_matrix_draft.json")
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("heroes", len(out), "missing", missing, "verified pct heroes not flagged:", verified_miss)
