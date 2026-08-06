/*
  Cho Gar Wing Chun — member backend.

  Registration flow:
  1. POST /api/register       -> account is created with status "pending"
  2. A pending account cannot log in (403, reason "pending")
  3. The instructor approves via POST /api/admin/requests/:username/status
  4. Only then does POST /api/login succeed

  The server also serves the static site, so a single process runs everything.
*/

import express from 'express';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from './db.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  clearAttempts,
  createPasswordReset,
  createSession,
  destroyAllSessionsFor,
  destroySession,
  hashPassword,
  isThrottled,
  memberForSession,
  recordFailedAttempt,
  redeemPasswordReset,
  verifyPassword
} from './auth.js';
import {
  approvedMail,
  mailConfigured,
  newRequestMail,
  passwordResetMail,
  rejectedMail,
  sendMail
} from './mailer.js';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(here, '..');
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

/*
  In production the server sits behind a reverse proxy (nginx, Caddy, the
  platform's router). Trusting its X-Forwarded-For header keeps req.ip — and
  with it the login throttle — meaningful.
*/
if (isProduction) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
}

/* ---------- helpers ---------- */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: SESSION_TTL_MS,
    path: '/'
  });
}

function findMember(username) {
  return db.prepare('SELECT * FROM members WHERE username = ?').get(String(username || '').trim().toLowerCase());
}

/*
  Members sign in with their e-mail address. The username still exists as the
  internal handle (and the instructor account was created with one), so both
  are accepted here.
*/
function findMemberByLogin(identifier) {
  const value = String(identifier || '').trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  return db.prepare('SELECT * FROM members WHERE username = ? OR lower(email) = ?').get(value, value);
}

