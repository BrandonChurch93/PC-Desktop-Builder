// Appends verdicts to kit/VERDICTS.jsonl, each stamped with the hash of the image it is about.
//
//   node scripts/verdict.mjs <shot> builder <PASS|FAIL> "<fail ids or ->" "<one sentence>"
//     One verdict of your own. Keep the sentence free of double quotes, backticks and dollar signs.
//
//   node scripts/verdict.mjs --from <file> --who builder
//     Your own verdicts from a text file, one per line: <shot> | PASS or FAIL | <fail ids or -> | <one sentence>
//
//   node scripts/verdict.mjs --from kit/critics/<number>.txt --who critic --critic <number>
//     A critic's answer, saved exactly as it came back. This is the only way a critic's verdict gets in.
//     Each line must carry the "sha:" cell the critic was given by scripts/critic-list.mjs, and that hash must
//     still be the hash of the image on disk. A line about an image that changed since is skipped.
//
// Lines in any other shape are skipped and counted. Do not change how this file stamps or accepts verdicts.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { LEDGER, fileOf, nameOf, parseLine, shaOfFile } from './shot-rules.mjs';
import { SHOTS } from './shot-list.mjs';

const USAGE = [
  'usage: node scripts/verdict.mjs <shot> builder <PASS|FAIL> "<fail ids or ->" "<one sentence>"',
  '   or: node scripts/verdict.mjs --from <file> --who builder',
  '   or: node scripts/verdict.mjs --from kit/critics/<number>.txt --who critic --critic <number>',
].join('\n');

function append(line) {
  fs.appendFileSync(LEDGER, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`);
  console.log(`${line.shot} · ${line.sha} · ${line.who} · ${line.result}`);
}

const argv = process.argv.slice(2);
if (argv.includes('--from')) {
  const value = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] || '' : '');
  const from = value('--from').replace(/^\.\//, ''); const who = value('--who'); const critic = value('--critic');
  if (!from || !['builder', 'critic'].includes(who) || !fs.existsSync(from)) { console.error(USAGE); process.exit(1); }
  if (who === 'critic' && (!/^\d{3}$/.test(critic) || from !== `kit/critics/${critic}.txt`)) {
    console.error('a critic answer is saved as kit/critics/<three digit number>.txt and imported with the same number in --critic');
    process.exit(1);
  }
  let recorded = 0; let skipped = 0;
  for (const raw of fs.readFileSync(from, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    const line = parseLine(raw);
    if (!line) { skipped++; continue; }
    const sha = shaOfFile(fileOf(line.name, SHOTS));
    if (!sha) { console.log(`skipped ${line.name}: no image on disk`); skipped++; continue; }
    if (who === 'critic' && line.sha !== sha) { console.log(`skipped ${line.name}: the line carries ${line.sha || 'no hash'} and the image on disk is ${sha}. List it again with scripts/critic-list.mjs and send it to a new critic`); skipped++; continue; }
    if (who === 'builder' && line.sha && line.sha !== sha) { console.log(`skipped ${line.name}: the image changed since this line was written`); skipped++; continue; }
    append({ shot: line.name, sha, who, result: line.result, ids: line.ids, note: line.note, reference: line.reference || undefined, critic: critic || undefined, source: who === 'critic' ? from : path.normalize(from) });
    recorded++;
  }
  console.log(`recorded: ${recorded} · skipped lines: ${skipped}`);
  process.exit(recorded > 0 ? 0 : 1);
}

const [shot, who, result, ids = '-', note = ''] = argv;
if (who === 'critic') { console.error('critic verdicts are imported with --from, from the answer saved under kit/critics/'); process.exit(1); }
if (!shot || who !== 'builder' || !['PASS', 'FAIL'].includes(result)) { console.error(USAGE); process.exit(1); }
const name = nameOf(shot);
const sha = shaOfFile(fileOf(name, SHOTS));
if (!sha) { console.error(`no image on disk for ${name}`); process.exit(1); }
append({ shot: name, sha, who, result, ids: ids.trim() === '-' || !ids.trim() ? [] : ids.split(/[\s,]+/).filter(Boolean), note: note.trim() });
