const router         = require('express').Router();
const User           = require('../models/User');
const Game           = require('../models/Game');
const FriendRequest  = require('../models/FriendRequest');
const { protect }    = require('../middleware/auth');

// ── GET /api/users/:id — public profile with stats + friendship status ────────
router.get('/:id', protect, async (req, res) => {
  try {
    const targetId = req.params.id;

    const [user, gamesHosted, gamesJoined, friendDoc, targetFriendDocs, myFriendDocs] = await Promise.all([
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
      // target user's accepted friend connections (to compute count + mutuals)
      FriendRequest.find({
        $or: [{ sender: targetId }, { receiver: targetId }],
        status: 'accepted',
      }).select('sender receiver'),
      // current user's accepted friend connections (to find mutual friends)
      FriendRequest.find({
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        status: 'accepted',
      }).populate('sender receiver', 'username avatar location reputation reputationCount'),
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Build set of target user's friend IDs
    const targetId_str = targetId.toString();
    const targetFriendIds = new Set(
      targetFriendDocs.map(f =>
        f.sender.toString() === targetId_str ? f.receiver.toString() : f.sender.toString()
      )
    );

    // Build my friend objects and find mutuals
    const myId_str = req.user._id.toString();
    const myFriendObjects = myFriendDocs.map(f =>
      f.sender._id.toString() === myId_str ? f.receiver : f.sender
    );
    const mutualFriends = myFriendObjects.filter(f => targetFriendIds.has(f._id.toString()));

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
      friendCount: targetFriendIds.size,
      mutualFriends,
    });
  } catch (err) {
    console.error('[users/get]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
