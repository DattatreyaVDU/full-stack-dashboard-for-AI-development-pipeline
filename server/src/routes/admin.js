const express = require('express');
const router  = express.Router();
const { loadUsers, findById, deleteUser, resetWebhookToken, safeUser } = require('../utils/users');
const { requireAdmin } = require('../middleware/auth');

// All admin routes require admin role
router.use(requireAdmin);

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = loadUsers().map(safeUser);
  res.json({ users });
});

// GET /api/admin/stats
router.get('/stats', (req, res) => {
  const state = req.app.get('state');
  const users = loadUsers();
  res.json({
    totalUsers:       users.length,
    adminCount:       users.filter(u => u.role === 'admin').length,
    githubConnected:  users.filter(u => u.github?.selectedRepo).length,
    totalBuilds:      (state?.builds ?? []).length,
    uptimeSeconds:    Math.floor(process.uptime()),
  });
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
    const { updateUser } = require('../utils/users');
    const updated = updateUser(req.params.id, { role });
    res.json({ user: safeUser(updated) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
