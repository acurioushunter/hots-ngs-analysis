"""Build HotS Tools, the master app: python -I build_hotstools.py [--all]

Inputs (build them first, or pass --all):
  draft_tool_artifact.html   the Draft Room fragment (python build_playbook.py)
  draft_lab_embed.html       the Draft Lab fragment with the matrix and games left as placeholders (python build_draftlab.py)
  hotstools/                 shell.html, shell.css, shell.js, mygames/engine.js, mygames/ui.js
  knowledge/expert/          hero_matrix_draft.json, league_games.json
  playbook/library.json      global Storm League hero win rates
  knowledge/hunter_hp.db     the example games for My Games (last 12 months of Storm League, anonymised)
Outputs: hots_tools_artifact.html (page fragment for publishing) and hots_tools.html (stand alone, opens locally).
With --personal it also writes hots_tools_hunter.html and hots_tools_hunter_artifact.html: the same app with the owner's
Heroes Profile games loaded in My Games, the owner's team picked in Team Scout and the team pool on the open draft board.
Those two files hold personal data, are git ignored, and are not the ones to share."""
import datetime, json, pathlib, re, sqlite3, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent
HT = ROOT / 'hotstools'
EX = ROOT / 'knowledge' / 'expert'
BS = chr(92)


def read(p):
    return pathlib.Path(p).read_text(encoding='utf8')


def js_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':')).replace('</', '<' + BS + '/')


def js_string(text):
    """A JavaScript string literal that is safe inside a script element."""
    return json.dumps(text, ensure_ascii=True).replace('</', '<' + BS + '/')


def meta(matrix, games, lib, playbook):
    ngs = [g for g in games if g[0] == 'NGS']
    hl = [g for g in games if g[0] == 'HL']
    glob = {}
    for h, d in lib['heroes'].items():
        x = (d.get('hp') or {}).get('deep')
        if x:
            glob[h] = {'win': x['win'], 'pick': x.get('pick'), 'ban': x.get('ban'), 'games': x.get('games')}
    facts = []
    fp = [g for g in ngs if g[5] in (0, 1)]
    if fp:
        w = sum(1 for g in fp if g[5] == g[4])
        facts.append('In NGS the team with first pick wins %.0f%% of games (%d games). A small edge at most; it is not worth building a draft around.' % (100 * w / len(fp), len(fp)))
    # experience lead of team 0 at 10 minutes is column 17 (from replay timelines, NGS only)
    xp = [g for g in games if len(g) > 17 and g[17]]
    if xp:
        def lead_won(g):
            return (g[17] > 0 and g[4] == 0) or (g[17] < 0 and g[4] == 1)
        w = sum(1 for g in xp if lead_won(g))
        big = [g for g in xp if abs(g[17]) >= 3000]
        bw = sum(1 for g in big if lead_won(g))
        facts.append('The team ahead on experience at 10 minutes wins %.0f%% of games (%d games with replay timelines). A lead of 3,000 or more wins %.0f%% (%d games). The first 10 minutes matter more than who gets the first kill (%.0f%%).' % (
            100 * w / len(xp), len(xp), 100 * bw / max(1, len(big)), len(big),
            100 * sum(1 for g in games if len(g) > 15 and g[15] is not None and g[15] == g[4]) / max(1, sum(1 for g in games if len(g) > 15 and g[15] is not None))))
    pk, bn = {}, {}
    for g in games:
        for side in (0, 1):
            won = g[4] == side
            for h in g[9 + side]:
                a = pk.setdefault(h, [0, 0]); a[1] += 1; a[0] += 1 if won else 0
            for h in g[11 + side]:
                bn[h] = bn.get(h, 0) + 1
    top = sorted(pk.items(), key=lambda kv: -kv[1][1])[:5]
    facts.append('Most picked: ' + ', '.join('%s (%d%% win over %d)' % (h, round(100 * v[0] / v[1]), v[1]) for h, v in top) + '.')
    tb = sorted(bn.items(), key=lambda kv: -kv[1])[:5]
    facts.append('Most banned: ' + ', '.join('%s (%d)' % (h, n) for h, n in tb) + '.')
    dates = sorted(g[13] for g in ngs if g[13])
    return {
        'global': glob, 'maps': sorted({g[3] for g in games if g[3]}), 'facts': facts, 'hero_count': len(matrix['heroes']),
        'games_total': len(games), 'ngs_games': len(ngs), 'hl_games': len(hl), 'ngs_teams': len(playbook.get('league', {}).get('teams', {})) or None,
        'lens_catalog': playbook.get('lens_catalog', {}), 'lens_signal': (playbook.get('comps', {}) or {}).get('lens_signal', {}),
        'data_asof': ('NGS games to ' + dates[-1]) if dates else '', 'global_asof': (lib.get('hp_meta', {}).get('deep', {}) or {}).get('asof', ''),
    }


