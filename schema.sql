-- Guestbook tables for Cloudflare D1
CREATE TABLE IF NOT EXISTS notes (
  id      TEXT PRIMARY KEY,          -- visitor id (random, stored in their browser)
  name    TEXT NOT NULL,
  sticker TEXT NOT NULL,
  msg     TEXT NOT NULL,
  at      INTEGER NOT NULL,          -- ms since epoch
  ip      TEXT                       -- salted hash, for rate limiting only
);
CREATE INDEX IF NOT EXISTS notes_at ON notes (at DESC);
CREATE TABLE IF NOT EXISTS writes (ip TEXT PRIMARY KEY, at INTEGER NOT NULL);

INSERT OR IGNORE INTO notes (id, name, sticker, msg, at)
VALUES ('welcome', 'Birat', '★', 'Welcome to my scrapbook! Pin a note and say hi.', 1792304700000);

-- Visitor counter (also created automatically by /api/visits on first use)
CREATE TABLE IF NOT EXISTS stats (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS visit_seen (ip TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (ip, day));
INSERT OR IGNORE INTO stats (k, v) VALUES ('visits', 0);
