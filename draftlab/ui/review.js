/* Review tab: replay a real draft slot by slot and compare each choice with what the engine would have suggested.
   The reviewed game is left out of the data the engine sees, so it cannot know its own result. */
var Rv = { team: (window.HOTS_PRESET && window.HOTS_PRESET.team) || '', gameId: null, slot: 0, excl: null, exclId: null, cache: {} };

function rvSlots(g) {
  var fmt = E.draftFormats().filter(function (f) { return f.id === 'ngs'; })[0].slots;
  var a = g.firstPick === 1 ? 1 : 0, b = 1 - a, bi = [0, 0], pi = [0, 0], out = [];
  fmt.forEach(function (s, i) {
    var team = s.side === 'A' ? a : b, hero;
    if (s.type === 'ban') hero = g.bans[team][bi[team]++]; else hero = g.picks[team][pi[team]++];
    out.push({ i: i, type: s.type, side: s.side, team: team, hero: hero || '', n: s.type === 'ban' ? bi[team] : pi[team] });
  });
  return out;
}
function rvState(g, slots, upto) {
  var st = { map: g.map, myTeam: 0, firstPick: g.firstPick === 1 ? 1 : 0, format: 'ngs', skill: 'advanced', picks: [[], []], bans: [[], []] };
  for (var i = 0; i < upto; i++) { var s = slots[i]; (s.type === 'ban' ? st.bans : st.picks)[s.team].push(s.hero || ''); }
  return st;
}
function rvGame(id) { return App.data.games.filter(function (g) { return g.id === id; })[0] || null; }

RENDER.review = function (p) {
  if (noGames()) { p.innerHTML = emptyMsg(); return; }
  var teams = E.listTeams(App.selAll);
  var g = Rv.gameId != null ? rvGame(Rv.gameId) : null;
  var h = '<div class="stack"><div class="card"><h3>Review a draft</h3><p class="small muted">Pick a team, pick one of its games, then step through the sixteen draft slots. At each slot you see what was chosen and what the engine would have suggested from the other games in the selection. The reviewed game is left out of that data. This is a way to ask "was there something better, and why", not a verdict: the engine is a model of league results, and the players knew things it does not.</p>' +
    '<div class="row"><input type="text" id="rv-team" list="rv-teams" placeholder="Team name" autocomplete="off" style="flex:1 1 240px"><datalist id="rv-teams">' + teams.slice(0, 600).map(function (t) { return '<option value="' + esc(t.team) + '">'; }).join('') + '</datalist></div>' +
    '<div class="row" style="margin-top:8px"><span class="small muted">Most games in selection:</span>' + teams.slice(0, 8).map(function (t) { return '<button class="fchip" data-act="rv-team" data-v="' + esc(t.team) + '">' + esc(t.team) + '<span class="n">' + t.n + '</span></button>'; }).join('') + '</div></div>';
  if (Rv.team) {
    var list = App.selAll.filter(function (x) { return x.teams.some(function (t) { return String(t || '').toLowerCase() === Rv.team.toLowerCase(); }); })
      .sort(function (x, y) { return String(y.date || '').localeCompare(String(x.date || '')); });
    h += '<div class="card"><h3>Games for ' + esc(Rv.team) + ' <span class="muted small">' + list.length + ' in the selection</span></h3>' + (list.length ? '<div class="scroll" style="max-height:280px;overflow:auto">' + table(['Date', 'Against', 'Map', 'Result', 'League', ''], list.slice(0, 80).map(function (x) {
      var me = String(x.teams[0] || '').toLowerCase() === Rv.team.toLowerCase() ? 0 : 1, won = x.winner === me;
      return '<tr class="click' + (x.id === Rv.gameId ? ' sel' : '') + '" data-act="rv-game" data-v="' + x.id + '"><td class="num">' + esc(String(x.date || '')) + '</td><td>' + esc(x.teams[1 - me] || 'unknown') + '</td><td>' + esc(x.map) + '</td><td><span class="pill ' + (won ? 'good' : 'bad') + '">' + (won ? 'won' : 'lost') + '</span></td><td class="small muted">' + esc(x.key) + (x.division ? ' ' + esc(x.division) : '') + '</td><td><button class="btn sm" data-act="rv-game" data-v="' + x.id + '">Review</button></td></tr>';
    })) + '</div>' : '<p class="small muted">No games for that name in the selection. Widen the filters above.</p>') + '</div>';
  }
  if (g) h += '<div id="rv-out"></div>';
  p.innerHTML = h + '</div>';
  $('#rv-team').value = Rv.team;
  $('#rv-team').addEventListener('change', function (e) { Rv.team = e.target.value.trim(); Rv.gameId = null; App.dirty.review = false; renderActive(); });
  if (g) drawReview(g);
};
ACT['rv-team'] = function (el) { Rv.team = el.getAttribute('data-v'); Rv.gameId = null; App.dirty.review = false; renderActive(); };
ACT['rv-game'] = function (el) { Rv.gameId = +el.getAttribute('data-v'); Rv.slot = 0; Rv.excl = null; App.dirty.review = false; renderActive(); var o = $('#rv-out'); if (o && o.scrollIntoView) o.scrollIntoView(); };
ACT['rv-slot'] = function (el) { Rv.slot = +el.getAttribute('data-v'); var g = rvGame(Rv.gameId); if (g) drawReview(g); };

