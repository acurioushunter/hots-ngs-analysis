/* Checks for HotS Tools: the My Games engine and the built page. Run: node test_hotstools.js (after python build_hotstools.py) */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('./hotstools/mygames/engine.js');
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const eq = (a, b, m) => { checks++; assert.deepStrictEqual(a, b, m); };
const near = (a, b, e, m) => { checks++; assert.ok(Math.abs(a - b) <= e, (m || '') + ' got ' + a + ' expected ' + b); };

/* ---------------------------------------------------------------- import */
const hpPage = { current_page: 1, last_page: 2, data: [
  { replayID: 11, game_type: { short_name: 'sl' }, game_date: '2026-10-01 20:00:00', game_map: { name: 'Cursed Hollow' }, winner: 1, hero: { name: 'Sylvanas', new_role: 'Ranged Assassin' }, role: 'Ranged Assassin',
    level: 20, kills: 5, assists: 7, takedowns: 12, deaths: 2, hero_damage: 60000, siege_damage: 90000, healing: null, damage_taken: 20000, experience_contribution: 12000, time_spent_dead: 70, merc_camp_captures: 3,
    first_to_ten: 1, player_mmr: 2800, hero_mmr: 2700, role_mmr: 2750, level_one: { title: 'A' }, level_four: { title: 'B' }, level_seven: null },
  { replayID: 12, game_type: { short_name: 'sl' }, game_date: '2026-10-01 20:30:00', game_map: { name: 'Dragon Shire' }, winner: 0, hero: { name: 'Sylvanas' }, role: 'Ranged Assassin', kills: 2, assists: 4, deaths: 5 }
] };
let r = G.parseImport(JSON.stringify(hpPage));
eq(r.source, 'heroes-profile', 'detects a Heroes Profile page');
eq(r.games.length, 2, 'two games read');
eq(r.games[0].hero, 'Sylvanas', 'hero name');
eq(r.games[0].won, 1, 'win flag');
eq(r.games[0].type, 'sl', 'mode');
eq(r.games[0].t, Date.UTC(2026, 9, 1, 20, 0, 0), 'date is UTC');
eq(r.games[0].tal && r.games[0].tal[0], 'A', 'talent title kept');
eq(r.games[1].tal, null, 'no talents when absent');
// two pages pasted back to back
r = G.parseImport(JSON.stringify(hpPage) + '\n' + JSON.stringify(hpPage));
eq(r.games.length, 4, 'pages pasted one after another');
// a bare array of records
r = G.parseImport(JSON.stringify(hpPage.data));
eq(r.games.length, 2, 'array of records');
// compact export and merge
const exp = G.toExport(G.parseImport(JSON.stringify(hpPage)).games, 'Tester');
r = G.parseImport(JSON.stringify(exp));
eq(r.source, 'hots-tools', 'own export is recognised'); eq(r.battletag, 'Tester', 'battletag kept'); eq(r.games.length, 2, 'games kept');
const m1 = G.mergeGames(r.games, G.parseImport(JSON.stringify(hpPage)).games);
eq(m1.games.length, 2, 'merge removes duplicates'); eq(m1.added, 0, 'nothing new'); eq(m1.duplicates, 2, 'two duplicates');
// csv
r = G.parseImport('date,mode,map,hero,role,result,kills,assists,deaths\n2026-10-02 19:00,Storm League,Tomb of the Spider Queen,Chromie,Ranged Assassin,win,4,6,1\n2026-10-02 19:30,sl,Braxis Holdout,Chromie,Ranged Assassin,Loss,1,2,6\n');
eq(r.source, 'csv', 'csv'); eq(r.games.length, 2, 'csv rows'); eq(r.games[0].won, 1, 'csv win'); eq(r.games[1].won, 0, 'csv loss'); eq(r.games[0].type, 'sl', 'csv mode text'); eq(r.games[0].td, 10, 'takedowns derived');
r = G.parseImport('hero;result\nJaina;1\nJaina;0\n');
eq(r.games.length, 2, 'semicolon csv'); eq(r.games[0].t, null, 'no date is allowed');
r = G.parseImport('name,score\na,1\n');
eq(r.games.length, 0, 'csv without hero column imports nothing'); ok(r.warnings.length > 0, 'and says why');
r = G.parseImport('{ not json');
eq(r.games.length, 0, 'broken json');
r = G.parseImport('');
eq(r.games.length, 0, 'empty');