/*
  Registration asks for an e-mail address, not a username — one is derived from
  the address and made unique, so nothing in the database has to change.
*/
function usernameForEmail(email) {
  const cleaned = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const base = (cleaned.length >= 3 ? cleaned : `${cleaned}member`).slice(0, 20);

  if (!findMember(base)) {
    return base;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}${suffix}`;
    if (!findMember(candidate)) {
      return candidate;
    }
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

/* Shape a member row for the browser — never includes the password hash. */
function toProfile(row) {
  const attendance = db
    .prepare('SELECT trained_on, session_name FROM attendance WHERE member_id = ? ORDER BY trained_on DESC LIMIT 20')
    .all(row.id)
    .map((entry) => ({ date: entry.trained_on, session: entry.session_name }));

  const messages = db
    .prepare('SELECT sender, body FROM messages WHERE member_id = ? ORDER BY id DESC LIMIT 20')
    .all(row.id)
    .map((entry) => ({ from: entry.sender, text: entry.body }));

  return {
    username: row.username,
    name: row.name,
    role: row.role,
    status: row.status,
    levelName: row.level_name,
    levelColor: row.level_color,
    levelProgress: row.level_progress,
    memberSince: row.member_since,
    nextMilestone: row.next_milestone,
    attendance,
    messages
  };
}

/* Shape a member row for the instructor's approval list. */
function toRequest(row) {
  return {
    username: row.username,
    name: row.name,
    email: row.email,
    phone: row.phone,
    note: row.note,
    status: row.status,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by
  };
}

/* ---------- middleware ---------- */

/* Attach the signed-in member (null when there is no valid session). */
app.use((req, _res, next) => {
  req.member = memberForSession(readCookie(req, SESSION_COOKIE));
  next();
});

/*
  CSRF guard: state-changing requests must be JSON. A cross-origin HTML form
  can only send urlencoded/multipart bodies, so this plus SameSite=Lax cookies
  keeps forged requests out.
*/
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json.' });
  }
  next();
});

function requireLogin(req, res, next) {
  if (!req.member) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  next();
}

function requireInstructor(req, res, next) {
  if (!req.member) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  if (req.member.role !== 'instructor') {
    return res.status(403).json({ error: 'Only an instructor can review registration requests.' });
  }
  next();
}

/* ---------- registration ---------- */

app.post('/api/register', (req, res) => {
  const body = req.body || {};
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const note = String(body.note || '').trim();

  if (!password || !name || !email) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid e-mail address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'The password must be at least 8 characters long.' });
  }
  if (name.length > 120 || email.length > 160 || phone.length > 40 || note.length > 1000) {
    return res.status(400).json({ error: 'One of the fields is too long.' });
  }
  if (findMemberByLogin(email)) {
    return res.status(409).json({ error: 'An account already exists for this e-mail address.' });
  }

  const username = usernameForEmail(email);

  db.prepare(
    `INSERT INTO members (username, password_hash, name, email, phone, note, role, status, member_since, requested_at)
     VALUES (?, ?, ?, ?, ?, ?, 'student', 'pending', ?, ?)`
  ).run(username, hashPassword(password), name, email, phone, note, String(new Date().getFullYear()), today());

  /* Tell the instructors that something is waiting for them. */
  const instructors = db.prepare("SELECT email FROM members WHERE role = 'instructor' AND email != ''").all();
  const mail = newRequestMail({ username, name, email, phone, note });
  for (const instructor of instructors) {
    sendMail({ to: instructor.email, subject: mail.subject, text: mail.text });
  }

  res.status(201).json({ ok: true, status: 'pending' });
});

/* ---------- login / session ---------- */

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  /* "username" stays accepted so an older cached page keeps working. */
  const identifier = String(body.identifier || body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const throttleKey = `${req.ip}:${identifier}`;

  if (isThrottled(throttleKey)) {
    return res.status(429).json({ reason: 'throttled', error: 'Too many attempts. Please try again in 15 minutes.' });
  }

  const member = findMemberByLogin(identifier);
  if (!member || !verifyPassword(password, member.password_hash)) {
    recordFailedAttempt(throttleKey);
    return res.status(401).json({ reason: 'credentials', error: 'E-mail address or password is incorrect.' });
  }
  if (member.status === 'pending') {
    return res.status(403).json({
      reason: 'pending',
      error: 'Your account has not been released yet. You can sign in once your instructor approves it.'
    });
  }
  if (member.status !== 'approved') {
    return res.status(403).json({
      reason: 'rejected',
      error: 'Your registration request was not approved. Please contact your instructor.'
    });
  }

  clearAttempts(throttleKey);
  setSessionCookie(res, createSession(member.id));
  res.json({ ok: true, member: toProfile(member) });
});

app.post('/api/logout', (req, res) => {
  destroySession(readCookie(req, SESSION_COOKIE));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', requireLogin, (req, res) => {
  res.json({ member: toProfile(req.member) });
});

/* ---------- password reset ---------- */

/*
  Always answers 200, whether or not the account exists — otherwise this
  endpoint would tell an attacker which e-mail addresses are registered.
*/
app.post('/api/password/forgot', (req, res) => {
  const identifier = String((req.body || {}).identifier || '').trim().toLowerCase();

  if (!identifier) {
    return res.status(400).json({ error: 'Please enter your username or e-mail address.' });
  }
  if (isThrottled(`forgot:${req.ip}`)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again in 15 minutes.' });
  }
  recordFailedAttempt(`forgot:${req.ip}`);

  const member = db
    .prepare('SELECT * FROM members WHERE username = ? OR lower(email) = ?')
    .get(identifier, identifier);

  /* Rejected accounts get no reset link — there is nothing to sign in to. */
  if (member && member.status === 'approved' && member.email) {
    const token = createPasswordReset(member.id);
    const mail = passwordResetMail(member, token);
    sendMail({ to: member.email, subject: mail.subject, text: mail.text });
  }

  res.json({ ok: true });
});

app.post('/api/password/reset', (req, res) => {
  const body = req.body || {};
  const token = String(body.token || '');
  const password = String(body.password || '');

  if (password.length < 8) {
    return res.status(400).json({ error: 'The password must be at least 8 characters long.' });
  }

  const member = redeemPasswordReset(token, password);
  if (!member) {
    return res.status(400).json({ error: 'This link is invalid or has expired. Please request a new one.' });
  }

  res.json({ ok: true });
});

/* ---------- approval (instructor only) ---------- */

app.get('/api/admin/requests', requireInstructor, (req, res) => {
  const status = String(req.query.status || 'all');
  const rows =
    status === 'all'
      ? db.prepare("SELECT * FROM members WHERE role != 'instructor' ORDER BY id DESC").all()
      : db.prepare("SELECT * FROM members WHERE role != 'instructor' AND status = ? ORDER BY id DESC").all(status);

  const pending = db
    .prepare("SELECT COUNT(*) AS count FROM members WHERE role != 'instructor' AND status = 'pending'")
    .get().count;

  res.json({ requests: rows.map(toRequest), pendingCount: pending });
});

app.post('/api/admin/requests/:username/status', requireInstructor, (req, res) => {
  const status = String((req.body || {}).status || '');
  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'Status must be "approved" or "rejected".' });
  }

  const member = findMember(req.params.username);
  if (!member || member.role === 'instructor') {
    return res.status(404).json({ error: 'Request not found.' });
  }

  db.prepare('UPDATE members SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?').run(
    status,
    today(),
    req.member.username,
    member.id
  );

  /* Withdrawing approval must end any session the member still has open. */
  if (status !== 'approved') {
    destroyAllSessionsFor(member.id);
  }

  if (status === 'approved' && member.status !== 'approved') {
    db.prepare('INSERT INTO messages (member_id, sender, body, created_at) VALUES (?, ?, ?, ?)').run(
      member.id,
      req.member.name,
      'Welcome to Cho Gar Wing Chun. Your account has been approved — see you on the training floor.',
      today()
    );
  }

  /* Let the member know about the decision. */
  if (member.status !== status && member.email) {
    const mail = status === 'approved' ? approvedMail(member) : rejectedMail(member);
    sendMail({ to: member.email, subject: mail.subject, text: mail.text });
  }

  res.json({ ok: true, status });
});

app.delete('/api/admin/requests/:username', requireInstructor, (req, res) => {
  const member = findMember(req.params.username);
  if (!member || member.role === 'instructor') {
    return res.status(404).json({ error: 'Request not found.' });
  }
  db.prepare('DELETE FROM members WHERE id = ?').run(member.id);
  res.json({ ok: true });
});

/* ---------- static site ---------- */

/* The server folder holds the database and secrets — never serve it. */
app.use((req, res, next) => {
  if (req.path === '/server' || req.path.startsWith('/server/')) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(express.static(siteRoot, { extensions: ['html'] }));

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Unknown endpoint.' });
});

/* ---------- first-run instructor account ---------- */

function seedInstructor() {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM members WHERE role = 'instructor'").get().count;
  if (existing > 0) {
    return;
  }

  const username = (process.env.CHOGAR_ADMIN_USER || 'instructor').trim().toLowerCase();
  const generated = !process.env.CHOGAR_ADMIN_PASSWORD;
  const password = process.env.CHOGAR_ADMIN_PASSWORD || randomBytes(12).toString('base64url');

  db.prepare(
    `INSERT INTO members (username, password_hash, name, email, role, status, level_name, level_color,
                          level_progress, member_since, next_milestone, requested_at, decided_at)
     VALUES (?, ?, ?, ?, 'instructor', 'approved', ?, '#111111', 100, '—', '—', ?, ?)`
  ).run(
    username,
    hashPassword(password),
    process.env.CHOGAR_ADMIN_NAME || 'Sifu Nils Ring',
    process.env.CHOGAR_ADMIN_EMAIL || 'nils@chogarkungfu.com',
    'Head Instructor — Cho Family Lineage',
    today(),
    today()
  );

  console.log('\n  Instructor account created');
  console.log(`  Username: ${username}`);
  if (generated) {
    console.log(`  Password: ${password}`);
    console.log('  Write this down now — it is not stored anywhere in plain text.\n');
  } else {
    console.log('  Password: taken from CHOGAR_ADMIN_PASSWORD\n');
  }
}

/*
  Emergency password reset without a shell.

  CHOGAR_ADMIN_PASSWORD only applies while the instructor account is being
  created — once it exists, the generated password is gone for good, and on a
  managed host there is no console to run set-password.js from. Setting
  CHOGAR_ADMIN_RESET_PASSWORD and restarting sets a new password instead.

  Remove the variable afterwards: as long as it is set, every restart resets
  the password again, and it sits readable in the hosting panel.
*/
function applyAdminPasswordReset() {
  const wanted = process.env.CHOGAR_ADMIN_RESET_PASSWORD;
  if (!wanted) {
    return;
  }

  const username = (process.env.CHOGAR_ADMIN_USER || 'instructor').trim().toLowerCase();

  if (wanted.length < 8) {
    console.log('CHOGAR_ADMIN_RESET_PASSWORD is shorter than 8 characters — ignored.');
    return;
  }

  const member = findMember(username);
  if (!member) {
    console.log(`CHOGAR_ADMIN_RESET_PASSWORD is set, but there is no account "${username}".`);
    return;
  }

  db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(wanted), member.id);
  destroyAllSessionsFor(member.id);

  console.log(`\n  Password for "${username}" was reset from CHOGAR_ADMIN_RESET_PASSWORD.`);
  console.log('  Remove that variable now — otherwise it resets on every restart.\n');
}

/*
  Keep the instructor's e-mail address in sync with the environment. It is where
  registration notices go and where a password-reset link for the instructor
  would be delivered, so being able to correct it without a shell matters.
*/
function applyAdminEmail() {
  const wanted = String(process.env.CHOGAR_ADMIN_EMAIL || 'nils@chogarkungfu.com').trim();
  if (!wanted) {
    return;
  }

  const username = (process.env.CHOGAR_ADMIN_USER || 'instructor').trim().toLowerCase();
  const member = findMember(username);
  if (!member || member.email === wanted) {
    return;
  }

  const clash = findMemberByLogin(wanted);
  if (clash && clash.id !== member.id) {
    console.log(`CHOGAR_ADMIN_EMAIL "${wanted}" already belongs to another account — not changed.`);
    return;
  }

  db.prepare('UPDATE members SET email = ? WHERE id = ?').run(wanted, member.id);
  console.log(`E-mail address for "${username}" set to ${wanted} from CHOGAR_ADMIN_EMAIL.`);
}

seedInstructor();
applyAdminEmail();
applyAdminPasswordReset();

app.listen(PORT, () => {
  console.log(`Cho Gar Wing Chun running at http://localhost:${PORT}`);
  if (!mailConfigured) {
    console.log('SMTP is not configured — e-mails are printed to this console instead of being sent.');
  }
  if (!isProduction) {
    console.log('NODE_ENV is not "production" — the session cookie is sent without the Secure flag.');
  }
});
