# biratdatta.tech

Birat's scrapbook portfolio: a plain static site (no build step) served by one Cloudflare Worker, which also runs the guestbook API.

```
worker.js          Worker entry: /api/guestbook → API, everything else → public/
public/            everything that gets served
  index.html       the whole site (CSS + JS inline)
  media/           photos + bowling clip
  favicon.svg, 404.html, robots.txt, sitemap.xml, _headers
functions/api/guestbook.js   GET / POST / DELETE notes (Cloudflare D1)
functions/api/visits.js      live visitor counter (Cloudflare D1)
functions/api/posts.js       your Medium articles (RSS, cached 30 min)
public/writing/    the /writing page: all articles + a reader view
schema.sql         guestbook tables + the welcome note
wrangler.toml      Worker config (assets + D1 binding)
```

## 1. One-time setup

```bash
npm install
npx wrangler login
npx wrangler d1 create biratdatta-guestbook   # copy the database_id it prints
```

Paste that id into `wrangler.toml` (`database_id = ...`), then create the tables:

```bash
npm run db:init
```

## 2. Run it locally

```bash
cp .dev.vars.example .dev.vars    # set your own ADMIN_TOKEN
npm run db:init:local
npm run dev                        # http://localhost:8787
```

## 3. Deploy (Cloudflare Workers)

The site runs as one Cloudflare Worker: `public/` is served as static assets and `worker.js` handles `/api/guestbook`.

**From GitHub (auto-deploy on every push):** Workers & Pages → Create → Import a repository → pick this repo.
Build command: *(empty)*. Deploy command: `npx wrangler deploy`. The D1 binding comes from `wrangler.toml`.

**From your terminal:** `npm run deploy`

Then set the moderation password: Worker → Settings → Variables and Secrets → Add → type **Secret**, name `ADMIN_TOKEN`
(or `npx wrangler secret put ADMIN_TOKEN`).

## 4. Point biratdatta.tech at it

Worker → Settings → **Domains & Routes** → Add → **Custom domain** → `biratdatta.tech` (and `www.biratdatta.tech` if you want).
The domain is already on Cloudflare, so DNS and HTTPS are set up for you.

## Moderating the guestbook

Open https://biratdatta.tech, open the browser console and run:

```js
localStorage.setItem("bd-admin", "YOUR_ADMIN_TOKEN"); location.reload();
```

A ✕ appears on every note; click to delete. Run `localStorage.removeItem("bd-admin")` to turn it off.

## Editing content

Everything lives in `public/index.html`:

- Projects: the `P=[...]` array in the script near the bottom.
- Work history: the `X=[...]` array.
- Field notes: the three `.fn` cards in the "NOTES FROM THE FIELD" section (link to your latest posts).
- Photos: drop files in `public/media/` and update the `<img src>` paths.
- Stats, toolbox, "right now", links: the `N`, `T`, `NOW`, `E` arrays.
