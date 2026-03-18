export const dynamic = 'force-dynamic';

const SCALAR_VERSION = '1.49.1';

export async function GET() {
  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Financial Martec API Reference</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(217, 119, 6, 0.18), transparent 24%),
          radial-gradient(circle at top right, rgba(8, 76, 97, 0.16), transparent 28%),
          linear-gradient(180deg, #f7f1e6 0%, #efe8dc 100%);
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/docs/openapi',
        proxyUrl: 'https://proxy.scalar.com',
      })
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
