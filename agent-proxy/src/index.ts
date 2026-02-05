/**
 * Proxy Worker for agent.fixr.nexus
 * - Root path redirects to fixr.nexus
 * - API paths proxy to fixr-agent.see21289.workers.dev
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Redirect root to main landing page
    if (url.pathname === '/' || url.pathname === '') {
      return Response.redirect('https://fixr.nexus', 302);
    }

    // Rewrite hostname to the actual worker
    url.hostname = 'fixr-agent.see21289.workers.dev'; // Internal worker hostname (proxied via agent.fixr.nexus)

    // Forward the request with all headers, method, body preserved
    const response = await fetch(new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    }));

    // Return response with CORS headers for flexibility
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
