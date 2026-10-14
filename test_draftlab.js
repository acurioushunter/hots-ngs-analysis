'use strict';
// Tests and a short data report for draftlab/engine.js. Run: node test_draftlab.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const E = require('./draftlab/engine.js');

const dir = path.join(__dirname, 'knowledge', 'expert');
const matrix = JSON.parse(fs.readFileSync(path.join(dir, 'hero_matrix_draft.json'), 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(dir, 'league_games.json'), 'utf8'));
const data = E.createData({ matrix, games: rows });
const G = data.games;
let checks = 0;
function ok(cond, msg) { checks++; assert.ok(cond, msg); }
function near(a, b, eps, msg) { checks++; assert.ok(Math.abs(a - b) <= eps, (msg || '') + ' got ' + a + ' expected ' + b); }
const pct = (x) => (x * 100).toFixed(1) + '%';

// ---------------------------------------------------------------- data
ok(G.length === rows.length && G.length > 1000, 'games normalised');
ok(Object.keys(data.heroes).length === 91, '91 heroes');
ok(G.every((g) => g.picks[0].length === 5 && g.picks[1].length === 5), 'five picks per side');
ok(G.every((g) => g.arch[0] && g.arch[1]), 'every side has an archetype');
ok(data.options.maps.length >= 10 && data.options.leagues.length >= 2, 'options built');
ok(data.byHero['Jaina'].length > 0, 'hero index');

// ---------------------------------------------------------------- shrinkage maths
near(E.shrink(0, 0), 0.5, 1e-12, 'no games gives 0.5');
near(E.shrink(8, 10), 13 / 20, 1e-12, 'shrink 8 of 10 with prior 10');
near(E.shrink(80, 100), 85 / 110, 1e-12, 'shrink 80 of 100');
near(E.shrink(3, 4, 10, 0.6), (3 + 6) / 14, 1e-12, 'custom centre');
ok(E.shrink(10, 10) < 1 && E.shrink(0, 10) > 0, 'never reaches 0 or 1');
ok(E.shrink(5000, 10000) === 0.5, 'half stays half');
ok(E.rate(3, 7).low === true && E.rate(4, 8).low === false, 'low flag threshold is 8');
ok(Math.abs(E.shrink(900, 1000) - 0.9) < 0.01, 'large n approaches raw');

// ---------------------------------------------------------------- archetype classifier
function arch(names) { return E.archetypeOf(data, names); }
ok(arch(['Jaina', 'Hanzo', 'Li-Ming', 'Zagara', 'Lt. Morales']).primary === 'poke', 'poke comp');
ok(arch(['Johanna', 'Illidan', 'Alarak', 'Muradin', 'Kerrigan']).primary === 'dive', 'dive comp');
ok(arch(['Stukov', 'Anduin', 'Malfurion', 'Tyrael', 'Garrosh']).primary === 'sustain/attrition', 'sustain comp');
const pushA = arch(['Zagara', 'Azmodan', 'Gazlowe', 'Murky', 'Sylvanas']);
ok(['wave clear siege', '4 man push/split'].includes(pushA.primary), 'wave clear comp reads as siege or push');
ok(arch(['Zagara', 'Azmodan', 'Gazlowe', 'Murky', 'Sylvanas']).reasons.length > 0, 'reasons returned');
const empty = arch([]);
ok(empty.primary === null && empty.partial === true, 'empty comp has no archetype');
const lone = arch(['Johanna']);
ok(lone.partial === true && lone.count === 1 && lone.primary, 'partial comp still classified');
ok(arch(['Jaina', 'Hanzo', 'Li-Ming', 'Zagara', 'Lt. Morales']).missing.every((m) => m.status !== 'ok'), 'missing lists only open needs');
const needs = E.compNeeds(data, ['Jaina', 'Hanzo', 'Li-Ming', 'Zagara', 'Lt. Morales']);
ok(needs.find((n) => n.key === 'frontline').status === 'missing', 'five ranged heroes lack a frontline');
ok(needs.find((n) => n.key === 'healing').status === 'ok', 'Lt. Morales counts as a healer');
ok(needs.every((n) => ['ok', 'thin', 'missing'].includes(n.status) && ['kit', 'judgment', 'data'].includes(n.basis)), 'need fields valid');
ok(JSON.stringify(arch(['Zarya', 'Nova'])) === JSON.stringify(arch(['Zarya', 'Nova'])), 'classifier deterministic');
ok(arch(['Not A Hero', 'Johanna']).count === 1, 'unknown hero names are ignored');

