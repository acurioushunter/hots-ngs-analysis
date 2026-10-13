/* Draft Lab UI core: state, helpers, filter bar, router. Uses the global DraftLabEngine (E). */
var E = DraftLabEngine;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function disp(n) { return String(n || '').replace(/\uFFFD/g, '\u00fa'); }
function pct(x, d) { return x == null || isNaN(x) ? 'n/a' : (x * 100).toFixed(d == null ? 1 : d) + '%'; }
function sgn(x, d) { if (x == null) return ''; var v = Number(x).toFixed(d == null ? 1 : d); return (x > 0 ? '+' : '') + v; }
function fmtTime(sec) { if (sec == null) return 'n/a'; var m = Math.floor(sec / 60), s = Math.round(sec % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

var ROLE_CLS = { 'Tank': 'Tank', 'Bruiser': 'Bruiser', 'Melee Assassin': 'Melee', 'Ranged Assassin': 'Ranged', 'Healer': 'Healer', 'Support': 'Support' };
function heroRole(h) { var x = App.data.heroes[h]; return x ? x.role : ''; }
function initials(n) {
  var w = disp(n).replace(/^The /, '').split(/[\s.]+/).filter(Boolean);
  if (w.length > 1) return (w[0][0] + w[1][0]).toUpperCase();
  return w[0].slice(0, 2).replace(/^./, function (c) { return c.toUpperCase(); });
}
function chip(h) { return '<span class="hchip role-' + (ROLE_CLS[heroRole(h)] || 'Support') + '" title="' + esc(heroRole(h)) + '">' + esc(initials(h)) + '</span>'; }
function hn(h) { return '<span class="hn">' + chip(h) + '<b>' + esc(disp(h)) + '</b></span>'; }
function tag(b) { return b ? '<span class="tag ' + esc(b) + '" title="' + ({ data: 'measured from games or list data', kit: 'read from ability text', judgment: 'authored rating or opinion' }[b] || '') + '">' + esc(b) + '</span>' : ''; }
function lowb(low, n) { return low ? ' <span class="lowb" title="Fewer than ' + E.LOW_N + ' games. Read as a lean, not a rule.">low sample</span>' : ''; }
function nn(n) { return '<span class="muted num small">n ' + n + '</span>'; }
function rt(o, key) { // rate object to html: shrunk win rate + n + low flag
  if (!o) return '<span class="muted">n/a</span>';
  var v = o[key || 'shrunk'];
  return '<span class="num">' + pct(v) + '</span> ' + nn(o.n) + lowb(o.low);
}
function bar(frac, neg) { return '<span class="bar' + (neg ? ' neg' : '') + '"><i style="width:' + Math.max(0, Math.min(100, frac * 100)).toFixed(0) + '%"></i></span>'; }
function rbar(v, ov) { var s = '<span class="rbar' + (ov ? ' ov' : '') + '" title="' + v + ' of 5">'; for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= v ? 'on' : '') + '"></i>'; return s + '</span>'; }
function table(head, rows, cls) {
  return '<div class="scroll"><table class="tbl ' + (cls || '') + '"><thead><tr>' + head.map(function (h) { return typeof h === 'string' ? '<th>' + h + '</th>' : '<th class="' + (h.c || '') + '"' + (h.a ? ' data-act="' + h.a + '"' : '') + '>' + h.t + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}
function toast(msg) {
  var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2200);
}
function copyText(text, okMsg) {
  function fallback() {
    var ta = $('#copy-fallback'); if (!ta) return;
    ta.hidden = false; ta.value = text; ta.focus(); ta.select();
    toast('Copy blocked here. Text is selected below, press Ctrl+C.');
  }
  try {
    navigator.clipboard.writeText(text).then(function () { toast(okMsg || 'Copied'); }, fallback);
  } catch (e) { fallback(); }
}
function store(key, val) { try { localStorage.setItem('hdl.' + key, JSON.stringify(val)); } catch (e) { } }
function load(key, def) { try { var v = localStorage.getItem('hdl.' + key); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }

/* ---------------------------------------------------------------- app state */
var App = {
  rawMatrix: null, rawGames: null, data: null,
  filters: { leagues: [], seasons: [], leagueSeasons: [], divisions: [], maps: [] },
  selAll: [], selMap: [], info: null,
  tab: 'draft', fOpen: false,
  overrides: {}, profile: null, profileName: '', useProfile: false,
  dirty: {}
};
var TABS = [
  ['draft', 'Draft'], ['maps', 'Maps'], ['counters', 'Counters'], ['heroes', 'Heroes'], ['meta', 'Meta'],
  ['scout', 'Scout'], ['review', 'Review'], ['team', 'Team'], ['learn', 'Learn'], ['about', 'About']
];
var RENDER = {}; // tab id -> function
var ACT = {};    // data-act handlers

function applyOverrides(matrix, ov) {
  var out = { _meta: matrix._meta, heroes: {} };
  Object.keys(matrix.heroes).forEach(function (n) {
    var h = matrix.heroes[n], o = ov[n];
    if (!o) { out.heroes[n] = h; return; }
    var c = Object.assign({}, h); c.ratings = Object.assign({}, h.ratings, o);
    out.heroes[n] = c;
  });
  return out;
}
function rebuildData() {
  App.data = E.createData({ matrix: applyOverrides(App.rawMatrix, App.overrides), games: App.rawGames });
  refreshSel();
}
function refreshSel() {
  var f = App.filters;
  App.selAll = E.filterGames(App.data.games, { leagues: f.leagues, seasons: f.seasons, leagueSeasons: f.leagueSeasons, divisions: f.divisions });
  App.selMap = f.maps.length ? E.filterGames(App.selAll, { maps: f.maps }) : App.selAll;
  App.info = E.selectionInfo(App.selMap);
}
function markDirty() { App.dirty = {}; }

/* ---------------------------------------------------------------- hero picker (text box with a list) */
function pickerHtml(id, ph) { return '<div class="pick-dd" id="' + id + '"><input type="text" autocomplete="off" placeholder="' + esc(ph || 'Search hero') + '" aria-label="' + esc(ph || 'Search hero') + '"><div class="dd" hidden></div></div>'; }
var PICKERS = {};
function mountPicker(id, onPick, exclude) {
  var root = document.getElementById(id); if (!root) return;
  var inp = $('input', root), dd = $('.dd', root);
  PICKERS[id] = onPick;
  function list() {
    var q = inp.value.trim().toLowerCase();
    var ex = exclude ? exclude() : [];
    var names = App.data.heroNames.filter(function (n) { return ex.indexOf(n) < 0 && (!q || disp(n).toLowerCase().indexOf(q) >= 0); }).slice(0, 40);
    dd.innerHTML = names.map(function (n) { return '<button type="button" data-hero="' + esc(n) + '">' + hn(n) + '</button>'; }).join('') || '<div class="empty small">No hero matches</div>';
    dd.hidden = false;
  }
  function choose(n) { dd.hidden = true; inp.value = ''; onPick(n); }
  inp.addEventListener('input', list);
  inp.addEventListener('focus', list);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var b = $('button', dd); if (b) { e.preventDefault(); choose(b.getAttribute('data-hero')); } }
    if (e.key === 'Escape') dd.hidden = true;
  });
  dd.addEventListener('mousedown', function (e) { var b = e.target.closest('button[data-hero]'); if (b) { e.preventDefault(); choose(b.getAttribute('data-hero')); } });
  inp.addEventListener('blur', function () { setTimeout(function () { dd.hidden = true; }, 120); });
}

