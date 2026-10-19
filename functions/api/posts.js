// /api/posts — your Medium articles, pulled from the RSS feed and cached for 30 minutes.
// GET /api/posts            -> { posts: [{ slug, title, link, date, tags, image, excerpt, mins }] }
// GET /api/posts?slug=xyz   -> { post: { ...same, html } }   (sanitised article body for the reader view)
const FEED = "https://medium.com/feed/@birat.datta26";
const TTL = 1800; // seconds

const json = (data, status = 200, maxAge = 300) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": `public, max-age=${maxAge}` },
  });

const cdata = (s) => (s || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
const pick = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? cdata(m[1]) : ""; };
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ");
const text = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// keep a small, safe set of tags; drop scripts, iframes, styles, event handlers and tracking pixels
const ALLOWED = new Set(["p", "h1", "h2", "h3", "h4", "figure", "figcaption", "img", "blockquote", "pre", "code", "ul", "ol", "li", "a", "strong", "em", "b", "i", "br", "hr"]);
function sanitize(html) {
  html = html.replace(/<(script|style|iframe|noscript|object|embed|form)[\s\S]*?<\/\1>/gi, "");
  return html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (all, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!ALLOWED.has(tag)) return "";
    if (all.startsWith("</")) return `</${tag}>`;
    if (tag === "h1" || tag === "h2") tag = "h3";
    if (tag === "a") {
      const href = (attrs.match(/href="([^"]*)"/i) || [])[1] || "";
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${href}" target="_blank" rel="noopener">` : "<a>";
    }
    if (tag === "img") {
      const src = (attrs.match(/src="([^"]*)"/i) || [])[1] || "";
      const alt = (attrs.match(/alt="([^"]*)"/i) || [])[1] || "";
      if (!/^https:\/\//i.test(src) || /\/_\/stat|medium\.com\/_\//.test(src)) return "";
      return `<img src="${src}" alt="${alt.replace(/"/g, "&quot;")}" loading="lazy">`;
    }
    return tag === "br" || tag === "hr" ? `<${tag}>` : `<${tag}>`;
  });
}

function parse(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const link = pick(it, "link").split("?")[0];
    const html = pick(it, "content:encoded");
    const slug = (link.split("/").pop() || "").replace(/-[0-9a-f]{8,}$/, "") || pick(it, "guid").split("/").pop();
    const img = (html.match(/<img[^>]+src="(https:[^"]+)"/) || [])[1] || "";
    // first real paragraph (skip short bylines like "Oct 18, 2026 · @Birat Datta")
    const firstP = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]).find((p) => text(p).length > 60 && !/^\w{3} \d{1,2}, \d{4} ·/.test(text(p))) || "";
    const words = text(html).split(" ").length;
    return {
      slug,
      title: decode(pick(it, "title")),
      link,
      date: new Date(pick(it, "pubDate")).toISOString(),
      tags: [...it.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => cdata(m[1])),
      image: /\/_\/stat/.test(img) ? "" : img,
      excerpt: text(firstP).slice(0, 220),
      mins: Math.max(1, Math.round(words / 230)),
      html,
    };
  });
}

async function loadPosts(ctx) {
  const cache = caches.default;
  const key = new Request("https://cache.biratdatta.tech/medium-feed-v1");
  let res = await cache.match(key);
  if (!res) {
    const up = await fetch(FEED, { headers: { "user-agent": "biratdatta.tech feed reader" }, cf: { cacheTtl: TTL, cacheEverything: true } });
    if (!up.ok) throw new Error("feed " + up.status);
    res = new Response(await up.text(), { headers: { "cache-control": `public, max-age=${TTL}` } });
    const put = cache.put(key, res.clone());
    if (ctx && ctx.waitUntil) ctx.waitUntil(put); else await put;
  }
  return parse(await res.text());
}

export async function onRequestGet({ request, ctx }) {
  let posts;
  try { posts = await loadPosts(ctx); } catch (e) { return json({ error: "Couldn't reach Medium right now." }, 502, 0); }
  const slug = new URL(request.url).searchParams.get("slug");
  if (slug) {
    const p = posts.find((x) => x.slug === slug);
    if (!p) return json({ error: "not found" }, 404, 60);
    return json({ post: { ...p, html: sanitize(p.html) } });
  }
  return json({ posts: posts.map(({ html, ...p }) => p) });
}
