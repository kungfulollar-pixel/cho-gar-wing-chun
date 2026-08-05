/*
  Reset a member's password from the command line:

    node set-password.js <username> <new password>

  Stop the server first, or run it while the server is running — both work,
  but all open sessions of that account are ended either way.
*/

import { db } from './db.js';
import { hashPassword } from './auth.js';

const [username, password] = process.argv.slice(2);

if (!username || !password) {
  console.error('Usage: node set-password.js <username> <new password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('The password must be at least 8 characters long.');
  process.exit(1);
}

const member = db.prepare('SELECT id, username FROM members WHERE username = ?').get(username.trim().toLowerCase());

if (!member) {
  console.error(`No account found for "${username}".`);
  process.exit(1);
}

db.prepare('UPDATE members SET password_hash = ? WHERE id = ?').run(hashPassword(password), member.id);
db.prepare('DELETE FROM sessions WHERE member_id = ?').run(member.id);

console.log(`Password updated for "${member.username}". All open sessions of this account were ended.`);