function drawReview(g) {
  var out = $('#rv-out'); if (!out) return;
  var slots = rvSlots(g), nm = function (t) { return g.teams[t]; };
  var a = g.firstPick === 1 ? 1 : 0, b = 1 - a;
  var firstKnown = g.firstPick === 0 || g.firstPick === 1;
  var h = '<div class="card"><div class="row between"><h3>' + esc(nm(0)) + ' <span class="muted">against</span> ' + esc(nm(1)) + '</h3><span class="small muted">' + esc(g.map) + ', ' + esc(g.key) + (g.division ? ' ' + esc(g.division) : '') + ', ' + esc(String(g.date || '')) + (g.length ? ', ' + fmtTime(g.length) : '') + '</span></div>' +
    '<p class="small">Winner: <b>' + esc(nm(g.winner)) + '</b>. ' + (firstKnown ? esc(nm(a)) + ' had first pick.' : 'First pick is not recorded for this league, so team A is assumed to be the first team listed and the order of the bans may differ.') + '</p></div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Draft order</h3><div class="stack" style="gap:4px">' + slots.map(function (s) {
    var isMe = s.team === a;
    return '<button class="hrow' + (Rv.slot === s.i ? ' on' : '') + '" data-act="rv-slot" data-v="' + s.i + '" style="display:flex;justify-content:space-between;align-items:center;gap:8px;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:6px;padding:6px 8px;' + (Rv.slot === s.i ? 'outline:2px solid var(--accent);' : '') + '">' +
      '<span class="small muted num" style="width:2.2em">' + (s.i + 1) + '</span><span style="flex:1">' + (s.hero ? hn(s.hero) : '<span class="muted">no ' + s.type + '</span>') + '</span><span class="small ' + (s.type === 'ban' ? 'muted' : '') + '">' + s.type + ', ' + esc(nm(s.team)) + '</span></button>';
  }).join('') + '</div></div><div class="card" id="rv-slot"></div></div>';
  h += '<div id="rv-end"></div>';
  out.innerHTML = h;
  drawSlot(g, slots);
  drawEnd(g);
}
function drawSlot(g, slots) {
  var s = slots[Rv.slot], el = $('#rv-slot');
  if (!s) { el.innerHTML = ''; return; }
  var st = rvState(g, slots, Rv.slot);
  st.myTeam = s.team; st.side = s.team;
  if (Rv.exclId !== g.id) { Rv.excl = App.selAll.filter(function (x) { return x.id !== g.id; }); Rv.exclId = g.id; Rv.cache = {}; }
  var key = Rv.slot, res = Rv.cache[key];
  if (!res) {
    res = Rv.cache[key] = s.type === 'ban' ? E.recommendBans(App.data, Rv.excl, st, { limit: 400 }) : E.recommendPicks(App.data, Rv.excl, st, { limit: 400 });
  }
  var items = res.items || [], rank = -1;
  items.forEach(function (it, i) { if (it.hero === s.hero) rank = i; });
  var top = items.slice(0, 5);
  var hd = '<h3>Slot ' + (s.i + 1) + ': ' + esc(g.teams[s.team]) + ' ' + s.type + '</h3>';
  if (!s.hero) { el.innerHTML = hd + '<p class="muted">Nothing was ' + (s.type === 'ban' ? 'banned' : 'picked') + ' here.</p>'; return; }
  var actual = rank >= 0 ? items[rank] : null;
  var h = hd + '<p>Chosen: <b>' + hn(s.hero) + '</b>' + (actual ? ', the engine\'s <b>#' + (rank + 1) + '</b> of ' + items.length + ' (score ' + actual.score.toFixed(1) + ').' : ' (not scored: already used, or outside the top 400).') + '</p>';
  if (actual) {
    var comps = actual.components.slice().sort(function (x, y) { return Math.abs(y.value) - Math.abs(x.value); }).filter(function (c) { return Math.abs(c.value) >= 0.3; }).slice(0, 5);
    h += '<p class="small muted" style="margin-bottom:2px">What drove that score</p><ul class="small" style="margin:0 0 8px;padding-left:18px">' + comps.map(function (c) { return '<li>' + esc(c.name) + ' ' + sgn(c.value) + (c.note ? ': ' + esc(c.note) : '') + ' ' + tag(c.basis) + '</li>'; }).join('') + '</ul>';
  }
  h += '<p class="small muted" style="margin-bottom:2px">The engine\'s top ' + top.length + ' at this point</p><ul class="small" style="margin:0;padding-left:18px">' + top.map(function (it, i) {
    return '<li>' + hn(it.hero) + ' <span class="num muted">' + it.score.toFixed(1) + '</span>' + (it.hero === s.hero ? ' <span class="pill good">chosen</span>' : '') + (it.low ? ' <span class="lowb">low sample</span>' : '') + '</li>';
  }).join('') + '</ul>';
  if (actual) {
    var frac = (rank + 1) / items.length, med = s.type === 'ban' ? 0.35 : 0.43;
    h += '<div class="note" style="margin-top:8px">' + (frac <= 0.1 ? 'This was in the top tenth of the engine\'s list.' :
      frac >= 0.83 ? 'This was in the bottom sixth of the engine\'s list. Only about 1 real choice in 10 falls this low, so it was deliberate or unusual: a pool pick, a surprise, or something the data cannot see, such as a player\'s best hero.' :
      'This sits in the ordinary range. Across about 1,000 real NGS choices the median choice lands at the ' + Math.round(med * 100) + 'th percentile of the engine\'s list, so the engine is a loose guide to what teams do, not a copy of it.') + '</div>';
  }
  h += '<p class="small muted" style="margin-top:8px">Scored on ' + Rv.excl.length + ' other games. ' + esc(res.slot && res.slot.label ? '' : '') + 'Scores are points of expected win rate from named parts; they are leans.</p>';
  el.innerHTML = h;
}
function drawEnd(g) {
  var el = $('#rv-end'); if (!el) return;
  var h = '<div class="grid2" style="align-items:start">';
  [0, 1].forEach(function (t) {
    var names = (g.picks[t] || []).filter(Boolean);
    if (names.length < 2) return;
    var rd = E.compRead(App.data, App.selAll.filter(function (x) { return x.id !== g.id; }), names, (g.picks[1 - t] || []).filter(Boolean));
    var arch = rd.archetype, miss = (arch.missing || []).slice(0, 3);
    h += '<div class="card"><h3>' + esc(g.teams[t]) + (g.winner === t ? ' <span class="pill good">won</span>' : ' <span class="pill bad">lost</span>') + '</h3>' +
      '<p class="small">' + names.map(function (x) { return hn(x); }).join(' ') + '</p>' +
      '<p class="small"><b>Reads as ' + esc(arch.label || 'unclear') + '</b> ' + tag('judgment') + '</p>' +
      (miss.length ? '<ul class="small" style="margin:0;padding-left:18px">' + miss.map(function (n) { return '<li><b>' + esc(n.label) + '</b> ' + esc(n.status) + '. ' + esc(n.note || '') + '</li>'; }).join('') + '</ul>' : '<p class="small muted">No holes flagged.</p>') +
      (rd.versusEnemy ? '<p class="small">This style against the other side\'s style (' + esc(rd.versusEnemy.enemyArchetype) + '): ' + pct(rd.versusEnemy.shrunk, 0) + ' over ' + rd.versusEnemy.n + ' league games' + lowb(rd.versusEnemy.low) + '.</p>' : '') + '</div>';
  });
  el.innerHTML = h + '</div><p class="small muted">The comp read comes from the hero matrix, which is mostly judgment, and from results in the other games. Who won a single game says little about whether the draft was good.</p>';
}