// ---------------------------------------------------------------- filters
const all = G;
ok(E.filterGames(all, {}).length === all.length && E.filterGames(all).length === all.length, 'empty filter keeps all');
const ngs = E.filterGames(all, { leagues: ['NGS'] }), hl = E.filterGames(all, { leagues: ['HL'] });
ok(ngs.length + hl.length === all.length && ngs.length > 0 && hl.length > 0, 'leagues partition the games');
const s21 = E.filterGames(all, { leagues: ['NGS'], seasons: [21] }), s22 = E.filterGames(all, { leagues: ['NGS'], seasons: [22] });
ok(s21.length + s22.length === ngs.length, 'NGS seasons add up');
const combo = E.filterGames(all, { leagueSeasons: ['NGS:21', 'NGS:22', 'HL:30'] });
ok(combo.length === all.filter((g) => g.league === 'NGS' || g.season === 30).length, 'league season combos');
const ch = E.filterGames(all, { maps: ['Cursed Hollow'] });
ok(ch.length > 0 && ch.every((g) => g.map === 'Cursed Hollow'), 'map filter');
const both = E.filterGames(all, { leagues: ['NGS'], seasons: [21], maps: ['Cursed Hollow'], divisions: ['A'] });
ok(both.every((g) => g.league === 'NGS' && g.season === 21 && g.map === 'Cursed Hollow' && g.division === 'A'), 'combined filters use AND');
ok(E.filterGames(all, { leagues: ['HL'], seasons: [21] }).length === 0, 'impossible combo is empty');
const t0 = data.options.teams[0].value, tg = E.filterGames(all, { teams: [t0.toUpperCase()] });
ok(tg.length === data.options.teams[0].n && tg.every((g) => g.teams.includes(t0)), 'team filter is case insensitive and matches either side');
ok(E.filterGames(all, { divisions: ['EU Div 3'] }).every((g) => g.league === 'HL'), 'division filter');
ok(E.selectionInfo([]).level === 'tiny' && E.selectionInfo(all).level === 'ok', 'selection info levels');
// empty selections must not throw
const none = [];
['heroStats', 'archetypeStats', 'archetypeMatchups', 'archetypeByMap', 'metaSummary'].forEach((f) => { E[f](none); checks++; });
E.scoutTeam(none, 'nobody'); E.recommendPicks(data, none, { map: 'Cursed Hollow' }, { limit: 3 }); E.recommendBans(data, none, {}, { limit: 3 }); checks += 3;

// ---------------------------------------------------------------- hero tables
const hs = E.heroStats(all);
ok(hs.list.reduce((s, x) => s + x.picks, 0) === all.length * 10, 'picks sum to ten per game');
ok(hs.list.every((x) => x.n === x.picks && x.low === (x.picks < 8) && x.shrunk > 0 && x.shrunk < 1), 'hero stat flags');
const topHero = hs.list.slice().sort((a, b) => b.picks - a.picks)[0].hero;
const other = hs.list.filter((x) => x.hero !== topHero)[3].hero;
const ab = E.heroVsHero(all, topHero, other), ba = E.heroVsHero(all, other, topHero);
ok(ab.n === ba.n && ab.aWins + ba.aWins === ab.n, 'head to head is symmetric');
const syn = E.pairSynergy(all, topHero, other), syn2 = E.pairSynergy(all, other, topHero);
ok(syn.n === syn2.n && syn.wins === syn2.wins, 'synergy ignores order');
near(E.heroVsHero(all, 'Jaina', 'Jaina').n, 0, 0, 'a hero never faces itself');
const mh = E.mapHeroStats(all, 'Cursed Hollow');
ok(mh.n === ch.length && mh.list.every((x) => Math.abs(x.mapShrunk - x.overall - x.delta) < 1e-9), 'map hero delta consistent');
const det = E.heroDetail(all, topHero);
ok(det.stat.picks === hs.byHero[topHero].picks && det.bestMaps.length > 0, 'hero detail');
ok(E.heroTrend(all, topHero).reduce((s, x) => s + x.picks, 0) === det.stat.picks, 'trend adds to picks');

