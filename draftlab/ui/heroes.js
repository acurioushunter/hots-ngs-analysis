/* Heroes tab: browser, detail with rating overrides, compare. */
var H = { q: '', role: '', sub: '', dmg: '', range: '', sort: 'name', dir: 1, sel: '', cmp: [] };
var RATING_KEYS = ['camp_clear', 'wave_clear', 'teamfight', 'engage', 'peel', 'self_sustain', 'mobility', 'ease_of_execution', 'objective_burst', 'siege'];
var RATING_LABEL = { camp_clear: 'Camp clear', wave_clear: 'Wave clear', teamfight: 'Teamfight', engage: 'Engage', peel: 'Peel', self_sustain: 'Self sustain', mobility: 'Mobility', ease_of_execution: 'Ease of execution', objective_burst: 'Objective burst', siege: 'Siege' };
var EXTRA_LABEL = { disengage_tools: 'Disengage tools', global_presence: 'Global presence', merc_camp_control: 'Camp control', build_dependence: 'Build dependence', mana_dependence: 'Mana dependence', solo_lane_viability: 'Solo lane', skill_floor: 'Skill floor', skill_ceiling: 'Skill ceiling', healer_dependence: 'Healer dependence' };

function persistOverrides() { store('overrides', App.overrides); }
function rawRating(h, k) { return App.rawMatrix.heroes[h].ratings[k]; }
function srcBasis(h, k) { var s = App.data.heroes[h].source; return s && s[k] ? s[k].basis : ''; }
function srcConf(h, k) { var s = App.data.heroes[h].source; return s && s[k] ? s[k].confidence : ''; }
function uniqVals(key) { var s = {}; Object.keys(App.data.heroes).forEach(function (n) { var v = App.data.heroes[n][key]; if (v) s[v] = 1; }); return Object.keys(s).sort(); }

