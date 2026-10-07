"""Build the hero, map and guide library that the Draft Room reads (playbook/library.json).

Inputs : knowledge/hots_knowledge.db (Icy Veins heroes, abilities, talents, map guides, tier lists, guides),
         knowledge/icy_build_codes.txt (Icy Veins build codes in the in game import format, pasted by Hunter),
         playbook/notes/draft_tips.md (written draft tips), playbook/notes/library/*.md (extra written notes, optional)
Output : playbook/library.json (called from build_playbook.py; run on its own with `python build_library.py` to rebuild only this file)

Nothing here is hand typed game data. Talent names come from the Icy Veins talent tables. A build code is only a list of
slot numbers, so each one is decoded against that table and checked against the number of options at every level.
"""
import collections, datetime, json, pathlib, re, sqlite3, unicodedata

ROOT = pathlib.Path(__file__).parent
KN = ROOT / "knowledge"
PB = ROOT / "playbook"
TODAY = datetime.date.today()
MONTHS = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
BUILD_TAGS = ("Recommended", "Situational", "ARAM", "Alternative", "Alternate", "Standard", "Optional")
SKIP_TITLES = ("Changelog",)
GUIDES = [  # slug, title, one line on what it is for
    ("opening-moves", "Opening moves", "What to do in the first minute: group, siege, gank, trap or split."),
    ("pings-guide", "Pings guide", "What each ping means and how to use them to talk without chat."),
    ("lava-wave-timings", "Lava Wave timings", "When to cast Lava Wave on each map (Ragnaros)."),
    ("portal-mastery", "Portal Mastery", "How to get the most out of the Medivh talent."),
    ("wandering-keg", "Wandering Keg", "Chen's heroic ability, use by use."),
    ("hogg-wild-angles", "Hogg Wild angles", "Hogger's bounce spots for clearing camps."),
    ("holdable-abilities", "Holdable abilities", "Which abilities you can hold the key for to cast faster."),
    ("hotkeys-advanced-guide", "Advanced hotkeys", "Hotkey setup for faster play."),
    ("spell-power-and-damage-modifier", "Spell power and damage modifiers", "How reductions and bonuses stack."),
]


def norm(name):
    s = unicodedata.normalize("NFKD", name or "")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def slug_text(name):
    return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower())).strip("-")


def clean(text):
    """Icy Veins text is hard wrapped at about 80 columns: join the wrapped lines and keep paragraph breaks."""
    text = (text or "").replace("\r", "")
    paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in re.split(r"\n\s*\n", text)]
    return "\n\n".join(p for p in paras if p)


def lines_of(text):
    return [l.strip() for l in (text or "").split("\n") if l.strip()]


def strip_prefix(title, name):
    t = re.sub(r"^.*?'s\s+", "", title, count=1) if "'s " in title else title
    return t.strip()


def parse_date(s):
    """'Jul 30 2026' -> '2026-07-30'; '< Jun 2020' -> '2020-06-01' with before=True."""
    s = s.strip()
    if s.startswith("<"):
        m = re.search(r"([A-Z][a-z]{2}) (\d{4})", s)
        return f"{m.group(2)}-{MONTHS[m.group(1)]:02d}-01", True
    m = re.match(r"([A-Z][a-z]{2}) (\d{1,2}) (\d{4})", s)
    return f"{m.group(3)}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}", False


# ---------------------------------------------------------------- Icy Veins hero pages
def parse_strengths(text):
    out = {"strengths": [], "weaknesses": []}
    cur = None
    for l in lines_of(text):
        if l == "Strengths":
            cur = "strengths"
        elif l == "Weaknesses":
            cur = "weaknesses"
        elif cur:
            out[cur].append(l)
    return out


def parse_builds(text):
    """The cheat sheet lists each build as: name, tag, then Level rows with talent icons (no text), then the explanation."""
    ls = lines_of(text)
    builds, i = [], 0
    starts = [k for k in range(1, len(ls)) if ls[k] in BUILD_TAGS or (ls[k].endswith(" Build") and False)]
    for n, k in enumerate(starts):
        name, tag = ls[k - 1], ls[k]
        end = (starts[n + 1] - 1) if n + 1 < len(starts) else len(ls)
        body = ls[k + 1:end]
        body = [l for l in body if not re.match(r"^(Level \d+|\?|Copy build to clipboard|Build copied!|Talent calculator.*)$", l)]
        builds.append(dict(name=name, tag=tag, text=clean("\n".join(body))))
    return builds