// ---------------------------------------------------------------- archetype tables
const am = E.archetypeMatchups(all);
let symOk = true, cellN = 0;
E.ARCHETYPES.forEach((a) => E.ARCHETYPES.forEach((b) => {
  if (a === b) return;
  const x = am.table[a][b], y = am.table[b][a];
  if (x.n !== y.n || Math.abs(x.wins + y.wins - x.n) > 1e-9) symOk = false;
  cellN += x.n;
}));
ok(symOk, 'matchup table symmetric: wins plus wins equals n');
const mirrorN = E.ARCHETYPES.reduce((s, a) => s + am.table[a][a].n, 0);
ok(cellN / 2 + mirrorN === all.length, 'every game lands in exactly one matchup cell');
const as = E.archetypeStats(all);
ok(as.list.reduce((s, x) => s + x.n, 0) === all.length * 2, 'archetype appearances equal two per game');
const abm = E.archetypeByMap(all);
ok(Object.values(abm).reduce((s, m) => s + m.n, 0) === all.length, 'archetype by map covers all games');
const ms = E.mapSummary(data, all, 'Cursed Hollow');
ok(ms.n === ch.length && ms.buildFor.heroes.length > 0 && ms.buildFor.heroes[0].basis === 'judgment', 'map summary with kit build');

// ---------------------------------------------------------------- formats and slots
const fmts = E.draftFormats();
ok(fmts.length >= 2 && fmts[0].id === 'ngs' && fmts.some((f) => f.id === 'free') && fmts[0].assumption.length > 30, 'formats documented');
const slots = []; const st = { picks: [[], []], bans: [[], []], firstPick: 0, format: 'ngs' };
for (let i = 0; i < 30; i++) {
  const s = E.nextSlot(st);
  if (s.done) break;
  slots.push(s.type[0] + (s.side === 0 ? 'A' : 'B'));
  (s.type === 'ban' ? st.bans : st.picks)[s.side].push('X' + i);
}
ok(slots.join(' ') === 'bA bB bA bB pA pB pB pA pA bB bA pB pB pA pA pB', 'NGS slot order: ' + slots.join(' '));
ok(E.nextSlot(st).done === true && st.picks[0].length === 5 && st.picks[1].length === 5 && st.bans[0].length === 3, 'draft completes at 5 picks and 3 bans each');
const sw = E.nextSlot({ picks: [[], []], bans: [[], []], firstPick: 1 });
ok(sw.side === 1 && sw.sideLabel === 'A', 'firstPick 1 makes team 1 side A');
ok(E.nextSlot({}, 'free').free === true, 'free form has no fixed slot');

