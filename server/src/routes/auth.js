const express = require('express');
const router  = express.Router();
const { createUser, verifyPassword, safeUser } = require('../utils/users');
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

// GET /api/auth/me  — returns current user profile
router.get('/me', requireAuth, (req, res) => {
  const { safeUser } = require('../utils/users');
  res.json({ user: safeUser(req.user) });
});

module.exports = router;
