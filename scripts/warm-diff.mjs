// After the warm-up, lists each program a step adds: its shader name and how its cache key differs from the closest program
// that already existed. For finding what the warm-up misses.
//
//   node scripts/warm-diff.mjs
import { buildIfStale, openBrowser, startPreview, watch } from './shots.mjs';

buildIfStale();
const { browser } = await openBrowser({});
const preview = await startPreview();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page, errors);
  await page.goto(`http://127.0.0.1:${preview.port}/?hook=1&warm=1`, { waitUntil: 'load' });
  await page.waitForFunction('window.__pcb && window.__pcb.ready === true', null, { timeout: 300000 });
  await page.waitForFunction('window.__pcb.warmState().warmDone || window.__pcb.warmState().error', null, { timeout: 600000, polling: 500 });
  const out = await page.evaluate(async () => {
    const p = window.__pcb; const w = window.__world;
    const keys = () => new Map(w.renderer.info.programs.map((x) => [x.cacheKey, x]));
    let known = keys();
    const res = [];
    const diff = (label) => {
      const now = keys();
      for (const [k, prog] of now) {
        if (known.has(k)) continue;
        const parts = k.split(',');
        let best = null; let bestScore = -1;
        for (const [k2, p2] of known) { if (p2.name !== prog.name) continue; const q = k2.split(','); let s = 0; for (let i = 0; i < Math.min(q.length, parts.length); i++) if (q[i] === parts[i]) s++; if (s > bestScore) { bestScore = s; best = q; } }
        const d = best ? parts.map((v, i) => (best[i] !== v ? `${i}:${best[i]}->${v}` : null)).filter(Boolean).slice(0, 12) : ['no match'];
        const users = [];
        for (const sc of [w.scene, w.inspector.scene, w.overlayScene]) sc.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) { const pr = w.renderer.properties.get(m); if (pr.currentProgram === prog) users.push(`${o.type}:${o.name}:${m.type}:${m.name}:vc=${m.vertexColors}:map=${!!m.map}:alpha=${!!m.alphaMap}:t=${m.transparent}:side=${m.side}`); } });
        res.push({ step: label, name: prog.name, diff: d, head: parts.slice(0, 2).join(',').slice(0, 120), users: users.slice(0, 4) });
      }
      known = now;
    };
    await p.load('night-rig'); diff('night-rig');
    await p.load('white-out'); diff('white-out');
    await p.load('pocket'); diff('pocket');
    await p.inspect('cooler', 'tarn240-frost', 30, {}); diff('inspect tarn240-frost');
    await p.inspect('fan', 'petal', 30, { size: 120 }); diff('inspect petal');
    { const real = []; w.inspector.scene.traverse((o) => { if (o.material && o.material.name === 'bladeFrost') real.push(w.renderer.properties.get(o.material).currentProgram?.cacheKey); });
      const kept = []; w.keeper.scene.traverse((o) => { if (o.material && o.material.name === 'bladeFrost') kept.push(o.material.customProgramCacheKey() + ' || ' + (w.renderer.properties.get(o.material).currentProgram?.cacheKey ?? 'none').slice(-200)); });
      const all = w.renderer.info.programs.map((x) => x.cacheKey);
      const out = real.map((k) => { const tail = k.split(',').pop(); const sib = all.filter((x) => x !== k && x.endsWith(tail)); return sib.map((s) => { const a = k.split(','); const b = s.split(','); return a.map((v, i) => (b[i] !== v ? i + ':' + b[i] + '->' + v : null)).filter(Boolean).join(' '); }); });
      res.push({ step: 'compare', out }); }
    await p.inspect('fan', 'petal', 30, { size: 140 }); diff('inspect petal 140');
    await p.open('none'); diff('close');
    return res;
  });
  console.log(JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) console.log(errors.join('\n'));
