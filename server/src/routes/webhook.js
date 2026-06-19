const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs');
const path = require('path');

// All generated files land here: <project-root>/projects/<projectName>/
const PROJECTS_DIR = path.join(__dirname, '..', '..', '..', 'projects');

function saveFileToDisk(build) {
  if (!build.content) return null;
  try {
    const safeName = build.projectName.replace(/[^a-z0-9_-]/gi, '_');
    const dir = path.join(PROJECTS_DIR, safeName);
    fs.mkdirSync(dir, { recursive: true });

    const rawFile = build.filePath || build.pageName || `page_${build.pageId}`;
    const baseName = path.basename(rawFile);
    const fileName = baseName.includes('.') ? baseName : `${baseName}.md`;
    const fullPath = path.join(dir, fileName);

    fs.writeFileSync(fullPath, build.content, 'utf8');
    console.log(`[Webhook] Saved → ${fullPath}`);
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
// Strip unevaluated n8n expressions like {{ $json.foo }} — treat as missing
function clean(val, fallback = '') {
  if (!val || typeof val !== 'string') return fallback;
  if (val.includes('{{') || val.includes('}}')) return fallback;
  return val.trim() || fallback;
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
    generatedFiles: [],
    rawPayload:     payload,
    status:         'received',
  };
}

// ─── POST /api/webhook/n8n ────────────────────────────────────────────────────
// Receives build results from n8n and broadcasts them via Socket.IO.
router.post('/n8n', (req, res) => {
  const io           = req.app.get('io');
  const updateState  = req.app.get('updateState');
  const state        = req.app.get('state');

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
    return res.status(422).json({ success: false, error: `Normalisation failed: ${err.message}` });
  }

  // ── Save file content to local disk ─────────────────────────────────────────
  const localFilePath = saveFileToDisk(build);
  if (localFilePath) build.localFilePath = localFilePath;

  // ── Persist in-memory (cap at 50 builds) ────────────────────────────────────
  state.builds.unshift(build);
  if (state.builds.length > 50) state.builds.pop();

  // ── Update shared dashboard state ───────────────────────────────────────────
  // updateState also calls io.emit('state:update', dashboardState) internally.
  updateState({
    latestBuild: build,
    pipeline: { n8n: 'done', webhook: 'done' },
  });

  // ── Emit Socket.IO events ───────────────────────────────────────────────────
  io.emit('build:update',    build);          // primary event (new)
  io.emit('webhook:received', build);         // backward compat — frontend already listens
  io.emit('pipeline:step',  { step: 'webhook', status: 'done' });

  console.log(`[Webhook] ${build.projectName} | ${build.pageName} | id=${build.id}`);

  res.status(200).json({ success: true, buildId: build.id });
});

// ─── GET /api/webhook/n8n ────────────────────────────────────────────────────
// Health-check so hitting the URL in a browser gives a useful response.
router.get('/n8n', (req, res) => {
  const state = req.app.get('state');
  res.json({
    status:     'ready',
    method:     'This endpoint only accepts POST requests from n8n.',
    buildsKept: state.builds.length,
    latestBuild: state.latestBuild
      ? { projectName: state.latestBuild.projectName, timestamp: state.latestBuild.timestamp }
      : null,
  });
});

// ─── GET /api/webhook/builds ──────────────────────────────────────────────────
// Returns stored build history (latest first).
router.get('/builds', (req, res) => {
  const state = req.app.get('state');
  res.json(state.builds || []);
});

module.exports = router;
