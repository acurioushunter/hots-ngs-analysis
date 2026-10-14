"""Audit of the hero rating table against what heroes actually do in NGS games.

Reads the player rows of Season 21 and Season 22 (knowledge/ngs_season21.db, knowledge/ngs_season.db), works out per hero
rates per 10 minutes (camps, creep damage, minion damage, structure damage, hero damage, healing, XP, time dead),
turns them into percentile ranks among heroes with enough games, and prints them next to the authored ratings in
knowledge/expert/hero_matrix_data.py so a rating that the games contradict stands out.

Run: python audit_hero_ratings.py            (table for every hero)
     python audit_hero_ratings.py --flags    (only the ratings the games disagree with)
     python audit_hero_ratings.py --json     (writes knowledge/expert/hero_game_stats.json, read by the matrix build)

What it can and cannot say: camps and clears depend on what the team asks a hero to do (a healer who stays with the team
camps less than a hero who is sent to a side lane), so a low number is a lean, not proof the kit cannot do it.
Nothing here is a Storm League number: it is NGS division play, 2 seasons."""
import json, os, sqlite3, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'knowledge', 'expert'))
MIN_GAMES = 20          # heroes under this are shown but not ranked


def load_rows():
    rows = []
    for f in ('knowledge/ngs_season21.db', 'knowledge/ngs_season.db'):
        db = sqlite3.connect(os.path.join(ROOT, f))
        q = """select p.hero, g.length_sec, p.merc_camps, p.creep_damage, p.minion_damage, p.structure_damage, p.siege_damage,
                      p.hero_damage, p.healing, p.xp_contribution, p.time_dead, p.deaths, p.takedowns, p.won, p.damage_taken
               from ngs_player_game p join ngs_game g on g.replay_id = p.replay_id
               where g.length_sec > 300 and p.hero is not null"""
        rows += db.execute(q).fetchall()
    return rows


KEYS = ['camps', 'creep', 'minion', 'struct', 'siege', 'hero', 'heal', 'xp', 'dead', 'deaths', 'td', 'taken']


def per_hero(rows):
    agg = {}
    for (hero, sec, camps, creep, minion, struct, siege, hdmg, heal, xp, dead, deaths, td, won, taken) in rows:
        m = sec / 60.0
        a = agg.setdefault(hero, {'n': 0, 'wins': 0, 'min': 0.0, **{k: 0.0 for k in KEYS}})
        a['n'] += 1; a['wins'] += won or 0; a['min'] += m
        a['camps'] += (camps or 0) / m * 10          # camps per 10 minutes
        a['creep'] += (creep or 0) / m
        a['minion'] += (minion or 0) / m
        a['struct'] += (struct or 0) / m
        a['siege'] += (siege or 0) / m
        a['hero'] += (hdmg or 0) / m
        a['heal'] += (heal or 0) / m
        a['xp'] += (xp or 0) / m
        a['dead'] += (dead or 0) / (sec) * 1.0       # share of the game spent dead
        a['deaths'] += (deaths or 0) / m * 10        # deaths per 10 minutes
        a['td'] += (td or 0) / m * 10
        a['taken'] += (taken or 0) / m
    out = {}
    for h, a in agg.items():
        n = a['n']
        out[h] = {'n': n, 'win': a['wins'] / n, **{k: a[k] / n for k in KEYS}}
    return out


def percentiles(stats, key):
    ranked = sorted([h for h, s in stats.items() if s['n'] >= MIN_GAMES], key=lambda h: stats[h][key])
    pct = {}
    for i, h in enumerate(ranked):
        pct[h] = (i + 0.5) / len(ranked)
    return pct


def to_rating(p):
    # five buckets: bottom 15%, next 25%, middle 30%, next 20%, top 10%
    return 1 if p < 0.15 else 2 if p < 0.40 else 3 if p < 0.70 else 4 if p < 0.90 else 5


def main():
    from hero_matrix_data import H
    stats = per_hero(load_rows())
    pc = {k: percentiles(stats, k) for k in ('camps', 'creep', 'minion', 'struct', 'siege', 'hero', 'heal', 'xp')}
    names = sorted(set(H) | set(stats))
    flags = '--flags' in sys.argv
    out = {}
    for h in names:
        s = stats.get(h)
        cur = H.get(h)
        if cur:
            r = [int(x) for x in cur[3].split()]
            ratings = dict(zip(['camp', 'wave', 'tf', 'eng', 'peel', 'sus', 'mob', 'ease', 'obj', 'siege'], r))
        else:
            ratings = None
        if not s:
            out[h] = {'n': 0}
            if not flags: print('%-18s no games' % h)
            continue
        emp = {k: (pc[k].get(h)) for k in pc}
        out[h] = {'n': s['n'], 'win': round(s['win'], 3), **{k: round(s[k], 3) for k in KEYS}, 'pct': {k: (round(v, 2) if v is not None else None) for k, v in emp.items()}}
        if flags and ratings and s['n'] >= MIN_GAMES:
            msgs = []
            for label, key, rk in (('camp', 'camps', 'camp'), ('wave', 'minion', 'wave'), ('siege', 'struct', 'siege')):
                if emp[key] is None: continue
                sug = to_rating(emp[key])
                if abs(sug - ratings[rk]) >= 2:
                    msgs.append('%s table %d, games say %d (%s p%d)' % (label, ratings[rk], sug, key, round(emp[key] * 100)))
            if msgs: print('%-18s n=%-4d %s' % (h, s['n'], '; '.join(msgs)))
        elif not flags:
            e = lambda k: ('p%02d' % round(emp[k] * 100)) if emp.get(k) is not None else '  - '
            print('%-18s n=%-4d win %4.1f%% | camps/10m %.2f %s creep/m %5.0f %s minion/m %5.0f %s struct/m %5.0f %s heroDmg/m %5.0f %s | table camp %s wave %s siege %s' % (
                h, s['n'], s['win'] * 100, s['camps'], e('camps'), s['creep'], e('creep'), s['minion'], e('minion'), s['struct'], e('struct'),
                s['hero'], e('hero'), ratings['camp'] if ratings else '-', ratings['wave'] if ratings else '-', ratings['siege'] if ratings else '-'))
    if '--json' in sys.argv:
        p = os.path.join(ROOT, 'knowledge', 'expert', 'hero_game_stats.json')
        json.dump({'_meta': {'source': 'NGS Season 21 and 22 player rows', 'min_games_for_rank': MIN_GAMES,
                             'units': 'camps and deaths and takedowns per 10 minutes, damage and xp per minute, dead as share of game'},
                   'heroes': out}, open(p, 'w', encoding='utf-8'), indent=1)
        print('wrote', p)


if __name__ == '__main__':
    main()
