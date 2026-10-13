/* Team tab: optional team profile (pools and comfort), import and export as JSON. */
var COMFORT = { 1: 'can play', 2: 'comfortable', 3: 'best hero' };

function canonProfile(p) {
  var out = { players: [] };
  if (!p || typeof p !== 'object') throw new Error('The JSON is not an object.');
  if (Array.isArray(p.players)) {
    p.players.forEach(function (pl, i) {
      var pool = (pl.pool || []).map(function (e) {
        if (typeof e === 'string') return { hero: e, comfort: 2 };
        return { hero: e.hero, comfort: Math.max(1, Math.min(3, +e.comfort || 2)) };
      }).filter(function (e) { return e.hero; });
      out.players.push({ name: String(pl.name || 'Player ' + (i + 1)), role: String(pl.role || ''), pool: pool });
    });
  } else if (p.pool && typeof p.pool === 'object') {
    out.players.push({ name: 'Team pool', role: '', pool: Object.keys(p.pool).map(function (h) { return { hero: h, comfort: Math.max(1, Math.min(3, +p.pool[h] || 2)) }; }) });
  } else throw new Error('Expected a "players" list or a "pool" object.');
  return out;
}
function setProfile(p, name) {
  App.profile = p; App.profileName = name || 'Custom profile';
  if (!p) App.useProfile = false;
  store('profile', p ? { name: App.profileName, profile: p } : null);
  delete App.dirty.draft;
}
function profileJson() { return JSON.stringify({ name: App.profileName, players: App.profile.players }, null, 1); }

