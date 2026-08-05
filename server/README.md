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

Copy `.env.example` to `.env` and start with `node --env-file=.env server.js`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port of the web server |
| `NODE_ENV` | – | Set to `production` on the live server: session cookie becomes `Secure`, and the reverse proxy's `X-Forwarded-For` is trusted |
| `TRUST_PROXY_HOPS` | `1` | Number of proxies in front of the app (production only) |
| `SITE_URL` | `http://localhost:3000` | Public address, used for links inside e-mails |
| `SMTP_HOST` | – | SMTP server. **Empty means no mail is sent** — messages are printed to the console |
| `SMTP_PORT` | `587` | `465` uses TLS directly, anything else STARTTLS |
| `SMTP_USER` / `SMTP_PASS` | – | SMTP credentials (omit for a relay without auth) |
| `MAIL_FROM` | `Cho Gar Wing Chun <no-reply@localhost>` | Sender address |
| `CHOGAR_DATA_DIR` | `server/data` | Folder holding the SQLite database |
| `CHOGAR_ADMIN_USER` | `instructor` | Username of the first instructor account |
| `CHOGAR_ADMIN_PASSWORD` | randomly generated | Password of the first instructor account |
| `CHOGAR_ADMIN_NAME` | `Sifu Nils Ring` | Display name |
| `CHOGAR_ADMIN_EMAIL` | `sifu@kungfu-spirit.de` | E-mail address, also where new-request notifications go |

The four `CHOGAR_ADMIN_*` variables are only used on the *first* start —
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

### Before going live

Step-by-step instructions for a dogado server are in
[DEPLOY-dogado.md](DEPLOY-dogado.md).

- Run behind HTTPS and set `NODE_ENV=production`, otherwise the session cookie
  is sent without the `Secure` flag. The server prints a warning while that is
  the case.
- Set `SITE_URL` to the public address — password-reset links are built from it.
- Configure SMTP, otherwise nobody is notified of anything.
- Back up `server/data/chogar.db` regularly. It holds all member data.
- Change the instructor password from the generated one:
  `node server/set-password.js instructor "…"`.
