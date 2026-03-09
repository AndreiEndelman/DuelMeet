const router = require('express').Router();
const DmMessage = require('../models/DmMessage');
const FriendRequest = require('../models/FriendRequest');
const { protect, requireVerified } = require('../middleware/auth');

router.use(protect);

// ── GET /api/dm/conversations — list all users you've DM'd ───────────────────
router.get('/conversations', async (req, res) => {
  try {
    const me = req.user._id;

    // Get all messages involving the current user
    const msgs = await DmMessage.find({
      $or: [{ sender: me }, { receiver: me }],
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    // Build a map of unique conversations (keyed by the other user's id)
    const since = req.user.lastInboxAt || new Date(0);
    const seen = new Map();
    for (const msg of msgs) {
      const other = msg.sender._id.toString() === me.toString() ? msg.receiver : msg.sender;
      if (!seen.has(other._id.toString())) {
        // Unread: received (not sent by me) and arrived after last inbox visit
        const isReceived = msg.sender._id.toString() !== me.toString();
        seen.set(other._id.toString(), {
          user: other,
          lastMessage: { text: msg.text, createdAt: msg.createdAt },
          hasUnread: isReceived && msg.createdAt > since,
        });
      }
    }

    res.json({ conversations: Array.from(seen.values()) });
  } catch (err) {
    console.error('[dm/conversations]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/dm/:userId — get message thread with a user ─────────────────────
router.get('/:userId', async (req, res) => {
  try {
    const me = req.user._id;
    const other = req.params.userId;

    const { after } = req.query;
    const query = {
      $or: [
        { sender: me, receiver: other },
        { sender: other, receiver: me },
      ],
    };
    if (after) query.createdAt = { $gt: new Date(after) };

    const messages = await DmMessage.find(query)
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('sender', 'username avatar')
      .populate('receiver', 'username avatar');

    res.json({ messages });
  } catch (err) {
    console.error('[dm/thread]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/dm/:userId — send a DM (friends only) ──────────────────────────
router.post('/:userId', requireVerified, async (req, res) => {
  try {
    const me = req.user._id;
    const other = req.params.userId;

    if (me.toString() === other) {
      return res.status(400).json({ message: 'Cannot DM yourself' });
    }

    // Friends-only check
    const friendship = await FriendRequest.findOne({
      $or: [
        { sender: me, receiver: other },
        { sender: other, receiver: me },
      ],
      status: 'accepted',
    });
    if (!friendship) {
      return res.status(403).json({ message: 'You can only DM friends' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const msg = await DmMessage.create({ sender: me, receiver: other, text: text.trim() });
    const populated = await msg.populate([
      { path: 'sender', select: 'username avatar' },
      { path: 'receiver', select: 'username avatar' },
    ]);

    res.status(201).json({ message: populated });
  } catch (err) {
    console.error('[dm/send]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE /api/dm/conversation/:userId — erase entire thread both ways ───────
router.delete('/conversation/:userId', async (req, res) => {
  try {
    const me    = req.user._id;
    const other = req.params.userId;
    await DmMessage.deleteMany({
      $or: [
        { sender: me, receiver: other },
        { sender: other, receiver: me },
      ],
    });
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('[dm/delete-conversation]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
