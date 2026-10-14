/* Draft engine: pure functions over window.PLAYBOOK (data.json). No page code in here, so node test_engine.js can run it.
   Every recommendation carries the reasons and the sample sizes behind it. Judgment calls live in playbook/config/rules.json. */
(function (root) {
  "use strict";
  const E = {};

  // ---------------------------------------------------------------- draft order
  // First pick team: bans 1, 3, 11 and picks 5, 8, 9, 14, 15. Other team: bans 2, 4, 10 and picks 6, 7, 12, 13, 16.
  const FIRST = { 1: "ban", 3: "ban", 11: "ban", 5: "pick", 8: "pick", 9: "pick", 14: "pick", 15: "pick" };
  E.plan = function (side) { // side = whether WE are 'first' or 'second'
    const out = [];
    for (let n = 1; n <= 16; n++) {
      const firstTeamSlot = n in FIRST;
      const type = (n <= 4 || n === 10 || n === 11) ? "ban" : "pick";
      const team = firstTeamSlot ? (side === "first" ? "us" : "opp") : (side === "first" ? "opp" : "us");
      out.push({ slot: n, type, team });
    }
    return out;
  };

  E.newDraft = function (opp, side, map) {
    return { opp, side, map: map || null, actions: [], series: [] };
  };
  E.clone = function (st) { return { opp: st.opp, side: st.side, map: st.map, series: st.series || [], actions: st.actions.map(a => Object.assign({}, a)) }; };
  // what happened in the earlier games of this best of three: {map, won, ours: [heroes], theirs: [heroes]}
  E.seriesGames = function (st) { return st.series || []; };
  E.nextSlot = function (st) { return st.actions.length < 16 ? E.plan(st.side)[st.actions.length] : null; };
  E.apply = function (st, hero, player) {
    const s = E.nextSlot(st);
    if (!s) return st;
    st.actions.push({ slot: s.slot, type: s.type, team: s.team, hero, player: player || null });
    return st;
  };
  E.undo = function (st) { st.actions.pop(); return st; };
  E.used = function (st) { return new Set(st.actions.filter(a => a.hero && a.hero !== "No Pick").map(a => a.hero)); };
  E.picks = function (st, team) { return st.actions.filter(a => a.type === "pick" && a.team === team).map(a => a.hero); };
  E.bans = function (st, team) { return st.actions.filter(a => a.type === "ban" && a.team === team).map(a => a.hero); };
  E.remainingPicks = function (st, team) { return E.plan(st.side).filter(s => s.type === "pick" && s.team === team && s.slot > st.actions.length).length; };

  // ---------------------------------------------------------------- helpers
  const sm = (w, g) => (w + 1) / (g + 2); // smoothed win rate
  const rec = v => v ? v[1] + "-" + (v[0] - v[1]) : "0-0";
  E.rec = rec;
  const D = () => root.PLAYBOOK;

  function applicable(rule, st) {
    const s = rule.scope || {};
    if (s.opp && s.opp !== "*" && s.opp !== st.opp) return false;
    if (s.map && s.map !== "*" && s.map !== st.map) return false;
    if (s.side && s.side !== "*" && s.side !== st.side) return false;
    if (s.us && s.us !== "*" && D().us && s.us !== D().us.team) return false;   // rules written about one team's own players
    return true;
  }
  E.rulesFor = function (st) { return D().rules.rules.filter(r => applicable(r, st)); };

  function weights() { return D().rules.weights; }

  function tierValue(hero, map, roles) {
    const m = map && D().maps[map];
    if (!m) return { v: 0, letter: null, role: null };
    const tiers = m.tiers[hero];
    if (!tiers) return { v: 0, letter: null, role: null };
    let role = Object.keys(tiers).find(r => roles.some(x => r.indexOf(x) === 0));
    if (!role) role = Object.keys(tiers)[0];
    const letter = tiers[role];
    return { v: D().rules.tier_values[letter] || 0, letter, role };
  }

  // score of one player on one hero (higher is better) plus the evidence strings
  E.poolScore = function (player, hero, map) {
    const w = weights();
    const why = [];
    let s;
    const tier = player.pool[hero];
    if ((player.avoid || []).indexOf(hero) >= 0) { s = w.pool_avoid; why.push(player.label + " avoids it" + (player.notes && player.notes[hero] ? ": " + player.notes[hero] : "")); }
    else if (tier === "primary") s = w.pool_primary;
    else if (tier === "secondary") s = w.pool_secondary;
    else if (tier === "practice") { s = w.pool_practice; why.push(player.label + " is still practicing it"); }
    else s = w.pool_unknown;
    const n = player.ngs[hero];
    if (n && n.g >= 2) { s += w.evidence * (sm(n.w, n.g) - 0.5); why.push(player.label + " NGS " + n.w + "-" + (n.g - n.w) + (n.deaths ? ", " + n.deaths + " deaths" : "")); if (n.deaths > 3.5) s -= 0.5; }
    else if (n && n.g === 1) why.push(player.label + " NGS " + n.w + "-" + (n.g - n.w) + " (one game)");
    const sl = player.sl && player.sl.heroes[hero];
    if (sl && sl[0] >= 8) { s += 2 * (sm(sl[1], sl[0]) - 0.5); why.push(player.label + " Storm League " + sl[1] + "-" + (sl[0] - sl[1]) + " since " + player.sl.since); }
    if (map) {
      const slm = player.sl && player.sl.by_map[map] && player.sl.by_map[map][hero];
      if (slm && slm[0] >= 4) { s += 2 * (sm(slm[1], slm[0]) - 0.5); why.push("on this map in Storm League " + slm[1] + "-" + (slm[0] - slm[1])); }
      const omh = D().our_map_hero || {};
      const nm = omh[map] && omh[map][player.tag] && omh[map][player.tag][hero];
      if (nm && nm[0] >= 2) { s += 1.5 * (sm(nm[1], nm[0]) - 0.5); why.push("on this map in NGS " + nm[1] + "-" + (nm[0] - nm[1])); }
      const t = tierValue(hero, map, player.tier_roles);
      if (t.letter) { s += w.map_tier * t.v; why.push("Icy Veins " + t.letter + " tier on " + map + " (" + t.role + ")"); }
    }
    return { s, why };
  };

  // best assignment of heroes to players (brute force, at most 5 heroes)
  E.bestAssign = function (heroList, map, excludePlayers) {
    const players = D().us.players.filter(p => !(excludePlayers || []).includes(p.tag));
    if (!heroList.length) return { total: 0, assign: [] };
    let best = null;
    const used = new Array(players.length).fill(false);
    const cur = [];
    (function rec2(i, total) {
      if (i === heroList.length) { if (!best || total > best.total) best = { total, assign: cur.slice() }; return; }
      for (let k = 0; k < players.length; k++) {
        if (used[k]) continue;
        used[k] = true;
        const ps = E.poolScore(players[k], heroList[i], map);
        cur.push({ hero: heroList[i], player: players[k].tag, label: players[k].label, score: ps.s, why: ps.why });
        rec2(i + 1, total + ps.s);
        cur.pop();
        used[k] = false;
      }
    })(0, 0);
    return best;
  };

  function heroInfo(h) { return D().heroes[h] || { name: h, role: "Unknown", counters: [], synergies: [], ranged: false, marksman: false }; }

  function lateBanSlot(st) { return st.side === "second" ? 11 : 10; } // when the opponent makes its round two ban

  // What the whole league did (data.comps, every NGS side seasons 15 to 22): ranged count win rates on a map and overall.
  // Returns null without data. gap is the win rate of 3 or more ranged minus 2 or fewer; real only when each side has 100 or more games.
  // Weighted by season (newer counts more) with the raw newest window beside it. A cell is [games, wins, weighted games, weighted wins, recent games, recent wins].
  E.cell = function (v) {
    if (!v || !v[0]) return null;
    const wn = v[2], ww = v[3];
    return { n: v[0], wr: v[1] / v[0], wwr: wn ? ww / wn : v[1] / v[0], eff: Math.round(wn), rn: v[4], rwr: v[4] ? v[5] / v[4] : null };
  };
  const addCells = (a, b) => (b ? (a ? a.map((x, i) => x + (b[i] || 0)) : b.slice()) : a);
  E.rangedLeague = function (map) {
    const c = D().comps;
    if (!c) return null;
    const pool = (src) => {
      const r = (src && src.ranged) || {};
      const sum = ks => ks.reduce((a, k) => addCells(a, r[k]), null);
      const hi = sum(["3", "4+"]), lo = sum(["0-1", "2"]), top = r["4+"] || null;
      const H = E.cell(hi), L = E.cell(lo), T = E.cell(top);
      const ok = H && L && H.n >= 100 && L.n >= 100;
      const gap = ok ? H.wwr - L.wwr : null;
      const rgap = ok && H.rn >= 40 && L.rn >= 40 ? H.rwr - L.rwr : null;   // the same gap using only the newest window
      return { hi: hi ? [hi[0], hi[1]] : [0, 0], lo: lo ? [lo[0], lo[1]] : [0, 0], top: top ? [top[0], top[1]] : [0, 0], H, L, T, hiWr: H && H.wwr, loWr: L && L.wwr, topWr: T && T.wwr, gap, rgap };
    };
    return { map: pool((c.maps || {})[map]), all: pool(c.all), sides: c.sides, newest: c.newest, halfLife: c.half_life, recentSeasons: c.recent_seasons };
  };
  const pc = x => Math.round(x * 100) + "%";
  E.rangedText = function (map) {
    const r = E.rangedLeague(map);
    if (!r) return "";
    const m = r.map;
    let t = "";
    if (m.gap != null) t = "On " + map + " in " + (m.H.n + m.L.n).toLocaleString("en-US") + " NGS sides (newer seasons count more): 3 or more ranged won " + pc(m.hiWr) + " (" + m.H.n + " sides), 2 or fewer won " + pc(m.loWr) + " (" + m.L.n + " sides)" + (m.rgap != null ? "; in the newest " + r.recentSeasons + " seasons alone the gap is " + (m.rgap >= 0 ? "+" : "") + Math.round(m.rgap * 100) + " points" : "");
    if (r.all.gap != null) t += (t ? "; every map: " : "Every map: ") + "3 or more " + pc(r.all.hiWr) + ", 2 or fewer " + pc(r.all.loWr);
    if (r.all.T && r.all.T.n >= 100) t += ". Four or more ranged is the only count that clearly does worse: " + pc(r.all.topWr) + " over " + r.all.T.n + " sides";
    return t;
  };

  E.compSummary = function (st) {
    const hs = E.picks(st, "us");
    const info = hs.map(heroInfo);
    const count = f => info.filter(f).length;
    const rules = E.rulesFor(st);
    const out = {
      heroes: hs,
      ranged: count(i => i.ranged), marksmen: count(i => i.marksman), healers: count(i => i.role === "Healer"),
      frontline: count(i => i.role === "Tank" || i.role === "Bruiser"), highClear: count(i => i.high_clear), highDamage: count(i => i.high_damage),
      warnings: [], notes: []
    };
    const remaining = E.remainingPicks(st, "us");
    const rt = rules.filter(r => r.kind === "ranged_target");
    const rl = E.rangedLeague(st.map);
    const strong = rl && rl.map.gap != null && Math.abs(rl.map.gap) >= 0.05;   // the league says the count matters on this map
    rt.forEach(r => {
      const tail = " Our division sample says: " + r.why;
      if (r.min != null && out.ranged < r.min && remaining) {
        if (strong && rl.map.gap > 0) out.warnings.push("Need " + (r.min - out.ranged) + " more ranged hero(es) for this map. " + E.rangedText(st.map) + "." + tail);
        else out.notes.push("Only a lean, not a need: " + (r.min - out.ranged) + " more ranged hero(es) would match the division sample for this map. " + E.rangedText(st.map) + ". The league does not show a ranged count that wins here, so pick the best heroes for the matchup first." + tail);
      }
      if (r.max != null && out.ranged > r.max) {
        if (strong && rl.map.gap < 0) out.warnings.push("Already " + out.ranged + " ranged. " + E.rangedText(st.map) + "." + tail);
        else out.notes.push("Over the division sample's ranged cap of " + r.max + ", but " + E.rangedText(st.map) + ". Not a rule.");
      }
    });
    if (out.ranged >= 4 && rl && rl.all.topWr != null && rl.all.T.n >= 100) out.warnings.push(out.ranged + " ranged heroes: league wide that count wins " + pc(rl.all.topWr) + " over " + rl.all.T.n + " sides. Check you still have a front line and wave clear.");
    const mm = rules.filter(r => r.kind === "min_marksmen").reduce((a, r) => Math.max(a, r.n), 0);
    if (mm && out.marksmen + remaining < mm) out.warnings.push("Cannot reach " + mm + " marksmen any more. " + rules.find(r => r.kind === "min_marksmen").why);
    if (!out.healers && remaining === 0 && hs.length) out.warnings.push("No healer in the draft.");
    if (!out.frontline && remaining === 0 && hs.length) out.warnings.push("No tank or bruiser in the draft.");
    return out;
  };

  // best value of the picks still to make, given who is left; used to measure how hard a hero is to replace
  E.planValue = function (st, minusHeroes, extraFixed) {
    const d = D();
    const fixed = E.picks(st, "us").concat(extraFixed || []);
    const fx = E.bestAssign(fixed, st.map);
    const takenPlayers = fx.assign.map(a => a.player);
    const gone = new Set([...E.used(st), ...(minusHeroes || [])]);
    const left = d.us.players.filter(p => takenPlayers.indexOf(p.tag) < 0);
    const need = Math.min(E.remainingPicks(st, "us") - (extraFixed ? extraFixed.length : 0), left.length);
    const opts = [];
    left.forEach(p => Object.keys(p.pool).forEach(h => { if (!gone.has(h)) opts.push({ p, h, s: E.poolScore(p, h, st.map).s }); }));
    opts.sort((a, b) => b.s - a.s);
    const usedP = new Set(), usedH = new Set(), chosen = [];
    for (const o of opts) {
      if (chosen.length >= need) break;
      if (usedP.has(o.p.tag) || usedH.has(o.h)) continue;
      usedP.add(o.p.tag); usedH.add(o.h); chosen.push(o);
    }
    return { total: chosen.reduce((a, o) => a + o.s, 0), chosen };
  };

  // ---------------------------------------------------------------- pick recommendations
  E.recommendPicks = function (st, opts) {
    const d = D(), w = weights(), opp = d.teams[st.opp], map = st.map;
    const used = E.used(st);
    const mine = E.picks(st, "us");
    const theirs = E.picks(st, "opp");
    const slot = E.nextSlot(st);
    const rules = E.rulesFor(st);
    const comp = E.compSummary(st);
    const remaining = E.remainingPicks(st, "us");
    const base = E.bestAssign(mine, map).total;
    const lateSlot = lateBanSlot(st);
    const oppGames = Math.max(opp ? opp.games : 1, 1);
    const marksmenNeed = rules.filter(r => r.kind === "min_marksmen").reduce((a, r) => Math.max(a, r.n), 0);
    const rt = rules.filter(r => r.kind === "ranged_target");
    const candidates = [];
    const poolHeroes = new Set();
    d.us.players.forEach(p => Object.keys(p.pool).forEach(h => poolHeroes.add(h)));
    poolHeroes.forEach(h => { if (!used.has(h)) candidates.push(h); });
    const out = [];
    candidates.forEach(h => {
      const info = heroInfo(h);
      const withH = E.bestAssign(mine.concat([h]), map);
      let score = withH.total - base;
      const reasons = [], flags = [];
      const asg = withH.assign.find(a => a.hero === h);
      if (asg) asg.why.forEach(x => reasons.push(x));
      // counters and synergy against what is already on the board
      const counteredBy = [];
      theirs.forEach(e => {
        const m = E.h2h(h, e);
        if (m && m.n >= 40) {   // measured from league games: use it instead of the Icy Veins list
          const edge = Math.max(-2.2, Math.min(2.0, m.edge * 20));
          score += edge;
          if (Math.abs(m.edge) >= 0.03) reasons.push((m.edge > 0 ? "does better" : "does worse") + " against their " + e + " than usual: " + Math.round(m.wr * 100) + "% in " + m.n + " league games (" + Math.round(m.base * 100) + "% overall)");
          if (m.edge <= -0.04) counteredBy.push(e);
          return;
        }
        if (heroInfo(e).counters.indexOf(h) >= 0) { score += w.counter; reasons.push("counters their " + e + " (Icy Veins)"); }
        if (info.counters.indexOf(e) >= 0) { score -= w.counter * 1.4; counteredBy.push(e); reasons.push("their " + e + " counters it (Icy Veins)"); }
      });
      if (counteredBy.length >= 2) { score -= w.counter * 0.8 * (counteredBy.length - 1); flags.push("COUNTERED by " + counteredBy.join(" and ")); }
      // partners
      mine.forEach(o => { if (info.synergies.indexOf(o) >= 0 || heroInfo(o).synergies.indexOf(h) >= 0) { score += w.synergy; reasons.push("synergy with our " + o); } });
      // role stacking: a third hero from the same role, or a third damage dealer with no front line yet
      const sameRole = mine.filter(o => heroInfo(o).role === info.role).length;
      if (info.role !== "Healer" && sameRole >= 2) { score -= 2.5; reasons.push("we already have " + sameRole + " " + info.role + " heroes"); }
      else if (info.role !== "Healer" && sameRole >= 1 && (info.role === "Tank" || info.role === "Bruiser" || info.role === "Support")) { score -= 0.8; reasons.push("a second " + info.role + " (check it is deliberate)"); }
      // composition
      const nowRanged = comp.ranged, nowMark = comp.marksmen;
      if (marksmenNeed && nowMark < marksmenNeed && info.marksman) { score += w.marksman_need; reasons.push("marksman " + (nowMark + 1) + " of " + marksmenNeed + " wanted (13-6 with two or more)"); }
      const rlg = E.rangedLeague(map), evid = rlg && rlg.map.gap != null && Math.abs(rlg.map.gap) >= 0.05 ? 1 : 0.25;   // a division rule the league does not back counts a quarter
      rt.forEach(r => {
        if (r.min != null && info.ranged && nowRanged < r.min) { score += w.ranged_target * evid; if (evid === 1) reasons.push("map wants " + r.min + "+ ranged heroes"); }
        if (r.max != null && info.ranged && nowRanged >= r.max) { score -= w.ranged_target * 2.5 * evid; if (evid === 1) { flags.push("OVER RANGED CAP"); reasons.push("already at the ranged cap (" + r.max + ") for this map: this would be ranged hero " + (nowRanged + 1)); } }
        if (r.max != null && !info.ranged && nowRanged >= r.max && remaining > 0) { score += 0.3; }
      });
      const missing = [];
      if (!comp.healers) missing.push("Healer");
      if (!comp.frontline) missing.push("Front");
      const fills = (info.role === "Healer" && !comp.healers) || ((info.role === "Tank" || info.role === "Bruiser") && !comp.frontline);
      if (fills && remaining - 1 < missing.length) { score += w.role_gap; reasons.push("fills the " + (info.role === "Healer" ? "healer" : "front line") + " gap"); }
      if (info.role === "Healer" && comp.healers >= 1) { score -= 3; reasons.push("a second healer (only wanted on double healer maps)"); }
      // rules
      rules.forEach(r => {
        if (r.kind === "pick_bonus" && r.heroes[h]) { score += r.heroes[h]; reasons.push(r.why); }
      });
      // lock early: will the opponent ban it before we could pick it later?
      if (opp && slot && slot.slot < lateSlot) {
        const vs = opp.bans_games_vs_us ? ((opp.bans_r2_vs_us && opp.bans_r2_vs_us[h]) || 0) / opp.bans_games_vs_us : 0;
        const all = (opp.bans_r2[h] || 0) / oppGames;
        const rate = Math.max(vs, all);
        const laterChance = E.plan(st.side).some(x => x.team === "us" && x.type === "pick" && x.slot > slot.slot && x.slot < lateSlot);
        if (rate >= 0.25 && asg && asg.score > 2) {
          if (!laterChance) { score += w.lock_urgency * Math.min(rate, 1); flags.push("LOCK NOW: last chance before their round two ban (slot " + lateSlot + ")"); reasons.push("they ban it late in " + Math.round(rate * 100) + "% of games"); }
          else { score += 0.3; flags.push("lock by slot " + E.plan(st.side).filter(x => x.team === "us" && x.type === "pick" && x.slot < lateSlot).pop().slot); reasons.push("they ban it late in " + Math.round(rate * 100) + "% of games, so it has to be picked before slot " + lateSlot); }
        }
      }
      // how much worse the rest of our draft gets if the opponent takes or bans it
      if (remaining >= 1 && asg && asg.score > 2) {
        const all = E.planValue(st, [], null).total, without = E.planValue(st, [h], null).total;
        const loss = all - without;
        const risk = opp ? Math.min(1, (((opp.hero_picks[h] || [0])[0]) + (opp.bans_r1[h] || 0) + (opp.bans_r2[h] || 0)) / oppGames) : 0;
        if (loss > 0.4) { score += w.irreplaceable * loss * (0.2 + 2 * risk); if (loss > 1.2 && risk > 0.15) reasons.push("hard to replace (our plan loses " + loss.toFixed(1) + " points) and they pick or ban it in " + Math.round(risk * 100) + "% of games"); }
      }
      E.seriesGames(st).forEach((g, gi) => {
        if (g.ours && g.ours.indexOf(h) >= 0) {
          reasons.push("we " + (g.won ? "won" : "lost") + " game " + (gi + 1) + " of this series with it");
          if (g.won) score += 0.3;
        }
        if (g.theirs && g.theirs.indexOf(h) >= 0) reasons.push("they played it in game " + (gi + 1) + (g.won ? " and lost" : " and won"));
      });
      // our own record with this hero against this opponent (a lean only, tiny samples)
      const ov = opp && opp.our_heroes_vs_them && opp.our_heroes_vs_them[h];
      if (ov && ov[0] >= 1) {
        if (ov[0] >= 2) score += w.vs_us * (sm(ov[1], ov[0]) - 0.5);
        reasons.push("we are " + rec(ov) + " with it against " + st.opp);
      }
      // a hero two of our players can play hides the plan and keeps options open
      const capable = d.us.players.filter(p => p.pool[h] && E.poolScore(p, h, map).s > 2.5).length;
      if (capable >= 2) { score += w.flex; reasons.push(capable + " of our players can play it (swap hero)"); }
      // denial: a hero they rely on
      if (opp) {
        const hp = opp.hero_picks[h];
        if (hp && hp[0] >= 3 && sm(hp[1], hp[0]) > 0.55 && asg && asg.score > 1) { score += w.denial * Math.min(hp[0] / oppGames, 0.5) * 6; reasons.push("denies them (they are " + rec(hp) + " with it)"); }
      }
      out.push({ hero: h, score, who: whoCan(h, map), reasons, flags, assign: withH.assign, intel: E.heroIntel(d.teams[d.us.team], h, mine, map) });
    });
    out.sort((a, b) => b.score - a.score);
    return out;
  };

  function whoCan(h, map) {
    return D().us.players.filter(p => p.pool[h] !== undefined).map(p => ({ p, ps: E.poolScore(p, h, map) }))
      .sort((a, b) => b.ps.s - a.ps.s).map(x => ({ tag: x.p.tag, label: x.p.label, tier: x.p.pool[h], score: x.ps.s }));
  }

  // ---------------------------------------------------------------- ban recommendations
  E.threats = function (st) {
    const d = D(), opp = d.teams[st.opp];
    const raw = {};
    Object.keys(opp.players).forEach(tag => {
      const p = opp.players[tag];
      Object.keys(p.heroes).forEach(h => {
        const r = p.heroes[h];
        let v = r.g * (0.4 + sm(r.w, r.g)) * Math.max(0.6, Math.min(1.5, 1 + (r.rating - 60) / 40));
        if (r.weak) v *= 0.35;
        raw[h] = raw[h] || { v: 0, rows: [] };
        raw[h].v += v;
        raw[h].rows.push({ tag, g: r.g, w: r.w, rating: r.rating, deaths: r.deaths, weak: r.weak });
      });
    });
    const max = Math.max.apply(null, Object.values(raw).map(x => x.v).concat([1]));
    Object.values(raw).forEach(x => { x.v = 5 * x.v / max; });
    return raw;
  };

  E.recommendBans = function (st) {
    const d = D(), opp = d.teams[st.opp], w = weights();
    const used = E.used(st);
    const slot = E.nextSlot(st);
    const rules = E.rulesFor(st);
    const mine = E.picks(st, "us"), theirs = E.picks(st, "opp");
    const th = E.threats(st);
    const ours = new Set();
    d.us.players.forEach(p => Object.keys(p.pool).forEach(h => ours.add(h)));
    const late = slot && (slot.slot === 10 || slot.slot === 11);
    const openerSlots = ["5", "6"]; // their first pick lands on slot 5 when they open, otherwise slot 6
    const out = [];
    const ruleBan = new Set();
    rules.forEach(r => { if (r.kind === "ban_bonus") Object.keys(r.heroes).forEach(h => ruleBan.add(h)); });
    Object.keys(th).forEach(h => {
      if (used.has(h) || (ours.has(h) && !ruleBan.has(h))) return;
      const info = heroInfo(h);
      let score = th[h].v;
      const reasons = [], flags = [];
      const rows = th[h].rows.sort((a, b) => b.g - a.g);
      reasons.push(rows.slice(0, 2).map(r => r.tag + " " + r.w + "-" + (r.g - r.w) + " (rating " + Math.round(r.rating) + ")").join(", "));
      if (rows.every(r => r.weak)) { flags.push("LEAVE OPEN"); reasons.push("the player is clearly worse on it than on his other heroes"); }
      const fp = openerSlots.reduce((n, k) => n + ((opp.picks_by_slot[k] && opp.picks_by_slot[k][h]) || 0), 0);
      if (fp) { score += 0.8 * fp / Math.max(opp.games, 1) * 3; reasons.push("a first pick of theirs " + fp + " time(s)"); }
      mine.forEach(o => { if (heroInfo(o).counters.indexOf(h) >= 0) { score += 1.0; reasons.push("counters our " + o); } });
      const pools = [];
      d.us.players.forEach(p => Object.keys(p.pool).forEach(o => { if (p.pool[o] === "primary" && !used.has(o) && !mine.includes(o) && heroInfo(o).counters.indexOf(h) >= 0) pools.push(o); }));
      if (pools.length) { score += Math.min(0.5 * pools.length, 1.5); reasons.push("counters our " + pools.join(" and ") + " (Icy Veins)"); }
      if (late) {
        theirs.forEach(e => { if (heroInfo(e).synergies.indexOf(h) >= 0 || info.synergies.indexOf(e) >= 0) { score += 0.5; reasons.push("synergy with their " + e); } });
        const hasHealer = theirs.some(e => heroInfo(e).role === "Healer");
        if (info.role === "Healer" && !hasHealer) { score += 0.8; reasons.push("they have no healer yet"); }
      }
      rules.forEach(r => {
        if (r.kind === "ban_bonus" && r.heroes[h]) { score += r.heroes[h]; reasons.push(r.why); }
        if (r.kind === "ban_discount" && r.heroes[h] != null) { score *= r.heroes[h]; flags.push("PROBABLY DO NOT BAN"); reasons.push(r.why); }
      });
      if (info.marksman) { score += 0.2; }
      // a hero they are plainly bad with is a poor use of a ban (a lean: small samples)
      const hp = opp.hero_picks[h];
      if (hp && hp[0] >= 4 && hp[1] / hp[0] <= 0.25) { score *= 0.5; flags.push("LOW VALUE BAN"); reasons.push("they are only " + hp[1] + "-" + (hp[0] - hp[1]) + " with it this season, so a ban buys little"); }
      E.seriesGames(st).forEach((g, gi) => {
        if (g.theirs && g.theirs.indexOf(h) >= 0) {
          if (!g.won) { score += 0.8; reasons.push("they won game " + (gi + 1) + " of this series with it"); }
          else reasons.push("they played it in game " + (gi + 1) + " and lost");
        }
      });
      out.push({ hero: h, score, reasons, flags, intel: E.banIntel(st, h) });
    });
    // heroes with rule bonuses that never appear in their rows (for example a hero we want gone)
    rules.forEach(r => {
      if (r.kind !== "ban_bonus") return;
      Object.keys(r.heroes).forEach(h => {
        if (used.has(h) || out.find(o => o.hero === h)) return;
        out.push({ hero: h, score: r.heroes[h], reasons: [r.why], flags: [], intel: E.banIntel(st, h) });
      });
    });
    out.sort((a, b) => b.score - a.score);
    return out;
  };


  // ---------------------------------------------------------------- ban and pick intel: win rates, conditions, combos
  // Everything here is counted from a team's game log (what that team picked and banned, and whether it won) plus kit facts from the
  // hero matrix. Kit facts are judgment, so they are worded as "kit suggests" and never as something the games showed.
  const HARD_CC = ["silence", "stun", "pull", "root", "knockback", "fear", "blind"];
  const kitOf = h => (D().heroes[h] && D().heroes[h].kit) || null;
  const isDiver = h => {
    const k = kitOf(h), i = D().heroes[h] || {};
    if (!k || i.role === "Healer" || i.role === "Support" || i.role === "Ranged Assassin") return false;
    return i.role === "Melee Assassin" || k.fit.indexOf("dive") >= 0 || k.fit.indexOf("pick") >= 0 || (k.engage || 0) >= 4;
  };
  const wl = (g, w) => w + "-" + (g - w);
  const pcs = (g, w) => g ? Math.round(100 * w / g) + "%" : "n/a";
  // hero against hero from every league game on record (NGS seasons 15 to 22): the record of a's side when b was on the other side
  E.h2h = function (a, b) {
    const m = D().h2h;
    if (!m) return null;
    const flip = a > b, v = m[flip ? b + "|" + a : a + "|" + b];
    if (!v) return null;
    const n = v[0], w = flip ? n - v[1] : v[1];
    const o = D().heroes[a] && D().heroes[a].obs;
    const base = o && o.g >= 50 ? o.w / o.g : 0.5;   // how a does overall, so a matchup reads as better or worse than usual
    // newer seasons count more (data.comps.half_life seasons to halve a game); the shrink toward 50% uses the weighted sample size
    const wn = v.length > 3 ? v[2] : n, ww = v.length > 3 ? (flip ? v[2] - v[3] : v[3]) : w;
    const wr = (ww + 5) / (wn + 10);
    return { n, w, wr, base, edge: wr - base, rawWr: (w + 5) / (n + 10), eff: wn };
  };
  // takedown pairs from the replay export: how often two heroes on one side took part in the same kill, against what chance predicts
  E.combo = function (a, b) {
    const m = D().combos;
    if (!m) return null;
    const v = m[a > b ? b + "|" + a : a + "|" + b];
    if (!v || !v[2] || !v[3] || !v[4]) return null;
    const expected = v[3] * v[4] / v[2];
    return { n: v[0], won: v[1], both: v[5], expected: Math.round(expected * 10) / 10, lift: v[5] / expected };
  };
  // where a hero's measured crowd control time ranks among all heroes with enough games
  function obsRank(h, key) {
    const hs = D().heroes, o = hs[h] && hs[h].obs;
    if (!o) return null;
    const all = Object.keys(hs).filter(x => hs[x].obs && hs[x].obs.g >= 50).map(x => hs[x].obs[key]).filter(v => v != null).sort((a, b) => b - a);
    return { rank: all.indexOf(o[key]) + 1, of: all.length };
  }

  // the style of comps a team builds: how many of its games had two or more heroes with each comp fit tag
  E.styleOf = function (team) {
    const tags = ["dive", "poke", "pick", "deathball", "sustain/attrition", "4 man push/split", "wave clear siege"], out = {};
    const log = (team && team.log) || [];
    tags.forEach(t => {
      let g = 0, w = 0;
      log.forEach(r => { const n = r.picks.filter(h => { const k = kitOf(h); return k && k.fit.indexOf(t) >= 0; }).length; if (n >= 2) { g++; w += r.won; } });
      out[t] = [g, w];
    });
    return { games: log.length, tags: out };
  };

  // intel on one hero as played by `team` (the side that would have it): numbers, conditions, combos.
  // board = heroes that side already has this game; map = this game's map (may be null)
  E.heroIntel = function (team, hero, board, map) {
    const out = { numbers: [], conditions: [], combos: [], style: [], headline: {} };
    if (!team) return out;
    const log = team.log || [], withH = log.filter(r => r.picks.indexOf(hero) >= 0), without = log.filter(r => r.picks.indexOf(hero) < 0);
    const g = withH.length, w = withH.reduce((a, r) => a + r.won, 0);
    const gw = without.length, ww = without.reduce((a, r) => a + r.won, 0);
    out.headline.theirs = [g, w];
    if (g) {
      out.numbers.push("Played in " + g + " of " + log.length + " games, " + wl(g, w) + " (" + pcs(g, w) + ")" + (gw ? ". Without it " + wl(gw, ww) + " (" + pcs(gw, ww) + ")." : "."));
      const rows = [];
      Object.keys(team.players || {}).forEach(tag => { const r = team.players[tag].heroes[hero]; if (r) rows.push({ tag, g: r.g, w: r.w, rating: r.rating, deaths: r.deaths, weak: r.weak }); });
      rows.sort((a, b) => b.g - a.g);
      if (rows.length) out.numbers.push(rows.slice(0, 3).map(r => r.tag + " " + wl(r.g, r.w) + " (rating " + Math.round(r.rating) + (r.deaths != null ? ", " + r.deaths + " deaths per game" : "") + ")").join("; "));
      const vs = team.hero_picks_vs_us && team.hero_picks_vs_us[hero];
      if (vs && vs[0]) { out.numbers.push("Against us: " + wl(vs[0], vs[1]) + " with it."); out.headline.vsUs = vs; }
      // conditions: map, who had first pick, whether it was an early or a late pick
      const cond = (label, rows2) => { if (rows2.length >= 2 && rows2.length < g) { const w2 = rows2.reduce((a, r) => a + r.won, 0); out.conditions.push(label + ": " + wl(rows2.length, w2) + " (" + rows2.length + " games)"); } };
      if (map) cond("On " + map, withH.filter(r => r.map === map));
      cond("When they had first pick", withH.filter(r => r.fp)); cond("When they picked second", withH.filter(r => !r.fp));
      if (g >= 4) cond("With no other " + heroInfo(hero).role + " beside it", withH.filter(r => r.picks.filter(x => x !== hero && heroInfo(x).role === heroInfo(hero).role).length === 0));
      // partners it was drafted with
      const co = {};
      withH.forEach(r => r.picks.forEach(x => { if (x !== hero) { co[x] = co[x] || [0, 0]; co[x][0]++; co[x][1] += r.won; } }));
      Object.keys(co).filter(x => co[x][0] >= 2).sort((a, b) => co[b][0] - co[a][0]).slice(0, 3)
        .forEach(x => out.combos.push("Drafted with " + x + " in " + co[x][0] + " of " + g + " games: " + wl(co[x][0], co[x][1]) + "."));
    } else out.numbers.push("They have not played it in " + log.length + " games on record.");
    // what the games say when the other side takes it away
    const bannedBy = log.filter(r => r.opp_bans.indexOf(hero) >= 0);
    if (bannedBy.length >= 2) out.numbers.push("Record when the other side banned it: " + wl(bannedBy.length, bannedBy.reduce((a, r) => a + r.won, 0)) + " (" + bannedBy.length + " games).");
    // kit combos: what this hero's crowd control could set up for the partners they draft (kit suggests, not seen)
    const k = kitOf(hero);
    if (k) {
      const hard = (k.cc || []).filter(c => HARD_CC.indexOf(c) >= 0), talent = (k.cc_talent || []).filter(c => HARD_CC.indexOf(c) >= 0);
      const pool = {};
      log.forEach(r => r.picks.forEach(x => { if (x !== hero) pool[x] = (pool[x] || 0) + 1; }));
      (board || []).forEach(x => { if (x !== hero) pool[x] = (pool[x] || 0) + 100; });
      const partners = Object.keys(pool).filter(x => isDiver(x) && pool[x] >= 2).sort((a, b) => pool[b] - pool[a]).slice(0, 3);
      if (hard.length && partners.length) {
        const seen = partners.map(x => { const r = withH.filter(rr => rr.picks.indexOf(x) >= 0); return x + (r.length ? " (seen together " + (r.length === 1 ? "once" : r.length + " times") + ", " + wl(r.length, r.reduce((a, rr) => a + rr.won, 0)) + ")" : ""); });
        out.combos.push("Kit suggests its " + hard.join(", ") + (talent.length ? " (plus " + talent.join(", ") + " from talents)" : "") + " could set up their " + seen.join(", ") + (partners.some(x => (board || []).indexOf(x) >= 0) ? ". One of them is already on their board." : "."));
      } else if (hard.length >= 2 && (k.engage || 0) >= 3) out.combos.push("Kit suggests it brings " + hard.join(", ") + " and a decent engage on its own.");
      const seenPairs = Object.keys(pool).filter(x => x !== hero && pool[x] >= 2).map(x => ({ x, c: E.combo(hero, x) })).filter(o => o.c && o.c.n >= 20 && o.c.both >= 15 && o.c.lift >= 1.15)
        .sort((a, b) => b.c.lift - a.c.lift).slice(0, 2);
      seenPairs.forEach(o => out.combos.push("Seen: with " + o.x + " on one side (" + o.c.n + " NGS games, seasons 15 to 22, all teams) they were on the same pick or small fight takedown (three heroes or fewer) " + o.c.both + " times against " + o.c.expected + " that each one's own share predicts (" + (Math.round(o.c.lift * 100) / 100) + "x). It does not show who set up whom."));
      if ((k.peel || 0) >= 4) out.combos.push("Kit suggests strong peel: it protects whoever carries the damage.");
      const ob = (D().heroes[hero] || {}).obs;
      if (ob && ob.g >= 50) {
        const r = obsRank(hero, "cc");
        out.numbers.push("In " + ob.g + " NGS games (seasons 15 to 22) it lands " + ob.cc + " seconds of stun, root and silence per game" + (r && r.rank ? " (rank " + r.rank + " of " + r.of + " heroes)" : "") + (ob.fb != null ? "; its side drew first blood in " + Math.round(ob.fb * 100) + "% of those games." : "."));
      }
      if (k.wr != null) { out.numbers.push("Heroes Profile Storm League, newest patches: " + Math.round(k.wr * 10) / 10 + "% wins, banned in " + Math.round((k.ban || 0) * 10) / 10 + "% of games (" + (k.n || 0).toLocaleString("en-US") + " games)."); out.headline.global = k.wr; }
      const st = E.styleOf(team);
      (k.fit || []).filter(t => st.tags[t] && st.tags[t][0] >= 3 && st.tags[t][0] <= 0.75 * st.games).forEach(t => out.style.push("Fits their style: " + t + " comps in " + st.tags[t][0] + " of " + st.games + " games, " + wl(st.tags[t][0], st.tags[t][1]) + "."));
    }
    return out;
  };

  // How we do against a hero over the season (games where it was on the other side)
  E.ourRecordAgainst = function (hero) {
    const us = D().teams[D().us.team];
    const v = us && us.faced && us.faced[hero];
    return v && v[0] ? v : null;
  };

  // Ban dossier for one candidate hero on the current board.
  E.banIntel = function (st, hero) {
    const d = D(), opp = d.teams[st.opp];
    const i = E.heroIntel(opp, hero, E.picks(st, "opp"), st.map);
    const ours = E.ourRecordAgainst(hero);
    if (ours) { i.numbers.push("Our season record when they had it: " + wl(ours[0], ours[1]) + " (" + ours[0] + " games, every opponent)."); i.headline.ours = ours; }
    const hits = [], seenOurs = [];
    d.us.players.forEach(p => Object.keys(p.pool).forEach(o => { if (seenOurs.indexOf(o) < 0) seenOurs.push(o); }));
    const meas = seenOurs.map(o => ({ o, r: E.h2h(hero, o) })).filter(x => x.r && x.r.n >= 25);
    const beats = meas.filter(x => x.r.edge >= 0.03).sort((a, b) => b.r.edge - a.r.edge).slice(0, 4);
    const loses = meas.filter(x => x.r.edge <= -0.03).sort((a, b) => a.r.edge - b.r.edge).slice(0, 3);
    if (beats.length) i.combos.push("In league games it does better than usual against our " + beats.map(x => x.o + " " + Math.round(x.r.wr * 100) + "% (" + x.r.n + " games)").join(", ") + ".");
    if (loses.length) i.combos.push("It does worse than usual against our " + loses.map(x => x.o + " (" + Math.round(x.r.wr * 100) + "%, " + x.r.n + " games)").join(", ") + ", so banning it is less pressing.");
    d.us.players.forEach(p => Object.keys(p.pool).forEach(o => { if (heroInfo(o).counters.indexOf(hero) >= 0 && hits.indexOf(o) < 0 && !meas.some(x => x.o === o)) hits.push(o); }));
    if (hits.length) i.combos.push("Icy Veins lists it as a counter to our " + hits.join(", ") + " (no measured record).");
    return i;
  };

  // The other side of the table: which of our heroes they are most likely to be afraid of, and why. Same numbers, from our game log.
  E.fearList = function (st) {
    const d = D(), us = d.teams[d.us.team], opp = d.teams[st.opp], used = E.used(st);
    if (!us || !us.log) return [];
    const ourBoard = E.picks(st, "us");
    const seen = {};
    d.us.players.forEach(p => Object.keys(p.pool).forEach(h => { if (!used.has(h) && p.pool[h] !== "practice") seen[h] = (seen[h] === "primary") ? "primary" : p.pool[h]; }));
    return Object.keys(seen).map(h => {
      const i = E.heroIntel(us, h, ourBoard, st.map);
      const g = i.headline.theirs ? i.headline.theirs[0] : 0, w = i.headline.theirs ? i.headline.theirs[1] : 0;
      const faced = opp && opp.faced && opp.faced[h];   // [games, their wins] against it
      let score = g * (0.4 + (w + 1) / (g + 2)) * (seen[h] === "primary" ? 1.2 : 0.8);
      if (faced && faced[0] >= 2 && faced[1] / faced[0] < 0.4) score += 1.5;
      if (i.combos.some(c => /could set up/.test(c))) score += 1;
      const bv = opp && opp.bans_vs_us && opp.bans_vs_us[h];
      if (bv) score += 1.5 * bv;
      if (faced && faced[0]) i.numbers.push(st.opp + " are " + wl(faced[0], faced[1]) + " against it (" + faced[0] + " games).");
      if (bv) i.numbers.push("They have banned it " + bv + " time(s) against us.");
      return { hero: h, score, intel: i, who: whoCan(h, st.map) };
    }).sort((a, b) => b.score - a.score);
  };

  // ---------------------------------------------------------------- what the opponent is likely to do
  E.expectOppBans = function (st) {
    const opp = D().teams[st.opp], used = E.used(st);
    const round = (src, label) => Object.keys(src).filter(h => !used.has(h)).map(h => {
      const vs = (opp.bans_vs_us[h] || 0);
      return { hero: h, n: src[h], vs, label, score: src[h] + vs * 1.5 };
    }).sort((a, b) => b.score - a.score);
    return { round1: round(opp.bans_r1, "round one"), round2: round(opp.bans_r2, "round two"), gamesVsUs: opp.bans_games_vs_us, games: opp.games };
  };

  E.expectOppPicks = function (st) {
    const opp = D().teams[st.opp], used = E.used(st);
    const slot = E.nextSlot(st);
    const bySlot = (slot && opp.picks_by_slot[String(slot.slot)]) || {};
    const all = opp.hero_picks;
    const vsUs = opp.hero_picks_vs_us || {};
    const list = Object.keys(all).filter(h => !used.has(h)).map(h => ({ hero: h, vsUs: vsUs[h] || null, atSlot: bySlot[h] || 0, g: all[h][0], w: all[h][1], score: (bySlot[h] || 0) * 3 + all[h][0] }))
      .sort((a, b) => b.score - a.score);
    // which of their players is the usual user
    list.forEach(x => {
      let best = null;
      Object.keys(opp.players).forEach(tag => { const r = opp.players[tag].heroes[x.hero]; if (r && (!best || r.g > best.g)) best = { tag, g: r.g, w: r.w, weak: r.weak }; });
      x.player = best;
    });
    return list;
  };

  // ---------------------------------------------------------------- simulate the whole draft (their usual habits, our top recommendation)
  E.simulate = function (st) {
    const s = E.clone(st);
    let guard = 0;
    while (E.nextSlot(s) && guard++ < 20) {
      const slot = E.nextSlot(s);
      let hero = null;
      if (slot.team === "us") {
        const list = slot.type === "ban" ? E.recommendBans(s).filter(x => x.flags.indexOf("PROBABLY DO NOT BAN") < 0 && x.flags.indexOf("LEAVE OPEN") < 0) : E.recommendPicks(s);
        hero = list.length ? list[0].hero : "No Pick";
      } else if (slot.type === "ban") {
        const ex = E.expectOppBans(s);
        const lst = (slot.slot <= 4 ? ex.round1 : ex.round2).filter(x => x.score > 0);
        hero = lst.length ? lst[0].hero : "No Pick";
      } else {
        const lst = E.expectOppPicks(s);
        hero = lst.length ? lst[0].hero : "No Pick";
      }
      E.apply(s, hero);
      s.actions[s.actions.length - 1].simulated = true;
    }
    return s;
  };

  // ---------------------------------------------------------------- pre match overview helpers
  E.tossAdvice = function (opp) {
    const d = D(), us = d.teams[d.us.team], them = d.teams[opp];
    const a = us.first_pick, b = us.map_pick, c = them.first_pick, e = them.map_pick;
    const ours = { first: sm(a[1], a[0]), map: sm(b[1], b[0]) }, theirs = { first: sm(c[1], c[0]), map: sm(e[1], e[0]) };
    const edgeFirst = ours.first - theirs.map, edgeMap = ours.map - theirs.first;
    const h2h = { first: [0, 0], map: [0, 0] };
    them.h2h.forEach(g => { const k = g.first_pick ? "map" : "first"; h2h[k][0]++; h2h[k][1] += g.won ? 0 : 1; });
    const pick = edgeFirst - edgeMap > 0.04 ? "first" : (edgeMap - edgeFirst > 0.04 ? "map" : "toss-up");
    return { usFirst: a, usMap: b, themFirst: c, themMap: e, edgeFirst, edgeMap, h2h, pick };
  };

  E.mapTable = function (opp) {
    const d = D(), us = d.teams[d.us.team], them = d.teams[opp];
    const habits = d.map_bans[opp] || { bans: {}, series: 0 };
    return Object.keys(d.maps).map(m => {
      const o = us.by_map[m], t = them.by_map[m];
      const ow = sm(o ? o[1] : 0, o ? o[0] : 0), tw = sm(t ? t[1] : 0, t ? t[0] : 0);
      const theirPick = them.as_map_picker[m];
      const ban = (tw - ow) + (theirPick && theirPick[0] ? 0.05 * (sm(theirPick[1], theirPick[0]) - 0.5) : 0);
      const vs = [0, 0]; // our record against this opponent on this map ([games, our wins]); h2h.won is the opponent's result
      them.h2h.forEach(g => { if (g.map === m) { vs[0]++; vs[1] += g.won ? 0 : 1; } });
      return { map: m, us: o || [0, 0], them: t || [0, 0], themPicker: theirPick || [0, 0], vsUs: vs, edge: ow - tw, banScore: ban, theyBan: habits.bans[m] || 0, series: habits.series };
    });
  };

  E.mapPlan = function (opp) {
    const t = E.mapTable(opp);
    const bans = t.filter(x => x.them[0] >= 2).sort((a, b) => b.banScore - a.banScore).slice(0, 2).map(x => x.map);
    const picks = t.filter(x => bans.indexOf(x.map) < 0 && x.theyBan === 0).sort((a, b) => b.edge - a.edge).slice(0, 3).map(x => x.map);
    return { table: t, bans, picks };
  };

  // maps still in play after the entered map bans, best for us first (opponent habit: a map they have banned before is unlikely to be theirs to pick)
  E.mapChoices = function (opp, bannedMaps) {
    const gone = new Set(bannedMaps || []);
    return E.mapTable(opp).filter(x => !gone.has(x.map)).sort((a, b) => b.edge - a.edge);
  };

  root.Engine = E;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
