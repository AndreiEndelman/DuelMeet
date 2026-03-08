const router = require('express').Router();
const GroupChat = require('../models/GroupChat');
const GroupMessage = require('../models/GroupMessage');
const FriendRequest = require('../models/FriendRequest');
const { protect, requireVerified } = require('../middleware/auth');

router.use(protect);

// ── GET /api/groupchats — list all chats the user is a member of ──────────────
router.get('/', async (req, res) => {
  try {
    const since = req.user.lastInboxAt || new Date(0);
    const rawChats = await GroupChat.find({ members: req.user._id })
      .populate('creator', 'username avatar')
      .populate('members', 'username avatar')
      .sort({ updatedAt: -1 });

    const chats = rawChats.map((c) => ({
      ...c.toObject(),
      hasUnread: c.updatedAt > since,
    }));
    res.json({ chats });
  } catch (err) {
    console.error('[groupchats/list]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/groupchats — create a new standalone group chat ─────────────────
router.post('/', requireVerified, async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group chat name is required' });
    }

    // Verify all memberIds are accepted friends
    const friendships = await FriendRequest.find({
      $or: [
        { sender: req.user._id, status: 'accepted' },
        { receiver: req.user._id, status: 'accepted' },
      ],
    });
    const friendIds = new Set(
      friendships.map((f) =>
        f.sender.toString() === req.user._id.toString()
          ? f.receiver.toString()
          : f.sender.toString()
      )
    );

    const validatedMembers = memberIds.filter((id) => friendIds.has(id));
    const allMembers = [...new Set([req.user._id.toString(), ...validatedMembers])];

    const chat = await GroupChat.create({
      name: name.trim(),
      creator: req.user._id,
      members: allMembers,
    });

    const populated = await chat.populate([
      { path: 'creator', select: 'username avatar' },
      { path: 'members', select: 'username avatar' },
    ]);

    res.status(201).json({ chat: populated });
  } catch (err) {
    console.error('[groupchats/create]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/groupchats/:id — single chat info ───────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const chat = await GroupChat.findById(req.params.id)
      .populate('creator', 'username avatar')
      .populate('members', 'username avatar')
      .populate('gameRef', 'title type');

    if (!chat) return res.status(404).json({ message: 'Group chat not found' });
    if (!chat.members.some((m) => m._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member of this chat' });
    }
    res.json({ chat });
  } catch (err) {
    console.error('[groupchats/get]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/groupchats/:id/messages — paginated messages ───────────────────
router.get('/:id/messages', async (req, res) => {
  try {
    const chat = await GroupChat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Group chat not found' });
    if (!chat.members.some((m) => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member' });
    }

    const { after } = req.query;
    const query = { groupChat: req.params.id };
    if (after) query.createdAt = { $gt: new Date(after) };

    const messages = await GroupMessage.find(query)
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('sender', 'username avatar');

    res.json({ messages });
  } catch (err) {
    console.error('[groupchats/messages/get]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/groupchats/:id/messages — send a message ──────────────────────
router.post('/:id/messages', requireVerified, async (req, res) => {
  try {
    const chat = await GroupChat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Group chat not found' });
    if (!chat.members.some((m) => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member' });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const msg = await GroupMessage.create({
      groupChat: req.params.id,
      sender: req.user._id,
      text: text.trim(),
    });

    // Bump updatedAt so the chat floats to top of list
    await GroupChat.findByIdAndUpdate(req.params.id, { updatedAt: new Date() });

    const populated = await msg.populate('sender', 'username avatar');
    res.status(201).json({ message: populated });
  } catch (err) {
    console.error('[groupchats/messages/post]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/groupchats/:id/invite — add a friend to the chat ───────────────
router.post('/:id/invite', requireVerified, async (req, res) => {
  try {
    const chat = await GroupChat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Group chat not found' });
    if (!chat.members.some((m) => m.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not a member' });
    }

    const { userId } = req.body;
    if (chat.members.some((m) => m.toString() === userId)) {
      return res.status(400).json({ message: 'User is already a member' });
    }

    chat.members.push(userId);
    await chat.save();
    res.json({ message: 'User added to group chat' });
  } catch (err) {
    console.error('[groupchats/invite]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
