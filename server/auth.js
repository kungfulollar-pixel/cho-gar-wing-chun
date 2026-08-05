/*
  Password hashing (scrypt), session tokens and the login throttle.
  Everything here uses node:crypto, so there are no native dependencies.
*/

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

export const SESSION_COOKIE = 'chogar_sid';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_TTL_MS = 60 * 60 * 1000;

/* ---------- passwords ---------- */

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') {
      return false;
    }
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p)
    });
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* ---------- sessions ---------- */

export function createSession(memberId) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    token,
    memberId,
    new Date().toISOString(),
    Date.now() + SESSION_TTL_MS
  );
  return token;
}

export function destroySession(token) {
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
}

export function destroyAllSessionsFor(memberId) {
  db.prepare('DELETE FROM sessions WHERE member_id = ?').run(memberId);
}

export function memberForSession(token) {
  if (!token) {
    return null;
  }
  const row = db
    .prepare(
      `SELECT m.* FROM sessions s
       JOIN members m ON m.id = s.member_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, Date.now());

  if (!row || row.status !== 'approved') {
    return null;
  }
  return row;
}

/* ---------- password resets ---------- */

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/* Returns the plain token — only its hash is stored. */
export function createPasswordReset(memberId) {
  /* One valid link per account: older ones stop working. */
  db.prepare('DELETE FROM password_resets WHERE member_id = ?').run(memberId);

  const token = randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO password_resets (token_hash, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(hashToken(token), memberId, new Date().toISOString(), Date.now() + RESET_TTL_MS);

  return token;
}

/*
  Redeems a reset token: sets the new password, ends every session of that
  account and removes the token. Returns the member row or null.
*/
export function redeemPasswordReset(token, newPassword) {
  if (!token) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT m.* FROM password_resets p
       JOIN members m ON m.id = p.member_id
       WHERE p.token_hash = ? AND p.expires_at > ? AND p.used_at = ''`
    )
    .get(hashToken(token), Date.now());

  if (!row) {
    return null;
  }

  db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), row.id);
  db.prepare('DELETE FROM password_resets WHERE member_id = ?').run(row.id);
  destroyAllSessionsFor(row.id);

  return row;
}

/* ---------- login throttle ---------- */

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

export function isThrottled(key) {
  const entry = attempts.get(key);
  if (!entry) {
    return false;
  }
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(key) {
  attempts.delete(key);
}
