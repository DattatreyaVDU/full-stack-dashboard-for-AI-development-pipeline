const fs   = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'db.json');

const DEFAULTS = { builds: [], wpBuilds: [], errors: [] };

let cache = null;
let flushTimer = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      cache = { ...DEFAULTS, ...JSON.parse(raw) };
      console.log(`[DB] Loaded — builds: ${cache.builds.length}, wpBuilds: ${cache.wpBuilds.length}, errors: ${cache.errors.length}`);
    } else {
      cache = { ...DEFAULTS };
      console.log('[DB] No db.json found — starting fresh');
    }
  } catch (e) {
    console.error('[DB] Load failed:', e.message);
    cache = { ...DEFAULTS };
  }
  return cache;
}

function flush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
      console.error('[DB] Write failed:', e.message);
    }
  }, 300);
}

function addBuild(build, type = 'web') {
  load();
  const key = type === 'wordpress' ? 'wpBuilds' : 'builds';
  cache[key].unshift(build);
  if (cache[key].length > 100) cache[key] = cache[key].slice(0, 100);
  flush();
}

function getBuilds(type = 'web') {
  load();
  return type === 'wordpress' ? (cache.wpBuilds || []) : (cache.builds || []);
}

function getAllBuilds() {
  load();
  return { builds: cache.builds || [], wpBuilds: cache.wpBuilds || [] };
}

function addError(error) {
  load();
  cache.errors.unshift({
    id:        `err-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...error,
  });
  if (cache.errors.length > 500) cache.errors = cache.errors.slice(0, 500);
  flush();
}

function getErrors(limit = 100) {
  load();
  return (cache.errors || []).slice(0, limit);
}

function clearErrors() {
  load();
  cache.errors = [];
  flush();
}

function getBuildsForUser(userId) {
  load();
  return {
    builds:   (cache.builds   || []).filter(b => b.userId === userId),
    wpBuilds: (cache.wpBuilds || []).filter(b => b.userId === userId),
  };
}

module.exports = { load, addBuild, getBuilds, getAllBuilds, getBuildsForUser, addError, getErrors, clearErrors };