/* ---------------------------------------------------------------- stats on a hand made set */
function mk(i, hero, map, won, extra) {
  return Object.assign({ id: i, t: Date.UTC(2026, 0, 1) + i * 3600000, type: 'sl', map, hero, role: 'Ranged Assassin', won, d: won ? 1 : 4, k: 3, a: 5, hd: 50000, mmr: 2800 + i, tal: null }, extra || {});
}
const set = [];
for (let i = 0; i < 20; i++) set.push(mk(i, 'Raynor', i % 2 ? 'Tomb of the Spider Queen' : 'Cursed Hollow', i < 14 ? 1 : 0));    // 14-6
for (let i = 20; i < 30; i++) set.push(mk(i, 'Hanzo', 'Cursed Hollow', i < 23 ? 1 : 0));                                       // 3-7
const ov = G.overview(set);
eq(ov.n, 30, 'games'); eq(ov.wins, 17, 'wins'); near(ov.wr, 17 / 30, 1e-9, 'win rate');
eq(ov.mmrNow, 2829, 'latest mmr'); eq(ov.mmrFirst, 2800, 'first mmr');
const ht = G.heroTable(set, { Raynor: { win: 50 }, Hanzo: { win: 46 } });
eq(ht[0].key, 'Raynor', 'sorted by games'); eq(ht[0].n, 20, 'raynor games'); eq(ht[0].w, 14, 'raynor wins');
near(ht[0].edge, 0.7 - 0.5, 1e-9, 'edge against global'); near(ht[1].edge, 0.3 - 0.46, 1e-9, 'hanzo edge');
ok(ht[0].shrunk < ht[0].wr && ht[0].shrunk > 0.5, 'shrunk toward the global rate');
eq(ht[1].low, false, 'ten games is not low'); eq(G.heroTable(set.slice(0, 5), null)[0].low, true, 'five games is low');
const mt = G.mapTable(set);
eq(mt.find(x => x.key === 'Cursed Hollow').n, 20, 'map games');
const roll = G.rolling(set, 10);
eq(roll.length, 21, 'rolling points'); near(roll[0].wr, 1, 1e-9, 'first window all wins');
const ss = G.sessionStats(set);
eq(ss.n, 1, 'one sitting when games are an hour apart'); eq(ss.longest, 30, 'longest sitting');
const gap = set.map((g, i) => Object.assign({}, g, { t: Date.UTC(2026, 0, 1) + i * 5 * 3600000 }));
eq(G.sessionStats(gap).n, 30, 'five hours apart is a new sitting each time');
const tb = G.timeBuckets(set, 0);
ok(tb.hours.length >= 1 && tb.days.length >= 1, 'time buckets');
eq(G.applyFilter(set, { heroes: ['Hanzo'] }).length, 10, 'filter by hero');
eq(G.applyFilter(set, { types: ['qm'] }).length, 0, 'filter by mode');
eq(G.applyFilter(set, { since: Date.UTC(2026, 0, 1) + 25 * 3600000 }).length, 5, 'filter by date');

/* ---------------------------------------------------------------- builds and talents */
const tg = set.slice(0, 12).map((g, i) => Object.assign({}, g, { tal: i < 8 ? ['a', 'b', 'c', 'd', 'e', 'f', 'g'] : ['a', 'b', 'c', 'x', 'e', 'f', 'g'] }));
const bd = G.builds(tg, 'Raynor');
eq(bd.length, 2, 'two builds'); eq(bd[0].n, 8, 'most used build first');
const tt = G.talentTiers(tg, 'Raynor');
eq(tt.length, 7, 'seven tiers'); eq(tt[3].rows.length, 2, 'two options at level ten'); eq(tt[3].rows[0].talent, 'd', 'common option first');

