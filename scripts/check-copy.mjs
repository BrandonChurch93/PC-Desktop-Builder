// Scans every text file under src/ and public/, plus index.html, for copy and brand rule breaks.
//
//   node scripts/check-copy.mjs
//
// Fails on: an em dash; pure black or white as a whole hex color (the catalog's lighting stops are light, not
// surfaces, and are exempt); a real hardware maker's name as a whole word; an AI product or company name, or the
// word AI outside the About copy; the literal product name outside the catalog, index.html and tests/.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOTS = ['src', 'public'];
const EXTRA = ['index.html'];
const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.json', '.svg', '.txt', '.md', '.webmanifest']);

// Real hardware makers across cases, boards, processors, graphics, memory, storage, power and cooling.
// Matched as whole words with the capitalization the maker uses. Entries that collide with a catalog name are removed
// (none did when this list was written: the catalog names were checked against it by the self check below).
const MAKERS = [
  'Corsair', 'NZXT', 'Lian Li', 'Fractal Design', 'Phanteks', 'Cooler Master', 'Thermaltake', 'be quiet', 'SilverStone', 'Silverstone',
  'Antec', 'HYTE', 'Montech', 'Jonsbo', 'Streacom', 'Cougar', 'BitFenix', 'Zalman', 'In Win', 'InWin', 'Deepcool', 'DeepCool', 'Sama',
  'ASUS', 'Asus', 'ROG', 'MSI', 'Gigabyte', 'GIGABYTE', 'AORUS', 'ASRock', 'Biostar', 'EVGA', 'Supermicro',
  'Intel', 'AMD', 'Ryzen', 'Threadripper', 'Radeon', 'NVIDIA', 'Nvidia', 'GeForce', 'Qualcomm', 'Snapdragon',
  'Zotac', 'ZOTAC', 'Sapphire', 'PowerColor', 'XFX', 'PNY', 'Palit', 'Gainward', 'Inno3D', 'Galax', 'KFA2', 'Colorful', 'Matrox',
  'Kingston', 'HyperX', 'G.Skill', 'GSkill', 'Crucial', 'TeamGroup', 'Team Group', 'T-Force', 'Patriot', 'ADATA', 'XPG', 'Lexar', 'Netac',
  'Samsung', 'Western Digital', 'WD_Black', 'Seagate', 'Toshiba', 'Kioxia', 'KIOXIA', 'Sabrent', 'SK hynix', 'Hynix', 'Micron', 'Solidigm', 'Inland',
  'Seasonic', 'Super Flower', 'FSP', 'Enermax', 'Chieftec', 'Cooler Master', 'Thermalright', 'Noctua', 'Arctic', 'ARCTIC', 'Scythe',
  'EKWB', 'EK-Quantum', 'Alphacool', 'Lian-Li', 'Razer', 'Alienware', 'Dell', 'Lenovo', 'Apple', 'Raijintek', 'ID-Cooling', 'Gamdias',
];

const AI_NAMES = [
  'OpenAI', 'ChatGPT', 'GPT', 'Claude', 'Anthropic', 'Gemini', 'Bard', 'Copilot', 'Midjourney', 'DALL-E', 'DALL·E', 'Stable Diffusion',
  'Stability AI', 'Mistral', 'Llama', 'LLaMA', 'Perplexity', 'Cohere', 'Hugging Face', 'HuggingFace', 'DeepMind', 'xAI', 'Grok',
  'Character.AI', 'Runway', 'DeepSeek', 'Qwen',
];

const ABOUT_TAIL = 'No accounts, no tracking, no AI.';
const PRODUCT = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8')).constants.productName;

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return fs.statSync(p).isDirectory() ? files(p) : [p];
  });
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (s) => new RegExp(`(?<![A-Za-z0-9_])${escape(s)}(?![A-Za-z0-9_])`);

// Self check: no maker or AI entry may flag a catalog name. A flagged catalog name means the entry is wrong for this purpose.
const catalog = JSON.parse(fs.readFileSync('kit/data/catalog.json', 'utf8'));
const catalogNames = [
  ...catalog.brands.map((b) => b.name),
  ...['cases', 'boards', 'cpus', 'coolers', 'ram', 'gpus', 'storage', 'psus', 'fans', 'cables'].flatMap((k) => catalog[k].map((p) => p.name)),
  ...catalog.presets.map((p) => p.name), ...catalog.lighting.presets.map((p) => p.name), ...catalog.platforms.map((p) => p.name),
];
const makers = MAKERS.filter((m) => !catalogNames.some((n) => word(m).test(n)));
const aiNames = AI_NAMES.filter((m) => !catalogNames.some((n) => word(m).test(n)));
const droppedEntries = [...MAKERS, ...AI_NAMES].filter((m) => !makers.includes(m) && !aiNames.includes(m));
if (droppedEntries.length) console.log(`list entries that collide with catalog names and were removed: ${droppedEntries.join(', ')}`);
const distinct = new Set(makers.map((m) => m.toLowerCase().replace(/[^a-z0-9]/g, '')));

const problems = [];
const list = [...ROOTS.flatMap(files), ...EXTRA.filter((f) => fs.existsSync(f))].filter((f) => TEXT.has(path.extname(f).toLowerCase()));

for (const file of list) {
  const rel = file.split(path.sep).join('/');
  let text = fs.readFileSync(file, 'utf8');
  const isCatalog = rel === 'src/data/catalog.json';
  const lines = text.split('\n');
  const where = (index) => {
    let n = 0; let line = 0;
    for (; line < lines.length; line++) { n += lines[line].length + 1; if (n > index) break; }
    return `${rel}:${line + 1}`;
  };

  for (const m of text.matchAll(/—/g)) problems.push(`${where(m.index)}: em dash`);

  let colorText = text;
  if (isCatalog) {
    const data = JSON.parse(text);
    data.lighting = null;
    colorText = JSON.stringify(data, null, 1);
  }
  for (const m of colorText.matchAll(/#(?:000000|ffffff|000|fff)(?![0-9a-fA-F])/gi)) problems.push(`${isCatalog ? rel : where(m.index)}: pure black or white color ${m[0]}`);

  for (const m of makers) for (const hit of text.matchAll(new RegExp(word(m).source, 'g'))) problems.push(`${where(hit.index)}: real maker name ${m}`);
  for (const m of aiNames) for (const hit of text.matchAll(new RegExp(word(m).source, 'g'))) problems.push(`${where(hit.index)}: AI product or company name ${m}`);

  const withoutAbout = text.split(ABOUT_TAIL).join(' '.repeat(ABOUT_TAIL.length));
  for (const hit of withoutAbout.matchAll(/(?<![A-Za-z0-9_])(AI|A\.I\.)(?![A-Za-z0-9_])/g)) problems.push(`${where(hit.index)}: the word AI outside the About copy`);

  if (!isCatalog && rel !== 'index.html') {
    for (const hit of text.matchAll(new RegExp(escape(PRODUCT), 'gi'))) problems.push(`${where(hit.index)}: the literal product name`);
  }
}

console.log(`check:copy · files scanned: ${list.length} · maker names: ${distinct.size} · AI names: ${aiNames.length} · problems: ${problems.length}`);
if (distinct.size < 40) { console.log('the maker list must hold at least 40 makers'); process.exit(1); }
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
