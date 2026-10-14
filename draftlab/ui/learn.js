/* Learn and About tabs, plus the boot call. */
RENDER.learn = function (p) {
  var tpl = $('#t-learn'), box = document.createElement('div');
  box.innerHTML = tpl.innerHTML;
  var h = '<div class="stack"><div class="card"><h2>Learn</h2><p class="small muted">Short notes on drafting, comps, maps and macro play, with tags that say where each line comes from. Open a section to read it. Source tagged lines come from the named article or patch note. Judgment lines are opinion. Both can be wrong or out of date.</p></div>';
  $$('section', box).forEach(function (s, i) {
    var t = $('h3', s); var title = t ? t.textContent : 'Section';
    if (t) t.parentNode.removeChild(t);
    h += '<details class="card acc learn"' + (i === 0 ? ' open' : '') + '><summary><span style="font-family:var(--font-display);font-size:18px;font-weight:700">' + esc(title) + '</span></summary><div style="margin-top:8px">' + s.innerHTML + '</div></details>';
  });
  p.innerHTML = h + '</div>';
};

RENDER.about = function (p) {
  var d = App.data, g = d.games, o = d.options;
  var dates = g.map(function (x) { return x.date; }).filter(Boolean).sort();
  var byLS = o.leagueSeasons.map(function (x) { return '<tr><td>' + esc(x.value.replace(':', ' S')) + '</td><td class="r num">' + x.n + '</td></tr>'; }).join('');
  var byDiv = o.divisions.map(function (x) { return '<tr><td>' + esc(x.league + ' ' + x.value) + '</td><td class="r num">' + x.n + '</td></tr>'; }).join('');
  var judged = 0, ov = Object.keys(App.overrides).length;
  var h = '<div class="stack"><div class="card"><h2>About HotS Draft Lab</h2><p>A general purpose draft and meta tool for Heroes of the Storm. It reads a hero matrix and a set of league game records, and everything runs in this page with no network calls. Built ' + esc(window.BUILD_DATE || '') + '.</p>' +
    '<p class="small muted">It is not tied to one team. The Team tab accepts an optional profile of players and hero pools, kept in your browser only.</p></div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Dataset ' + tag('data') + '</h3><p class="small">' + g.length.toLocaleString() + ' games, ' + d.heroNames.length + ' heroes in the matrix, ' + o.teams.length + ' team names, ' + o.maps.length + ' maps. Game dates run from ' + esc(dates[0] || 'n/a') + ' to ' + esc(dates[dates.length - 1] || 'n/a') + '.</p>' +
    table(['League and season', { t: 'Games', c: 'r' }], [byLS]) + '<div style="height:8px"></div>' + table(['Division', { t: 'Games', c: 'r' }], [byDiv]) + '<p class="small muted" style="margin-top:6px">NGS rows are Nexus Gaming Series games, with first pick recorded. Heroes Lounge (HL) rows are an EU amateur league, with no first pick information. Row counts are read from the data, so adding rows needs no code change.</p></div>';
  h += '<div class="card"><h3>Measured, read from text, or judged</h3><ul class="small" style="margin:0;padding-left:18px">' +
    '<li><b>Measured</b> ' + tag('data') + ': pick, ban and win rates, map results, head to head and pair records, archetype matchups, first pick and level 10 association, team records. All from the game rows in your selection.</li>' +
    '<li><b>Read from ability text</b> ' + tag('kit') + ': some mobility, engage, self sustain, camp clear, wave clear, objective burst and siege ratings, crowd control counts, percent damage flags. A keyword scan agreed with the rating, which is weak proof.</li>' +
    '<li><b>Judged</b> ' + tag('judgment') + ': most ratings, comp fit labels, map profiles, skill weighting, extras such as power spike and pick risk, and every archetype definition. Confidence is marked low for odd kits.</li>' +
    '<li>Icy Veins counter, synergy and tier lists are used as list data. They are partial and one sided.</li>' +
    '<li>Heroes Profile patch 2.57 figures shown on hero pages are outside data from another source, with their own sample sizes.</li></ul>' +
    (ov ? '<p class="small note" style="margin-top:8px">You have overridden ratings for ' + ov + ' hero(es) in this browser. <button class="btn sm" data-act="h-resetov">Reset all overrides</button></p>' : '') + '</div></div>';
  h += '<div class="grid2" style="align-items:start"><div class="card"><h3>Sample size warning</h3><ul class="small" style="margin:0;padding-left:18px"><li>A number with fewer than ' + E.LOW_N + ' games is marked low sample. Read it as a lean.</li><li>Per map and per hero splits often rest on a handful of games, even in a selection of thousands.</li><li>Win rates are shrunk toward 50% with a prior of ' + E.PRIOR + ' games (' + E.MAP_PRIOR + ' for map splits), so small samples move little.</li><li>The selection bar warns under 30 games (very small) and under 150 (small).</li></ul></div>' +
    '<div class="card"><h3>What the data cannot show</h3><ul class="small" style="margin:0;padding-left:18px">' + E.LIMITS.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>';
  h += '<div class="card"><h3>Known limits</h3><ul class="small" style="margin:0;padding-left:18px"><li>The hero matrix is built from the hero profiles (ability text, measured stats and Hunter's notes) and is still a model, not a measurement. Override what you disagree with in the Heroes tab.</li><li>The NGS style draft order is taken from NGS match pages (four bans, five picks, two bans, five picks) and shown in the Draft tab. Other leagues may order bans differently: use free form there.</li><li>The new hero Xal\'atath is in the matrix but has no games.</li><li>Hero names come from the data files. One name in the source files has a damaged character, which this page shows as Lúcio.</li><li>Browser storage keeps filters, overrides and the team profile when allowed. If storage is blocked, the page still works and forgets on reload.</li><li>Ratings, archetype names and map profiles describe tendencies, not outcomes. Results from games describe what happened, not why.</li></ul></div></div>';
  p.innerHTML = h;
};

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') boot();
