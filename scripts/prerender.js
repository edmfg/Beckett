#!/usr/bin/env node
// Beckett pre-render — generate all (or filtered) moment×meme images via Gemini
// Usage:
//   node scripts/prerender.js                       # all 48 combos, skip existing
//   node scripts/prerender.js fumble disaster-girl  # single combo
//   node scripts/prerender.js --force               # regenerate even if file exists
//
// Requires GEMINI_KEY in env (load from /tmp/beckett.env via `set -a; source /tmp/beckett.env; set +a`).

const fs = require('fs');
const path = require('path');

const MOMENTS = {
  'fumble':       { name: 'Fumble Recovery',   beat: 'Tennessee recovers an Alabama fumble inside the red zone, the loose football skidding on the turf as a Vols defender dives on it' },
  'pick-six':     { name: 'Pick-Six',          beat: 'A Tennessee defensive back picks off the Alabama QB and returns it for a touchdown, sprinting toward the orange-and-white checkerboard endzone' },
  'interception': { name: 'Interception',      beat: 'Tennessee picks off Alabama on a deep ball, the DB landing with the football tucked tight, drive over' },
  'strip-sack':   { name: 'Strip Sack',        beat: 'Tennessee strips the Alabama quarterback in the pocket; the ball pops loose and a Vols lineman scoops it up' },
  'punt-td':      { name: 'Punt Return TD',    beat: 'A Tennessee returner takes an Alabama punt 80 yards back for a touchdown, breaking tackles down the sideline' },
  'kick-td':      { name: 'Kickoff Return TD', beat: 'Tennessee returns the opening kickoff for a touchdown, the returner high-stepping into the endzone' },
  'block-punt':   { name: 'Blocked Punt TD',   beat: 'Tennessee blocks an Alabama punt; the ball squirts backward into the endzone and a Vols special-teamer falls on it' },
  'turnover-dn':  { name: 'Turnover on Downs', beat: 'Tennessee stuffs Alabama on 4th-and-1 in Alabama territory; the Vols defense erupts off the pile' },
};

const MEMES = {
  'this-is-fine':   { name: 'This Is Fine',         brief: 'the "This Is Fine" cartoon-dog webcomic — a small round smiling cartoon dog with a hat sitting at a tiny table holding a coffee cup, vacant smile, while flames engulf the entire room. Soft flat-color line-art illustration style.' },
  'disaster-girl':  { name: 'Disaster Girl',        brief: 'the 2004 "Disaster Girl" photo meme — a young girl in the immediate foreground looking back over her shoulder at the camera with a smug knowing smirk, a building burning dramatically in the daytime background behind her.' },
  'side-eye-chloe': { name: 'Side-Eye Chloe',       brief: 'the "Side-Eye Chloe" meme — a young blonde toddler seated in a car seat giving an extreme skeptical sideways glance directly at the camera, one eyebrow slightly raised, lips pursed in suspicion.' },
  'success-kid':    { name: 'Success Kid',          brief: 'the "Success Kid" meme — a toddler on a sunny beach with a clenched fist of triumph raised in front of his chest, holding a handful of wet sand, confident victorious expression. Beach background with blurred ocean.' },
  'harold':         { name: 'Hide the Pain Harold', brief: 'the "Hide the Pain Harold" stock-photo meme — an older bald man with grey hair on the sides wearing a button-up shirt, giving a tight forced smile while his eyes betray visible inner suffering. Plain stock-photo lighting.' },
  'doge':           { name: 'Doge',                 brief: 'the classic "Doge" meme — a Shiba Inu dog photographed from above looking up sideways at the camera with eyebrows raised in a judgmental expression. Multicolored Comic Sans phrases like "such wow", "very much", "so touchdown" floating at jaunty angles around the dog.' },
};

function buildPrompt(moment, meme) {
  return [
    `Generate a single 16:9 image — a meme version of a College Football moment.`,
    ``,
    `Two reference images are attached:`,
    `  1) FRIEND PHOTO — a young white man with brown hair. His face and identity MUST be clearly recognizable in the output as the same person.`,
    `  2) MEME TEMPLATE — ${meme.brief} The output MUST be visually recognizable as this exact meme template. Preserve the meme's signature composition, framing, art style, and core iconography. Replace any face in the meme with the FRIEND's face.`,
    ``,
    `WARDROBE: The friend is a Tennessee Volunteers fan — dress him in Tennessee orange (#FF8200), whatever garment fits the meme.`,
    ``,
    `FOOTBALL CONTEXT: ${moment.beat}. Layer subtle Tennessee-vs-Alabama Saturday football references into the meme's background — orange checkerboard endzone visible in the distance, a Bryant-Denny stadium silhouette, a Tennessee T logo, an Alabama A logo on something Tennessee is beating, crowd in orange, etc. The football context should ENHANCE the meme, not replace it. The meme must remain the dominant visual.`,
    ``,
    `STYLE: Match the meme template's native art style exactly (cartoon for This Is Fine and Doge; photographic for Disaster Girl, Chloe, Success Kid, Harold). Sharp, slightly oversaturated. No watermarks, no extra faces.`,
    ``,
    `TEXT: Include the meme's signature caption text in its signature font, adapted to the football moment (e.g. "This is fine" stays as-is in a burning Alabama room; "such fumble. very Vols. wow." for Doge; etc.). Keep text minimal and meme-authentic.`,
  ].join('\n');
}

