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
  const { message, sessionId, wakeup = false } = req.body;
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

  // Wakeup calls are silent background pings — don't change pipeline status
  if (!wakeup) {
    updateState({ pipeline: { n8n: 'running' } });
    io.emit('pipeline:step', { step: 'n8n', status: 'running' });
  }
  return res.json({ processing: true, message: 'Request sent to n8n pipeline' });
});

// POST /api/n8n/stop — stop all running n8n executions and reset pipeline state
router.post('/stop', optionalAuth, async (req, res) => {
  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');

  const resetPipeline = () => {
    updateState({ pipeline: { n8n: 'idle', webhook: 'idle', github: 'idle', deploy: 'idle' } });
    io.emit('pipeline:step', { step: 'n8n',     status: 'idle' });
    io.emit('pipeline:step', { step: 'webhook', status: 'idle' });
  };

  const n8nChatUrl = process.env.N8N_CHAT_URL;
  const n8nApiKey  = process.env.N8N_API_KEY;

  if (!n8nChatUrl || !n8nApiKey) {
    resetPipeline();
    return res.json({ stopped: 0, message: 'Pipeline reset (set N8N_API_KEY in Render env to also stop remote executions)' });
  }

  try {
    const base    = new URL(n8nChatUrl);
    const n8nBase = `${base.protocol}//${base.host}`;

    const listRes = await fetch(`${n8nBase}/api/v1/executions?status=running&limit=10`, {
      headers: { 'X-N8N-API-KEY': n8nApiKey },
      signal:  AbortSignal.timeout(6000),
    });

    if (!listRes.ok) {
      resetPipeline();
      return res.json({ stopped: 0, message: 'Pipeline reset (n8n API error)', pipelineReset: true });
    }

    const body       = await listRes.json();
    const executions = body.data ?? body.executions ?? [];
    let   stopped    = 0;

    for (const exec of executions) {
      try {
        const r = await fetch(`${n8nBase}/api/v1/executions/${exec.id}/stop`, {
          method:  'POST',
          headers: { 'X-N8N-API-KEY': n8nApiKey },
          signal:  AbortSignal.timeout(6000),
        });
        if (r.ok) stopped++;
      } catch { /* skip individual failures */ }
    }

    resetPipeline();
    console.log(`[n8n] Stop: halted ${stopped} execution(s)`);
    return res.json({ stopped, message: `Stopped ${stopped} execution(s)` });

  } catch (err) {
    resetPipeline();
    console.error(`[n8n] Stop error: ${err.message}`);
    return res.json({ stopped: 0, message: 'Pipeline reset. Could not reach n8n API.' });
  }
});

// POST /api/n8n/chat-mobile — proxies Website & Mobile App chat to NAS n8n
router.post('/chat-mobile', optionalAuth, async (req, res) => {
  const { message, sessionId, wakeup = false } = req.body;
  const userId = req.user?.id ?? null;

  if (!message) return res.status(400).json({ error: 'message is required' });

  const n8nUrl = process.env.N8N_MOBILE_CHAT_URL;
  if (!n8nUrl) {
    return res.status(503).json({ error: 'N8N_MOBILE_CHAT_URL is not set' });
  }

  const io             = req.app.get('io');
  const updateState    = req.app.get('updateState');
  const sessionUserMap = req.app.get('sessionUserMap');

  if (sessionId) {
    sessionUserMap.set(sessionId, userId);
    setTimeout(() => sessionUserMap.delete(sessionId), 2 * 60 * 60 * 1000);
  }

  console.log(`[n8n-mobile] POST ${n8nUrl} | session=${sessionId || 'none'}`);

  fetch(n8nUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chatInput: message,
      sessionId: sessionId || 'dashboard-default',
      username:  req.user?.name || req.user?.email?.split('@')[0] || 'shared',
    }),
    signal: AbortSignal.timeout(600000),
  }).then(async r => {
    const text = await r.text();
    console.log(`[n8n-mobile] Response ${r.status}: ${text.slice(0, 200)}`);
    // Forward n8n's reply to the frontend via Socket.io
    try {
      const data   = JSON.parse(text);
      const output = data.output ?? data.text ?? data.message ?? text;
      if (output) {
        const uid = sessionId ? sessionUserMap?.get(sessionId) : null;
        if (uid) {
          io.to('user:' + uid).emit('chat:response', { sessionId: sessionId || '', output: String(output) });
        } else {
          io.emit('chat:response', { sessionId: sessionId || '', output: String(output) });
        }
        console.log(`[n8n-mobile] chat:response forwarded → session=${sessionId}`);
      }
    } catch { /* response wasn't JSON or had no output field */ }
  }).catch(err => {
    if (!err.message?.includes('abort') && !err.message?.includes('signal')) {
      console.error(`[n8n-mobile] Error: ${err.message}`);
    }
  });

  if (!wakeup) {
    updateState({ pipeline: { n8n: 'running' } });
    io.emit('pipeline:step', { step: 'n8n', status: 'running' });
  }
  return res.json({ processing: true, message: 'Request sent to n8n mobile pipeline' });
});

// GET /api/n8n/status-mobile — check mobile pipeline config
router.get('/status-mobile', async (req, res) => {
  const url = process.env.N8N_MOBILE_CHAT_URL;
  if (!url) return res.json({ configured: false, url: null });
  let reachable = false;
  try {
    const baseUrl = new URL(url);
    const r = await fetch(`${baseUrl.protocol}//${baseUrl.host}`, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    reachable = r.status < 500;
  } catch { reachable = false; }
  res.json({ configured: true, reachable, url: url.replace(/\/webhook\/[^/]+\/chat/, '/webhook/****/chat') });
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
