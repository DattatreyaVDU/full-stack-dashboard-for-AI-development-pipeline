const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');
const AdmZip  = require('adm-zip');

const PROJECTS_DIR = path.join(__dirname, '..', '..', '..', 'projects');

// GET /api/download?project=<folderName>
// Zips all .md files in the project folder and returns the zip for download.
router.get('/', (req, res) => {
  const projectParam = req.query.project;

  if (!projectParam) {
    return res.status(400).json({ error: 'project query param is required' });
  }

  // Sanitise to prevent path traversal
  const safeName = path.basename(projectParam).replace(/\.\./g, '');
  const projectDir = path.join(PROJECTS_DIR, safeName);

  if (!fs.existsSync(projectDir)) {
    return res.status(404).json({
      error: `Project folder not found: ${safeName}`,
      looked: projectDir,
    });
  }

  const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    return res.status(404).json({ error: 'No .md files found in project folder.' });
  }

  const zip = new AdmZip();

  files.forEach(file => {
    const fullPath = path.join(projectDir, file);
    zip.addLocalFile(fullPath);
  });

  const zipBuffer = zip.toBuffer();
  const zipName   = `${safeName}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  res.setHeader('Content-Length', zipBuffer.length);
  res.send(zipBuffer);

  console.log(`[Download] ${zipName} — ${files.length} files — ${zipBuffer.length} bytes`);
});

// GET /api/download/list — returns available projects that have .md files
router.get('/list', (req, res) => {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return res.json({ projects: [] });
  }

  const projects = fs.readdirSync(PROJECTS_DIR)
    .filter(name => {
      const fullPath = path.join(PROJECTS_DIR, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .map(name => {
      const dir   = path.join(PROJECTS_DIR, name);
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      return { name, fileCount: files.length, files };
    })
    .filter(p => p.fileCount > 0);

  res.json({ projects });
});

module.exports = router;
