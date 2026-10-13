/* Maps tab: what wins on each map in the selection, plus curated objective notes. */
var M = { map: '' };
var ROLE_ABBR = { 'Tank': 'Tank', 'Bruiser': 'Bruiser', 'Melee Assassin': 'Melee', 'Ranged Assassin': 'Ranged', 'Healer': 'Healer', 'Support': 'Support' };

function mapNotesHtml(map) {
  var notes = (window.MAP_NOTES || {})[map];
  if (!notes) return '<p class="muted small">No curated notes for this map.</p>';
  return '<ul class="small" style="margin:0;padding-left:18px">' + notes.map(function (n) {
    return '<li>' + esc(n[0]) + ' <span class="tag ' + (n[1] === 'source' ? 'source' : 'judgment') + '">' + esc(n[1]) + '</span> <span class="muted">' + esc(n[2] || '') + '</span></li>';
  }).join('') + '</ul>';
}
function roleShapes(games, map) {
  var t = {};
  games.forEach(function (g) {
    if (g.map !== map) return;
    [0, 1].forEach(function (s) {
      if (g.picks[s].length < 5) return;
      var k = g.picks[s].map(function (h) { return ROLE_ABBR[heroRole(h)] || '?'; }).sort().join(' + ');
      var e = t[k] || (t[k] = { k: k, n: 0, wins: 0 });
      e.n++; if (g.winner === s) e.wins++;
    });
  });
  return Object.keys(t).map(function (k) { var e = t[k]; return Object.assign(e, E.rate(e.wins, e.n)); }).sort(function (a, b) { return b.n - a.n; });
}