def hero_pages(kdb, canon):
    out = {}
    for slug, name, role, gu, au, tu in kdb.execute("SELECT slug, name, role, guide_updated, abilities_updated, talents_updated FROM hero"):
        disp = canon.get(norm(slug)) or canon.get(norm(name)) or name
        out[disp] = dict(slug=slug, name=disp, iv_name=name, updated=dict(guide=gu, abilities=au, talents=tu))
    for h, d in out.items():
        secs = {}
        for page, ordn, title, text in kdb.execute("SELECT page, ord, title, text FROM hero_section WHERE slug=? ORDER BY page, ord", (d["slug"],)):
            if any(title.startswith(s) for s in SKIP_TITLES):
                continue
            secs.setdefault(page, []).append((ordn, title, text))
        guide = secs.get("guide", [])
        for _, title, text in guide:
            t = title
            if "Overview" in t:
                d["overview"] = clean(text)
            elif "Strengths and Weaknesses" in t:
                d.update(parse_strengths(text))
            elif "Talent Build" in t:
                d["build_notes"] = parse_builds(text)
            elif "Synergies and Counters" in t:
                parts = re.split(r"(?m)^.* (synergizes with|is countered by)\s*$", text)
                # parts = [pre, 'synergizes with', text, 'is countered by', text]
                for k in range(1, len(parts) - 1, 2):
                    d["synergy_text" if parts[k] == "synergizes with" else "counter_text"] = clean(parts[k + 1])
            elif t.endswith(" Maps") or t == "Maps":
                d["maps_text"] = clean(text.split("None\n")[-1] if "None\n" in text else text)
            elif "Tips and Tricks" in t:
                d["tips"] = clean(text)
            elif "Role in" in t:
                d["meta_text"] = clean(text)
        abil = []
        for _, title, text in secs.get("abilities", []):
            if "Tips and Tricks" in title:
                d.setdefault("tips", clean(text))
                continue
            ls = lines_of(text)
            key = None
            if len(ls) > 2 and re.match(r"^\(.+\)$", ls[1]):
                key = ls[1].strip("()")
                body = ls[3:]
            else:
                body = ls
            body = [l for l in body if not l.startswith("In this section we discuss") and not l.startswith("If you are looking for a detailed") and not l.startswith("check out the dedicated")]
            cost = [l for l in body if re.match(r"^(Mana|Cooldown|Charges|Energy|Fury|Brew|Cost|Charge Time|Range|Duration)\b.*:", l)]
            rest = [l for l in body if l not in cost]
            abil.append(dict(title=re.sub(r"\s*\((Trait|Q|W|E|R|D|Heroic|1|2|3|Passive)[^)]*\)$", "", title), key=key, cost=cost[:3], text=clean("\n".join(rest))))
        d["abilities"] = abil
    return out


def hero_talents(kdb, pages):
    by_slug = {d["slug"]: h for h, d in pages.items()}
    rows = collections.defaultdict(lambda: collections.defaultdict(list))
    for slug, level, slot, marker, name, text in kdb.execute("SELECT slug, level, slot, marker, name, text FROM talent ORDER BY slug, level, slot"):
        h = by_slug.get(slug)
        if not h:
            continue
        body = re.sub(r"^.*?\(Level \d+\)\s*", "", text or "")
        for prefix in (pages[h]["iv_name"], h):
            if body.startswith(prefix + " "):
                body = body[len(prefix) + 1:]
                break
        rows[h][level].append(dict(slot=slot, name=name, mark=marker, text=re.sub(r"\s+", " ", body).strip()))
    for h in pages:
        levels = sorted(rows.get(h, {}))
        pages[h]["talents"] = [dict(level=lv, opts=rows[h][lv]) for lv in levels]


