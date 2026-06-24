const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(__dirname, '..', '..', '..', 'projects');

const TEXT_EXTS = new Set([
  '.php', '.css', '.js', '.ts', '.tsx', '.jsx', '.html', '.htm',
  '.json', '.txt', '.md', '.xml', '.sql', '.pot', '.htaccess', '.env',
  '.sh', '.yml', '.yaml',
]);
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.woff', '.woff2']);

function walkDir(dir, relBase = '') {
  const entries = [];
  let items;
  try { items = fs.readdirSync(dir); } catch { return entries; }

  for (const name of items) {
    const full = path.join(dir, name);
    const rel  = relBase ? `${relBase}/${name}` : name;
    let stat;
    try { stat = fs.statSync(full); } catch { continue; }

    if (stat.isDirectory()) {
      entries.push({ type: 'dir', name, path: rel, children: [] });
      entries.push(...walkDir(full, rel));
    } else {
      entries.push({
        type: 'file',
        name,
        path: rel,
        size: stat.size,
        ext:  path.extname(name).toLowerCase(),
        mtime: stat.mtimeMs,
      });
    }
  }
  return entries;
}

function buildTree(entries) {
  const root = { children: {} };
  for (const e of entries) {
    const parts = e.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) node.children[parts[i]] = { name: parts[i], type: 'dir', children: {} };
      node = node.children[parts[i]];
    }
    const leaf = parts[parts.length - 1];
    node.children[leaf] = { ...e, children: e.type === 'dir' ? {} : undefined };
  }
  function flatten(node) {
    if (!node.children) return node;
    return { ...node, children: Object.values(node.children).map(flatten).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    })};
  }
  return Object.values(root.children).map(flatten).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function getProjectType(name) {
  if (name.startsWith('wp_'))  return 'wordpress';
  if (name.startsWith('web_')) return 'react';
  return 'unknown';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── GET /api/projects ──────────────────────────────────────────────────────────
// PROJECTS_DIR layout: <PROJECTS_DIR>/<userSegment>/<projectName>/...
// We flatten all user segments so the API returns all projects with a userSegment field.
router.get('/', (req, res) => {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return res.json({ projects: [], projectsDir: PROJECTS_DIR });
  }

  const projects = [];
  let topLevel;
  try { topLevel = fs.readdirSync(PROJECTS_DIR); } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  for (const segment of topLevel) {
    const segPath = path.join(PROJECTS_DIR, segment);
    let segStat;
    try { segStat = fs.statSync(segPath); } catch { continue; }
    if (!segStat.isDirectory()) continue;

    // Check if this directory IS a project (starts with web_ or wp_) or a user segment
    const isProject = /^(web_|wp_)/.test(segment);

    if (isProject) {
      // Legacy flat layout: project sits directly in PROJECTS_DIR
      pushProject(projects, PROJECTS_DIR, segment, 'shared');
    } else {
      // User segment folder — each child is a project
      let projectNames;
      try { projectNames = fs.readdirSync(segPath); } catch { continue; }
      for (const projName of projectNames) {
        const projPath = path.join(segPath, projName);
        let projStat;
        try { projStat = fs.statSync(projPath); } catch { continue; }
        if (!projStat.isDirectory()) continue;
        pushProject(projects, segPath, projName, segment);
      }
    }
  }

  projects.sort((a, b) => {
    if (!a.lastModified) return 1;
    if (!b.lastModified) return -1;
    return new Date(b.lastModified) - new Date(a.lastModified);
  });

  res.json({ projects, projectsDir: PROJECTS_DIR });
});

function pushProject(projects, parentDir, name, userSegment) {
  const projPath  = path.join(parentDir, name);
  const entries   = walkDir(projPath);
  const files     = entries.filter(e => e.type === 'file');
  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
  const lastMtime = files.reduce((m, f) => Math.max(m, f.mtime || 0), 0);

  const extCounts = {};
  for (const f of files) {
    extCounts[f.ext] = (extCounts[f.ext] || 0) + 1;
  }

  projects.push({
    name,
    userSegment,
    type:         getProjectType(name),
    fileCount:    files.length,
    totalSize,
    totalSizeFmt: formatSize(totalSize),
    lastModified: lastMtime ? new Date(lastMtime).toISOString() : null,
    extCounts,
    topFiles:     files.filter(f => !f.path.includes('/')).map(f => f.name),
  });
}

// Resolve a project name → absolute directory, searching all user segments.
function resolveProjectDir(name) {
  const safe = path.basename(name);
  // Direct (legacy flat layout)
  const direct = path.join(PROJECTS_DIR, safe);
  if (fs.existsSync(direct)) return direct;
  // Search inside user-segment subdirectories
  let segments;
  try { segments = fs.readdirSync(PROJECTS_DIR); } catch { return null; }
  for (const seg of segments) {
    const candidate = path.join(PROJECTS_DIR, seg, safe);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ── GET /api/projects/:name/tree ──────────────────────────────────────────────
router.get('/:name/tree', (req, res) => {
  const projDir = resolveProjectDir(req.params.name);
  if (!projDir) return res.status(404).json({ error: 'Project not found' });

  const safeName = path.basename(projDir);
  const entries  = walkDir(projDir);
  const tree     = buildTree(entries);
  const files    = entries.filter(e => e.type === 'file');

  res.json({
    name:      safeName,
    type:      getProjectType(safeName),
    tree,
    fileCount: files.length,
    totalSize: files.reduce((s, f) => s + (f.size || 0), 0),
  });
});

// ── GET /api/projects/:name/file?path=relative/path ───────────────────────────
router.get('/:name/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path query param required' });

  const projDir = resolveProjectDir(req.params.name);
  if (!projDir) return res.status(404).json({ error: 'Project not found' });

  // Security: resolve and ensure it stays inside the project dir
  const fullPath = path.resolve(projDir, filePath);
  if (!fullPath.startsWith(projDir + path.sep) && fullPath !== projDir) {
    return res.status(403).json({ error: 'Path traversal denied' });
  }

  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) return res.status(400).json({ error: 'Path is a directory' });

  const ext = path.extname(filePath).toLowerCase();

  if (BINARY_EXTS.has(ext)) {
    return res.sendFile(fullPath);
  }

  if (TEXT_EXTS.has(ext) || !ext) {
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      return res.json({ content, size: stat.size, ext });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(415).json({ error: `Unsupported file type: ${ext}` });
});

module.exports = router;
