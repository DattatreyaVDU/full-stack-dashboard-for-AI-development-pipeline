const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs');
const path = require('path');
const { Octokit }            = require('@octokit/rest');
const { findByWebhookToken, findById } = require('../utils/users');
const db                     = require('../db');

// Files land in PROJECTS_DIR — set via env var, falls back to <repo-root>/projects/
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(__dirname, '..', '..', '..', 'projects');

// Valid WordPress/web theme file extensions
const VALID_THEME_EXTS = new Set([
  // Web / React
  '.ts', '.tsx', '.jsx', '.js', '.html', '.htm', '.css',
  // Config & tooling
  '.json', '.env', '.yml', '.yaml', '.sh', '.txt', '.md', '.xml',
  // WordPress
  '.php', '.pot', '.htaccess',
  // Database
  '.sql',
  // Images
  '.png', '.jpg', '.jpeg', '.svg', '.webp',
]);

function isGarbageFilename(baseName) {
  // Path-encoded filenames like "template-f--internship-claude-ai-works-..."
  if (baseName.length > 80) return true;
  // Absolute paths that leaked into the filename
  if (/^[a-zA-Z][-]{2}/.test(baseName)) return true;
  // Prompt/context markdown files (00_art_direction_brief.md etc.)
  if (/^\d{2}_/.test(baseName) && baseName.endsWith('.md')) return true;
  return false;
}

function saveFileToDisk(build, userId = null) {
  if (!build.content) return null;
  try {
    const safeName    = build.projectName.replace(/[^a-z0-9_-]/gi, '_');
    const userSegment = userId || 'shared';
    const dir         = path.join(PROJECTS_DIR, userSegment, safeName);
    fs.mkdirSync(dir, { recursive: true });

    // ── Parse === FILE: blocks (React/WP pipeline output) ───────────────────────
    const fileRegex = /===\s*FILE:\s*(.+?)\s*===\n([\s\S]*?)(?:\n?===\s*END FILE\s*===|(?====\s*FILE:)|$)/g;
    const savedFiles = [];
    let match;

    while ((match = fileRegex.exec(build.content)) !== null) {
      const relPath     = match[1].trim();
      const fileContent = match[2].replace(/\n$/, '');
      if (!relPath || !fileContent.trim()) continue;

      const baseName = path.basename(relPath);
      if (isGarbageFilename(baseName)) continue;

      const ext = path.extname(baseName).toLowerCase();
      if (ext && !VALID_THEME_EXTS.has(ext)) continue;

      const fullPath = path.join(dir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, fileContent, 'utf8');
      savedFiles.push(fullPath);
    }

    if (savedFiles.length > 0) {
      console.log(`[Webhook] Saved ${savedFiles.length} file(s) to ${dir}`);
      return savedFiles[0];
    }

    // ── Fallback: save as single file using pageName ─────────────────────────────
    const rawFile  = build.filePath || build.pageName || `page_${build.pageId}`;
    const baseName = path.basename(rawFile);
    const ext      = path.extname(baseName).toLowerCase();
    const fileName = ext ? baseName : `${baseName}.md`;

    if (isGarbageFilename(fileName)) {
      console.log(`[Webhook] Skipped garbage filename: ${fileName}`);
      return null;
    }
    if (ext && !VALID_THEME_EXTS.has(ext)) {
      console.log(`[Webhook] Skipped unsupported extension: ${fileName}`);
      return null;
    }

    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, build.content, 'utf8');
    console.log(`[Webhook] Saved (fallback) → ${fullPath}`);
    return fullPath;
  } catch (err) {
    console.error(`[Webhook] File save failed: ${err.message}`);
    return null;
  }
}

/**
 * Normalise an incoming n8n payload into a consistent Build object.
 *
 * Supports two shapes:
 *
 *  A) New camelCase format (Lead-PM summary / build-complete event):
 *     { projectName, status, generatedFiles, projectFolder, timestamp }
 *
 *  B) Legacy snake_case format (File-Creation node per-page event):
 *     { project_name, page_id, page_name, content, archivo_creado, carpeta, ... }
 */
// Strip only if the ENTIRE value is an unevaluated n8n expression like "={{ $json.foo }}"
// Do NOT strip actual content that merely contains {{ }} (e.g. LLM-generated markdown)
function clean(val, fallback = '') {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (trimmed.startsWith('={{') || /^\{\{[\s\S]*\}\}$/.test(trimmed)) return fallback;
  return trimmed || fallback;
}

