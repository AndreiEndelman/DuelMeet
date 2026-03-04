const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ── helpers ──────────────────────────────────────────────────────────────────

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const safeUser = (user) => ({
  _id:           user._id,
  username:      user.username,
  email:         user.email,
  location:      user.location,
  favoriteGames: user.favoriteGames,
  reputation:    user.reputation,
  avatar:        user.avatar,
});

// ── POST /api/auth/register ──────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, location, favoriteGames } = req.body;

    try {
      const exists = await User.findOne({ $or: [{ email }, { username }] });
      if (exists) {
        const field = exists.email === email.toLowerCase() ? 'email' : 'username';
        return res.status(409).json({ message: `That ${field} is already taken` });
      }

      const user = await User.create({ username, email, password, location, favoriteGames });

      res.status(201).json({ token: generateToken(user._id), user: safeUser(user) });
    } catch (err) {
      console.error('[register]', err);
      res.status(500).json({ message: 'Server error during registration', detail: err.message });
    }
  }
);

// ── POST /api/auth/login ─────────────────────────────────────────────────────

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      res.json({ token: generateToken(user._id), user: safeUser(user) });
    } catch (err) {
      console.error('[login]', err);
      res.status(500).json({ message: 'Server error during login' });
    }
  }
);

// ── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', protect, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ── PUT /api/auth/me ─────────────────────────────────────────────────────────

router.put(
  '/me',
  protect,
  [
    body('username').optional().trim().isLength({ min: 3, max: 30 }),
    body('location').optional().trim(),
    body('favoriteGames').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, location, favoriteGames, avatar } = req.body;
    const allowed = {};
    if (username      !== undefined) allowed.username      = username;
    if (location      !== undefined) allowed.location      = location;
    if (favoriteGames !== undefined) allowed.favoriteGames = favoriteGames;
    if (avatar        !== undefined) allowed.avatar        = avatar;

    try {
      const updated = await User.findByIdAndUpdate(req.user._id, allowed, {
        new: true,
        runValidators: true,
      });
      res.json({ user: safeUser(updated) });
    } catch (err) {
      console.error('[updateMe]', err);
      res.status(500).json({ message: 'Server error updating profile' });
    }
  }
);

module.exports = router;
