const jwt        = require('jsonwebtoken');
const { findById } = require('../utils/users');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
if (!process.env.JWT_SECRET) {
  console.warn('[auth] WARNING: JWT_SECRET env var not set — using insecure default. Set JWT_SECRET in Render environment.');
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '4h' });
}

function requireAuth(req, res, next) {
  const header     = req.headers.authorization;
  const queryToken = req.query._token; // for OAuth redirect flows
  const raw        = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;

  if (!raw) return res.status(401).json({ error: 'Unauthorised — no token' });

  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    const user    = findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { signToken, requireAuth, requireAdmin, JWT_SECRET };
