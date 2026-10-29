/* HotS Tools: My Games engine. Pure functions, no DOM, no network. UMD: window.HotsGames or require().
   A game is { id, t (epoch ms UTC), type, map, hero, role, won (0/1), lvl, k, a, td, d, hd, sd, st, mn, cr, heal, taken, xp,
               dead (seconds), camps, fto (0/1/null), mmr, hmmr, rmmr, award, tal [7 talent titles] }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HotsGames = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LOW_N = 8, PRIOR = 10;
  var MODE_NAMES = { sl: 'Storm League', qm: 'Quick Match', ar: 'ARAM', ud: 'Unranked Draft', hl: 'Hero League', tl: 'Team League', br: 'Brawl', cu: 'Custom', ot: 'Other' };
  var ROLES = ['Tank', 'Bruiser', 'Melee Assassin', 'Ranged Assassin', 'Healer', 'Support'];
  var TIER_KEYS = ['level_one', 'level_four', 'level_seven', 'level_ten', 'level_thirteen', 'level_sixteen', 'level_twenty'];
  var TIER_LABELS = ['1', '4', '7', '10', '13', '16', '20'];

  /* ------------------------------------------------------------ small helpers */
  function keyOf(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function num(x) { if (x == null || x === '') return null; var v = Number(x); return isFinite(v) ? v : null; }
  function shrink(w, n, center, prior) { center = center == null ? 0.5 : center; prior = prior == null ? PRIOR : prior; return (w + prior * center) / (n + prior); }
  function wilson(w, n) {
    if (!n) return [0, 1];
    var z = 1.96, p = w / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    return [(c - m) / d, (c + m) / d];
  }
  function mean(a) { var s = 0, c = 0; for (var i = 0; i < a.length; i++) if (a[i] != null) { s += a[i]; c++; } return c ? s / c : null; }
  function rate(w, n, center) { return { n: n, w: w, wr: n ? w / n : null, shrunk: shrink(w, n, center), low: n < LOW_N, ci: wilson(w, n) }; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function pct(x, d) { return x == null || isNaN(x) ? 'n/a' : (x * 100).toFixed(d == null ? 1 : d) + '%'; }

  /* ------------------------------------------------------------ import */
  function modeOf(s) {
    var k = keyOf(s);
    if (!k) return 'ot';
    if (MODE_NAMES[k]) return k;
    if (/stormleague|ranked/.test(k)) return 'sl';
    if (/quickmatch/.test(k)) return 'qm';
    if (/aram/.test(k)) return 'ar';
    if (/unrankeddraft|draft/.test(k)) return 'ud';
    if (/heroleague/.test(k)) return 'hl';
    if (/teamleague/.test(k)) return 'tl';
    if (/brawl/.test(k)) return 'br';
    if (/custom/.test(k)) return 'cu';
    return 'ot';
  }
  function parseDate(s) {
    if (s == null || s === '') return null;
    if (typeof s === 'number') return s < 1e12 ? s * 1000 : s;
    var str = String(s).trim();
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    var m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);   // month/day/year
    if (m2) return Date.UTC(+m2[3], +m2[1] - 1, +m2[2]);
    var t = Date.parse(str);
    return isNaN(t) ? null : t;
  }
  function fromHP(r) {
    if (!r || typeof r !== 'object') return null;
    var hero = r.hero && typeof r.hero === 'object' ? r.hero.name : r.hero;
    if (!hero) return null;
    var tal = TIER_KEYS.map(function (k) { var x = r[k]; return x && typeof x === 'object' ? (x.title || x.talent_name || null) : (typeof x === 'string' ? x : null); });
    var anyTal = tal.some(function (x) { return x; });
    var gt = r.game_type && typeof r.game_type === 'object' ? (r.game_type.short_name || r.game_type.name) : r.game_type;
    var role = r.role || (r.hero && r.hero.new_role) || '';
    return {
      id: r.replayID != null ? r.replayID : null, t: parseDate(r.game_date), type: modeOf(gt),
      map: r.game_map && typeof r.game_map === 'object' ? r.game_map.name : (r.game_map || ''), hero: hero, role: role,
      won: r.winner ? 1 : 0, lvl: num(r.level), k: num(r.kills), a: num(r.assists), td: num(r.takedowns), d: num(r.deaths),
      hd: num(r.hero_damage), sd: num(r.siege_damage), st: num(r.structure_damage), mn: num(r.minion_damage), cr: num(r.creep_damage),
      heal: num(r.healing), taken: num(r.damage_taken), xp: num(r.experience_contribution), dead: num(r.time_spent_dead), camps: num(r.merc_camp_captures),
      fto: r.first_to_ten == null ? null : (r.first_to_ten ? 1 : 0), mmr: num(r.player_mmr), hmmr: num(r.hero_mmr), rmmr: num(r.role_mmr),
      award: r.match_award || null, tal: anyTal ? tal : null
    };
  }
  function fromCompact(r) {
    if (!r || !r.hero) return null;
    var g = { id: r.id == null ? null : r.id, t: typeof r.t === 'number' ? r.t : parseDate(r.t || r.date), type: modeOf(r.type || r.mode), map: r.map || '', hero: r.hero, role: r.role || '',
      won: (r.won === true || r.won === 1 || r.won === '1') ? 1 : 0 };
    ['lvl', 'k', 'a', 'td', 'd', 'hd', 'sd', 'st', 'mn', 'cr', 'heal', 'taken', 'xp', 'dead', 'camps', 'mmr', 'hmmr', 'rmmr'].forEach(function (f) { g[f] = num(r[f]); });
    g.fto = r.fto == null ? null : (r.fto ? 1 : 0);
    g.award = r.award || null;
    g.tal = Array.isArray(r.tal) ? r.tal.slice(0, 7) : null;
    return g;
  }
  /* Minimal CSV reader: quoted fields; commas, semicolons or tabs. */
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    var head = text.slice(0, 4000).split(/\r?\n/)[0] || '';
    var delim = (head.split('\t').length > head.split(',').length) ? '\t' : (head.split(';').length > head.split(',').length ? ';' : ',');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c === '\r') { /* skip */ }
      else f += c;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }
  var CSV_SYN = {
    date: ['date', 'gamedate', 'time', 'datetime', 'played', 'when', 'timestamp'],
    hero: ['hero', 'character', 'heroname'],
    map: ['map', 'battleground', 'mapname'],
    result: ['result', 'won', 'win', 'outcome', 'winner', 'wl'],
    role: ['role', 'heroclass'],
    type: ['mode', 'type', 'gametype', 'queue'],
    k: ['kills', 'k'], a: ['assists', 'a'], d: ['deaths', 'd'], td: ['takedowns', 'td'],
    hd: ['herodamage', 'damage', 'dmg', 'hd'], sd: ['siegedamage', 'siege', 'sd'], heal: ['healing', 'heal'],
    taken: ['damagetaken', 'taken'], xp: ['xp', 'experience', 'experiencecontribution'], mmr: ['mmr', 'playermmr', 'rating'],
    lvl: ['level', 'lvl'], id: ['replayid', 'id', 'replay'], dead: ['timedead', 'timespentdead', 'dead'], camps: ['camps', 'merccamps', 'merccampcaptures']
  };
  function csvToGames(rows, warnings) {
    if (!rows.length) return [];
    var head = rows[0].map(keyOf), idx = {};
    Object.keys(CSV_SYN).forEach(function (f) {
      for (var i = 0; i < head.length; i++) if (CSV_SYN[f].indexOf(head[i]) >= 0) { idx[f] = i; break; }
    });
    if (idx.hero == null || idx.result == null) { warnings.push('The CSV needs at least a hero column and a result (won) column. Found: ' + rows[0].join(', ')); return []; }
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var get = function (f) { return idx[f] == null ? null : row[idx[f]]; };
      var res = String(get('result') == null ? '' : get('result')).trim().toLowerCase();
      var won = /^(1|w|win|won|victory|true|yes)/.test(res) ? 1 : 0;
      var rid = get('id');
      var g = { id: rid ? (Number(rid) || rid) : null, t: parseDate(get('date')), type: modeOf(get('type')), map: String(get('map') || '').trim(),
        hero: String(get('hero') || '').trim(), role: String(get('role') || '').trim(), won: won };
      if (!g.hero) continue;
      ['lvl', 'k', 'a', 'td', 'd', 'hd', 'sd', 'heal', 'taken', 'xp', 'mmr', 'dead', 'camps'].forEach(function (f) { g[f] = num(get(f)); });
      g.st = g.mn = g.cr = g.hmmr = g.rmmr = null; g.fto = null; g.award = null; g.tal = null;
      if (g.td == null && g.k != null && g.a != null) g.td = g.k + g.a;
      out.push(g);
    }
    return out;
  }
  /* text -> { games, source, battletag, warnings } */
  function parseImport(text) {
    var warnings = [], games = [], source = 'unknown', battletag = null, t = String(text || '').replace(/^﻿/, '').trim();
    if (!t) return { games: [], source: 'empty', battletag: null, warnings: ['Nothing to import.'] };
    var data = null;
    if (t[0] === '{' || t[0] === '[') {
      try { data = JSON.parse(t); } catch (e) {
        try { data = JSON.parse('[' + t.replace(/\}\s*\{/g, '},{') + ']'); } catch (e2) { return { games: [], source: 'json-error', battletag: null, warnings: ['That looks like JSON but it does not parse (' + e.message + ').'] }; }
      }
    }
    if (data) {
      var rows = [];
      var collect = function (x) {
        if (Array.isArray(x)) { x.forEach(collect); return; }
        if (x && typeof x === 'object') {
          if (x.format === 'hots-tools-games' && Array.isArray(x.games)) { source = 'hots-tools'; battletag = x.battletag || battletag; x.games.forEach(function (r) { rows.push({ c: r }); }); return; }
          if (Array.isArray(x.data)) { if (source === 'unknown') source = 'heroes-profile'; x.data.forEach(function (r) { rows.push({ hp: r }); }); return; }
          if (x.hero && (x.replayID != null || x.game_date || x.game_type)) { if (source === 'unknown') source = 'heroes-profile'; rows.push({ hp: x }); return; }
          if (x.hero && (x.won != null || x.t != null)) { if (source === 'unknown') source = 'hots-tools'; rows.push({ c: x }); return; }
        }
      };
      collect(data);
      rows.forEach(function (r) { var g = r.hp ? fromHP(r.hp) : fromCompact(r.c); if (g) games.push(g); });
      if (!games.length) warnings.push('No games found in that file. Expected a Heroes Profile match history page, a HotS Tools export or a CSV.');
    } else {
      source = 'csv';
      games = csvToGames(parseCSV(t), warnings);
      if (!games.length && !warnings.length) warnings.push('No rows found. The first line must be a header with hero and result columns.');
    }
    var bad = games.filter(function (g) { return g.t == null; }).length;
    if (bad) warnings.push(bad + ' games have no date. They count in totals but not in trends or sessions.');
    return { games: games, source: source, battletag: battletag, warnings: warnings };
  }
  function gameKey(g) { return g.id != null ? 'i' + g.id : 'x' + g.t + '|' + g.hero + '|' + g.map + '|' + g.won; }
  /* merge by replay id (or date+hero+map); incoming rows win. Sorted by time ascending. */
  function mergeGames(existing, incoming) {
    var m = {}, out = [], added = 0;
    existing.forEach(function (g) { m[gameKey(g)] = g; });
    incoming.forEach(function (g) { var k = gameKey(g); if (!m[k]) added++; m[k] = g; });
    Object.keys(m).forEach(function (k) { out.push(m[k]); });
    out.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
    return { games: out, added: added, duplicates: incoming.length - added };
  }
  function canonHeroes(games, names) {
    var map = {};
    (names || []).forEach(function (n) { map[keyOf(n)] = n; });
    games.forEach(function (g) { var c = map[keyOf(g.hero)]; if (c) g.hero = c; });
    return games;
  }

  /* ------------------------------------------------------------ filters and groups */
  function modeCounts(games) {
    var c = {}; games.forEach(function (g) { c[g.type] = (c[g.type] || 0) + 1; });
    return Object.keys(c).map(function (k) { return { type: k, name: MODE_NAMES[k] || k, n: c[k] }; }).sort(function (a, b) { return b.n - a.n; });
  }
  function applyFilter(games, f) {
    f = f || {};
    return games.filter(function (g) {
      if (f.types && f.types.length && f.types.indexOf(g.type) < 0) return false;
      if (f.since != null && (g.t == null || g.t < f.since)) return false;
      if (f.until != null && (g.t == null || g.t > f.until)) return false;
      if (f.roles && f.roles.length && f.roles.indexOf(g.role) < 0) return false;
      if (f.maps && f.maps.length && f.maps.indexOf(g.map) < 0) return false;
      if (f.heroes && f.heroes.length && f.heroes.indexOf(g.hero) < 0) return false;
      return true;
    });
  }
  function groupBy(games, fn) {
    var m = {}, order = [];
    games.forEach(function (g) { var k = fn(g); if (k == null || k === '') return; if (!m[k]) { m[k] = []; order.push(k); } m[k].push(g); });
    return { map: m, keys: order };
  }
  function sumWins(a) { var w = 0; for (var i = 0; i < a.length; i++) w += a[i].won; return w; }
  function avgOf(a, f) { return mean(a.map(function (g) { return g[f]; })); }
  function lastN(games, n) { var d = games.filter(function (g) { return g.t != null; }); return d.slice(Math.max(0, d.length - n)); }

  /* ------------------------------------------------------------ overview and tables */
  function overview(games) {
    var n = games.length, w = sumWins(games), r = rate(w, n);
    var dated = games.filter(function (g) { return g.t != null; });
    var mm = games.filter(function (g) { return g.mmr != null && g.t != null; });
    var k = 0, a = 0, d = 0;
    games.forEach(function (g) { k += g.k || 0; a += g.a || 0; d += g.d || 0; });
    return {
      n: n, wins: w, losses: n - w, wr: r.wr, ci: r.ci,
      first: dated.length ? dated[0].t : null, last: dated.length ? dated[dated.length - 1].t : null,
      kda: d ? (k + a) / d : null,
      deaths: avgOf(games, 'd'), hd: avgOf(games, 'hd'), heal: avgOf(games, 'heal'), sd: avgOf(games, 'sd'), xp: avgOf(games, 'xp'), dead: avgOf(games, 'dead'),
      mmrNow: mm.length ? mm[mm.length - 1].mmr : null,
      mmrPeak: mm.length ? Math.max.apply(null, mm.map(function (g) { return g.mmr; })) : null,
      mmrFirst: mm.length ? mm[0].mmr : null
    };
  }
  function statsRow(key, arr, center) {
    var r = rate(sumWins(arr), arr.length, center);
    var o = { key: key, n: arr.length, w: r.w, l: arr.length - r.w, wr: r.wr, shrunk: r.shrunk, low: r.low, ci: r.ci,
      k: avgOf(arr, 'k'), a: avgOf(arr, 'a'), d: avgOf(arr, 'd'), hd: avgOf(arr, 'hd'), sd: avgOf(arr, 'sd'), heal: avgOf(arr, 'heal'),
      taken: avgOf(arr, 'taken'), xp: avgOf(arr, 'xp'), dead: avgOf(arr, 'dead'), camps: avgOf(arr, 'camps') };
    var ks = 0, as = 0, ds = 0; arr.forEach(function (g) { ks += g.k || 0; as += g.a || 0; ds += g.d || 0; });
    o.kda = ds ? (ks + as) / ds : null;
    var dated = arr.filter(function (g) { return g.t != null; });
    var recent = dated.slice(-10);
    o.last10 = recent.length ? { n: recent.length, w: sumWins(recent) } : null;
    o.lastPlayed = dated.length ? dated[dated.length - 1].t : null;
    var mm = arr.filter(function (g) { return g.hmmr != null && g.t != null; }); o.hmmr = mm.length ? mm[mm.length - 1].hmmr : null;
    return o;
  }
  /* global is { hero: { win: 50.1 (percent), pick, ban, games } } or null */
  function heroTable(games, global) {
    var g = groupBy(games, function (x) { return x.hero; });
    return g.keys.map(function (h) {
      var gl = global && global[h] ? global[h].win / 100 : null;
      var row = statsRow(h, g.map[h], gl == null ? 0.5 : gl);
      var c = {}, best = null;
      g.map[h].forEach(function (x) { c[x.role] = (c[x.role] || 0) + 1; });
      Object.keys(c).forEach(function (k) { if (!best || c[k] > c[best]) best = k; });
      row.role = best || '';
      row.global = gl; row.edge = gl == null ? null : row.wr - gl; row.edgeShrunk = gl == null ? null : row.shrunk - gl;
      row.share = games.length ? row.n / games.length : 0;
      return row;
    }).sort(function (a, b) { return b.n - a.n; });
  }
  function mapTable(games) {
    var g = groupBy(games, function (x) { return x.map; });
    return g.keys.map(function (m) { return statsRow(m, g.map[m]); }).sort(function (a, b) { return b.n - a.n; });
  }
  function roleTable(games) {
    var g = groupBy(games, function (x) { return x.role; });
    return g.keys.map(function (r) {
      var row = statsRow(r, g.map[r]); row.share = games.length ? row.n / games.length : 0;
      var rm = g.map[r].filter(function (x) { return x.rmmr != null && x.t != null; }); row.rmmr = rm.length ? rm[rm.length - 1].rmmr : null;
      row.heroes = groupBy(g.map[r], function (x) { return x.hero; }).keys.length;
      return row;
    }).sort(function (a, b) { return b.n - a.n; });
  }
  function heroByMap(games, hero) { return mapTable(games.filter(function (g) { return g.hero === hero; })); }
  /* rolling win rate over a window of N games, one point per game from game N on */
  function rolling(games, win) {
    var d = games.filter(function (g) { return g.t != null; }), out = [], w = 0;
    for (var i = 0; i < d.length; i++) {
      w += d[i].won;
      if (i >= win) w -= d[i - win].won;
      if (i >= win - 1) out.push({ i: i + 1, t: d[i].t, wr: w / win });
    }
    return out;
  }
  function mmrSeries(games, field) {
    field = field || 'mmr';
    return games.filter(function (g) { return g[field] != null && g.t != null; }).map(function (g) { return { t: g.t, v: g[field], hero: g.hero, won: g.won }; });
  }
  function monthly(games) {
    var g = groupBy(games.filter(function (x) { return x.t != null; }), function (x) { var d = new Date(x.t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); });
    return g.keys.sort().map(function (k) { var r = rate(sumWins(g.map[k]), g.map[k].length); r.key = k; return r; });
  }

  /* ------------------------------------------------------------ sessions and habits */
  function sessions(games, gapMin) {
    gapMin = gapMin || 90;
    var d = games.filter(function (g) { return g.t != null; }).slice().sort(function (a, b) { return a.t - b.t; });
    var out = [], cur = null;
    d.forEach(function (g) {
      if (!cur || g.t - cur.end > gapMin * 60000) { cur = { start: g.t, end: g.t, games: [] }; out.push(cur); }
      cur.end = g.t; cur.games.push(g);
    });
    return out;
  }
  function sessionStats(games, gapMin) {
    var ss = sessions(games, gapMin), byIdx = {}, afterLoss = { 0: [0, 0], 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    ss.forEach(function (s) {
      var losses = 0;
      s.games.forEach(function (g, i) {
        var k = Math.min(i + 1, 8);
        (byIdx[k] = byIdx[k] || [0, 0]); byIdx[k][1]++; byIdx[k][0] += g.won;
        var l = Math.min(losses, 3);
        afterLoss[l][1]++; afterLoss[l][0] += g.won;
        losses = g.won ? 0 : losses + 1;
      });
    });
    var dated = games.filter(function (g) { return g.t != null; });
    var overall = rate(sumWins(dated), dated.length), c = overall.wr == null ? 0.5 : overall.wr;
    return {
      n: ss.length, avgLen: ss.length ? mean(ss.map(function (s) { return s.games.length; })) : null,
      longest: ss.reduce(function (m, s) { return Math.max(m, s.games.length); }, 0),
      byIndex: Object.keys(byIdx).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { var r = rate(byIdx[k][0], byIdx[k][1], c); r.idx = k; return r; }),
      afterLosses: [0, 1, 2, 3].map(function (k) { var r = rate(afterLoss[k][0], afterLoss[k][1], c); r.losses = k; return r; }),
      overall: overall, sessions: ss
    };
  }
  function timeBuckets(games, tzOffsetMin) {
    var off = (tzOffsetMin || 0) * 60000, hours = {}, days = {};
    games.forEach(function (g) {
      if (g.t == null) return;
      var d = new Date(g.t + off), h = d.getUTCHours(), dow = d.getUTCDay();
      var hb = h < 6 ? 'Late night (0 to 6)' : h < 12 ? 'Morning (6 to 12)' : h < 18 ? 'Afternoon (12 to 18)' : 'Evening (18 to 24)';
      (hours[hb] = hours[hb] || []).push(g); (days[dow] = days[dow] || []).push(g);
    });
    var hb = ['Morning (6 to 12)', 'Afternoon (12 to 18)', 'Evening (18 to 24)', 'Late night (0 to 6)'];
    var dn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      hours: hb.filter(function (k) { return hours[k]; }).map(function (k) { var r = rate(sumWins(hours[k]), hours[k].length); r.key = k; return r; }),
      days: [1, 2, 3, 4, 5, 6, 0].filter(function (k) { return days[k]; }).map(function (k) { var r = rate(sumWins(days[k]), days[k].length); r.key = dn[k]; return r; })
    };
  }

  /* ------------------------------------------------------------ talents */
  function builds(games, hero) {
    var arr = games.filter(function (g) { return g.hero === hero && g.tal; });
    var g = groupBy(arr, function (x) { return x.tal.join('|'); });
    return g.keys.map(function (k) { var r = rate(sumWins(g.map[k]), g.map[k].length); r.tal = k.split('|'); r.key = k; return r; }).sort(function (a, b) { return b.n - a.n; });
  }
  function talentTiers(games, hero) {
    var arr = games.filter(function (g) { return g.hero === hero && g.tal; });
    return TIER_LABELS.map(function (lab, i) {
      var g = groupBy(arr, function (x) { return x.tal[i]; });
      var rows = g.keys.map(function (k) { var r = rate(sumWins(g.map[k]), g.map[k].length); r.talent = k; r.pick = arr.length ? g.map[k].length / arr.length : 0; return r; }).sort(function (a, b) { return b.n - a.n; });
      return { level: lab, n: arr.length, rows: rows };
    });
  }

  /* ------------------------------------------------------------ rank (approximate; Heroes Profile shows the real one) */
  var RANK_LOWER = [
    [2962, 'Master'], [2934, 'Diamond 1'], [2908, 'Diamond 2'], [2881, 'Diamond 3'], [2853, 'Diamond 4'], [2825, 'Diamond 5'],
    [2801, 'Platinum 1'], [2776, 'Platinum 2'], [2750, 'Platinum 3'], [2725, 'Platinum 4'], [2701, 'Platinum 5'],
    [2677, 'Gold 1'], [2654, 'Gold 2'], [2631, 'Gold 3'], [2607, 'Gold 4'], [2588, 'Gold 5'],
    [2562, 'Silver 1'], [2535, 'Silver 2'], [2510, 'Silver 3'], [2480, 'Silver 4'], [2455, 'Silver 5']
  ];
  function rankFromMmr(m) {
    if (m == null) return null;
    for (var i = 0; i < RANK_LOWER.length; i++) if (m >= RANK_LOWER[i][0]) return RANK_LOWER[i][1];
    return m >= 2200 ? 'Bronze' : 'Below Bronze';
  }

  /* ------------------------------------------------------------ similarity (hero suggestions) */
  var RATING_KEYS = ['camp_clear', 'wave_clear', 'teamfight', 'engage', 'peel', 'self_sustain', 'mobility', 'objective_burst', 'siege'];
  function heroVec(h) {
    if (!h || !h.ratings) return null;
    var v = RATING_KEYS.map(function (k) { return (h.ratings[k] || 3) - 3; });
    v.push(h.range_class === 'melee' ? -1 : h.range_class === 'long' ? 1 : 0);
    v.push(h.dmg_profile === 'burst' ? 1 : h.dmg_profile === 'sustain' ? -1 : 0);
    return v;
  }
  function cosine(a, b) {
    var d = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  }
  function describeLike(h, other) {
    var bits = [], r = h.ratings || {}, o = other.ratings || {};
    ['wave_clear', 'camp_clear', 'siege', 'engage', 'peel', 'mobility', 'objective_burst', 'self_sustain'].forEach(function (k) {
      if (r[k] != null && o[k] != null && r[k] >= 4 && o[k] >= 4) bits.push(k.replace(/_/g, ' '));
    });
    if (h.range_class && h.range_class === other.range_class) bits.push(h.range_class + ' range');
    return bits.slice(0, 3);
  }
  function effectiveHeroes(ht, total) { // inverse Simpson index: how many heroes you effectively play
    var s = 0; ht.forEach(function (h) { var p = h.n / total; s += p * p; });
    return s ? 1 / s : 0;
  }

  /* ------------------------------------------------------------ pool coach */
  /* ctx = { matrix: {heroes}, global: {hero: {win,pick,ban,games}} } */
  function poolCoach(games, ctx) {
    ctx = ctx || {};
    var matrix = (ctx.matrix && ctx.matrix.heroes) || {}, glob = ctx.global || {};
    var ht = heroTable(games, glob), rt = roleTable(games), total = games.length;
    var out = { roles: [], retreat: [], tryNext: [], rethink: [], avoid: [], concentration: null };
    var top3 = ht.slice(0, 3).reduce(function (s, r) { return s + r.n; }, 0);
    out.concentration = total ? { top1: ht[0] ? ht[0].key : null, top1Share: ht[0] ? ht[0].n / total : 0, top3Share: top3 / total, heroes: ht.length, effective: effectiveHeroes(ht, total) } : null;
    rt.filter(function (r) { return r.share >= 0.08 && r.n >= 15; }).forEach(function (r) {
      var hs = ht.filter(function (h) { return h.role === r.key; });
      var viable = hs.filter(function (h) { return h.n >= LOW_N && h.shrunk >= 0.5; });
      out.roles.push({ role: r.key, n: r.n, share: r.share, wr: r.wr, heroes: hs.length, solid: hs.filter(function (h) { return h.n >= LOW_N; }).length, viable: viable.length,
        best: viable.slice().sort(function (a, b) { return b.shrunk - a.shrunk; }).slice(0, 4).map(function (h) { return h.key; }),
        status: viable.length >= 3 ? 'deep' : viable.length === 2 ? 'ok' : viable.length === 1 ? 'thin' : 'none' });
    });
    ht.slice(0, 4).forEach(function (h) {
      if (h.n < 15) return;
      // fall backs: same role, ranked by how you do on them plus how much they play like the banned hero (so each main gets its own list)
      var hv = heroVec(matrix[h.key]);
      var alts = ht.filter(function (x) { return x.key !== h.key && x.role === h.role && x.n >= 5; }).map(function (x) {
        var xv = heroVec(matrix[x.key]), sim = hv && xv ? cosine(hv, xv) : 0;
        return { x: x, sim: sim, score: x.shrunk + 0.12 * sim };
      }).sort(function (a, b) { return b.score - a.score; });
      out.retreat.push({ hero: h.key, role: h.role, n: h.n, wr: h.wr, share: h.share, alts: alts.slice(0, 3).map(function (o) {
        var like = matrix[h.key] && matrix[o.x.key] ? describeLike(matrix[o.x.key], matrix[h.key]) : [];
        return { hero: o.x.key, n: o.x.n, wr: o.x.wr, shrunk: o.x.shrunk, low: o.x.low, sim: o.sim, like: like.slice(0, 2) };
      }) });
    });
    var good = ht.filter(function (h) { return h.n >= LOW_N && h.shrunk >= 0.52 && matrix[h.key]; }).slice(0, 8);
    var mainRoles = rt.filter(function (r) { return r.share >= 0.12; }).map(function (r) { return r.key; });
    var played = {}; ht.forEach(function (h) { if (h.n >= 5) played[h.key] = true; });
    if (good.length) {
      var cands = [];
      Object.keys(matrix).forEach(function (name) {
        if (played[name]) return;
        var h = matrix[name];
        if (mainRoles.length && mainRoles.indexOf(h.role) < 0) return;
        var v = heroVec(h); if (!v) return;
        var best = null, sum = 0, wsum = 0;
        good.forEach(function (g) {
          var gv = heroVec(matrix[g.key]); if (!gv) return;
          var c = cosine(v, gv), w = Math.max(0.1, g.shrunk - 0.45) * Math.sqrt(g.n);
          sum += c * w; wsum += w;
          if (!best || c > best.c) best = { c: c, hero: g.key };
        });
        if (!wsum) return;
        var sim = sum / wsum, gl = glob[name];
        var meta = gl ? Math.max(-0.5, Math.min(0.5, (gl.win - 50) / 10)) : 0;   // +0.5 means 55% or better globally
        var ease = ((h.ratings && h.ratings.ease_of_execution) || 3) - 3;        // -2 hard, +2 easy
        var score = sim + meta * 0.6 + ease * 0.1 + (gl && gl.pick ? Math.min(gl.pick, 20) / 200 : 0);
        var mine = ht.filter(function (x) { return x.key === name; })[0];
        cands.push({ hero: name, role: h.role, score: score, sim: sim, closest: best ? best.hero : null, global: gl ? gl.win : null, pick: gl ? gl.pick : null, games: gl ? gl.games : null,
          ease: h.ratings ? h.ratings.ease_of_execution : null, like: best ? describeLike(h, matrix[best.hero]) : [], played: mine ? mine.n : 0 });
      });
      cands.sort(function (a, b) { return b.score - a.score; });
      out.tryNext = cands.slice(0, 8);
    }
    out.rethink = ht.filter(function (h) { return h.n >= 12 && h.shrunk <= 0.48; }).sort(function (a, b) { return a.shrunk - b.shrunk; }).map(function (h) {
      return { hero: h.key, n: h.n, wr: h.wr, global: h.global, edge: h.edge, shrunk: h.shrunk, share: h.share, role: h.role };
    }).slice(0, 8);
    var hm = groupBy(games, function (g) { return g.hero + '|' + g.map; });
    out.avoid = hm.keys.map(function (k) { var a = hm.map[k], r = rate(sumWins(a), a.length), p = k.split('|'); return { hero: p[0], map: p[1], n: a.length, wr: r.wr, shrunk: r.shrunk }; })
      .filter(function (x) { return x.n >= 8 && x.shrunk <= 0.42; }).sort(function (a, b) { return a.shrunk - b.shrunk; }).slice(0, 6);
    return out;
  }

  /* ------------------------------------------------------------ insights: plain English, only what clears a bar */
  function insights(games, ctx) {
    ctx = ctx || {};
    var out = [], n = games.length;
    if (n < 20) return [{ kind: 'info', text: 'Only ' + n + ' games in this selection. Import more or widen the filters for patterns that mean anything.', n: n }];
    var ov = overview(games), glob = ctx.global || {};
    out.push({ kind: 'overall', text: 'You are ' + ov.wins + '-' + ov.losses + ' (' + pct(ov.wr) + ') over ' + n + ' games. With that many games the plausible range is ' + pct(ov.ci[0]) + ' to ' + pct(ov.ci[1]) + '.', n: n });
    if (n >= 60) {
      var dated = games.filter(function (g) { return g.t != null; });
      var l30 = dated.slice(-30), p30 = dated.slice(-60, -30);
      if (l30.length === 30 && p30.length === 30) {
        var a = sumWins(l30) / 30, b = sumWins(p30) / 30;
        if (Math.abs(a - b) >= 0.15) out.push({ kind: a > b ? 'good' : 'bad', text: 'Your last 30 games are ' + pct(a) + ' against ' + pct(b) + ' in the 30 before. Thirty games is a small window, so read it as a hint.', n: 60 });
      }
    }
    if (ov.mmrFirst != null && ov.mmrNow != null) {
      var dm = ov.mmrNow - ov.mmrFirst;
      if (Math.abs(dm) >= 25) out.push({ kind: dm > 0 ? 'good' : 'bad', text: 'Your MMR went from ' + ov.mmrFirst + ' to ' + ov.mmrNow + ' (' + (dm > 0 ? '+' : '') + dm + ') over the games in this selection.' + (ov.mmrNow < ov.mmrPeak - 40 ? ' Your peak was ' + ov.mmrPeak + '.' : ''), n: n });
    }
    var all = heroTable(games, glob), ht = all.filter(function (h) { return h.n >= 15 && h.global != null; });
    // Up to three of each, best and worst by edge over the global rate. The first used to be the only one, so one hero repeated every time.
    var posAll = ht.filter(function (h) { return h.edgeShrunk >= 0.04; }).sort(function (a, b) { return b.edgeShrunk - a.edgeShrunk; });
    var negAll = ht.filter(function (h) { return h.edgeShrunk <= -0.04; }).sort(function (a, b) { return a.edgeShrunk - b.edgeShrunk; });
    posAll.slice(0, 3).forEach(function (pos, i) {
      out.push({ kind: 'good', text: pos.key + (i === 0 ? ' is your best value hero: ' : ' also beats the field: ') + pct(pos.wr) + ' over ' + pos.n + ' games against ' + pct(pos.global) + ' for everyone in Storm League.', n: pos.n, hero: pos.key });
    });
    negAll.slice(0, 3).forEach(function (neg, i) {
      out.push({ kind: 'bad', text: neg.key + (i === 0 ? ' is costing you: ' : ' is also below the field: ') + pct(neg.wr) + ' over ' + neg.n + ' games against ' + pct(neg.global) + ' for everyone.' + (neg.share >= 0.1 ? ' It is ' + pct(neg.share) + ' of your games.' : ''), n: neg.n, hero: neg.key });
    });
    if (negAll.length > 3) out.push({ kind: 'info', text: negAll.length - 3 + ' more heroes sit clearly below the global rate. They are in the pool coach under Heroes costing you games.', n: negAll[3].n });
    var rt = roleTable(games).filter(function (r) { return r.n >= 25; });
    if (rt.length >= 2) {
      var br = rt.slice().sort(function (a, b) { return b.shrunk - a.shrunk; }), hi = br[0], lo = br[br.length - 1];
      if (hi.shrunk - lo.shrunk >= 0.06) out.push({ kind: 'info', text: 'By role you are strongest on ' + hi.key + ' (' + pct(hi.wr) + ', ' + hi.n + ' games) and weakest on ' + lo.key + ' (' + pct(lo.wr) + ', ' + lo.n + ' games).', n: hi.n + lo.n });
    }
    var mt = mapTable(games).filter(function (m) { return m.n >= 20; });
    if (mt.length >= 3) {
      var s = mt.slice().sort(function (a, b) { return b.shrunk - a.shrunk; });
      if (s[0].shrunk - 0.5 >= 0.05) out.push({ kind: 'good', text: 'Best map: ' + s[0].key + ' at ' + pct(s[0].wr) + ' over ' + s[0].n + ' games.', n: s[0].n });
      var w = s[s.length - 1];
      if (0.5 - w.shrunk >= 0.05) out.push({ kind: 'bad', text: 'Weakest map: ' + w.key + ' at ' + pct(w.wr) + ' over ' + w.n + ' games. Think about what you play there.', n: w.n });
    }
    var ss = sessionStats(games), base = ss.overall.wr, a2 = ss.afterLosses[2];
    if (a2 && a2.n >= 40 && base != null && base - a2.wr >= 0.07) out.push({ kind: 'bad', text: 'After two losses in a row in one sitting you win ' + pct(a2.wr) + ' of the next games (' + a2.n + ' games) against ' + pct(base) + ' overall. Stopping after two straight losses would have skipped games you tend to lose.', n: a2.n });
    var lateIdx = ss.byIndex.filter(function (r) { return r.idx >= 5; });
    var lw = lateIdx.reduce(function (s2, r) { return s2 + r.w; }, 0), ln = lateIdx.reduce(function (s2, r) { return s2 + r.n; }, 0);
    if (ln >= 40 && base != null && base - lw / ln >= 0.06) out.push({ kind: 'bad', text: 'From the fifth game of a sitting your win rate is ' + pct(lw / ln) + ' (' + ln + ' games) against ' + pct(base) + ' overall.', n: ln });
    var wins = games.filter(function (g) { return g.won && g.d != null; }), losses = games.filter(function (g) { return !g.won && g.d != null; });
    if (wins.length >= 15 && losses.length >= 15) out.push({ kind: 'info', text: 'You average ' + mean(wins.map(function (g) { return g.d; })).toFixed(1) + ' deaths in wins and ' + mean(losses.map(function (g) { return g.d; })).toFixed(1) + ' in losses.', n: wins.length + losses.length });
    var top = all[0];
    if (top && top.share >= 0.35 && n >= 60) out.push({ kind: 'info', text: top.key + ' is ' + pct(top.share) + ' of your games. If it is banned or taken you have less to fall back on. See the pool coach.', n: top.n, hero: top.key });
    return out;
  }

  /* ------------------------------------------------------------ replays (Deaths and talents) */
  // From build_my_replays.py --export. Each death in g.dl is [time, depth, teammates down near it, enemies down near it,
  // teammates down before it, heroes on the kill, those heroes joined by |, level gap, seconds dead]. Near means 15 seconds either side.
  // Depth is 0 at our structures and 1 at theirs, so above 0.5 is their half of the map.
  var DEATH_KINDS = ['alone', 'traded', 'first', 'late'];
  var DEATH_NAMES = { alone: 'Alone', traded: 'Traded', first: 'First down', late: 'After a teammate fell' };
  function deathKind(d) {
    if (!d[2] && !d[3]) return 'alone';
    if (d[4] > 0) return 'late';
    if (d[3] > 0) return 'traded';
    return 'first';
  }
  function parseReplays(text) {
    var d = text;
    if (typeof text === 'string') {
      var t = text.trim();
      if (t.charAt(0) !== '{' || t.indexOf('hots-tools-replays') < 0) return null;
      try { d = JSON.parse(t); } catch (e) { return null; }
    }
    if (!d || d.format !== 'hots-tools-replays' || !Array.isArray(d.games)) return null;
    var games = d.games.filter(function (g) { return g && g.hero && Array.isArray(g.dl); });
    games.forEach(function (g) { if (!g.type) g.type = g.mode || 'ot'; });
    games.sort(function (a, b) { return (a.t || 0) - (b.t || 0); });
    return { format: d.format, version: d.version || 1, player: d.player || '', built: d.built || null, near: d.near || 15,
             ref: d.ref || {}, refLabel: d.refLabel || '', games: games };
  }
  function deathRows(games, keyFn, ref) {
    var gb = groupBy(games, keyFn);
    return gb.keys.map(function (key) {
      var a = gb.map[key], r = { key: key, n: a.length, w: sumWins(a), d: 0, alone: 0, aloneK: 0, their: 0, known: 0 };
      a.forEach(function (g) {
        g.dl.forEach(function (d) {
          r.d++;
          if (deathKind(d) === 'alone') { r.alone++; if (d[5]) r.aloneK++; }
          if (d[1] != null) { r.known++; if (d[1] > 0.5) r.their++; }
        });
      });
      r.l = r.n - r.w; r.wr = r.n ? r.w / r.n : null; r.low = r.n < LOW_N;
      var x = ref && ref[key];
      // the league list only keeps takedowns with a hero on the kill, so the comparison uses aloneK
      if (x && x[0]) r.ref = { n: x[0], d: x[1] / x[0], alone: x[2] / x[0] };
      return r;
    }).sort(function (a, b) { return b.n - a.n; });
  }
  // Enemy heroes faced in minGames or more games: your deaths a game with them in the game against without them,
  // and how many of your deaths they were on. An association: they may simply come in strong comps.
  function deathFoes(games, minGames) {
    minGames = minGames || 5;
    var total = games.length, totalD = 0, by = {};
    games.forEach(function (g) {
      totalD += g.dl.length;
      (g.en || []).forEach(function (h) {
        var o = by[h] || (by[h] = { hero: h, n: 0, d: 0, on: 0, w: 0 });
        o.n++; o.d += g.dl.length; o.w += g.won ? 1 : 0;
        g.dl.forEach(function (d) { if (String(d[6] || '').split('|').indexOf(h) >= 0) o.on++; });
      });
    });
    return Object.keys(by).map(function (h) {
      var o = by[h], rest = total - o.n;
      o.with = o.n ? o.d / o.n : null; o.without = rest ? (totalD - o.d) / rest : null;
      o.gap = o.with != null && o.without != null ? o.with - o.without : null; o.wr = o.n ? o.w / o.n : null;
      return o;
    }).filter(function (o) { return o.n >= minGames; }).sort(function (a, b) { return (b.gap || 0) - (a.gap || 0); });
  }
  function deathReview(games, ref) {
    var out = { n: games.length, w: sumWins(games), mins: 0, deaths: 0, kinds: { alone: 0, traded: 0, first: 0, late: 0 },
                their: 0, known: 0, deep: 0, behind: 0, ahead: 0 };
    var phases = [[0, 600, '0 to 10 min'], [600, 1200, '10 to 20 min'], [1200, 1e9, 'After 20 min']].map(function (p) { return { from: p[0], to: p[1], label: p[2], n: 0, alone: 0 }; });
    var buckets = [];   // two minute steps; the last one holds everything from 30 minutes on
    for (var b = 0; b < 16; b++) buckets.push({ from: b * 120, alone: 0, other: 0 });
    var split = { win: { n: 0, d: 0, alone: 0 }, loss: { n: 0, d: 0, alone: 0 } };
    var early = { with: { n: 0, w: 0 }, without: { n: 0, w: 0 } };
    games.forEach(function (g) {
      out.mins += (g.len || 0) / 60;
      var s = g.won ? split.win : split.loss, earlyAlone = false;
      s.n++;
      g.dl.forEach(function (d) {
        var k = deathKind(d);
        out.deaths++; out.kinds[k]++; s.d++;
        if (k === 'alone') { s.alone++; if (d[0] < 1200) earlyAlone = true; }
        if (d[1] != null) { out.known++; if (d[1] > 0.5) out.their++; if (d[1] > 1) out.deep++; }
        if (d[7] != null && d[7] <= -2) out.behind++;
        if (d[7] != null && d[7] > 0) out.ahead++;
        phases.forEach(function (p) { if (d[0] >= p.from && d[0] < p.to) { p.n++; if (k === 'alone') p.alone++; } });
        var bi = Math.min(15, Math.max(0, Math.floor(d[0] / 120)));
        if (k === 'alone') buckets[bi].alone++; else buckets[bi].other++;
      });
      var e = earlyAlone ? early.with : early.without;
      e.n++; e.w += g.won ? 1 : 0;
    });
    out.phases = phases; out.buckets = buckets; out.split = split; out.early = early;
    out.heroes = deathRows(games, function (g) { return g.hero; }, ref);
    out.maps = deathRows(games, function (g) { return g.map; });
    out.foes = deathFoes(games);
    return out;
  }
  // Talents a hero took, level by level, with the record of the games each one was in.
  function replayTalents(games, hero) {
    var lv = {};
    games.forEach(function (g) {
      if (g.hero !== hero) return;
      (g.tal || []).forEach(function (t) {
        var L = lv[t[0]] || (lv[t[0]] = {}), r = L[t[1]] || (L[t[1]] = { talent: t[1], n: 0, w: 0 });
        r.n++; r.w += g.won ? 1 : 0;
      });
    });
    return Object.keys(lv).map(Number).sort(function (a, b) { return a - b; }).map(function (l) {
      var rows = Object.keys(lv[l]).map(function (k) { var r = lv[l][k]; r.l = r.n - r.w; r.wr = r.n ? r.w / r.n : null; return r; })
        .sort(function (a, b) { return b.n - a.n; });
      return { level: l, n: rows.reduce(function (s2, r) { return s2 + r.n; }, 0), rows: rows };
    });
  }

  /* ------------------------------------------------------------ export */
  function toExport(games, battletag) { return { format: 'hots-tools-games', version: 1, battletag: battletag || null, exported: new Date().toISOString(), games: games }; }
  function toCSV(games) {
    var cols = ['date', 'mode', 'map', 'hero', 'role', 'result', 'kills', 'assists', 'deaths', 'takedowns', 'hero damage', 'siege damage', 'healing', 'damage taken', 'xp', 'mmr', 'replay id'];
    var rows = [cols.join(',')];
    games.forEach(function (g) {
      var d = g.t == null ? '' : new Date(g.t).toISOString().slice(0, 19).replace('T', ' ');
      var f = [d, g.type, g.map, g.hero, g.role, g.won ? 'win' : 'loss', g.k, g.a, g.d, g.td, g.hd, g.sd, g.heal, g.taken, g.xp, g.mmr, g.id];
      rows.push(f.map(function (x) { x = x == null ? '' : String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','));
    });
    return rows.join('\n');
  }

  return {
    LOW_N: LOW_N, PRIOR: PRIOR, MODE_NAMES: MODE_NAMES, ROLES: ROLES, TIER_LABELS: TIER_LABELS,
    keyOf: keyOf, shrink: shrink, wilson: wilson, rate: rate, parseImport: parseImport, parseCSV: parseCSV, fromHP: fromHP, fromCompact: fromCompact,
    mergeGames: mergeGames, canonHeroes: canonHeroes, modeCounts: modeCounts, applyFilter: applyFilter, groupBy: groupBy,
    overview: overview, heroTable: heroTable, mapTable: mapTable, roleTable: roleTable, heroByMap: heroByMap, rolling: rolling, mmrSeries: mmrSeries, monthly: monthly,
    sessions: sessions, sessionStats: sessionStats, timeBuckets: timeBuckets, builds: builds, talentTiers: talentTiers, rankFromMmr: rankFromMmr,
    poolCoach: poolCoach, insights: insights, toExport: toExport, toCSV: toCSV, lastN: lastN, pct: pct, heroVec: heroVec, cosine: cosine,
    DEATH_KINDS: DEATH_KINDS, DEATH_NAMES: DEATH_NAMES, deathKind: deathKind, parseReplays: parseReplays, deathReview: deathReview,
    deathRows: deathRows, deathFoes: deathFoes, replayTalents: replayTalents
  };
});
