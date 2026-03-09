const express        = require('express');
const router         = express.Router();
const { protect }    = require('../middleware/auth');
const User           = require('../models/User');
const FriendRequest  = require('../models/FriendRequest');
const DmMessage      = require('../models/DmMessage');
const GroupChat      = require('../models/GroupChat');
const GroupMessage   = require('../models/GroupMessage');

// GET /api/notifications/unread
// Returns { hasUnread: boolean } — checks friend requests + new messages since lastInboxAt
router.get('/unread', protect, async (req, res) => {
  const since = req.user.lastInboxAt || new Date(0);

  // 1. Pending friend requests received after last inbox visit
  const friendReqs = await FriendRequest.countDocuments({
    receiver: req.user._id,
    status: 'pending',
    createdAt: { $gt: since },
  });
  if (friendReqs > 0) return res.json({ hasUnread: true });

  // 2. Unread DMs received since last inbox visit
  const newDms = await DmMessage.countDocuments({
    receiver: req.user._id,
    createdAt: { $gt: since },
  });
  if (newDms > 0) return res.json({ hasUnread: true });

  // 3. Unread group messages in chats the user belongs to, sent by others, since last visit
  const myChats = await GroupChat.find(
    { members: req.user._id },
    '_id'
  ).lean();

  if (myChats.length > 0) {
    const chatIds = myChats.map((c) => c._id);
    const newGroupMsgs = await GroupMessage.countDocuments({
      groupChat: { $in: chatIds },
      sender: { $ne: req.user._id },
      createdAt: { $gt: since },
    });
    if (newGroupMsgs > 0) return res.json({ hasUnread: true });
  }

  return res.json({ hasUnread: false });
});

// POST /api/notifications/mark-read
// Called when user opens the Inbox — resets the unread window
router.post('/mark-read', protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { lastInboxAt: new Date() });
  res.json({ ok: true });
});

module.exports = router;
