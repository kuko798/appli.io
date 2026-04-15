/**
 * Appli.io Cloudflare Worker
 *
 * Proxies API routes to the backend VM, then falls through to static assets.
 * Deploy: npx wrangler deploy
 *
 * Configure backend URL:
 *   wrangler.toml [vars] BACKEND_CLASSIFIER_URL  — for plain values
 *   wrangler secret put BACKEND_CLASSIFIER_URL    — for secrets (preferred)
 */

const PROXY_ROUTES = [
  { prefix: '/appli-classifier', envKey: 'BACKEND_CLASSIFIER_URL', defaultTarget: 'http://34.122.146.119:8765' },
  { prefix: '/appli-llm',        envKey: 'BACKEND_LLM_URL',        defaultTarget: null },
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Check if this request matches a proxy route
    for (const route of PROXY_ROUTES) {
      if (!url.pathname.startsWith(route.prefix)) continue;

      const target = (env[route.envKey] ?? route.defaultTarget ?? '').replace(/\/$/, '');
      if (!target) continue; // no target configured — skip, fall through to assets

      // Strip the route prefix so /appli-classifier/classify → /classify
      const stripped = url.pathname.slice(route.prefix.length) || '/';
      const targetUrl = `${target}${stripped}${url.search}`;

      try {
        const proxied = await fetch(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'follow',
        });

        const headers = new Headers(proxied.headers);
        Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));

        return new Response(proxied.body, { status: proxied.status, headers });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: 'Backend unreachable', detail: err.message }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
        );
      }
    }

    // Not an API route — serve static assets (Workers handles this automatically via [assets])
    return env.ASSETS.fetch(request);
  },
};
