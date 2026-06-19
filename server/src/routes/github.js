const express = require('express');
const router = express.Router();
const { Octokit } = require('@octokit/rest');

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

const owner = () => process.env.GITHUB_OWNER;
const repo = () => process.env.GITHUB_REPO;
const branch = () => process.env.GITHUB_BRANCH || 'main';

// POST /api/github/config — set credentials at runtime (no server restart needed)
router.post('/config', (req, res) => {
  const { token, owner, repo, branch } = req.body;
  if (token)  process.env.GITHUB_TOKEN  = token;
  if (owner)  process.env.GITHUB_OWNER  = owner;
  if (repo)   process.env.GITHUB_REPO   = repo;
  if (branch) process.env.GITHUB_BRANCH = branch;
  res.json({ success: true });
});

// GET /api/github/status — check connection
router.get('/status', async (req, res) => {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.repos.get({ owner: owner(), repo: repo() });
    res.json({
      connected: true,
      repoName: data.full_name,
      defaultBranch: data.default_branch,
      private: data.private,
      lastPush: data.pushed_at,
    });
  } catch (err) {
    res.status(200).json({ connected: false, error: err.message });
  }
});

// GET /api/github/commits — recent commits
router.get('/commits', async (req, res) => {
  try {
    const octokit = getOctokit();
    const { data } = await octokit.repos.listCommits({
      owner: owner(), repo: repo(), per_page: 10,
    });
    res.json(data.map(c => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message,
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/commit — commit generated file to repo
router.post('/commit', async (req, res) => {
  const { filePath, content, message, projectName } = req.body;
  const updateState = req.app.get('updateState');
  const io = req.app.get('io');

  if (!filePath || !content) {
    return res.status(400).json({ error: 'filePath and content are required' });
  }

  try {
    updateState({ pipeline: { github: 'running' } });
    io.emit('pipeline:step', { step: 'github', status: 'running' });

    const octokit = getOctokit();

    // Check if file exists (to get SHA for update)
    let sha;
    try {
      const { data: existing } = await octokit.repos.getContent({
        owner: owner(), repo: repo(), path: filePath, ref: branch(),
      });
      sha = existing.sha;
    } catch {
      sha = undefined;
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: owner(),
      repo: repo(),
      path: filePath,
      message: message || `feat: add generated file ${filePath} [n8n-dashboard]`,
      content: Buffer.from(content).toString('base64'),
      branch: branch(),
      ...(sha ? { sha } : {}),
    });

    updateState({ pipeline: { github: 'done' } });
    io.emit('pipeline:step', { step: 'github', status: 'done' });

    res.json({
      success: true,
      commit: {
        sha: data.commit.sha.slice(0, 7),
        message: data.commit.message,
        url: data.commit.html_url,
      },
    });
  } catch (err) {
    updateState({ pipeline: { github: 'error' } });
    io.emit('pipeline:step', { step: 'github', status: 'error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/open-vscode — open file in VS Code via URL protocol
router.post('/open-vscode', (req, res) => {
  const { filePath } = req.body;
  const io = req.app.get('io');

  // Send VS Code URL to frontend — the browser will handle the vscode:// protocol
  io.emit('vscode:open', { filePath });

  res.json({ success: true, vscodePath: `vscode://file/${filePath}` });
});

module.exports = router;
