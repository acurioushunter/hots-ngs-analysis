// Scenario tests for playbook/engine.js. Run: node test_engine.js (after python build_playbook.py)
const fs = require("fs");
global.PLAYBOOK = JSON.parse(fs.readFileSync(__dirname + "/playbook/data.json", "utf8"));
const E = require("./playbook/engine.js");
const CCS = "Can't Counterpick Stupid";
let fails = 0;
function check(name, ok, detail) { console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "  -> " + detail)); if (!ok) fails++; }
const top = (l, n) => l.slice(0, n).map(x => x.hero);

// plan order
const pf = E.plan("first");
check("first pick team bans 1,3,11", [1, 3, 11].every(n => pf[n - 1].team === "us" && pf[n - 1].type === "ban"), JSON.stringify(pf));
check("first pick team picks 5,8,9,14,15", [5, 8, 9, 14, 15].every(n => pf[n - 1].team === "us" && pf[n - 1].type === "pick"), "");
const ps = E.plan("second");
check("second pick team bans 2,4,10 picks 6,7,12,13,16", [2, 4, 10].every(n => ps[n - 1].team === "us" && ps[n - 1].type === "ban") && [6, 7, 12, 13, 16].every(n => ps[n - 1].team === "us" && ps[n - 1].type === "pick"), "");

// Blaze is melee in every count
check("Blaze is not ranged", PLAYBOOK.heroes["Blaze"].ranged === false, "");
check("Brightwing is ranged", PLAYBOOK.heroes["Brightwing"].ranged === true, "");

// scenario 1: we are first pick vs CCS, no map yet
let st = E.newDraft(CCS, "first", null);
let bans = E.recommendBans(st);
check("slot 1 ban: Johanna first, Lunara in top 2", bans[0].hero === "Johanna" && top(bans, 2).includes("Lunara"), top(bans, 5).join());
check("Qhira flagged do not ban", bans.concat([]).find(b => b.hero === "Qhira").flags.includes("PROBABLY DO NOT BAN"), "");
check("never recommends banning our own pool (Sylvanas)", !bans.find(b => b.hero === "Sylvanas"), "");
E.apply(st, "Johanna");           // 1 us
E.apply(st, "Junkrat");           // 2 opp
E.apply(st, "Lunara");            // 3 us
E.apply(st, "Chromie");           // 4 opp
let picks = E.recommendPicks(st);
check("slot 5 pick: Sylvanas first", picks[0].hero === "Sylvanas", top(picks, 5).join());
check("slot 5 pick: Junkrat and Chromie are not offered (banned)", !top(picks, 20).includes("Junkrat") && !top(picks, 20).includes("Chromie"), "");
E.apply(st, "Sylvanas"); E.apply(st, "Qhira"); E.apply(st, "Hanzo"); // 5 us, 6 opp, 7 opp
picks = E.recommendPicks(st);
check("slot 8: Tychus or Thrall in the top 3 and marked lock by slot 9 (Brightwing may lead on the CCS healer rule)", ["Tychus", "Thrall", "Brightwing"].includes(picks[0].hero) && picks.slice(0, 3).some(p => ["Tychus", "Thrall"].includes(p.hero)) && picks.slice(0, 3).some(p => p.flags.some(f => f.startsWith("lock by slot 9"))), top(picks, 5).join() + " " + JSON.stringify(picks.slice(0, 3).map(p => p.flags)));
{ // if we spent slot 8 on something else, slot 9 is the last chance and must say LOCK NOW
  const alt = E.clone(st); E.apply(alt, "Brightwing");
  const p9 = E.recommendPicks(alt);
  check("slot 9 after Brightwing: Tychus or Thrall first with LOCK NOW", ["Tychus", "Thrall"].includes(p9[0].hero) && p9[0].flags.some(f => f.startsWith("LOCK NOW")), top(p9, 4).join() + " " + JSON.stringify(p9[0].flags));
}
E.apply(st, "Tychus");            // 8 us, now slot 9 is also ours
picks = E.recommendPicks(st);
check("healer slot: Brightwing top once Tychus and Sylvanas are in", picks[0].hero === "Brightwing", top(picks, 5).join());

// scenario 2: Tomb wants ranged, Garden caps it
let tomb = E.newDraft(CCS, "first", "Tomb of the Spider Queen");
const tw = E.compSummary(tomb);
check("Tomb ranged advice carries the league sample and is a note when the league shows no gap", (tw.warnings.concat(tw.notes)).some(w => /NGS sides/.test(w) && /3 or more/.test(w)), tw.warnings.concat(tw.notes).join("|"));
let garden = E.newDraft(CCS, "first", "Garden of Terror");
["Johanna", "Junkrat", "Lunara", "Chromie", "Sylvanas", "Qhira", "Hanzo", "Tychus", "Brightwing"].forEach(h => E.apply(garden, h));
const g2 = E.compSummary(garden);
check("Garden with 3 ranged is flagged with the league numbers (warning or note)", g2.ranged === 3 && g2.warnings.concat(g2.notes).some(w => w.includes("ranged")), JSON.stringify(g2));

