// Beckett auth — validates the gate password and sets the cookie

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const expected = process.env.GATE_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'GATE_PASSWORD env var not set' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const provided = body?.password;
  if (!provided) return res.status(400).json({ error: 'no password' });

  if (provided !== expected) {
    return res.status(403).json({ error: 'incorrect password' });
  }

  // 30 days, HttpOnly + Secure + SameSite=Lax
  const maxAge = 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', `beckett_auth=1; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`);
  return res.status(200).json({ ok: true });
};
