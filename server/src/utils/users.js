const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR   = path.join(__dirname, '..', '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch { return []; }
}

function saveUsers(users) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findByEmail(email) {
  return loadUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

function findById(id) {
  return loadUsers().find(u => u.id === id) ?? null;
}

function findByWebhookToken(token) {
  return loadUsers().find(u => u.webhookToken === token) ?? null;
}

function findByVerificationToken(token) {
  return loadUsers().find(u => u.verificationToken === token) ?? null;
}

async function createUser({ name, email, password }) {
  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already registered');
  }
  const hash        = await bcrypt.hash(password, 10);
  const isFirstUser = users.length === 0;
  const user = {
    id:                  uuidv4(),
    name,
    email,
    passwordHash:        hash,
    role:                isFirstUser ? 'admin' : 'user',
    webhookToken:        uuidv4().replace(/-/g, ''),
    github:              null,
    emailVerified:       isFirstUser ? true : false,   // first admin bootstraps without email
    verificationToken:   uuidv4(),
    verificationExpiry:  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt:           new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
}

function refreshVerificationToken(id) {
  return updateUser(id, {
    verificationToken:  uuidv4(),
    verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

function resetWebhookToken(id) {
  return updateUser(id, { webhookToken: uuidv4().replace(/-/g, '') });
}

function deleteUser(id) {
  const users = loadUsers();
  const idx   = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  users.splice(idx, 1);
  saveUsers(users);
}

async function verifyPassword(email, password) {
  const user = findByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

function updateUser(id, updates) {
  const users = loadUsers();
  const idx   = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return users[idx];
}

// Strip sensitive fields before sending to client
function safeUser(user) {
  const { passwordHash, verificationToken, verificationExpiry, ...safe } = user;
  // Accounts created before email verification was added default to verified
  if (safe.emailVerified === undefined) safe.emailVerified = true;
  return safe;
}

module.exports = {
  loadUsers, findByEmail, findById, findByWebhookToken, findByVerificationToken,
  createUser, verifyPassword, updateUser, resetWebhookToken, refreshVerificationToken,
  deleteUser, safeUser,
};