async function callGemini(key, friendB64, memeB64, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: friendB64 } },
        { inline_data: { mime_type: 'image/jpeg', data: memeB64 } },
      ],
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    const err = new Error(`gemini ${r.status}: ${txt.slice(0, 800)}`);
    err.status = r.status;
    err.detail = txt;
    throw err;
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inline_data || p.inlineData);
  const inline  = imgPart?.inline_data || imgPart?.inlineData;
  if (!inline?.data) {
    throw new Error('no image in response: ' + JSON.stringify(data).slice(0, 800));
  }
  return Buffer.from(inline.data, 'base64');
}

async function renderOne(key, friendB64, memeRefs, momentId, memeId, outDir, force) {
  const outPath = path.join(outDir, `${momentId}-${memeId}.jpg`);
  if (!force && fs.existsSync(outPath)) {
    return { skipped: true, path: outPath };
  }
  const moment = MOMENTS[momentId];
  const meme   = MEMES[memeId];
  if (!moment || !meme) throw new Error(`unknown combo ${momentId}|${memeId}`);
  const memeB64 = memeRefs[memeId];
  if (!memeB64) throw new Error(`no meme reference image for ${memeId}`);
  const prompt = buildPrompt(moment, meme);
  const t0 = Date.now();
  const buf = await callGemini(key, friendB64, memeB64, prompt);
  fs.writeFileSync(outPath, buf);
  return { skipped: false, path: outPath, bytes: buf.length, ms: Date.now() - t0 };
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (e) {
        results[i] = { ok: false, error: e };
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, lane));
  return results;
}

(async () => {
  const key = process.env.GEMINI_KEY;
  if (!key) { console.error('GEMINI_KEY not set in env'); process.exit(2); }

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const filtered = args.filter(a => !a.startsWith('--'));
  const outDir = path.resolve(__dirname, '..', 'images', 'ads');
  fs.mkdirSync(outDir, { recursive: true });

  const friendPath = path.resolve(__dirname, '..', 'images', 'friend.jpg');
  const friendB64 = fs.readFileSync(friendPath).toString('base64');
  console.log(`friend ref: ${friendPath} (${(fs.statSync(friendPath).size / 1024).toFixed(1)} KB)`);

  const memeDir = path.resolve(__dirname, '..', 'images', 'memes');
  const memeRefs = {};
  for (const mmId of Object.keys(MEMES)) {
    const p = path.join(memeDir, `${mmId}.jpg`);
    memeRefs[mmId] = fs.readFileSync(p).toString('base64');
  }
  console.log(`meme refs: ${Object.keys(memeRefs).length} templates loaded`);

  let combos;
  if (filtered.length === 2) {
    combos = [{ moment: filtered[0], meme: filtered[1] }];
  } else if (filtered.length === 0) {
    combos = [];
    for (const m of Object.keys(MOMENTS)) {
      for (const mm of Object.keys(MEMES)) {
        combos.push({ moment: m, meme: mm });
      }
    }
  } else {
    console.error('usage: prerender.js [<moment> <meme>] [--force]'); process.exit(2);
  }

  console.log(`rendering ${combos.length} combo(s) · force=${force} · model=gemini-3-pro-image-preview`);
  const tStart = Date.now();
  const results = await runWithConcurrency(combos, combos.length === 1 ? 1 : 4, async (combo) => {
    const tag = `${combo.moment}|${combo.meme}`;
    const r = await renderOne(key, friendB64, memeRefs, combo.moment, combo.meme, outDir, force);
    if (r.skipped) {
      console.log(`  ⊘ ${tag} (exists)`);
    } else {
      console.log(`  ✓ ${tag} → ${path.basename(r.path)} (${(r.bytes/1024).toFixed(0)} KB, ${r.ms}ms)`);
    }
    return r;
  });

  const ok      = results.filter(r => r.ok).length;
  const skipped = results.filter(r => r.ok && r.value.skipped).length;
  const failed  = results.filter(r => !r.ok);
  console.log(`---\ndone in ${((Date.now() - tStart)/1000).toFixed(1)}s · ok=${ok - skipped} skipped=${skipped} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) {
      console.error(`  ✗ ${(f.error && f.error.message) || f.error}`);
    }
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });
