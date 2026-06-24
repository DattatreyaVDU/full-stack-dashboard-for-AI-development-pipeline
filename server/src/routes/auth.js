const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const {
  createUser, verifyPassword, updateUser, findByEmail, findById,
  findByVerificationToken, refreshVerificationToken, deleteUser, safeUser, loadUsers,
} = require('../utils/users');
const { signToken, requireAuth } = require('../middleware/auth');
const { sendVerificationEmail }  = require('../utils/email');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const user  = await createUser({ name, email, password });
    const token = signToken(user.id);

    // Send verification email in background — don't block registration
    const verifyUrl = `${FRONTEND_URL}/verify?token=${user.verificationToken}`;
    sendVerificationEmail(user, verifyUrl).catch(() => {});

    res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const user = await verifyPassword(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user.id);
  res.json({ token, user: safeUser(user) });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ── GET /api/auth/verify/:token ───────────────────────────────────────────────
router.get('/verify/:token', (req, res) => {
  const { token } = req.params;
  const user = findByVerificationToken(token);

  if (!user) {
    return res.status(400).json({ error: 'Invalid or expired verification link.' });
  }
  if (new Date(user.verificationExpiry) < new Date()) {
    return res.status(400).json({ error: 'This verification link has expired. Please request a new one.' });
  }
  if (user.emailVerified) {
    return res.json({ message: 'Email already verified.' });
  }

  updateUser(user.id, {
    emailVerified:    true,
    verificationToken:  null,
    verificationExpiry: null,
  });
  res.json({ message: 'Email verified successfully. You can now use your account.' });
});

// ── POST /api/auth/resend-verification ───────────────────────────────────────
router.post('/resend-verification', requireAuth, async (req, res) => {
  const user = findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.emailVerified) return res.status(400).json({ error: 'Email is already verified' });

  const updated   = refreshVerificationToken(user.id);
  const verifyUrl = `${FRONTEND_URL}/verify?token=${updated.verificationToken}`;
  const sent      = await sendVerificationEmail(updated, verifyUrl);

  res.json({ message: sent ? 'Verification email sent.' : 'Email queued (check server logs if not received).' });
});

// ── PATCH /api/auth/profile ───────────────────────────────────────────────────
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

// ── PATCH /api/auth/password ──────────────────────────────────────────────────
router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash    = await bcrypt.hash(newPassword, 10);
  const updated = updateUser(req.user.id, { passwordHash: hash });
  res.json({ user: safeUser(updated) });
});

// ── DELETE /api/auth/account ──────────────────────────────────────────────────
// User deletes their own account. Requires password confirmation.
router.delete('/account', requireAuth, async (req, res) => {
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ error: 'password is required to confirm deletion' });

  // Prevent deleting the last admin
  const allUsers = loadUsers();
  const isLastAdmin =
    req.user.role === 'admin' &&
    allUsers.filter(u => u.role === 'admin').length === 1;
  if (isLastAdmin) {
    return res.status(400).json({ error: 'Cannot delete the last admin account. Promote another user first.' });
  }

  const ok = await bcrypt.compare(password, req.user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect password' });

  try {
    deleteUser(req.user.id);
    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
