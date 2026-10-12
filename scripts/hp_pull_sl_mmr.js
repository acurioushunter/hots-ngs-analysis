// Pull each NGS player's Storm League profile (game type sl only) and save the small response. Paste into a heroesprofile.com tab with
// `python receiver.py` running. PL = [[battletag, blizz_id], ...] from `python scripts/sl_mmr_todo.py`. One request about every 3 s, stops on 403.
// Progress: window.__mmr = { done: [ids], err, finished }
window.__mmr = { done: [], err: null, finished: false };
(async () => {
  const nap = ms => new Promise(s => setTimeout(s, ms));
  const hdr = () => { const x = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || ''); return { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(x ? { 'X-XSRF-TOKEN': x } : {}) }; };
  try {
    for (const [tag, id] of PL) {
      let r, j = null, ok = false;
      for (let a = 0; a < 4 && !ok; a++) {
        r = await fetch('/api/v1/player', { method: 'POST', headers: hdr(), body: JSON.stringify({ battletag: tag, blizz_id: String(id), region: '1', game_type: ['sl'], hero: null, role: null, game_map: null, minimumgames: 0, type: 'all', page: 'hero', season: null, start_date: null, end_date: null }) });
        if (r.status === 403) throw new Error('403 at ' + tag);
        if (r.status === 429) { await nap(20000 * (a + 1)); continue; }
        j = await r.json().catch(() => null);
        for (let i = 0; i < 30 && r.status === 202 && j && j.job_id; i++) {
          await nap(2500);
          r = await fetch('/api/v1/global/status/' + j.job_id, { headers: hdr() });
          if (r.status === 403) throw new Error('403 at ' + tag);
          j = await r.json().catch(() => null);
          if (r.status === 200) break;
        }
        ok = true;
      }
      const body = (r.status === 200 && j) ? j : null;
      const p = await fetch('http://127.0.0.1:8765/', { method: 'POST', body: JSON.stringify({ path: 'sl_mmr/' + id + '.json', text: JSON.stringify({ battletag: tag, blizz_id: id, status: r.status, profile: body }) }) });
      if (p.status !== 200) throw new Error('receiver ' + p.status);
      window.__mmr.done.push(id);
      await nap(2500);
    }
  } catch (e) { window.__mmr.err = String(e); }
  window.__mmr.finished = true;
})();
