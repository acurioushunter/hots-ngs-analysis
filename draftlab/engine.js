/*
 * Draft Lab engine. Pure, deterministic, no dependencies, no network.
 * Works with require() in Node and as the browser global DraftLabEngine.
 *
 * Conventions
 *  - Sides are team indexes 0 and 1 (the order of the two teams in a game row).
 *  - "games" are the objects made by createData (do not mutate them or the arrays).
 *  - Win rates are shrunk toward a centre (0.5 unless stated) with a prior of PRIOR games.
 *  - Every data driven number comes with n, and low:true when n is under LOW_N.
 *  - Nothing here claims a cause. Components say where a number comes from (basis):
 *    data (games or list data), kit (ability text scan) or judgment (authored rating).
 * See draftlab/API.md for every exported function.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DraftLabEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRIOR = 10;
  var LOW_N = 8;
  var MAP_PRIOR = 20; // map level splits are noisier, so they are pulled harder toward the hero's overall rate
  var ARCHETYPES = ['dive', 'poke', 'pick', 'sustain/attrition', '4 man push/split', 'deathball', 'wave clear siege'];
  var SKILLS = ['beginner', 'intermediate', 'advanced', 'pro'];

  // Weights are in "points", where one point is roughly one percentage point of win rate.
  var WEIGHTS = {
    winRate: 0.6, mapData: 0.8, mapKit: 0.4, compNeed: 2, counterGames: 0.5, counterLists: 1.2,
    synergyGames: 0.5, synergyLists: 0.8, exposure: 0.4, risk: 1, skill: 1, pool: 1, archMatchup: 0.5,
    banStrength: 0.6, banContest: 0.1, banThreatGames: 0.5, banThreatLists: 1.2, banNeed: 1.5, banHabit: 1, banPool: 1.5
  };

  // Which attributes a map rewards (judgment, written for this tool). Weight times (attribute minus 3).
  var MAP_PROFILES = {
    'Alterac Pass': { wave_clear: 1, global_presence: 0.8, mobility: 0.5, merc_camp_control: 0.5 },
    'Battlefield of Eternity': { wave_clear: 1, solo_lane_viability: 0.5, objective_burst: 0.4 },
    'Braxis Holdout': { wave_clear: 0.8, objective_burst: 0.8, siege: 0.4 },
    'Cursed Hollow': { wave_clear: 0.8, camp_clear: 0.5, mobility: 0.4, teamfight: 0.4 },
    'Dragon Shire': { teamfight: 0.7, mobility: 0.5, engage: 0.5, wave_clear: 0.3 },
    'Garden of Terror': { wave_clear: 0.6, mobility: 0.5, camp_clear: 0.3 },
    'Infernal Shrines': { camp_clear: 0.8, merc_camp_control: 0.8, wave_clear: 0.6, teamfight: 0.3 },
    'Sky Temple': { objective_burst: 0.8, wave_clear: 0.6, mobility: 0.4, teamfight: 0.4 },
    'Tomb of the Spider Queen': { teamfight: 0.7, wave_clear: 0.6, engage: 0.4, mobility: 0.3 },
    'Towers of Doom': { wave_clear: 0.8, siege: 0.7, merc_camp_control: 0.4, mobility: 0.3 },
    'Volskaya Foundry': { merc_camp_control: 0.8, objective_burst: 0.6, wave_clear: 0.4, teamfight: 0.4 }
  };

  var SKILL_TABLE = {
    beginner: { ease: 0.8, ceiling: 0, risk: 1.6 },
    intermediate: { ease: 0.3, ceiling: 0.1, risk: 1.0 },
    advanced: { ease: 0, ceiling: 0.2, risk: 0.7 },
    pro: { ease: -0.05, ceiling: 0.3, risk: 0.5 }
  };

  var LIMITS = [
    'Rows hold picks, bans, map, winner, length and a level 10 lead number. Only replay export games carry a timeline summary (first takedown, experience leads, first structure). There is no player skill, lane or rotation data.',
    'Heroes Lounge rows have no first pick information. First pick statistics use NGS rows only.',
    'Win rates describe games in the selection. They do not show why a team won, and strong players can inflate their favourite heroes.',
    'Ban order within a team is not recorded as a timeline, so a hero ban cannot be tied to a pick round.',
    'Level 10 lead sign is assumed: a positive number means team 0 reached level 10 first. The test report checks this against winners.',
    'Archetypes are assigned by a documented classifier from the hero matrix, which is a draft that is mostly judgment.'
  ];

  // ---------------------------------------------------------------- small helpers
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function shrink(wins, n, prior, center) {
    prior = prior == null ? PRIOR : prior;
    center = center == null ? 0.5 : center;
    return (wins + prior * center) / (n + prior);
  }
  function rate(wins, n, center, prior) {
    return { n: n, wins: wins, winRate: n ? wins / n : null, shrunk: shrink(wins, n, prior, center), low: n < LOW_N };
  }
  function log5(a, b) {
    var d = a * (1 - b) + b * (1 - a);
    return d ? (a * (1 - b)) / d : 0.5;
  }
  function cmp(keyFn) { // descending by keyFn, ties by text
    return function (a, b) {
      var x = keyFn(a), y = keyFn(b);
      if (y !== x) return y - x;
      var sa = String(a.hero || a.name || a.map || a.key || a.team || a.arch || ''), sb = String(b.hero || b.name || b.map || b.key || b.team || b.arch || '');
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    };
  }
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function memo(games, key, fn) {
    if (!cache || !games || typeof games !== 'object') return fn();
    var m = cache.get(games);
    if (!m) { m = {}; cache.set(games, m); }
    if (!(key in m)) m[key] = fn();
    return m[key];
  }
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; o.push(x); } }); return o; }
  function attr(h, key) {
    if (!h) return 3;
    if (h.ratings && typeof h.ratings[key] === 'number') return h.ratings[key];
    if (h.extra && typeof h.extra[key] === 'number') return h.extra[key];
    return 3;
  }
  // Basis of a rating group for one hero, from the matrix source tags.
  function basisOf(h, key) {
    if (!h) return 'judgment';
    if (h.source && h.source[key]) return h.source[key].basis;
    if (h.extra && h.extra.extra_source && h.extra.extra_source[key]) return h.extra.extra_source[key].basis;
    return 'judgment';
  }
  function basisOfMany(hs, key) {
    var any = false, allKit = true;
    hs.forEach(function (h) { any = true; if (basisOf(h, key) !== 'kit') allKit = false; });
    return any && allKit ? 'kit' : 'judgment';
  }
  function normSkill(s) {
    if (typeof s === 'number') return SKILLS[clamp(Math.round(s) - 1, 0, 3)];
    s = String(s || 'intermediate').toLowerCase();
    return SKILL_TABLE[s] ? s : 'intermediate';
  }
  function C(name, value, note, basis, extra) {
    var o = { name: name, value: r3(value), note: note, basis: basis };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  // ---------------------------------------------------------------- data
  function createData(input) {
    var hm = (input.matrix && input.matrix.heroes) || input.matrix || {};
    var heroes = {};
    Object.keys(hm).sort().forEach(function (n) { heroes[n] = Object.assign({ name: n }, hm[n]); });
    var data = { heroes: heroes, heroNames: Object.keys(heroes), games: [], byHero: {}, byTeam: {}, byMap: {}, options: null, matrixMeta: (input.matrix && input.matrix._meta) || null };
    (input.games || []).forEach(function (r, i) {
      var g;
      if (Array.isArray(r)) {
        g = {
          id: i, league: r[0], season: r[1], division: r[2], map: r[3], winner: r[4], firstPick: r[5] == null ? null : r[5],
          length: r[6], teams: [r[7], r[8]], picks: [(r[9] || []).slice(), (r[10] || []).slice()], bans: [(r[11] || []).slice(), (r[12] || []).slice()],
          date: r[13] || null, lvl10Lead: r[14] == null ? null : r[14],
          early: r.length > 15 ? { firstTd: r[15], xp5: r[16], xp10: r[17], xp15: r[18], firstStruct: r[19], firstCamp: r[20], firstObj: r[21], firstFort: r[22], firstKeep: r[23], aliveDiff: r[24], mercDiff: r[25], lvlAdv: r[26] } : null
        };
      } else {
        g = Object.assign({ id: i }, r);
        g.firstPick = g.firstPick == null ? null : g.firstPick;
        g.lvl10Lead = g.lvl10Lead == null ? null : g.lvl10Lead;
      }
      g.key = g.league + ' S' + g.season;
      g.arch = [archetypeOf({ heroes: heroes }, g.picks[0]).primary, archetypeOf({ heroes: heroes }, g.picks[1]).primary];
      data.games.push(g);
      [0, 1].forEach(function (s) {
        g.picks[s].forEach(function (h) { (data.byHero[h] = data.byHero[h] || []).push(g.id); });
        if (g.teams[s]) (data.byTeam[g.teams[s]] = data.byTeam[g.teams[s]] || []).push(g.id);
      });
      (data.byMap[g.map] = data.byMap[g.map] || []).push(g.id);
    });
    data.options = buildOptions(data.games);
    return data;
  }

  function buildOptions(games) {
    var o = { leagues: [], seasons: [], leagueSeasons: [], divisions: [], maps: [], teams: [] };
    var S = {}, L = {}, D = {}, M = {}, T = {}, LS = {};
    games.forEach(function (g) {
      L[g.league] = (L[g.league] || 0) + 1; S[g.season] = (S[g.season] || 0) + 1;
      if (g.division != null) { var dk = g.league + '|' + g.division; D[dk] = (D[dk] || 0) + 1; }
      M[g.map] = (M[g.map] || 0) + 1; LS[g.league + ':' + g.season] = (LS[g.league + ':' + g.season] || 0) + 1;
      g.teams.forEach(function (t) { if (t) T[t] = (T[t] || 0) + 1; });
    });
    o.leagues = Object.keys(L).sort().map(function (k) { return { value: k, n: L[k] }; });
    o.seasons = Object.keys(S).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return { value: k, n: S[k] }; });
    o.leagueSeasons = Object.keys(LS).sort().map(function (k) { return { value: k, n: LS[k] }; });
    o.divisions = Object.keys(D).sort().map(function (k) { var p = k.split('|'); return { league: p[0], value: p[1], n: D[k] }; });
    o.maps = Object.keys(M).sort().map(function (k) { return { value: k, n: M[k] }; });
    o.teams = Object.keys(T).sort(function (a, b) { return T[b] - T[a] || (a < b ? -1 : 1); }).map(function (k) { return { value: k, n: T[k] }; });
    return o;
  }

  // Filters: leagues, seasons, divisions, maps, teams (arrays), plus leagueSeasons like "NGS:21".
  // An absent or empty array means no restriction. Different keys combine with AND.
  function filterGames(games, f) {
    f = f || {};
    function set(a) { if (!a || !a.length) return null; var s = {}; a.forEach(function (x) { s[String(x).toLowerCase()] = 1; }); return s; }
    var L = set(f.leagues), S = set(f.seasons), D = set(f.divisions), M = set(f.maps), T = set(f.teams), LS = set(f.leagueSeasons);
    var out = games.filter(function (g) {
      if (L && !L[String(g.league).toLowerCase()]) return false;
      if (S && !S[String(g.season).toLowerCase()]) return false;
      if (LS && !LS[(g.league + ':' + g.season).toLowerCase()]) return false;
      if (D && !D[String(g.division).toLowerCase()]) return false;
      if (M && !M[String(g.map).toLowerCase()]) return false;
      if (T && !(T[String(g.teams[0]).toLowerCase()] || T[String(g.teams[1]).toLowerCase()])) return false;
      return true;
    });
    return out;
  }

  function selectionInfo(games) {
    var by = {};
    games.forEach(function (g) { by[g.league] = (by[g.league] || 0) + 1; });
    var n = games.length, level = n < 30 ? 'tiny' : n < 150 ? 'small' : 'ok';
    var msg = level === 'tiny' ? n + ' games: almost every number below will be low sample. Treat results as leans at best.'
      : level === 'small' ? n + ' games: per hero and per map numbers will often rest on fewer than 8 games.' : n + ' games in selection.';
    return { n: n, byLeague: by, level: level, message: msg };
  }

  // ---------------------------------------------------------------- tables from games
  function heroTable(games) {
    return memo(games, 'hero', function () {
      var t = new Map();
      function get(h) { var e = t.get(h); if (!e) { e = { hero: h, picks: 0, wins: 0, bans: 0, banWins: 0, orderSum: 0, openers: 0, arch: {} }; t.set(h, e); } return e; }
      games.forEach(function (g) {
        [0, 1].forEach(function (s) {
          g.picks[s].forEach(function (h, i) {
            var e = get(h); e.picks++; e.orderSum += i; if (i === 0) e.openers++;
            var won = g.winner === s ? 1 : 0; e.wins += won;
            var a = g.arch[s]; var c = e.arch[a] || (e.arch[a] = { n: 0, wins: 0 }); c.n++; c.wins += won;
          });
          g.bans[s].forEach(function (h) { if (h) { var b = get(h); b.bans++; if (g.winner === s) b.banWins++; } });
        });
      });
      return t;
    });
  }
  function mapTable(games, map) {
    return memo(games, 'map:' + map, function () {
      var sub = games.filter(function (g) { return g.map === map; });
      return { n: sub.length, table: heroTable(sub) };
    });
  }
  function pairTable(games) {
    return memo(games, 'pairs', function () {
      var opp = new Map(), team = new Map();
      function bump(m, k, won) { var e = m.get(k); if (!e) { e = { n: 0, wins: 0 }; m.set(k, e); } e.n++; e.wins += won; }
      games.forEach(function (g) {
        [0, 1].forEach(function (s) {
          var mine = g.picks[s], theirs = g.picks[1 - s], won = g.winner === s ? 1 : 0;
          mine.forEach(function (a) { theirs.forEach(function (b) { bump(opp, a + '|' + b, won); }); });
          for (var i = 0; i < mine.length; i++) for (var j = i + 1; j < mine.length; j++) {
            var a = mine[i], b = mine[j]; bump(team, a < b ? a + '|' + b : b + '|' + a, won);
          }
        });
      });
      return { opp: opp, team: team };
    });
  }
  function baseShr(tbl, h) { var e = tbl.get(h); return e ? shrink(e.wins, e.picks) : 0.5; }

  function statFromEntry(e, n, extra) {
    var picks = e ? e.picks : 0, wins = e ? e.wins : 0, bans = e ? e.bans : 0;
    var o = rate(wins, picks);
    o.picks = picks; o.bans = bans; o.pickRate = n ? picks / n : 0; o.banRate = n ? bans / n : 0; o.presence = n ? (picks + bans) / n : 0;
    o.avgPickOrder = picks ? e.orderSum / picks + 1 : null; o.openers = e ? e.openers : 0;
    o.banWins = e ? e.banWins : 0; o.banRec = rate(o.banWins, bans);   // the banning side's record in games where it banned this hero
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  // Per hero statistics for a game list. Returns { n, list (sorted by presence), byHero }.
  function heroStats(games) {
    var t = heroTable(games), n = games.length, list = [], by = {};
    t.forEach(function (e, h) { var s = statFromEntry(e, n); s.hero = h; list.push(s); by[h] = s; });
    list.sort(cmp(function (s) { return s.presence * 1e6 + s.picks; }));
    return { n: n, list: list, byHero: by };
  }

  // Per hero statistics for one map, with the shift against the hero's overall (shrunk) rate.
  function mapHeroStats(games, map) {
    var overall = heroTable(games), mt = mapTable(games, map), list = [], by = {};
    mt.table.forEach(function (e, h) {
      var base = baseShr(overall, h);
      var s = statFromEntry(e, mt.n);
      s.hero = h; s.map = map; s.overall = base; s.mapShrunk = shrink(e.wins, e.picks, MAP_PRIOR, base); s.delta = s.mapShrunk - base;
      list.push(s); by[h] = s;
    });
    list.sort(cmp(function (s) { return s.picks * 1e3 + s.presence; }));
    return { map: map, n: mt.n, list: list, byHero: by };
  }

  function heroVsHero(games, a, b) {
    var p = pairTable(games), t = heroTable(games);
    var e = p.opp.get(a + '|' + b) || { n: 0, wins: 0 };
    var exp = log5(baseShr(t, a), baseShr(t, b)), sh = shrink(e.wins, e.n, PRIOR, exp);
    return { a: a, b: b, n: e.n, aWins: e.wins, bWins: e.n - e.wins, winRate: e.n ? e.wins / e.n : null, expected: exp, shrunk: sh, lift: sh - exp, low: e.n < LOW_N };
  }
  function pairSynergy(games, a, b) {
    var p = pairTable(games), t = heroTable(games);
    var e = p.team.get(a < b ? a + '|' + b : b + '|' + a) || { n: 0, wins: 0 };
    var exp = (baseShr(t, a) + baseShr(t, b)) / 2, sh = shrink(e.wins, e.n, PRIOR, exp);
    return { a: a, b: b, n: e.n, wins: e.wins, winRate: e.n ? e.wins / e.n : null, expected: exp, shrunk: sh, lift: sh - exp, low: e.n < LOW_N };
  }
  function heroVsList(games, hero, minN) {
    var p = pairTable(games), out = [];
    p.opp.forEach(function (e, k) { var i = k.indexOf('|'); if (k.slice(0, i) === hero && e.n >= (minN || 1)) out.push(heroVsHero(games, hero, k.slice(i + 1))); });
    return out.sort(cmp(function (x) { return x.lift; }));
  }
  function synergyList(games, hero, minN) {
    var p = pairTable(games), out = [];
    p.team.forEach(function (e, k) {
      var i = k.indexOf('|'), x = k.slice(0, i), y = k.slice(i + 1);
      if ((x === hero || y === hero) && e.n >= (minN || 1)) out.push(pairSynergy(games, hero, x === hero ? y : x));
    });
    return out.sort(cmp(function (s) { return s.lift; }));
  }

  // Everything the Heroes tab needs about one hero in the selection.
  function heroDetail(games, hero) {
    var t = heroTable(games), n = games.length, e = t.get(hero);
    var stat = statFromEntry(e, n); stat.hero = hero;
    var maps = {};
    games.forEach(function (g) { [0, 1].forEach(function (s) { if (g.picks[s].indexOf(hero) >= 0) { var m = maps[g.map] || (maps[g.map] = { map: g.map, n: 0, wins: 0 }); m.n++; if (g.winner === s) m.wins++; } }); });
    var base = stat.shrunk;
    var bestMaps = Object.keys(maps).map(function (k) { var m = maps[k], r = rate(m.wins, m.n, base); r.map = k; r.delta = r.shrunk - base; return r; }).sort(cmp(function (x) { return x.delta; }));
    var arch = Object.keys(e ? e.arch : {}).map(function (a) { var r = rate(e.arch[a].wins, e.arch[a].n); r.arch = a; return r; }).sort(cmp(function (x) { return x.n; }));
    var syn = synergyList(games, hero, 1), vs = heroVsList(games, hero, 1);
    return {
      hero: hero, stat: stat, bestMaps: bestMaps, archetypes: arch,
      partners: syn.slice().sort(cmp(function (s) { return s.n; })).slice(0, 10),
      bestPartners: syn.filter(function (s) { return s.n >= 3; }).slice(0, 5),
      bestAgainst: vs.filter(function (s) { return s.n >= 3; }).slice(0, 5),
      worstAgainst: vs.filter(function (s) { return s.n >= 3; }).slice(-5).reverse()
    };
  }

  // Per hero pick, ban and win trend across league seasons for the games passed in.
  function heroTrend(games, hero) {
    var keys = {}, out = [];
    games.forEach(function (g) {
      var k = keys[g.key] || (keys[g.key] = { key: g.key, n: 0, picks: 0, wins: 0, bans: 0, banWins: 0 });
      k.n++;
      [0, 1].forEach(function (s) {
        if (g.picks[s].indexOf(hero) >= 0) { k.picks++; if (g.winner === s) k.wins++; }
        if (g.bans[s].indexOf(hero) >= 0) { k.bans++; if (g.winner === s) k.banWins++; }
      });
    });
    Object.keys(keys).sort().forEach(function (k) {
      var x = keys[k], r = rate(x.wins, x.picks); r.key = k; r.games = x.n; r.picks = x.picks; r.bans = x.bans; r.banWins = x.banWins;
      r.pickRate = x.n ? x.picks / x.n : 0; r.banRate = x.n ? x.bans / x.n : 0; out.push(r);
    });
    return out;
  }

  // ---------------------------------------------------------------- composition: archetype and needs
  function weightFor(len) { return len <= 1 ? 1 : len === 2 ? 0.75 : 0.6; }

  // Raw archetype scores for a list of hero entries (before the baseline is removed).
  function rawArchetypeScores(hs) {
    var sc = {}, why = {};
    ARCHETYPES.forEach(function (a) { sc[a] = 0; why[a] = []; });
    function add(a, v, text, basis) { if (v) { sc[a] += v; why[a].push({ text: text, value: r3(v), basis: basis }); } }
    function list(pred) { return hs.filter(pred).map(function (h) { return h.name; }); }
    function grp(a, per, pred, text, basis) {
      var l = list(pred);
      if (l.length) add(a, per * l.length, l.join(', ') + ' ' + text, basis);
    }
    ARCHETYPES.forEach(function (a) {
      var voters = hs.filter(function (h) { return (h.comp_fit || []).indexOf(a) >= 0; });
      if (voters.length) add(a, voters.reduce(function (s, h) { return s + weightFor(h.comp_fit.length); }, 0), voters.map(function (h) { return h.name; }).join(', ') + ' list ' + a + ' as a comp fit', 'judgment');
    });
    var melee = function (h) { return h.range_class === 'melee' || h.range_class === 'short'; };
    var longR = function (h) { return h.range_class === 'long'; };
    var medR = function (h) { return h.range_class === 'medium'; };
    var feat = 'judgment';
    grp('dive', 0.5, function (h) { return attr(h, 'engage') >= 4 && melee(h); }, 'have engage 4 or more with short range', 'judgment');
    grp('dive', 0.4, function (h) { return attr(h, 'mobility') >= 4 && h.range_class === 'melee'; }, 'are mobile melee heroes', 'judgment');
    grp('poke', 0.5, longR, 'have long range', feat);
    grp('poke', 0.25, medR, 'have medium range', feat);
    grp('poke', 0.2, function (h) { return attr(h, 'siege') >= 4; }, 'have siege 4 or more', 'judgment');
    grp('pick', 0.5, function (h) { return h.extra && h.extra.ult_type === 'pick'; }, 'have a pick type ultimate', 'judgment');
    grp('pick', 0.3, function (h) { return attr(h, 'cc_amount') >= 3; }, 'have three or more hard CC abilities', 'kit');
    grp('pick', 0.3, function (h) { return h.dmg_profile === 'burst' && h.range_class !== 'melee'; }, 'are ranged burst heroes', 'judgment');
    grp('sustain/attrition', 0.6, function (h) { return h.role === 'Healer'; }, 'are healers', 'kit');
    grp('sustain/attrition', 0.3, function (h) { return attr(h, 'self_sustain') >= 4; }, 'have self sustain 4 or more', 'judgment');
    grp('sustain/attrition', 0.2, function (h) { return h.dmg_profile === 'sustain'; }, 'deal sustained damage', 'judgment');
    grp('4 man push/split', 0.5, function (h) { return attr(h, 'wave_clear') >= 4; }, 'have wave clear 4 or more', 'judgment');
    grp('4 man push/split', 0.3, function (h) { return attr(h, 'solo_lane_viability') >= 4; }, 'can hold a lane alone', 'judgment');
    grp('4 man push/split', 0.2, function (h) { return attr(h, 'global_presence') >= 4; }, 'have global presence 4 or more', 'judgment');
    grp('deathball', 0.4, function (h) { return attr(h, 'teamfight') >= 4 && attr(h, 'mobility') <= 2; }, 'are strong in fights but slow', 'judgment');
    grp('deathball', 0.3, function (h) { return attr(h, 'healer_dependence') >= 4; }, 'need a healer nearby', 'judgment');
    grp('wave clear siege', 0.4, function (h) { return attr(h, 'wave_clear') >= 4; }, 'have wave clear 4 or more', 'judgment');
    grp('wave clear siege', 0.4, function (h) { return attr(h, 'siege') >= 4; }, 'have siege 4 or more', 'judgment');
    grp('wave clear siege', 0.2, function (h) { return attr(h, 'objective_burst') >= 4; }, 'have objective burst 4 or more', 'judgment');
    var meleeCount = list(function (h) { return h.range_class === 'melee'; }).length;
    var longCount = list(longR).length;
    if (longCount >= 3) add('dive', -0.4, longCount + ' long range heroes make a dive harder to close', 'judgment');
    if (meleeCount >= 3) add('poke', -0.4 * (meleeCount - 2), meleeCount + ' melee heroes work against poke', 'judgment');
    return { sc: sc, why: why };
  }
  // Average raw score per hero over the whole roster, so a label means "more of this than a typical comp".
  var baselineCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function archetypeBaseline(data) {
    var c = baselineCache && baselineCache.get(data.heroes);
    if (c) return c;
    var sum = {}, names = Object.keys(data.heroes);
    ARCHETYPES.forEach(function (a) { sum[a] = 0; });
    names.forEach(function (n) { var r = rawArchetypeScores([data.heroes[n]]).sc; ARCHETYPES.forEach(function (a) { sum[a] += r[a]; }); });
    ARCHETYPES.forEach(function (a) { sum[a] = names.length ? sum[a] / names.length : 0; });
    if (baselineCache) baselineCache.set(data.heroes, sum);
    return sum;
  }

  // Documented classifier. Each hero votes for the archetypes in its comp_fit list (1, 0.75 or 0.6 per label),
  // then team level features add or remove small amounts. The average per hero score over the roster is subtracted, so a label means more of that than a typical comp. The highest score is primary; a second archetype
  // is reported when it reaches 75 percent of the primary score.
  function archetypeOf(data, names) {
    var H = data.heroes;
    var hs = (names || []).map(function (n) { return H[n]; }).filter(Boolean);
    var k = hs.length;
    var raw = rawArchetypeScores(hs), sc = {}, why = raw.why, base = archetypeBaseline(data);
    ARCHETYPES.forEach(function (a) { sc[a] = raw.sc[a] - k * base[a]; });
    if (!k) return { primary: null, secondary: null, label: 'none', scores: sc, reasons: [], missing: [], needs: [], count: 0, partial: true };
    var order = ARCHETYPES.slice().sort(function (a, b) { return (sc[b] - sc[a]) || (ARCHETYPES.indexOf(a) - ARCHETYPES.indexOf(b)); });
    var primary = order[0], second = order[1];
    var secondary = sc[second] > 0 && sc[second] >= 0.75 * sc[primary] ? second : null;
    var needs = compNeeds(data, names);
    var out = {
      primary: primary, secondary: secondary, label: secondary ? primary + ' / ' + secondary : primary,
      scores: {}, rawScores: raw.sc, ranked: order.map(function (a) { return { arch: a, score: r3(sc[a]) }; }),
      reasons: why[primary].concat(secondary ? why[secondary] : []),
      needs: needs, missing: needs.filter(function (x) { return x.status !== 'ok'; }), count: k, partial: k < 5
    };
    ARCHETYPES.forEach(function (a) { out.scores[a] = r3(sc[a]); });
    return out;
  }

  // Needs of a composition. status ok, thin or missing; severity grows as slots run out.
  function compNeeds(data, names) {
    var hs = (names || []).map(function (n) { return data.heroes[n]; }).filter(Boolean);
    var k = hs.length, urgency = k ? 0.2 + 0.2 * k : 0, out = [];
    function ratingNeed(key, label, okMax, okTwo, note) {
      var vals = hs.map(function (h) { return attr(h, key); }).sort(function (a, b) { return b - a; });
      var mx = vals.length ? vals[0] : 0, two = vals.filter(function (v) { return v >= 3; }).length >= 2;
      var status = mx >= okMax || (okTwo && two) ? 'ok' : mx >= 3 ? 'thin' : 'missing';
      out.push({ key: key, label: label, status: status, have: mx, target: okMax, note: note + ' Best on the team: ' + (k ? mx : 'none') + ' of 5.', basis: basisOfMany(hs, key), rating: key, kind: 'rating' });
    }
    ratingNeed('wave_clear', 'Wave clear', 4, true, 'Clears minion waves so the team is not forced off objectives.');
    ratingNeed('camp_clear', 'Camp clear', 4, false, 'Clears mercenary camps alone or fast.');
    ratingNeed('engage', 'Engage', 4, true, 'Starts or forces fights.');
    ratingNeed('peel', 'Peel', 4, true, 'Protects teammates from dive.');
    ratingNeed('objective_burst', 'Objective burst', 4, false, 'Burns bosses, shrines and structures quickly.');
    ratingNeed('siege', 'Siege', 4, false, 'Takes structures down safely.');
    var healers = hs.filter(function (h) { return h.role === 'Healer'; }).length;
    out.push({ key: 'healing', label: 'Healing', status: healers ? 'ok' : 'missing', have: healers, target: 1, note: healers + ' healer' + (healers === 1 ? '' : 's') + ' (role from the matrix).', basis: 'kit', kind: 'role' });
    var cc = hs.reduce(function (s, h) { return s + attr(h, 'cc_amount'); }, 0) || 0;
    if (!hs.length) cc = 0;
    out.push({ key: 'cc', label: 'Crowd control', status: cc >= 6 ? 'ok' : cc >= 3 ? 'thin' : 'missing', have: cc, target: 6, note: 'Counts abilities with hard CC found in ability text (' + cc + ' in total).', basis: 'kit', kind: 'cc' });
    var front = hs.filter(function (h) { return h.role === 'Tank' || h.role === 'Bruiser'; }).length;
    out.push({ key: 'frontline', label: 'Frontline', status: front ? 'ok' : 'missing', have: front, target: 1, note: front + ' tank or bruiser role heroes.', basis: 'kit', kind: 'role' });
    var rng = hs.filter(function (h) { return h.range_class === 'medium' || h.range_class === 'long'; }).length;
    out.push({ key: 'range', label: 'Ranged damage', status: rng >= 2 ? 'ok' : rng === 1 ? 'thin' : 'missing', have: rng, target: 2, note: rng + ' heroes with medium or long auto attack range.', basis: 'kit', kind: 'range' });
    var dmg = hs.filter(function (h) { return h.role !== 'Healer' && h.role !== 'Tank'; });
    var burst = dmg.filter(function (h) { return h.dmg_profile === 'burst'; }).length, sus = dmg.filter(function (h) { return h.dmg_profile === 'sustain'; }).length;
    var mixStatus = dmg.length < 2 ? 'ok' : (burst === 0 || sus === 0) && dmg.length >= 3 ? 'thin' : 'ok';
    out.push({ key: 'damage_mix', label: 'Burst and sustain damage mix', status: mixStatus, have: burst + ':' + sus, target: 'both', needType: burst === 0 ? 'burst' : sus === 0 ? 'sustain' : null,
      note: burst + ' burst and ' + sus + ' sustain damage heroes.', basis: 'judgment', kind: 'mix' });
    var weight = { missing: 1, thin: 0.5, ok: 0 };
    out.forEach(function (x) { x.severity = r3(weight[x.status] * urgency * (x.key === 'healing' || x.key === 'frontline' ? 1.2 : 1)); });
    return out.sort(cmp(function (x) { return x.severity; }));
  }

  // How well one hero fills a need, 0 to 1.
  function fillValue(h, need) {
    switch (need.kind) {
      case 'rating': { var v = attr(h, need.rating); return v >= 4 ? 1 : v === 3 ? 0.35 : 0; }
      case 'role': return need.key === 'healing' ? (h.role === 'Healer' ? 1 : 0) : (h.role === 'Tank' ? 1 : h.role === 'Bruiser' ? 0.8 : 0);
      case 'cc': { var c = attr(h, 'cc_amount'); return c >= 3 ? 1 : c === 2 ? 0.6 : c === 1 ? 0.25 : 0; }
      case 'range': return h.range_class === 'long' ? 1 : h.range_class === 'medium' ? 0.9 : h.range_class === 'short' ? 0.3 : 0;
      case 'mix': return need.needType && h.dmg_profile === need.needType ? 1 : 0;
    }
    return 0;
  }

  function archetypeStats(games) {
    return memo(games, 'archStats', function () {
      var t = {}, total = games.length * 2;
      ARCHETYPES.forEach(function (a) { t[a] = { n: 0, wins: 0 }; });
      games.forEach(function (g) { [0, 1].forEach(function (s) { var e = t[g.arch[s]]; if (e) { e.n++; if (g.winner === s) e.wins++; } }); });
      var list = ARCHETYPES.map(function (a) { var r = rate(t[a].wins, t[a].n); r.arch = a; r.share = total ? t[a].n / total : 0; return r; });
      var byArch = {}; list.forEach(function (r) { byArch[r.arch] = r; });
      return { n: games.length, list: list, byArch: byArch };
    });
  }

  // Archetype A versus archetype B, win rate from A's side. Mirrors count 0.5 wins and are flagged.
  function archetypeMatchups(games) {
    return memo(games, 'archMatch', function () {
      var t = {};
      ARCHETYPES.forEach(function (a) { t[a] = {}; ARCHETYPES.forEach(function (b) { t[a][b] = { n: 0, wins: 0 }; }); });
      games.forEach(function (g) {
        var a = g.arch[0], b = g.arch[1];
        if (!t[a] || !t[b]) return;
        if (a === b) { t[a][a].n++; t[a][a].wins += 0.5; return; }
        t[a][b].n++; t[b][a].n++;
        if (g.winner === 0) t[a][b].wins++; else t[b][a].wins++;
      });
      var table = {}, list = [];
      ARCHETYPES.forEach(function (a) {
        table[a] = {};
        ARCHETYPES.forEach(function (b) {
          var e = t[a][b], r = rate(e.wins, e.n); r.a = a; r.b = b; r.mirror = a === b;
          table[a][b] = r; list.push(r);
        });
      });
      return { archetypes: ARCHETYPES.slice(), table: table, list: list, n: games.length };
    });
  }

  function archetypeByMap(games) {
    return memo(games, 'archMap', function () {
      var maps = {};
      games.forEach(function (g) {
        var m = maps[g.map] || (maps[g.map] = { map: g.map, n: 0, t: {} });
        m.n++;
        [0, 1].forEach(function (s) {
          var a = g.arch[s], e = m.t[a] || (m.t[a] = { n: 0, wins: 0 });
          e.n++; if (g.winner === s) e.wins++;
        });
      });
      var out = {};
      Object.keys(maps).sort().forEach(function (k) {
        var m = maps[k], list = Object.keys(m.t).map(function (a) { var r = rate(m.t[a].wins, m.t[a].n); r.arch = a; r.share = m.t[a].n / (m.n * 2); return r; });
        list.sort(cmp(function (x) { return x.shrunk; }));
        out[k] = { map: k, n: m.n, list: list, best: list.filter(function (x) { return x.n >= 1; })[0] || null };
      });
      return out;
    });
  }

  // Map page data: archetypes, top heroes by delta, common winning pairs.
  function mapSummary(games, map) {
    var sub = games.filter(function (g) { return g.map === map; });
    var hs = mapHeroStats(games, map);
    var pairs = new Map();
    sub.forEach(function (g) {
      var w = g.picks[g.winner];
      for (var i = 0; i < w.length; i++) for (var j = i + 1; j < w.length; j++) {
        var a = w[i] < w[j] ? w[i] : w[j], b = w[i] < w[j] ? w[j] : w[i], k = a + '|' + b;
        pairs.set(k, (pairs.get(k) || 0) + 1);
      }
    });
    var winningPairs = []; pairs.forEach(function (c, k) { var p = k.split('|'); winningPairs.push({ a: p[0], b: p[1], wins: c }); });
    winningPairs.sort(cmp(function (x) { return x.wins; }));
    var bans = {}, banW = {}; sub.forEach(function (g) { [0, 1].forEach(function (s) { g.bans[s].forEach(function (h) { if (h) { bans[h] = (bans[h] || 0) + 1; if (g.winner === s) banW[h] = (banW[h] || 0) + 1; } }); }); });
    var topBans = Object.keys(bans).map(function (h) { return { hero: h, bans: bans[h], banRate: sub.length ? bans[h] / sub.length : 0, banWins: banW[h] || 0, banRec: rate(banW[h] || 0, bans[h]) }; }).sort(cmp(function (x) { return x.bans; })).slice(0, 10);
    var am = archetypeByMap(sub)[map] || { n: 0, list: [] };
    var wins = {}; sub.forEach(function (g) { var a = g.arch[g.winner]; wins[a] = (wins[a] || 0) + 1; });
    return {
      map: map, n: sub.length, low: sub.length < LOW_N, archetypes: am.list,
      winnerArchetypes: ARCHETYPES.map(function (a) { return { arch: a, wins: wins[a] || 0 }; }).sort(cmp(function (x) { return x.wins; })),
      topHeroes: hs.list.slice().sort(cmp(function (s) { return s.picks; })).slice(0, 12),
      bestDelta: hs.list.filter(function (s) { return s.picks >= 3; }).sort(cmp(function (s) { return s.delta; })).slice(0, 8),
      winningPairs: winningPairs.slice(0, 8), topBans: topBans, profile: MAP_PROFILES[map] || null,
      buildFor: null
    };
  }

  // Heroes whose matrix attributes best fit a map profile (judgment profile, ratings from the matrix).
  function buildForMapImpl(data, map, limit) {
    var prof = (MAP_PROFILES[map]) || null;
    if (!prof) return { map: map, profile: null, heroes: [] };
    var list = data.heroNames.map(function (n) {
      var h = data.heroes[n], v = 0, parts = [];
      Object.keys(prof).forEach(function (k) { var a = attr(h, k); v += prof[k] * (a - 3); if (a >= 4) parts.push(k + ' ' + a); });
      return { hero: n, role: h.role, fit: r3(v * WEIGHTS.mapKit), why: parts.join(', '), basis: 'judgment' };
    }).sort(cmp(function (x) { return x.fit; }));
    return { map: map, profile: prof, heroes: list.slice(0, limit || 12), basis: 'judgment' };
  }

  // ---------------------------------------------------------------- formats and draft state
  var FORMATS = {
    ngs: {
      id: 'ngs', name: 'NGS draft (3 bans each, snake picks)',
      assumption: 'Order as it appears in NGS match pages: four bans (A, B, A, B), then picks A1, B2, B3, A4, A5, then one ban each (B, then A), then picks B6, B7, A8, A9 and B10. Team A is the side with first pick. Team B gets the last pick. Other leagues may order the bans differently.',
      slots: (function () {
        var s = [];
        [['ban', 'A'], ['ban', 'B'], ['ban', 'A'], ['ban', 'B'],
         ['pick', 'A'], ['pick', 'B'], ['pick', 'B'], ['pick', 'A'], ['pick', 'A'],
         ['ban', 'B'], ['ban', 'A'],
         ['pick', 'B'], ['pick', 'B'], ['pick', 'A'], ['pick', 'A'], ['pick', 'B']].forEach(function (x) { s.push({ type: x[0], side: x[1] }); });
        return s;
      })()
    },
    free: { id: 'free', name: 'Free form', assumption: 'No fixed order. Choose which side acts and whether it is a pick or a ban.', slots: null }
  };
  function draftFormats() { return Object.keys(FORMATS).map(function (k) { return FORMATS[k]; }); }
  function getFormat(f) { return !f ? FORMATS.ngs : typeof f === 'string' ? (FORMATS[f] || FORMATS.ngs) : f; }

  function normalizeState(st) {
    st = st || {};
    return {
      map: st.map || null, myTeam: st.myTeam === 1 ? 1 : 0, firstPick: st.firstPick === 1 ? 1 : 0,
      picks: [(st.picks && st.picks[0] || []).slice(), (st.picks && st.picks[1] || []).slice()],
      bans: [(st.bans && st.bans[0] || []).slice(), (st.bans && st.bans[1] || []).slice()],
      format: st.format || 'ngs', skill: normSkill(st.skill), profile: st.profile || null, opponentTeam: st.opponentTeam || null,
      side: st.side === 0 || st.side === 1 ? st.side : null, mode: st.mode || null
    };
  }

  // Next slot to fill. Sides are team indexes. In free form there is no fixed slot: returns { free: true }.
  function nextSlot(state, format) {
    var st = normalizeState(state), f = getFormat(format || st.format);
    if (!f.slots) return { done: false, free: true, index: null, type: null, side: null, sideLabel: null, label: 'Free form: choose a side and a pick or ban' };
    var used = { ban: [st.bans[0].length, st.bans[1].length], pick: [st.picks[0].length, st.picks[1].length] };
    var left = { ban: used.ban.slice(), pick: used.pick.slice() };
    for (var i = 0; i < f.slots.length; i++) {
      var sl = f.slots[i], side = sl.side === 'A' ? st.firstPick : 1 - st.firstPick;
      if (left[sl.type][side] > 0) { left[sl.type][side]--; continue; }
      var number = used[sl.type][side] + 1;
      return { done: false, free: false, index: i, type: sl.type, side: side, sideLabel: sl.side, number: number, label: 'Team ' + sl.side + ' ' + sl.type + ' ' + number };
    }
    return { done: true, free: false, index: f.slots.length, type: null, side: null, sideLabel: null, label: 'Draft complete' };
  }

  // ---------------------------------------------------------------- team profile
  // Accepts { pool: { Hero: comfort } } or { players: [ { name, role, pool: [ { hero, comfort } | 'Hero' ] } ] }.
  // Comfort: 1 can play it, 2 comfortable, 3 best hero. Returns { pool, players }.
  function normalizeProfile(p) {
    var pool = {}, players = [];
    if (!p) return { pool: pool, players: players, any: false };
    if (p.pool && !Array.isArray(p.pool)) Object.keys(p.pool).forEach(function (h) { pool[h] = Number(p.pool[h]) || 1; });
    (p.players || []).forEach(function (pl) {
      var pp = [];
      (pl.pool || []).forEach(function (e) {
        var h = typeof e === 'string' ? e : e.hero, c = typeof e === 'string' ? 2 : Number(e.comfort) || 2;
        if (!h) return; pp.push({ hero: h, comfort: c });
        pool[h] = Math.max(pool[h] || 0, c);
      });
      players.push({ name: pl.name || '', role: pl.role || '', pool: pp });
    });
    return { pool: pool, players: players, any: Object.keys(pool).length > 0 };
  }
  // Which archetypes and roles the pool can cover.
  function poolCoverage(data, profile) {
    var pr = normalizeProfile(profile), byArch = {}, byRole = {}, missing = [];
    ARCHETYPES.forEach(function (a) { byArch[a] = []; });
    Object.keys(pr.pool).forEach(function (h) {
      var e = data.heroes[h];
      if (!e) { missing.push(h); return; }
      (e.comp_fit || []).forEach(function (a) { if (byArch[a]) byArch[a].push({ hero: h, comfort: pr.pool[h] }); });
      (byRole[e.role] = byRole[e.role] || []).push({ hero: h, comfort: pr.pool[h] });
    });
    return { byArchetype: byArch, byRole: byRole, unknownHeroes: missing, basis: 'judgment' };
  }

  // ---------------------------------------------------------------- recommendations
  var CC_FOR = { stun: 'stun', silence: 'silence', root: 'root', slow: 'slow', blind: 'blind' };
  function exposureCount(cand, enemyHs) {
    var vuln = (cand.extra && cand.extra.vulnerable_to) || [], hits = [], total = 0;
    vuln.forEach(function (t) {
      var c = 0;
      enemyHs.forEach(function (e) {
        var ex = e.extra || {}, hit = false;
        if (CC_FOR[t]) hit = (ex.cc_types_base_kit || []).indexOf(t) >= 0;
        else if (t === 'dive') hit = (e.comp_fit || []).indexOf('dive') >= 0 || ex.ult_type === 'duel or dive';
        else if (t === 'burst') hit = e.dmg_profile === 'burst';
        else if (t === 'poke') hit = e.range_class === 'long';
        else if (t === 'kiting') hit = e.range_class === 'long' || e.range_class === 'medium';
        else if (t === 'percent damage') hit = !!e.pct_damage;
        if (hit) c++;
      });
      if (c) { hits.push(t + ' x' + c); total += c; }
    });
    return { total: total, hits: hits };
  }
  function ivSign(cand, other) { // +1 if Icy Veins lists favour cand over other, -1 if the reverse, 0 if silent
    var ce = cand.extra || {}, oe = other.extra || {};
    var up = (ce.counters_per_icy_veins || []).indexOf(other.name) >= 0 || (oe.countered_by_per_icy_veins || []).indexOf(cand.name) >= 0;
    var down = (ce.countered_by_per_icy_veins || []).indexOf(other.name) >= 0 || (oe.counters_per_icy_veins || []).indexOf(cand.name) >= 0;
    return up && !down ? 1 : down && !up ? -1 : 0;
  }
  function ivSyn(cand, other) {
    return ((cand.extra && cand.extra.synergies_per_icy_veins) || []).indexOf(other.name) >= 0 || ((other.extra && other.extra.synergies_per_icy_veins) || []).indexOf(cand.name) >= 0;
  }
  function mapKitValue(h, map) {
    var prof = MAP_PROFILES[map];
    if (!prof) return null;
    var v = 0, tops = [];
    Object.keys(prof).forEach(function (k) { var a = attr(h, k); v += prof[k] * (a - 3); if (a >= 4) tops.push(k + ' ' + a); else if (a <= 2) tops.push(k + ' ' + a + ' (weak)'); });
    return { value: v * WEIGHTS.mapKit, tops: tops };
  }
  function unavailable(st) {
    var s = {};
    [0, 1].forEach(function (i) { st.picks[i].concat(st.bans[i]).forEach(function (h) { if (h) s[h] = 1; }); });
    return s;
  }
  function context(data, games, st, opts) {
    var W = Object.assign({}, WEIGHTS, (opts && opts.weights) || {});
    return {
      W: W, tbl: heroTable(games), n: games.length, pairs: pairTable(games), am: archetypeMatchups(games),
      mt: st.map ? mapTable(games, st.map) : null, profile: normalizeProfile(st.profile)
    };
  }
  function vsComp(ctx, games, cand, e) { // lift of cand against enemy e, from games
    return heroVsHero(games, cand, e);
  }

  // Ranked pick suggestions for the acting side. See API.md for the state fields.
  function recommendPicks(data, games, state, opts) {
    opts = opts || {};
    var st = normalizeState(state), slot = nextSlot(st, st.format);
    var side = st.side != null ? st.side : slot.side != null ? slot.side : st.myTeam;
    var ctx = context(data, games, st, opts), W = ctx.W, taken = unavailable(st);
    var allyNames = st.picks[side].filter(Boolean), enemyNames = st.picks[1 - side].filter(Boolean);
    var allies = allyNames.map(function (n) { return data.heroes[n]; }).filter(Boolean);
    var enemies = enemyNames.map(function (n) { return data.heroes[n]; }).filter(Boolean);
    var needs = compNeeds(data, allyNames).filter(function (x) { return x.status !== 'ok'; });
    var skill = SKILL_TABLE[st.skill];
    var applyPool = ctx.profile.any && side === st.myTeam;
    var enemyLeft = Math.max(0, 5 - enemyNames.length);
    var archNow = allyNames.length >= 1 ? archetypeOf(data, allyNames).primary : null;
    var archEnemy = enemyNames.length >= 3 ? archetypeOf(data, enemyNames).primary : null;
    var items = [];
    data.heroNames.forEach(function (name) {
      if (taken[name]) return;
      var h = data.heroes[name], comps = [];
      var e = ctx.tbl.get(name), picks = e ? e.picks : 0, shr = e ? shrink(e.wins, e.picks) : 0.5;
      comps.push(C('Win rate (shrunk)', (shr - 0.5) * 100 * W.winRate, (e ? Math.round(shr * 1000) / 10 : 50) + '% shrunk toward 50% from ' + picks + ' games' + (picks < LOW_N ? ' (low sample)' : ''), 'data', { n: picks, low: picks < LOW_N }));
      // map fit from games
      if (ctx.mt) {
        var me = ctx.mt.table.get(name), mn = me ? me.picks : 0, ms = me ? shrink(me.wins, me.picks, MAP_PRIOR, shr) : shr;
        comps.push(C('Map fit (games)', clamp((ms - shr) * 100 * W.mapData, -4, 4), 'On ' + st.map + ': ' + (me ? me.wins + ' wins in ' + mn : 'no') + ' games' + (mn < LOW_N ? ' (low sample)' : ''), 'data', { n: mn, low: mn < LOW_N }));
        var mk = mapKitValue(h, st.map);
        comps.push(C('Map fit (attributes)', mk ? mk.value : 0, mk ? 'Map profile is a judgment: ' + (mk.tops.join(', ') || 'average on the rated attributes') : 'No map profile for ' + st.map, 'judgment'));
      } else {
        comps.push(C('Map fit (games)', 0, 'No map selected', 'data', { n: 0, low: true }));
        comps.push(C('Map fit (attributes)', 0, 'No map selected', 'judgment'));
      }
      // composition need
      var nv = 0, fills = [], usedKeys = [];
      needs.forEach(function (nd) { var f = fillValue(h, nd); if (f > 0) { nv += nd.severity * f * W.compNeed; fills.push(nd.label); if (nd.rating) usedKeys.push(nd.rating); } });
      nv = Math.min(5, nv);
      comps.push(C('Comp need', nv, fills.length ? 'Fills open needs: ' + fills.join(', ') : 'Fills no open need', usedKeys.length && usedKeys.every(function (k) { return basisOf(h, k) === 'kit'; }) ? 'kit' : 'judgment'));
      // counters from games and lists
      var cg = 0, cgN = 0, cgNotes = [], cl = 0, clNotes = [];
      enemies.forEach(function (en) {
        var v = vsComp(ctx, games, name, en.name);
        var pts = clamp(v.lift * 100 * W.counterGames, -3, 3);
        cg += pts; cgN += v.n; if (v.n) cgNotes.push('vs ' + en.name + ' ' + v.n + ' games');
        var s = ivSign(h, en); if (s) { cl += s * W.counterLists; clNotes.push((s > 0 ? 'beats ' : 'loses to ') + en.name); }
      });
      comps.push(C('Counter value (games)', cg, enemies.length ? (cgNotes.join('; ') || 'no head to head games') : 'No enemy picks yet', 'data', { n: cgN, low: cgN < LOW_N }));
      comps.push(C('Counter value (matchup lists)', cl, clNotes.length ? 'Icy Veins lists: ' + clNotes.join(', ') : 'Lists are silent', basisOf(h, 'counters_per_icy_veins')));
      // synergy
      var sg = 0, sgN = 0, sgNotes = [], sl = 0, slNotes = [];
      allies.forEach(function (al) {
        var v = pairSynergy(games, name, al.name);
        sg += clamp(v.lift * 100 * W.synergyGames, -3, 3); sgN += v.n; if (v.n) sgNotes.push('with ' + al.name + ' ' + v.n + ' games');
        if (ivSyn(h, al)) { sl += W.synergyLists; slNotes.push(al.name); }
      });
      comps.push(C('Synergy (games)', sg, allies.length ? (sgNotes.join('; ') || 'no games together') : 'No allied picks yet', 'data', { n: sgN, low: sgN < LOW_N }));
      comps.push(C('Synergy (lists)', sl, slNotes.length ? 'Icy Veins synergy lists: ' + slNotes.join(', ') : 'Lists are silent', basisOf(h, 'synergies_per_icy_veins')));
      // exposure to enemy CC and tools
      var ex = exposureCount(h, enemies);
      comps.push(C('Exposure to enemy tools', -Math.min(2.4, ex.total * W.exposure), ex.total ? 'Hero is vulnerable to: ' + ex.hits.join(', ') + ' (judgment on vulnerability, kit on enemy CC)' : 'No overlap with enemy tools found', 'judgment'));
      // pick risk and skill
      var riskBase = h.extra && h.extra.pick_risk === 'high risk' ? 1.5 : h.extra && h.extra.pick_risk === 'medium' ? 0.5 : 0;
      comps.push(C('Pick risk', -riskBase * skill.risk * (1 + 0.1 * enemyLeft) * W.risk, (h.extra && h.extra.pick_risk || 'unrated') + ' at skill ' + st.skill + ', ' + enemyLeft + ' enemy picks still to come', basisOf(h, 'pick_risk')));
      var ease = attr(h, 'ease_of_execution'), ceil = attr(h, 'skill_ceiling');
      comps.push(C('Skill level fit', ((ease - 3) * skill.ease + (ceil - 3) * skill.ceiling) * W.skill, 'Ease ' + ease + ', ceiling ' + ceil + ' at skill ' + st.skill, 'judgment'));
      // team pool
      if (ctx.profile.any) {
        var cf = ctx.profile.pool[name] || 0;
        var pv = applyPool ? (cf >= 3 ? 4 : cf === 2 ? 2.5 : cf === 1 ? 1 : -1.5) * W.pool : 0;
        comps.push(C('Team pool', pv, applyPool ? (cf ? 'Pool comfort ' + cf + ' of 3' : 'Not in the loaded pool') : 'Pool applies only to the team marked as mine', 'judgment'));
      } else comps.push(C('Team pool', 0, 'No team profile loaded', 'judgment'));
      // archetype matchup
      var after = allyNames.length >= 2 ? archetypeOf(data, allyNames.concat([name])).primary : null;
      var amv = 0, amNote = 'Needs at least 2 allied and 3 enemy picks', amN = 0;
      if (after && archEnemy) {
        var cell = ctx.am.table[after][archEnemy], prev = archNow ? ctx.am.table[archNow][archEnemy] : null;
        amv = clamp(((cell.shrunk - (prev ? prev.shrunk : 0.5)) * 100) * W.archMatchup, -2, 2);
        amN = cell.n; amNote = 'Comp would read ' + after + ' against ' + archEnemy + ': ' + cell.wins + ' wins in ' + cell.n + ' games' + (cell.low ? ' (low sample)' : '');
      }
      comps.push(C('Archetype matchup (games)', amv, amNote, 'data', { n: amN, low: amN < LOW_N }));
      var score = r3(comps.reduce(function (s, c) { return s + c.value; }, 0));
      items.push({ hero: name, role: h.role, score: score, components: comps, n: picks, low: picks < LOW_N, winRate: shr, archetypeAfter: allyNames.length ? archetypeOf(data, allyNames.concat([name])).primary : null });
    });
    items.sort(cmp(function (x) { return x.score; }));
    return { kind: 'pick', side: side, slot: slot, sampleN: games.length, items: opts.limit ? items.slice(0, opts.limit) : items };
  }

  // Ranked ban suggestions for the acting side (heroes the other side would gain from).
  function recommendBans(data, games, state, opts) {
    opts = opts || {};
    var st = normalizeState(state), slot = nextSlot(st, st.format);
    var side = st.side != null ? st.side : slot.side != null ? slot.side : st.myTeam;
    var ctx = context(data, games, st, opts), W = ctx.W, taken = unavailable(st);
    var mine = st.picks[side].map(function (n) { return data.heroes[n]; }).filter(Boolean);
    var theirNames = st.picks[1 - side].filter(Boolean);
    var needs = compNeeds(data, theirNames).filter(function (x) { return x.status !== 'ok'; });
    var applyPool = ctx.profile.any && side === st.myTeam;
    var scout = null;
    if (st.opponentTeam && side === st.myTeam) scout = scoutTeam(games, st.opponentTeam);
    var items = [];
    data.heroNames.forEach(function (name) {
      if (taken[name]) return;
      var h = data.heroes[name], comps = [];
      var e = ctx.tbl.get(name), picks = e ? e.picks : 0, shr = e ? shrink(e.wins, e.picks) : 0.5, pr = ctx.n ? picks / ctx.n : 0;
      comps.push(C('Strength (win rate shrunk)', (shr - 0.5) * 100 * W.banStrength, Math.round(shr * 1000) / 10 + '% shrunk from ' + picks + ' games' + (picks < LOW_N ? ' (low sample)' : ''), 'data', { n: picks, low: picks < LOW_N }));
      comps.push(C('Contest rate', pr * 100 * W.banContest, 'Picked in ' + Math.round(pr * 1000) / 10 + '% of games in the selection', 'data', { n: picks, low: picks < LOW_N }));
      if (ctx.mt) {
        var me = ctx.mt.table.get(name), mn = me ? me.picks : 0, ms = me ? shrink(me.wins, me.picks, MAP_PRIOR, shr) : shr;
        comps.push(C('Map fit (games)', clamp((ms - shr) * 100 * W.mapData, -4, 4), 'On ' + st.map + ': ' + mn + ' games' + (mn < LOW_N ? ' (low sample)' : ''), 'data', { n: mn, low: mn < LOW_N }));
      } else comps.push(C('Map fit (games)', 0, 'No map selected', 'data', { n: 0, low: true }));
      var tg = 0, tgN = 0, tl = 0, tNotes = [];
      mine.forEach(function (m) {
        var v = heroVsHero(games, name, m.name);
        tg += clamp(v.lift * 100 * W.banThreatGames, -3, 3); tgN += v.n;
        var s = ivSign(h, m); if (s) { tl += s * W.banThreatLists; tNotes.push((s > 0 ? 'beats ' : 'loses to ') + m.name); }
      });
      comps.push(C('Threat to my picks (games)', tg, mine.length ? tgN + ' head to head games against my picks' : 'No picks of mine yet', 'data', { n: tgN, low: tgN < LOW_N }));
      comps.push(C('Threat to my picks (lists)', tl, tNotes.length ? 'Icy Veins lists: ' + tNotes.join(', ') : 'Lists are silent', basisOf(h, 'counters_per_icy_veins')));
      var nv = 0, fills = [];
      needs.forEach(function (nd) { var f = fillValue(h, nd); if (f > 0) { nv += nd.severity * f * W.banNeed; fills.push(nd.label); } });
      nv = Math.min(4, nv);
      comps.push(C('Fills their open needs', nv, fills.length ? 'Would fill: ' + fills.join(', ') : 'No open enemy need filled or no enemy picks yet', 'judgment'));
      if (scout) {
        var sh = scout.heroes.filter(function (x) { return x.hero === name; })[0];
        var hv = sh ? (4 * sh.share + (sh.shrunk - 0.5) * 100 * 0.3) * W.banHabit : 0;
        comps.push(C('Opponent habit', hv, sh ? st.opponentTeam + ' played it in ' + sh.n + ' of ' + scout.record.n + ' games' + (sh.low ? ' (low sample)' : '') : 'Not in their games', 'data', { n: sh ? sh.n : 0, low: sh ? sh.low : true }));
      } else comps.push(C('Opponent habit', 0, 'No opponent team chosen', 'data', { n: 0, low: true }));
      var cf = applyPool ? (ctx.profile.pool[name] || 0) : 0;
      comps.push(C('My pool protection', -(cf >= 2 ? cf : 0) * W.banPool, cf >= 2 ? 'In my pool at comfort ' + cf + ', so banning it costs me' : 'Not a protected pool hero', 'judgment'));
      var bw = e ? e.banWins : 0, bn = e ? e.bans : 0;
      comps.push(C('Banning side result', 0, bn ? 'The side that banned it won ' + bw + '-' + (bn - bw) + ' (' + bn + ' bans). This is what happened around the ban, not what the ban caused.' : 'Never banned in the selection', 'data', { n: bn, low: bn < LOW_N }));
      var score = r3(comps.reduce(function (s, c) { return s + c.value; }, 0));
      items.push({ hero: name, role: h.role, score: score, components: comps, n: picks, low: picks < LOW_N, winRate: shr, bans: bn, banWins: bw });
    });
    items.sort(cmp(function (x) { return x.score; }));
    return { kind: 'ban', side: side, slot: slot, sampleN: games.length, items: opts.limit ? items.slice(0, opts.limit) : items };
  }

  // Convenience: recommend whatever the next slot is (free form needs state.mode 'pick' or 'ban').
  function recommend(data, games, state, opts) {
    var st = normalizeState(state), slot = nextSlot(st, st.format);
    var type = slot.type || st.mode || 'pick';
    if (slot.done) return { kind: null, side: null, slot: slot, sampleN: games.length, items: [] };
    return type === 'ban' ? recommendBans(data, games, state, opts) : recommendPicks(data, games, state, opts);
  }

  // ---------------------------------------------------------------- comp read and what beats a comp
  // Read of one side: archetype, needs, shared weaknesses, and how the archetype fares against the other side.
  function compRead(data, games, names, enemyNames) {
    var a = archetypeOf(data, names), am = archetypeMatchups(games);
    var hs = (names || []).map(function (n) { return data.heroes[n]; }).filter(Boolean);
    var vul = {};
    hs.forEach(function (h) { ((h.extra && h.extra.vulnerable_to) || []).forEach(function (t) { vul[t] = (vul[t] || 0) + 1; }); });
    var vulnerable = Object.keys(vul).filter(function (t) { return vul[t] >= 2; }).map(function (t) { return { type: t, heroes: vul[t], basis: 'judgment' }; }).sort(cmp(function (x) { return x.heroes; }));
    var strong = [], weak = [];
    if (a.primary) {
      ARCHETYPES.forEach(function (b) {
        var c = am.table[a.primary][b];
        if (b === a.primary || c.n < 1) return;
        if (c.shrunk >= 0.52) strong.push({ arch: b, n: c.n, wins: c.wins, shrunk: c.shrunk, low: c.low });
        else if (c.shrunk <= 0.48) weak.push({ arch: b, n: c.n, wins: c.wins, shrunk: c.shrunk, low: c.low });
      });
    }
    strong.sort(cmp(function (x) { return x.shrunk; })); weak.sort(cmp(function (x) { return -x.shrunk; }));
    var vs = null;
    if (enemyNames && enemyNames.length && a.primary) {
      var ea = archetypeOf(data, enemyNames);
      if (ea.primary) { var c = am.table[a.primary][ea.primary]; vs = { enemyArchetype: ea.primary, n: c.n, wins: c.wins, shrunk: c.shrunk, low: c.low, mirror: c.mirror }; }
    }
    return { archetype: a, vulnerabilities: vulnerable, strongAgainst: strong, weakAgainst: weak, versusEnemy: vs, note: 'Strong and weak lists are archetype results from the selected games, not statements about cause.' };
  }

  // What the other side's picks suggest: archetype, open needs, and the picks the engine would expect them to want.
  function readEnemy(data, games, state, side) {
    var st = normalizeState(state);
    var names = st.picks[side].filter(Boolean), a = archetypeOf(data, names);
    var clues = [];
    a.reasons.slice(0, 4).forEach(function (r) { clues.push({ text: r.text, basis: r.basis }); });
    var open = a.missing.map(function (x) { return { label: x.label, status: x.status, note: x.note, basis: x.basis }; });
    var rec = recommendPicks(data, games, Object.assign({}, state, { side: side, myTeam: side }), { limit: 5 });
    return {
      side: side, picks: names, archetype: a.label, count: names.length, clues: clues, openNeeds: open,
      likelyNext: rec.items.map(function (x) { return { hero: x.hero, score: x.score, n: x.n, low: x.low }; }),
      note: 'Likely next picks use the same scoring as suggestions for that side, so they describe fit, not a prediction of behaviour.'
    };
  }

  // Counters tab: what beats this comp. Uses archetype results and head to head scoring against the comp.
  function whatBeats(data, games, names, opts) {
    var read = compRead(data, games, names, null), am = archetypeMatchups(games), p = read.archetype.primary, answers = [];
    if (p) ARCHETYPES.forEach(function (b) { var c = am.table[b][p]; if (b !== p && c.n) answers.push({ arch: b, n: c.n, wins: c.wins, shrunk: c.shrunk, low: c.low }); });
    answers.sort(cmp(function (x) { return x.shrunk; }));
    var rec = recommendPicks(data, games, { picks: [[], names.slice()], bans: [[], []], side: 0, myTeam: 0, format: 'free' }, { limit: (opts && opts.limit) || 10 });
    return { archetype: read.archetype, archetypeAnswers: answers, heroes: rec.items.map(function (x) {
      return { hero: x.hero, score: x.score, n: x.n, low: x.low, components: x.components.filter(function (c) { return /Counter|Win rate|Exposure/.test(c.name); }) };
    }), note: 'Hero ranking uses win rate, head to head games and matchup lists only. Treat archetype rows as results, and kit notes as ideas.' };
  }

  // ---------------------------------------------------------------- scouting
  function listTeams(games) {
    var t = {};
    games.forEach(function (g) { g.teams.forEach(function (x) { if (x) t[x] = (t[x] || 0) + 1; }); });
    return Object.keys(t).map(function (k) { return { team: k, n: t[k] }; }).sort(cmp(function (x) { return x.n; }));
  }

  function scoutTeam(games, teamName, ctxGames) {
    var base = ctxGames || games;
    var tn = String(teamName || '').toLowerCase();
    var rows = [];
    games.forEach(function (g) {
      [0, 1].forEach(function (s) { if (String(g.teams[s]).toLowerCase() === tn) rows.push({ g: g, s: s }); });
    });
    var wins = rows.filter(function (r) { return r.g.winner === r.s; }).length;
    var rec = rate(wins, rows.length); rec.losses = rows.length - wins; rec.team = teamName;
    function bucket(keyFn, filterFn) {
      var m = {};
      rows.forEach(function (r) { if (filterFn && !filterFn(r)) return; var k = keyFn(r); if (k == null) return; var e = m[k] || (m[k] = { n: 0, wins: 0 }); e.n++; if (r.g.winner === r.s) e.wins++; });
      return Object.keys(m).map(function (k) { var x = rate(m[k].wins, m[k].n); x.key = k; return x; });
    }
    var byMap = bucket(function (r) { return r.g.map; }).map(function (x) { x.map = x.key; return x; }).sort(cmp(function (x) { return x.n; }));
    var archs = bucket(function (r) { return r.g.arch[r.s]; }).map(function (x) { x.arch = x.key; return x; }).sort(cmp(function (x) { return x.n; }));
    var heroMap = {};
    var banMap = {}, banAgainst = {}, banMapW = {}, banAgainstW = {};
    rows.forEach(function (r) {
      r.g.picks[r.s].forEach(function (h, i) { var e = heroMap[h] || (heroMap[h] = { n: 0, wins: 0 }); e.n++; if (r.g.winner === r.s) e.wins++; });
      var tw = r.g.winner === r.s ? 1 : 0;
      r.g.bans[r.s].forEach(function (h) { if (h) { banMap[h] = (banMap[h] || 0) + 1; banMapW[h] = (banMapW[h] || 0) + tw; } });
      r.g.bans[1 - r.s].forEach(function (h) { if (h) { banAgainst[h] = (banAgainst[h] || 0) + 1; banAgainstW[h] = (banAgainstW[h] || 0) + tw; } });
    });
    var heroes = Object.keys(heroMap).map(function (h) { var x = rate(heroMap[h].wins, heroMap[h].n); x.hero = h; x.share = rows.length ? heroMap[h].n / rows.length : 0; return x; }).sort(cmp(function (x) { return x.n * 1000 + x.wins; }));
    function counts(m, tot, w) { return Object.keys(m).map(function (h) { var o = { hero: h, n: m[h], share: tot ? m[h] / tot : 0, low: m[h] < LOW_N }; if (w) { o.teamWins = w[h] || 0; o.teamRec = rate(w[h] || 0, m[h]); } return o; }).sort(cmp(function (x) { return x.n; })); }
    var fpKnown = rows.filter(function (r) { return r.g.firstPick != null; });
    var fpHad = fpKnown.filter(function (r) { return r.g.firstPick === r.s; }), fpNot = fpKnown.filter(function (r) { return r.g.firstPick !== r.s; });
    var fpW = fpHad.filter(function (r) { return r.g.winner === r.s; }).length, nfW = fpNot.filter(function (r) { return r.g.winner === r.s; }).length;
    var openers = {};
    fpHad.forEach(function (r) { var h = r.g.picks[r.s][0]; if (h) openers[h] = (openers[h] || 0) + 1; });
    var lossRows = rows.filter(function (r) { return r.g.winner !== r.s; });
    var lossMaps = {}, lossHeroes = {};
    lossRows.forEach(function (r) { lossMaps[r.g.map] = (lossMaps[r.g.map] || 0) + 1; r.g.picks[r.s].forEach(function (h) { lossHeroes[h] = (lossHeroes[h] || 0) + 1; }); });
    // suggestions
    var banSug = heroes.filter(function (x) { return x.n >= 2; }).map(function (x) {
      return { hero: x.hero, score: r3(x.share * 100 * 0.4 + (x.shrunk - 0.5) * 100 * 0.6), n: x.n, wins: x.wins, share: x.share, low: x.low, why: 'Picked in ' + x.n + ' of ' + rows.length + ' games, ' + x.wins + ' wins' };
    }).sort(cmp(function (x) { return x.score; })).slice(0, 8);
    var am = archetypeMatchups(base), main = archs.length ? archs[0].arch : null, answers = [];
    if (main) ARCHETYPES.forEach(function (b) { var c = am.table[b][main]; if (b !== main && c.n) answers.push({ arch: b, n: c.n, wins: c.wins, shrunk: c.shrunk, low: c.low }); });
    answers.sort(cmp(function (x) { return x.shrunk; }));
    var heroAnswers = [];
    var top = heroes.slice(0, 5).map(function (x) { return x.hero; });
    if (top.length) {
      var all = {};
      top.forEach(function (th) {
        var p = pairTable(base);
        p.opp.forEach(function (e, k) {
          var i = k.indexOf('|'), a = k.slice(0, i), b = k.slice(i + 1);
          if (b !== th) return;
          var x = all[a] || (all[a] = { hero: a, n: 0, wins: 0, vs: [] }); x.n += e.n; x.wins += e.wins; x.vs.push(th);
        });
      });
      heroAnswers = Object.keys(all).map(function (a) { var x = all[a], r = rate(x.wins, x.n); r.hero = a; r.vs = x.vs; return r; }).filter(function (x) { return x.n >= 3; }).sort(cmp(function (x) { return x.shrunk; })).slice(0, 8);
    }
    return {
      team: teamName, record: rec, found: rows.length > 0, byMap: byMap, archetypes: archs, heroes: heroes,
      bans: counts(banMap, rows.length, banMapW), bansAgainst: counts(banAgainst, rows.length, banAgainstW),
      firstPick: { known: fpKnown.length, hadFirstPick: fpHad.length, winsWithFirstPick: fpW, hadSecond: fpNot.length, winsWithSecond: nfW,
        withFirst: rate(fpW, fpHad.length), withSecond: rate(nfW, fpNot.length) },
      openers: counts(openers, fpHad.length),
      losses: { n: lossRows.length, byMap: Object.keys(lossMaps).map(function (m) { return { map: m, losses: lossMaps[m] }; }).sort(cmp(function (x) { return x.losses; })),
        heroes: Object.keys(lossHeroes).map(function (h) { return { hero: h, losses: lossHeroes[h] }; }).sort(cmp(function (x) { return x.losses; })).slice(0, 10) },
      suggestedBans: banSug, suggestedAnswers: { archetypes: answers, heroes: heroAnswers, mainArchetype: main },
      note: 'Numbers are for the games in the current selection only. Small samples are flagged with low:true.'
    };
  }

  // ---------------------------------------------------------------- meta
  // Early and tempo signals from replay timelines (NGS rows that carry them): who was ahead, and who won.
  // Each entry says how often the side that was ahead on that signal won, so it is an association, not a cause.
  function earlySummary(games) {
    var rows = games.filter(function (g) { return g.early; });
    function side(v) { return v == null || v === 0 ? null : (v > 0 ? 0 : 1); }
    var defs = [
      ['firstTd', 'Took the first kill', function (e) { return e.firstTd == null ? null : e.firstTd; }],
      ['xp5', 'Ahead on experience at 5 minutes', function (e) { return side(e.xp5); }],
      ['xp10', 'Ahead on experience at 10 minutes', function (e) { return side(e.xp10); }],
      ['xp15', 'Ahead on experience at 15 minutes', function (e) { return side(e.xp15); }],
      ['firstCamp', 'Took the first mercenary camp', function (e) { return e.firstCamp == null ? null : e.firstCamp; }],
      ['firstStruct', 'Destroyed the first structure', function (e) { return e.firstStruct == null ? null : e.firstStruct; }],
      ['firstObj', 'Won the first objective', function (e) { return e.firstObj == null ? null : e.firstObj; }],
      ['firstFort', 'Destroyed the first fort', function (e) { return e.firstFort == null ? null : e.firstFort; }],
      ['firstKeep', 'Destroyed the first keep', function (e) { return e.firstKeep == null ? null : e.firstKeep; }],
      ['lvlAdv', 'Spent more of the game ahead in level', function (e) { return side(e.lvlAdv); }],
      ['mercDiff', 'More mercenary camp uptime', function (e) { return side(e.mercDiff); }],
      ['aliveDiff', 'More heroes alive on average (fewer deaths)', function (e) { return side(e.aliveDiff); }]
    ];
    var list = defs.map(function (d) {
      var n = 0, w = 0;
      rows.forEach(function (g) { var s = d[2](g.early); if (s == null) return; n++; if (s === g.winner) w++; });
      var r = rate(w, n); r.key = d[0]; r.label = d[1];
      return r;
    });
    // size of the 10 minute experience lead
    var buckets = [[0, 1500, 'under 1,500'], [1500, 3000, '1,500 to 3,000'], [3000, 1e9, '3,000 or more']].map(function (b) {
      var sub = rows.filter(function (g) { var a = Math.abs(g.early.xp10 || 0); return g.early.xp10 && a >= b[0] && a < b[1]; });
      var w = sub.filter(function (g) { return side(g.early.xp10) === g.winner; }).length, r = rate(w, sub.length); r.label = b[2]; return r;
    });
    return { n: rows.length, list: list, xp10Buckets: buckets,
      note: 'Associations in games that carry replay timelines. A team that is ahead late is usually ahead because it was winning, so later signals (forts, keeps, level time) say little about what to do early. The early signals (first kill, experience at 5 and 10 minutes) are the more useful ones.' };
  }

  function metaSummary(games) {
    var hs = heroStats(games), n = games.length;
    var picked = hs.list.slice().sort(cmp(function (s) { return s.picks; })).slice(0, 15);
    var banned = hs.list.filter(function (s) { return s.bans > 0; }).sort(cmp(function (s) { return s.bans; })).slice(0, 15);
    var best = hs.list.filter(function (s) { return s.picks >= 10; }).sort(cmp(function (s) { return s.shrunk; })).slice(0, 10);
    var worst = hs.list.filter(function (s) { return s.picks >= 10; }).sort(cmp(function (s) { return -s.shrunk; })).slice(0, 10);
    var t = heroTable(games), flex = [];
    t.forEach(function (e, h) {
      if (e.picks < 10) return;
      var arches = Object.keys(e.arch).filter(function (a) { return e.arch[a].n / e.picks >= 0.2; });
      if (arches.length >= 3) flex.push({ hero: h, picks: e.picks, archetypes: arches, spread: arches.length, low: false });
    });
    flex.sort(cmp(function (x) { return x.spread * 1000 + x.picks; }));
    var fpRows = games.filter(function (g) { return g.firstPick != null; }), fpWins = fpRows.filter(function (g) { return g.winner === g.firstPick; }).length;
    var firstPick = rate(fpWins, fpRows.length); firstPick.note = 'NGS rows only; Heroes Lounge rows have no first pick information.';
    var lead = games.filter(function (g) { return g.lvl10Lead != null && g.lvl10Lead !== 0; });
    var leadWins = lead.filter(function (g) { return (g.lvl10Lead > 0 ? 0 : 1) === g.winner; }).length;
    var lvl10 = rate(leadWins, lead.length); lvl10.ties = games.filter(function (g) { return g.lvl10Lead === 0; }).length;
    lvl10.buckets = [[1, 30, 'under 30s'], [30, 60, '30 to 60s'], [60, 9999, '60s or more']].map(function (b) {
      var sub = lead.filter(function (g) { var a = Math.abs(g.lvl10Lead); return a >= b[0] && a < b[1]; });
      var w = sub.filter(function (g) { return (g.lvl10Lead > 0 ? 0 : 1) === g.winner; }).length;
      var r = rate(w, sub.length); r.label = b[2]; return r;
    });
    lvl10.note = 'Shows association between reaching level 10 first and winning. It does not show the leader caused the win.';
    var early = earlySummary(games);
    var tr = {};
    games.forEach(function (g) { (tr[g.key] = tr[g.key] || []).push(g); });
    var trends = Object.keys(tr).sort().map(function (k) {
      var h2 = heroStats(tr[k]);
      return { key: k, n: tr[k].length, topPicks: h2.list.slice().sort(cmp(function (s) { return s.picks; })).slice(0, 8).map(function (s) { return { hero: s.hero, picks: s.picks, pickRate: s.pickRate, shrunk: s.shrunk, low: s.low }; }),
        topBans: h2.list.filter(function (s) { return s.bans > 0; }).sort(cmp(function (s) { return s.bans; })).slice(0, 8).map(function (s) { return { hero: s.hero, bans: s.bans, banRate: s.banRate, banWins: s.banWins, banRec: s.banRec }; }) };
    });
    var lens = games.map(function (g) { return g.length; }).filter(function (x) { return typeof x === 'number'; });
    var maps = {}; games.forEach(function (g) { maps[g.map] = (maps[g.map] || 0) + 1; });
    return {
      n: n, selection: selectionInfo(games), topPicked: picked, topBanned: banned, bestWinRate: best, worstWinRate: worst, flexPicks: flex.slice(0, 12),
      firstPick: firstPick, lvl10: lvl10, early: early, trends: trends, avgLengthSec: lens.length ? lens.reduce(function (a, b) { return a + b; }, 0) / lens.length : null,
      maps: Object.keys(maps).map(function (m) { return { map: m, n: maps[m], share: n ? maps[m] / n : 0 }; }).sort(cmp(function (x) { return x.n; })),
      archetypes: archetypeStats(games).list, limits: LIMITS.slice()
    };
  }

  // ---------------------------------------------------------------- finish wiring
  function mapSummaryWithBuild(data, games, map) {
    var s = mapSummary(games, map);
    s.buildFor = buildForMapImpl(data, map, 12);
    return s;
  }

  return {
    PRIOR: PRIOR, MAP_PRIOR: MAP_PRIOR, LOW_N: LOW_N, ARCHETYPES: ARCHETYPES, SKILLS: SKILLS, WEIGHTS: WEIGHTS, MAP_PROFILES: MAP_PROFILES, LIMITS: LIMITS,
    shrink: shrink, rate: rate, createData: createData, filterGames: filterGames, selectionInfo: selectionInfo,
    heroStats: heroStats, mapHeroStats: mapHeroStats, heroDetail: heroDetail, heroTrend: heroTrend,
    heroVsHero: heroVsHero, heroVsList: heroVsList, pairSynergy: pairSynergy, synergyList: synergyList,
    archetypeOf: archetypeOf, compNeeds: compNeeds, archetypeStats: archetypeStats, archetypeMatchups: archetypeMatchups, archetypeByMap: archetypeByMap,
    mapSummary: mapSummaryWithBuild, compRead: compRead, readEnemy: readEnemy, whatBeats: whatBeats,
    normalizeState: normalizeState, normalizeProfile: normalizeProfile, poolCoverage: poolCoverage,
    recommendPicks: recommendPicks, recommendBans: recommendBans, recommend: recommend,
    scoutTeam: scoutTeam, listTeams: listTeams, metaSummary: metaSummary, draftFormats: draftFormats, nextSlot: nextSlot
  };
});