RENDER.heroes = function (p) {
  if (noGames()) { p.innerHTML = emptyMsg(); return; }
  function sel(id, key, label, vals) { return '<label class="f">' + label + '<select id="' + id + '" data-h="' + key + '"><option value="">All</option>' + vals.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select></label>'; }
  var sorts = [['name', 'Name'], ['role', 'Role'], ['picks', 'Picks'], ['bans', 'Bans'], ['winRate', 'Win rate'], ['pickRate', 'Pick rate'], ['banRate', 'Ban rate'], ['avgPickOrder', 'Average pick order']].concat(RATING_KEYS.map(function (k) { return ['r:' + k, RATING_LABEL[k]]; }));
  p.innerHTML = '<div class="stack"><div class="card"><div class="setup">' +
    '<label class="f">Search<input type="search" id="h-q" data-h="q" placeholder="Hero name" autocomplete="off"></label>' +
    sel('h-role', 'role', 'Role', uniqVals('role')) + sel('h-sub', 'sub', 'Sub role', uniqVals('sub_role')) + sel('h-dmg', 'dmg', 'Damage', ['burst', 'sustain', 'mixed']) + sel('h-range', 'range', 'Range class', ['melee', 'short', 'medium', 'long']) +
    '<label class="f">Sort by<select id="h-sort" data-h="sort">' + sorts.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select></label>' +
    '<button class="btn" id="h-dir" data-act="h-dir">Ascending</button></div>' +
    '<p class="small muted" style="margin:8px 0 0">Pick, ban and win figures use the ' + App.selMap.length + ' games in the selection. Ratings are a first draft: mostly judgment, some read from ability text. Tick up to three heroes to compare.</p></div>' +
    '<div id="h-cmp"></div><div class="hsplit"><div class="card" id="h-list" style="min-width:0"></div><div id="h-detail" style="min-width:0"></div></div></div>';
  $$('[data-h]', p).forEach(function (el) {
    var ev = el.tagName === 'INPUT' ? 'input' : 'change';
    el.addEventListener(ev, function () { H[el.getAttribute('data-h')] = el.value; drawHList(); });
  });
  $('#h-sort').value = H.sort; $('#h-dir').textContent = H.dir > 0 ? 'Ascending' : 'Descending';
  drawHList(); drawHDetail(); drawHCompare();
};
ACT['h-dir'] = function (el) { H.dir = -H.dir; el.textContent = H.dir > 0 ? 'Ascending' : 'Descending'; drawHList(); };
ACT['h-open'] = function (el) { H.sel = el.getAttribute('data-hero'); drawHList(); drawHDetail(); var d = $('#h-detail'); if (d && window.innerWidth < 900) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
ACT['h-cmp'] = function (el) {
  var h = el.getAttribute('data-hero'), i = H.cmp.indexOf(h);
  if (i >= 0) H.cmp.splice(i, 1); else if (H.cmp.length < 3) H.cmp.push(h); else { toast('Compare holds three heroes. Untick one first.'); el.checked = false; return; }
  drawHCompare();
};

function drawHList() {
  var st = E.heroStats(App.selMap).byHero, names = App.data.heroNames;
  var q = H.q.trim().toLowerCase();
  var rows = names.filter(function (n) {
    var h = App.data.heroes[n];
    return (!q || disp(n).toLowerCase().indexOf(q) >= 0) && (!H.role || h.role === H.role) && (!H.sub || h.sub_role === H.sub) && (!H.dmg || h.dmg_profile === H.dmg) && (!H.range || h.range_class === H.range);
  });
  function val(n) {
    var h = App.data.heroes[n], s = st[n] || { n: 0, shrunk: 0.5, picks: 0, bans: 0, pickRate: 0, banRate: 0, avgPickOrder: 9 };
    if (H.sort === 'name') return disp(n); if (H.sort === 'role') return h.role + disp(n);
    if (H.sort === 'winRate') return s.n ? s.shrunk : -1;
    if (H.sort.indexOf('r:') === 0) return h.ratings[H.sort.slice(2)];
    return s[H.sort] == null ? -1 : s[H.sort];
  }
  rows.sort(function (a, b) { var x = val(a), y = val(b); var c = typeof x === 'string' ? x.localeCompare(y) : x - y; return (c || disp(a).localeCompare(disp(b))) * H.dir; });
  var h = '<div class="row between"><h3>' + rows.length + ' heroes</h3><span class="small muted">Tap a row for detail</span></div>';
  h += '<div class="scroll" style="max-height:70vh;overflow-y:auto"><table class="tbl"><thead><tr><th></th><th>Hero</th><th class="r">Pick</th><th class="r">Ban</th><th class="r">Win</th></tr></thead><tbody>' + rows.map(function (n) {
    var s = st[n];
    return '<tr class="click" data-act="h-open" data-hero="' + esc(n) + '"' + (H.sel === n ? ' style="background:var(--accent-soft)"' : '') + '><td><input type="checkbox" data-act="h-cmp" data-hero="' + esc(n) + '" ' + (H.cmp.indexOf(n) >= 0 ? 'checked' : '') + ' aria-label="Compare ' + esc(disp(n)) + '"></td><td>' + hn(n) + '<div class="small muted">' + esc(App.data.heroes[n].role) + '</div></td>' +
      '<td class="r num">' + (s ? pct(s.pickRate, 0) : '0%') + '</td><td class="r num">' + (s ? pct(s.banRate, 0) : '0%') + '</td><td class="r num">' + (s && s.n ? pct(s.shrunk, 0) + '<div class="small muted">n ' + s.n + (s.low ? ' low' : '') + '</div>' : '<span class="muted">n/a</span>') + '</td></tr>';
  }).join('') + '</tbody></table></div>';
  $('#h-list').innerHTML = h;
}

function ratingEditor(hero) {
  var d = App.data.heroes[hero], ov = App.overrides[hero] || {};
  return RATING_KEYS.map(function (k) {
    var v = d.ratings[k], isOv = ov[k] != null;
    return '<tr><td>' + RATING_LABEL[k] + '</td><td>' + rbar(v, isOv) + '</td><td class="num r">' + v + '</td><td>' + tag(srcBasis(hero, k)) + ' <span class="small muted">' + esc(srcConf(hero, k)) + '</span></td>' +
      '<td class="r" style="white-space:nowrap"><button class="btn sm" data-act="h-adj" data-hero="' + esc(hero) + '" data-k="' + k + '" data-d="-1" aria-label="Lower ' + RATING_LABEL[k] + '">-</button> <button class="btn sm" data-act="h-adj" data-hero="' + esc(hero) + '" data-k="' + k + '" data-d="1" aria-label="Raise ' + RATING_LABEL[k] + '">+</button>' + (isOv ? ' <span class="pill warn" title="Your override. Authored value was ' + rawRating(hero, k) + '">yours</span>' : '') + '</td></tr>';
  }).join('');
}
ACT['h-adj'] = function (el) {
  var h = el.getAttribute('data-hero'), k = el.getAttribute('data-k'), d = +el.getAttribute('data-d');
  var cur = App.data.heroes[h].ratings[k], nv = Math.max(1, Math.min(5, cur + d));
  if (nv === cur) return;
  var o = App.overrides[h] || (App.overrides[h] = {});
  if (nv === rawRating(h, k)) delete o[k]; else o[k] = nv;
  if (!Object.keys(o).length) delete App.overrides[h];
  persistOverrides(); rebuildData(); markDirty(); App.dirty.heroes = true;
  drawHList(); drawHDetail(); drawHCompare();
  toast('Rating changed. Draft, Maps and Counters will use it.');
};
ACT['h-resetov'] = function (el) {
  var h = el.getAttribute('data-hero');
  if (h) delete App.overrides[h]; else App.overrides = {};
  persistOverrides(); rebuildData(); markDirty(); App.dirty.heroes = true;
  drawHList(); drawHDetail(); drawHCompare(); renderFilterBar();
};

function drawHDetail() {
  var el = $('#h-detail'), hero = H.sel;
  if (!hero) { el.innerHTML = '<div class="card empty">Pick a hero from the list to see ratings, matchups and where it does well.</div>'; return; }
  var d = App.data.heroes[hero], games = App.selMap, det = E.heroDetail(games, hero), s = det.stat, ex = d.extra || {};
  var nOv = Object.keys(App.overrides).length;
  var h = '<div class="card stack"><div class="row between"><h2>' + hn(hero) + '</h2><span class="small muted">' + esc(d.role) + ', ' + esc(d.sub_role) + '</span></div>';
  h += '<div class="row"><span class="pill">' + esc(d.dmg_profile) + ' damage</span><span class="pill">' + esc(d.range_class) + ' range</span>' + (d.pct_damage ? '<span class="pill" title="' + esc((d.pct_damage_basis || []).join(', ')) + '">percent health damage</span>' : '') + (d.comp_fit || []).map(function (c) { return '<span class="pill">fits ' + esc(c) + '</span>'; }).join('') + '</div>';
  if (d.labels && d.labels.length) {
    h += '<div class="row">' + d.labels.map(function (x) { return '<span class="pill">' + esc(x) + '</span>'; }).join('') + '</div>';
    if (d.owner_notes) h += '<div class="small"><span class="tag">Hunter\'s read</span> ' + esc(d.owner_notes) + (d.flex_roles && d.flex_roles.length ? ' Flexes to: ' + d.flex_roles.map(esc).join('; ') + '.' : '') + '</div>';
    var L = d.lenses || {}, lensLine = function (k, label) { var v = L[k]; if (v == null) return ''; return '<div class="row between small"><span>' + label + '</span><span>' + esc((Array.isArray(v) ? v : [v]).map(function (x) { return String(x).replace(/_/g, ' '); }).join(', ')) + '</span></div>'; };
    h += '<div><h4>How it plays ' + tag('kit') + '</h4><div class="grid3" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:4px 16px">' +
      lensLine('damage_delivery', 'Damage comes from') + lensLine('damage_timing', 'Damage arrives') + lensLine('frontline_style', 'Front line style') + lensLine('healer_class', 'Healer class') +
      lensLine('kill_pattern', 'Gets kills by') + lensLine('cc_profile', 'Crowd control') + lensLine('escape', 'Escape') + lensLine('lane_role', 'Lane role') +
      lensLine('power_curve', 'Strongest') + lensLine('team_needs', 'Needs from the team') + lensLine('team_gives', 'Gives the team') + lensLine('vulnerable_to', 'Loses to') + '</div>' +
      (d.heal_blunted != null ? '<div class="small muted">Healing blunts its damage ' + d.heal_blunted + ' of 5. Profile confidence ' + esc(d.profile_confidence || 'n/a') + '.</div>' : '') +
      (d.ratings_contested ? '<div class="small muted">Contested ratings (the old matrix and the profile differ by 3 or more, so the midpoint is used): ' + Object.keys(d.ratings_contested).map(function (k) { return esc(k.replace(/_/g, ' ')) + ' ' + d.ratings_contested[k].matrix_before + ' v ' + d.ratings_contested[k].profile; }).join(', ') + '.</div>' : '') + '</div>';
  }
  h += '<div class="small"><b>Strength:</b> ' + esc(d.strengths_note || '') + '<br><b>Weakness:</b> ' + esc(d.weaknesses_note || '') + ' ' + tag('judgment') + '</div>';
  h += '<div><h4>In the selection ' + tag('data') + '</h4>' + (s && (s.picks || s.bans) ? '<div class="small">Picked ' + s.picks + ' times (' + pct(s.pickRate, 0) + ' of games), banned ' + s.bans + ' (' + pct(s.banRate, 0) + (s.bans ? ', the banning side won ' + s.banWins + '-' + (s.bans - s.banWins) + (s.banRec.low ? ' (low sample)' : '') : '') + '). Win rate ' + pct(s.winRate) + ' raw, ' + pct(s.shrunk) + ' shrunk ' + nn(s.n) + lowb(s.low) + '. Average pick position ' + (s.avgPickOrder ? s.avgPickOrder.toFixed(1) : 'n/a') + ', opened a draft ' + s.openers + ' times.</div>' : '<div class="small muted">Not seen in this selection.</div>') + '</div>';
  if (d.meta && d.meta.patch_257) {
    var m = d.meta.patch_257;
    h += '<div class="small muted">Heroes Profile patch 2.57 (outside data, n ' + m.games + '): win ' + m.win.toFixed(1) + '%, pick ' + m.pick.toFixed(1) + '%, ban ' + m.ban.toFixed(1) + '%. ' + ((d.meta.icy_veins_tier_general || []).length ? 'Icy Veins tier: ' + esc(d.meta.icy_veins_tier_general.join(', ')) + '.' : '') + ' ' + tag('data') + '</div>';
  }
  h += '<div><div class="row between"><h4>Ratings (1 poor, 5 elite)</h4>' + (App.overrides[hero] ? '<button class="btn sm" data-act="h-resetov" data-hero="' + esc(hero) + '">Reset this hero</button>' : '') + '</div>' +
    '<div class="scroll"><table class="tbl"><tbody>' + ratingEditor(hero) + '</tbody></table></div>' +
    '<p class="small muted">Use - and + to override a rating. Overrides are saved in this browser when storage is allowed and change every tab that uses ratings. ' + (nOv ? nOv + ' hero(es) overridden. <button class="btn sm" data-act="h-resetov">Reset all</button>' : '') + '</p></div>';
  var exr = Object.keys(EXTRA_LABEL).filter(function (k) { return ex[k] != null; });
  h += '<div><h4>Extras</h4><div class="grid3" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px 12px">' + exr.map(function (k) { return '<div class="row between small"><span>' + EXTRA_LABEL[k] + '</span>' + rbar(ex[k]) + '</div>'; }).join('') + '</div>' +
    '<div class="small" style="margin-top:6px">Power spike: ' + esc(ex.power_spike || 'n/a') + '. Pick risk: ' + esc(ex.pick_risk || 'n/a') + '. Ultimate type: ' + esc(ex.ult_type || 'n/a') + '. Hard CC abilities: ' + (ex.cc_amount != null ? ex.cc_amount : 'n/a') + (ex.cc_types_base_kit && ex.cc_types_base_kit.length ? ' (' + esc(ex.cc_types_base_kit.join(', ')) + ')' : '') + '. Weak to: ' + esc((ex.vulnerable_to || []).join(', ') || 'n/a') + '. ' + (ex.objective_notes ? 'Objectives: ' + esc(ex.objective_notes) + '.' : '') + ' ' + tag('judgment') + '</div></div>';
  function lst(title, arr) { return arr && arr.length ? '<div class="small"><b>' + title + ':</b> ' + arr.map(disp).map(esc).join(', ') + '</div>' : ''; }
  h += '<div><h4>Icy Veins lists ' + tag('data') + '</h4>' + lst('Counters', ex.counters_per_icy_veins) + lst('Countered by', ex.countered_by_per_icy_veins) + lst('Works with', ex.synergies_per_icy_veins) + '<div class="small muted">Lists are partial and one sided.</div></div>';
  if (det.bestMaps.length) h += '<div><h4>Best maps in the selection ' + tag('data') + '</h4>' + table(['Map', { t: 'Win', c: 'r' }, { t: 'Games', c: 'r' }, { t: 'vs own avg', c: 'r' }], det.bestMaps.filter(function (m) { return m.n >= 3; }).slice(0, 5).map(function (m) { return '<tr><td>' + esc(m.map) + '</td><td class="r num">' + pct(m.shrunk, 0) + '</td><td class="r num">' + m.n + lowb(m.low) + '</td><td class="r num ' + (m.delta > 0 ? 'pos' : 'neg') + '">' + sgn(m.delta * 100) + '</td></tr>'; })) + '</div>';
  if (det.partners.length) h += '<div><h4>Common partners ' + tag('data') + '</h4><div class="row">' + det.partners.slice(0, 8).map(function (x) { return '<span class="hm">' + hn(x.b === hero ? x.a : x.b) + '<span class="small muted num">n ' + x.n + ', ' + pct(x.shrunk, 0) + '</span></span>'; }).join('') + '</div></div>';
  function vs(title, arr) { return arr && arr.length ? '<div><h4>' + title + '</h4><div class="row">' + arr.map(function (x) { return '<span class="hm">' + hn(x.b) + '<span class="small muted num">' + pct(x.shrunk, 0) + ', n ' + x.n + '</span></span>'; }).join('') + '</div></div>' : ''; }
  h += vs('Does best against (n 3 or more)', det.bestAgainst) + vs('Does worst against', det.worstAgainst);
  var tr = E.heroTrend(App.selAll, hero);
  if (tr.length > 1) h += '<div><h4>Trend by season ' + tag('data') + '</h4>' + table(['Season', { t: 'Pick rate', c: 'r' }, { t: 'Ban rate', c: 'r' }, { t: 'Banner won', c: 'r' }, { t: 'Win', c: 'r' }, { t: 'Picks', c: 'r' }], tr.map(function (t) { return '<tr><td>' + esc(t.key) + '</td><td class="r num">' + pct(t.pickRate, 0) + '</td><td class="r num">' + pct(t.banRate, 0) + '</td><td class="r num">' + (t.bans ? t.banWins + '-' + (t.bans - t.banWins) : 'n/a') + '</td><td class="r num">' + (t.picks ? pct(t.shrunk, 0) : 'n/a') + '</td><td class="r num">' + t.picks + lowb(t.low && t.picks) + '</td></tr>'; })) + '</div>';
  el.innerHTML = h + '</div>';
}

function drawHCompare() {
  var el = $('#h-cmp');
  if (H.cmp.length < 2) { el.innerHTML = H.cmp.length === 1 ? '<div class="note">Tick one more hero to compare.</div>' : ''; return; }
  var st = E.heroStats(App.selMap).byHero;
  var head = '<th></th>' + H.cmp.map(function (n) { return '<th>' + hn(n) + '</th>'; }).join('');
  function row(label, fn) { return '<tr><td>' + label + '</td>' + H.cmp.map(function (n) { return '<td>' + fn(n) + '</td>'; }).join('') + '</tr>'; }
  var rows = [
    row('Role', function (n) { return esc(App.data.heroes[n].role); }),
    row('Damage, range', function (n) { var d = App.data.heroes[n]; return esc(d.dmg_profile + ', ' + d.range_class); }),
    row('Pick, ban', function (n) { var s = st[n]; return s ? pct(s.pickRate, 0) + ', ' + pct(s.banRate, 0) : 'n/a'; }),
    row('Win rate (shrunk)', function (n) { var s = st[n]; return s && s.n ? pct(s.shrunk) + ' ' + nn(s.n) + lowb(s.low) : 'n/a'; })
  ].concat(RATING_KEYS.map(function (k) { return row(RATING_LABEL[k], function (n) { return rbar(App.data.heroes[n].ratings[k], App.overrides[n] && App.overrides[n][k] != null) + ' <span class="num">' + App.data.heroes[n].ratings[k] + '</span>'; }); }));
  var hv = '';
  if (H.cmp.length === 2) { var r = E.heroVsHero(App.selMap, H.cmp[0], H.cmp[1]); hv = '<p class="small">Head to head: ' + (r.n ? disp(H.cmp[0]) + ' won ' + r.aWins + ' of ' + r.n + ' games (' + pct(r.shrunk) + ' shrunk, lift ' + sgn(r.lift * 100) + ' points) ' + lowb(r.low) : 'never on opposite sides in this selection.') + '</p>'; }
  el.innerHTML = '<div class="card"><div class="row between"><h3>Compare</h3><button class="btn sm" data-act="h-cmpclear">Clear</button></div>' + hv + '<div class="scroll"><table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div></div>';
}
ACT['h-cmpclear'] = function () { H.cmp = []; drawHList(); drawHCompare(); };
