/*
  Client for the member backend in /server.

  All calls go to the same origin and rely on the httpOnly session cookie the
  server sets on login — no credentials or member data are kept in the browser.
  Every function returns a promise.

  Registration flow:
  1. register.html  -> choGarRegister()      account is stored with status "pending"
  2. A pending account cannot sign in.
  3. admin-approvals.html -> choGarApprove() / choGarReject()
  4. Only after approval does choGarLogin() succeed.
*/

async function choGarApi(path, options) {
  const config = Object.assign({ credentials: 'same-origin', headers: {} }, options);

  if (config.body !== undefined && typeof config.body !== 'string') {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(path, config);
  } catch (e) {
    return { status: 0, data: { error: 'No connection to the server. Please try again later.' } };
  }

  let data = {};
  try {
    data = await response.json();
  } catch (e) {
    /* Empty or non-JSON body — keep data as {}. */
  }
  return { status: response.status, data };
}

/* ---------- registration ---------- */

/*
  data: { username, password, name, email, phone, note }
  Returns { ok: true } or { ok: false, error: '<message>' }
*/
async function choGarRegister(data) {
  const result = await choGarApi('/api/register', { method: 'POST', body: data });
  if (result.status === 201) {
    return { ok: true };
  }
  return { ok: false, error: result.data.error || 'Registration failed. Please try again.' };
}

/* ---------- login / session ---------- */

/*
  Returns { ok: true, member } or
          { ok: false, reason: 'credentials' | 'pending' | 'rejected' | 'throttled', error }
*/
async function choGarLogin(username, password) {
  const result = await choGarApi('/api/login', {
    method: 'POST',
    body: { username: username, password: password }
  });

  if (result.status === 200) {
    return { ok: true, member: result.data.member };
  }
  return {
    ok: false,
    reason: result.data.reason || 'credentials',
    error: result.data.error || 'Sign-in failed. Please try again.'
  };
}

async function choGarLogout() {
  await choGarApi('/api/logout', { method: 'POST', body: {} });
  window.location.href = 'login.html';
}

/* Returns the signed-in member, or null when there is no valid session. */
async function choGarCurrentMember() {
  const result = await choGarApi('/api/me', { method: 'GET' });
  return result.status === 200 ? result.data.member : null;
}

/* Redirects to the login page when not signed in. Resolves with the member. */
async function choGarRequireLogin() {
  const member = await choGarCurrentMember();
  if (!member) {
    window.location.href = 'login.html';
    return null;
  }
  return member;
}

/* Redirects unless the signed-in member is an instructor. */
async function choGarRequireInstructor() {
  const member = await choGarCurrentMember();
  if (!member) {
    window.location.href = 'login.html';
    return null;
  }
  if (member.role !== 'instructor') {
    window.location.href = 'member-area.html';
    return null;
  }
  return member;
}

/* ---------- password reset ---------- */

/*
  identifier: username or e-mail address.
  Always resolves with { ok: true } when the request went through — the server
  deliberately does not reveal whether the account exists.
*/
async function choGarRequestPasswordReset(identifier) {
  const result = await choGarApi('/api/password/forgot', {
    method: 'POST',
    body: { identifier: identifier }
  });

  if (result.status === 200) {
    return { ok: true };
  }
  return { ok: false, error: result.data.error || 'The request could not be sent.' };
}

async function choGarResetPassword(token, password) {
  const result = await choGarApi('/api/password/reset', {
    method: 'POST',
    body: { token: token, password: password }
  });

  if (result.status === 200) {
    return { ok: true };
  }
  return { ok: false, error: result.data.error || 'The password could not be changed.' };
}

/* ---------- approval (instructor only) ---------- */

/*
  status: 'pending' | 'approved' | 'rejected' | 'all'
  Returns { ok: true, requests: [...], pendingCount: n } or { ok: false, error }
*/
async function choGarListRequests(status) {
  const query = status ? '?status=' + encodeURIComponent(status) : '';
  const result = await choGarApi('/api/admin/requests' + query, { method: 'GET' });

  if (result.status === 200) {
    return { ok: true, requests: result.data.requests, pendingCount: result.data.pendingCount };
  }
  return { ok: false, error: result.data.error || 'Could not load the requests.' };
}

async function choGarSetStatus(username, status) {
  const result = await choGarApi('/api/admin/requests/' + encodeURIComponent(username) + '/status', {
    method: 'POST',
    body: { status: status }
  });

  if (result.status === 200) {
    return { ok: true };
  }
  return { ok: false, error: result.data.error || 'The change could not be saved.' };
}

function choGarApprove(username) {
  return choGarSetStatus(username, 'approved');
}

function choGarReject(username) {
  return choGarSetStatus(username, 'rejected');
}

async function choGarDeleteRequest(username) {
  const result = await choGarApi('/api/admin/requests/' + encodeURIComponent(username), {
    method: 'DELETE',
    body: {}
  });

  if (result.status === 200) {
    return { ok: true };
  }
  return { ok: false, error: result.data.error || 'The request could not be deleted.' };
}
