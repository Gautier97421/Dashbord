import { NextResponse } from 'next/server';

/**
 * Trello returns the token in the URL fragment (#token=...), which only the
 * browser can read. This tiny HTML bridge extracts it and forwards it to the
 * server save endpoint.
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Connexion Trello…</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:3rem">
<p>Connexion à Trello en cours…</p>
<script>
  (function () {
    var hash = window.location.hash || '';
    var params = new URLSearchParams(hash.replace(/^#/, ''));
    var token = params.get('token');
    if (token) {
      window.location.replace('/api/trello/auth/save?token=' + encodeURIComponent(token));
    } else {
      window.location.replace('/?service_error=trello_no_token');
    }
  })();
</script>
</body></html>`;
  return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