// ---------------------------------------------------------------- recommendations
function sumOk(items) { return items.every((it) => Math.abs(it.components.reduce((s, c) => s + c.value, 0) - it.score) < 0.0015 * it.components.length); }
const state = { map: 'Towers of Doom', myTeam: 0, firstPick: 0, format: 'ngs', skill: 'intermediate', picks: [['Johanna'], ['Jaina', 'Hanzo']], bans: [['Tracer', 'Hogger', 'Lúcio'], ['Blaze', 'Falstad', 'Sylvanas']] };
const taken = new Set([].concat(...state.picks, ...state.bans));
const rp = E.recommendPicks(data, all, state, {});
ok(rp.items.length === 91 - taken.size, 'all free heroes ranked');
ok(rp.items.every((it) => !taken.has(it.hero)), 'picks never suggest banned or picked heroes');
ok(sumOk(rp.items), 'pick components sum to score');
ok(rp.items.every((it, i, a) => i === 0 || a[i - 1].score >= it.score), 'sorted by score');
ok(rp.items.every((it) => it.components.every((c) => ['data', 'kit', 'judgment'].includes(c.basis) && typeof c.note === 'string')), 'components tagged with basis');
ok(rp.items.every((it) => it.low === (it.n < 8) && typeof it.n === 'number'), 'n and low on every item');
const rb = E.recommendBans(data, all, Object.assign({}, state, { bans: [['Tracer'], []], picks: [[], []] }), {});
ok(rb.items.every((it) => it.hero !== 'Tracer') && sumOk(rb.items), 'bans exclude taken heroes and sum');
ok(rb.items.length === 90, 'ban list size');
const rp2 = E.recommendPicks(data, all, state, {});
ok(JSON.stringify(rp) === JSON.stringify(rp2), 'recommendPicks deterministic');
const data2 = E.createData({ matrix, games: rows });
ok(JSON.stringify(E.recommendPicks(data2, data2.games, state, { limit: 10 }).items) === JSON.stringify(rp.items.slice(0, 10)), 'same result from a fresh data build');
ok(E.recommend(data, all, state).kind === 'pick' || E.recommend(data, all, state).kind === 'ban', 'recommend dispatches on the next slot');
// skill level changes ease weighting
const easyHero = data.heroNames.filter((n) => data.heroes[n].ratings.ease_of_execution === 5 && !taken.has(n))[0];
const hardHero = data.heroNames.filter((n) => data.heroes[n].ratings.ease_of_execution <= 2 && !taken.has(n))[0];
function skillVal(skill, hero) { return E.recommendPicks(data, all, Object.assign({}, state, { skill }), {}).items.find((i) => i.hero === hero).components.find((c) => c.name === 'Skill level fit').value; }
ok(skillVal('beginner', easyHero) > skillVal('pro', easyHero) && skillVal('beginner', hardHero) < skillVal('pro', hardHero), 'skill setting reweights ease of execution');
// pool
const prof = { pool: { Valla: 3, Muradin: 1 } };
const poolItems = E.recommendPicks(data, all, Object.assign({}, state, { profile: prof, picks: [[], []], bans: [[], []], side: 0 }), {}).items;
ok(poolItems.find((i) => i.hero === 'Valla').components.find((c) => c.name === 'Team pool').value > 0, 'pool hero gets a bonus');
ok(poolItems.find((i) => i.hero === 'Jaina').components.find((c) => c.name === 'Team pool').value < 0, 'non pool hero gets a small penalty when a pool is loaded');
const poolBan = E.recommendBans(data, all, Object.assign({}, state, { profile: { pool: { Valla: 3 } }, picks: [[], []], bans: [[], []], side: 0 }), {}).items.find((i) => i.hero === 'Valla');
ok(poolBan.components.find((c) => c.name === 'My pool protection').value < 0, 'own pool hero is protected from bans');
// every ban/pick through a full simulated draft stays legal
const sim = { map: 'Dragon Shire', myTeam: 1, firstPick: 1, format: 'ngs', skill: 'advanced', picks: [[], []], bans: [[], []] };
const seen = new Set();
for (let i = 0; i < 16; i++) {
  const rec = E.recommend(data, all, sim, { limit: 5 });
  ok(rec.items.length > 0 && rec.items.every((it) => !seen.has(it.hero)), 'step ' + i + ' suggestions are free heroes');
  const h = rec.items[0].hero; seen.add(h);
  (rec.kind === 'ban' ? sim.bans : sim.picks)[rec.side].push(h);
}
ok(seen.size === 16 && E.nextSlot(sim).done, 'simulated draft fills 16 distinct slots');
// read helpers
const read = E.compRead(data, all, ['Johanna', 'Illidan', 'Alarak', 'Muradin', 'Kerrigan'], ['Jaina', 'Hanzo', 'Li-Ming', 'Zagara', 'Lt. Morales']);
ok(read.archetype.primary === 'dive' && read.versusEnemy && read.versusEnemy.enemyArchetype === 'poke', 'comp read versus enemy');
const re = E.readEnemy(data, all, state, 1);
ok(re.picks.length === 2 && re.likelyNext.length === 5, 'readEnemy');
const wb = E.whatBeats(data, all, ['Jaina', 'Hanzo', 'Li-Ming', 'Zagara', 'Lt. Morales'], { limit: 6 });
ok(wb.heroes.length === 6 && wb.heroes.every((h) => !['Jaina', 'Hanzo', 'Li-Ming', 'Zagara', 'Lt. Morales'].includes(h.hero)), 'whatBeats excludes the comp itself');

