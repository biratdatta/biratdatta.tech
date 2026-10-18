# biratdatta.tech

Birat's scrapbook portfolio: a plain static site (no build step) plus one Cloudflare Pages Function for the guestbook.

```
public/            everything that gets served
  index.html       the whole site (CSS + JS inline)
  media/           photos + bowling clip
  favicon.svg, 404.html, robots.txt, sitemap.xml, _headers
functions/api/guestbook.js   GET / POST / DELETE notes (Cloudflare D1)
schema.sql         guestbook tables + the welcome note
wrangler.toml      Pages config + D1 binding
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
npm run dev                        # http://localhost:8788
```

## 3. Deploy

**Option A — from your terminal**

```bash
npm run deploy                     # first run creates the "biratdatta-tech" Pages project
npx wrangler pages secret put ADMIN_TOKEN --project-name biratdatta-tech
```

**Option B — from GitHub (auto-deploy on every push)**

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Build command: *(leave empty)*. Build output directory: `public`.
4. After the first deploy: Settings → Bindings → add **D1 database**, variable name `DB`, database `biratdatta-guestbook`.
5. Settings → Variables and Secrets → add secret `ADMIN_TOKEN`. Redeploy.

## 4. Point biratdatta.tech at it

Pages project → **Custom domains** → *Set up a custom domain* → `biratdatta.tech` (and `www.biratdatta.tech` if you want).
If the domain's DNS is already on Cloudflare it's one click. If not, add the domain to Cloudflare first and switch your registrar's nameservers to the two Cloudflare gives you (get.tech domains: Domain management → Nameservers).

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
