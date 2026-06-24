const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { findById } = require('../utils/users');

// Try to get user from token but never block the request
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const raw    = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (raw) {
    try {
      const payload = jwt.verify(raw, JWT_SECRET);
      req.user = findById(payload.sub) ?? null;
    } catch {}
  }
  next();
}

// POST /api/n8n/chat — proxies dashboard chat message to n8n chat trigger
router.post('/chat', optionalAuth, async (req, res) => {
  const { message, sessionId } = req.body;
  const userId = req.user?.id ?? null;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const n8nUrl = process.env.N8N_CHAT_URL;
  if (!n8nUrl) {
    return res.status(503).json({
      error: 'N8N_CHAT_URL is not set in server/.env',
    });
  }

  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');

  // Register sessionId → userId so webhook knows which user to notify
  if (sessionId) {
    const sessionUserMap = req.app.get('sessionUserMap');
    sessionUserMap.set(sessionId, userId);
    // Auto-cleanup after 2 hours
    setTimeout(() => sessionUserMap.delete(sessionId), 2 * 60 * 60 * 1000);
    console.log(`[n8n] Registered session ${sessionId} → user ${userId}`);
  }

  // Fire request to n8n in background — return immediately so Render never times out
  console.log(`[n8n] POST ${n8nUrl} | session=${sessionId || 'none'}`);

  fetch(n8nUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chatInput: message,
      sessionId: sessionId || 'dashboard-default',
      username:  req.user?.name || req.user?.email?.split('@')[0] || 'shared',
    }),
    signal: AbortSignal.timeout(600000), // 10 min background timeout
  }).then(async r => {
    const text = await r.text();
    console.log(`[n8n] Background response ${r.status}: ${text.slice(0, 200)}`);
    if (!r.ok) {
      updateState({ pipeline: { n8n: 'error' } });
      io.emit('pipeline:step', { step: 'n8n', status: 'error', error: `HTTP ${r.status}` });
    }
  }).catch(err => {
    if (!err.message?.includes('abort') && !err.message?.includes('signal')) {
      console.error(`[n8n] Background error: ${err.message}`);
      updateState({ pipeline: { n8n: 'error' } });
      io.emit('pipeline:step', { step: 'n8n', status: 'error', error: err.message });
    }
  });

  // Respond immediately — results arrive via Socket.IO as webhook events
  updateState({ pipeline: { n8n: 'running' } });
  io.emit('pipeline:step', { step: 'n8n', status: 'running' });
  return res.json({ processing: true, message: 'Request sent to n8n pipeline' });
});

// GET /api/n8n/status — check config and connectivity
router.get('/status', async (req, res) => {
  const url = process.env.N8N_CHAT_URL;
  if (!url) {
    return res.json({ configured: false, url: null });
  }

  let reachable = false;
  try {
    const baseUrl = new URL(url);
    const pingUrl = `${baseUrl.protocol}//${baseUrl.host}`;
    const r = await fetch(pingUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    reachable = r.status < 500;
  } catch {
    reachable = false;
  }

  res.json({
    configured: true,
    reachable,
    url: url.replace(/\/webhook\/[^/]+\/chat/, '/webhook/****/chat'),
  });
});

module.exports = router;