/* ---------------------------------------------------------------- filter bar */
var LOW_DIVS = ['C', 'C East', 'C West', 'D', 'EU Div 4', 'EU Div 5'];
function toggleIn(arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
function filterDescription() {
  var f = App.filters, parts = [];
  if (f.leagueSeasons.length) parts.push(f.leagueSeasons.map(function (x) { return x.replace(':', ' S'); }).join(' + '));
  if (f.leagues.length) parts.push(f.leagues.join(' + '));
  if (f.seasons.length) parts.push('season ' + f.seasons.join(', '));
  if (f.divisions.length) parts.push(f.divisions.length > 3 ? f.divisions.length + ' divisions' : f.divisions.join(', '));
  if (f.maps.length) parts.push('map ' + (f.maps.length > 2 ? f.maps.length + ' maps' : f.maps.join(', ')));
  return parts.length ? parts.join(' | ') : 'Everything';
}
function renderFilterBar() {
  var o = App.data.options, f = App.filters, el = $('#fbar');
  var info = App.info, all = App.selAll.length;
  var warn = info.level === 'ok' ? '' : '<span class="pill warn" title="' + esc(info.message) + '">' + (info.level === 'tiny' ? 'very small sample' : 'small sample') + '</span>';
  var h = '<div class="fsum"><span class="count num">' + info.n.toLocaleString() + '</span><span>games in selection</span>' + warn +
    '<span class="muted small grow" style="min-width:140px">' + esc(filterDescription()) + (f.maps.length ? ' (' + all + ' before map filter)' : '') + '</span>' +
    '<button class="btn sm" data-act="preset" data-v="all">Everything</button>' +
    '<button class="btn sm" data-act="preset" data-v="ngs">NGS latest season</button>' +
    '<button class="btn sm" data-act="preset" data-v="low" title="NGS C, C East, C West, D and Heroes Lounge EU Div 4 and 5">Low divisions only</button>' +
    '<button class="btn sm pri" data-act="fopen" aria-expanded="' + App.fOpen + '">' + (App.fOpen ? 'Hide filters' : 'Edit filters') + '</button></div>';
  if (App.fOpen) {
    function grp(title, key, items, labelFn) {
      return '<div class="fgroup"><h4>' + title + '</h4><div class="chips">' + items.map(function (it) {
        var on = f[key].indexOf(it.value) >= 0;
        return '<button class="fchip" data-act="ftoggle" data-k="' + key + '" data-v="' + esc(it.value) + '" aria-pressed="' + on + '">' + esc(labelFn(it)) + '<span class="n">' + it.n + '</span></button>';
      }).join('') + '</div></div>';
    }
    h += '<div class="fpanel">';
    if (f.leagueSeasons.length) h += '<div class="note">Preset active: ' + esc(f.leagueSeasons.map(function (x) { return x.replace(':', ' S'); }).join(' + ')) + ' <button class="btn sm" data-act="preset" data-v="all">Clear preset</button></div>';
    h += grp('League', 'leagues', o.leagues, function (i) { return i.value === 'HL' ? 'HL (Heroes Lounge EU)' : i.value; });
    h += grp('Season', 'seasons', o.seasons, function (i) { return 'S' + i.value; });
    h += grp('Division', 'divisions', o.divisions, function (i) { return i.league + ' ' + i.value; });
    h += grp('Map filter (optional)', 'maps', o.maps, function (i) { return i.value; });
    h += '<div class="small muted">Leagues, seasons and divisions combine with AND. Chips inside one group combine with OR. The map filter applies to Counters, Heroes, Meta and Scout. Draft and Maps use their own map.</div>';
    h += '<div><button class="btn sm" data-act="preset" data-v="all">Clear all filters</button></div></div>';
  }
  el.innerHTML = h;
}
ACT.fopen = function () { App.fOpen = !App.fOpen; renderFilterBar(); };
ACT.ftoggle = function (el) {
  var k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
  if (k === 'seasons') v = Number(v);
  App.filters.leagueSeasons = [];
  toggleIn(App.filters[k], v);
  filtersChanged();
};
ACT.preset = function (el) {
  var v = el.getAttribute('data-v'), f = App.filters;
  f.leagues = []; f.seasons = []; f.leagueSeasons = []; f.divisions = [];
  if (v === 'ngs') {
    var s = App.data.options.leagueSeasons.filter(function (x) { return x.value.indexOf('NGS:') === 0; }).map(function (x) { return +x.value.split(':')[1]; });
    if (s.length) f.leagueSeasons = ['NGS:' + Math.max.apply(null, s)];
  } else if (v === 'low') {
    f.divisions = App.data.options.divisions.map(function (d) { return d.value; }).filter(function (d) { return LOW_DIVS.indexOf(d) >= 0; });
  } else { f.maps = []; }
  filtersChanged();
};
function filtersChanged() {
  refreshSel(); markDirty(); renderFilterBar(); store('filters', App.filters); renderActive();
}

/* ---------------------------------------------------------------- router */
function renderNav() {
  $('#tabs').innerHTML = TABS.map(function (t) { return '<button class="tab" role="tab" data-act="tab" data-v="' + t[0] + '" aria-selected="' + (App.tab === t[0]) + '">' + t[1] + '</button>'; }).join('');
}
function noGames() { return !App.selMap.length; }
function emptyMsg() { return '<div class="card empty">No games match the current selection. Widen the filters above.</div>'; }
function renderActive() {
  var id = App.tab, p = $('#tab-' + id);
  $$('.panel').forEach(function (x) { x.hidden = x.id !== 'tab-' + id; });
  if (!App.dirty[id]) {
    try { RENDER[id](p); } catch (e) { p.innerHTML = '<div class="card note warn">This tab failed to draw: ' + esc(e.message) + '</div>'; if (window.console) console.error(e); }
    App.dirty[id] = true;
  }
}
ACT.tab = function (el) { setTab(el.getAttribute('data-v')); };
function setTab(id) {
  if (!RENDER[id]) id = 'draft';
  App.tab = id; store('tab', id); renderNav(); renderActive();
  if (window.hotsPost) window.hotsPost({ type: 'tab', tab: id });
  try { if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id); } catch (e) { }
  window.scrollTo(0, 0);
}
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (el && ACT[el.getAttribute('data-act')]) { ACT[el.getAttribute('data-act')](el, e); }
});
document.addEventListener('click', function (e) { // close open pickers when clicking elsewhere is handled by blur
});