def decode_builds(codes_path, pages, canon):
    text = codes_path.read_text(encoding="utf-8")
    rx = re.compile(r"([^\t\[\]]+?)\t\[T(\d+),(\w+)\]\t(< Jun 2020|[A-Z][a-z]{2} \d{1,2} \d{4})")
    alias = {"lostvikings": "thelostvikings"}
    problems = []
    n = 0
    for m in rx.finditer(text):
        label, code, slug, datestr = m.group(1).strip(), m.group(2), m.group(3), m.group(4)
        key = alias.get(norm(slug), norm(slug))
        h = canon.get(key)
        if not h or h not in pages:
            problems.append(f"{label}: no hero for {slug}")
            continue
        tal = pages[h]["talents"]
        if len(code) != len(tal):
            problems.append(f"{label}: code has {len(code)} digits but {h} has {len(tal)} talent tiers")
            continue
        picks = []
        for ch, tier in zip(code, tal):
            opt = next((o for o in tier["opts"] if o["slot"] == int(ch)), None)
            if not opt:
                problems.append(f"{label}: tier {tier['level']} has no option {ch}")
                break
            picks.append(dict(level=tier["level"], name=opt["name"], mark=opt["mark"]))
        else:
            date, before = parse_date(datestr)
            tu = pages[h]["updated"].get("talents") or ""
            age_days = (TODAY - datetime.date.fromisoformat(date)).days
            flags = []
            if before or age_days > 365:
                flags.append("old")
            if tu and tu > date:
                flags.append("patched")
            pages[h].setdefault("codes", []).append(dict(label=label, code="[T%s,%s]" % (code, slug), date=date, before=before, flags=flags, picks=picks))
            n += 1
    return n, problems


# ---------------------------------------------------------------- tiers, pairs, maps, guides
def hero_tiers(kdb, pages, canon):
    by_slug = {norm(d["slug"]): h for h, d in pages.items()}
    for h in pages:
        pages[h]["tiers"] = dict(general={}, master={}, maps={})
    for lst, tier, role, hero, ban in kdb.execute("SELECT list_name, tier, role, hero, ban FROM tier_entry"):
        h = by_slug.get(norm(hero)) or canon.get(norm(hero))
        if not h or h not in pages:
            continue
        role = re.sub(r" 1 Hero$", "", role)
        t = tier[-1]
        rec = {"role": role, "tier": t, "ban": bool(ban)}
        if lst in ("general", "master"):
            pages[h]["tiers"][lst][role] = rec
        elif lst not in ("aram", "quick-match"):
            pages[h]["tiers"]["maps"].setdefault(lst, {})[role] = rec


def pair_notes(kdb, pages, canon):
    for title, text in kdb.execute("SELECT title, text FROM guide_section WHERE guide='hero-synergies-guide' AND title LIKE '% & %'"):
        a, b = [x.strip() for x in title.split(" & ", 1)]
        ha, hb = canon.get(norm(a)), canon.get(norm(b))
        if not ha or not hb:
            continue
        body = clean(text)
        pages[ha].setdefault("pairs", []).append(dict(with_=hb, text=body))
        pages[hb].setdefault("pairs", []).append(dict(with_=ha, text=body))


def map_library(kdb):
    out = {}
    for slug, name in kdb.execute("SELECT slug, name FROM map ORDER BY name"):
        disp = name.replace(" Of ", " of ").replace(" The ", " the ").replace("Blackhearts Bay", "Blackheart's Bay")
        secs = []
        for ordn, title, text in kdb.execute("SELECT ord, title, text FROM map_section WHERE map=? ORDER BY ord", (slug,)):
            if title in SKIP_TITLES or not (text or "").strip():
                continue
            secs.append(dict(title=title, text=clean(text)))
        out[disp] = dict(slug=slug, name=disp, sections=secs)
    return out


def guide_library(kdb):
    out = []
    for slug, title, blurb in GUIDES:
        secs = [dict(title=t, text=clean(x)) for t, x in kdb.execute("SELECT title, text FROM guide_section WHERE guide=? ORDER BY ord", (slug,))
                if t not in SKIP_TITLES and t != "(intro)" and (x or "").strip()]
        if secs:
            out.append(dict(slug=slug, title=title, blurb=blurb, sections=secs))
    return out


def glossary(kdb):
    row = kdb.execute("SELECT text FROM guide_section WHERE guide='glossary-of-terms' AND title='Glossary'").fetchone()
    ls = lines_of(row[0]) if row else []
    if ls[:2] == ["Terms", "Explanations"]:
        ls = ls[2:]
    return [dict(term=ls[i], text=ls[i + 1]) for i in range(0, len(ls) - 1, 2)]


def written_tips():
    path = PB / "notes" / "draft_tips.md"
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


