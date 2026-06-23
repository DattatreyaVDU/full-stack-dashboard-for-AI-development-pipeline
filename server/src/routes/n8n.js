const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// POST /api/n8n/chat — proxies dashboard chat message to n8n chat trigger
router.post('/chat', requireAuth, async (req, res) => {
  const { message, sessionId } = req.body;
  const userId = req.user.id;

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

  try {
    updateState({ pipeline: { n8n: 'running' } });
    io.emit('pipeline:step', { step: 'n8n', status: 'running' });

    console.log(`[n8n] POST ${n8nUrl}`);
    console.log(`[n8n] Body: chatInput="${message}" sessionId="${sessionId || 'none'}"`);

    const response = await fetch(n8nUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        chatInput: message,
        sessionId: sessionId || 'dashboard-default',
      }),
      signal: AbortSignal.timeout(480000), // 8 minutes — covers full pipeline
    });

    const rawText = await response.text();
    console.log(`[n8n] Response ${response.status}: ${rawText.slice(0, 500)}`);

    if (!response.ok) {
      updateState({ pipeline: { n8n: 'error' } });
      io.emit('pipeline:step', { step: 'n8n', status: 'error', error: `HTTP ${response.status}` });

      return res.status(502).json({
        error:      `n8n returned HTTP ${response.status}`,
        n8nBody:    rawText,
        suggestion: response.status === 404
          ? 'Workflow not found — make sure the workflow is ACTIVATED (green toggle) in n8n'
          : response.status === 401 || response.status === 403
          ? 'Auth error — check n8n webhook authentication settings'
          : 'Check the n8n server logs for details',
      });
    }

    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { output: rawText };
    }

    if (data.executionStarted === true || data.executionId || data.ok === true) {
      updateState({ pipeline: { n8n: 'running' } });
      io.emit('pipeline:step', { step: 'n8n', status: 'running' });
      return res.json({ processing: true, executionId: data.executionId });
    }

    const output = data.output ?? data.text ?? data.message ?? rawText ?? 'No response from n8n.';

    updateState({ pipeline: { n8n: 'done' } });
    io.emit('pipeline:step', { step: 'n8n', status: 'done' });

    console.log(`[n8n] Success — output: ${String(output).slice(0, 200)}`);
    res.json({ output, raw: data });

  } catch (err) {
    updateState({ pipeline: { n8n: 'error' } });
    io.emit('pipeline:step', { step: 'n8n', status: 'error', error: err.message });

    console.error(`[n8n] Fetch failed: ${err.message}`);

    const isConnRefused = err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND');
    res.status(502).json({
      error:      err.message,
      suggestion: isConnRefused
        ? 'Cannot reach n8n — check that n8n is running and the domain is correct'
        : 'Unexpected error — check the server terminal for details',
    });
  }
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
