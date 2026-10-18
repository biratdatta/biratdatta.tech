// Cloudflare Worker entry: /api/guestbook goes to the guestbook API, everything else is a static file from public/.
import { onRequestGet, onRequestPost, onRequestDelete } from "./functions/api/guestbook.js";

const ROUTES = { GET: onRequestGet, POST: onRequestPost, DELETE: onRequestDelete };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/guestbook") {
      const handler = ROUTES[request.method];
      if (!handler) return new Response("Method not allowed", { status: 405, headers: { allow: "GET, POST, DELETE" } });
      try {
        return await handler({ request, env, ctx });
      } catch (err) {
        return new Response(JSON.stringify({ error: "server error" }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
    if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
