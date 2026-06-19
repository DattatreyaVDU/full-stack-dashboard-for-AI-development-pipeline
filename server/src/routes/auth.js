const express = require('express');
const router  = express.Router();
const { createUser, verifyPassword, updateUser, findByEmail, safeUser } = require('../utils/users');
const { signToken, requireAuth } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const user  = await createUser({ name, email, password });
    const token = signToken(user.id);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const user = await verifyPassword(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user.id);
  res.json({ token, user: safeUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// PATCH /api/auth/profile  — update name and/or email
router.patch('/profile', requireAuth, async (req, res) => {
  const { name, email } = req.body ?? {};
  if (!name && !email)
    return res.status(400).json({ error: 'Provide name or email to update' });

  const updates = {};
  if (name?.trim())  updates.name  = name.trim();
  if (email?.trim()) {
    const existing = findByEmail(email.trim());
    if (existing && existing.id !== req.user.id)
      return res.status(409).json({ error: 'Email already in use' });
    updates.email = email.trim().toLowerCase();
  }

  try {
    const updated = updateUser(req.user.id, updates);
    res.json({ user: safeUser(updated) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/password  — change password
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const bcrypt = require('bcryptjs');
  const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash    = await bcrypt.hash(newPassword, 10);
  const updated = updateUser(req.user.id, { passwordHash: hash });
  res.json({ user: safeUser(updated) });
});

module.exports = router;