// ---------------------------------------------------------------- scout and meta
const sc = E.scoutTeam(all, t0);
ok(sc.record.n === tg.length && sc.record.wins + sc.record.losses === sc.record.n, 'scout record adds up');
ok(sc.byMap.reduce((s, x) => s + x.n, 0) === sc.record.n && sc.heroes.every((x) => x.n <= sc.record.n), 'scout map and hero counts');
ok(E.scoutTeam(all, 'zzz no such team').found === false, 'unknown team is handled');
ok(E.listTeams(all)[0].n >= E.listTeams(all)[1].n, 'listTeams sorted');
const meta = E.metaSummary(all);
const fpRows = all.filter((g) => g.firstPick != null);
ok(meta.firstPick.n === fpRows.length && meta.firstPick.wins === fpRows.filter((g) => g.winner === g.firstPick).length, 'first pick numbers recomputed');
ok(meta.limits.length >= 4 && meta.trends.length === 3, 'meta limits and trends per league season');
ok(E.metaSummary(E.filterGames(all, { leagues: ['HL'] })).firstPick.n === 0, 'HL has no first pick data');

console.log('--- DATA REPORT ---');
console.log('Games: ' + all.length + ' (' + data.options.leagueSeasons.map((x) => x.value + ' ' + x.n).join(', ') + '), heroes ' + hs.list.length + ', teams ' + data.options.teams.length);
console.log('\nArchetype appearances and win rate (n, raw, shrunk):');
as.list.forEach((x) => console.log('  ' + x.arch.padEnd(20) + String(x.n).padStart(5) + '  ' + pct(x.winRate) + '  ' + pct(x.shrunk) + '  share ' + pct(x.share)));
console.log('\nArchetype matchup table (row beats column; win rate from row side, n; * = low sample, = mirror):');
const hdr = ['dive', 'poke', 'pick', 'sust', '4push', 'ball', 'wcs'];
console.log('  ' + ''.padEnd(20) + hdr.map((h) => h.padStart(11)).join(''));
E.ARCHETYPES.forEach((a) => console.log('  ' + a.padEnd(20) + E.ARCHETYPES.map((b) => { const c = am.table[a][b]; return (c.mirror ? '=' + c.n : c.n ? pct(c.winRate).replace('%', '') + '/' + c.n + (c.low ? '*' : '') : '-').padStart(11); }).join('')));
const lowCells = am.list.filter((c) => !c.mirror && c.a < c.b && c.low).length;
console.log('  cells under 8 games: ' + lowCells + ' of ' + (am.list.filter((c) => !c.mirror).length / 2));
const winC = {}, loseC = {};
all.forEach((g) => { winC[g.arch[g.winner]] = (winC[g.arch[g.winner]] || 0) + 1; loseC[g.arch[1 - g.winner]] = (loseC[g.arch[1 - g.winner]] || 0) + 1; });
console.log('\nWinner archetype counts (wins / losses): ' + E.ARCHETYPES.map((a) => a + ' ' + (winC[a] || 0) + '/' + (loseC[a] || 0)).join(', '));
ok(E.ARCHETYPES.reduce((s, a) => s + (winC[a] || 0), 0) === all.length, 'winner archetype counts sum to games');
const spread = as.list.map((x) => x.winRate);
console.log('Spread of archetype win rates: ' + pct(Math.min(...spread)) + ' to ' + pct(Math.max(...spread)));
const leaders = all.filter((g) => g.lvl10Lead != null && g.lvl10Lead !== 0);
const posWin0 = leaders.filter((g) => g.lvl10Lead > 0 && g.winner === 0).length, pos = leaders.filter((g) => g.lvl10Lead > 0).length;
const negWin1 = leaders.filter((g) => g.lvl10Lead < 0 && g.winner === 1).length, neg = leaders.length - pos;
console.log('\nLevel 10 lead sign check: positive lead and team 0 won ' + posWin0 + '/' + pos + ' (' + pct(posWin0 / pos) + '), negative lead and team 1 won ' + negWin1 + '/' + neg + ' (' + pct(negWin1 / neg) + ')');
ok(posWin0 / pos > 0.5 && negWin1 / neg > 0.5, 'positive lvl10 lead favours team 0, so the sign assumption holds');
console.log('Level 10 leader wins: ' + meta.lvl10.wins + '/' + meta.lvl10.n + ' (' + pct(meta.lvl10.winRate) + '); ' + meta.lvl10.buckets.map((b) => b.label + ' ' + pct(b.winRate) + ' n=' + b.n).join(', '));
console.log('First pick team wins (NGS): ' + meta.firstPick.wins + '/' + meta.firstPick.n + ' (' + pct(meta.firstPick.winRate) + ', shrunk ' + pct(meta.firstPick.shrunk) + ')');
const draw = all.filter((g) => g.winner !== 0 && g.winner !== 1).length;
console.log('Games with an invalid winner: ' + draw + '; games with fewer than 3 bans on a side: ' + all.filter((g) => g.bans[0].length < 3 || g.bans[1].length < 3).length);
console.log('Most picked: ' + meta.topPicked.slice(0, 5).map((x) => x.hero + ' ' + x.picks + ' (' + pct(x.winRate) + ')').join(', '));
console.log('Most banned: ' + meta.topBanned.slice(0, 5).map((x) => x.hero + ' ' + x.bans).join(', '));
const topPick = E.recommendPicks(data, all, { map: 'Cursed Hollow', picks: [[], []], bans: [[], []] }, { limit: 5 }).items.map((x) => x.hero + ' ' + x.score).join(', ');
console.log('Sample open board on Cursed Hollow, top 5 picks: ' + topPick);