RENDER.maps = function (p) {
  var games = App.selAll; // the map filter does not apply here
  if (!games.length) { p.innerHTML = emptyMsg(); return; }
  var abm = E.archetypeByMap(games), maps = App.data.options.maps.map(function (m) { return m.value; }).filter(function (m) { return abm[m]; });
  if (!M.map || maps.indexOf(M.map) < 0) M.map = maps[0];
  var h = '<div class="stack"><div class="card"><div class="row between"><h3>Maps in the selection</h3><span class="small muted">Archetype names come from a classifier on the hero matrix, so they describe comps, not intent.</span></div><div class="chips" style="margin-top:8px">' +
    maps.map(function (m) { var a = abm[m]; return '<button class="fchip" data-act="map-pick" data-v="' + esc(m) + '" aria-pressed="' + (M.map === m) + '">' + esc(m) + '<span class="n">' + a.n + '</span></button>'; }).join('') + '</div></div><div id="m-detail" class="stack"></div>';
  var other = Object.keys(window.MAP_NOTES || {}).filter(function (m) { return !abm[m]; });
  if (other.length) h += '<div class="card"><details class="acc"><summary>Other battlegrounds with no games in this selection</summary><div class="stack" style="margin-top:8px">' + other.map(function (m) { return '<div><h4>' + esc(m) + '</h4>' + mapNotesHtml(m) + '</div>'; }).join('') + '</div></details></div>';
  p.innerHTML = h + '</div>';
  drawMap();
};
ACT['map-pick'] = function (el) { M.map = el.getAttribute('data-v'); $$('[data-act="map-pick"]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === M.map); }); drawMap(); };

function drawMap() {
  var games = App.selAll, map = M.map, s = E.mapSummary(App.data, games, map), abm = E.archetypeByMap(games)[map];
  var h = '<div class="card"><div class="row between"><h2>' + esc(map) + '</h2><span>' + nn(s.n) + ' games' + lowb(s.low) + '</span></div>';
  h += '<p class="small muted">Winners on this map in the selection: ' + s.winnerArchetypes.slice(0, 3).map(function (w) { return esc(w.arch) + ' (' + w.wins + ' wins)'; }).join(', ') + '. Results show association, not cause.</p></div>';
  // archetypes
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Comp archetypes here ' + tag('data') + '</h3>' + table(['Archetype', { t: 'Win rate', c: 'r' }, { t: 'Seen', c: 'r' }, 'Share'], s.archetypes.slice().sort(function (a, b) { return b.shrunk - a.shrunk; }).map(function (a) {
    return '<tr><td>' + esc(a.arch) + '</td><td class="r num">' + pct(a.shrunk) + '</td><td class="r num">' + a.n + lowb(a.low) + '</td><td style="width:90px">' + bar(a.share * 3) + '</td></tr>';
  })) + '<p class="small muted" style="margin-top:6px">Win rate is shrunk toward 50% (prior of ' + E.PRIOR + ' games). Rows with fewer than ' + E.LOW_N + ' games are leans only.</p></div>';
  var shapes = roleShapes(games, map).slice(0, 7);
  h += '<div class="card"><h3>Most common comp shapes ' + tag('data') + '</h3>' + table(['Role mix', { t: 'Win rate', c: 'r' }, { t: 'Seen', c: 'r' }], shapes.map(function (a) {
    return '<tr><td>' + esc(a.k) + '</td><td class="r num">' + pct(a.shrunk) + '</td><td class="r num">' + a.n + lowb(a.low) + '</td></tr>';
  })) + '<p class="small muted" style="margin-top:6px">Full hero lists almost never repeat, so comps are grouped by role mix.</p></div></div>';
  // heroes
  var th = s.topHeroes.slice(0, 12);
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Most picked heroes here ' + tag('data') + '</h3>' + table(['Hero', { t: 'Picks', c: 'r' }, { t: 'Win rate', c: 'r' }, { t: 'vs own avg', c: 'r' }], th.map(function (x) {
    return '<tr><td>' + hn(x.hero) + '</td><td class="r num">' + x.picks + lowb(x.low) + '</td><td class="r num">' + pct(x.mapShrunk) + '</td><td class="r num ' + (x.delta > 0 ? 'pos' : 'neg') + '">' + sgn(x.delta * 100) + ' pts</td></tr>';
  })) + '<p class="small muted" style="margin-top:6px">"vs own avg" is the hero\'s map win rate minus its overall rate in the selection, shrunk with a prior of ' + E.MAP_PRIOR + ' games.</p></div>';
  h += '<div class="card"><h3>Bans and winning pairs ' + tag('data') + '</h3><h4>Top bans on this map</h4><div class="row" style="margin:6px 0 10px">' + s.topBans.slice(0, 8).map(function (b) { return '<span class="hm">' + hn(b.hero) + ' <span class="small muted num">' + pct(b.banRate, 0) + '</span></span>'; }).join('') + '</div>' +
    '<h4>Hero pairs that won most often together</h4><div class="stack" style="gap:4px;margin-top:6px">' + (s.winningPairs.slice(0, 6).map(function (w) { return '<div class="row between"><span class="row">' + hn(w.a) + '<span class="muted">+</span>' + hn(w.b) + '</span><span class="small muted num">' + w.wins + ' wins</span></div>'; }).join('') || '<span class="muted small">No pairs</span>') + '</div></div></div>';
  // build for
  var b = s.buildFor, prof = s.profile;
  h += '<div class="card"><h3>Build for this map ' + tag('judgment') + '</h3>';
  if (prof) h += '<p class="small">What this map rewards in the hero matrix: ' + Object.keys(prof).map(function (k) { return '<span class="pill">' + esc(k.replace(/_/g, ' ')) + ' x' + prof[k] + '</span>'; }).join(' ') + '</p>';
  h += '<p class="small muted">These weights are authored by judgment for this tool. Heroes below fit them best by their matrix ratings. This is a kit based idea, not a result from games.</p>';
  if (b && b.heroes && b.heroes.length) h += '<div class="grid3">' + b.heroes.slice(0, 12).map(function (x) {
    return '<div class="row between" style="border-bottom:1px solid var(--line);padding-bottom:4px"><div>' + hn(x.hero) + '<div class="small muted">' + esc(x.role) + ': ' + esc(x.why) + '</div></div><span class="num small">' + x.fit.toFixed(2) + '</span></div>';
  }).join('') + '</div>';
  else h += '<p class="muted small">No profile for this map.</p>';
  h += '</div>';
  h += '<div class="card"><h3>Objective and rotation notes</h3>' + mapNotesHtml(map) + '</div>';
  $('#m-detail').innerHTML = h;
}
