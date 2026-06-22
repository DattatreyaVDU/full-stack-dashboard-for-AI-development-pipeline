const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const AdmZip  = require('adm-zip');

// Files saved by webhook.js when content arrives via HTTP Request body
const PROJECTS_DIR = path.join(__dirname, '..', '..', '..', 'projects');

/**
 * Collect all downloadable files across three sources:
 *  1. PROJECTS_DIR subdirs (files written by webhook.js saveFileToDisk)
 *  2. build.filePath / build.pageName — absolute paths n8n Code node wrote directly
 *  3. build.content — in-memory content from HTTP Request body
 *
 * Returns: Map<projectSafeName, { name, files: [{name, content?, diskPath?}] }>
 */
function collectProjects(state) {
  const projectMap = new Map();

  function ensureProject(safeName) {
    if (!projectMap.has(safeName)) {
      projectMap.set(safeName, { name: safeName, files: new Map() });
    }
    return projectMap.get(safeName);
  }

  const VALID_EXTS = new Set([
    '.php', '.css', '.js', '.ts', '.tsx', '.jsx',
    '.html', '.htm', '.json', '.txt', '.pot',
    '.png', '.jpg', '.jpeg', '.svg', '.webp',
    '.md', '.xml', '.htaccess', '.env', '.sh', '.yml', '.yaml',
  ]);

  function isGarbage(fname) {
    // Reject impossibly long filenames or double-dash CLI artifacts
    if (fname.length > 120) return true;
    if (/^[a-zA-Z][-]{2}/.test(fname)) return true;
    return false;
  }

  // ── 1. Scan PROJECTS_DIR on disk (recursive — preserves src/pages/ structure) ──
  function walkRecursive(dir, projRoot, proj) {
    let items;
    try { items = fs.readdirSync(dir); } catch { return; }
    for (const name of items) {
      const fullPath = path.join(dir, name);
      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }
      if (stat.isDirectory()) {
        walkRecursive(fullPath, projRoot, proj);
      } else {
        const ext     = path.extname(name).toLowerCase();
        const relPath = path.relative(projRoot, fullPath).replace(/\\/g, '/');
        if (VALID_EXTS.has(ext) && !isGarbage(name)) {
          proj.files.set(relPath, { name: relPath, diskPath: fullPath });
        }
      }
    }
  }

  if (fs.existsSync(PROJECTS_DIR)) {
    try {
      fs.readdirSync(PROJECTS_DIR).forEach(name => {
        const fullPath = path.join(PROJECTS_DIR, name);
        if (!fs.statSync(fullPath).isDirectory()) return;
        const proj = ensureProject(name);
        walkRecursive(fullPath, fullPath, proj);
      });
    } catch (e) {
      console.error('[Download] PROJECTS_DIR scan error:', e.message);
    }
  }

  // ── 2 & 3. Scan in-memory builds ───────────────────────────────────────────
  const builds = (state && state.builds) ? state.builds : [];
  builds.forEach(build => {
    if (!build.projectName) return;
    const safeName = build.projectName.replace(/[^a-z0-9_-]/gi, '_');
    const proj     = ensureProject(safeName);

    // Determine the filename for this build's file
    const rawFile  = build.filePath || build.pageName || '';
    const baseName = rawFile ? path.basename(rawFile) : '';
    const fileName = baseName
      ? (baseName.includes('.') ? baseName : baseName + '.md')
      : `page_${build.pageId || '00'}.md`;

    // Skip garbage path-encoded filenames and prompt/context files
    if (isGarbage(fileName)) return;
    const ext = path.extname(fileName).toLowerCase();
    if (ext && !VALID_EXTS.has(ext)) return;

    if (proj.files.has(fileName)) return; // already added from disk scan

    const entry = { name: fileName };

    // Source 2: absolute path written by n8n Code node — try reading it directly
    if (rawFile && path.isAbsolute(rawFile.replace(/\//g, path.sep)) && fs.existsSync(rawFile.replace(/\//g, path.sep))) {
      entry.diskPath = rawFile.replace(/\//g, path.sep);
    } else if (rawFile && fs.existsSync(rawFile)) {
      entry.diskPath = rawFile;
    }

    // Source 3: content in the build object itself
    if (!entry.diskPath && build.content) {
      entry.content = build.content;
    }

    if (entry.diskPath || entry.content) {
      proj.files.set(fileName, entry);
    }
  });

  return projectMap;
}

// ── GET /api/download/list ───────────────────────────────────────────────────
router.get('/list', (req, res) => {
  const state      = req.app.get('state');
  const projectMap = collectProjects(state);

  const projects = [...projectMap.values()]
    .filter(p => p.files.size > 0)
    .map(p => ({
      name:      p.name,
      fileCount: p.files.size,
      files:     [...p.files.keys()],
    }));

  res.json({ projects });
});

// ── GET /api/download?project=<folderName> ───────────────────────────────────
router.get('/', (req, res) => {
  const projectParam = req.query.project;
  if (!projectParam) {
    return res.status(400).json({ error: 'project query param is required' });
  }

  const safeName   = path.basename(projectParam).replace(/\.\./g, '');
  const state      = req.app.get('state');
  const projectMap = collectProjects(state);
  const proj       = projectMap.get(safeName);

  if (!proj || proj.files.size === 0) {
    return res.status(404).json({
      error: `No files found for project: ${safeName}`,
      tip:   'Run the n8n pipeline and wait for builds to arrive.',
    });
  }

  const zip = new AdmZip();

  proj.files.forEach((entry, relPath) => {
    try {
      // Preserve directory structure inside the ZIP (e.g. src/pages/HomePage.tsx)
      const zipDir  = path.dirname(relPath).replace(/\\/g, '/');
      const zipFile = path.basename(relPath);
      const zipPath = zipDir === '.' ? '' : zipDir;
      if (entry.diskPath) {
        zip.addLocalFile(entry.diskPath, zipPath, zipFile);
      } else if (entry.content) {
        zip.addFile(relPath, Buffer.from(entry.content, 'utf8'));
      }
    } catch (e) {
      console.error(`[Download] Failed to add ${relPath}:`, e.message);
    }
  });

  const zipBuffer = zip.toBuffer();
  const zipName   = `${safeName}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Content-Length', zipBuffer.length);
  res.send(zipBuffer);

  console.log(`[Download] ${zipName} — ${proj.files.size} files — ${zipBuffer.length} bytes`);
});

module.exports = router;