def example_games():
    """The last 12 months of one player's Storm League games, with replay ids removed."""
    db = sqlite3.connect(ROOT / 'knowledge' / 'hunter_hp.db')
    db.row_factory = sqlite3.Row
    rows = db.execute("select * from hp_game where game_type='sl' order by date").fetchall()
    last = datetime.datetime.strptime(rows[-1]['date'], '%Y-%m-%d %H:%M:%S')
    since = last - datetime.timedelta(days=365)
    out = []
    for r in rows:
        dt = datetime.datetime.strptime(r['date'], '%Y-%m-%d %H:%M:%S')
        if dt < since:
            continue
        t = int(dt.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)
        tal = [r[k] for k in ('l1', 'l4', 'l7', 'l10', 'l13', 'l16', 'l20')]
        g = {'t': t, 'type': 'sl', 'map': r['map'], 'hero': r['hero'], 'role': r['role'], 'won': r['won'], 'lvl': r['level'], 'k': r['kills'], 'a': r['assists'],
             'td': r['takedowns'], 'd': r['deaths'], 'hd': r['hero_damage'], 'sd': r['siege_damage'], 'st': r['structure_damage'], 'mn': r['minion_damage'],
             'cr': r['creep_damage'], 'heal': r['healing'], 'taken': r['damage_taken'], 'xp': r['xp_contribution'], 'dead': r['time_spent_dead'],
             'camps': r['merc_camp_captures'], 'fto': r['first_to_ten'], 'mmr': r['player_mmr'], 'hmmr': r['hero_mmr'], 'rmmr': r['role_mmr'],
             'award': r['award'], 'tal': tal if any(tal) else None}
        out.append(g)
    return {'format': 'hots-tools-games', 'version': 1, 'battletag': 'Example player', 'games': out}


def personal_data(playbook):
    """The owner's whole Heroes Profile history (every mode) in My Games format, plus the team and pool the apps should start on."""
    db = sqlite3.connect(ROOT / 'knowledge' / 'hunter_hp.db')
    db.row_factory = sqlite3.Row
    games = []
    for r in db.execute("select * from hp_game order by date"):
        dt = datetime.datetime.strptime(r['date'], '%Y-%m-%d %H:%M:%S')
        tal = [r[k] for k in ('l1', 'l4', 'l7', 'l10', 'l13', 'l16', 'l20')]
        games.append({'id': r['replay_id'], 't': int(dt.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000), 'type': r['game_type'], 'map': r['map'],
                      'hero': r['hero'], 'role': r['role'], 'won': r['won'], 'lvl': r['level'], 'k': r['kills'], 'a': r['assists'], 'td': r['takedowns'], 'd': r['deaths'],
                      'hd': r['hero_damage'], 'sd': r['siege_damage'], 'st': r['structure_damage'], 'mn': r['minion_damage'], 'cr': r['creep_damage'],
                      'heal': r['healing'], 'taken': r['damage_taken'], 'xp': r['xp_contribution'], 'dead': r['time_spent_dead'], 'camps': r['merc_camp_captures'],
                      'fto': r['first_to_ten'], 'mmr': r['player_mmr'], 'hmmr': r['hero_mmr'], 'rmmr': r['role_mmr'], 'award': r['award'], 'tal': tal if any(tal) else None})
    cfg = json.loads(read(ROOT / 'playbook' / 'config' / 'our_team.json'))
    comfort = {'primary': 3, 'secondary': 2, 'practice': 1}
    players = [{'name': pl.get('label') or pl['tag'], 'role': pl.get('slot_role', ''),
                'pool': [{'hero': h, 'comfort': comfort.get(t, 2)} for h, t in pl.get('pool', {}).items()]} for pl in cfg['players']]
    return {'name': 'Hunter', 'battletag': 'hunterstag', 'games': games, 'filters': {'types': ['sl'], 'range': '365'},
            'team': cfg['team'], 'me': 'hunterstag', 'next': playbook.get('meta', {}).get('next_opponent'),
            'profile': {'players': players}, 'profileName': cfg['team']}


