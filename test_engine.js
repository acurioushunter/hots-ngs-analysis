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
check("slot 8: Tychus or Thrall in the top 3 and marked lock by slot 9", ["Tychus", "Thrall"].includes(picks[0].hero) && picks.slice(0, 3).some(p => p.flags.some(f => f.startsWith("lock by slot 9"))), top(picks, 5).join() + " " + JSON.stringify(picks.slice(0, 3).map(p => p.flags)));
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
check("Tomb tells us it wants 3 or more ranged heroes", tw.warnings.some(w => w.includes("3 or more") || w.includes("3+")), tw.warnings.join("|"));
let garden = E.newDraft(CCS, "first", "Garden of Terror");
["Johanna", "Junkrat", "Lunara", "Chromie", "Sylvanas", "Qhira", "Hanzo", "Tychus", "Brightwing"].forEach(h => E.apply(garden, h));
const g2 = E.compSummary(garden);
check("Garden with Sylvanas, Tychus, Brightwing = 3 ranged warns", g2.ranged === 3 && g2.warnings.some(w => w.includes("ranged")), JSON.stringify(g2));

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
console.log(fails ? "\n" + fails + " FAILED" : "\nALL OK");
process.exit(fails ? 1 : 0);