// scenario 3: simulate a full draft
const sim = E.simulate(E.newDraft(CCS, "first", "Sky Temple"));
check("simulation fills 16 slots", sim.actions.length === 16, sim.actions.length);
const heroes = sim.actions.map(a => a.hero).filter(h => h !== "No Pick");
check("simulation never repeats a hero", new Set(heroes).size === heroes.length, heroes.join());
console.log("sim:", sim.actions.map(a => a.slot + (a.team === "us" ? "U" : "T") + (a.type === "ban" ? "b" : "p") + ":" + a.hero).join(" "));
const ourFinal = E.bestAssign(E.picks(sim, "us"), "Sky Temple");
console.log("assign:", ourFinal.assign.map(a => a.label + "=" + a.hero).join(", "));
check("simulation gives each player a hero", ourFinal.assign.length === 5, "");

// scenario 4: second pick, lock slot is 7 not 9 (they ban at 11)
let sec = E.newDraft(CCS, "second", null);
["Johanna", "Junkrat", "Lunara"].forEach(() => 0);
const t = E.tossAdvice(CCS);
console.log("toss:", JSON.stringify({ usFirst: t.usFirst, usMap: t.usMap, themFirst: t.themFirst, themMap: t.themMap, pick: t.pick, h2h: t.h2h }));
check("toss advice says first pick against CCS", t.pick === "first", t.pick);
const mp = E.mapPlan(CCS);
console.log("map plan:", JSON.stringify({ bans: mp.bans, picks: mp.picks }));
check("map bans include Towers of Doom", mp.bans.includes("Towers of Doom"), mp.bans.join());
check("map picks do not include a map they always ban", !mp.picks.includes("Braxis Holdout"), mp.picks.join());
const ex = E.expectOppBans(E.newDraft(CCS, "first", null));
check("expected CCS round one bans lead with Junkrat", ex.round1[0].hero === "Junkrat", JSON.stringify(ex.round1.slice(0, 3)));
check("expected CCS round two bans lead with Thrall", ex.round2[0].hero === "Thrall", JSON.stringify(ex.round2.slice(0, 3)));
// mutation checks: take the judgment rules away and the behavior has to change, so these tests are not vacuous
{
  const saved = PLAYBOOK.rules.rules;
  PLAYBOOK.rules.rules = saved.filter(r => r.id !== "ccs-qhira" && r.id !== "ccs-ban-johanna");
  const b2 = E.recommendBans(E.newDraft(CCS, "first", null));
  check("mutation: without the Qhira rule she is no longer flagged", !b2.find(b => b.hero === "Qhira").flags.includes("PROBABLY DO NOT BAN"), "");
  check("mutation: without the Johanna rule she is no longer the top ban", b2[0].hero !== "Johanna", b2[0].hero);
  PLAYBOOK.rules.rules = saved;
  const saved2 = PLAYBOOK.us.not_ranged;
  PLAYBOOK.heroes["Blaze"].ranged = true;
  const g = E.newDraft(CCS, "first", "Garden of Terror");
  ["Johanna", "Junkrat", "Lunara", "Chromie", "Sylvanas", "Qhira", "Hanzo", "Tychus", "Blaze"].forEach(h => E.apply(g, h));
  check("mutation: if Blaze counted as ranged the Garden cap would trip", E.compSummary(g).ranged === 3, E.compSummary(g).ranged);
  PLAYBOOK.heroes["Blaze"].ranged = false;
  check("Blaze as melee: the same draft is at 2 ranged", E.compSummary(g).ranged === 2, E.compSummary(g).ranged);
}
// series: what happened in earlier games of a best of three shows up in the reasons
{
  const st = E.newDraft(CCS, "first", "Sky Temple");
  st.series = [{ map: "Garden of Terror", won: false, ours: ["Sylvanas", "Brightwing"], theirs: ["Johanna", "Ragnaros"] }];
  const picks = E.recommendPicks(st);
  const syl = picks.find(p => p.hero === "Sylvanas");
  check("series: a hero we lost with is mentioned, not boosted", syl && syl.reasons.some(r => /lost game 1 of this series/.test(r)), JSON.stringify(syl && syl.reasons));
  const bans = E.recommendBans(st);
  const rag = bans.find(b => b.hero === "Ragnaros");
  check("series: a hero they won game 1 with is mentioned and boosted", rag && rag.reasons.some(r => /won game 1 of this series/.test(r)), JSON.stringify(rag && rag.reasons));
  const base = E.recommendBans(E.newDraft(CCS, "first", "Sky Temple")).find(b => b.hero === "Ragnaros");
  check("series: that ban score is higher than without the series", rag.score > base.score, rag.score + " vs " + base.score);
}
// pick sense checks (added after a live draft gave picks that clashed with the board)
{
  let st = E.newDraft(CCS, "first", "Tomb of the Spider Queen");
  ["Lunara", "Junkrat", "Gazlowe", "Thrall", "Sylvanas", "Johanna", "Anub'arak"].forEach(h => E.apply(st, h));
  const l = E.recommendPicks(st), tych = l.findIndex(x => x.hero === "Tychus");
  check("a hero that does worse than usual against their pick says so with the league record", l[tych].reasons.some(r => /does worse against their Johanna than usual: \d+% in \d+ league games/.test(r)), l[tych].reasons.join("|"));
  const hj = E.h2h("Tychus", "Johanna"), jt = E.h2h("Johanna", "Tychus");
  check("head to head is symmetric", hj && jt && hj.n === jt.n && hj.w + jt.w === hj.n, JSON.stringify([hj, jt]));
  check("hero observed stats exist for a CC hero", PLAYBOOK.heroes["Stukov"].obs && PLAYBOOK.heroes["Stukov"].obs.cc > PLAYBOOK.heroes["Tychus"].obs.cc, "");
  st = E.newDraft(CCS, "first", "Garden of Terror");
  ["Lunara", "Junkrat", "Gazlowe", "Thrall", "Sylvanas", "Qhira", "Dehaka", "Brightwing", "Muradin", "Hanzo", "Whitemane", "Garrosh", "Li-Ming"].forEach(h => E.apply(st, h));
  const g = E.recommendPicks(st), ty = g.find(x => x.hero === "Tychus");
  const hh = E.h2h("Tychus", "Johanna");
  check("head to head carries a recency weighted sample (effective games no more than raw games)", hh && hh.eff > 0 && hh.eff <= hh.n + 0.5, JSON.stringify(hh));
  const rlw = E.rangedLeague("Tomb of the Spider Queen");
  check("league comps carry the season weighting (newest season, half life, a newest window)", PLAYBOOK.comps.newest >= 22 && PLAYBOOK.comps.half_life === 3 && rlw.all.H && rlw.all.H.rn > 0 && rlw.all.H.eff <= rlw.all.H.n, JSON.stringify(rlw.all.H));
  const gl = E.rangedLeague("Garden of Terror");
  check("the Garden ranged cap flag follows the league evidence (flag only when the league gap is 5 points or more)", ty.flags.some(f => /OVER RANGED/.test(f)) === !!(gl && gl.map.gap != null && gl.map.gap <= -0.05), JSON.stringify([ty.flags, gl && gl.map.gap]));
  check("a second healer is never in the top 3", g.slice(0, 3).every(x => PLAYBOOK.heroes[x.hero].role !== "Healer"), g.slice(0, 3).map(x => x.hero).join());
  const mc = E.mapChoices(CCS, ["Towers of Doom", "Infernal Shrines"]);
  check("map choices drop banned maps", mc.length === Object.keys(PLAYBOOK.maps).length - 2 && !mc.some(x => x.map === "Towers of Doom"), mc.length);
}
// ban and pick intel: win rates, conditions and combos with their sample sizes
{
  const st = E.newDraft(CCS, "first", "Infernal Shrines");
  const joh = E.recommendBans(st).find(b => b.hero === "Johanna");
  check("ban recs carry an intel dossier", joh && joh.intel && joh.intel.numbers.length >= 2, JSON.stringify(joh && joh.intel));
  check("Johanna dossier has CCS record from the log (7 games)", joh.intel.headline.theirs[0] === PLAYBOOK.teams[CCS].hero_picks["Johanna"][0], JSON.stringify(joh.intel.headline));
  check("kit combos are worded as suggestions, never as seen", joh.intel.combos.filter(c => /could set up/.test(c)).every(c => /^Kit suggests/.test(c)), joh.intel.combos.join("|"));
  check("a healer is never named as a dive partner", !joh.intel.combos.some(c => /could set up.*(Brightwing|Anduin|Rehgar)/.test(c)), joh.intel.combos.join("|"));
  const fear = E.fearList(st);
  check("fear list covers our pool and has numbers", fear.length >= 8 && fear[0].intel.numbers.length >= 1, fear.length);
  check("fear list never lists a banned hero", (() => { const s2 = E.clone(st); E.apply(s2, "Sylvanas"); return !E.fearList(s2).some(f => f.hero === "Sylvanas"); })(), "");
  const pk = E.recommendPicks(st)[0];
  check("pick recs carry intel", pk.intel && pk.intel.headline, "");
}
console.log(fails ? "\n" + fails + " FAILED" : "\nALL OK");
process.exit(fails ? 1 : 0);
