const express    = require('express');
const router     = express.Router();
const { Octokit } = require('@octokit/rest');
const { updateUser, safeUser } = require('../utils/users');
const { requireAuth }          = require('../middleware/auth');

const CLIENT_ID     = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
// BACKEND_URL is where GitHub sends the OAuth callback (this server)
const BACKEND_URL   = process.env.BACKEND_URL || 'http://localhost:3001';
// FRONTEND_URL is where the browser goes after OAuth completes
const FRONTEND_URL  = process.env.FRONTEND_URL === '*'
  ? BACKEND_URL
  : (process.env.FRONTEND_URL || 'http://localhost:5173');

// GET /api/auth/github/connect?_token=<jwt>
// Redirects user to GitHub OAuth authorization page
router.get('/connect', requireAuth, (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured on server' });
  }
  const state  = Buffer.from(req.user.id).toString('base64url');
  const params = new URLSearchParams({
    client_id:    CLIENT_ID,
    redirect_uri: `${BACKEND_URL}/api/auth/github/callback`,
    scope:        'repo',
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/github/callback  — GitHub redirects here after user authorises
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/register?step=github&error=access_denied`);
  }
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/register?step=github&error=missing_params`);
  }

  let userId;
  try { userId = Buffer.from(state, 'base64url').toString('utf8'); }
  catch { return res.redirect(`${FRONTEND_URL}/register?step=github&error=invalid_state`); }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }),
    });
    const tokenData   = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('No access token in response');

    // Fetch GitHub username
    const octokit  = new Octokit({ auth: accessToken });
    const { data } = await octokit.users.getAuthenticated();

    updateUser(userId, {
      github: { accessToken, username: data.login, selectedRepo: null },
    });

    res.redirect(`${FRONTEND_URL}/register?step=repo&userId=${encodeURIComponent(userId)}`);
  } catch (err) {
    console.error('[GitHub OAuth callback]', err.message);
    res.redirect(`${FRONTEND_URL}/register?step=github&error=oauth_failed`);
  }
});

// GET /api/auth/github/repos  — list user's GitHub repos for the repo picker
router.get('/repos', requireAuth, async (req, res) => {
  const github = req.user.github;
  if (!github?.accessToken)
    return res.status(400).json({ error: 'GitHub not connected yet' });

  try {
    const octokit  = new Octokit({ auth: github.accessToken });
    const { data } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100, sort: 'updated', affiliation: 'owner',
    });
    res.json({
      repos: data.map(r => ({
        id:       r.id,
        name:     r.name,
        fullName: r.full_name,
        private:  r.private,
        url:      r.html_url,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list repos: ' + err.message });
  }
});

// POST /api/auth/github/select  — save chosen repo to user profile
router.post('/select', requireAuth, (req, res) => {
  const { repoFullName } = req.body ?? {};
  if (!repoFullName)
    return res.status(400).json({ error: 'repoFullName is required' });

  const github = req.user.github;
  if (!github?.accessToken)
    return res.status(400).json({ error: 'GitHub not connected' });

  const updated = updateUser(req.user.id, {
    github: { ...github, selectedRepo: repoFullName },
  });
  res.json({ user: safeUser(updated) });
});

// DELETE /api/auth/github/disconnect
router.delete('/disconnect', requireAuth, (req, res) => {
  const updated = updateUser(req.user.id, { github: null });
  res.json({ user: safeUser(updated) });
});

module.exports = router;