/* ---------------------------------------------------------------- rank */
eq(G.rankFromMmr(2933), 'Diamond 2', 'diamond 2'); eq(G.rankFromMmr(2935), 'Diamond 1', 'diamond 1');
eq(G.rankFromMmr(2965), 'Master', 'master'); eq(G.rankFromMmr(2703), 'Platinum 5', 'platinum 5'); eq(G.rankFromMmr(null), null, 'no mmr');

/* ---------------------------------------------------------------- coach and insights */
const matrix = { heroes: {
  Raynor: { role: 'Ranged Assassin', range_class: 'long', dmg_profile: 'sustain', ratings: { wave_clear: 3, camp_clear: 4, siege: 3, teamfight: 3, engage: 1, peel: 2, mobility: 2, self_sustain: 2, objective_burst: 3, ease_of_execution: 4 } },
  Hanzo: { role: 'Ranged Assassin', range_class: 'long', dmg_profile: 'burst', ratings: { wave_clear: 2, camp_clear: 2, siege: 2, teamfight: 4, engage: 1, peel: 1, mobility: 2, self_sustain: 1, objective_burst: 3, ease_of_execution: 2 } },
  Valla: { role: 'Ranged Assassin', range_class: 'long', dmg_profile: 'sustain', ratings: { wave_clear: 3, camp_clear: 4, siege: 3, teamfight: 3, engage: 1, peel: 2, mobility: 2, self_sustain: 2, objective_burst: 3, ease_of_execution: 4 } },
  Muradin: { role: 'Tank', range_class: 'melee', dmg_profile: 'sustain', ratings: { wave_clear: 1, camp_clear: 2, siege: 1, teamfight: 4, engage: 4, peel: 3, mobility: 3, self_sustain: 4, objective_burst: 1, ease_of_execution: 4 } }
} };
const pc = G.poolCoach(set, { matrix, global: { Valla: { win: 52, pick: 10, games: 5000 }, Muradin: { win: 55, pick: 10, games: 5000 } } });
eq(pc.roles.length, 1, 'one role played'); eq(pc.roles[0].role, 'Ranged Assassin', 'role');
eq(pc.retreat[0].hero, 'Raynor', 'main hero'); eq(pc.retreat[0].alts[0].hero, 'Hanzo', 'only fallback in the role');
ok(pc.tryNext.some(t => t.hero === 'Valla'), 'a similar unplayed hero is suggested'); ok(!pc.tryNext.some(t => t.hero === 'Muradin'), 'other roles are not suggested');
ok(pc.concentration.top1Share > 0.6, 'concentration');
const few = G.insights(set.slice(0, 5), {});
eq(few.length, 1, 'few games give one honest line'); ok(/Only 5 games/.test(few[0].text), 'says why');
const ins = G.insights(set, { global: { Raynor: { win: 50 } } });
ok(ins.length >= 2, 'insights for a real set'); ok(ins.every(i => i.text && i.kind), 'insight shape');
ok(!/—|–/.test(ins.map(i => i.text).join(' ')), 'no dash characters in prose');

/* ---------------------------------------------------------------- csv round trip */
const csv = G.toCSV(set.slice(0, 3));
const back = G.parseImport(csv);
eq(back.games.length, 3, 'csv export reads back'); eq(back.games[0].hero, 'Raynor', 'hero survives'); eq(back.games[0].won, 1, 'result survives');