function normalizeBuild(payload) {
  const isNewFormat =
    ('projectName' in payload) &&
    ('generatedFiles' in payload || 'projectFolder' in payload || 'status' in payload);

  if (isNewFormat) {
    const rawFiles  = Array.isArray(payload.generatedFiles) ? payload.generatedFiles : [];
    const files     = rawFiles.map(f => clean(f, '')).filter(Boolean);
    const folder    = clean(payload.projectFolder, '');
    const projName  = clean(payload.projectName, folder || 'My Project');
    const content   = clean(payload.content || payload.output, '');

    return {
      id:             uuidv4(),
      timestamp:      payload.timestamp || new Date().toISOString(),
      projectName:    projName,
      pageId:         clean(payload.pageId || payload.page_id, '00'),
      pageName:       files.length > 0 ? files[0] : clean(payload.pageName, projName),
      filePath:       files[0] || clean(payload.pageName, '') || folder,
      folder,
      content,
      sessionId:      clean(payload.sessionId, ''),
      generatedFiles: files,
      rawPayload:     payload,
      status:         'received',
    };
  }

  // Legacy format (per-page from File Creation node)
  const content = clean(payload.content || payload.output, '');
  return {
    id:             uuidv4(),
    timestamp:      new Date().toISOString(),
    projectName:    clean(payload.project_name || payload.global_context?.project_name, 'Unknown Project'),
    pageId:         clean(payload.page_id, '00'),
    pageName:       clean(payload.page_name, 'unknown'),
    filePath:       clean(payload.archivo_creado, ''),
    folder:         clean(payload.carpeta, ''),
    content,
    sessionId:      clean(payload.sessionId, ''),
    generatedFiles: [],
    rawPayload:     payload,
    status:         'received',
  };
}

// ─── Push a generated file to the user's selected GitHub repo ───────────────
async function pushToGitHub(user, build) {
  const github = user?.github;
  if (!github?.accessToken || !github?.selectedRepo || !build.content) return;

  const [owner, repo] = github.selectedRepo.split('/');
  const rawFile  = build.filePath || build.pageName || `page_${build.pageId}`;
  const baseName = path.basename(rawFile);
  const fileName = baseName.includes('.') ? baseName : `${baseName}.md`;
  const safeProjName = (build.projectName || 'project').replace(/[^a-z0-9_-]/gi, '_');
  const filePath = `generated-files/${safeProjName}/${fileName}`;

  try {
    const octokit = new Octokit({ auth: github.accessToken });

    // Check if file already exists (need its SHA for update)
    let sha;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
      sha = data.sha;
    } catch { /* file doesn't exist yet — that's fine */ }

    await octokit.repos.createOrUpdateFileContents({
      owner, repo, path: filePath,
      message: `Add ${fileName} — generated by n8n pipeline`,
      content: Buffer.from(build.content).toString('base64'),
      ...(sha ? { sha } : {}),
    });

    console.log(`[Webhook] Pushed to GitHub: ${github.selectedRepo}/${filePath}`);
    return `https://github.com/${github.selectedRepo}/blob/main/${filePath}`;
  } catch (err) {
    console.error(`[Webhook] GitHub push failed: ${err.message}`);
  }
}

// ─── POST /api/webhook/n8n ────────────────────────────────────────────────────
// Receives build results from n8n and broadcasts them via Socket.IO.
router.post('/n8n', (req, res) => {
  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');

  const payload = req.body;

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ success: false, error: 'Payload must be a JSON object.' });
  }

  const hasNewFormat  = 'projectName' in payload;
  const hasOldFormat  = 'project_name' in payload || 'page_name' in payload;

  if (!hasNewFormat && !hasOldFormat) {
    return res.status(400).json({
      success: false,
      error:   'Payload must include projectName (new format) or project_name / page_name (legacy format).',
    });
  }

  // ── Normalise ────────────────────────────────────────────────────────────────
  let build;
  try {
    build = normalizeBuild(payload);
  } catch (err) {
    db.addError({ source: 'webhook', message: `Normalisation failed: ${err.message}`, buildId: null });
    return res.status(422).json({ success: false, error: `Normalisation failed: ${err.message}` });
  }

  // ── Resolve userId + userName from sessionId ─────────────────────────────────
  const sessionUserMap = req.app.get('sessionUserMap');
  const userId = (build.sessionId && sessionUserMap)
    ? (sessionUserMap.get(build.sessionId) ?? null)
    : null;
  build.userId = userId;
  const userRecord  = userId ? findById(userId) : null;
  const userSegment = userRecord
    ? userRecord.name.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')
    : (userId || 'shared');

  // ── Save file content to disk under username folder (matches n8n NAS structure)
  const localFilePath = saveFileToDisk(build, userSegment);
  if (localFilePath) build.localFilePath = localFilePath;

  // ── Push to user's GitHub repo ───────────────────────────────────────────────
  const userToken = req.query.userToken || req.body.userToken;
  if (userToken) {
    const user = findByWebhookToken(userToken);
    if (user) {
      pushToGitHub(user, build).then(ghUrl => {
        if (ghUrl) {
          build.githubUrl = ghUrl;
          const room = 'user:' + user.id;
          io.to(room).emit('build:update', build);
        }
      });
    }
  }

  // ── Persist to disk so builds survive server restarts ────────────────────────
  db.addBuild(build, 'web');

  // ── Update pipeline status ───────────────────────────────────────────────────
  updateState({ pipeline: { n8n: 'done', webhook: 'done' } });
  io.emit('pipeline:step', { step: 'webhook', status: 'done' });

  // ── Emit build only to owning user (or broadcast if unknown) ─────────────────
  if (userId) {
    io.to('user:' + userId).emit('build:update',    build);
    io.to('user:' + userId).emit('webhook:received', build);
  } else {
    io.emit('build:update',    build);
    io.emit('webhook:received', build);
  }

  console.log(`[Webhook] ${build.projectName} | ${build.pageName} | user=${userId ?? 'unknown'} | id=${build.id}`);

  res.status(200).json({ success: true, buildId: build.id });
});

