/* Counters tab: archetype matrix, hero versus hero, what beats a comp. */
var C = { a: '', b: '', comp: [] };

RENDER.counters = function (p) {
  if (noGames()) { p.innerHTML = emptyMsg(); return; }
  p.innerHTML = '<div class="stack"><div class="card" id="c-matrix"></div>' +
    '<div class="card"><h3>Hero against hero ' + tag('data') + '</h3><p class="small muted">Pick one hero for a full list of opponents, or two for a direct record. A head to head counts games where the two were on opposite sides. "Lift" is the head to head rate minus what the two heroes\' own win rates predict, so a positive lift means the hero does better in this matchup than its base rate suggests.</p>' +
    '<div class="row"><div style="flex:1 1 200px">' + pickerHtml('c-pa', 'Hero A') + '</div><div style="flex:1 1 200px">' + pickerHtml('c-pb', 'Hero B (optional)') + '</div></div><div id="c-hvh" style="margin-top:10px"></div></div>' +
    '<div class="card"><h3>What beats this comp</h3><p class="small muted">Enter up to five heroes. Results combine games in the selection (numbers say) with ability and list data (kit suggests). Kit reasons are kept separate below.</p>' +
    pickerHtml('c-pc', 'Add a hero to the comp') + '<div id="c-comp" style="margin-block:10px"></div><div id="c-beats"></div></div></div>';
  drawMatrix();
  mountPicker('c-pa', function (h) { C.a = h; drawHvH(); });
  mountPicker('c-pb', function (h) { C.b = h; drawHvH(); });
  mountPicker('c-pc', function (h) { if (C.comp.length < 5 && C.comp.indexOf(h) < 0) C.comp.push(h); drawBeats(); }, function () { return C.comp; });
  drawHvH(); drawBeats();
};

function heatBg(v) { // v is a shrunk win rate
  var d = Math.max(-0.15, Math.min(0.15, v - 0.5)) / 0.15;
  return d >= 0 ? 'color-mix(in srgb, var(--good) ' + Math.round(d * 38) + '%, var(--surface))' : 'color-mix(in srgb, var(--bad) ' + Math.round(-d * 38) + '%, var(--surface))';
}
function drawMatrix() {
  var m = E.archetypeMatchups(App.selMap), A = m.archetypes;
  var h = '<h3>Archetype against archetype ' + tag('data') + '</h3><p class="small muted">Each cell is the row comp\'s shrunk win rate against the column comp, with games played underneath. Mirror matches are grey. Italic cells with a dashed outline have fewer than ' + E.LOW_N + ' games. ' + m.n + ' games used.</p>';
  h += '<div class="scroll"><table class="tbl heat"><thead><tr><th>Row beats column</th>' + A.map(function (a) { return '<th class="r" style="text-align:center">' + esc(a) + '</th>'; }).join('') + '</tr></thead><tbody>';
  A.forEach(function (a) {
    h += '<tr><th style="text-transform:none;font-size:13px;color:var(--ink)">' + esc(a) + '</th>' + A.map(function (b) {
      var c = m.table[a][b];
      if (!c || !c.n) return '<td class="c muted">n/a</td>';
      return '<td class="c ' + (c.mirror ? 'mirror' : '') + (c.low && !c.mirror ? ' lowc' : '') + '" style="' + (c.mirror ? '' : 'background:' + heatBg(c.shrunk)) + '" title="' + esc(a + ' against ' + b + ': ' + c.wins + ' wins of ' + c.n) + '">' + pct(c.shrunk, 0) + '<div class="small muted">n ' + c.n + '</div></td>';
    }).join('') + '</tr>';
  });
  $('#c-matrix').innerHTML = h + '</tbody></table></div><p class="small muted" style="margin-top:6px">Reading it: archetypes come from the hero matrix classifier (judgment), the results come from games. A cell shows what happened, not why.</p>';
}