/* ---------------------------------------------------------------- replays: Deaths and talents */
// a death is [time, depth, teammates down near, enemies down near, teammates down before, heroes on the kill, those heroes, level gap, seconds dead]
eq(G.deathKind([100, 0.3, 0, 0, 0, 2, 'Zeratul|Tracer', 0, 20]), 'alone', 'nobody else died: alone');
eq(G.deathKind([100, 0.3, 1, 0, 1, 3, 'Zeratul', 0, 20]), 'late', 'a teammate fell first: late');
eq(G.deathKind([100, 0.3, 1, 2, 0, 3, 'Zeratul', 0, 20]), 'traded', 'enemies died too: traded');
eq(G.deathKind([100, 0.3, 2, 0, 0, 3, 'Zeratul', 0, 20]), 'first', 'teammates died after, nobody of theirs: first down');
eq(G.parseReplays('{"format":"hots-tools-games","games":[]}'), null, 'a match history file is not a replay file');
eq(G.parseReplays('hero,result'), null, 'csv is not a replay file');
const rgame = (hero, won, map, en, dl, tal, t) => ({ id: 'g' + t, t: t, mode: 'sl', map: map, hero: hero, won: won, len: 1200, en: en, al: [], d: dl.length, dl: dl, tal: tal });
const rfile = { format: 'hots-tools-replays', version: 1, player: 'Tester', built: '2026-10-29T12:00:00', ref: { Sylvanas: [100, 200, 70] }, games: [
  rgame('Sylvanas', 1, 'Tomb of the Spider Queen', ['Chromie', 'Johanna'], [[200, 0.7, 0, 0, 0, 2, 'Chromie|Johanna', 0, 20]], [[1, 'Unstable Poison'], [4, 'Haunting Arrows']], 3),
  rgame('Sylvanas', 0, 'Tomb of the Spider Queen', ['Chromie'], [[300, 0.4, 0, 0, 0, 1, 'Chromie', -2, 25], [900, 0.6, 2, 1, 1, 4, 'Chromie|Uther', 0, 40]], [[1, 'Unrelenting Torment'], [4, 'Haunting Arrows']], 2),
  rgame('Junkrat', 1, 'Garden of Terror', ['Johanna'], [], [[1, 'Extra-Wound Timers']], 1),
  rgame('Junkrat', 0, 'Garden of Terror', ['Uther'], [[1500, 0.2, 1, 0, 0, 1, 'Uther', 1, 50]], [[1, 'Extra-Wound Timers']], 4)
] };
const rp = G.parseReplays(JSON.stringify(rfile));
ok(rp && rp.games.length === 4 && rp.games[0].t === 1 && rp.games.every(g => g.type === 'sl'), 'replay file parses, sorted by date, mode becomes type');
const rv = G.deathReview(rp.games, rp.ref);
eq(rv.deaths, 4, 'four deaths'); eq(rv.kinds.alone, 2, 'two alone'); eq(rv.kinds.late, 1, 'one late'); eq(rv.kinds.first, 1, 'one first down');
eq(rv.their, 2, 'two in their half'); eq(rv.behind, 1, 'one while two levels down');
eq(rv.early.with.n, 2, 'two games with an alone death before 20 minutes'); eq(rv.early.with.w, 1, 'one of them won'); eq(rv.early.without.w, 1, 'one win without');
eq(rv.phases[0].n, 2, 'two deaths in the first 10 minutes'); eq(rv.phases[2].n, 1, 'one after 20 minutes');
eq(rv.buckets[1].alone, 1, 'the 2 to 4 minute bar holds one alone death'); eq(rv.buckets.reduce((s, b) => s + b.alone + b.other, 0), 4, 'every death is in a bar');
const syl = rv.heroes.find(h => h.key === 'Sylvanas');
ok(syl.n === 2 && syl.d === 3 && syl.alone === 2 && syl.ref && Math.abs(syl.ref.alone - 0.7) < 1e-9, 'hero row with the NGS reference');
const foes = G.deathFoes(rp.games, 2);
const ch = foes.find(f => f.hero === 'Chromie');
ok(ch && ch.n === 2 && ch.on === 3 && Math.abs(ch.with - 1.5) < 1e-9 && Math.abs(ch.without - 0.5) < 1e-9, 'enemy Chromie: 2 games, on 3 deaths, 1.5 against 0.5');
const rtal = G.replayTalents(rp.games, 'Sylvanas');
ok(rtal.length === 2 && rtal[1].rows[0].talent === 'Haunting Arrows' && rtal[1].rows[0].n === 2 && rtal[1].rows[0].w === 1, 'talents by level with their record');

