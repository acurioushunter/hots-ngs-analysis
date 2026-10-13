"""Build the Draft Lab page: python -I build_draftlab.py
Inlines draftlab/app.css, draftlab/engine.js, draftlab/ui/*.js, the hero matrix, the league games,
curated map notes and Learn text into one self contained page.
Writes draft_lab_artifact.html (page fragment for publishing, the publisher adds the document skeleton)
and draft_lab.html (same content wrapped in a document skeleton so it opens locally)."""
import json, re, sys, datetime, pathlib

BS = chr(92)
ROOT = pathlib.Path(__file__).resolve().parent
D = ROOT / 'draftlab'
EX = ROOT / 'knowledge' / 'expert'


def read(p):
    return pathlib.Path(p).read_text(encoding='utf8')


def js_json(obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    return s.replace('</', '<' + BS + '/')


def learn_html():
    s = read(D / 'content' / 'learn.html')
    s = re.sub(r'\{S:([^}]*)\}', lambda m: '<span class="tag source">source</span> <span class="muted small">' + m.group(1) + '</span>', s)
    s = s.replace('{J}', '<span class="tag judgment">judgment</span>')
    return s


def lint_prose(text, label):
    """Hunter's voice rule: no em dashes, no spaced hyphens used as dashes in prose."""
    plain = re.sub(r'<[^>]+>', ' ', text)
    bad = []
    if '\u2014' in plain or '\u2013' in plain:
        bad.append('dash character')
    if re.search(r'\s-\s', plain):
        bad.append('spaced hyphen')
    if bad:
        print('PROSE LINT FAIL in', label, bad)
        sys.exit(1)


def example_profile(matrix):
    cfg = json.loads(read(ROOT / 'playbook' / 'config' / 'our_team.json'))
    comfort = {'primary': 3, 'secondary': 2, 'practice': 1}
    players = []
    for i, pl in enumerate(cfg['players'], 1):
        pool = []
        for hero, tier in pl.get('pool', {}).items():
            if hero not in matrix['heroes']:
                print('WARNING: example pool hero not in matrix, skipped:', hero)
                continue
            pool.append({'hero': hero, 'comfort': comfort.get(tier, 2)})
        players.append({'name': 'Player %d' % i, 'role': pl.get('slot_role', ''), 'pool': pool})
    return {'name': 'Example team', 'players': players}


def main():
    matrix = json.loads(read(EX / 'hero_matrix_draft.json'))
    games = json.loads(read(EX / 'league_games.json'))
    notes = json.loads(read(D / 'content' / 'map_notes.json'))
    learn = learn_html()
    lint_prose(learn, 'learn.html')
    for m, items in notes.items():
        for it in items:
            lint_prose(it[0], 'map notes ' + m)
    ui_order = ['core.js', 'draft.js', 'maps.js', 'counters.js', 'heroes.js', 'meta.js', 'review.js', 'team.js', 'learn.js']
    ui = '\n'.join(read(D / 'ui' / f) for f in ui_order)
    tpl = read(D / 'app.html')
    subs = {
        '/*__CSS__*/': read(D / 'app.css'),
        '/*__LEARN__*/': learn,
        '/*__MATRIX__*/': js_json(matrix),
        '/*__GAMES__*/': js_json(games),
        '/*__BUILD_DATE__*/': js_json(datetime.date.today().isoformat()),
        '/*__MAPNOTES__*/': js_json(notes),
        '/*__EXAMPLE__*/': js_json(example_profile(matrix)),
        '/*__ENGINE__*/': read(D / 'engine.js').replace('</script', '<' + BS + '/script'),
        '/*__UI__*/': ui.replace('</script', '<' + BS + '/script'),
    }
    embed_tpl = tpl
    for k, v in subs.items():
        assert k in tpl, k
        if k not in ('/*__MATRIX__*/', '/*__GAMES__*/'):
            embed_tpl = embed_tpl.replace(k, v)
        tpl = tpl.replace(k, v)  # str.replace with a plain string: no regex escapes to worry about
    # embed variant for HotS Tools: the matrix and the games stay as placeholders that the shell fills from its one shared copy
    (ROOT / 'draft_lab_embed.html').write_text(embed_tpl, encoding='utf8')
    fragment = tpl
    wrapped = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
               '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
               '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
               'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
               '</head>\n<body>\n' + fragment + '\n</body>\n</html>\n')
    (ROOT / 'draft_lab_artifact.html').write_text(fragment, encoding='utf8')
    (ROOT / 'draft_lab.html').write_text(wrapped, encoding='utf8')
    print('draft_lab_artifact.html %.2f MB, draft_lab.html %.2f MB' % (len(fragment.encode('utf8')) / 1e6, len(wrapped.encode('utf8')) / 1e6))


if __name__ == '__main__':
    main()
