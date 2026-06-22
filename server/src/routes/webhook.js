const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs');
const path = require('path');
const { Octokit }            = require('@octokit/rest');
const { findByWebhookToken } = require('../utils/users');
const db                     = require('../db');

// All generated files land here: <project-root>/projects/<projectName>/
const PROJECTS_DIR = path.join(__dirname, '..', '..', '..', 'projects');

// Valid WordPress/web theme file extensions
const VALID_THEME_EXTS = new Set([
  '.php', '.css', '.js', '.html', '.htm',
  '.json', '.txt', '.pot', '.png', '.jpg', '.jpeg', '.svg', '.webp',
  '.md', '.xml', '.htaccess',
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

function saveFileToDisk(build) {
  if (!build.content) return null;
  try {
    const safeName = build.projectName.replace(/[^a-z0-9_-]/gi, '_');
    const dir = path.join(PROJECTS_DIR, safeName);
    fs.mkdirSync(dir, { recursive: true });

    const rawFile  = build.filePath || build.pageName || `page_${build.pageId}`;
    const baseName = path.basename(rawFile);
    const ext      = path.extname(baseName).toLowerCase();
    const fileName = ext ? baseName : `${baseName}.md`;

    // Skip garbage files — path-encoded names, prompt files, unknown extensions
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
    db.addError({ source: 'webhook', message: `Normalisation failed: ${err.message}`, buildId: null });
    return res.status(422).json({ success: false, error: `Normalisation failed: ${err.message}` });
  }

  // ── Save file content to local disk ─────────────────────────────────────────
  const localFilePath = saveFileToDisk(build);
  if (localFilePath) build.localFilePath = localFilePath;

  // ── Push to user's GitHub repo (if webhook token provided) ──────────────────
  const userToken = req.query.userToken || req.body.userToken;
  if (userToken) {
    const user = findByWebhookToken(userToken);
    if (user) {
      pushToGitHub(user, build).then(ghUrl => {
        if (ghUrl) {
          build.githubUrl = ghUrl;
          io.emit('build:update', build);
        }
      });
    }
  }

  // ── Persist in-memory (cap at 50 builds) ────────────────────────────────────
  state.builds.unshift(build);
  if (state.builds.length > 50) state.builds.pop();

  // ── Persist to disk so builds survive server restarts ───────────────────────
  db.addBuild(build, 'web');

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

// ─── POST /api/webhook/wp ─────────────────────────────────────────────────────
// Receives WordPress pipeline builds separately from web builds.
router.post('/wp', (req, res) => {
  const io          = req.app.get('io');
  const updateState = req.app.get('updateState');
  const state       = req.app.get('state');
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

  const localFilePath = saveFileToDisk(build);
  if (localFilePath) build.localFilePath = localFilePath;

  // Push to GitHub if userToken provided
  const userToken = req.query.userToken || req.body.userToken;
  if (userToken) {
    const user = findByWebhookToken(userToken);
    if (user) {
      pushToGitHub(user, build).then(ghUrl => {
        if (ghUrl) { build.githubUrl = ghUrl; io.emit('wpbuild:update', build); }
      });
    }
  }

  // Store in wpBuilds (separate from web builds)
  state.wpBuilds = state.wpBuilds || [];
  state.wpBuilds.unshift(build);
  if (state.wpBuilds.length > 50) state.wpBuilds.pop();

  // Persist to disk
  db.addBuild(build, 'wordpress');

  updateState({ latestWpBuild: build });

  io.emit('wpbuild:update', build);
  io.emit('pipeline:step', { step: 'wordpress', status: 'done' });

  console.log(`[WP Webhook] ${build.projectName} | ${build.pageName} | id=${build.id}`);
  res.status(200).json({ success: true, buildId: build.id });
});

// ─── GET /api/webhook/wp ──────────────────────────────────────────────────────
router.get('/wp', (req, res) => {
  const state = req.app.get('state');
  res.json({
    status:     'ready',
    method:     'This endpoint only accepts POST requests from the WP n8n pipeline.',
    wpBuilds:   (state.wpBuilds || []).length,
    latestWpBuild: state.latestWpBuild
      ? { projectName: state.latestWpBuild.projectName, timestamp: state.latestWpBuild.timestamp }
      : null,
  });
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