RENDER.team = function (p) {
  var h = '<div class="stack"><div class="card"><h3>Team profile</h3><p class="small muted">Optional. A profile lists each player, their role, and the heroes they play with a comfort level. When it is switched on in the Draft tab, suggestions for your side get a small bonus for pool heroes and a small penalty for heroes outside the pool. Nothing leaves your browser.</p>' +
    '<div class="row"><button class="btn pri" data-act="t-example">Load example (Example team)</button><button class="btn" data-act="t-new">Start an empty profile</button>' + (App.profile ? '<button class="btn" data-act="t-clear">Remove profile</button>' : '') + '</div>' +
    (App.profile ? '<div class="row" style="margin-top:10px"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="t-use" ' + (App.useProfile ? 'checked' : '') + '> Use this profile in the Draft tab</label><label class="f" style="flex:1 1 200px">Profile name<input type="text" id="t-name" value="' + esc(App.profileName) + '"></label></div>' : '<p class="small" style="margin-top:10px">No profile loaded.</p>') + '</div>';
  if (App.profile) {
    h += '<div class="card"><div class="row between"><h3>Players and pools</h3><button class="btn sm" data-act="t-addp">Add player</button></div><div class="stack" id="t-players">' + App.profile.players.map(function (pl, i) {
      return '<div style="border:1px solid var(--line);border-radius:8px;padding:10px"><div class="row"><label class="f" style="flex:1 1 140px">Name<input type="text" data-t="name" data-i="' + i + '" value="' + esc(pl.name) + '"></label>' +
        '<label class="f" style="flex:1 1 140px">Role<select data-t="role" data-i="' + i + '"><option value="">Any</option>' + ['Tank', 'Bruiser', 'Offlaner', 'Melee Assassin', 'Ranged Assassin', 'Healer', 'Support', 'Flex'].map(function (r) { return '<option' + (pl.role === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + (pl.role && ['Tank', 'Bruiser', 'Offlaner', 'Melee Assassin', 'Ranged Assassin', 'Healer', 'Support', 'Flex'].indexOf(pl.role) < 0 ? '<option selected>' + esc(pl.role) + '</option>' : '') + '</select></label>' +
        '<button class="btn sm" data-act="t-delp" data-i="' + i + '">Remove player</button></div>' +
        '<div class="row" style="margin-block:8px">' + (pl.pool.map(function (e, j) {
          return '<span class="hm">' + (App.data.heroes[e.hero] ? hn(e.hero) : '<b>' + esc(e.hero) + '</b> <span class="pill warn">unknown</span>') + '<select data-t="comfort" data-i="' + i + '" data-j="' + j + '" aria-label="Comfort">' + [1, 2, 3].map(function (c) { return '<option value="' + c + '"' + (e.comfort === c ? ' selected' : '') + '>' + COMFORT[c] + '</option>'; }).join('') + '</select><button data-act="t-delh" data-i="' + i + '" data-j="' + j + '" aria-label="Remove hero">x</button></span>';
        }).join('') || '<span class="small muted">No heroes yet.</span>') + '</div>' + pickerHtml('t-pk' + i, 'Add a hero to ' + pl.name) + '</div>';
    }).join('') + '</div></div><div class="card" id="t-cov"></div>';
  }
  h += '<div class="card"><h3>Import and export</h3><p class="small muted">Paste profile JSON or choose a file to import. To export, copy the text below. Accepted shapes: <code>{"players":[{"name":"A","role":"Tank","pool":[{"hero":"Muradin","comfort":3},"Johanna"]}]}</code> or <code>{"pool":{"Valla":3}}</code>. Comfort is 1 (can play), 2 (comfortable) or 3 (best hero); a bare hero name counts as 2.</p>' +
    '<textarea id="t-json" rows="9" placeholder="Paste profile JSON here" aria-label="Profile JSON">' + (App.profile ? esc(profileJson()) : '') + '</textarea>' +
    '<div class="row" style="margin-top:8px"><button class="btn pri" data-act="t-import">Import from text</button><button class="btn" data-act="t-copy"' + (App.profile ? '' : ' disabled') + '>Copy JSON</button><label class="btn" style="cursor:pointer">Choose file<input type="file" id="t-file" accept=".json,application/json" hidden></label></div><div id="t-msg" class="small" style="margin-top:8px"></div></div></div>';
  p.innerHTML = h;
  if (App.profile) {
    App.profile.players.forEach(function (pl, i) { mountPicker('t-pk' + i, function (hero) { if (!pl.pool.some(function (e) { return e.hero === hero; })) pl.pool.push({ hero: hero, comfort: 2 }); profileEdited(); }); });
    $$('[data-t]', p).forEach(function (el) {
      el.addEventListener('change', function () {
        var i = +el.getAttribute('data-i'), k = el.getAttribute('data-t'), pl = App.profile.players[i];
        if (k === 'comfort') pl.pool[+el.getAttribute('data-j')].comfort = +el.value; else pl[k] = el.value;
        profileEdited(true);
      });
    });
    var u = $('#t-use'); if (u) u.onchange = function () { App.useProfile = u.checked; store('useprof', App.useProfile); delete App.dirty.draft; };
    var nm = $('#t-name'); if (nm) nm.onchange = function () { App.profileName = nm.value; setProfile(App.profile, nm.value); };
    drawCoverage();
  }
  $('#t-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var r = new FileReader(); r.onload = function () { $('#t-json').value = String(r.result); importText(); }; r.readAsText(f);
  });
};
function profileEdited(soft) {
  setProfile(App.profile, App.profileName);
  if (soft) { drawCoverage(); var j = $('#t-json'); if (j) j.value = profileJson(); } else { App.dirty.team = false; renderActive(); }
}
function drawCoverage() {
  var el = $('#t-cov'); if (!el) return;
  var np = E.normalizeProfile(App.profile);
  if (!np.any) { el.innerHTML = '<h3>Pool coverage</h3><p class="small muted">Add heroes to see coverage.</p>'; return; }
  var cov = E.poolCoverage(App.data, App.profile);
  var h = '<h3>Pool coverage ' + tag(cov.basis || 'judgment') + '</h3><p class="small muted">Which archetypes and roles the pool can fill, by hero comfort. An empty archetype means no pool hero is tagged for it in the hero matrix, which is a draft.</p><div class="grid2" style="align-items:start"><div><h4>By archetype</h4>' +
    table(['Archetype', 'Pool heroes'], E.ARCHETYPES.map(function (a) {
      var l = cov.byArchetype[a] || [];
      return '<tr><td>' + esc(a) + '</td><td class="small">' + (l.length ? l.map(function (x) { return esc(disp(x.hero)) + (x.comfort === 3 ? ' (best)' : ''); }).join(', ') : '<span class="pill bad">none</span>') + '</td></tr>';
    })) + '</div><div><h4>By role</h4>' + table(['Role', 'Pool heroes'], ['Tank', 'Bruiser', 'Melee Assassin', 'Ranged Assassin', 'Healer', 'Support'].map(function (r) {
      var l = cov.byRole[r] || [];
      return '<tr><td>' + esc(r) + '</td><td class="small">' + (l.length ? l.map(function (x) { return esc(disp(x.hero)) + (x.comfort === 3 ? ' (best)' : ''); }).join(', ') : '<span class="pill bad">none</span>') + '</td></tr>';
    })) + '</div></div>';
  if (cov.unknownHeroes && cov.unknownHeroes.length) h += '<div class="note warn" style="margin-top:8px">Not found in the hero matrix, so ignored: ' + cov.unknownHeroes.map(esc).join(', ') + '.</div>';
  el.innerHTML = h;
}
function importText() {
  var msg = $('#t-msg');
  try {
    var raw = JSON.parse($('#t-json').value);
    var prof = canonProfile(raw);
    var np = E.normalizeProfile(prof);
    var cov = E.poolCoverage(App.data, prof);
    setProfile(prof, (raw && raw.name) || 'Imported profile');
    App.dirty.team = false; renderActive();
    var m2 = $('#t-msg'); if (m2) m2.innerHTML = '<span class="pos">Imported ' + prof.players.length + ' player(s), ' + Object.keys(np.pool).length + ' heroes.</span>' + (cov.unknownHeroes && cov.unknownHeroes.length ? ' <span class="low">Unknown heroes ignored: ' + cov.unknownHeroes.map(esc).join(', ') + '.</span>' : '');
  } catch (e) { msg.innerHTML = '<span class="neg">Could not import: ' + esc(e.message) + '</span>'; }
}
ACT['t-import'] = importText;
ACT['t-copy'] = function () { if (App.profile) copyText(profileJson(), 'Profile JSON copied'); };
ACT['t-example'] = function () { setProfile(canonProfile(window.EXAMPLE_PROFILE), 'Example team'); App.useProfile = true; store('useprof', true); App.dirty.team = false; renderActive(); toast('Example team loaded and switched on for Draft'); };
ACT['t-new'] = function () { setProfile({ players: [{ name: 'Player 1', role: '', pool: [] }] }, 'My team'); App.dirty.team = false; renderActive(); };
ACT['t-clear'] = function () { setProfile(null, ''); App.dirty.team = false; renderActive(); };
ACT['t-addp'] = function () { App.profile.players.push({ name: 'Player ' + (App.profile.players.length + 1), role: '', pool: [] }); profileEdited(); };
ACT['t-delp'] = function (el) { App.profile.players.splice(+el.getAttribute('data-i'), 1); profileEdited(); };
ACT['t-delh'] = function (el) { App.profile.players[+el.getAttribute('data-i')].pool.splice(+el.getAttribute('data-j'), 1); profileEdited(); };
