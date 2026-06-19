require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const webhookRoutes = require('./routes/webhook');
const githubRoutes = require('./routes/github');
const wordpressRoutes = require('./routes/wordpress');
const deployRoutes = require('./routes/deploy');
const n8nRoutes = require('./routes/n8n');
const downloadRoutes = require('./routes/download');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Make io available to routes
app.set('io', io);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }));

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/wordpress', wordpressRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/n8n', n8nRoutes);
app.use('/api/download', downloadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In-memory state (replace with DB for production)
let dashboardState = {
  latestBuild: null,
  pipeline: {
    n8n: 'idle',
    webhook: 'idle',
    github: 'idle',
    vscode: 'idle',
    wordpress: 'idle',
    deploy: 'idle',
  },
  builds: [],
};

app.get('/api/state', (req, res) => res.json(dashboardState));

app.post('/api/state/reset', (req, res) => {
  dashboardState.pipeline = {
    n8n: 'idle', webhook: 'idle', github: 'idle',
    vscode: 'idle', wordpress: 'idle', deploy: 'idle',
  };
  io.emit('state:update', dashboardState);
  res.json({ success: true });
});

// Expose state mutator to routes
app.set('state', dashboardState);
app.set('updateState', (patch) => {
  Object.assign(dashboardState, patch);
  if (patch.pipeline) {
    Object.assign(dashboardState.pipeline, patch.pipeline);
  }
  io.emit('state:update', dashboardState);
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  socket.emit('state:update', dashboardState);

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Dashboard server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🔗 n8n webhook endpoint: http://localhost:${PORT}/api/webhook/n8n\n`);
});
