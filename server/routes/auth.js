const router  = require('express').Router();
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const Game    = require('../models/Game');
const Message = require('../models/Message');
const Review  = require('../models/Review');
const { protect } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

// ── helpers ──────────────────────────────────────────────────────────────────

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const safeUser = (user) => ({
  _id:             user._id,
  username:        user.username,
  email:           user.email,
  location:        user.location,
  favoriteGames:   user.favoriteGames,
  reputation:      user.reputation,
  avatar:          user.avatar,
  bio:             user.bio,
  quote:           user.quote,
  isEmailVerified: user.isEmailVerified,
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

      // Send email verification (fire-and-forget — don't fail registration if mail fails)
      try {
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.emailVerifyToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
        user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000; // 24h
        await user.save({ validateBeforeSave: false });
        sendVerificationEmail(user.email, rawToken)
          .then(() => console.log('[verifyEmail] sent to', user.email))
          .catch(e => console.error('[verifyEmail] mail error', e));
      } catch (mailErr) {
        console.error('[register] verification setup error', mailErr);
      }

      res.status(201).json({ token: generateToken(user._id), user: safeUser(user) });
    } catch (err) {
      console.error('[register]', err);
      res.status(500).json({ message: 'Server error during registration' });
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

      if (!user.isEmailVerified) {
        return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in.' });
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
    body('bio').optional().trim().isLength({ max: 300 }),
    body('quote').optional().trim().isLength({ max: 150 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, location, favoriteGames, avatar, bio, quote } = req.body;
    const allowed = {};
    if (username      !== undefined) allowed.username      = username;
    if (location      !== undefined) allowed.location      = location;
    if (favoriteGames !== undefined) allowed.favoriteGames = favoriteGames;
    if (avatar        !== undefined) allowed.avatar        = avatar;
    if (bio           !== undefined) allowed.bio           = bio;
    if (quote         !== undefined) allowed.quote         = quote;

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

// ── POST /api/auth/resend-verification ─────────────────────────────────────

router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('Invalid email address')],
  async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email.toLowerCase() });
      if (user && !user.isEmailVerified) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.emailVerifyToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
        user.emailVerifyExpires = Date.now() + 24 * 60 * 60 * 1000;
        await user.save({ validateBeforeSave: false });
        sendVerificationEmail(user.email, rawToken)
          .then(() => console.log('[resendVerify] sent to', user.email))
          .catch(e => console.error('[resendVerify] mail error', e));
      }
    } catch (err) {
      console.error('[resendVerification]', err);
    }
    // Always return success to prevent enumeration
    res.json({ message: 'If that account exists and is unverified, a new link has been sent.' });
  }
);

// ── DELETE /api/auth/me ───────────────────────────────────────────────────

router.delete('/me', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Find all games hosted by this user
    const hostedGames = await Game.find({ host: userId }, '_id');
    const hostedGameIds = hostedGames.map(g => g._id);

    // 2. Delete messages in hosted games
    if (hostedGameIds.length > 0) {
      await Message.deleteMany({ game: { $in: hostedGameIds } });
      await Review.deleteMany({ game: { $in: hostedGameIds } });
      await Game.deleteMany({ host: userId });
    }

    // 3. Remove user from players/applicants of other games
    await Game.updateMany(
      { players: userId },
      { $pull: { players: userId } }
    );
    await Game.updateMany(
      { applicants: userId },
      { $pull: { applicants: userId } }
    );

    // 4. Delete user's messages in other games
    await Message.deleteMany({ sender: userId });

    // 5. Delete reviews by or about this user
    await Review.deleteMany({ $or: [{ reviewer: userId }, { reviewee: userId }] });

    // 6. Delete the user
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('[deleteAccount]', err);
    res.status(500).json({ message: 'Server error deleting account' });
  }
});

// ── GET /api/auth/verify-email/:token ───────────────────────────────────────

router.get('/verify-email/:token', async (req, res) => {
  try {
    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await User
      .findOne({ emailVerifyToken: hashed, emailVerifyExpires: { $gt: Date.now() } })
      .select('+emailVerifyToken +emailVerifyExpires');

    if (!user) {
      return res.status(400).json({ message: 'Verification link is invalid or has expired.' });
    }

    user.isEmailVerified  = true;
    user.emailVerifyToken   = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ message: 'Email verified successfully! You can now log in.' });
  } catch (err) {
    console.error('[verifyEmail]', err);
    res.status(500).json({ message: 'Server error during email verification' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────

router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Invalid email address')],
  async (req, res) => {
    // Always return 200 to prevent email enumeration
    try {
      const user = await User.findOne({ email: req.body.email.toLowerCase() });
      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken   = crypto.createHash('sha256').update(rawToken).digest('hex');
        user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1h
        await user.save({ validateBeforeSave: false });
        sendPasswordResetEmail(user.email, rawToken).catch(e => console.error('[resetEmail] mail error', e));
      }
    } catch (err) {
      console.error('[forgotPassword]', err);
    }
    res.json({ message: 'If that email is registered, a reset link is on its way.' });
  }
);

// ── POST /api/auth/reset-password/:token ─────────────────────────────────────

router.post(
  '/reset-password/:token',
  [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
      const user = await User
        .findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } })
        .select('+passwordResetToken +passwordResetExpires +password');

      if (!user) {
        return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
      }

      user.password             = req.body.password;
      user.passwordResetToken   = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
    } catch (err) {
      console.error('[resetPassword]', err);
      res.status(500).json({ message: 'Server error during password reset' });
    }
  }
);

module.exports = router;
