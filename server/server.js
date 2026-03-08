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
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
