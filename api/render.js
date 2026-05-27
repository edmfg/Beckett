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
  'this-is-fine':   { name: 'This Is Fine',         brief: 'the "This Is Fine" cartoon-dog webcomic — a small round smiling cartoon dog with a hat sitting at a tiny table holding a coffee cup, vacant smile, while flames engulf the entire room. Soft flat-color line-art illustration style.' },
  'disaster-girl':  { name: 'Disaster Girl',        brief: 'the 2004 "Disaster Girl" photo meme — a young girl in the immediate foreground looking back over her shoulder at the camera with a smug knowing smirk, a building burning dramatically in the daytime background behind her.' },
  'side-eye-chloe': { name: 'Side-Eye Chloe',       brief: 'the "Side-Eye Chloe" meme — a young blonde toddler seated in a car seat giving an extreme skeptical sideways glance directly at the camera, one eyebrow slightly raised, lips pursed in suspicion.' },
  'success-kid':    { name: 'Success Kid',          brief: 'the "Success Kid" meme — a toddler on a sunny beach with a clenched fist of triumph raised in front of his chest, holding a handful of wet sand, confident victorious expression. Beach background with blurred ocean.' },
  'harold':         { name: 'Hide the Pain Harold', brief: 'the "Hide the Pain Harold" stock-photo meme — an older bald man with grey hair on the sides wearing a button-up shirt, giving a tight forced smile while his eyes betray visible inner suffering. Plain stock-photo lighting.' },
  'doge':           { name: 'Doge',                 brief: 'the classic "Doge" meme — a Shiba Inu dog photographed from above looking up sideways at the camera with eyebrows raised in a judgmental expression. Multicolored Comic Sans phrases like "such wow", "very much", "so touchdown" floating at jaunty angles around the dog.' },
};

let FRIEND_B64 = null;
const MEME_CACHE = {}; // memeId -> base64

async function loadFromUrl(req, pathPart) {
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const url   = `${proto}://${host}${pathPart}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch failed (${r.status}) at ${url}`);
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}
async function loadFriend(req) {
  if (!FRIEND_B64) FRIEND_B64 = await loadFromUrl(req, '/images/friend.jpg');
  return FRIEND_B64;
}
async function loadMemeRef(req, memeId) {
  if (!MEME_CACHE[memeId]) MEME_CACHE[memeId] = await loadFromUrl(req, `/images/memes/${memeId}.jpg`);
  return MEME_CACHE[memeId];
}

function buildPrompt(moment, meme, direction) {
  const lines = [
    `Generate a single 16:9 image — a meme version of a College Football moment.`,
    ``,
    `Two reference images are attached:`,
    `  1) FRIEND PHOTO — a young white man with brown hair. His face and identity MUST be clearly recognizable in the output as the same person.`,
    `  2) MEME TEMPLATE — ${meme.brief} The output MUST be visually recognizable as this exact meme template. Preserve the meme's signature composition, framing, art style, and core iconography. Replace any face in the meme with the FRIEND's face.`,
    ``,
    `WARDROBE: The friend is a Tennessee Volunteers fan — dress him in Tennessee orange (#FF8200), whatever garment fits the meme (jersey, hoodie, sweater, shirt).`,
    ``,
    `FOOTBALL CONTEXT: ${moment.beat}. Layer subtle Tennessee-vs-Alabama Saturday football references into the meme's background — orange checkerboard endzone visible in the distance, a Bryant-Denny stadium silhouette, a Tennessee T logo, an Alabama A logo on something Tennessee is beating, crowd in orange, etc. The football context should ENHANCE the meme, not replace it. The meme must remain the dominant visual.`,
    ``,
    `STYLE: Match the meme template's native art style exactly (cartoon for This Is Fine and Doge; photographic for Disaster Girl, Chloe, Success Kid, Harold). Sharp, slightly oversaturated, social-share ready. No watermarks, no extra faces.`,
    ``,
    `TEXT: Include the meme's signature caption text in its signature font, adapted to the football moment (e.g. "This is fine" stays as-is in a burning Alabama room; "such fumble. very Vols. wow." for Doge; etc.). Keep text minimal and meme-authentic.`,
  ];
  if (direction && direction.trim()) {
    lines.push('', `ADDITIONAL DIRECTION FROM USER: ${direction.trim().slice(0, 500)}`);
  }
  return lines.join('\n');
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
    const { moment: mId, meme: mmId, direction } = req.query || {};
    const moment = MOMENTS[mId];
    const meme   = MEMES[mmId];
    if (!moment || !meme) {
      return res.status(400).json({ error: 'invalid moment or meme', got: { moment: mId, meme: mmId } });
    }

    const key = process.env.GEMINI_KEY;
    if (!key) return res.status(500).json({ error: 'GEMINI_KEY env var not set' });

    const [friendB64, memeB64] = await Promise.all([loadFriend(req), loadMemeRef(req, mmId)]);
    const prompt = buildPrompt(moment, meme, direction);
    const img    = await callGemini(key, friendB64, memeB64, prompt);

    // custom direction renders shouldn't be cached (each is unique)
    const cache = (direction && direction.trim())
      ? 'no-store'
      : 'public, max-age=86400, s-maxage=86400';
    res.setHeader('cache-control', cache);
    return res.status(200).json({
      image: `data:${img.mime};base64,${img.data}`,
      combo: `${mId}|${mmId}`,
      direction: direction || null,
    });
  } catch (e) {
    console.error('[beckett/render]', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
};

module.exports.config = { maxDuration: 60 };
