"""Apply Hunter's hero notes (knowledge/expert/owner_hero_notes.md, his words) to the hero profiles.

Writes, for each hero he described:
  - profile["owner_notes"]: his read, cleaned into plain sentences (his judgment, not measured data)
  - role / carry / ranged_dealer / healing score corrections where his note settles what an earlier reading guessed
  - profile["owner_corrections"]: what was changed and why, so a reviewer can see it
Rerunnable: it always starts from the profile as it is and rewrites only the keys named here.
Run: python apply_owner_notes.py   then python build_playbook.py and the tests.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PROFILES = ROOT / "knowledge" / "expert" / "hero_profiles"

NOTES = {
    "cho": "Cho and Gall are one hero in game played by two players. Cho is the bruiser half.",
    "gall": "Gall is the ranged assassin half of Cho and Gall.",
    "blaze": "Blaze plays as a bruiser (offlaner), not a tank.",
    "diablo": "A tank who is built to catch people and get kills, not only to hold the front line.",
    "garrosh": "A tank who is built to catch people and get kills, not only to hold the front line.",
    "hogger": "A bruiser. Needs a look in Chrome when sessions are back.",
    "imperius": "A bruiser. Needs a look in Chrome when sessions are back.",
    "dehaka": "A bruiser who clears waves and offlanes before the objective to pull the other offlaner away, then burrows into the objective with the team and turns a 4v4 into a 5v4 with his global. If the other offlaner does not contest him he keeps pushing while the team stalls, and it is better still when a camp is timed to push with him.",
    "deathwing": "A bruiser, often taken in the 4 man as a damage dealer. Pick him when the other team has no percent damage hero and when they have a pick comp: he cannot be stunned, so he wrecks those comps. A strong late pick in the right situations.",
    "dva": "A bruiser. Soaks lanes, controls points with her bombs, and disrupts fights with Bunny Hop.",
    "varian": "A tank if he takes Taunt at level 4. A bruiser or melee assassin if he takes Twin Blades or Colossus Smash at 4. Has an anti heal talent.",
    "thrall": "A bruiser or melee assassin with decent sustain and damage. Slower than Sonya at clearing waves and taking or defending camps.",
    "sonya": "A good brawler bruiser like Thrall, better at wave clear and camps. High burst, and can jump the enemy backline with Leap, a good hero for combos behind a CC chain (Light bomb). Her other heroic gives more sustain. When the enemy has no CC her spin can deal decent damage and sustain through a lot of fights.",
    "malthael": "A bruiser who is great at camps, double soaking and fighting high health heroes. In team fights he can sustain enough to kill a team if they lack CC to pin him and have no healing reduction. Very weak to CC plus burst damage and to reduced healing, and has no CC or escape.",
    "ragnaros": "A bruiser who soaks lanes well. His trait defends against a strong push or stalls near the objective. His heroic Smash does huge damage when set up with CC, and Lava Wave can clear a heavy push. Good on most wave clear maps, but on Tomb of the Spider Queen clearing waves with Lava Wave loses the gems. Low health and no escape, so he loses to other bruisers that can CC him or out sustain him.",
    "hanzo": "Lots of poke damage from a mix of spells and autos. Minions and summons can block his abilities, and he depends on skillshots. Can jump terrain to escape in many situations, but high mobility dive heroes like Zeratul or Genji kill him easily. Dragon Arrow is an engage in big team fights or a disengage, best at choke points or on clumped teams. Low health. Weak at camps and wave clear, but the level 4 W talent gives decent objective or boss damage.",
    "junkrat": "A poke and sustain damage hero with little burst outside RIP Tire. His job is disrupting the enemy and controlling areas with W bombs and E traps. Good escape, wave clear and camp clear. No percent damage and not a fast boss clear. A solid hero on certain maps and comps.",
    "kel-thuzad": "A high skill floor burst mage who does best with easy CC to set up his combos. Massive burst, but no escapes and the combos are hard to land, so he is not popular.",
    "lunara": "A sustain damage hero with little burst who kites and pokes with a slightly higher move speed in lane and ranged autos. Cannot mount, so she is stuck at her own speed. Great into low sustain supports like Uther because her poison on many people outruns his healing and mana. Against healers like Brightwing the steady healing negates her damage.",
    "orphea": "A burst mage at medium range with a high skill ceiling: she has to get close and is weak when she misses her Q. A lot of damage, some boss and area control. Her heroic resets if it hits a hero, which works well with a CC heroic such as E.T.C. Mosh Pit or Leoric Entomb.",
    "sgt-hammer": "A ranged sustain damage hero who can siege from very far. Susceptible to dive and to long range poke from heroes like Tassadar, Chromie and maybe Li-Ming. If the other team does not draft to kill her she destroys buildings and dominates team fights, but she depends on draft and positioning because she cannot reposition quickly and can be locked down by CC when her unstoppable shield talent or trait is down or interrupted.",
    "nazeebo": "A sustain damage mage with some burst from Ravenous Spirit or the spider build. No escape except a late talent Ice Block that only delays. Depends on skillshots, weaker in competitive play and stronger against uncoordinated teams. Good at wave clear and camp clear.",
    "probius": "Setup dependent because he needs Pylons around him. Dies to dive or CC and is weaker in the current meta.",
    "nova": "A burst ranged assassin focused on pick kills. Weak without much sustain, but strong when the player is good and ganks the offlaner or vulnerable heroes.",
    "genji": "A dive burst assassin who bursts down a vulnerable backline. Escapes well, but is susceptible to CC and has low health.",
    "falstad": "A sustain damage hero with a global trait. Side lanes and stacks the level 1 auto quest. With stacks he does a lot of damage and gets a late game percent damage auto trait. Can go W but gets caught when the enemy has CC to punish it, or Q for poke damage.",
    "fenix": "A medium range sustain damage hero. Can solo like Raynor but is often in a 3 or 4 man, where he catches waves and ganks like Sylvanas, Raynor or Greymane.",
    "azmodan": "A burst ranged damage hero who sieges structures well. Cooldown dependent: big burst, then not much damage. No escapes.",
    "valeera": "Like Nova she looks for isolated picks and ganks. Can be good, but struggles against coordinated teams unless the player times engages very well. Weaker in team fights and stronger in the laning phase.",
    "illidan": "A dive melee assassin with decent sustain who dives backlines hard but is weak to CC. A lane bully against many heroes with a high skill ceiling.",
    "samuro": "High skill ceiling. Offlanes well and later double soaks. Hard to kill, which is his strength: he pulls attention from objectives so the team can take them, and wastes the enemy's time if they send people to gank and he still escapes.",
    "murky": "A split pusher with a low death timer when his egg is safe. Octo Grab can pick people. Like Samuro he wants to push side lanes and does best with siege and structure damage while pulling attention and escaping. Struggles against Ragnaros and others who can kill him for stacks or quests, or kill his W so it does not trigger.",
    "stukov": "A healer who mixes sustain and burst healing but excels at neither. His strength is the AoE channelled silence. No solid escape beyond Swipes to push people back, and dive can focus him when the team has no front line. Drafted with taunt Varian or another easy to hit CC tank, he silences under the target and the team bursts the taunted target with a ranged assassin like Jaina, whose damage is quick and not blocked by minions or heroes (Greymane, Li-Ming, Kel'Thuzad, Kael'thas also work). It fails when the other team can save the target: Anduin's pull counters it, and so do Medivh or Uther Divine Shield or Tyrael's invulnerability. Cleanses help, but the silence can still get kills when the target is cleansed.",
    "tyrande": "A sustain healer who has to auto attack to lower her heal cooldown, so she depends on being able to auto safely. Often picked as a follow up to a CC tank to focus a single target with burst ranged damage or a melee assassin.",
    "whitemane": "Strong at the moment. No CC and no escape herself but high burst healing. She has to damage heroes to increase the heals on her Q targets. Weak to tanks that pull or separate her from her team (Stitches, Garrosh, Diablo). Mixed against dive: she survives it if she can damage them to do massive burst healing. Takes skill and positioning, and since she has little CC it is good to draft it in the tank and maybe the offlaner.",
    "rehgar": "Okay heals, nothing massive until Ancestral Healing, which is on a long cooldown. Good at camps and wave clear. His totem slows. His trait cleanses an ally or slows an enemy on a long cooldown, cannot be used on himself, and he has no escape. Good if the team lacks wave clear, weak elsewhere. A decent healer overall.",
    "lucio": "A good healer without great healing numbers but solid sustain. Can pick the shield heroic against burst or High Five to cleanse CC. High skill floor and ceiling. Played well he disrupts rotations and is hard to kill thanks to mobility, but heroes like Diablo can stun him on walls while he is wall riding.",
    "kharazim": "Good for dive comps since he has a lot of burst damage. High skill ceiling and not much healing if he cannot auto things.",
    "li-li": "Okay sustain healing with a cleanse and no escapes. Solid in low ranks, not as effective in high rank or competitive play.",
    "auriel": "Needs to damage people, or a teammate with her trait on has to deal damage, to fill her heals. Decent damage and sustain heal in some comps and weak in others. No solid escape.",
    "ana": "Her anti heal grenade is a key tool.",
    "johanna": "Has an anti heal talent.",
}

# role as Hunter plays and drafts them (a bruiser is not a tank). Data side uses playbook/config/our_team.json role_override.
ROLE = {"cho": "Bruiser", "blaze": "Bruiser", "hogger": "Bruiser", "imperius": "Bruiser", "dva": "Bruiser", "deathwing": "Bruiser",
        "thrall": "Bruiser", "varian": "Bruiser", "sonya": "Bruiser", "gall": "Ranged Assassin"}
FLEX = {"varian": ["Tank (with Taunt at level 4)", "Melee Assassin (Twin Blades or Colossus Smash at 4)"],
        "thrall": ["Melee Assassin"], "dehaka": ["Offlaner who pulls the other offlaner away"]}
CARRY = {"deathwing": True, "thrall": True, "sonya": True, "orphea": True}
# his note settles the attack reach: Orphea is a medium range burst mage, so she is a ranged damage dealer
RANGED_DEALER = {"orphea": True, "cho": False, "gall": True}   # Cho is the bruiser half, Gall the ranged half
HEALING = {   # sustain, burst_heal, aoe overrides (0 to 5). Stukov: mix, excels at neither.
    "stukov": dict(sustain=3, burst_heal=3),
    "tyrande": dict(sustain=3),
    "whitemane": dict(burst_heal=5, sustain=3),
    "rehgar": dict(burst_heal=3),
}
LENS_FIX = {   # his notes settle a lens value an agent had to guess
    "junkrat": {"escape": "strong"},
    "deathwing": {"anti_cc": ["unstoppable"]},
    "diablo": {"frontline_style": "catcher"},
    "garrosh": {"frontline_style": "catcher"},
    "blaze": {"lane_role": "solo_laner"},
}
TAG_ADD = {   # extra good_into or bad_into entries from his notes
    "deathwing": ("good_into", "cc_heavy", "Cannot be stunned, so pick comps and CC chains do little to him (owner note)."),
    "stukov": ("bad_into", "burst_dive", "Dive can focus him when the team has no front line (owner note)."),
}


def set_bodies():
    """Lens "bodies": one for almost everyone, two_player for Cho and Gall, multi_body for pets and summoned bodies that play as units."""
    special = {"cho": "two_player", "gall": "two_player", "the-lost-vikings": "multi_body", "rexxar": "multi_body"}
    for f in sorted(PROFILES.glob("*.json")):
        p = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(p.get("lenses"), dict):
            p["lenses"]["bodies"] = special.get(p.get("slug"), "one")
            f.write_text(json.dumps(p, indent=1, ensure_ascii=False), encoding="utf-8")


def main():
    changed = 0
    for slug, note in NOTES.items():
        f = PROFILES / f"{slug}.json"
        if not f.exists():
            print("no profile for", slug)
            continue
        p = json.loads(f.read_text(encoding="utf-8"))
        corr = []
        p["owner_notes"] = note
        if slug in ROLE and p.get("role") != ROLE[slug]:
            corr.append(f"role {p.get('role')} to {ROLE[slug]}")
            p["role"] = ROLE[slug]
        if slug in FLEX:
            p["flex_roles"] = FLEX[slug]
        if slug in CARRY and p["damage"].get("carry") != CARRY[slug]:
            corr.append(f"damage.carry to {CARRY[slug]}")
            p["damage"]["carry"] = CARRY[slug]
        if slug in RANGED_DEALER and p["damage"].get("ranged_dealer") != RANGED_DEALER[slug]:
            corr.append(f"damage.ranged_dealer to {RANGED_DEALER[slug]}")
            p["damage"]["ranged_dealer"] = RANGED_DEALER[slug]
            if RANGED_DEALER[slug] and slug == "orphea":
                p["attack"]["range"] = "medium"
            if not RANGED_DEALER[slug]:
                p["attack"]["type"] = "melee" if slug == "cho" else p["attack"].get("type")
        if slug in HEALING and p.get("healing"):
            for k, v in HEALING[slug].items():
                if p["healing"].get(k) != v:
                    corr.append(f"healing.{k} {p['healing'].get(k)} to {v}")
                    p["healing"][k] = v
        if slug in TAG_ADD:
            key, tag, why = TAG_ADD[slug]
            if not any(x.get("tag") == tag for x in p[key]):
                p[key].append(dict(tag=tag, why=why))
                corr.append(f"{key} + {tag}")
        for k, v in LENS_FIX.get(slug, {}).items():
            if isinstance(p.get("lenses"), dict) and p["lenses"].get(k) != v:
                corr.append(f"lenses.{k} {p['lenses'].get(k)} to {v}")
                p["lenses"][k] = v
        if corr:
            p["owner_corrections"] = corr
            changed += 1
        f.write_text(json.dumps(p, indent=1, ensure_ascii=False), encoding="utf-8")
    set_bodies()
    print("notes applied to", len(NOTES), "heroes;", changed, "with corrections")


if __name__ == "__main__":
    main()
