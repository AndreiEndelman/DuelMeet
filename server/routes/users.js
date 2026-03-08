const router = require('express').Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// ── GET /api/users/:id — public profile ──────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      'username avatar bio quote location reputation reputationCount favoriteGames'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    console.error('[users/get]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
