/*
  Outgoing mail.

  Configure SMTP through the environment (see .env.example). Without SMTP_HOST
  the server does not send anything — it prints the message to the console
  instead, so the whole flow stays testable in development.
*/

import nodemailer from 'nodemailer';

/*
  Defaults describe the live setup (Hostinger mailbox of chogarkungfu.com), so
  the app is configured out of the box. Only the password has to come from the
  environment — a secret does not belong in a repository.
*/
const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER || 'nils@chogarkungfu.com';
const pass = process.env.SMTP_PASS;

/*
  Without the password the server would hand every message to a mail server
  that rejects it. Printing to the log instead keeps registration and password
  reset usable and makes the missing SMTP_PASS visible.
*/
export const mailConfigured = Boolean(host && pass);

const transport = mailConfigured
  ? nodemailer.createTransport({
      host,
      port,
      /* Port 465 speaks TLS from the first byte; 587 upgrades via STARTTLS. */
      secure: port === 465,
      auth: user ? { user, pass } : undefined
    })
  : null;

const from = process.env.MAIL_FROM || `Cho Gar Wing Chun <${user}>`;

/* Password-reset links are built from this — a wrong value makes them useless. */
export function siteUrl() {
  const fallback = process.env.NODE_ENV === 'production' ? 'https://chogarkungfu.com' : 'http://localhost:3000';
  return (process.env.SITE_URL || fallback).replace(/\/+$/, '');
}

/*
  Never let a mail failure break the request that triggered it — a registration
  must succeed even when the mail server is down.
*/
export async function sendMail({ to, subject, text }) {
  if (!transport) {
    console.log('\n--- e-mail (SMTP not configured, printed instead) ---');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('--- end of e-mail ---\n');
    return { sent: false, logged: true };
  }

  try {
    await transport.sendMail({ from, to, subject, text });
    return { sent: true };
  } catch (error) {
    console.error(`Could not send mail to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
}

/* ---------- templates ---------- */

export function newRequestMail(request) {
  return {
    subject: `New registration request: ${request.name}`,
    text:
      `${request.name} has requested access to the member area.\n\n` +
      `Username: ${request.username}\n` +
      `E-mail:   ${request.email}\n` +
      (request.phone ? `Phone:    ${request.phone}\n` : '') +
      (request.note ? `\nMessage:\n${request.note}\n` : '') +
      `\nReview the request here:\n${siteUrl()}/admin-approvals.html\n`
  };
}

export function approvedMail(member) {
  return {
    subject: 'Your member account has been released',
    text:
      `Hello ${member.name},\n\n` +
      `your account for the Cho Gar Wing Chun member area has been approved. ` +
      `You can now sign in with your username "${member.username}":\n\n` +
      `${siteUrl()}/login.html\n\n` +
      `See you on the training floor.\n`
  };
}

export function rejectedMail(member) {
  return {
    subject: 'About your membership request',
    text:
      `Hello ${member.name},\n\n` +
      `your request for access to the member area was not approved. ` +
      `If you think this is a mistake, please get in touch with your instructor.\n`
  };
}

export function passwordResetMail(member, token) {
  return {
    subject: 'Reset your password',
    text:
      `Hello ${member.name},\n\n` +
      `a password reset was requested for your account "${member.username}". ` +
      `Open the following link within the next hour to choose a new password:\n\n` +
      `${siteUrl()}/reset-password.html?token=${token}\n\n` +
      `If you did not request this, simply ignore this e-mail — your password stays unchanged.\n`
  };
}
