# Cho Gar Wing Chun

Website of Cho Gar Wing Chun Germany — the official representation of the Cho
family Wing Chun lineage in Germany, based in Lollar.

The site is a static front end plus a small Node.js backend for the member area.
One process serves both, so there is nothing else to deploy.

## Contents

| Path | What it is |
| --- | --- |
| `*.html` | The pages: home, about, seminars, gallery, contact, imprint, privacy, plus login, registration and member area |
| `css/` | Stylesheet and self-hosted webfonts (Cinzel, Noto Sans) |
| `js/` | Front-end scripts; `js/vendor/` holds GSAP |
| `images/` | Logos and photos |
| `server/` | Express + SQLite backend — see [server/README.md](server/README.md) |

The site loads **no third-party resources**: fonts and scripts are served from
this repository, so no request ever reaches Google or a CDN.

## Running it locally

Requires Node.js 24 or newer (the backend uses the built-in `node:sqlite`).

```bash
npm --prefix server install
```

```bash
npm --prefix server start
```

The site is then at <http://localhost:3000>. `npm --prefix server run dev`
restarts on file changes.

On the very first start an instructor account is created and its password is
printed to the console once.

## Member area

Visitors register at `register.html`; the account stays `pending` until an
instructor approves it in the member area. Only then does login work. Passwords
are stored as scrypt hashes, sessions live in an `httpOnly` cookie. Details and
the full API are documented in [server/README.md](server/README.md).

## Deployment

The site runs at <https://chogarkungfu.com> as a Node.js web app on Hostinger and
redeploys itself on every push to `main`. How it is set up, what can go wrong and
how to check it: [server/DEPLOY.md](server/DEPLOY.md).

## Not in this repository

The member database (`server/data/`) and the configuration with the SMTP
credentials (`server/.env`) are deliberately excluded — they hold personal data
and secrets. `server/.env.example` documents every variable.