# ---------------------------------------------------------------- division usage per hero
def division_usage(db, pages, G=None):
    """Picks, wins and bans per hero over every game in the division database."""
    use = collections.defaultdict(lambda: dict(g=0, w=0, bans=0))
    for hero, won in db.execute("SELECT hero, won FROM ngs_player_game"):
        use[hero]["g"] += 1
        use[hero]["w"] += int(bool(won))
    for (hero,) in db.execute("SELECT hero FROM ngs_hero_ban"):
        use[hero]["bans"] += 1
    games = db.execute("SELECT COUNT(*) FROM ngs_game").fetchone()[0]
    for h, u in use.items():
        if h in pages:
            pages[h]["division"] = dict(u, games=games)


def rec_txt(v):
    return f"{v[1]}-{v[0] - v[1]}"


def division_facts(G, heroes):
    """League wide records by draft habit, recomputed from every game in the database (both teams of every game)."""
    fp, mp = [0, 0], [0, 0]
    mk, dd, rg = collections.defaultdict(lambda: [0, 0]), collections.defaultdict(lambda: [0, 0]), collections.defaultdict(lambda: [0, 0])
    mins_all = []
    for g in G.values():
        fp[0] += 1; fp[1] += g["winner"] == g["first_pick_team"]
        mp[0] += 1; mp[1] += g["winner"] == g["map_pick_team"]
        mins_all.append((g["length_sec"] or 0) / 60)
        for team in (g["team0"], g["team1"]):
            won = g["winner"] == team
            ps = [heroes.get(p["hero"], {}) for p in g["players"] if p["team"] == team]
            m = sum(h.get("marksman", False) for h in ps)
            d = sum(h.get("high_damage", False) for h in ps)
            r = sum(h.get("ranged", False) for h in ps)
            for tbl, key in ((mk, "2 or more" if m >= 2 else str(m)), (dd, str(d)), (rg, "3 or more" if r >= 3 else "2 or fewer")):
                tbl[key][0] += 1; tbl[key][1] += won
    n = len(G)
    facts = [
        dict(text=f"The team with first pick won {rec_txt(fp)} ({n} games). The team that picked the map won {rec_txt(mp)}.", n=n),
        dict(text=f"Teams with two or more marksmen are {rec_txt(mk['2 or more'])}. With one marksman {rec_txt(mk['1'])}, with none {rec_txt(mk['0'])}.", n=2 * n),
        dict(text=f"Teams with exactly two real damage dealers (heroes that average 2,400 or more hero damage a minute here) are {rec_txt(dd['2'])}. With one it is {rec_txt(dd['1'])}, with three {rec_txt(dd['3'])}, with none {rec_txt(dd['0'])}.", n=2 * n),
        dict(text=f"Ranged heroes alone do not split the league: three or more ranged is {rec_txt(rg['3 or more'])}, two or fewer is {rec_txt(rg['2 or fewer'])}. Single maps differ, see the Maps tab and the map rules.", n=2 * n),
        dict(text=f"Average game length is {sum(mins_all) / n:.1f} minutes.", n=n),
    ]
    return facts


def build_library(heroes, canon, db, kdb, G=None):
    pages = hero_pages(kdb, canon)
    hero_talents(kdb, pages)
    n_codes, problems = decode_builds(KN / "icy_build_codes.txt", pages, canon)
    hero_tiers(kdb, pages, canon)
    pair_notes(kdb, pages, canon)
    division_usage(db, pages)
    lib = dict(built=TODAY.isoformat(), heroes=pages, maps=map_library(kdb), guides=guide_library(kdb), tips=written_tips(), glossary=glossary(kdb), facts=division_facts(G, heroes) if G else [],
               build_code_problems=problems, build_codes=n_codes)
    # third party text uses em dashes; Hunter reads them as an AI giveaway, so swap them for a comma on the way in
    lib = json.loads(json.dumps(lib, ensure_ascii=False).replace("—", ", ").replace("–", "-").replace(" , ", ", "))
    return lib


def main():
    import build_playbook as bp
    cfg = bp.rd(PB / "config" / "our_team.json")
    heroes, canon, kdb = bp.build_heroes(cfg)
    db = sqlite3.connect(KN / "ngs_div.db")
    G = bp.games(db)
    bp.attach_hero_stats(heroes, G)
    lib = build_library(heroes, canon, db, kdb, G)
    (PB / "library.json").write_text(json.dumps(lib, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"library.json {(PB / 'library.json').stat().st_size // 1024} KB, {len(lib['heroes'])} heroes, {lib['build_codes']} build codes, {len(lib['maps'])} maps, {len(lib['guides'])} guides")
    for p in lib["build_code_problems"]:
        print("  build code problem:", p)


if __name__ == "__main__":
    main()
