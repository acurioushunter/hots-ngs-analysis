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
    return { opp, side, map: map || null, actions: [] };
  };
  E.clone = function (st) { return { opp: st.opp, side: st.side, map: st.map, actions: st.actions.map(a => Object.assign({}, a)) }; };
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
      const nm = D().our_map_hero[map] && D().our_map_hero[map][player.tag] && D().our_map_hero[map][player.tag][hero];
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

  E.compSummary = function (st) {
    const hs = E.picks(st, "us");
    const info = hs.map(heroInfo);
    const count = f => info.filter(f).length;
    const rules = E.rulesFor(st);
    const out = {
      heroes: hs,
      ranged: count(i => i.ranged), marksmen: count(i => i.marksman), healers: count(i => i.role === "Healer"),
      frontline: count(i => i.role === "Tank" || i.role === "Bruiser"), highClear: count(i => i.high_clear), highDamage: count(i => i.high_damage),
      warnings: []
    };
    const remaining = E.remainingPicks(st, "us");
    const rt = rules.filter(r => r.kind === "ranged_target");
    rt.forEach(r => {
      if (r.min != null && out.ranged + remaining < r.min) out.warnings.push("Only " + out.ranged + " ranged so far with " + remaining + " picks left; this map wants " + r.min + " or more. " + r.why);
      else if (r.min != null && out.ranged < r.min && remaining) out.warnings.push("Need " + (r.min - out.ranged) + " more ranged hero(es) (map wants " + r.min + "+). " + r.why);
      if (r.max != null && out.ranged > r.max) out.warnings.push("Already " + out.ranged + " ranged; this map prefers " + r.max + " or fewer. " + r.why);
    });
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
      theirs.forEach(e => {
        if (heroInfo(e).counters.indexOf(h) >= 0) { score += w.counter; reasons.push("counters their " + e + " (Icy Veins)"); }
        if (info.counters.indexOf(e) >= 0) { score -= w.counter; reasons.push("their " + e + " counters it (Icy Veins)"); }
      });
      mine.forEach(o => { if (info.synergies.indexOf(o) >= 0 || heroInfo(o).synergies.indexOf(h) >= 0) { score += w.synergy; reasons.push("synergy with our " + o); } });
      // composition
      const nowRanged = comp.ranged, nowMark = comp.marksmen;
      if (marksmenNeed && nowMark < marksmenNeed && info.marksman) { score += w.marksman_need; reasons.push("marksman " + (nowMark + 1) + " of " + marksmenNeed + " wanted (13-6 with two or more)"); }
      rt.forEach(r => {
        if (r.min != null && info.ranged && nowRanged < r.min) { score += w.ranged_target; reasons.push("map wants " + r.min + "+ ranged heroes"); }
        if (r.max != null && info.ranged && nowRanged >= r.max) { score -= w.ranged_target * 1.5; reasons.push("already at the ranged cap (" + r.max + ") for this map"); }
        if (r.max != null && !info.ranged && nowRanged >= r.max && remaining > 0) { score += 0.3; }
      });
      const missing = [];
      if (!comp.healers) missing.push("Healer");
      if (!comp.frontline) missing.push("Front");
      const fills = (info.role === "Healer" && !comp.healers) || ((info.role === "Tank" || info.role === "Bruiser") && !comp.frontline);
      if (fills && remaining - 1 < missing.length) { score += w.role_gap; reasons.push("fills the " + (info.role === "Healer" ? "healer" : "front line") + " gap"); }
      if (info.role === "Healer" && comp.healers >= 1) { score -= 1.5; reasons.push("a second healer (only wanted on double healer maps)"); }
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
      // a hero two of our players can play hides the plan and keeps options open
      const capable = d.us.players.filter(p => p.pool[h] && E.poolScore(p, h, map).s > 2.5).length;
      if (capable >= 2) { score += w.flex; reasons.push(capable + " of our players can play it (swap hero)"); }
      // denial: a hero they rely on
      if (opp) {
        const hp = opp.hero_picks[h];
        if (hp && hp[0] >= 3 && sm(hp[1], hp[0]) > 0.55 && asg && asg.score > 1) { score += w.denial * Math.min(hp[0] / oppGames, 0.5) * 6; reasons.push("denies them (they are " + rec(hp) + " with it)"); }
      }
      out.push({ hero: h, score, who: whoCan(h, map), reasons, flags, assign: withH.assign });
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
      out.push({ hero: h, score, reasons, flags });
    });
    // heroes with rule bonuses that never appear in their rows (for example a hero we want gone)
    rules.forEach(r => {
      if (r.kind !== "ban_bonus") return;
      Object.keys(r.heroes).forEach(h => {
        if (used.has(h) || out.find(o => o.hero === h)) return;
        out.push({ hero: h, score: r.heroes[h], reasons: [r.why], flags: [] });
      });
    });
    out.sort((a, b) => b.score - a.score);
    return out;
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
    const list = Object.keys(all).filter(h => !used.has(h)).map(h => ({ hero: h, atSlot: bySlot[h] || 0, g: all[h][0], w: all[h][1], score: (bySlot[h] || 0) * 3 + all[h][0] }))
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
      return { map: m, us: o || [0, 0], them: t || [0, 0], themPicker: theirPick || [0, 0], edge: ow - tw, banScore: ban, theyBan: habits.bans[m] || 0, series: habits.series };
    });
  };

  E.mapPlan = function (opp) {
    const t = E.mapTable(opp);
    const bans = t.filter(x => x.them[0] >= 2).sort((a, b) => b.banScore - a.banScore).slice(0, 2).map(x => x.map);
    const picks = t.filter(x => bans.indexOf(x.map) < 0 && x.theyBan === 0).sort((a, b) => b.edge - a.edge).slice(0, 3).map(x => x.map);
    return { table: t, bans, picks };
  };

  root.Engine = E;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
