const router = require('express').Router();
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ── GET /api/friends — list accepted friends ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const accepted = await FriendRequest.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
      status: 'accepted',
    }).populate('sender receiver', 'username avatar location reputation reputationCount bio quote favoriteGames');

    const friends = accepted.map((r) =>
      String(r.sender._id) === String(req.user._id) ? r.receiver : r.sender
    );
    res.json({ friends });
  } catch (err) {
    console.error('[friends/list]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/friends/requests — incoming pending requests ────────────────────
router.get('/requests', async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending',
    }).populate('sender', 'username avatar location reputation reputationCount');
    res.json({ requests });
  } catch (err) {
    console.error('[friends/requests]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/friends/sent — outgoing pending requests ────────────────────────
router.get('/sent', async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      sender: req.user._id,
      status: 'pending',
    }).populate('receiver', 'username avatar location reputation reputationCount');
    res.json({ requests });
  } catch (err) {
    console.error('[friends/sent]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/friends/find-by-tag/:tag — look up a user by their unique tag ───
router.get('/find-by-tag/:tag', async (req, res) => {
  try {
    const tag = req.params.tag.trim().toUpperCase();
    const user = await User.findOne({ uniqueTag: tag }).select('_id username avatar location uniqueTag');
    if (!user) return res.status(404).json({ message: 'No player found with that tag' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'That\'s your own tag!' });
    }
    res.json({ user });
  } catch (err) {
    console.error('[friends/find-by-tag]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/friends/status/:userId — friendship status with a user ──────────
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const request = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id },
      ],
    });

    if (!request) return res.json({ status: 'none', requestId: null });
    if (request.status === 'accepted') return res.json({ status: 'friends', requestId: String(request._id) });
    if (request.status === 'declined') return res.json({ status: 'none', requestId: null });

    // pending
    if (String(request.sender) === String(req.user._id)) {
      return res.json({ status: 'pending_sent', requestId: String(request._id) });
    }
    return res.json({ status: 'pending_received', requestId: String(request._id) });
  } catch (err) {
    console.error('[friends/status]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/friends/request/:userId — send a friend request ────────────────
router.post('/request/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) === String(req.user._id)) {
      return res.status(400).json({ message: 'Cannot send a request to yourself' });
    }
    const existing = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id },
      ],
    });
    if (existing) return res.status(400).json({ message: 'Request already exists' });

    const request = await FriendRequest.create({ sender: req.user._id, receiver: userId });
    res.status(201).json({ message: 'Friend request sent', requestId: String(request._id) });
  } catch (err) {
    console.error('[friends/request]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/friends/accept/:requestId — accept a request ───────────────────
router.post('/accept/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (String(request.receiver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    request.status = 'accepted';
    await request.save();
    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error('[friends/accept]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/friends/decline/:requestId — decline a request ─────────────────
router.post('/decline/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (String(request.receiver) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await request.deleteOne();
    res.json({ message: 'Friend request declined' });
  } catch (err) {
    console.error('[friends/decline]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/friends/cancel/:requestId — cancel outgoing request ───────────
router.delete('/cancel/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (String(request.sender) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await request.deleteOne();
    res.json({ message: 'Friend request cancelled' });
  } catch (err) {
    console.error('[friends/cancel]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/friends/:userId — unfriend ────────────────────────────────────
router.delete('/:userId', async (req, res) => {
  try {
    await FriendRequest.findOneAndDelete({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id },
      ],
      status: 'accepted',
    });
    res.json({ message: 'Unfriended' });
  } catch (err) {
    console.error('[friends/unfriend]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
