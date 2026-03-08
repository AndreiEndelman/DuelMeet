const router         = require('express').Router();
const User           = require('../models/User');
const Game           = require('../models/Game');
const FriendRequest  = require('../models/FriendRequest');
const { protect }    = require('../middleware/auth');

// ── GET /api/users/:id — public profile with stats + friendship status ────────
router.get('/:id', protect, async (req, res) => {
  try {
    const targetId = req.params.id;

    const [user, gamesHosted, gamesJoined, friendDoc] = await Promise.all([
      User.findById(targetId).select(
        'username avatar bio quote location reputation reputationCount favoriteGames'
      ),
      Game.countDocuments({ host: targetId }),
      Game.countDocuments({ players: targetId }),
      FriendRequest.findOne({
        $or: [
          { sender: req.user._id, receiver: targetId },
          { sender: targetId, receiver: req.user._id },
        ],
      }),
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });

    let friendStatus = 'none';
    let friendRequestId = null;
    if (friendDoc) {
      friendRequestId = friendDoc._id;
      if (friendDoc.status === 'accepted') {
        friendStatus = 'friends';
      } else if (friendDoc.status === 'pending') {
        friendStatus = friendDoc.sender.toString() === req.user._id.toString()
          ? 'pending_sent'
          : 'pending_received';
      }
    }

    res.json({
      user,
      stats: { gamesHosted, gamesJoined },
      friendStatus,
      friendRequestId,
    });
  } catch (err) {
    console.error('[users/get]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
