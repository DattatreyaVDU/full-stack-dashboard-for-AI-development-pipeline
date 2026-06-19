const fs     = require('fs');
const path   = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR  = path.join(__dirname, '..', '..', 'data');
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

async function createUser({ name, email, password }) {
  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already registered');
  }
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id:           uuidv4(),
    name,
    email,
    passwordHash: hash,
    role:         users.length === 0 ? 'admin' : 'user', // first user is admin
    webhookToken: uuidv4().replace(/-/g, ''),
    github:       null,  // { accessToken, username, selectedRepo }
    createdAt:    new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return user;
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

// Strip passwordHash before sending to client
function safeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = { loadUsers, findByEmail, findById, findByWebhookToken, createUser, verifyPassword, updateUser, resetWebhookToken, deleteUser, safeUser };
