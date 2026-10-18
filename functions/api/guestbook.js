// Cloudflare Pages Function: /api/guestbook
// GET    -> latest notes (marks the caller's own note via ?me=<visitor id>)
// POST   -> create/update the caller's note  {id, name, sticker, msg}
// DELETE -> remove a note (?id=...), needs header x-admin-token == env.ADMIN_TOKEN
const STICKERS = ["★", "♥", "✿", "☕", "🚀"];
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

async function ipHash(request) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("bd-salt:" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet({ request, env }) {
  const me = new URL(request.url).searchParams.get("me") || "";
  const { results } = await env.DB.prepare(
    "SELECT id, name, sticker, msg, at FROM notes ORDER BY at DESC LIMIT 80"
  ).all();
  // never expose visitor ids; only flag which note belongs to the caller
  const notes = results.map((r) => ({
    id: r.id === "welcome" ? "welcome" : "n-" + r.at,
    name: r.name, sticker: r.sticker, msg: r.msg, at: r.at,
    mine: !!me && r.id === me,
  }));
  return json({ notes });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  if (body.hp) return json({ ok: true }); // honeypot: pretend success for bots
  const id = clean(body.id, 64);
  const name = clean(body.name, 40) || "anonymous";
  const msg = clean(body.msg, 200);
  const sticker = STICKERS.includes(body.sticker) ? body.sticker : "★";
  if (!id || id === "welcome" || !/^[\w.-]+$/.test(id)) return json({ error: "bad id" }, 400);
  if (!msg) return json({ error: "empty note" }, 400);

  // simple rate limit: one write per IP every 20 seconds
  const ip = await ipHash(request);
  const now = Date.now();
  const last = await env.DB.prepare("SELECT at FROM writes WHERE ip = ?").bind(ip).first();
  if (last && now - last.at < 20000) return json({ error: "slow down" }, 429);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO writes (ip, at) VALUES (?, ?) ON CONFLICT(ip) DO UPDATE SET at = excluded.at").bind(ip, now),
    env.DB.prepare("INSERT INTO notes (id, name, sticker, msg, at, ip) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, sticker = excluded.sticker, msg = excluded.msg, at = excluded.at, ip = excluded.ip")
      .bind(id, name, sticker, msg, now, ip),
  ]);
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const tok = request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || tok !== env.ADMIN_TOKEN) return json({ error: "forbidden" }, 403);
  const pub = new URL(request.url).searchParams.get("id") || "";
  // public ids are "n-<timestamp>" or "welcome"; resolve by timestamp
  if (pub === "welcome") await env.DB.prepare("DELETE FROM notes WHERE id = 'welcome'").run();
  else {
    const at = Number(pub.split("-").pop());
    if (!at) return json({ error: "bad id" }, 400);
    await env.DB.prepare("DELETE FROM notes WHERE at = ?").bind(at).run();
  }
  return json({ ok: true });
}
