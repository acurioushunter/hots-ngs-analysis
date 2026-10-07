// Pull the NGS division games we do not have yet. Paste into the console of a heroesprofile.com tab AFTER you have passed the
// Cloudflare check yourself, with `python receiver.py` running (it writes under knowledge/raw/). Claude can also run this through the
// Chrome extension.  Never retry through a 403: stop and ask the user to pass the check again.
//
// 1. Set DIVISION and SEASON below, and KNOWN to the output of: python scripts/known_games.py
// 2. DRY = true only lists what is missing. Set DRY = false to download.
// Progress: window.__div  (log, missing, done, error)
const DIVISION = "C West", SEASON = 22, DRY = true;
const KNOWN = [];  // paste the JSON list here

window.__div = { log: [], missing: [], done: false, error: null };
(async () => {
  const nap = ms => new Promise(s => setTimeout(s, ms));
  const hdr = () => {
    const x = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || "");
    return { "Content-Type": "application/json", "Accept": "application/json", "X-Requested-With": "XMLHttpRequest", ...(x ? { "X-XSRF-TOKEN": x } : {}) };
  };
  async function call(path, body) {
    for (let a = 0; a < 5; a++) {
      let r = await fetch("/api/v1/" + path, { method: "POST", headers: hdr(), body: JSON.stringify(body) });
      if (r.status === 403) throw new Error("403 Cloudflare challenge: stop, ask the user to pass the check again");
      if (r.status === 429) { await nap(20000 * (a + 1)); continue; }
      let j = await r.json().catch(() => null);
      for (let i = 0; i < 60 && r.status === 202 && j && j.job_id; i++) {
        await nap(2500);
        r = await fetch("/api/v1/global/status/" + j.job_id, { headers: hdr() });
        if (r.status === 403) throw new Error("403 Cloudflare challenge: stop, ask the user to pass the check again");
        if (r.status === 429) { await nap(20000); continue; }
        j = await r.json().catch(() => null);
        if (r.status === 200) break;
      }
      if (r.status === 200 && j) return j;
      await nap(10000);
    }
    throw new Error("gave up on " + path);
  }
  async function save(path, obj) {
    const r = await fetch("http://127.0.0.1:8765/", { method: "POST", body: JSON.stringify({ path, text: JSON.stringify(obj) }) });
    if (r.status !== 200) throw new Error("receiver returned " + r.status + " (is python receiver.py running, and did you allow local network access?)");
  }
  try {
    const hist = await call("esport/division/match/history", { division: DIVISION, season: SEASON });
    const all = Array.isArray(hist) ? hist : (hist.data || hist.matches || []);
    const missing = all.map(g => g.replayID).filter(id => !KNOWN.includes(id)).sort((a, b) => a - b);
    window.__div.missing = missing;
    window.__div.log.push(`history: ${all.length} games, ${missing.length} missing: ${missing.join(",")}`);
    if (!DRY) {
      for (const id of missing) {
        const m = await call("match/single", { esport: "NGS", replayID: id, tournament: null });
        await save("ngs/matches/" + id + ".json", m);          // saved one at a time so a stop loses nothing
        window.__div.log.push("saved " + id);
        await nap(2500);
      }
    }
  } catch (e) { window.__div.error = String(e); }
  window.__div.done = true;
})();