// ─── POST /api/webhook/wp ─────────────────────────────────────────────────────
// Receives WordPress pipeline builds separately from web builds.
router.post('/wp', (req, res) => {
  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');
  const payload     = req.body;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return res.status(400).json({ success: false, error: 'Payload must be a JSON object.' });
  }

  const hasNewFormat = 'projectName' in payload;
  const hasOldFormat = 'project_name' in payload || 'page_name' in payload;
  if (!hasNewFormat && !hasOldFormat) {
    return res.status(400).json({ success: false, error: 'Missing projectName or project_name.' });
  }

  let build;
  try {
    build = normalizeBuild(payload);
    build.source = 'wordpress'; // tag so frontend can distinguish
  } catch (err) {
    return res.status(422).json({ success: false, error: `Normalisation failed: ${err.message}` });
  }

  // Resolve userId + userName from sessionId
  const sessionUserMap = req.app.get('sessionUserMap');
  const userId = (build.sessionId && sessionUserMap)
    ? (sessionUserMap.get(build.sessionId) ?? null)
    : null;
  build.userId = userId;
  const wpUserRecord  = userId ? findById(userId) : null;
  const wpUserSegment = wpUserRecord
    ? wpUserRecord.name.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')
    : (userId || 'shared');

  const localFilePath = saveFileToDisk(build, wpUserSegment);
  if (localFilePath) build.localFilePath = localFilePath;

  // Push to GitHub if userToken provided
  const userToken = req.query.userToken || req.body.userToken;
  if (userToken) {
    const user = findByWebhookToken(userToken);
    if (user) {
      pushToGitHub(user, build).then(ghUrl => {
        if (ghUrl) {
          build.githubUrl = ghUrl;
          io.to('user:' + user.id).emit('wpbuild:update', build);
        }
      });
    }
  }

  // Persist to disk
  db.addBuild(build, 'wordpress');

  updateState({ pipeline: { wordpress: 'done' } });

  if (userId) {
    io.to('user:' + userId).emit('wpbuild:update', build);
  } else {
    io.emit('wpbuild:update', build);
  }
  io.emit('pipeline:step', { step: 'wordpress', status: 'done' });

  console.log(`[WP Webhook] ${build.projectName} | ${build.pageName} | user=${userId ?? 'unknown'} | id=${build.id}`);
  res.status(200).json({ success: true, buildId: build.id });
});

// ─── GET /api/webhook/wp ──────────────────────────────────────────────────────
router.get('/wp', (req, res) => {
  res.json({ status: 'ready', method: 'This endpoint only accepts POST requests from the WP n8n pipeline.' });
});

// ─── GET /api/webhook/n8n ────────────────────────────────────────────────────
router.get('/n8n', (req, res) => {
  res.json({ status: 'ready', method: 'This endpoint only accepts POST requests from n8n.' });
});

// ─── POST /api/webhook/chat-response ─────────────────────────────────────────
// n8n sends the Lead PM's conversational reply here so the dashboard can show it.
// Add an HTTP Request node in n8n (parallel to Tech Lead) pointing to this endpoint:
//   POST https://<your-backend>/api/webhook/chat-response
//   Body: { "sessionId": "{{ $('When chat message received').item.json.sessionId }}",
//           "output":    "{{ $('Lead Project Manager').item.json.output }}" }
router.post('/chat-response', (req, res) => {
  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');
  const { sessionId, output } = req.body;
  if (!output) return res.status(400).json({ error: 'output is required' });

  // Route chat response only to the user who owns this session
  const sessionUserMap = req.app.get('sessionUserMap');
  const userId = sessionId ? sessionUserMap?.get(sessionId) : null;

  if (userId) {
    io.to('user:' + userId).emit('chat:response', { sessionId: sessionId || '', output: String(output) });
  } else {
    io.emit('chat:response', { sessionId: sessionId || '', output: String(output) });
  }

  // Lead PM replied — n8n is no longer waiting on user input, reset pipeline step
  updateState({ pipeline: { n8n: 'idle' } });
  io.emit('pipeline:step', { step: 'n8n', status: 'idle' });

  console.log(`[Webhook] chat:response session=${sessionId} user=${userId ?? 'broadcast'} → "${String(output).slice(0, 80)}"`);
  res.json({ ok: true });
});

// ─── GET /api/webhook/builds ──────────────────────────────────────────────────
const { requireAuth } = require('../middleware/auth');
router.get('/builds', requireAuth, (req, res) => {
  const { builds } = require('../db').getBuildsForUser(req.user.id);
  res.json(builds);
});

module.exports = router;
