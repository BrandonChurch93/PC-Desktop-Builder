// Reads the JSON warm-check prints on stdin and lists what each preset and showcase build costs the warm-up.
//
//   node scripts/warm-check.mjs | node scripts/warm-presets.mjs
let text = '';
process.stdin.on('data', (c) => { text += c; }).on('end', () => {
  const out = JSON.parse(text.slice(text.indexOf('{')));
  const rows = {};
  for (const t of out.timings ?? []) {
    const m = /^(sync|total|compile preset|compile faded|compile held) (.+)$/.exec(t.label);
    if (!m) continue;
    (rows[m[2]] ??= {})[m[1]] = t.ms;
  }
  console.log(`warm-up ${out.warmDoneMs} ms, ${out.programsAtWarm} programs`);
  console.table(rows);
});
