require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const connectDB = require('./config/db');
const { router: stripeRouter, webhookHandler } = require('./routes/stripe');
const paypalRouter = require('./routes/paypal');
const authRouter = require('./routes/auth');

const app = express();
const server = http.createServer(app);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const io = new Server(server, { cors: { origin: corsOrigin } });
app.set('io', io);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: corsOrigin }));

// Stripe signature verification needs the raw request body,
// so the webhook must mount before express.json().
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  webhookHandler
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: require('../package.json').version,
  });
});

// API routes load before the SPA catch-all so /api/* never falls
// through to index.html.
app.use('/api/auth', authRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/paypal', paypalRouter);

const distDir = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled error: %s', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => {
  logger.info('Dashboard client connected: %s', socket.id);
  socket.on('disconnect', () => {
    logger.info('Dashboard client disconnected: %s', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      logger.info('NoblePort backend listening on port %d', PORT);
    });
  })
  .catch((err) => {
    logger.error('Failed to start: %s', err.message);
    process.exit(1);
  });

module.exports = { app, server };
