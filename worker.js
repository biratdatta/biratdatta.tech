// Cloudflare Worker entry: /api/* goes to the small APIs, everything else is a static file from public/.
import * as guestbook from "./functions/api/guestbook.js";
import * as visits from "./functions/api/visits.js";
import * as posts from "./functions/api/posts.js";

const API = {
  "/api/guestbook": { GET: guestbook.onRequestGet, POST: guestbook.onRequestPost, DELETE: guestbook.onRequestDelete },
  "/api/visits": { GET: visits.onRequestGet, POST: visits.onRequestPost },
  "/api/posts": { GET: posts.onRequestGet },
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = API[url.pathname];
    if (route) {
      const handler = route[request.method];
      if (!handler) return new Response("Method not allowed", { status: 405, headers: { allow: Object.keys(route).join(", ") } });
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