// ---------------------------------------------------------------- win rate on bans
{
  const hs = E.heroStats(G);
  const banned = hs.list.filter((x) => x.bans > 0);
  ok(banned.every((x) => x.banWins >= 0 && x.banWins <= x.bans), 'ban wins never exceed bans');
  const totalBans = banned.reduce((a, x) => a + x.bans, 0), totalWins = banned.reduce((a, x) => a + x.banWins, 0);
  let direct = 0, directWins = 0;
  G.forEach((g) => [0, 1].forEach((s) => g.bans[s].forEach((h) => { if (h) { direct++; if (g.winner === s) directWins++; } })));
  ok(totalBans === direct && totalWins === directWins, 'ban wins match a direct count (' + totalWins + ' of ' + totalBans + ')');
  const m = E.metaSummary(G);
  ok(m.topBanned.every((x) => typeof x.banWins === 'number' && x.banRec), 'meta most banned carries ban wins');
  const mp = E.mapSummary(data, G, data.options.maps[0]);
  ok(mp.topBans.every((x) => typeof x.banWins === 'number'), 'map top bans carry ban wins');
  const rb = E.recommendBans(data, G, { map: null, picks: [[], []], bans: [[], []] }, { limit: 3 });
  ok(rb.items.every((x) => typeof x.banWins === 'number'), 'ban suggestions carry the banning side record');
  console.log('Banning side won ' + totalWins + ' of ' + totalBans + ' bans (' + pct(totalWins / totalBans) + ')');
}

console.log('\n' + checks + ' checks passed');
console.log('OK');
