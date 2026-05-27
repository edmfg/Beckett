// Beckett — live Gemini image render
// Model: Nano Banana Pro (gemini-3-pro-image-preview)
// Key:   GEMINI_KEY (Vercel env var)
// Friend reference photo: fetched once from /images/friend.jpg, cached per warm instance

const MOMENTS = {
  'fumble':       { name: 'Fumble Recovery',   beat: 'Tennessee recovers an Alabama fumble inside the red zone' },
  'pick-six':     { name: 'Pick-Six',          beat: 'A Tennessee defensive back picks off the Alabama QB and returns it for a touchdown' },
  'interception': { name: 'Interception',      beat: 'Tennessee picks off Alabama on a deep ball, drive over' },
  'strip-sack':   { name: 'Strip Sack',        beat: 'Tennessee strips the Alabama quarterback in the pocket and recovers the ball' },
  'punt-td':      { name: 'Punt Return TD',    beat: 'A Tennessee returner takes an Alabama punt back for a touchdown' },
  'kick-td':      { name: 'Kickoff Return TD', beat: 'Tennessee returns the opening kickoff for a touchdown' },
  'block-punt':   { name: 'Blocked Punt TD',   beat: 'Tennessee blocks an Alabama punt and recovers in the endzone' },
  'turnover-dn':  { name: 'Turnover on Downs', beat: 'Tennessee stops Alabama on 4th down in Alabama territory' },
};

const MEMES = {
  'this-is-fine':   { name: 'This Is Fine',         brief: 'the "This Is Fine" cartoon-dog meme — a smiling round cartoon dog sitting at a small table while flames engulf the room; soft webcomic style' },
  'disaster-girl':  { name: 'Disaster Girl',        brief: 'the "Disaster Girl" meme — a young girl in the foreground giving a smug knowing smirk at the camera while a building burns behind her' },
  'side-eye-chloe': { name: 'Side-Eye Chloe',       brief: 'the "Side-Eye Chloe" meme — a child giving a deeply skeptical sideways glance, eyebrow slightly raised' },
  'success-kid':    { name: 'Success Kid',          brief: 'the "Success Kid" meme — a toddler at the beach with a clenched fist of triumph, holding sand' },
  'harold':         { name: 'Hide the Pain Harold', brief: 'the "Hide the Pain Harold" meme — an older bald man with a strained forced smile and visibly sad knowing eyes' },
  'doge':           { name: 'Doge',                 brief: 'the classic "Doge" meme — a Shiba Inu with surrounding multicolored Comic Sans phrases like "such wow", "very much", "so football"' },
};

let FRIEND_B64 = null;
async function loadFriend(req) {
  if (FRIEND_B64) return FRIEND_B64;
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const url   = `${proto}://${host}/images/friend.jpg`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`friend photo fetch failed (${r.status}) at ${url} — save the reference photo to /images/friend.jpg`);
  const buf = Buffer.from(await r.arrayBuffer());
  FRIEND_B64 = buf.toString('base64');
  return FRIEND_B64;
}

function buildPrompt(moment, meme) {
  return [
    `Generate a single 16:9 image for a Live Contextual CTV ad spot.`,
    ``,
    `SUBJECT: Composite the person in the attached reference photo as the main figure of ${meme.brief}.`,
    `Preserve his face and identity — he must be clearly recognizable as the person in the reference photo.`,
    ``,
    `WARDROBE / COLORS: Dress him in Tennessee Volunteers orange (#FF8200) — appropriate to the meme format (jersey, hoodie, or shirt).`,
    ``,
    `CONTEXT: ${moment.beat}. The setting should evoke a college football Saturday — Bryant-Denny / SEC atmosphere, but with Tennessee winning the moment.`,
    ``,
    `STYLE: Sharp, slightly oversaturated. CFB broadcast graphic energy meets meme template. Social-share ready. No watermarks, no other faces, no logos beyond the Tennessee / Alabama context.`,
    ``,
    `TEXT: If the meme template includes signature text (e.g. "this is fine", "such wow"), render it in the meme's signature font style, integrated naturally into the composition.`,
  ].join('\n');
}

async function callGemini(key, friendB64, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'image/jpeg', data: friendB64 } },
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
    const err = new Error(`gemini ${r.status}: ${txt.slice(0, 400)}`);
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inline_data || p.inlineData);
  const inline  = imgPart?.inline_data || imgPart?.inlineData;
  if (!inline?.data) throw new Error('no image in gemini response: ' + JSON.stringify(data).slice(0, 400));
  return {
    mime: inline.mime_type || inline.mimeType || 'image/png',
    data: inline.data,
  };
}

module.exports = async function handler(req, res) {
  try {
    const { moment: mId, meme: mmId } = req.query || {};
    const moment = MOMENTS[mId];
    const meme   = MEMES[mmId];
    if (!moment || !meme) {
      return res.status(400).json({ error: 'invalid moment or meme', got: { moment: mId, meme: mmId } });
    }

    const key = process.env.GEMINI_KEY;
    if (!key) return res.status(500).json({ error: 'GEMINI_KEY env var not set' });

    const friendB64 = await loadFriend(req);
    const prompt    = buildPrompt(moment, meme);
    const img       = await callGemini(key, friendB64, prompt);

    res.setHeader('cache-control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).json({
      image: `data:${img.mime};base64,${img.data}`,
      combo: `${mId}|${mmId}`,
    });
  } catch (e) {
    console.error('[beckett/render]', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
};

module.exports.config = { maxDuration: 60 };
