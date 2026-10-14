/* HotS Tools: My Games pages. Renders into the shell's native container. Needs HotsGames (engine.js) and HotsShell. */
(function () {
  'use strict';
  var G = window.HotsGames;
  var S = null;           // shell API, set on first render
  var STORE = 'hots.games.v1';
  var MG = {
    games: [], battletag: '', persisted: true, loaded: false,
    f: { types: null, range: 'all', roles: [], maps: [] },
    pending: null, hero: null, hq: '', hrole: 'All', hsort: 'n', hdir: -1, minN: 1, msg: '', mapq: ''
  };
  var RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['180', 'Last 6 months'], ['365', 'Last year'], ['all', 'All time']];
  var ROLE_CLS = { 'Tank': 'Tank', 'Bruiser': 'Bruiser', 'Melee Assassin': 'Melee', 'Ranged Assassin': 'Ranged', 'Healer': 'Healer', 'Support': 'Support' };

  /* ------------------------------------------------------------ helpers */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pct(x, d) { return G.pct(x, d == null ? 0 : d); }
  function pct1(x) { return G.pct(x, 1); }
  function f1(x) { return x == null ? 'n/a' : Number(x).toFixed(1); }
  function k(x) { return x == null ? 'n/a' : (x >= 1000 ? (x / 1000).toFixed(1) + 'k' : String(Math.round(x))); }
  function dstr(t) { if (t == null) return 'n/a'; var d = new Date(t); return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  function mins(sec) { if (sec == null) return 'n/a'; return Math.floor(sec / 60) + ':' + ('0' + Math.round(sec % 60)).slice(-2); }
  function initials(n) { var w = String(n).replace(/^The /, '').split(/[\s.]+/).filter(Boolean); return w.length > 1 ? (w[0][0] + w[1][0]).toUpperCase() : String(n).slice(0, 2); }
  function roleOf(h) { var m = S.matrix().heroes[h]; return m ? m.role : ''; }
  function hn(h, role) { return '<span class="hn"><span class="hchip ' + (ROLE_CLS[role || roleOf(h)] || 'Support') + '">' + esc(initials(h)) + '</span>' + esc(h) + '</span>'; }
  function low(n) { return n < G.LOW_N ? ' <span class="tag warn" title="Fewer than ' + G.LOW_N + ' games. A lean, not a rule.">low sample</span>' : ''; }
  function wl(w, l) { return w + '-' + l; }
  function wrCell(r) {
    var v = r.wr == null ? 0 : r.wr, cls = v >= 0.52 ? 'good' : v <= 0.48 ? 'bad' : '';
    return '<span class="num">' + pct(r.wr) + '</span> <span class="bar ' + cls + '"><i style="width:' + Math.round(v * 100) + '%"></i></span>';
  }
  function edgeCell(e) { if (e == null) return '<span class="muted">n/a</span>'; var v = e * 100; return '<span class="num ' + (v >= 3 ? '' : '') + '" style="color:var(' + (v >= 3 ? '--good' : v <= -3 ? '--bad' : '--muted') + ')">' + (v > 0 ? '+' : '') + v.toFixed(1) + '</span>'; }

  /* ------------------------------------------------------------ storage */
  function persist() {
    var ok = S.lsSet(STORE, { battletag: MG.battletag, games: MG.games });
    MG.persisted = ok; S.lsSet('hots.games.count', MG.games.length);
    return ok;
  }
  function loadSaved() {
    if (MG.loaded) return; MG.loaded = true;
    var s = S.lsGet(STORE, null), p = S.personal && S.personal();
    if (s && Array.isArray(s.games)) { MG.games = s.games; MG.battletag = s.battletag || ''; }
    else if (p && p.games) {   // personal edition: the owner's games are already here
      MG.games = p.games.slice(); G.canonHeroes(MG.games, Object.keys(S.matrix().heroes)); MG.battletag = p.battletag || '';
      MG.f = { types: p.filters && p.filters.types || null, range: p.filters && p.filters.range || 'all', roles: [], maps: [] };
      persist(); saveFilters();
      return;
    }
    var f = S.lsGet('hots.games.filters', null);
    if (f) MG.f = { types: f.types || null, range: f.range || 'all', roles: f.roles || [], maps: f.maps || [] };
  }
  function saveFilters() { S.lsSet('hots.games.filters', MG.f); }
  function ctx() {
    var meta = S.meta() || {};
    return { matrix: S.matrix(), global: meta.global || {} };
  }
  function setGames(games, tag) {
    G.canonHeroes(games, Object.keys(S.matrix().heroes));
    MG.games = games; if (tag != null) MG.battletag = tag;
    var sl = games.filter(function (g) { return g.type === 'sl'; }).length;
    MG.f.types = sl >= 30 ? ['sl'] : null;
    MG.f.roles = []; MG.f.maps = []; MG.hero = null; MG.pending = null;
    persist(); saveFilters();
  }
  function modes() { return G.modeCounts(MG.games); }
  // null means every mode. A saved list that names no mode in these games counts as every mode too.
  function activeTypes() {
    var t = MG.f.types && MG.f.types.length ? MG.f.types : null;
    if (t) { var have = modes().map(function (m) { return m.type; }); t = t.filter(function (x) { return have.indexOf(x) >= 0; }); }
    return t && t.length ? t : null;
  }
  function latestT() {
    var m = null;
    MG.games.forEach(function (g) { if (g.t != null && (m == null || g.t > m)) m = g.t; });
    return m == null ? Date.now() : m;
  }
  // games that pass every filter except the group named in skip: this is what a chip in that group would give you
  function selectedWithout(skip) {
    var f = { maps: MG.f.maps };
    if (skip !== 'types') f.types = activeTypes();
    if (skip !== 'roles') f.roles = MG.f.roles;
    if (MG.f.range !== 'all') f.since = latestT() - Number(MG.f.range) * 86400000;
    return G.applyFilter(MG.games, f);
  }
  function selected() { return selectedWithout(''); }
  function filtersActive() { return !!(activeTypes() || MG.f.range !== 'all' || MG.f.roles.length || MG.f.maps.length); }

  /* ------------------------------------------------------------ charts */
  function lineChart(pts, o) {
    o = o || {};
    if (!pts || pts.length < 2) return '<p class="small muted">Not enough points to draw a chart yet.</p>';
    var W = 640, H = o.h || 170, L = 40, R = 10, T = 10, B = 22;
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = o.yMin != null ? o.yMin : Math.min.apply(null, ys), y1 = o.yMax != null ? o.yMax : Math.max.apply(null, ys);
    if (y1 === y0) { y1 += 1; y0 -= 1; }
    var pad = (y1 - y0) * 0.08; if (o.yMin == null) y0 -= pad; if (o.yMax == null) y1 += pad;
    var sx = function (x) { return L + (x - x0) / (x1 - x0 || 1) * (W - L - R); }, sy = function (y) { return T + (1 - (y - y0) / (y1 - y0)) * (H - T - B); };
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join('');
    var grid = '', i, v;
    for (i = 0; i <= 3; i++) { v = y0 + (y1 - y0) * i / 3; grid += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(v).toFixed(1) + '" y2="' + sy(v).toFixed(1) + '"/><text x="' + (L - 6) + '" y="' + (sy(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(o.yFmt ? o.yFmt(v) : Math.round(v)) + '</text>'; }
    var ref = o.ref != null ? '<line class="ref" x1="' + L + '" x2="' + (W - R) + '" y1="' + sy(o.ref).toFixed(1) + '" y2="' + sy(o.ref).toFixed(1) + '"/>' : '';
    var xl = [0, Math.floor((pts.length - 1) / 2), pts.length - 1].map(function (j, n) {
      return '<text x="' + sx(pts[j].x).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (n === 0 ? 'start' : n === 2 ? 'end' : 'middle') + '">' + esc(o.xFmt ? o.xFmt(pts[j].x) : pts[j].x) + '</text>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Chart') + '">' + grid + ref + '<path class="ln" d="' + path + '"/>' + xl + '</svg>';
  }
  function pips(games, n) {
    var d = games.filter(function (g) { return g.t != null; }).slice(-n);
    return '<div class="pips" aria-label="Last ' + d.length + ' games, oldest first">' + d.map(function (g) { return '<span class="pip ' + (g.won ? 'w' : '') + '" title="' + esc(g.hero + ' on ' + g.map + ' (' + (g.won ? 'win' : 'loss') + ')') + '"></span>'; }).join('') + '</div>';
  }

  /* ------------------------------------------------------------ filter bar */
  // Every count on a chip is what you get if you pick that chip with the other filters as they are now.
  function filterBar(all, sel) {
    var ms = modes(), types = activeTypes(), modeCtx = selectedWithout('types'), roleCtx = selectedWithout('roles');
    var mc = {}, rc = {};
    modeCtx.forEach(function (g) { mc[g.type] = (mc[g.type] || 0) + 1; });
    roleCtx.forEach(function (g) { if (g.role) rc[g.role] = (rc[g.role] || 0) + 1; });
    var roles = G.roleTable(all).map(function (r) { return r.key; }).filter(Boolean);
    var rangeLabel = (RANGES.filter(function (r) { return r[0] === MG.f.range; })[0] || RANGES[4])[1].toLowerCase();
    var modeName = function (t) { return (G.MODE_NAMES && G.MODE_NAMES[t]) || t; };
    var chips = '<button class="chip" data-mode="*" aria-pressed="' + (!types) + '" title="Every game mode">All modes <span class="muted">' + modeCtx.length.toLocaleString() + '</span></button>' +
      ms.map(function (m) {
        var n = mc[m.type] || 0;
        return '<button class="chip' + (n ? '' : ' dim') + '" data-mode="' + m.type + '" aria-pressed="' + !!(types && types.indexOf(m.type) >= 0) + '"' + (n ? '' : ' title="No games in this mode with the period and roles chosen"') + '>' + esc(m.name) + ' <span class="muted">' + n.toLocaleString() + '</span></button>';
      }).join('');
    var what = (types ? types.map(modeName).join(' + ') : 'all modes') + ', ' + rangeLabel + (MG.f.roles.length ? ', ' + MG.f.roles.join(' + ') : '') + (MG.f.maps.length ? ', ' + MG.f.maps.length + ' map' + (MG.f.maps.length > 1 ? 's' : '') : '');
    return '<section class="card"><div class="row between"><div class="chips" aria-label="Game modes">' + chips +
      '</div><div class="row"><label class="f" style="min-width:150px">Period<select id="f-range">' + RANGES.map(function (r) { return '<option value="' + r[0] + '"' + (MG.f.range === r[0] ? ' selected' : '') + '>' + r[1] + '</option>'; }).join('') + '</select></label></div></div>' +
      (roles.length > 1 ? '<div class="chips" style="margin-top:8px" aria-label="Roles">' + roles.map(function (r) { var n = rc[r] || 0; return '<button class="chip' + (n || MG.f.roles.indexOf(r) >= 0 ? '' : ' dim') + '" data-role="' + esc(r) + '" aria-pressed="' + (MG.f.roles.indexOf(r) >= 0) + '">' + esc(r) + ' <span class="muted">' + n.toLocaleString() + '</span></button>'; }).join('') + '</div>' : '') +
      '<p class="small muted" style="margin:8px 0 0"><b class="num">' + sel.length.toLocaleString() + '</b> of ' + all.length.toLocaleString() + ' games selected (' + esc(what) + ')' + (MG.battletag ? ' for ' + esc(MG.battletag) : '') +
      '. The period counts back from your newest game, ' + esc(dstr(latestT())) + '.' +
      (filtersActive() ? ' <button class="btn sm" data-act="show-all">Show all games</button>' : '') +
      (!MG.persisted ? ' <span class="tag warn">not saved on this device</span>' : '') + '</p></section>';
  }

  /* ------------------------------------------------------------ pages */
  function pageImport() {
    var st = modes(), have = MG.games.length;
    var snip = SNIPPET;
    var pend = MG.pending ? pendingCard() : '';
    return (have ? '<section class="card us"><h3>Your games</h3><p><b>' + have.toLocaleString() + '</b> games are loaded' + (MG.battletag ? ' for <b>' + esc(MG.battletag) + '</b>' : '') + ': ' + st.map(function (m) { return m.n.toLocaleString() + ' ' + esc(m.name); }).join(', ') + '.' +
      (MG.persisted ? ' They are saved on this device only.' : ' <span class="tag warn">This browser would not save them, so download a backup before you leave.</span>') + '</p>' +
      '<div class="row"><button class="btn primary" data-go="mygames/overview">See my overview</button><button class="btn" data-act="dl-json">Download backup (JSON)</button><button class="btn" data-act="dl-csv">Download CSV</button><button class="btn" data-act="clear">Remove my games</button></div></section>' : '') +
      pend +
      '<div class="grid g2">' +
      '<section class="card"><h3>1. From Heroes Profile (recommended)</h3>' +
      '<p class="small muted">Heroes Profile already holds every game you have played. This snippet runs in your own browser, on your own Heroes Profile page, reads your match history one page at a time and saves a file. Nothing goes to us or to anyone else.</p>' +
      '<ol class="steps"><li>Open your player page on <b>heroesprofile.com</b> (the address looks like <span class="kbd">heroesprofile.com/Player/YourName/12345/1</span>) and let the page load fully.</li>' +
      '<li>Press <span class="kbd">F12</span>, open the <b>Console</b> tab, paste the snippet below and press Enter. It takes about 3 seconds per 100 games.</li>' +
      '<li>A file named <span class="kbd">hots-games-YourName.json</span> downloads. Drop it in the box on this page.</li></ol>' +
      '<div class="row"><button class="btn primary sm" data-act="copy-snippet">Copy the snippet</button><button class="btn sm" data-act="show-snippet">Show it</button></div>' +
      '<pre class="code" id="snip" hidden>' + esc(snip) + '</pre>' +
      '<p class="small muted">If Heroes Profile asks you to pass a check or says to slow down, pass the check, wait a minute and run it again. It stops on its own, and pages it already fetched are kept.</p></section>' +
      '<section class="card"><h3>2. Drop a file or paste</h3>' +
      '<div class="drop" id="drop" tabindex="0" role="button" aria-label="Choose a file or drop it here">Drop a <b>.json</b> or <b>.csv</b> file here<br><span class="small">or click to choose one</span></div>' +
      '<input type="file" id="file" accept=".json,.csv,.txt,application/json,text/csv" multiple hidden>' +
      '<label class="f" style="margin-top:10px">Or paste text<textarea id="paste" placeholder="Paste a Heroes Profile match history page, an export, or CSV rows"></textarea></label>' +
      '<div class="row" style="margin-top:8px"><button class="btn" data-act="parse-paste">Read pasted text</button><button class="btn" data-act="csv-template">Download a CSV template</button></div>' +
      '<p class="small muted">CSV needs a <b>hero</b> and a <b>result</b> column. Date, map, role, mode, kills, assists, deaths, hero damage, healing, siege damage and mmr are all optional.</p></section>' +
      '</div>' +
      '<div class="grid g2">' +
      '<section class="card"><h3>3. Add a game by hand</h3>' + manualForm() + '</section>' +
      '<section class="card"><h3>4. Just looking?</h3><p class="small muted">Load an example set of about 800 Storm League games from a real Diamond player, so you can see every page filled in. Your own games are not touched until you choose to replace them.</p>' +
      '<div class="row"><button class="btn primary" data-act="example">Load the example games</button></div>' +
      '<h4 style="margin-top:14px">What gets imported</h4><p class="small muted">Per game: date, mode, map, hero, role, win or loss, level, kills, assists, deaths, takedowns, hero, siege and minion damage, healing, damage taken, experience, time dead, camps, MMR and the talents you took. Heroes Profile does not have who you played with or against, so those are not here.</p></section>' +
      '</div>';
  }
  function manualForm() {
    var heroes = Object.keys(S.matrix().heroes).sort(), maps = (S.meta().maps || []);
    var today = new Date().toISOString().slice(0, 10);
    return '<div class="grid g2"><label class="f">Hero<input type="text" id="m-hero" list="m-heroes" placeholder="Hero" autocomplete="off"></label>' +
      '<label class="f">Result<select id="m-res"><option value="1">Win</option><option value="0">Loss</option></select></label>' +
      '<label class="f">Map<select id="m-map"><option value="">Unknown</option>' + maps.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Mode<select id="m-mode"><option value="sl">Storm League</option><option value="ud">Unranked Draft</option><option value="qm">Quick Match</option><option value="ar">ARAM</option><option value="tl">Team League</option></select></label>' +
      '<label class="f">Date<input type="date" id="m-date" value="' + today + '"></label>' +
      '<label class="f">Deaths (optional)<input type="number" id="m-d" min="0" max="40"></label></div>' +
      '<datalist id="m-heroes">' + heroes.map(function (h) { return '<option value="' + esc(h) + '">'; }).join('') + '</datalist>' +
      '<div class="row" style="margin-top:8px"><button class="btn" data-act="add-game">Add this game</button><span class="small err" id="m-msg"></span></div>';
  }
  function pendingCard() {
    var p = MG.pending, r = p.r, ms = G.modeCounts(r.games);
    var dated = r.games.filter(function (g) { return g.t != null; }).sort(function (a, b) { return a.t - b.t; });
    var added = G.mergeGames(MG.games, r.games);
    var srcName = { 'heroes-profile': 'Heroes Profile match history', 'hots-tools': 'a HotS Tools export', csv: 'a CSV file' }[r.source] || r.source;
    return '<section class="card accent"><h3>Ready to import</h3><p>Found <b>' + r.games.length.toLocaleString() + '</b> games in ' + esc(p.name || 'your text') + ' (' + esc(srcName) + ')' +
      (dated.length ? ', from ' + dstr(dated[0].t) + ' to ' + dstr(dated[dated.length - 1].t) : '') + '.</p>' +
      '<p class="small muted">' + ms.map(function (m) { return m.n + ' ' + esc(m.name); }).join(', ') + (MG.games.length ? '. ' + added.added + ' are new to you and ' + added.duplicates + ' are already loaded.' : '.') + '</p>' +
      (r.warnings.length ? '<div class="note">' + r.warnings.map(esc).join('<br>') + '</div>' : '') +
      '<div class="row" style="margin-top:8px">' + (r.games.length ? '<button class="btn primary" data-act="commit-merge">' + (MG.games.length ? 'Add to my games' : 'Import these games') + '</button>' + (MG.games.length ? '<button class="btn" data-act="commit-replace">Replace my games</button>' : '') : '') +
      '<button class="btn" data-act="cancel-pending">Cancel</button></div></section>';
  }

  function emptyState(what) {
    return '<section class="card"><h3>' + esc(what || 'No games yet') + '</h3><p class="muted">Import your games first, or load the example to see how this page looks.</p>' +
      '<div class="row"><button class="btn primary" data-go="mygames/import">Import my games</button><button class="btn" data-act="example">Load the example</button></div></section>';
  }

  function pageOverview(all, sel) {
    var ov = G.overview(sel), c = ctx(), ins = G.insights(sel, c), roles = G.roleTable(sel);
    var roll = G.rolling(sel, Math.min(30, Math.max(10, Math.floor(sel.length / 6))));
    var mm = G.mmrSeries(sel, 'mmr');
    var rank = ov.mmrNow != null ? G.rankFromMmr(ov.mmrNow) : null;
    var mon = G.monthly(sel).slice(-12);
    return '<div class="grid g4">' +
      '<div class="stat"><span>Win rate</span><b>' + pct1(ov.wr) + '</b><small>' + wl(ov.wins, ov.losses) + ' over ' + ov.n.toLocaleString() + ' games</small><small>likely ' + pct(ov.ci[0]) + ' to ' + pct(ov.ci[1]) + '</small></div>' +
      '<div class="stat"><span>MMR</span><b>' + (ov.mmrNow != null ? ov.mmrNow : 'n/a') + '</b><small>' + (rank ? 'about ' + esc(rank) : 'no MMR in these games') + '</small>' + (ov.mmrPeak != null ? '<small>peak ' + ov.mmrPeak + '</small>' : '') + '</div>' +
      '<div class="stat"><span>KDA</span><b>' + f1(ov.kda) + '</b><small>' + f1(ov.deaths) + ' deaths a game</small></div>' +
      '<div class="stat"><span>Per game</span><b>' + k(ov.hd) + '</b><small>hero damage</small><small>' + k(ov.sd) + ' siege, ' + k(ov.heal) + ' healing</small></div></div>' +
      '<div class="grid g2"><section class="card"><h3>What stands out</h3><ul class="ins">' + ins.map(function (i) { return '<li class="' + i.kind + '">' + esc(i.text) + '</li>'; }).join('') + '</ul>' +
      '<p class="small muted">Only things that clear a sample size bar are listed. Win rates are compared with the global Storm League rate for that hero when we have it.</p></section>' +
      '<section class="card"><h3>Recent form</h3>' + pips(sel, 40) + '<p class="small muted">Last 40 games, oldest first. Green is a win.</p>' +
      '<h4 style="margin-top:12px">Win rate over time</h4>' + lineChart(roll.map(function (p) { return { x: p.t, y: p.wr * 100 }; }), { yFmt: function (v) { return Math.round(v) + '%'; }, xFmt: function (t) { return new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }, ref: 50, label: 'Rolling win rate' }) +
      '<p class="small muted">Rolling window of ' + Math.min(30, Math.max(10, Math.floor(sel.length / 6))) + ' games.</p></section></div>' +
      (mm.length > 5 ? '<section class="card"><h3>MMR</h3>' + lineChart(mm.map(function (p) { return { x: p.t, y: p.v }; }), { xFmt: function (t) { return new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }, label: 'MMR over time' }) + '<p class="small muted">Your player MMR after each game in the selection.</p></section>' : '') +
      '<div class="grid g2"><section class="card"><h3>By role</h3><div class="scroll"><table><thead><tr><th>Role</th><th class="r">Games</th><th>Win rate</th><th class="r">Heroes</th><th class="r">Role MMR</th></tr></thead><tbody>' +
      roles.map(function (r) { return '<tr><td>' + esc(r.key) + '</td><td class="r num">' + r.n + '</td><td>' + wrCell(r) + '</td><td class="r num">' + r.heroes + '</td><td class="r num">' + (r.rmmr || '') + '</td></tr>'; }).join('') + '</tbody></table></div></section>' +
      '<section class="card"><h3>By month</h3><div class="scroll"><table><thead><tr><th>Month</th><th class="r">Games</th><th>Win rate</th></tr></thead><tbody>' +
      mon.map(function (m) { return '<tr><td>' + esc(m.key) + '</td><td class="r num">' + m.n + '</td><td>' + wrCell(m) + low(m.n) + '</td></tr>'; }).join('') + '</tbody></table></div></section></div>';
  }

  function sortHeroes(rows) {
    var key = MG.hsort, dir = MG.hdir;
    return rows.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (key === 'key') return dir * String(x).localeCompare(String(y));
      if (x == null) x = -1e9; if (y == null) y = -1e9;
      return (x - y) * dir;
    });
  }
  function pageHeroes(all, sel) {
    if (MG.hero) return heroDetail(all, sel, MG.hero);
    var rows = G.heroTable(sel, ctx().global).filter(function (r) { return r.n >= MG.minN; });
    var q = MG.hq.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return r.key.toLowerCase().indexOf(q) >= 0; });
    if (MG.hrole !== 'All') rows = rows.filter(function (r) { return r.role === MG.hrole; });
    rows = sortHeroes(rows);
    var th = function (key, label, cls) { return '<th class="' + (cls || '') + '" data-sort="' + key + '">' + label + (MG.hsort === key ? (MG.hdir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; };
    return '<section class="card"><div class="row"><label class="f grow">Search<input type="search" id="hq" value="' + esc(MG.hq) + '" placeholder="Hero name" autocomplete="off"></label>' +
      '<label class="f" style="width:150px">Role<select id="hrole"><option>All</option>' + G.ROLES.map(function (r) { return '<option' + (MG.hrole === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" style="width:130px">Min games<select id="hmin">' + [1, 3, 5, 10, 20].map(function (n) { return '<option value="' + n + '"' + (MG.minN === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="small muted">"vs everyone" is your win rate minus the global Storm League win rate for that hero (percentage points). A hero below its global rate costs you; a hero above it is where you add value. Click a row for builds, maps and trend.</p>' +
      '<div class="scroll"><table><thead><tr>' + th('key', 'Hero') + th('n', 'Games', 'r') + '<th>W-L</th>' + th('wr', 'Win rate') + th('edge', 'vs everyone', 'r') + th('kda', 'KDA', 'r') + th('d', 'Deaths', 'r') + th('hd', 'Hero dmg', 'r') + th('lastPlayed', 'Last played', 'r') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr class="click" data-hero="' + esc(r.key) + '"><td>' + hn(r.key, r.role) + '</td><td class="r num">' + r.n + '</td><td class="num">' + wl(r.w, r.l) + '</td><td>' + wrCell(r) + low(r.n) + '</td><td class="r">' + edgeCell(r.edge) + '</td><td class="r num">' + f1(r.kda) + '</td><td class="r num">' + f1(r.d) + '</td><td class="r num">' + k(r.hd) + '</td><td class="r num">' + dstr(r.lastPlayed) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (rows.length ? '' : '<p class="muted">No heroes match.</p>') + '</section>';
  }
  function heroDetail(all, sel, hero) {
    var arr = sel.filter(function (g) { return g.hero === hero; });
    if (!arr.length) { MG.hero = null; return pageHeroes(all, sel); }
    var row = G.heroTable(arr, ctx().global)[0], maps = G.mapTable(arr), builds = G.builds(arr, hero), tiers = G.talentTiers(arr, hero);
    var wins = arr.filter(function (g) { return g.won && g.d != null; }), loss = arr.filter(function (g) { return !g.won && g.d != null; });
    var avg = function (a, f) { var s = 0, c = 0; a.forEach(function (g) { if (g[f] != null) { s += g[f]; c++; } }); return c ? s / c : null; };
    var roll = G.rolling(arr, Math.max(8, Math.min(20, Math.floor(arr.length / 4))));
    var mat = S.matrix().heroes[hero];
    return '<section class="card"><div class="row between"><div><button class="btn sm" data-act="back-heroes">← All heroes</button></div><div class="row"><button class="btn sm" data-guide="' + esc(hero) + '">Open hero guide</button></div></div>' +
      '<h2 style="margin-top:10px">' + hn(hero, row.role) + '</h2>' +
      '<div class="grid g4" style="margin-top:10px">' +
      '<div class="stat"><span>Win rate</span><b>' + pct1(row.wr) + '</b><small>' + wl(row.w, row.l) + ' over ' + row.n + ' games' + (row.n < G.LOW_N ? ', low sample' : '') + '</small></div>' +
      '<div class="stat"><span>Everyone</span><b>' + (row.global != null ? pct1(row.global) : 'n/a') + '</b><small>' + (row.edge != null ? 'you are ' + (row.edge > 0 ? '+' : '') + (row.edge * 100).toFixed(1) + ' points' : 'no global rate saved') + '</small></div>' +
      '<div class="stat"><span>Deaths</span><b>' + f1(row.d) + '</b><small>' + f1(avg(wins, 'd')) + ' in wins, ' + f1(avg(loss, 'd')) + ' in losses</small></div>' +
      '<div class="stat"><span>Damage a game</span><b>' + k(row.hd) + '</b><small>' + k(row.sd) + ' siege, ' + k(row.heal) + ' healing</small></div></div>' +
      (mat ? '<p class="small muted" style="margin-top:8px">Hero ratings: ' + ['wave_clear', 'camp_clear', 'siege', 'engage', 'peel', 'mobility', 'self_sustain'].map(function (x) { return x.replace(/_/g, ' ') + ' ' + ((mat.ratings || {})[x] || '?') + '/5'; }).join(', ') + '. See Learn › Hero ratings.</p>' : '') + '</section>' +
      (roll.length > 5 ? '<section class="card"><h3>Trend</h3>' + lineChart(roll.map(function (p) { return { x: p.t, y: p.wr * 100 }; }), { yFmt: function (v) { return Math.round(v) + '%'; }, xFmt: function (t) { return new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); }, ref: 50, label: 'Trend' }) + '</section>' : '') +
      '<div class="grid g2"><section class="card"><h3>By map</h3><div class="scroll"><table><thead><tr><th>Map</th><th class="r">Games</th><th>Win rate</th></tr></thead><tbody>' +
      maps.slice(0, 15).map(function (m) { return '<tr><td>' + esc(m.key) + '</td><td class="r num">' + m.n + '</td><td>' + wrCell(m) + low(m.n) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' +
      '<section class="card"><h3>Builds you played</h3>' + (builds.length ? '<div class="scroll"><table><thead><tr><th>Talents (levels 1 to 20)</th><th class="r">Games</th><th>Win rate</th></tr></thead><tbody>' + builds.slice(0, 5).map(function (b) { return '<tr><td class="small">' + b.tal.map(esc).join(' › ') + '</td><td class="r num">' + b.n + '</td><td>' + wrCell(b) + low(b.n) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="small muted">Games with identical talent picks. Small groups are noisy.</p>' : '<p class="muted small">No talent data in these games.</p>') + '</section></div>' +
      (tiers[0].n >= 15 ? '<section class="card"><h3>Talent choices by tier</h3><p class="small muted">How often you took each option and how those games went. ' + tiers[0].n + ' games with talents.</p><div class="scroll"><table><thead><tr><th>Level</th><th>Talent</th><th class="r">Taken</th><th class="r">Games</th><th>Win rate</th></tr></thead><tbody>' +
        tiers.map(function (t) { return t.rows.slice(0, 3).map(function (r, i) { return '<tr><td>' + (i === 0 ? '<b>' + t.level + '</b>' : '') + '</td><td>' + esc(r.talent) + '</td><td class="r num">' + pct(r.pick) + '</td><td class="r num">' + r.n + '</td><td>' + wrCell(r) + low(r.n) + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div></section>' : '');
  }

  function pageMaps(all, sel) {
    var mt = G.mapTable(sel), glob = ctx().global;
    var byMap = G.groupBy(sel, function (g) { return g.map; });
    var overall = G.overview(sel).wr;
    return '<section class="card"><h3>Maps</h3><div class="scroll"><table><thead><tr><th>Map</th><th class="r">Games</th><th>W-L</th><th>Win rate</th><th class="r">vs your average</th><th>Best heroes here</th></tr></thead><tbody>' +
      mt.map(function (m) {
        var hs = G.heroTable(byMap.map[m.key] || [], glob).filter(function (h) { return h.n >= 3; }).sort(function (a, b) { return b.shrunk - a.shrunk; }).slice(0, 3);
        return '<tr><td>' + esc(m.key) + '</td><td class="r num">' + m.n + '</td><td class="num">' + wl(m.w, m.l) + '</td><td>' + wrCell(m) + low(m.n) + '</td><td class="r">' + edgeCell(m.wr - overall) + '</td><td class="small">' + hs.map(function (h) { return esc(h.key) + ' <span class="muted num">' + h.w + '-' + h.l + '</span>'; }).join(', ') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="small muted">Best heroes need 3 or more games on the map. The "vs your average" column is in percentage points. Maps with fewer than 8 games are leans.</p></section>';
  }

  function pageHabits(all, sel) {
    var ss = G.sessionStats(sel), tz = -new Date().getTimezoneOffset(), tb = G.timeBuckets(sel, tz);
    var base = ss.overall.wr;
    var ov = G.overview(sel);
    var lens = {};
    ss.sessions.forEach(function (s) { var n = Math.min(s.games.length, 10); lens[n] = (lens[n] || 0) + 1; });
    var dated = sel.filter(function (g) { return g.t != null; });
    var tbl = function (rows, label) {
      return '<div class="scroll"><table><thead><tr><th>' + label + '</th><th class="r">Games</th><th>Win rate</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td>' + esc(r.key != null ? r.key : r.idx) + '</td><td class="r num">' + r.n + '</td><td>' + wrCell(r) + low(r.n) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    };
    return '<div class="grid g4">' +
      '<div class="stat"><span>Sittings</span><b>' + ss.n + '</b><small>games within 90 minutes of each other</small></div>' +
      '<div class="stat"><span>Average sitting</span><b>' + f1(ss.avgLen) + '</b><small>games, longest ' + ss.longest + '</small></div>' +
      '<div class="stat"><span>Deaths</span><b>' + f1(ov.deaths) + '</b><small>a game</small></div>' +
      '<div class="stat"><span>Time dead</span><b>' + mins(ov.dead) + '</b><small>a game</small></div></div>' +
      '<div class="grid g2"><section class="card"><h3>Win rate by game number in a sitting</h3>' + tbl(ss.byIndex.map(function (r) { return Object.assign({}, r, { key: r.idx >= 8 ? '8 or more' : 'Game ' + r.idx }); }), 'Game') +
      '<p class="small muted">Overall ' + pct(base) + '. A steady drop in later games would suggest tiredness or tilt. Look for a gap of 7 points or more with 40 or more games behind it.</p></section>' +
      '<section class="card"><h3>After losses in a row</h3>' + tbl(ss.afterLosses.map(function (r) { return Object.assign({}, r, { key: r.losses === 0 ? 'After a win or a fresh sitting' : r.losses === 3 ? 'After 3 or more losses' : 'After ' + r.losses + ' loss' + (r.losses > 1 ? 'es' : '') }); }), 'Situation') +
      '<p class="small muted">Counted inside a sitting only. If the numbers after two or three losses are clearly below your average, stopping earlier is worth a try.</p></section></div>' +
      '<div class="grid g2"><section class="card"><h3>Time of day</h3>' + (tb.hours.length ? tbl(tb.hours, 'Time (your local time)') : '<p class="muted small">No dates in these games.</p>') + '</section>' +
      '<section class="card"><h3>Day of the week</h3>' + (tb.days.length ? tbl(tb.days, 'Day') : '<p class="muted small">No dates in these games.</p>') + '</section></div>' +
      '<p class="small muted">' + dated.length + ' dated games. Time of day and weekday numbers are noisy: ignore gaps under about 6 points.</p>';
  }

  function pageCoach(all, sel) {
    var c = G.poolCoach(sel, ctx());
    if (!sel.length) return emptyState('No games in this selection');
    var con = c.concentration;
    var statusTag = { deep: '<span class="tag good">deep</span>', ok: '<span class="tag acc">ok</span>', thin: '<span class="tag warn">thin</span>', none: '<span class="tag bad">none</span>' };
    return '<section class="card"><h3>Your pool at a glance</h3>' + (con ? '<p>You played <b>' + con.heroes + '</b> heroes. <b>' + hn(con.top1) + '</b> is ' + pct(con.top1Share) + ' of your games and your top three are ' + pct(con.top3Share) + '. That is like playing about <b>' + con.effective.toFixed(1) + '</b> heroes evenly.</p>' : '') +
      '<p class="small muted">A wider pool matters because bans and picks take heroes away. About 4 or more heroes you do well on in each role you play means you are rarely stuck.</p></section>' +
      '<div class="grid g2"><section class="card"><h3>Depth by role</h3>' + (c.roles.length ? '<div class="scroll"><table><thead><tr><th>Role</th><th class="r">Games</th><th class="r">Heroes</th><th class="r">Win above 50%</th><th>Depth</th></tr></thead><tbody>' +
      c.roles.map(function (r) { return '<tr><td>' + esc(r.role) + '</td><td class="r num">' + r.n + '</td><td class="r num">' + r.solid + '</td><td class="r num">' + r.viable + '</td><td>' + statusTag[r.status] + '</td></tr>'; }).join('') + '</tbody></table></div><p class="small muted">"Heroes" counts those with 8 or more games. "Win above 50%" counts those where your win rate, nudged toward 50% for small samples, is at least 50%.</p>' : '<p class="muted small">Not enough games per role yet.</p>') + '</section>' +
      '<section class="card"><h3>If your main is banned or taken</h3>' + (c.retreat.length ? c.retreat.map(function (r) {
        return '<div style="padding:8px 0;border-top:1px solid var(--line)"><b>' + hn(r.hero) + '</b> <span class="muted small">' + r.n + ' games, ' + pct(r.wr) + ', ' + pct(r.share) + ' of your games</span><div class="small" style="margin-top:4px">' +
          (r.alts.length ? 'Fall back to: ' + r.alts.map(function (a) { return esc(a.hero) + ' <span class="muted num">' + pct(a.wr) + ' over ' + a.n + '</span>' + (a.low ? ' <span class="tag warn">low sample</span>' : ''); }).join(', ') : '<span class="tag bad">no other hero in this role has 5 or more games</span>') + '</div></div>';
      }).join('') : '<p class="muted small">Needs a hero with 15 or more games.</p>') + '</section></div>' +
      (c.rethink.length ? '<section class="card"><h3>Heroes costing you games</h3><p class="small muted">20 or more games and clearly under 50% after allowing for small samples.</p><div class="scroll"><table><thead><tr><th>Hero</th><th class="r">Games</th><th>Win rate</th><th class="r">Everyone</th><th class="r">Share of your games</th></tr></thead><tbody>' +
        c.rethink.map(function (r) { return '<tr><td>' + hn(r.hero, r.role) + '</td><td class="r num">' + r.n + '</td><td>' + wrCell(r) + '</td><td class="r num">' + (r.global != null ? pct(r.global) : 'n/a') + '</td><td class="r num">' + pct(r.share) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<p class="small muted">If your rate matches the global one, the hero is weak in general and the fix is a different hero. If you are well below the global rate, it is your build, your map or your matchups: open the hero page for those.</p></section>' : '') +
      (c.avoid.length ? '<section class="card"><h3>Hero and map pairs to avoid</h3><div class="scroll"><table><thead><tr><th>Hero</th><th>Map</th><th class="r">Games</th><th>Win rate</th></tr></thead><tbody>' +
        c.avoid.map(function (a) { return '<tr><td>' + hn(a.hero) + '</td><td>' + esc(a.map) + '</td><td class="r num">' + a.n + '</td><td>' + wrCell(a) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' : '') +
      '<section class="card us"><h3>Use this pool in the draft board</h3><p class="small muted">Sends your best heroes, with a comfort level from your results, to Team Scout › Open draft board. Its pick suggestions then lean toward heroes you play well.</p>' +
      '<div class="row"><button class="btn primary" data-act="send-pool">Send my pool to the draft board</button></div></section>' +
      '<section class="card"><h3>Worth learning next</h3>' + (c.tryNext.length ? '<p class="small muted">Heroes you have not played much, in the roles you play, ranked by how similar their ratings are to the heroes you win with, how well they do globally, and how easy they are to execute. A model, not a promise.</p>' +
        '<div class="scroll"><table><thead><tr><th>Hero</th><th>Role</th><th>Why</th><th class="r">Global win</th><th class="r">Ease</th><th></th></tr></thead><tbody>' +
        c.tryNext.map(function (t) {
          return '<tr><td>' + hn(t.hero, t.role) + '</td><td class="small">' + esc(t.role) + '</td><td class="small">Like your ' + esc(t.closest || '') + (t.like.length ? ': ' + esc(t.like.join(', ')) : '') + '</td><td class="r num">' + (t.global != null ? t.global.toFixed(1) + '%' : 'n/a') + '</td><td class="r num">' + (t.ease != null ? t.ease + '/5' : '') + '</td><td><button class="btn sm" data-guide="' + esc(t.hero) + '">Guide</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted small">Needs a few heroes with 8 or more games and a win rate above 52% to compare against.</p>') + '</section>';
  }

  /* ------------------------------------------------------------ router */
  var NEED_GAMES = { overview: 1, heroes: 1, maps: 1, habits: 1, coach: 1 };
  var TITLES = { overview: 'Overview', heroes: 'Heroes', maps: 'Maps', habits: 'Habits', coach: 'Pool coach' };
  var lastEl = null, lastPage = null;
  function render(el, page, api) {
    S = api; loadSaved();
    page = page || 'import'; lastEl = el; lastPage = page;
    var html = '';
    if (page === 'import') html = pageImport();
    else if (!MG.games.length) html = emptyState('Nothing to show yet');
    else {
      var sel = selected();
      html = filterBar(MG.games, sel);
      if (!sel.length) html += '<section class="card"><p class="muted">No games match these filters. A mode can have games that are all older than the period you picked.</p><div class="row"><button class="btn primary" data-act="show-all">Show all ' + MG.games.length.toLocaleString() + ' games</button></div></section>';
      else if (page === 'overview') html += pageOverview(MG.games, sel);
      else if (page === 'heroes') html += pageHeroes(MG.games, sel);
      else if (page === 'maps') html += pageMaps(MG.games, sel);
      else if (page === 'habits') html += pageHabits(MG.games, sel);
      else if (page === 'coach') html += pageCoach(MG.games, sel);
    }
    el.innerHTML = html;
    wire(el);
  }
  function redraw() { if (lastEl) { var sc = lastEl.parentNode.scrollTop; render(lastEl, lastPage, S); lastEl.parentNode.scrollTop = sc; } }

  /* ------------------------------------------------------------ actions */
  // Saves a file. In the published artifact the viewer grants downloads through the page capability; as a local file a plain link works.
  function download(name, text, mime) {
    var viaLink = function () {
      try {
        var blob = new Blob([text], { type: mime || 'application/json' }), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      } catch (e) { S.toast('This browser blocked the download.'); }
    };
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        window.claude.use('downloads').then(function (d) {
          if (!d) { viaLink(); return; }
          d.save({ filename: name, data: text }).then(function () { S.toast('Saved ' + name); }, function (e) { if (e && e.code !== 'declined') S.toast('Could not save the file in this view. Open the stand alone hots_tools.html file to download it.'); });
        }, viaLink);
        return;
      }
    } catch (e) { /* fall through */ }
    viaLink();
  }
  function readFiles(files) {
    var list = Array.prototype.slice.call(files), texts = [], done = 0;
    if (!list.length) return;
    list.forEach(function (f, i) {
      var r = new FileReader();
      r.onload = function () { texts[i] = r.result; if (++done === list.length) handleText(texts.join('\n'), list.length > 1 ? list.length + ' files' : f.name); };
      r.onerror = function () { texts[i] = ''; if (++done === list.length) handleText(texts.join('\n'), 'your files'); };
      r.readAsText(f);
    });
  }
  function handleText(text, name) {
    var r = G.parseImport(text);
    MG.pending = { r: r, name: name };
    if (r.battletag && !MG.battletag) MG.battletag = r.battletag;
    redraw();
  }
  function wire(el) {
    var drop = el.querySelector('#drop'), file = el.querySelector('#file');
    if (drop && file) {
      drop.addEventListener('click', function () { file.click(); });
      drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
      file.addEventListener('change', function () { readFiles(file.files); });
      ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) readFiles(e.dataTransfer.files); });
    }
    el.onclick = function (e) {
      var t = e.target;
      var m = t.closest('[data-mode]');
      if (m) {
        var want = m.dataset.mode;
        if (want === '*') MG.f.types = null;
        else {
          var cur = activeTypes(), nxt;
          if (!cur) nxt = [want];                       // from "all modes", a click picks that mode alone
          else { nxt = cur.slice(); var i = nxt.indexOf(want); if (i >= 0) nxt.splice(i, 1); else nxt.push(want); if (!nxt.length) nxt = null; }
          MG.f.types = nxt;
        }
        saveFilters(); MG.hero = null; redraw(); return;
      }
      var r = t.closest('[data-role]');
      if (r) { var i2 = MG.f.roles.indexOf(r.dataset.role); if (i2 >= 0) MG.f.roles.splice(i2, 1); else MG.f.roles.push(r.dataset.role); saveFilters(); redraw(); return; }
      var s = t.closest('[data-sort]');
      if (s) { var key = s.dataset.sort; if (MG.hsort === key) MG.hdir = -MG.hdir; else { MG.hsort = key; MG.hdir = key === 'key' ? 1 : -1; } redraw(); return; }
      var h = t.closest('tr[data-hero]');
      if (h) { MG.hero = h.dataset.hero; redraw(); el.parentNode.scrollTop = 0; return; }
      var gd = t.closest('[data-guide]');
      if (gd) { S.heroGuide(gd.dataset.guide); return; }
      var a = t.closest('[data-act]');
      if (!a) return;
      var act = a.dataset.act;
      if (act === 'back-heroes') { MG.hero = null; redraw(); }
      else if (act === 'show-all') { MG.f = { types: null, range: 'all', roles: [], maps: [] }; saveFilters(); MG.hero = null; redraw(); }
      else if (act === 'copy-snippet') { copy(SNIPPET); }
      else if (act === 'show-snippet') { var p = el.querySelector('#snip'); if (p) p.hidden = !p.hidden; }
      else if (act === 'parse-paste') { var ta = el.querySelector('#paste'); if (ta && ta.value.trim()) handleText(ta.value, 'your pasted text'); else S.toast('Paste something first.'); }
      else if (act === 'csv-template') download('hots-games-template.csv', 'date,mode,map,hero,role,result,kills,assists,deaths,hero damage,healing,mmr\n2026-10-01 20:15,sl,Cursed Hollow,Sylvanas,Ranged Assassin,win,6,9,2,64000,0,2840\n2026-10-01 20:42,sl,Dragon Shire,Sylvanas,Ranged Assassin,loss,4,6,5,58000,0,2829\n', 'text/csv');
      else if (act === 'cancel-pending') { MG.pending = null; redraw(); }
      else if (act === 'commit-merge' && MG.pending) { var res = G.mergeGames(MG.games, MG.pending.r.games); var tag = MG.pending.r.battletag; setGames(res.games, tag || MG.battletag); S.toast('Added ' + res.added + ' games.'); S.go('mygames', 'overview'); }
      else if (act === 'commit-replace' && MG.pending) { var tg = MG.pending.r.battletag; setGames(MG.pending.r.games.slice().sort(function (x, y) { return (x.t || 0) - (y.t || 0); }), tg || ''); S.toast('Replaced your games.'); S.go('mygames', 'overview'); }
      else if (act === 'example') { loadExample(); }
      else if (act === 'dl-json') download('hots-tools-games' + (MG.battletag ? '-' + MG.battletag : '') + '.json', JSON.stringify(G.toExport(MG.games, MG.battletag)));
      else if (act === 'dl-csv') download('hots-tools-games.csv', G.toCSV(MG.games), 'text/csv');
      else if (act === 'clear') { if (confirm('Remove all imported games from this device?')) { MG.games = []; MG.battletag = ''; MG.pending = null; persist(); redraw(); } }
      else if (act === 'add-game') { addManual(el); }
      else if (act === 'send-pool') { sendPool(); }
    };
    el.onchange = function (e) {
      var t = e.target;
      if (t.id === 'f-range') { MG.f.range = t.value; saveFilters(); redraw(); }
      else if (t.id === 'hrole') { MG.hrole = t.value; redraw(); }
      else if (t.id === 'hmin') { MG.minN = Number(t.value); redraw(); }
    };
    el.oninput = function (e) {
      if (e.target.id === 'hq') { MG.hq = e.target.value; var pos = e.target.selectionStart; redraw(); var n = el.querySelector('#hq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }
    };
  }
  function copy(text) {
    var done = function () { S.toast('Copied. Paste it into the Heroes Profile console.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
    ta.remove(); if (ok) done(); else { var p = document.querySelector('#snip'); if (p) p.hidden = false; S.toast('Select the snippet and copy it by hand.'); }
  }
  function loadExample() {
    var ex = S.example();
    if (!ex || !ex.games) { S.toast('No example data in this build.'); return; }
    if (MG.games.length && !confirm('Replace your loaded games with the example set?')) return;
    var games = ex.games.map(function (g) { return G.fromCompact(g); }).filter(Boolean);
    setGames(games, ex.battletag || 'Example player'); S.toast('Loaded ' + games.length + ' example games.'); S.go('mygames', 'overview');
  }
  function sendPool() {
    var sel = selected(), rows = G.heroTable(sel, ctx().global).filter(function (r) { return r.n >= 5 && r.shrunk >= 0.45; });
    if (!rows.length) { S.toast('Not enough games on any hero yet.'); return; }
    var rt = G.roleTable(sel), main = rt.length ? rt[0].key : '';
    var pool = rows.slice(0, 14).map(function (r) { return { hero: r.key, comfort: (r.n >= 15 && r.shrunk >= 0.56) ? 3 : (r.n >= 8 && r.shrunk >= 0.5) ? 2 : 1 }; });
    S.sendPool({ players: [{ name: MG.battletag || 'Me', role: main, pool: pool }] }, 'My pool from My Games');
  }
  function addManual(el) {
    var q = function (id) { return el.querySelector(id); }, hero = q('#m-hero').value.trim();
    var key = G.keyOf(hero), canon = null;
    Object.keys(S.matrix().heroes).forEach(function (n) { if (G.keyOf(n) === key) canon = n; });
    var msg = q('#m-msg');
    if (!canon) { msg.textContent = hero ? '"' + hero + '" is not a hero in the list.' : 'Type a hero first.'; return; }
    var d = q('#m-date').value, t = d ? Date.parse(d + 'T12:00:00Z') : Date.now();
    var dv = q('#m-d').value;
    var g = { id: null, t: t, type: q('#m-mode').value, map: q('#m-map').value, hero: canon, role: roleOf(canon), won: Number(q('#m-res').value),
      lvl: null, k: null, a: null, td: null, d: dv === '' ? null : Number(dv), hd: null, sd: null, st: null, mn: null, cr: null, heal: null, taken: null, xp: null, dead: null, camps: null, fto: null, mmr: null, hmmr: null, rmmr: null, award: null, tal: null };
    var res = G.mergeGames(MG.games, [g]);
    MG.games = res.games; if (!MG.battletag) MG.battletag = 'Me'; persist(); S.toast('Added ' + canon + (g.won ? ' (win)' : ' (loss)') + '.'); redraw();
  }

  /* The snippet shown to the user. Runs in the console of their own Heroes Profile page. */
  var SNIPPET = [
    '(async () => {',
    '  const m = location.pathname.match(/\\/Player\\/([^/]+)\\/(\\d+)\\/(\\d+)/i);',
    "  if (!m) { alert('Open your own Heroes Profile player page first (heroesprofile.com/Player/YourName/12345/1), then paste this again.'); return; }",
    '  const tag = decodeURIComponent(m[1]), id = m[2], region = m[3];',
    '  const nap = ms => new Promise(r => setTimeout(r, ms));',
    "  const x = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '');",
    "  const hdr = { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };",
    "  if (x) hdr['X-XSRF-TOKEN'] = x;",
    "  const T = ['level_one','level_four','level_seven','level_ten','level_thirteen','level_sixteen','level_twenty'];",
    '  const pack = g => ({ id: g.replayID, t: g.game_date, type: g.game_type && g.game_type.short_name, map: g.game_map && g.game_map.name,',
    '    hero: g.hero && g.hero.name, role: g.role, won: g.winner ? 1 : 0, lvl: g.level, k: g.kills, a: g.assists, td: g.takedowns, d: g.deaths,',
    '    hd: g.hero_damage, sd: g.siege_damage, st: g.structure_damage, mn: g.minion_damage, cr: g.creep_damage, heal: g.healing, taken: g.damage_taken,',
    '    xp: g.experience_contribution, dead: g.time_spent_dead, camps: g.merc_camp_captures, fto: g.first_to_ten, mmr: g.player_mmr,',
    '    hmmr: g.hero_mmr, rmmr: g.role_mmr, award: g.match_award, tal: T.map(k => g[k] && g[k].title || null) });',
    '  const out = []; let page = 1, last = 1, note = "";',
    '  while (page <= last && page <= 80) {',
    "    const body = { battletag: tag, blizz_id: id, region: region, game_type: ['qm','ud','hl','tl','sl','ar'], hero: null, role: null, game_map: null,",
    "      minimumgames: 0, type: 'all', page: 'hero', season: null, start_date: null, end_date: null, pagination_page: page };",
    "    let r = await fetch('/api/v1/player/match/history', { method: 'POST', headers: hdr, body: JSON.stringify(body) });",
    "    if (r.status === 403 || r.status === 429) { note = 'Heroes Profile answered ' + r.status + ' on page ' + page + '. Pass any check on the site, wait a minute, then run this again.'; break; }",
    "    if (!r.ok && r.status !== 202) { note = 'Heroes Profile answered ' + r.status + ' on page ' + page + '. Stopped. If this keeps happening, use the paste or CSV options instead.'; break; }",
    '    let j = await r.json().catch(() => null);',
    "    for (let i = 0; i < 60 && r.status === 202 && j && j.job_id; i++) { await nap(2500); r = await fetch('/api/v1/global/status/' + j.job_id, { headers: hdr }); j = await r.json().catch(() => null); if (r.status === 200) break; }",
    "    if (!j || !j.data) { note = 'Unexpected answer on page ' + page + '. Stopped.'; break; }",
    '    last = j.last_page || 1; j.data.forEach(g => out.push(pack(g)));',
    "    console.log('page', page, 'of', last, '->', out.length, 'games');",
    '    page++; await nap(3000);',
    '  }',
    "  const blob = new Blob([JSON.stringify({ format: 'hots-tools-games', version: 1, battletag: tag, games: out })], { type: 'application/json' });",
    "  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hots-games-' + tag + '.json'; a.click();",
    "  alert((note ? note + '\\n\\n' : '') + 'Saved ' + out.length + ' games to hots-games-' + tag + '.json. Drop that file into HotS Tools.');",
    '})();'
  ].join('\n');

  window.HotsGamesUI = { render: render, _state: MG, snippet: SNIPPET };
})();