/* ---------------------------------------------------------------- boot */
function boot() {
  App.rawMatrix = JSON.parse($('#d-matrix').textContent);
  App.rawGames = JSON.parse($('#d-games').textContent);
  var saved = load('filters', null);
  if (saved && typeof saved === 'object') {
    ['leagues', 'seasons', 'leagueSeasons', 'divisions', 'maps'].forEach(function (k) { if (Array.isArray(saved[k])) App.filters[k] = saved[k]; });
  }
  App.overrides = load('overrides', {}) || {};
  var pr = load('profile', null);
  if (pr && pr.profile) { App.profile = pr.profile; App.profileName = pr.name || 'Saved profile'; App.useProfile = !!load('useprof', false); }
  else if (window.HOTS_PRESET && window.HOTS_PRESET.profile) {   // HotS Tools personal edition
    try { App.profile = canonProfile(window.HOTS_PRESET.profile); App.profileName = window.HOTS_PRESET.name || 'My team'; App.useProfile = true; } catch (e) { }
  }
  // drop overrides for heroes that no longer exist
  Object.keys(App.overrides).forEach(function (h) { if (!App.rawMatrix.heroes[h]) delete App.overrides[h]; });
  try { rebuildData(); } catch (e) { $('#app').innerHTML = '<div class="card note warn">Data failed to load: ' + esc(e.message) + '</div>'; return; }
  if (!App.selAll.length && (App.filters.leagues.length || App.filters.divisions.length || App.filters.seasons.length || App.filters.leagueSeasons.length)) { // saved filters match nothing: reset
    App.filters = { leagues: [], seasons: [], leagueSeasons: [], divisions: [], maps: [] }; refreshSel();
  }
  var t = (window.HOTS_EMBED && window.HOTS_TAB) || (location.hash || '').replace('#', '') || load('tab', 'draft');
  if (!RENDER[t]) t = 'draft';
  App.tab = t;
  renderNav(); renderFilterBar(); renderActive();
  if (window.HOTS_EMBED) {
    window.addEventListener('message', function (e) {
      var d = e.data; if (!d || !d.hots) return;
      if (d.type === 'goto' && RENDER[d.tab] && d.tab !== App.tab) setTab(d.tab);
      else if (d.type === 'profile' && d.profile) {   // the shell sends the player's pool from My Games
        try { setProfile(canonProfile(d.profile), d.name || 'My pool'); App.useProfile = !!d.use; store('useprof', App.useProfile); App.dirty = {}; renderActive(); } catch (err) { }
      }
    });
  }
  window.addEventListener('hashchange', function () { var h = location.hash.replace('#', ''); if (RENDER[h] && h !== App.tab) setTab(h); });
}
