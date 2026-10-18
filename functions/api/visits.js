// /api/visits — a simple live visitor counter on D1.
// GET  -> { count }
// POST -> counts this visitor once per day (by salted IP hash), returns { count }
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

let ready = false;
async function ensure(env) {
  if (ready) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS stats (k TEXT PRIMARY KEY, v INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS visit_seen (ip TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (ip, day))"),
    env.DB.prepare("INSERT OR IGNORE INTO stats (k, v) VALUES ('visits', 0)"),
  ]);
  ready = true;
}

async function ipHash(request) {
  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("bd-visit:" + ip));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function count(env) {
  const row = await env.DB.prepare("SELECT v FROM stats WHERE k = 'visits'").first();
  return row ? row.v : 0;
}

export async function onRequestGet({ env }) {
  await ensure(env);
  return json({ count: await count(env) });
}

export async function onRequestPost({ request, env }) {
  await ensure(env);
  const day = new Date().toISOString().slice(0, 10);
  const ip = await ipHash(request);
  const res = await env.DB.prepare("INSERT OR IGNORE INTO visit_seen (ip, day) VALUES (?, ?)").bind(ip, day).run();
  if (res && res.meta && res.meta.changes === 1) {
    await env.DB.prepare("UPDATE stats SET v = v + 1 WHERE k = 'visits'").run();
  }
  // tidy up old dedupe rows now and then
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    await env.DB.prepare("DELETE FROM visit_seen WHERE day < ?").bind(cutoff).run();
  }
  return json({ count: await count(env) });
}