function hvhRow(x, hero) {
  return '<tr><td>' + hn(x.b === hero ? x.a : x.b) + '</td><td class="r num">' + pct(x.shrunk) + '</td><td class="r num ' + (x.lift > 0 ? 'pos' : 'neg') + '">' + sgn(x.lift * 100) + '</td><td class="r num">' + x.n + lowb(x.low) + '</td></tr>';
}
function drawHvH() {
  var el = $('#c-hvh'), games = App.selMap, h = '';
  if (!C.a) { el.innerHTML = '<div class="empty small">Choose a hero to see its matchups.</div>'; return; }
  h += '<div class="row" style="margin-bottom:8px">' + hn(C.a) + (C.b ? '<span class="muted">against</span>' + hn(C.b) : '') + ' <button class="btn sm" data-act="c-clear">Clear</button></div>';
  if (C.b) {
    var r = E.heroVsHero(games, C.a, C.b);
    h += r.n ? '<div class="note"><b>' + disp(C.a) + '</b> won ' + r.aWins + ' of ' + r.n + ' games against <b>' + disp(C.b) + '</b> (' + pct(r.winRate) + ' raw, ' + pct(r.shrunk) + ' shrunk). The base rates predict ' + pct(r.expected) + ', so lift is ' + sgn(r.lift * 100) + ' points. ' + nn(r.n) + lowb(r.low) + '</div>' : '<div class="note">These two were never on opposite sides in the selection.</div>';
    var ds = E.pairSynergy(games, C.a, C.b);
    h += '<div class="note" style="margin-top:8px">Same team: ' + (ds.n ? ds.wins + ' wins of ' + ds.n + ' games (' + pct(ds.shrunk) + ' shrunk, lift ' + sgn(ds.lift * 100) + ' points) ' + lowb(ds.low) : 'never picked together in the selection.') + '</div>';
  } else {
    var all = E.heroVsList(games, C.a, 3).sort(function (x, y) { return y.shrunk - x.shrunk; });
    h += all.length ? '<div class="grid2" style="align-items:start"><div><h4>Does best against (n 3 or more)</h4>' + table(['Opponent', { t: 'Shrunk', c: 'r' }, { t: 'Lift', c: 'r' }, { t: 'Games', c: 'r' }], all.slice(0, 8).map(function (x) { return hvhRow(x, C.a); })) + '</div>' +
      '<div><h4>Does worst against</h4>' + table(['Opponent', { t: 'Shrunk', c: 'r' }, { t: 'Lift', c: 'r' }, { t: 'Games', c: 'r' }], all.slice(-8).reverse().map(function (x) { return hvhRow(x, C.a); })) + '</div></div>' : '<div class="note">No opponent has 3 or more games against this hero in the selection.</div>';
    var syn = E.synergyList(games, C.a, 3).sort(function (x, y) { return y.lift - x.lift; }).slice(0, 12);
    if (syn.length) h += '<h4 style="margin-top:10px">Best teammates by lift (n 3 or more)</h4><div class="row" style="margin-top:6px">' + syn.map(function (x) { return '<span class="hm">' + hn(x.b === C.a ? x.a : x.b) + '<span class="small muted num">' + sgn(x.lift * 100) + ' pts, n ' + x.n + '</span></span>'; }).join('') + '</div>';
  }
  el.innerHTML = h;
}
ACT['c-clear'] = function () { C.a = ''; C.b = ''; drawHvH(); };

function drawBeats() {
  $('#c-comp').innerHTML = C.comp.length ? C.comp.map(function (x, i) { return '<span class="hm">' + hn(x) + '<button data-act="c-rm" data-i="' + i + '" aria-label="Remove ' + esc(disp(x)) + '">x</button></span>'; }).join(' ') : '<span class="muted small">No heroes entered yet.</span>';
  var el = $('#c-beats');
  if (!C.comp.length) { el.innerHTML = ''; return; }
  var data = App.data, games = App.selMap;
  var w = E.whatBeats(data, games, C.comp, { limit: 8 }), rd = E.compRead(data, games, C.comp, []);
  var h = '<p>This comp reads as <b>' + esc(w.archetype.label || 'unclear') + '</b>' + (w.archetype.partial ? ' (partial, ' + w.archetype.count + ' of 5)' : '') + ' ' + tag('judgment') + '</p>';
  h += '<div class="grid2" style="align-items:start"><div><h4>What the numbers say ' + tag('data') + '</h4><p class="small muted">Archetypes that did best against this comp\'s archetype in the selection.</p>' +
    (w.archetypeAnswers.length ? table(['Archetype', { t: 'Win rate', c: 'r' }, { t: 'Games', c: 'r' }], w.archetypeAnswers.slice(0, 10).map(function (a) { return '<tr><td>' + esc(a.arch) + '</td><td class="r num">' + pct(a.shrunk) + '</td><td class="r num">' + a.n + lowb(a.low) + '</td></tr>'; })) : '<p class="small muted">No games for this archetype.</p>') + '</div>' +
    '<div><h4>What the kit suggests ' + tag('kit') + '</h4>' + (rd.vulnerabilities.length ? '<ul class="small" style="margin:4px 0;padding-left:18px">' + rd.vulnerabilities.map(function (v) { return '<li>Weak to <b>' + esc(v.type) + '</b>: ' + v.heroes + ' of the heroes ' + tag(v.basis) + '</li>'; }).join('') + '</ul>' : '<p class="small muted">No weakness is shared by two or more heroes.</p>') +
    '<p class="small muted">' + esc(rd.note || '') + '</p></div></div>';
  h += '<h4 style="margin-top:12px">Heroes that fit as answers</h4><div class="scroll"><table class="tbl"><thead><tr><th>Hero</th><th class="r">Score</th><th>Biggest parts</th><th class="r">Games</th></tr></thead><tbody>' + w.heroes.map(function (x) {
    var top = (x.components || []).filter(function (c) { return c.value > 0.3; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 3);
    var hero = data.heroes[x.hero];
    return '<tr><td>' + hn(x.hero) + '</td><td class="r num">' + x.score.toFixed(1) + '</td><td class="small">' + (top.map(function (c) { return esc(c.name) + ' ' + sgn(c.value) + ' ' + tag(c.basis); }).join(', ') || 'none') + (hero && hero.strengths_note ? '<div class="muted">' + esc(hero.strengths_note) + ' ' + tag('judgment') + '</div>' : '') + '</td><td class="r num">' + x.n + lowb(x.low) + '</td></tr>';
  }).join('') + '</tbody></table></div><p class="small muted">' + esc(w.note || '') + '</p>';
  el.innerHTML = h;
}
ACT['c-rm'] = function (el) { C.comp.splice(+el.getAttribute('data-i'), 1); drawBeats(); };
