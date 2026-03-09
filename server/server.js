const express  = require('express');
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const cors     = require('cors');

dotenv.config();

// ── Validate required env vars ───────────────────────────────────────────────
const required = ['MONGO_URI', 'JWT_SECRET'];
required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
});

// ── Expired-game cleanup ─────────────────────────────────────────────────────
// Runs once at startup then every 6 hours.
// Deletes games (+ lobby messages, reviews, and linked group chats)
// whose scheduled date is more than 24 hours in the past.
async function cleanupExpiredGames() {
  try {
    const Game       = require('./models/Game');
    const Message    = require('./models/Message');
    const Review     = require('./models/Review');
    const GroupChat  = require('./models/GroupChat');
    const GroupMessage = require('./models/GroupMessage');

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expired = await Game.find({ date: { $lt: cutoff } }, '_id');
    if (expired.length === 0) return;

    const ids = expired.map((g) => g._id);
    await Promise.all([
      Message.deleteMany({ game: { $in: ids } }),
      Review.deleteMany({ game: { $in: ids } }),
      GroupChat.find({ gameRef: { $in: ids } }, '_id').then(async (chats) => {
        const chatIds = chats.map((c) => c._id);
        if (chatIds.length > 0) {
          await GroupMessage.deleteMany({ groupChat: { $in: chatIds } });
          await GroupChat.deleteMany({ _id: { $in: chatIds } });
        }
      }),
      Game.deleteMany({ _id: { $in: ids } }),
    ]);
    console.log(`[cleanup] Removed ${ids.length} expired game(s) and their data`);
  } catch (err) {
    console.error('[cleanup] Error during expired-game cleanup:', err);
  }
}

// ── App setup ────────────────────────────────────────────────────────────────
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8100', 'http://localhost:4200'];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (mobile apps, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/games',       require('./routes/games'));
app.use('/api/places',      require('./routes/places'));
app.use('/api/friends',     require('./routes/friends'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/groupchats',     require('./routes/groupchats'));
app.use('/api/dm',             require('./routes/dm'));
app.use('/api/notifications',  require('./routes/notifications'));

// Health check
app.get('/', (_req, res) => res.json({ status: 'API running' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// ── Database + server start ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    // Run cleanup immediately, then every 6 hours
    cleanupExpiredGames();
    setInterval(cleanupExpiredGames, 6 * 60 * 60 * 1000);
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
