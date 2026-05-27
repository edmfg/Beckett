#!/usr/bin/env node
// Beckett fan-out — generate all 48 combos via the deployed /api/render endpoint.
// Used when GEMINI_KEY is encrypted on Vercel (not pullable locally).
// Usage: node scripts/fanout.js [BASE_URL] [--force]

const fs   = require('fs');
const path = require('path');

const MOMENTS = ['fumble','pick-six','interception','strip-sack','punt-td','kick-td','turnover-dn','close-game'];
const MEMES   = ['this-is-fine','disaster-girl','side-eye-chloe','success-kid','harold','doge','stonks','roll-safe','two-buttons','expanding-brain','crying-cat','monkey-puppet'];

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const base  = (args.find(a => !a.startsWith('--')) || 'https://beckett-psi.vercel.app').replace(/\/$/, '');
  const outDir = path.resolve(__dirname, '..', 'images', 'ads');
  fs.mkdirSync(outDir, { recursive: true });

  const combos = [];
  for (const m of MOMENTS) for (const mm of MEMES) combos.push({ moment: m, meme: mm });
  console.log(`base: ${base}`);
  console.log(`combos: ${combos.length} · force=${force} · concurrency=3`);

  const tStart = Date.now();
  let done = 0, ok = 0, skip = 0, fail = 0;
  const errors = [];

  async function worker(combo) {
    const tag = `${combo.moment}-${combo.meme}`;
    const outPath = path.join(outDir, `${tag}.jpg`);
    if (!force && fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) {
      skip++; done++; console.log(`  ⊘ ${tag} (exists, ${(fs.statSync(outPath).size/1024).toFixed(0)} KB)  [${done}/${combos.length}]`);
      return;
    }
    const t0 = Date.now();
    try {
      const url = `${base}/api/render?moment=${combo.moment}&meme=${combo.meme}`;
      const r = await fetch(url);
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const data = await r.json();
      if (!data.image) throw new Error('no image field');
      const b64 = data.image.split(',')[1];
      const buf = Buffer.from(b64, 'base64');
      fs.writeFileSync(outPath, buf);
      ok++; done++;
      console.log(`  ✓ ${tag} → ${(buf.length/1024).toFixed(0)} KB (${((Date.now()-t0)/1000).toFixed(1)}s)  [${done}/${combos.length}]`);
    } catch (e) {
      fail++; done++;
      errors.push({ tag, err: e.message });
      console.log(`  ✗ ${tag} — ${e.message}  [${done}/${combos.length}]`);
    }
  }

  // simple concurrency pool
  const LIMIT = 3;
  let i = 0;
  async function lane() {
    while (i < combos.length) {
      const my = combos[i++];
      await worker(my);
    }
  }
  await Promise.all(Array.from({ length: LIMIT }, lane));

  const elapsed = ((Date.now() - tStart)/1000).toFixed(1);
  console.log(`---\ndone in ${elapsed}s · ok=${ok} skip=${skip} fail=${fail}`);
  if (errors.length) {
    console.log('failures:');
    for (const e of errors) console.log(`  ${e.tag}: ${e.err}`);
  }
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
