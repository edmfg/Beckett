// Beckett auth gate — Edge Middleware
// Redirects unauthenticated visitors to /gate.html. Allows static assets,
// the gate page itself, and /api/auth to pass through without a cookie.

export const config = {
  matcher: '/((?!gate|api/|assets/|images/|favicon|_vercel/|robots\\.txt).*)',
};

export default function middleware(req) {
  const cookie = req.headers.get('cookie') || '';
  if (/(?:^|;\s*)beckett_auth=1(?:;|$)/.test(cookie)) {
    return; // authenticated — let it through
  }
  // redirect to the cleanUrl form (Vercel cleanUrls:true rewrites /gate.html -> /gate)
  const url = new URL(req.url);
  url.pathname = '/gate';
  url.search = '';
  return Response.redirect(url, 307);
}
