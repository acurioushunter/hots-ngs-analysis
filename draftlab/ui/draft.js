/* Draft tab: live draft board, suggestions with score breakdowns, comp read, copy summary. */
var D = { map: '', myTeam: 0, format: 'ngs', skill: 'advanced', opp: '', log: [], tgt: { side: 0, type: 'pick' }, vType: 'auto', vWho: 'next', open: {}, q: '', role: '', last: null };
var ROLES = ['Tank', 'Bruiser', 'Melee Assassin', 'Ranged Assassin', 'Healer', 'Support'];

function dState() {
  var picks = [[], []], bans = [[], []];
  D.log.forEach(function (e) { (e.type === 'ban' ? bans : picks)[e.side].push(e.hero); });
  return {
    map: D.map || null, myTeam: D.myTeam, firstPick: 0, picks: picks, bans: bans, format: D.format, skill: D.skill,
    profile: (App.useProfile && App.profile) ? App.profile : null, opponentTeam: D.opp || null, side: null, mode: null
  };
}
function usedSet() { var s = {}; D.log.forEach(function (e) { if (e.hero) s[e.hero] = 1; }); return s; }
function sideName(s) { return s === 0 ? 'Team A' : 'Team B'; }

RENDER.draft = function (p) {
  var o = App.data.options;
  if (!p.firstChild || !$('#d-board', p)) {
    var fm = E.draftFormats();
    p.innerHTML =
      '<div class="stack">' +
      '<div class="card"><div class="setup">' +
      '<label class="f">Map<select id="d-map" data-d="map"><option value="">Unknown map</option>' + o.maps.map(function (m) { return '<option value="' + esc(m.value) + '">' + esc(m.value) + ' (' + m.n + ')</option>'; }).join('') + '</select></label>' +
      '<label class="f">My team<select id="d-my" data-d="myTeam"><option value="0">Team A (first pick)</option><option value="1">Team B</option></select></label>' +
      '<label class="f">Format<select id="d-fmt" data-d="format">' + fm.map(function (f) { return '<option value="' + f.id + '">' + esc(f.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Skill level<select id="d-skill" data-d="skill">' + E.SKILLS.map(function (s) { return '<option value="' + s + '">' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f">Opponent team (optional)<input type="text" id="d-opp" list="teamlist" data-d="opp" placeholder="Type a team name" autocomplete="off"></label>' +
      '<div class="f" id="d-prof"></div></div>' +
      '<datalist id="teamlist">' + o.teams.slice(0, 500).map(function (t) { return '<option value="' + esc(t.value) + '">'; }).join('') + '</datalist>' +
      '<details class="acc"><summary>Format assumption and how scoring works</summary><div class="small muted" id="d-fmtnote"></div></details></div>' +
      '<div id="d-board"></div>' +
      '<div class="grid2" style="align-items:start"><div class="card" id="d-sugg"></div>' +
      '<div class="card" id="d-pickcard"><div class="row between"><h3>Hero list</h3><span class="small muted">Tap a hero to place it in the next slot</span></div>' +
      '<div class="row" style="margin-block:8px"><input type="search" id="d-q" placeholder="Search heroes, press Enter to place the first match" style="flex:1 1 200px" autocomplete="off" aria-label="Search heroes">' +
      '<span id="d-roles" class="chips"></span></div><div id="d-grid" class="hgrid"></div></div></div>' +
      '<div id="d-reads" class="grid2" style="align-items:start"></div></div>';
    $('#d-map').value = D.map; $('#d-my').value = D.myTeam; $('#d-fmt').value = D.format; $('#d-skill').value = D.skill; $('#d-opp').value = D.opp;
    $$('[data-d]', p).forEach(function (el) {
      el.addEventListener('change', function () {
        var k = el.getAttribute('data-d'), v = el.value;
        if (k === 'myTeam') v = +v;
        if (k === 'opp') { var ok = o.teams.some(function (t) { return t.value === v; }); if (!ok) v = ''; if (!ok) el.value = ''; }
        D[k] = v; drawDraft();
      });
    });
    $('#d-q').addEventListener('input', function (e) { D.q = e.target.value; drawGrid(); });
    $('#d-q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var b = $('#d-grid .hbtn:not([disabled])'); if (b) { place(b.getAttribute('data-hero')); e.target.value = ''; D.q = ''; drawGrid(); } }
    });
  }
  drawDraft();
};

function slotPlan(st) {
  var slot = E.nextSlot(st);
  var side, type;
  if (slot.done) { side = null; type = null; }
  else if (slot.free) { side = D.tgt.side; type = D.tgt.type; }
  else { side = slot.side; type = slot.type; }
  return { slot: slot, side: side, type: type };
}

function drawDraft() {
  var st = dState(), plan = slotPlan(st);
  D.last = { st: st, plan: plan };
  // profile control
  var pf = $('#d-prof');
  if (pf) pf.innerHTML = App.profile
    ? '<label style="display:flex;gap:6px;align-items:center;margin-bottom:8px"><input type="checkbox" id="d-useprof" ' + (App.useProfile ? 'checked' : '') + '> Use team profile (' + esc(App.profileName || 'loaded') + ')</label>'
    : '<span class="small muted" style="padding-bottom:8px">No team profile loaded. Add one in the Team tab for pool aware picks.</span>';
  var up = $('#d-useprof'); if (up) up.onchange = function () { App.useProfile = up.checked; store('useprof', App.useProfile); drawDraft(); };
  var fmt = E.draftFormats().filter(function (f) { return f.id === D.format; })[0];
  if ($('#d-fmtnote')) $('#d-fmtnote').innerHTML = esc(fmt.assumption) + '<br><br>Suggestions add named components in points, where one point is about one percentage point of win rate. Components marked judgment come from the authored hero matrix, kit from ability text, data from games or list data. Opponent habit, team pool and skill level only apply when you set them.';
  drawBoard(st, plan);
  drawSugg(st, plan);
  drawGrid();
  drawReads(st);
}

function slotHtml(side, type, idx, entry, plan) {
  var isNext = plan.side === side && plan.type === type && plan.slot && !plan.slot.done && idx === (D.last.st[type === 'ban' ? 'bans' : 'picks'][side].length);
  var lab = (type === 'ban' ? 'Ban ' : 'Pick ') + (idx + 1);
  if (entry) {
    var e = entry.e;
    var body = e.hero ? hn(e.hero) : '<span class="muted">Ban skipped</span>';
    return '<button class="slot full ' + type + '" data-act="d-remove" data-i="' + entry.i + '" title="Tap to remove">' + body + '<span class="lab">' + lab + '</span></button>';
  }
  return '<div class="slot ' + type + (isNext ? ' next' : '') + '"><span class="muted small">' + (isNext ? 'Next' : 'Empty') + '</span><span class="lab">' + lab + '</span></div>';
}
function drawBoard(st, plan) {
  var h = '';
  var nb = D.format === 'ngs' ? 3 : 0;
  var label = plan.slot.done ? 'Draft complete' : (plan.slot.free ? 'Free form: next goes to ' + sideName(D.tgt.side) + ' ' + D.tgt.type : 'Next: ' + plan.slot.label);
  h += '<div class="card"><div class="nextbar"><div><div class="small muted">Draft board</div><div class="lbl">' + esc(label) + '</div></div><div class="row">';
  if (D.format === 'free') {
    h += '<span class="seg" role="group" aria-label="Free form side"><button data-act="d-tgt" data-k="side" data-v="0" aria-pressed="' + (D.tgt.side === 0) + '">Team A</button><button data-act="d-tgt" data-k="side" data-v="1" aria-pressed="' + (D.tgt.side === 1) + '">Team B</button></span>' +
      '<span class="seg" role="group" aria-label="Free form type"><button data-act="d-tgt" data-k="type" data-v="pick" aria-pressed="' + (D.tgt.type === 'pick') + '">Pick</button><button data-act="d-tgt" data-k="type" data-v="ban" aria-pressed="' + (D.tgt.type === 'ban') + '">Ban</button></span>';
  }
  if (!plan.slot.done && plan.type === 'ban' && D.format === 'ngs') h += '<button class="btn sm" data-act="d-skip">Skip this ban</button>';
  h += '<button class="btn sm" data-act="d-undo"' + (D.log.length ? '' : ' disabled') + '>Undo</button><button class="btn sm" data-act="d-reset"' + (D.log.length ? '' : ' disabled') + '>Reset</button>' +
    '<button class="btn sm" data-act="d-example">Load a real game</button><button class="btn sm pri" data-act="d-copy">Copy summary</button></div></div>';
  h += '<textarea id="copy-fallback" rows="6" hidden aria-label="Summary text"></textarea></div>';
  h += '<div class="board" style="margin-top:10px">';
  [0, 1].forEach(function (s) {
    var bans = [], picks = [];
    D.log.forEach(function (e, i) { if (e.side === s) (e.type === 'ban' ? bans : picks).push({ e: e, i: i }); });
    var nBans = Math.max(nb || 3, bans.length + (plan.side === s && plan.type === 'ban' && D.format === 'free' ? 1 : 0));
    var nPicks = Math.max(5, picks.length + (plan.side === s && plan.type === 'pick' && D.format === 'free' ? 1 : 0));
    h += '<div class="side' + (D.myTeam === s ? ' mine' : '') + '"><h3><span>' + sideName(s) + '</span><span class="small muted">' + (s === 0 ? 'first pick' : 'second') + (D.myTeam === s ? ', my team' : '') + '</span></h3><div class="slots">';
    for (var i = 0; i < nBans; i++) h += slotHtml(s, 'ban', i, bans[i], plan);
    h += '</div><div class="slots">';
    for (var j = 0; j < nPicks; j++) h += slotHtml(s, 'pick', j, picks[j], plan);
    h += '</div></div>';
  });
  h += '</div>';
  $('#d-board').innerHTML = h;
}

function topWhy(it) {
  return it.components.filter(function (c) { return c.value > 0.4; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 3)
    .map(function (c) { return c.name.replace(/ \(.*\)$/, '') + ' ' + sgn(c.value); }).join(', ') || 'No strong component';
}
function compTable(cs) {
  var mx = Math.max.apply(null, cs.map(function (c) { return Math.abs(c.value); }).concat([1]));
  return '<div class="scroll"><table class="tbl"><thead><tr><th>Component</th><th class="r">Points</th><th>Why</th></tr></thead><tbody>' + cs.map(function (c) {
    return '<tr><td style="min-width:130px">' + esc(c.name) + '</td><td class="r num ' + (c.value > 0 ? 'pos' : c.value < 0 ? 'neg' : 'muted') + '">' + sgn(c.value, 2) + '</td><td>' + esc(c.note || '') + ' ' + tag(c.basis) + (c.n != null ? ' ' + nn(c.n) : '') + lowb(c.low) + '</td></tr>';
  }).join('') + '</tbody></table></div>';
}
function drawSugg(st, plan) {
  var s2 = Object.assign({}, st);
  var type = D.vType !== 'auto' ? D.vType : plan.type;
  var side = D.vWho === 'mine' ? D.myTeam : D.vWho === 'opp' ? 1 - D.myTeam : plan.side;
  var head = '<div class="row between"><h3>Suggestions</h3><div class="row">' +
    '<span class="seg" role="group" aria-label="Suggestion type">' + [['auto', 'Next slot'], ['pick', 'Picks'], ['ban', 'Bans']].map(function (x) { return '<button data-act="d-vtype" data-v="' + x[0] + '" aria-pressed="' + (D.vType === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span>' +
    '<span class="seg" role="group" aria-label="Suggest for">' + [['next', 'Next side'], ['mine', 'My team'], ['opp', 'Opponent']].map(function (x) { return '<button data-act="d-vwho" data-v="' + x[0] + '" aria-pressed="' + (D.vWho === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</span></div></div>';
  if (!type || side == null) {
    if (plan.slot.done && D.vType === 'auto') { $('#d-sugg').innerHTML = head + '<div class="empty">The draft is complete. Use Undo to change it, or pick Picks or Bans above to explore.</div>'; return; }
    type = type || 'pick'; side = side == null ? D.myTeam : side;
  }
  s2.side = side; s2.mode = type;
  var rec = type === 'ban' ? E.recommendBans(App.data, App.selAll, s2, { limit: 12 }) : E.recommendPicks(App.data, App.selAll, s2, { limit: 12 });
  var h = head + '<div class="small muted" style="margin-bottom:6px">' + (type === 'ban' ? 'Ban ideas' : 'Pick ideas') + ' for ' + sideName(side) + (side === D.myTeam ? ' (my team)' : ' (opponent)') + ', scored on ' + App.selAll.length + ' games' +
    (D.map ? ' with ' + esc(D.map) + ' map fit' : ', no map chosen') + '. Tap a row for the breakdown.</div>';
  if (App.selAll.length < 30) h += '<div class="note warn" style="margin-bottom:8px">Only ' + App.selAll.length + ' games are selected. Data driven parts of these scores are weak, so lean on the judgment components.</div>';
  if (!rec.items.length) h += '<div class="empty">No suggestions.</div>';
  h += rec.items.map(function (it, i) {
    var open = D.open[it.hero];
    var after = it.archetypeAfter ? ' <span class="pill" title="Primary archetype of the side if this hero is picked">becomes ' + esc(typeof it.archetypeAfter === 'string' ? it.archetypeAfter : (it.archetypeAfter.label || it.archetypeAfter.primary || '')) + '</span>' : '';
    return '<div class="sug"><div class="sug-head" data-act="d-sugg" data-hero="' + esc(it.hero) + '" role="button" tabindex="0" aria-expanded="' + !!open + '"><span class="rank">' + (i + 1) + '</span>' + chip(it.hero) +
      '<div class="main"><b>' + esc(disp(it.hero)) + '</b> <span class="muted small">' + esc(it.role) + '</span>' + after + '<div class="why">' + esc(topWhy(it)) + ' | ' + pct(it.winRate) + ' shrunk, ' + nn(it.n) + lowb(it.low) + (rec.kind === 'ban' ? ' | banning side ' + it.banWins + '-' + (it.bans - it.banWins) + ' over ' + it.bans + ' bans' + lowb(it.bans < 8) : '') + '</div></div>' +
      '<span class="score num" title="Sum of components, in points">' + it.score.toFixed(1) + '</span>' +
      '<button class="btn sm" data-act="d-place" data-hero="' + esc(it.hero) + '"' + (plan.slot.done ? ' disabled' : '') + '>Place</button></div>' +
      (open ? '<div class="sug-body">' + compTable(it.components) + '</div>' : '') + '</div>';
  }).join('');
  $('#d-sugg').innerHTML = h;
  D.lastRec = rec;
}

function drawGrid() {
  var used = usedSet(), q = D.q.trim().toLowerCase();
  $('#d-roles').innerHTML = [''].concat(ROLES).map(function (r) { return '<button class="fchip" data-act="d-role" data-v="' + esc(r) + '" aria-pressed="' + (D.role === r) + '">' + (r || 'All') + '</button>'; }).join('');
  var names = App.data.heroNames.slice().sort(function (a, b) { return disp(a).localeCompare(disp(b)); }).filter(function (n) {
    return (!q || disp(n).toLowerCase().indexOf(q) >= 0) && (!D.role || heroRole(n) === D.role);
  });
  $('#d-grid').innerHTML = names.map(function (n) {
    return '<button class="hbtn" data-act="d-place" data-hero="' + esc(n) + '" data-hero-btn="1"' + (used[n] ? ' disabled' : '') + '>' + chip(n) + '<span class="t">' + esc(disp(n)) + '</span></button>';
  }).join('') || '<div class="empty small">No hero matches</div>';
}

function drawReads(st) {
  var data = App.data, games = App.selAll;
  function sideRead(s) {
    var names = st.picks[s].filter(Boolean), en = st.picks[1 - s].filter(Boolean);
    var h = '<div class="card"><h3>' + sideName(s) + (D.myTeam === s ? ' (my team)' : ' (opponent)') + ': comp read</h3>';
    if (!names.length) return h + '<div class="empty small">No picks yet.</div></div>';
    var rd = E.compRead(data, games, names, en), a = rd.archetype;
    h += '<p><b>' + esc(a.label || 'unclear') + '</b>' + (a.partial ? ' <span class="pill warn">partial comp, ' + a.count + ' of 5</span>' : '') + ' ' + tag('judgment') + '</p>';
    h += '<div class="small muted" style="margin-bottom:6px">Relative scores: ' + a.ranked.slice(0, 4).map(function (r) { return esc(r.arch) + ' ' + sgn(r.score, 2); }).join(', ') + '</div>';
    if (a.reasons && a.reasons.length) h += '<ul class="small" style="margin:0 0 8px;padding-left:18px">' + a.reasons.slice(0, 4).map(function (r) { return '<li>' + esc(r.text) + ' ' + tag(r.basis) + '</li>'; }).join('') + '</ul>';
    var miss = (a.needs || []).filter(function (n) { return n.status !== 'ok'; }).slice(0, 6);
    h += '<h4>Missing pieces</h4>' + (miss.length ? '<ul class="small" style="margin:4px 0 8px;padding-left:18px">' + miss.map(function (n) { return '<li><b>' + esc(n.label) + '</b> <span class="pill ' + (n.status === 'missing' ? 'bad' : 'warn') + '">' + n.status + '</span> ' + esc(n.note) + ' ' + tag(n.basis) + '</li>'; }).join('') + '</ul>' : '<p class="small muted">Nothing flagged.</p>');
    function arow(lbl, list) {
      if (!list || !list.length) return '';
      return '<div class="small"><b>' + lbl + '</b> ' + list.slice(0, 4).map(function (x) { return esc(x.arch) + ' ' + pct(x.shrunk, 0) + ' <span class="muted">n ' + x.n + '</span>' + (x.low ? ' <span class="lowb">low sample</span>' : ''); }).join(', ') + '</div>';
    }
    h += '<h4>What the numbers say</h4>' + arow('Does well against', rd.strongAgainst) + arow('Struggles against', rd.weakAgainst);
    if (!(rd.strongAgainst && rd.strongAgainst.length) && !(rd.weakAgainst && rd.weakAgainst.length)) h += '<p class="small muted">No archetype is clearly above 52% or below 48% in this selection.</p>';
    if (rd.versusEnemy) h += '<div class="small">Against the other side\'s archetype (' + esc(rd.versusEnemy.enemyArchetype) + '): ' + pct(rd.versusEnemy.shrunk) + ' ' + nn(rd.versusEnemy.n) + lowb(rd.versusEnemy.low) + (rd.versusEnemy.mirror ? ' (mirror)' : '') + '</div>';
    if (rd.vulnerabilities && rd.vulnerabilities.length) h += '<h4>What the kit suggests</h4><div class="small">Several heroes here are listed as weak to: ' + rd.vulnerabilities.map(function (v) { return esc(v.type) + ' (' + v.heroes + ' heroes)'; }).join('; ') + ' ' + tag('judgment') + '</div>';
    return h + '</div>';
  }
  var mine = D.myTeam, opp = 1 - D.myTeam;
  var h = sideRead(mine) + sideRead(opp);
  // what their picks mean
  var re = E.readEnemy(data, games, st, opp);
  h += '<div class="card" style="grid-column:1/-1"><h3>What their picks mean (' + sideName(opp) + ')</h3>';
  if (!re.count) h += '<div class="empty small">The opponent has no picks yet. Their bans so far: ' + (st.bans[opp].filter(Boolean).map(disp).join(', ') || 'none') + '.</div>';
  else {
    h += '<div class="grid2"><div><h4>Clues</h4><ul class="small" style="margin:4px 0;padding-left:18px">' + re.clues.map(function (c) { return '<li>' + esc(c.text) + ' ' + tag(c.basis) + '</li>'; }).join('') + '</ul>' +
      '<h4>Open needs on their side</h4><ul class="small" style="margin:4px 0;padding-left:18px">' + (re.openNeeds.slice(0, 6).map(function (c) { return '<li><b>' + esc(c.label) + '</b> ' + c.status + ': ' + esc(c.note) + ' ' + tag(c.basis) + '</li>'; }).join('') || '<li>None flagged</li>') + '</ul></div>' +
      '<div><h4>Likely next picks (fit, not a forecast)</h4><div class="stack" style="gap:4px;margin-top:4px">' + re.likelyNext.map(function (x) { return '<div class="row between">' + hn(x.hero) + '<span class="small muted">score ' + x.score.toFixed(1) + ', ' + nn(x.n).replace(/<[^>]+>/g, '') + (x.low ? ' (low sample)' : '') + '</span></div>'; }).join('') + '</div><p class="small muted" style="margin-top:8px">' + esc(re.note) + '</p></div></div>';
  }
  $('#d-reads').innerHTML = h + '</div>';
}

/* placement */
function place(h) {
  var st = dState(), plan = slotPlan(st);
  if (usedSet()[h]) { toast('That hero is already used'); return; }
  if (plan.slot.done) { toast('The draft is complete. Undo or reset to change it.'); return; }
  D.log.push({ side: plan.side, type: plan.type, hero: h });
  drawDraft();
}
ACT['d-place'] = function (el) { place(el.getAttribute('data-hero')); };
ACT['d-sugg'] = function (el) { var h = el.getAttribute('data-hero'); D.open[h] = !D.open[h]; drawSugg(D.last.st, D.last.plan); };
ACT['d-undo'] = function () { D.log.pop(); drawDraft(); };
ACT['d-reset'] = function () { D.log = []; D.open = {}; drawDraft(); };
ACT['d-remove'] = function (el) { D.log.splice(+el.getAttribute('data-i'), 1); drawDraft(); };
ACT['d-skip'] = function () {
  var plan = slotPlan(dState());
  if (plan.type === 'ban') { D.log.push({ side: plan.side, type: 'ban', hero: '' }); drawDraft(); }
};
ACT['d-tgt'] = function (el) { var k = el.getAttribute('data-k'), v = el.getAttribute('data-v'); D.tgt[k] = k === 'side' ? +v : v; drawDraft(); };
ACT['d-vtype'] = function (el) { D.vType = el.getAttribute('data-v'); drawDraft(); };
ACT['d-vwho'] = function (el) { D.vWho = el.getAttribute('data-v'); drawDraft(); };
ACT['d-role'] = function (el) { D.role = el.getAttribute('data-v'); drawGrid(); };
ACT['d-example'] = function () {
  var pool = App.selAll.filter(function (g) { return g.firstPick != null && g.picks[0].length === 5 && g.picks[1].length === 5; });
  if (!pool.length) { toast('No NGS game with first pick data in the selection'); return; }
  var g = pool[Math.floor(Math.random() * pool.length)];
  var a = g.firstPick, b = 1 - a, log = [], bi = [0, 0], pi = [0, 0];
  var order = [['ban', 0], ['ban', 1], ['ban', 0], ['ban', 1], ['pick', 0], ['pick', 1], ['pick', 1], ['pick', 0], ['pick', 0],
    ['ban', 1], ['ban', 0], ['pick', 1], ['pick', 1], ['pick', 0], ['pick', 0], ['pick', 1]];
  order.forEach(function (s) {
    var team = s[1] === 0 ? a : b;
    if (s[0] === 'ban') log.push({ side: s[1], type: 'ban', hero: g.bans[team][bi[s[1]]++] || '' });
    else log.push({ side: s[1], type: 'pick', hero: g.picks[team][pi[s[1]]++] });
  });
  D.log = log; D.map = g.map; D.format = 'ngs'; D.open = {}; D.myTeam = 0;
  $('#d-map').value = D.map; $('#d-fmt').value = 'ngs'; $('#d-my').value = '0';
  drawDraft();
  toast('Loaded a real ' + g.league + ' S' + g.season + ' game on ' + g.map);
};
ACT['d-copy'] = function () { copyText(draftSummary(), 'Summary copied'); };

function draftSummary() {
  var st = dState(), plan = slotPlan(st), L = [];
  var nm = function (a) { return a.map(function (h) { return h ? disp(h) : 'skipped'; }).join(', ') || 'none'; };
  L.push('HotS Draft Lab summary');
  L.push('Map: ' + (D.map || 'unknown') + ' | Format: ' + (D.format === 'ngs' ? 'NGS style' : 'free form') + ' | Skill: ' + D.skill + ' | I am ' + sideName(D.myTeam));
  L.push('Data: ' + App.selAll.length + ' games (' + filterDescription() + ')');
  [0, 1].forEach(function (s) { L.push(sideName(s) + (D.myTeam === s ? ' (me)' : '') + ' bans: ' + nm(st.bans[s]) + ' | picks: ' + nm(st.picks[s])); });
  [D.myTeam, 1 - D.myTeam].forEach(function (s) {
    var names = st.picks[s].filter(Boolean);
    if (!names.length) return;
    var a = E.archetypeOf(App.data, names);
    var miss = a.needs.filter(function (n) { return n.status !== 'ok'; }).slice(0, 4).map(function (n) { return n.label + ' (' + n.status + ')'; });
    L.push(sideName(s) + ' comp: ' + (a.label || 'unclear') + (a.partial ? ' (partial)' : '') + '. Missing: ' + (miss.join(', ') || 'nothing flagged'));
  });
  L.push(plan.slot.done ? 'Draft complete.' : 'Next: ' + (plan.slot.free ? sideName(D.tgt.side) + ' ' + D.tgt.type : plan.slot.label));
  if (D.lastRec && D.lastRec.items.length) L.push('Top ideas: ' + D.lastRec.items.slice(0, 5).map(function (i) { return disp(i.hero) + ' ' + i.score.toFixed(1) + (i.low ? ' (low sample)' : ''); }).join(', '));
  L.push('Scores are points from named components. Numbers are leans, check sample sizes in the app.');
  return L.join('\n');
}
