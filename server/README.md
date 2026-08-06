# Cho Gar Wing Chun — Member Backend

Express + SQLite backend for the member area. It serves the static site as well,
so one process runs everything. No native modules, no external database server:
storage uses Node's built-in `node:sqlite`, password hashing uses `node:crypto`
(scrypt).

Requires **Node.js 22.5 or newer** (developed on Node 26).

## Start

```bash
npm --prefix server install
npm --prefix server start
```

The site is then at <http://localhost:3000>. `npm --prefix server run dev`
restarts on file changes.

On the very first start an instructor account is created and its password is
printed to the console once. Write it down — only the hash is stored. To choose
the password yourself, set `CHOGAR_ADMIN_PASSWORD` before the first start.

## Configuration (environment variables)

**Nothing has to be configured.** Every value has a working default, so the app
runs on the live host with `SMTP_PASS` alone — the managed panel kept losing
entries, so the settings live in the code instead. Copy `.env.example` to `.env`
and start with `node --env-file=.env server.js` to override anything locally.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SMTP_PASS` | – | **The only one the live site needs.** Without it no mail is sent — messages go to the log |
| `PORT` | `3000` | Port of the web server |
| `NODE_ENV` | – | `production` makes the session cookie `Secure`, trusts the reverse proxy and moves the database to the home directory |
| `TRUST_PROXY_HOPS` | `1` | Number of proxies in front of the app (production only) |
| `SITE_URL` | `https://chogarkungfu.com` in production, else `http://localhost:3000` | Public address; password-reset links are built from it |
| `SMTP_HOST` | `smtp.hostinger.com` | SMTP server |
| `SMTP_PORT` | `465` | `465` uses TLS directly, anything else STARTTLS |
| `SMTP_USER` | `nils@chogarkungfu.com` | Mailbox used for sending |
| `MAIL_FROM` | `Cho Gar Wing Chun <SMTP_USER>` | Sender address |
| `CHOGAR_DATA_DIR` | `~/chogar-data` in production, else `server/data` | Folder holding the SQLite database — must stay outside the deployed folder |
| `CHOGAR_ADMIN_EMAIL` | `nils@chogarkungfu.com` | Instructor address; applied on **every** start, so it can be corrected |
| `CHOGAR_ADMIN_USER` | `instructor` | Username of the first instructor account |
| `CHOGAR_ADMIN_PASSWORD` | randomly generated | Password of the first instructor account |
| `CHOGAR_ADMIN_NAME` | `Sifu Nils Ring` | Display name |
| `CHOGAR_ADMIN_RESET_PASSWORD` | – | Emergency reset: sets a new instructor password on restart. **Remove it again afterwards** |

`CHOGAR_ADMIN_USER`, `_PASSWORD` and `_NAME` are only used on the *first* start —
afterwards the account lives in the database.

## E-mails

| Trigger | Recipient |
| --- | --- |
| New registration request | every instructor account |
| Request approved | the member |
| Request rejected | the member |
| Password reset requested | the member |

Without `SMTP_HOST` nothing is sent and the full message is printed to the
server console instead — useful for testing, and the flow keeps working either
way. A failing mail server never breaks the request that triggered it.

## Password reset

Members use `forgot-password.html`. The server answers identically whether or
not the account exists, so the page cannot be used to find out which addresses
are registered. Only approved accounts actually receive a link.

The link contains a 32-byte token, is valid for **one hour** and works **once**.
Only its SHA-256 hash is stored, so a stolen database cannot be used to take
over accounts. Redeeming it ends all open sessions of that member. Requesting a
new link invalidates the previous one.

## Change a password

```bash
node server/set-password.js instructor "new password"
```

All open sessions of that account are ended.

## Registration flow

1. A visitor fills in `register.html` → `POST /api/register` → the account is
   stored with status `pending`.
2. A pending account cannot sign in: `POST /api/login` answers `403` with
   `reason: "pending"`.
3. The instructor sees open requests in the member area and on
   `admin-approvals.html` and approves or rejects them.
4. Only after approval does login succeed.

Withdrawing an approval immediately ends every session of that member.

## API

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/register` | public | Submit a registration request |
| `POST` | `/api/login` | public | Sign in |
| `POST` | `/api/logout` | public | Sign out |
| `GET` | `/api/me` | signed in | Own profile |
| `POST` | `/api/password/forgot` | public | Body `{ "identifier": "username or e-mail" }`, always answers `200` |
| `POST` | `/api/password/reset` | public | Body `{ "token": "…", "password": "…" }` |
| `GET` | `/api/admin/requests?status=` | instructor | List requests (`pending`, `approved`, `rejected`, `all`) |
| `POST` | `/api/admin/requests/:username/status` | instructor | Body `{ "status": "approved" \| "rejected" }` |
| `DELETE` | `/api/admin/requests/:username` | instructor | Delete a request permanently |

## Security notes

- Passwords are stored as scrypt hashes (N=16384, r=8, p=1, 64-byte key, random
  16-byte salt). No plain-text password is ever written to disk.
- The session lives in an `httpOnly`, `SameSite=Lax` cookie and is valid for
  7 days; the token itself is 32 random bytes stored server-side.
- Mutating API requests must be `Content-Type: application/json`. Together with
  `SameSite=Lax` this blocks cross-site form submissions (CSRF).
- Failed logins are throttled: 8 attempts per IP and username per 15 minutes.
  Password-reset requests are throttled the same way, per IP.
- The `/server` folder — database and source — is never served over HTTP.
- The site loads no third-party resources: GSAP lives in `js/vendor/` and the
  webfonts in `css/fonts/`, so no request ever reaches Google or a CDN.

### Running live

The site is deployed on Hostinger — setup, pitfalls and how to check it are in
[DEPLOY.md](DEPLOY.md).

- Set `SMTP_PASS`, otherwise nobody is notified of anything.
- Run behind HTTPS with `NODE_ENV=production`, otherwise the session cookie is
  sent without the `Secure` flag. The server warns in the log while that is the
  case. Hostinger sets the variable itself.
- Back up the database regularly — `~/chogar-data/chogar.db` in production. It
  holds all member data.
- Change the instructor password from the generated one. With shell access:
  `node server/set-password.js instructor "…"`. On a managed host without one,
  use `CHOGAR_ADMIN_RESET_PASSWORD` and remove the variable afterwards.
