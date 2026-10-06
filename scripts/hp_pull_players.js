// Paste into the console of a heroesprofile.com tab (receiver.py running). One request per ~2.5s, stops on a challenge.
// Edit PL to the players still missing, then read progress with window.__sl.
window.HP = {
  hdr() {
    const x = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '');
    return { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(x ? { 'X-XSRF-TOKEN': x } : {}) };
  },
  async slowCall(path, body) {
    for (let a = 0; a < 6; a++) {
      let r = await fetch('/api/v1/' + path, { method: 'POST', headers: this.hdr(), body: JSON.stringify(body) });
      if (r.status === 403) throw new Error('403 challenge');
      if (r.status === 429) { await new Promise(s => setTimeout(s, 20000 * (a + 1))); continue; }
      let j = await r.json().catch(() => null);
      for (let i = 0; i < 60 && r.status === 202 && j && j.job_id; i++) {
        await new Promise(s => setTimeout(s, 2500));
        r = await fetch('/api/v1/global/status/' + j.job_id, { headers: this.hdr() });
        if (r.status === 403) throw new Error('403 challenge');
        if (r.status === 429) { await new Promise(s => setTimeout(s, 20000)); continue; }
        j = await r.json().catch(() => null);
        if (r.status === 200) break;
      }
      if (r.status === 200 && j) return j;
      await new Promise(s => setTimeout(s, 10000));
    }
    throw new Error('gave up ' + path);
  },
  async post(path, obj) {
    const r = await fetch('http://127.0.0.1:8765/', { method: 'POST', body: JSON.stringify({ path, text: JSON.stringify(obj, null, 1) }) });
    return r.status;
  },
  body: (tag, id, gt, extra) => ({ battletag: tag, blizz_id: id, region: '1', game_type: gt, hero: null, role: null, game_map: null,
    minimumgames: 0, type: 'all', page: 'hero', season: null, start_date: null, end_date: null, ...extra }),
};

// [battletag, blizz_id] still to pull (see PULL_STATUS.md)
const PL = [["Jaws", "4880363"], ["Zephy", "3649960"], ["Hiscabibbel", "6813467"], ["YataGarasu", "11008940"], ["Edawg187", "93673"],
  ["Batlin", "266715"], ["moon", "3743707"], ["Xylophone", "11128454"], ["Cymfonique", "10855394"], ["OnyxBat", "11594418"],
  ["Grombri", "10832658"], ["Ltlbearista", "4225264"], ["SoulShepherd", "2159775"], ["chelsi", "9385724"], ["NorthrnTouch", "268452"],
  ["R1EZad", "673412"], ["R1ERockYourW", "1155694"], ["R1EJuaneba", "1510172"], ["Shadowleaves", "3506085"], ["Vacuity", "413041"], ["Xehlyv", "380761"]];

window.__sl = { log: [], err: [], done: false, stopped: false };
const nap = ms => new Promise(s => setTimeout(s, ms));
const fn = s => s.replace(/[^A-Za-z0-9]+/g, '_');

HP.slPull = async () => {
  const ALL = ['qm', 'ud', 'hl', 'tl', 'sl', 'ar'], SL = ['sl'];
  for (const [tag, id] of PL) {
    const dir = `players_hp/${fn(tag)}_${id}`;
    const jobs = [
      ['overview_all', 'player', ALL, {}], ['sl_profile', 'player', SL, {}],
      ['sl_heroes', 'player/heroes/all', SL, { page: 'hero' }], ['sl_maps', 'player/maps/all', SL, { page: 'map' }],
      ['sl_roles', 'player/roles/all', SL, { page: 'role' }],
      ['sl_heroes_s34', 'player/heroes/all', SL, { page: 'hero', season: 34 }],
      ['sl_heroes_s33', 'player/heroes/all', SL, { page: 'hero', season: 33 }],
      ['sl_heroes_s32', 'player/heroes/all', SL, { page: 'hero', season: 32 }],
    ];
    for (const [f, p, gt, x] of jobs) {
      try { await HP.post(`${dir}/${f}.json`, await HP.slowCall(p, HP.body(tag, id, gt, x))); }
      catch (e) { if (String(e).includes('403')) throw e; window.__sl.err.push(tag + ' ' + f + ': ' + e.message); }
      await nap(2500);
    }
    window.__sl.log.push(tag);
  }
};
(async () => { try { await HP.slPull(); } catch (e) { window.__sl.err.push(String(e)); window.__sl.stopped = true; } window.__sl.done = true; })();
