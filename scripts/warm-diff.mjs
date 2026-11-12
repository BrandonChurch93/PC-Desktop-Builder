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
    const born = [];
    const rbd = w.renderer.renderBufferDirect.bind(w.renderer);
    w.renderer.renderBufferDirect = (cam, scene, geo, mat, obj, grp) => { const n0 = w.renderer.info.programs.length; rbd(cam, scene, geo, mat, obj, grp); if (w.renderer.info.programs.length > n0) { const chain = []; for (let o = obj; o && chain.length < 6; o = o.parent) chain.push(o.name || o.type); born.push({ mat: mat.type + ':' + (mat.name || '') + ':side=' + mat.side + ':alphaTest=' + mat.alphaTest + ':map=' + !!mat.map + ':alphaMap=' + !!mat.alphaMap, obj: chain.join(' < '), shadow: !scene, objMat: obj.material && !Array.isArray(obj.material) ? obj.material.type + ':' + obj.material.name + ':side=' + obj.material.side + ':shadowSide=' + obj.material.shadowSide + ':t=' + obj.material.transparent : '' }); } };
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
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const anim = async (action, label) => { await p.act(action, { instant: false }); await wait(3500); await p.settle(); diff(label); };
    for (const id of ['night-rig', 'white-out', 'windbreak', 'flagship', 'pocket', 'open-frame']) { await p.load(id); diff(id); await p.select('gpu'); diff('select ' + id); await p.set({ power: true }); diff('powered ' + id); }
    await p.load('night-rig'); await p.set({ power: true });
    for (const m of ['showcase', 'exploded', 'build']) { await p.mode(m); await wait(1500); diff('mode ' + m); }
    await p.hold('gpu', 'apex2x', 0); diff('held'); await p.open('none');
    await p.set({ airflow: true }); await wait(1000); diff('airflow'); await p.set({ airflow: false });
    await anim({ type: 'swap', category: 'gpu', id: 'mini' }, 'animated swap gpu');
    await anim({ type: 'remove', category: 'gpu' }, 'animated remove gpu');
    await anim({ type: 'swap', category: 'cooler', id: 'pillar' }, 'animated swap cooler');
    await anim({ type: 'swap', category: 'case', id: 'atrium' }, 'animated swap case');
    await anim({ type: 'finish', finish: 'frost' }, 'animated finish');
    await anim({ type: 'install', category: 'cables', id: 'ember' }, 'cable sweep');
    await anim({ type: 'clearFans' }, 'animated clear fans');
    await anim({ type: 'fillFans', id: 'gale' }, 'animated fill fans');
    for (const id of ['aurora', 'ember', 'ice', 'spectrum', 'vapor', 'reactor', 'starfield', 'thermal', 'blackout']) { await p.act({ type: 'lightingPreset', id }); await wait(400); diff('lighting ' + id); }
    await anim({ type: 'undo' }, 'undo');
    await p.set({ power: false }); await wait(1500); diff('power off');
    await p.set({ power: true }); await wait(2500); diff('power on');
    await p.empty(); diff('empty bench');
    return { res, born };
  });
  console.log(JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));
} finally {
  preview.stop();
  await browser.close();
}
if (errors.length) console.log(errors.join('\n'));
