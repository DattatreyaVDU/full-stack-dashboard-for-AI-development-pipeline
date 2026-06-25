const express = require('express');
const router  = express.Router();
const {
  loadUsers, findById, deleteUser, resetWebhookToken,
  refreshVerificationToken, updateUser, safeUser,
} = require('../utils/users');
const { requireAdmin } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/email');
const db = require('../db');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = loadUsers().map(safeUser);
  res.json({ users });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const users = loadUsers();
  const { builds, wpBuilds } = db.getAllBuilds();
  res.json({
    totalUsers:       users.length,
    adminCount:       users.filter(u => u.role === 'admin').length,
    githubConnected:  users.filter(u => u.github?.selectedRepo).length,
    totalBuilds:      builds.length,
    totalWpBuilds:    wpBuilds.length,
    totalErrors:      db.getErrors(500).length,
    uptimeSeconds:    Math.floor(process.uptime()),
    memoryMB:         Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

// GET /api/admin/errors?limit=100
router.get('/errors', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
  const source = req.query.source;
  let errors = db.getErrors(500);
  if (source) errors = errors.filter(e => e.source === source);
  res.json({ errors: errors.slice(0, limit), total: errors.length });
});

// DELETE /api/admin/errors
router.delete('/errors', (req, res) => {
  db.clearErrors();
  res.json({ success: true });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    deleteUser(id);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/reset-token
router.post('/users/:id/reset-token', (req, res) => {
  try {
    const updated = resetWebhookToken(req.params.id);
    res.json({ user: safeUser(updated) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/send-verification
router.post('/users/:id/send-verification', async (req, res) => {
  const user = findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.emailVerified) return res.status(400).json({ error: 'Email is already verified' });

  const updated   = refreshVerificationToken(user.id);
  const verifyUrl = `${FRONTEND_URL}/verify?token=${updated.verificationToken}`;
  const sent      = await sendVerificationEmail(updated, verifyUrl);

  res.json({
    success: sent,
    message: sent
      ? `Verification email sent to ${user.email}`
      : 'Email queued (SMTP may not be configured — check server logs)',
  });
});

// PATCH /api/admin/users/:id/verify — manually mark as verified without email
router.patch('/users/:id/verify', (req, res) => {
  const user = findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = updateUser(user.id, {
    emailVerified:     true,
    verificationToken:  null,
    verificationExpiry: null,
  });
  res.json({ user: safeUser(updated) });
});

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or user' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }
  try {
    const updated = updateUser(req.params.id, { role });
    res.json({ user: safeUser(updated) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
