/* HotS Tools shell: navigation, embedded apps, home, learn hub, about, theme. */
(function () {
  'use strict';
  // A personal edition keeps its own saved data: every storage key gets a prefix, in this page and in both frames.
  // (Local files in some browsers share one storage area, so two editions would otherwise see each other's games.)
  function installStorage(win, ns) {
    if (!ns) return;
    try {
      var real = win.localStorage;
      var own = function () { var a = []; for (var j = 0; j < real.length; j++) { var kk = real.key(j); if (kk && kk.indexOf(ns) === 0) a.push(kk); } return a; };
      var wrap = {
        getItem: function (k) { return real.getItem(ns + k); },
        setItem: function (k, v) { real.setItem(ns + k, v); },
        removeItem: function (k) { real.removeItem(ns + k); },
        key: function (i) { var a = own(); return i < a.length ? a[i].slice(ns.length) : null; },
        clear: function () { own().forEach(function (kk) { real.removeItem(kk); }); }
      };
      Object.defineProperty(wrap, 'length', { get: function () { return own().length; } });
      Object.defineProperty(win, 'localStorage', { configurable: true, get: function () { return wrap; } });
    } catch (e) { /* storage unavailable: nothing to prefix */ }
  }
  installStorage(window, window.HOTS_NS);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function jsonOf(id) { var el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } }

  /* ------------------------------------------------------------ shared data (parsed once) */
  var Shared = {
    _m: null, _meta: null, _ex: null,
    get matrix() { if (!this._m) this._m = jsonOf('d-matrix') || { heroes: {} }; return this._m; },
    get meta() { if (!this._meta) this._meta = jsonOf('d-meta') || {}; return this._meta; },
    get example() { if (!this._ex) this._ex = jsonOf('d-example'); return this._ex; },
    matrixText: function () { return document.getElementById('d-matrix').textContent; },
    gamesText: function () { return document.getElementById('d-games').textContent; }
  };

  /* ------------------------------------------------------------ navigation map */
  var NAV = [
    { id: 'home', label: 'Home', native: 'home' },
    { id: 'scout', label: 'Team Scout', blurb: 'For teams: prepare for a match, run a draft, scout any team in the league.', pages: [
      { id: 'draft', label: 'Draft room', app: 'drafter', tab: 'draft', desc: 'Live draft against a known opponent: bans, picks, comps and the plan.' },
      { id: 'prep', label: 'Opponent prep', app: 'drafter', tab: 'overview', desc: 'Their players, maps, bans and how they did against you.' },
      { id: 'scout', label: 'Scout any team', app: 'lab', tab: 'scout', desc: 'Record, favourite maps, comps and habits for any team in the data.' },
      { id: 'review', label: 'Review a draft', app: 'lab', tab: 'review', desc: 'Replay a real draft slot by slot against what the engine would suggest.' },
      { id: 'counters', label: 'Counters', app: 'lab', tab: 'counters', desc: 'What beats which kind of comp, and hero versus hero results.' },
      { id: 'meta', label: 'Meta', app: 'lab', tab: 'meta', desc: 'Pick, ban and win rates for the leagues and seasons you select.' },
      { id: 'board', label: 'Open draft board', app: 'lab', tab: 'draft', desc: 'A draft board for any game: scrims, tournaments, hypotheticals.' },
      { id: 'team', label: 'Team setup', app: 'drafter', tab: 'team', desc: 'Pick your NGS team, say who you are, set the data window.' },
      { id: 'profile', label: 'Team profile', app: 'lab', tab: 'team', desc: 'Your own roster and hero pools for the open draft board.' }
    ] },
    { id: 'mygames', label: 'My Games', blurb: 'For players: import your games and see what they say.', pages: [
      { id: 'import', label: 'Import', native: 'mygames', desc: 'Bring your match history in. It stays on this device.' },
      { id: 'overview', label: 'Overview', native: 'mygames', desc: 'Record, rank, form and what stands out.' },
      { id: 'heroes', label: 'Heroes', native: 'mygames', desc: 'Every hero you play, against the global win rate.' },
      { id: 'maps', label: 'Maps', native: 'mygames', desc: 'Where you win and where you struggle.' },
      { id: 'habits', label: 'Habits', native: 'mygames', desc: 'Sessions, tilt, time of day.' },
      { id: 'coach', label: 'Pool coach', native: 'mygames', desc: 'Depth, fallbacks and heroes worth learning next.' }
    ] },
    { id: 'learn', label: 'Learn', blurb: 'Heroes, maps, drafting and strategy.', pages: [
      { id: 'start', label: 'Start here', native: 'learn', desc: 'A map of everything you can learn here.' },
      { id: 'heroes', label: 'Hero guides', app: 'drafter', tab: 'heroes', desc: 'Builds, talents, abilities, matchups and tier lists for every hero.' },
      { id: 'ratings', label: 'Hero ratings', app: 'lab', tab: 'heroes', desc: 'Compare heroes on wave clear, camps, engage, peel and more.' },
      { id: 'maps', label: 'Map guides', app: 'drafter', tab: 'maps', desc: 'Objectives, tiers and what each map rewards.' },
      { id: 'mapdata', label: 'Map data', app: 'lab', tab: 'maps', desc: 'Which comps and heroes win on each map, from the games.' },
      { id: 'lenses', label: 'Hero lenses', native: 'lenses', desc: 'Every axis a draft is reasoned on, who carries it, and what the league says it is worth.' },
      { id: 'drafting', label: 'Drafting and strategy', app: 'lab', tab: 'learn', desc: 'Draft theory, concepts and what to look for.' },
      { id: 'tips', label: 'Tips and glossary', app: 'drafter', tab: 'learn', desc: 'Draft tips, guides and a glossary of terms.' }
    ] },
    { id: 'about', label: 'About', native: 'about' }
  ];
  var SECTION = {}, PAGE = {};
  NAV.forEach(function (s) {
    SECTION[s.id] = s;
    (s.pages || []).forEach(function (p) { p.section = s.id; PAGE[s.id + '/' + p.id] = p; });
  });
  function firstPage(sec) { var s = SECTION[sec]; return s && s.pages ? s.pages[0].id : null; }

  /* ------------------------------------------------------------ theme */
  var theme = lsGet('hots.theme', 'auto');
  function applyTheme() {
    var root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    Object.keys(frames).forEach(function (a) { post(a, { type: 'theme', value: theme }); });
  }

  /* ------------------------------------------------------------ embedded apps */
  var frames = {};
  var APP_NAMES = { drafter: 'the draft room', lab: 'the league tools' };
  function skeleton(app, tab) {
    var html = (window.HOTS_APPS || {})[app] || '';
    html = html.split('/*__MATRIX__*/').join(Shared.matrixText()).split('/*__GAMES__*/').join(Shared.gamesText());
    var ns = window.HOTS_NS ? '(' + installStorage.toString() + ')(window,' + JSON.stringify(window.HOTS_NS) + ');' : '';
    var boot = '<script>' + ns + 'window.HOTS_EMBED=true;window.HOTS_APP=' + JSON.stringify(app) + ';window.HOTS_TAB=' + JSON.stringify(tab) + ';window.HOTS_THEME=' + JSON.stringify(theme) + ';' +
      'if(window.HOTS_THEME&&window.HOTS_THEME!=="auto")document.documentElement.setAttribute("data-theme",window.HOTS_THEME);' +
      'window.addEventListener("message",function(e){var d=e.data;if(d&&d.hots&&d.type==="theme"){if(d.value==="auto")document.documentElement.removeAttribute("data-theme");else document.documentElement.setAttribute("data-theme",d.value);}});' +
      'window.hotsPost=function(m){m.hots=1;m.app=window.HOTS_APP;try{parent.postMessage(m,"*");}catch(e){}};<\/script>';
    var tail = '<style id="hots-theme">' + (window.HOTS_THEME_CSS || '') + '</style>';
    var extra = '';
    var P = window.HOTS_PERSONAL;
    if (P) {   // a personal edition starts the apps on the owner's team and pool (saved choices still win)
      var preset = app === 'drafter' ? { team: P.team, me: P.me } : { profile: P.profile, name: P.profileName, team: P.team };
      extra += '<script>window.HOTS_PRESET=' + JSON.stringify(preset).replace(/</g, '\\u003c') + ';<\/script>';
    }
    if (app === 'drafter') {   // the draft room gets the league engine and the games so it can give a style read
      var eng = document.getElementById('d-labengine');
      if (eng) extra += '<script>' + eng.textContent + '<\/script><script>window.HOTS_LAB={matrix:' + Shared.matrixText() + ',games:' + Shared.gamesText() + '};<\/script>';
    }
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(app) + '</title>' + boot + '</head><body>' + extra + html + tail + '</body></html>';
  }
  function ensureFrame(app, tab) {
    var f = frames[app];
    if (f) return f;
    var el = document.createElement('iframe');
    el.className = 'frame'; el.setAttribute('title', app === 'drafter' ? 'Draft room and guides' : 'League tools'); el.hidden = true;
    f = frames[app] = { el: el, loaded: false, queue: [], tab: tab };
    el.addEventListener('load', function () { f.loaded = true; f.queue.splice(0).forEach(function (m) { post(app, m); }); if (cur.app === app) setLoading(false); });
    // srcdoc first, then attach: attaching a bare iframe fires a load event for about:blank, which would flush the message queue too early
    el.srcdoc = skeleton(app, tab);
    $('#stage').appendChild(el);
    return f;
  }
  function post(app, msg) {
    var f = frames[app]; if (!f) return;
    msg.hots = 1;
    if (!f.loaded) { f.queue.push(msg); return; }
    try { f.el.contentWindow.postMessage(msg, '*'); } catch (e) { }
  }
  function setLoading(on, msg) { var l = $('#loading'); l.hidden = !on; if (msg) $('#loadmsg').textContent = msg; }

  /* ------------------------------------------------------------ routing */
  var cur = { section: 'home', page: null, app: null };
  var natives = {};
  function hideAll() {
    Object.keys(frames).forEach(function (a) { frames[a].el.hidden = true; });
    Object.keys(natives).forEach(function (k) { natives[k].hidden = true; });
  }
  function nativeHost(key) {
    if (!natives[key]) { var d = document.createElement('div'); d.className = 'native'; d.innerHTML = '<div class="in"></div>'; d.hidden = true; $('#stage').appendChild(d); natives[key] = d; }
    return natives[key];
  }
  function go(section, page, opts) {
    opts = opts || {};
    var sec = SECTION[section] || SECTION.home;
    section = sec.id;
    if (sec.pages && (!page || !PAGE[section + '/' + page])) page = (cur.section === section && cur.page && PAGE[section + '/' + cur.page]) ? cur.page : lsGet('hots.page.' + section, null);
    if (sec.pages && (!page || !PAGE[section + '/' + page])) page = firstPage(section);
    var pg = sec.pages ? PAGE[section + '/' + page] : null;
    cur = { section: section, page: page, app: pg && pg.app ? pg.app : null };
    if (sec.pages) lsSet('hots.page.' + section, page);
    lsSet('hots.route', { section: section, page: page });
    renderNav();
    hideAll(); setLoading(false);
    if (pg && pg.app) {
      var first = !frames[pg.app];
      var f = ensureFrame(pg.app, pg.tab);
      f.el.hidden = false;
      if (first) setLoading(true, 'Loading ' + (pg.app === 'drafter' ? 'the draft room' : 'the league tools') + '…');
      else { setLoading(!f.loaded); post(pg.app, { type: 'goto', tab: pg.tab }); }
      if (opts.hero) post(pg.app, { type: 'hero', hero: opts.hero });
    } else {
      var key = sec.native || (pg && pg.native);
      var host = nativeHost(section === 'mygames' ? 'mygames' : key);
      host.hidden = false;
      var inner = host.firstChild;
      try {
        if (key === 'home') renderHome(inner);
        else if (key === 'learn') renderLearn(inner);
        else if (key === 'lenses') renderLenses(inner);
        else if (key === 'about') renderAbout(inner);
        else if (key === 'mygames') window.HotsGamesUI.render(inner, page, API);
      } catch (e) { inner.innerHTML = '<div class="note bad">This page failed to draw: ' + esc(e.message) + '</div>'; if (window.console) console.error(e); }
      if (!opts.keepScroll) host.scrollTop = 0;
    }
    try { history.replaceState(null, '', '#/' + section + (page ? '/' + page : '')); } catch (e) { }
  }
  function renderNav() {
    $('#sections').innerHTML = NAV.map(function (s) {
      return '<button class="sec" data-sec="' + s.id + '" aria-current="' + (cur.section === s.id) + '">' + esc(s.label) + '</button>';
    }).join('');
    var sec = SECTION[cur.section], bar = $('#pagesbar');
    if (sec.pages) {
      bar.hidden = false;
      $('#pagelist').innerHTML = sec.pages.map(function (p) { return '<button class="pg" data-sec="' + sec.id + '" data-pg="' + p.id + '" aria-current="' + (cur.page === p.id) + '">' + esc(p.label) + '</button>'; }).join('');
      var pg = PAGE[sec.id + '/' + cur.page];
      $('#pagedesc').textContent = pg ? pg.desc : '';
    } else bar.hidden = true;
    document.title = 'HotS Tools' + (sec.id !== 'home' ? ' · ' + sec.label : '');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sec]');
    if (b && b.closest('.hdr, .pages')) { go(b.dataset.sec, b.dataset.pg || null); return; }
    var g = e.target.closest('[data-go]');
    if (g) { var p = g.dataset.go.split('/'); go(p[0], p[1] || null, { hero: g.dataset.hero || null }); }
  });
  $('#logo').addEventListener('click', function () { go('home'); });
  $('#theme').addEventListener('click', function () {
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shown = theme === 'auto' ? (dark ? 'dark' : 'light') : theme;
    theme = shown === 'dark' ? 'light' : 'dark'; lsSet('hots.theme', theme); applyTheme();
  });
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || !d.hots) return;
    if (d.type === 'tab' && d.app === cur.app) {
      // an embedded app changed its own tab (for example a map link inside a hero sheet): follow it
      var hit = null;
      Object.keys(PAGE).forEach(function (k) { var p = PAGE[k]; if (!hit && p.app === d.app && p.tab === d.tab) hit = p; });
      var here = PAGE[cur.section + '/' + cur.page];
      if (hit && !(here && here.app === d.app && here.tab === d.tab)) go(hit.section, hit.id);
    }
  });
  window.addEventListener('hashchange', function () {
    var m = (location.hash || '').match(/^#\/([a-z]+)(?:\/([a-z]+))?/);
    if (m && SECTION[m[1]] && (m[1] !== cur.section || (m[2] && m[2] !== cur.page))) go(m[1], m[2] || null);
  });

  /* ------------------------------------------------------------ API for native modules */
  var API = {
    matrix: function () { return Shared.matrix; },
    meta: function () { return Shared.meta; },
    example: function () { return Shared.example; },
    personal: function () { return window.HOTS_PERSONAL || null; },
    go: go, lsGet: lsGet, lsSet: lsSet, lsDel: lsDel, esc: esc,
    toast: function (msg) {
      var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
    },
    heroGuide: function (hero) { go('learn', 'heroes', { hero: hero }); },
    // hand a hero pool to the open draft board (it reads the same storage keys when it boots)
    sendPool: function (profile, name) {
      lsSet('hdl.profile', { name: name, profile: profile }); lsSet('hdl.useprof', true);
      if (frames.lab) post('lab', { type: 'profile', profile: profile, name: name, use: true });
      API.toast('Pool sent. The draft board will use it.');
      go('scout', 'board');
    }
  };
  window.HotsShell = API;

  /* ------------------------------------------------------------ native pages */
  function renderHome(el) {
    var m = Shared.meta, last = lsGet('hots.route', null);
    var games = window.HOTS_PERSONAL ? window.HOTS_PERSONAL.games.length : lsGet('hots.games.count', 0);
    var P = window.HOTS_PERSONAL, mine = '';
    if (P) {
      var sl = P.games.filter(function (g) { return g.type === 'sl'; }).length;
      mine = '<section class="card us"><h3>' + esc(P.name) + '\'s edition</h3><p class="small">Your ' + P.games.length.toLocaleString() + ' Heroes Profile games (' + sl.toLocaleString() + ' Storm League) are loaded in My Games, and Team Scout starts on ' + esc(P.team) + ' with you as ' + esc(P.me) + '. ' +
        'Next opponent in the draft room: ' + esc(P.next || 'not set') + '.</p>' +
        '<div class="row"><button class="btn primary" data-go="mygames/overview">My overview</button><button class="btn" data-go="mygames/coach">My pool coach</button><button class="btn" data-go="scout/draft">Draft room</button><button class="btn" data-go="scout/prep">Opponent prep</button></div></section>';
    }
    el.innerHTML = mine +
      '<section class="card accent"><h2>HotS Tools</h2>' +
      '<p class="muted" style="max-width:62ch">Drafting, scouting and improvement tools for Heroes of the Storm, in one place. Everything runs in this page. Nothing is uploaded anywhere.</p></section>' +
      '<div class="grid g3">' +
      '<button class="path" data-go="scout"><span class="tag acc">For teams</span><h3>Team Scout</h3><span class="muted">Run a live draft against a known opponent, prepare for a match, scout any team in the league, see what beats what.</span><span class="go">Open the draft room →</span></button>' +
      '<button class="path" data-go="mygames"><span class="tag acc">For players</span><h3>My Games</h3><span class="muted">Import your match history and see your win rate by hero and map, your habits, what your pool is missing and what to learn next.</span><span class="go">' + (games ? 'See my games (' + games + ') →' : 'Import my games →') + '</span></button>' +
      '<button class="path" data-go="learn"><span class="tag acc">For everyone</span><h3>Learn</h3><span class="muted">Every hero\'s builds and talents, every map\'s objective and tier list, draft theory, and a glossary.</span><span class="go">Start learning →</span></button>' +
      '</div>' +
      '<div class="grid g2">' +
      '<section class="card"><h3>What is in here</h3><dl class="defs">' +
      '<dt>Hero guides</dt><dd>' + (m.hero_count || 91) + ' heroes: builds, talents, abilities, matchups, tier lists, global win rates.</dd>' +
      '<dt>League data</dt><dd>' + (m.games_total ? m.games_total.toLocaleString() : '2,000+') + ' league games (NGS seasons 21 and 22, Heroes Lounge season 30) with drafts, bans and results.</dd>' +
      '<dt>Hero profiles and lenses</dt><dd>All ' + (m.hero_count || 91) + ' heroes read from their ability text and measured numbers: how each deals damage, what front line or healer it is, how it controls a fight, what it needs and what it loses to. Ratings for wave clear, camps, engage and peel sit on top.</dd>' +
      '<dt>Draft room</dt><dd>Rules, pools and opponent habits for ' + (m.ngs_teams || 57) + ' NGS teams.</dd></dl></section>' +
      '<section class="card"><h3>How to read the numbers</h3>' +
      '<p class="small">Most records here rest on a handful of games. A 5-0 is a hint, not a law. Every number shows its sample size, and a result under 8 games is marked <span class="tag warn">low sample</span>. "Lean" means the data points that way and could change.</p>' +
      '<p class="small">Anything tagged <span class="tag">data</span> was measured from games, <span class="tag">kit</span> was read from ability text, and <span class="tag">judgment</span> is an authored rating you can disagree with.</p></section>' +
      '</div>' +
      (last && last.section !== 'home' ? '<p class="small muted">Last time you were on <button class="chip" data-go="' + esc(last.section + (last.page ? '/' + last.page : '')) + '">' + esc((SECTION[last.section] || {}).label || '') + (last.page && PAGE[last.section + '/' + last.page] ? ' · ' + esc(PAGE[last.section + '/' + last.page].label) : '') + '</button></p>' : '') +
      '<p class="small muted">Built ' + esc(window.HOTS_BUILD || '') + '. League data ' + esc(m.data_asof || '') + '. Works offline once loaded, apart from the fonts.</p>';
  }

  function renderLearn(el) {
    var f = Shared.meta.facts || [];
    var cards = [
      ['learn/heroes', 'Hero guides', 'Pick a hero and get its overview, builds, talents, abilities, matchups, maps and who plays it. Tier lists per role and per map, and global win rates.', 'Builds and talents'],
      ['learn/ratings', 'Hero ratings', 'Compare heroes on wave clear, camp clear, engage, peel, siege, mobility and ease of execution, with the evidence tag on every rating.', 'Compare heroes'],
      ['learn/lenses', 'Hero lenses', 'The axes a draft is reasoned on (damage type, front line style, healer class, crowd control, macro, weaknesses), which heroes carry each, and what the league says it is worth.', 'Heroes by trait'],
      ['learn/maps', 'Map guides', 'What each map rewards, its objective, the tier list and the notes that matter in a draft.', 'Maps'],
      ['learn/mapdata', 'Map data', 'Which comp styles and heroes actually win on each map in the league games, with sample sizes.', 'Maps from data'],
      ['learn/drafting', 'Drafting and strategy', 'Draft theory, archetypes, wave clear, camps, rotations and how to read the other team\'s picks.', 'Theory'],
      ['learn/tips', 'Tips and glossary', 'Short draft tips, guides, and a glossary for every term you will see.', 'Reference']
    ];
    el.innerHTML = '<section class="card accent"><h2>Learn</h2><p class="muted" style="max-width:64ch">Start with the hero or map you are about to play, then read how the best comps are built around it. Use <button class="chip" data-go="mygames">My Games</button> to see where your own results differ from the numbers below.</p></section>' +
      '<div class="grid g3">' + cards.map(function (c) { return '<button class="path" data-go="' + c[0] + '"><span class="tag">' + esc(c[3]) + '</span><h3>' + esc(c[1]) + '</h3><span class="muted small">' + esc(c[2]) + '</span><span class="go">Open →</span></button>'; }).join('') + '</div>' +
      (f.length ? '<section class="card"><h3>What the league games say</h3><p class="small muted">From ' + (Shared.meta.games_total || '') + ' NGS and Heroes Lounge games. These are leans, not rules.</p><ul class="ins">' + f.map(function (x) { return '<li class="info">' + esc(x) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<section class="card"><h3>Three habits that help in every draft</h3><ol class="steps"><li><b>Decide what you are building before the second pick.</b> A comp that wins by dive, by poke or by wave clear and sieging needs different heroes. The open draft board names the style as you pick.</li>' +
      '<li><b>Save a ban for what you cannot play against.</b> The strongest ban is the hero that beats your comp, not the hero with the highest win rate.</li>' +
      '<li><b>Have a fallback for your main.</b> If it is banned or taken, the pool coach in My Games lists your next best heroes in that role.</li></ol></section>';
  }

  // Learn > Hero lenses: the catalog (knowledge/expert/lenses.json), who carries each value (the matrix, from the hero profiles) and the league association.
  function renderLenses(el) {
    var cat = Shared.meta.lens_catalog || {}, sig = (Shared.meta.lens_signal || {}), items = sig.items || [], H = (Shared.matrix && Shared.matrix.heroes) || {};
    var keys = Object.keys(cat);
    if (!keys.length) { el.innerHTML = '<section class="card"><h2>Hero lenses</h2><p class="muted">The lens catalog is not in this build.</p></section>'; return; }
    var fam = {}, famOrder = [];
    keys.forEach(function (k) { var c = cat[k], f = c.family || 'Other'; if (!fam[f]) { fam[f] = []; famOrder.push(f); } fam[f].push(k); });
    function carriers(k, v) {
      return Object.keys(H).filter(function (h) { var x = (H[h].lenses || {})[k]; return Array.isArray(x) ? x.indexOf(v) >= 0 : x === v; }).sort();
    }
    function sigFor(k, v) { return items.filter(function (i) { return i.lens === k && i.value === v; }).sort(function (a, b) { return a.min - b.min; }); }
    var body = famOrder.map(function (f) {
      return '<section class="card"><h3>' + esc(f) + '</h3>' + fam[f].map(function (k) {
        var c = cat[k], vals = Object.keys(c.values);
        return '<details class="sec"><summary><b>' + esc(c.question) + '</b> <span class="muted small">' + esc(k) + (c.kind === 'multi' ? ', can hold several values' : '') + '</span></summary>' +
          '<div class="scroll"><table><thead><tr><th>Value</th><th>Means</th><th class="r">Heroes</th><th>League read</th></tr></thead><tbody>' +
          vals.map(function (v) {
            var who = carriers(k, v), sg = sigFor(k, v)[0];
            return '<tr><td><b>' + esc(v.replace(/_/g, ' ')) + '</b></td><td class="small">' + esc(c.values[v]) + '</td><td class="small">' + (who.length ? '<span class="muted num">' + who.length + '</span> ' + who.slice(0, 12).map(esc).join(', ') + (who.length > 12 ? ', and ' + (who.length - 12) + ' more' : '') : '<span class="muted">none yet</span>') + '</td>' +
              '<td class="small">' + (sg ? '<span class="tag ' + (sg.with_wr > sg.without_wr ? 'good' : 'warn') + '">' + (sg.with_wr > sg.without_wr ? 'helps' : 'hurts') + '</span> ' + Math.round(sg.with_wr * 100) + '% with ' + sg.min + ' or more, ' + Math.round(sg.without_wr * 100) + '% without (' + sg.n.toLocaleString() + ' sides)' : '<span class="muted">no clear gap</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div><p class="small muted">' + esc(c.draft_use || '') + '</p></details>';
      }).join('') + '</section>';
    }).join('');
    el.innerHTML = '<section class="card accent"><h2>Hero lenses</h2><p class="muted" style="max-width:68ch">A draft is more than healing and range. Each lens is one question about a hero: how it deals damage, what kind of front line it is, what kind of healer, how it controls a fight, what it does on the map, when it is strong, and what it loses to. Every hero is classified on all of them from its ability text, measured numbers and the owner\'s own notes.</p>' +
      '<p class="small muted">The league read compares the win rate of drafting sides with and without a trait over ' + (sig.sides ? sig.sides.toLocaleString() : 'thousands of') + ' NGS sides (seasons 15 to 22). It is an association: traits cluster in comps, so a gap can come from the comp or the players. Only large gaps are shown.</p></section>' + body;
  }

  function renderAbout(el) {
    var m = Shared.meta;
    el.innerHTML = '<section class="card"><h2>About HotS Tools</h2>' +
      '<p>One app from two projects: a draft room built for an NGS team, and a general draft and meta lab for any league, plus the My Games analyser for individual players and a library of hero and map guides. Built ' + esc(window.HOTS_BUILD || '') + '.</p>' +
      '<h3 style="margin-top:12px">Where the data comes from</h3><ul class="small">' +
      '<li><b>NGS games</b> (Nexus Gaming Series, every division, playoffs included): Heroes Profile match pages for seasons 21 and 22 and the NGS replay export for seasons 15 to 22. Drafts, bans, map picks and per player stats. ' + (m.ngs_games ? m.ngs_games.toLocaleString() + ' games.' : '') + '</li>' +
      '<li><b>Heroes Lounge</b> (EU amateur league, season 30): ' + (m.hl_games ? m.hl_games + ' games' : 'games') + ' with drafts and results, no player stats.</li>' +
      '<li><b>Hero and map guides, talents, tier lists</b>: Icy Veins pages saved into the tool. Dates are shown on each hero.</li>' +
      '<li><b>Global Storm League hero win rates</b>: Heroes Profile global hero page, patches 2.55 to 2.57' + (m.global_asof ? ', as of ' + esc(m.global_asof) : '') + '.</li>' +
      '<li><b>Storm League MMR</b> of NGS players: their Heroes Profile profiles, Storm League only.</li>' +
      '<li><b>Hero profiles</b> (knowledge/expert/hero_profiles): one per hero, written from the Icy Veins ability and talent text beside measured damage, healing, siege, damage taken and crowd control from NGS replays, then corrected with the owner\'s own notes (marked as his read). <b>Hero ratings</b> follow the profiles; where the old matrix and the profile differed by 3 or more the midpoint is used and flagged. Each rating carries its source tag and you can override any of them.</li>' +
      '<li><b>League read</b>: win rates by comp trait and healer class use every NGS replay of seasons 15 to 22, newer seasons weighted more, with the newest three seasons shown beside them.</li></ul>' +
      '<h3 style="margin-top:12px">What it cannot tell you</h3><ul class="small">' +
      '<li>Match pages have no timeline. Only games from the replay export carry one (first takedown, experience lead at 5, 10 and 15 minutes, first structure, takedown lists), and it is summarised, not replayed. Nothing here knows who won a particular fight except through those totals.</li>' +
      '<li>Most records are 2 to 12 games. They are leans, not rules.</li>' +
      '<li>Hero ratings and lenses are a model, not a measurement. Use them to ask a question, not to settle one.</li>' +
      '<li>Win rate gaps by trait are associations: a healer or a trait is picked into particular comps, so a gap can come from the comp, the players or the season.</li></ul>' +
      '<h3 style="margin-top:12px">Privacy</h3><p class="small">Everything runs in your browser. The games you import in My Games, your team choice and your draft in progress are kept on this device only, in this browser. Clear them any time from My Games and from the Team setup page.</p>' +
      '<h3 style="margin-top:12px">Sharing</h3><p class="small">Send the single file <span class="kbd">hots_tools.html</span> (a zip works) and open it in any browser. It needs no install and no account.</p></section>' +
      '<section class="card"><h3>Reset</h3><p class="small muted">Two separate buttons, so clearing your choices never costs you your games.</p>' +
      '<div class="row"><button class="btn" id="wipe-choices">Reset my choices</button><button class="btn" id="wipe">Remove everything on this device</button></div>' +
      '<p class="small muted" style="margin-top:8px"><b>Reset my choices</b> forgets filters, team and player choices, drafts in progress and the theme. <b>Your imported games stay.</b> ' +
      '<b>Remove everything</b> also deletes the imported games' + (window.HOTS_PERSONAL ? ' (this edition loads its own games again on the next start)' : '') + '. Download a backup from My Games first if you want to keep them.</p></section>';
    function wipeKeys(keepGames) {
      try {
        var ks = [];
        for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
        ks.forEach(function (k) {
          if (!/^(hots|hdl|ngs-draft)/.test(k)) return;
          if (keepGames && (k === 'hots.games.v1' || k === 'hots.games.count')) return;
          localStorage.removeItem(k);
        });
      } catch (e) { }
      setTimeout(function () { location.reload(); }, 700);
    }
    $('#wipe-choices', el).addEventListener('click', function () {
      if (!confirm('Reset filters, team choices, drafts in progress and the theme? Your imported games are kept.')) return;
      API.toast('Choices reset. Reloading.'); wipeKeys(true);
    });
    $('#wipe', el).addEventListener('click', function () {
      var n = lsGet('hots.games.count', 0);
      if (!confirm('Delete ' + (n ? Number(n).toLocaleString() + ' imported games, ' : 'imported games, ') + 'saved drafts, team choices and settings from this device? This cannot be undone.')) return;
      API.toast('Everything cleared. Reloading.'); wipeKeys(false);
    });
  }

  /* ------------------------------------------------------------ boot */
  applyTheme();
  var start = (location.hash || '').match(/^#\/([a-z]+)(?:\/([a-z]+))?/);
  var saved = lsGet('hots.route', null);
  if (start && SECTION[start[1]]) go(start[1], start[2] || null);
  else if (saved && SECTION[saved.section] && saved.section !== 'home') go(saved.section, saved.page);
  else go('home');
})();