/* ---------------------------------------------------------------- the built page */
const built = path.join(__dirname, 'hots_tools.html');
if (fs.existsSync(built)) {
  const html = fs.readFileSync(built, 'utf8');
  const outside = html.replace(/window\.HOTS_APPS[\s\S]*?window\.HOTS_THEME_CSS[^;]*;/, '').replace(/'\/\*__(MATRIX|GAMES)__\*\/'/g, '');   // the shell names these two on purpose
  ok(!/\/\*__[A-Z_]+__\*\//.test(outside), 'no template placeholder left outside the embedded apps');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m => !/type="(application\/json|text\/plain)"/.test(m[0]));
  ok(scripts.length >= 4, 'inline scripts found');
  scripts.forEach((m, i) => { try { new vm.Script(m[1]); checks++; } catch (e) { assert.fail('inline script ' + i + ' does not parse: ' + e.message); } });
  // embedded apps survive the string escaping and still carry the shell hooks
  const apps = (() => { const s = {}; const m = html.match(/window\.HOTS_APPS = (\{[\s\S]*?\});\s*window\.HOTS_THEME_CSS/); s.src = m && m[1]; return s; })();
  ok(apps.src, 'apps block found');
  const A = vm.runInNewContext('(' + apps.src + ')');
  ok(A.drafter.length > 1e6 && A.lab.length > 1e5, 'both apps are embedded');
  ok(/HOTS_EMBED/.test(A.drafter) && /HOTS_EMBED/.test(A.lab), 'both apps carry the embed hooks');
  ok(/\/\*__MATRIX__\*\//.test(A.lab) && /\/\*__GAMES__\*\//.test(A.lab), 'the lab leaves its data to the shell');
  ok(!/\/\*__MATRIX__\*\//.test(A.drafter), 'the draft room has no placeholder');
  const meta = JSON.parse(html.match(/id="d-meta">([\s\S]*?)<\/script>/)[1]);
  ok(meta.hero_count >= 90 && meta.games_total > 2000, 'meta counts'); ok(Object.keys(meta.global).length >= 85, 'global hero rates present'); ok(meta.facts.length >= 3, 'facts');
  const ex = JSON.parse(html.match(/id="d-example">([\s\S]*?)<\/script>/)[1]);
  ok(ex.games.length > 400, 'example games'); ok(ex.games.every(g => g.id === undefined), 'example games carry no replay ids');
  ok(!/hunterstag/i.test(JSON.stringify(ex)), 'example is anonymous');
  if (ex.replays) {
    const er = G.parseReplays(ex.replays);
    ok(er && er.games.length >= 50, 'example replays for Deaths and talents');
    ok(er.games.every(g => /^ex\d+$/.test(g.id)) && er.player === 'Example player', 'example replays carry no game ids or names');
    ok(er.games.every(g => g.dl.length === g.d), 'every example death is listed');
    ok(Object.keys(er.ref).length >= 3, 'NGS reference per hero');
  }
  ok(/Deaths and talents/.test(html), 'the menu has Deaths and talents');
}
// the shareable build carries no personal data; the personal edition (when built) does and keeps its own storage keys
if (fs.existsSync(built)) {
  const html = fs.readFileSync(built, 'utf8');
  ok(/window\.HOTS_PERSONAL = null;/.test(html), 'the shareable build has no personal data');
  ok(/window\.HOTS_NS = "";/.test(html), 'the shareable build uses plain storage keys');
}
const mine = path.join(__dirname, 'hots_tools_hunter.html');
if (fs.existsSync(mine)) {
  const html = fs.readFileSync(mine, 'utf8');
  const m = html.match(/window\.HOTS_PERSONAL = (\{[\s\S]*?\});\s*window\.HOTS_NS = "([^"]*)";/);
  ok(m, 'personal block found');
  ok(m[2] === 'hunter:', 'personal edition has its own storage prefix');
  const P = JSON.parse(m[1]);
  ok(P.games.length > 4000 && P.battletag === 'hunterstag' && P.team && P.profile.players.length === 5, 'personal data: games, name, team, five players');
  ok(P.games.every((g) => g.id != null), 'personal games keep their replay ids so a later import merges cleanly');
  if (P.replays) {
    const pr = G.parseReplays(P.replays);
    ok(pr && pr.games.length >= 80 && pr.player === 'hunterstag' && pr.built, 'personal replays: games, name and build stamp');
  }
}
console.log(checks + ' checks passed');
console.log('OK');
