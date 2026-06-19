const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const AdmZip  = require('adm-zip');

const PROJECTS_DIR = path.join(__dirname, '..', '..', '..', 'projects');

// GET /api/download/list — returns available projects from disk OR in-memory builds
router.get('/list', (req, res) => {
  const state = req.app.get('state');
  const projectMap = new Map(); // projectName → { name, files: [{name, content}] }

  // 1. Load from disk (files saved by webhook when content arrived)
  if (fs.existsSync(PROJECTS_DIR)) {
    fs.readdirSync(PROJECTS_DIR)
      .filter(name => {
        const fullPath = path.join(PROJECTS_DIR, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .forEach(name => {
        const dir   = path.join(PROJECTS_DIR, name);
        const files = fs.readdirSync(dir)
          .filter(f => f.endsWith('.md'))
          .map(f => ({ name: f, content: null, fromDisk: true }));
        if (files.length > 0) {
          projectMap.set(name, { name, files, fileCount: files.length });
        }
      });
  }

  // 2. Supplement with in-memory builds (covers case where disk save failed)
  const builds = (state && state.builds) ? state.builds : [];
  builds.forEach(build => {
    if (!build.content || !build.projectName) return;

    const safeName = build.projectName.replace(/[^a-z0-9_-]/gi, '_');
    const rawFile  = build.filePath || build.pageName || `page_${build.pageId}`;
    const baseName = path.basename(rawFile);
    const fileName = baseName.includes('.') ? baseName : `${baseName}.md`;

    if (!projectMap.has(safeName)) {
      projectMap.set(safeName, { name: safeName, files: [], fileCount: 0 });
    }
    const proj = projectMap.get(safeName);
    const already = proj.files.some(f => f.name === fileName);
    if (!already) {
      proj.files.push({ name: fileName, content: build.content, fromMemory: true });
      proj.fileCount = proj.files.length;
    }
  });

  const projects = [...projectMap.values()].map(p => ({
    name:      p.name,
    fileCount: p.files.length,
    files:     p.files.map(f => f.name),
  }));

  res.json({ projects });
});

// GET /api/download?project=<folderName>
// Zips all .md files — tries disk first, falls back to in-memory content
router.get('/', (req, res) => {
  const projectParam = req.query.project;
  if (!projectParam) {
    return res.status(400).json({ error: 'project query param is required' });
  }

  const safeName   = path.basename(projectParam).replace(/\.\./g, '');
  const projectDir = path.join(PROJECTS_DIR, safeName);
  const state      = req.app.get('state');
  const builds     = (state && state.builds) ? state.builds : [];

  const zip = new AdmZip();
  const seen = new Set();

  // 1. Add files from disk
  if (fs.existsSync(projectDir)) {
    fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.md'))
      .forEach(file => {
        const fullPath = path.join(projectDir, file);
        zip.addLocalFile(fullPath);
        seen.add(file);
      });
  }

  // 2. Add files from in-memory builds (not already on disk)
  builds.forEach(build => {
    if (!build.content || !build.projectName) return;
    const bSafeName = build.projectName.replace(/[^a-z0-9_-]/gi, '_');
    if (bSafeName !== safeName) return;

    const rawFile  = build.filePath || build.pageName || `page_${build.pageId}`;
    const baseName = path.basename(rawFile);
    const fileName = baseName.includes('.') ? baseName : `${baseName}.md`;

    if (!seen.has(fileName)) {
      zip.addFile(fileName, Buffer.from(build.content, 'utf8'));
      seen.add(fileName);
    }
  });

  if (seen.size === 0) {
    return res.status(404).json({
      error: `No .md files found for project: ${safeName}`,
      tip: 'Make sure n8n HTTP Request nodes send content field without == prefix.',
    });
  }

  const zipBuffer = zip.toBuffer();
  const zipName   = `${safeName}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Content-Length', zipBuffer.length);
  res.send(zipBuffer);

  console.log(`[Download] ${zipName} — ${seen.size} files — ${zipBuffer.length} bytes`);
});

module.exports = router;