def theme_css():
    css = read(HT / 'shell.css')
    tokens = css.split('* { box-sizing: border-box; }')[0]
    extra = (':root{--font-body:var(--body);--font-display:var(--display);--chip-ink:#fff}'
             # the embedded apps draw their own header and tabs; the shell owns navigation
             '.bar,header.top .brand,header.top .tabs{display:none!important}header.top{padding:0!important;border:0!important;min-height:0!important}\n')
    return extra + tokens


def assemble(tpl, subs, personal=None):
    out = tpl
    subs = dict(subs)
    subs['/*__PERSONAL__*/'] = js_json(personal) if personal else 'null'
    subs['/*__NS__*/'] = js_json('hunter:') if personal else '""'
    for k, v in subs.items():
        assert k in out, k
        out = out.replace(k, v)
    wrapped = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
               '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
               '</head>\n<body>\n' + out + '\n</body>\n</html>\n')
    return out, wrapped


def check_syntax():
    """A stray apostrophe in a single quoted JS string once broke the whole Lab silently (the tests do not parse the UI files)."""
    import glob
    bad = []
    for f in sorted(glob.glob(str(ROOT / 'draftlab' / '**' / '*.js'), recursive=True) + glob.glob(str(ROOT / 'hotstools' / '**' / '*.js'), recursive=True)
                    + [str(ROOT / 'playbook' / 'engine.js')]):
        r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
        if r.returncode:
            bad.append(f + ': ' + (r.stderr.strip().splitlines()[0] if r.stderr.strip() else 'syntax error'))
    if bad:
        raise SystemExit('JavaScript syntax error, nothing built: ' + '; '.join(bad))


def main():
    check_syntax()
    if '--all' in sys.argv:
        subprocess.check_call([sys.executable, str(ROOT / 'build_playbook.py')], cwd=ROOT)
        subprocess.check_call([sys.executable, '-I', str(ROOT / 'build_draftlab.py')], cwd=ROOT)
    import sys as _sys, pathlib as _pl
    _sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
    import merge_profiles_into_matrix
    merge_profiles_into_matrix.main()   # the matrix follows the hero profiles
    matrix = json.loads(read(EX / 'hero_matrix_draft.json'))
    games = json.loads(read(EX / 'league_games.json'))
    lib = json.loads(read(ROOT / 'playbook' / 'library.json'))
    playbook = json.loads(read(ROOT / 'playbook' / 'data.json'))
    drafter = read(ROOT / 'draft_tool_artifact.html')
    lab = read(ROOT / 'draft_lab_embed.html')
    tpl = read(HT / 'shell.html')
    subs = {
        '/*__CSS__*/': read(HT / 'shell.css'),
        '/*__MATRIX__*/': js_json(matrix),
        '/*__GAMES__*/': js_json(games),
        '/*__META__*/': js_json(meta(matrix, games, lib, playbook)),
        '/*__EXAMPLE__*/': js_json(example_games()),
        '/*__LAB_ENGINE__*/': read(ROOT / 'draftlab' / 'engine.js').replace('</script', '<' + BS + '/script'),
        '/*__BUILD__*/': js_json(datetime.date.today().isoformat()),
        '/*__APP_DRAFTER__*/': js_string(drafter),
        '/*__APP_LAB__*/': js_string(lab),
        '/*__THEME_CSS__*/': js_string(theme_css()),
        '/*__MYGAMES_ENGINE__*/': read(HT / 'mygames' / 'engine.js').replace('</script', '<' + BS + '/script'),
        '/*__MYGAMES_UI__*/': read(HT / 'mygames' / 'ui.js').replace('</script', '<' + BS + '/script'),
        '/*__SHELL_JS__*/': read(HT / 'shell.js').replace('</script', '<' + BS + '/script'),
    }
    out, wrapped = assemble(tpl, subs)
    (ROOT / 'hots_tools_artifact.html').write_text(out, encoding='utf8')
    (ROOT / 'hots_tools.html').write_text(wrapped, encoding='utf8')
    print('hots_tools_artifact.html %.2f MB, hots_tools.html %.2f MB' % (len(out.encode('utf8')) / 1e6, len(wrapped.encode('utf8')) / 1e6))
    if '--personal' in sys.argv:
        pd = personal_data(playbook)
        out, wrapped = assemble(tpl, subs, pd)
        (ROOT / 'hots_tools_hunter_artifact.html').write_text(out, encoding='utf8')
        (ROOT / 'hots_tools_hunter.html').write_text(wrapped, encoding='utf8')
        print('personal edition: %d games, hots_tools_hunter.html %.2f MB' % (len(pd['games']), len(wrapped.encode('utf8')) / 1e6))


if __name__ == '__main__':
    main()
