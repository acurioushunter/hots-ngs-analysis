"""Infer team name changes between NGS seasons from who played for them.
Input : knowledge/ngs_season.db (this season, players with Heroes Profile ids)
        knowledge/ngs_season21.db (last season from Heroes Profile) or, when that is missing, knowledge/ngs_league.db (replay export)
Output: knowledge/team_aliases.json  list of {team, former, shared, core_now, core_before, ratio, confidence, note}
A team is 'probably the same' as a former team when they share players. Name changes are not recorded anywhere we can read,
so this is an inference; the page lets the user turn each one off. Run: python build_team_aliases.py
"""
import collections, json, pathlib, sqlite3

ROOT = pathlib.Path(__file__).parent / "knowledge"
THIS, LAST = 22, 21


def rosters_last():
    ro = collections.defaultdict(collections.Counter)
    p21 = ROOT / "ngs_season21.db"
    if p21.exists():
        for team, bid in sqlite3.connect(p21).execute("SELECT team, blizz_id FROM ngs_player_game WHERE blizz_id IS NOT NULL"):
            ro[team][str(bid)] += 1
        return ro
    lg = sqlite3.connect(ROOT / "ngs_league.db")
    for t0, t1, side, toon in lg.execute(
            "SELECT g.team0, g.team1, p.team, p.toon FROM lg_players p JOIN lg_games g USING(game_id) WHERE g.season=?", (LAST,)):
        ro[t0 if side == 0 else t1][toon.split("-")[-1]] += 1
    return ro


def rosters_now():
    db = sqlite3.connect(ROOT / "ngs_season.db")
    ro = collections.defaultdict(collections.Counter)
    for team, bid in db.execute("SELECT team, blizz_id FROM ngs_player_game WHERE blizz_id IS NOT NULL"):
        ro[team][str(bid)] += 1
    return ro


def core(c):
    return {b for b, g in c.items() if g >= 2} or set(c)


def main():
    now, last = rosters_now(), rosters_last()
    out = []
    for team, pl in now.items():
        c_now = core(pl)
        cands = []
        for former, old in last.items():
            if former == team:
                continue
            shared = c_now & core(old)
            if len(shared) >= 2:
                cands.append((former, len(shared), len(core(old))))
        cands.sort(key=lambda x: -x[1])
        for former, k, c_old in cands[:3]:
            ratio = k / max(min(len(c_now), c_old), 1)
            still = former in now
            if k >= 4 or (k >= 3 and ratio >= 0.6):
                conf = "high"
            elif k >= 3 or ratio >= 0.5:
                conf = "medium"
            else:
                conf = "low"
            if still and conf != "high":
                continue   # the old team is still playing under its name: more likely players moved, not a rename
            note = "the old name still plays this season, so this may be a split or a merge" if still else ""
            out.append(dict(team=team, former=former, shared=k, core_now=len(c_now), core_before=c_old, ratio=round(ratio, 2), confidence=conf, former_still_exists=still, note=note))
    # a former name that matches several teams today is a split: say so
    n = collections.Counter(o["former"] for o in out if o["confidence"] != "low")
    for o in out:
        if n[o["former"]] > 1:
            o["note"] = (o["note"] + "; " if o["note"] else "") + "several teams share this former roster (a split)"
    (ROOT / "team_aliases.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for o in sorted(out, key=lambda o: (o["confidence"], o["team"])):
        print(f'{o["confidence"]:6} {o["team"]}  <-  {o["former"]}  ({o["shared"]} shared of {o["core_now"]} now / {o["core_before"]} before) {o["note"]}')


if __name__ == "__main__":
    main()
