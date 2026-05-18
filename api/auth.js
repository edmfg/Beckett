// POST /api/auth — verify password against GATE_PASSWORD env var.
// On success: set HttpOnly cookie and redirect to /. On failure: bounce back
// to /gate?e=1. Cookie value is the password itself so rotating
// GATE_PASSWORD invalidates every active session.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method not allowed');
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  const params = new URLSearchParams(body);
  const password = params.get('password') || '';

  const expected = process.env.GATE_PASSWORD || '';
  if (!expected) {
    res.statusCode = 500;
    return res.end('GATE_PASSWORD not configured');
  }

  if (password === expected) {
    const value = encodeURIComponent(password);
    res.setHeader(
      'Set-Cookie',
      `beckett_gate=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  res.statusCode = 302;
  res.setHeader('Location', '/gate?e=1');
  return res.end();
}
