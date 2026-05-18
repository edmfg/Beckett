// Vercel Edge Middleware — gates every page behind GATE_PASSWORD.
// /api/auth verifies the password and sets a cookie; middleware reads the
// cookie and compares it to process.env.GATE_PASSWORD. Rotating the env var
// invalidates all sessions.

export const config = {
  matcher: ['/((?!api/|assets/|favicon\\.ico).*)'],
};

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Pages always reachable without a password
  if (
    path === '/gate' ||
    path === '/gate.html' ||
    path.startsWith('/api/') ||
    path.startsWith('/assets/') ||
    path === '/favicon.ico'
  ) {
    return;
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)beckett_gate=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : '';

  const expected = process.env.GATE_PASSWORD || '';
  if (expected && token === expected) {
    return;
  }

  return Response.redirect(new URL('/gate', request.url), 307);
}
