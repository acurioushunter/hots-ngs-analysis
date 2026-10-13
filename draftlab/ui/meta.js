/* Meta tab and Scout tab. */
function heroRows(list, cols) {
  return list.map(function (x) { return '<tr><td>' + hn(x.hero) + '</td>' + cols.map(function (c) { return '<td class="r num">' + c(x) + '</td>'; }).join('') + '</tr>'; });
}
RENDER.meta = function (p) {
  if (noGames()) { p.innerHTML = emptyMsg(); return; }
  var m = E.metaSummary(App.selMap), info = m.selection;
  var h = '<div class="stack"><div class="card"><div class="row between"><h2>Meta in the selection</h2><span class="num">' + m.n + ' games' + (info.level !== 'ok' ? ' <span class="pill warn">' + (info.level === 'tiny' ? 'very small sample' : 'small sample') + '</span>' : '') + '</span></div>' +
    '<p class="small muted">' + esc(info.message) + ' Average game length ' + fmtTime(m.avgLengthSec) + '. All figures here are counts from the games, so they describe what teams did and what happened, not why. The map filter applies here.</p></div>';
  h += '<div class="grid2" style="align-items:start">';
  h += '<div class="card"><h3>Most picked ' + tag('data') + '</h3>' + table(['Hero', { t: 'Pick', c: 'r' }, { t: 'Win', c: 'r' }, { t: 'Games', c: 'r' }], heroRows(m.topPicked.slice(0, 10), [function (x) { return pct(x.pickRate, 0); }, function (x) { return pct(x.shrunk, 0); }, function (x) { return x.picks + (x.low ? ' <span class="lowb">low</span>' : ''); }])) + '</div>';
  h += '<div class="card"><h3>Most banned ' + tag('data') + '</h3>' + table(['Hero', { t: 'Ban', c: 'r' }, { t: 'Pick', c: 'r' }, { t: 'Bans', c: 'r' }], heroRows(m.topBanned.slice(0, 10), [function (x) { return pct(x.banRate, 0); }, function (x) { return pct(x.pickRate, 0); }, function (x) { return x.bans; }])) + '</div>';
  h += '<div class="card"><h3>Highest win rates, 10 or more picks ' + tag('data') + '</h3>' + table(['Hero', { t: 'Win (shrunk)', c: 'r' }, { t: 'Picks', c: 'r' }], heroRows(m.bestWinRate.slice(0, 8), [function (x) { return pct(x.shrunk); }, function (x) { return x.picks; }])) + '<p class="small muted">Strong players on favourite heroes can inflate this. Shrinking pulls small samples toward 50%.</p></div>';
  h += '<div class="card"><h3>Lowest win rates, 10 or more picks ' + tag('data') + '</h3>' + table(['Hero', { t: 'Win (shrunk)', c: 'r' }, { t: 'Picks', c: 'r' }], heroRows(m.worstWinRate.slice(0, 8), [function (x) { return pct(x.shrunk); }, function (x) { return x.picks; }]))+ '</div>';
  h += '</div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Flex picks ' + tag('data') + '</h3><p class="small muted">Heroes that show up in three or more archetypes, at least 20% of the time each. The archetype is a classifier label on the whole comp.</p>' +
    (m.flexPicks.length ? table(['Hero', { t: 'Picks', c: 'r' }, 'Seen in'], m.flexPicks.slice(0, 10).map(function (f) { return '<tr><td>' + hn(f.hero) + '</td><td class="r num">' + f.picks + '</td><td class="small">' + esc(f.archetypes.join(', ')) + '</td></tr>'; })) : '<p class="muted small">None in this selection.</p>') + '</div>';
  var fp = m.firstPick;
  h += '<div class="card"><h3>First pick and level 10 ' + tag('data') + '</h3>' +
    '<p><b>First pick team win rate:</b> ' + (fp && fp.n ? pct(fp.winRate) + ' raw, ' + pct(fp.shrunk) + ' shrunk ' + nn(fp.n) + lowb(fp.low) : 'no NGS rows in this selection') + '<br><span class="small muted">' + esc(fp ? fp.note : '') + '</span></p>';
  var l = m.lvl10;
  if (l && l.n) h += '<p><b>Team that reached level 10 first won</b> ' + pct(l.winRate) + ' of games ' + nn(l.n) + lowb(l.low) + '</p>' + table(['Lead size', { t: 'Leader won', c: 'r' }, { t: 'Games', c: 'r' }], l.buckets.map(function (b) { return '<tr><td>' + esc(b.label) + '</td><td class="r num">' + pct(b.winRate, 0) + '</td><td class="r num">' + b.n + lowb(b.low) + '</td></tr>'; })) + '<p class="small muted" style="margin-top:6px">' + esc(l.note) + '</p>';
  else h += '<p class="muted small">No level 10 data in this selection.</p>';
  h += '</div></div>';
  var ea = m.early;
  if (ea && ea.n) {
    h += '<div class="card"><h3>Early leads and what followed ' + tag('data') + '</h3><p class="small muted">From ' + ea.n + ' NGS games that carry replay timelines. Each row is how often the side that was ahead on that signal won the game.</p>' +
      table(['Signal', { t: 'Side ahead won', c: 'r' }, { t: 'Games', c: 'r' }], ea.list.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td class="r num">' + pct(x.winRate, 0) + '</td><td class="r num">' + x.n + lowb(x.low) + '</td></tr>'; })) +
      '<h4 style="margin-top:8px">Size of the 10 minute experience lead</h4>' +
      table(['Lead', { t: 'Leader won', c: 'r' }, { t: 'Games', c: 'r' }], ea.xp10Buckets.map(function (x) { return '<tr><td>' + esc(x.label) + '</td><td class="r num">' + pct(x.winRate, 0) + '</td><td class="r num">' + x.n + lowb(x.low) + '</td></tr>'; })) +
      '<p class="small muted" style="margin-top:6px">' + esc(ea.note) + '</p></div>';
  }
  var arch = m.archetypes && m.archetypes.list ? m.archetypes.list : (m.archetypes || []);
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Archetypes seen ' + tag('data') + '</h3>' + table(['Archetype', { t: 'Share', c: 'r' }, { t: 'Win (shrunk)', c: 'r' }, { t: 'Seen', c: 'r' }], arch.map(function (a) { return '<tr><td>' + esc(a.arch) + '</td><td class="r num">' + pct(a.share, 0) + '</td><td class="r num">' + pct(a.shrunk, 0) + '</td><td class="r num">' + a.n + lowb(a.low) + '</td></tr>'; })) + '<p class="small muted">Counts are team appearances, two per game.</p></div>';
  h += '<div class="card"><h3>Maps played ' + tag('data') + '</h3>' + table(['Map', { t: 'Games', c: 'r' }, 'Share'], m.maps.map(function (x) { return '<tr><td>' + esc(x.map) + '</td><td class="r num">' + x.n + '</td><td style="width:110px">' + bar(x.share * 4) + '</td></tr>'; })) + '</div></div>';
  h += '<div class="card"><h3>Trends across seasons ' + tag('data') + '</h3>' + (m.trends.length > 1 ? '<div class="grid3">' + m.trends.map(function (t) {
    return '<div><h4>' + esc(t.key) + ' <span class="muted small">n ' + t.n + '</span></h4><div class="small"><b>Top picks:</b> ' + t.topPicks.slice(0, 5).map(function (x) { return esc(disp(x.hero)) + ' ' + pct(x.pickRate, 0); }).join(', ') + '<br><b>Top bans:</b> ' + t.topBans.slice(0, 5).map(function (x) { return esc(disp(x.hero)) + ' ' + pct(x.banRate, 0); }).join(', ') + '</div></div>';
  }).join('') + '</div><p class="small muted" style="margin-top:6px">Seasons differ in league and division mix as well as in time, so a change between them is not necessarily a patch effect.</p>' : '<p class="small muted">Select two or more seasons to see a comparison.</p>') + '</div>';
  h += '<div class="card"><h3>What this data cannot show</h3><ul class="small" style="margin:0;padding-left:18px">' + m.limits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>';
  p.innerHTML = h;
};

/* ---------------------------------------------------------------- Scout */
var Sc = { team: '', q: '' };
RENDER.scout = function (p) {
  if (noGames()) { p.innerHTML = emptyMsg(); return; }
  var teams = E.listTeams(App.selMap);
  p.innerHTML = '<div class="stack"><div class="card"><h3>Scout a team</h3><p class="small muted">Type any team name from the selection. Teams are matched by exact name, case does not matter. Everything is limited to the games in the selection, so a team with few games gives only leans. The map filter applies here.</p>' +
    '<div class="row"><input type="text" id="sc-team" list="sc-teams" placeholder="Team name" autocomplete="off" style="flex:1 1 240px"><datalist id="sc-teams">' + teams.slice(0, 600).map(function (t) { return '<option value="' + esc(t.team) + '">'; }).join('') + '</datalist></div>' +
    '<div class="row" style="margin-top:8px"><span class="small muted">Most games in selection:</span>' + teams.slice(0, 8).map(function (t) { return '<button class="fchip" data-act="sc-pick" data-v="' + esc(t.team) + '">' + esc(t.team) + '<span class="n">' + t.n + '</span></button>'; }).join('') + '</div></div><div id="sc-out"></div></div>';
  $('#sc-team').value = Sc.team;
  $('#sc-team').addEventListener('change', function (e) { Sc.team = e.target.value.trim(); drawScout(); });
  $('#sc-team').addEventListener('keydown', function (e) { if (e.key === 'Enter') { Sc.team = e.target.value.trim(); drawScout(); } });
  drawScout();
};
ACT['sc-pick'] = function (el) { Sc.team = el.getAttribute('data-v'); $('#sc-team').value = Sc.team; drawScout(); };
function drawScout() {
  var out = $('#sc-out');
  if (!Sc.team) { out.innerHTML = '<div class="card empty">Choose a team above to see its record, maps, comps, heroes and ban habits.</div>'; return; }
  var s = E.scoutTeam(App.selMap, Sc.team);
  if (!s.found) { out.innerHTML = '<div class="card empty">No games for "' + esc(Sc.team) + '" in the selection.</div>'; return; }
  var r = s.record, h = '<div class="stack">';
  h += '<div class="card"><div class="row between"><h2>' + esc(s.team) + '</h2><span class="num">' + r.wins + '-' + r.losses + ' ' + nn(r.n) + lowb(r.low) + '</span></div><p class="small muted">Win rate ' + pct(r.winRate) + ' raw, ' + pct(r.shrunk) + ' shrunk toward 50%.' + (s.note ? ' ' + esc(s.note) : '') + '</p></div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Maps ' + tag('data') + '</h3>' + table(['Map', { t: 'Record', c: 'r' }, { t: 'Win', c: 'r' }], s.byMap.slice(0, 10).map(function (m) { return '<tr><td>' + esc(m.map) + '</td><td class="r num">' + m.wins + '-' + (m.n - m.wins) + lowb(m.low) + '</td><td class="r num">' + pct(m.shrunk, 0) + '</td></tr>'; })) + '</div>';
  h += '<div class="card"><h3>Comp archetypes ' + tag('data') + '</h3>' + table(['Archetype', { t: 'Record', c: 'r' }, { t: 'Win', c: 'r' }], s.archetypes.map(function (m) { return '<tr><td>' + esc(m.arch) + '</td><td class="r num">' + m.wins + '-' + (m.n - m.wins) + lowb(m.low) + '</td><td class="r num">' + pct(m.shrunk, 0) + '</td></tr>'; })) + '</div></div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Signature heroes ' + tag('data') + '</h3>' + table(['Hero', { t: 'Played', c: 'r' }, { t: 'Share', c: 'r' }, { t: 'Win', c: 'r' }], s.heroes.slice(0, 10).map(function (x) { return '<tr><td>' + hn(x.hero) + '</td><td class="r num">' + x.n + lowb(x.low) + '</td><td class="r num">' + pct(x.share, 0) + '</td><td class="r num">' + pct(x.shrunk, 0) + '</td></tr>'; })) + '</div>';
  var fp = s.firstPick;
  h += '<div class="card"><h3>Draft habits ' + tag('data') + '</h3>' + (fp && fp.known ? '<p class="small">With first pick: ' + (fp.withFirst && fp.withFirst.n ? fp.winsWithFirstPick + '-' + (fp.hadFirstPick - fp.winsWithFirstPick) : 'none') + ' ' + lowb(fp.withFirst && fp.withFirst.low) + '. With second pick: ' + (fp.withSecond && fp.withSecond.n ? fp.winsWithSecond + '-' + (fp.hadSecond - fp.winsWithSecond) : 'none') + ' ' + lowb(fp.withSecond && fp.withSecond.low) + '. First pick data exists for NGS games only.</p>' : '<p class="small muted">No first pick data for this team (Heroes Lounge rows do not record it).</p>') +
    '<h4>Opening pick when they have first pick</h4><div class="row" style="margin:4px 0 8px">' + (s.openers.slice(0, 5).map(function (x) { return '<span class="hm">' + hn(x.hero) + '<span class="small muted num">n ' + x.n + '</span></span>'; }).join('') || '<span class="small muted">none recorded</span>') + '</div>' +
    '<h4>Heroes they ban</h4><div class="row" style="margin:4px 0 8px">' + (s.bans.slice(0, 6).map(function (x) { return '<span class="hm">' + hn(x.hero) + '<span class="small muted num">n ' + x.n + '</span></span>'; }).join('') || '<span class="small muted">none</span>') + '</div>' +
    '<h4>Heroes banned against them</h4><div class="row" style="margin-top:4px">' + (s.bansAgainst.slice(0, 6).map(function (x) { return '<span class="hm">' + hn(x.hero) + '<span class="small muted num">n ' + x.n + '</span></span>'; }).join('') || '<span class="small muted">none</span>') + '</div></div></div>';
  h += '<div class="card"><h3>Where they lost ' + tag('data') + '</h3>' + (s.losses.n ? '<p class="small">' + s.losses.n + ' losses. Maps: ' + s.losses.byMap.slice(0, 5).map(function (x) { return esc(x.map) + ' ' + x.losses; }).join(', ') + '. Heroes on the losing side most: ' + s.losses.heroes.slice(0, 6).map(function (x) { return esc(disp(x.hero)) + ' ' + x.losses; }).join(', ') + '.</p><p class="small muted">Heroes appear in losses partly because they are played a lot. Compare with the signature table.</p>' : '<p class="small muted">No losses in the selection.</p>') + '</div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Suggested bans against them ' + tag('data') + '</h3>' + (s.suggestedBans.length ? table(['Hero', { t: 'Score', c: 'r' }, 'Why'], s.suggestedBans.slice(0, 6).map(function (x) { return '<tr><td>' + hn(x.hero) + '</td><td class="r num">' + x.score.toFixed(1) + '</td><td class="small">' + esc(x.why) + lowb(x.low) + '</td></tr>'; })) : '<p class="small muted">Not enough games.</p>') + '<p class="small muted">Scores weigh how often they play the hero and how often it wins for them. A lean, not a rule.</p></div>';
  var an = s.suggestedAnswers;
  h += '<div class="card"><h3>Answers that did well against them ' + tag('data') + '</h3>' + (an && an.mainArchetype ? '<p class="small">Their main archetype is <b>' + esc(an.mainArchetype) + '</b>. Archetypes that beat it in the selection:</p>' + table(['Archetype', { t: 'Win', c: 'r' }, { t: 'Games', c: 'r' }], an.archetypes.slice(0, 4).map(function (x) { return '<tr><td>' + esc(x.arch) + '</td><td class="r num">' + pct(x.shrunk, 0) + '</td><td class="r num">' + x.n + lowb(x.low) + '</td></tr>'; })) +
    (an.heroes.length ? '<h4 style="margin-top:8px">Heroes that won against their usual picks</h4><div class="stack" style="gap:4px;margin-top:4px">' + an.heroes.slice(0, 5).map(function (x) { return '<div class="row between">' + hn(x.hero) + '<span class="small muted num">' + pct(x.shrunk, 0) + ', n ' + x.n + (x.low ? ' low sample' : '') + '</span></div>'; }).join('') + '</div>' : '') : '<p class="small muted">Not enough games.</p>') + '</div></div>';
  out.innerHTML = h + '</div>';
}
