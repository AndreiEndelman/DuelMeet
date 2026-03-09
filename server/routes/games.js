const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Game = require('../models/Game');
const Message = require('../models/Message');
const Review = require('../models/Review');
const User = require('../models/User');
const GroupChat = require('../models/GroupChat');
const { protect, requireVerified } = require('../middleware/auth');
const { geocode } = require('../utils/geocode');

// ── GET /api/games ───────────────────────────────────────────────────────────
// Optional query params: type, page, limit, location (address/zip), radius (miles)

router.get('/', async (req, res) => {
  try {
    const { type, page = 1, limit = 20, location, radius = 25 } = req.query;
    const filter = { date: { $gte: new Date() } };

    if (type && ['magic', 'pokemon', 'yugioh', 'onepiece'].includes(type)) {
      filter.type = type;
    }

    // Geospatial filter: if a location string is provided, geocode it and filter by radius
    if (location && location.trim()) {
      const coords = await geocode(location.trim());
      if (coords) {
        const radiusInMeters = Number(radius) * 1609.34; // miles → metres
        filter.coordinates = {
          $near: {
            $geometry: { type: 'Point', coordinates: coords },
            $maxDistance: radiusInMeters,
          },
        };
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // $near cannot be combined with countDocuments, so handle separately
    let games, total;
    if (filter.coordinates) {
      // When using $near, sort is implicit (nearest first); skip/limit still apply
      games = await Game.find(filter)
        .skip(skip)
        .limit(Number(limit))
        .populate('host', 'username avatar location')
        .populate('players', '_id');
      total = games.length;
    } else {
      [games, total] = await Promise.all([
        Game.find(filter)
          .sort({ date: 1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('host', 'username avatar location')
          .populate('players', '_id'),
        Game.countDocuments(filter),
      ]);
    }

    res.json({ games: games.filter(g => g.host), total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('[getGames]', err);
    res.status(500).json({ message: 'Server error fetching games' });
  }
});

// ── GET /api/games/my ────────────────────────────────────────────────────────
// Returns upcoming games where the authenticated user is host or player

router.get('/my', protect, async (req, res) => {
  try {
    const games = await Game.find({
      $or: [{ host: req.user._id }, { players: req.user._id }],
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .populate('host', 'username avatar location');

    res.json({ games, total: games.length, page: 1, pages: 1 });
  } catch (err) {
    console.error('[getMyGames]', err);
    res.status(500).json({ message: 'Server error fetching your games' });
  }
});

// ── GET /api/games/invites ───────────────────────────────────────────────────
// Returns upcoming games where the current user is in invitedPlayers

router.get('/invites', protect, async (req, res) => {
  try {
    const games = await Game.find({
      invitedPlayers: req.user._id,
      date: { $gte: new Date() },
    })
      .sort({ date: 1 })
      .populate('host', 'username avatar location reputation')
      .populate('players', 'username avatar');
    res.json({ games, total: games.length });
  } catch (err) {
    console.error('[getGameInvites]', err);
    res.status(500).json({ message: 'Server error fetching invites' });
  }
});

// ── GET /api/games/:id ───────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id)
      .populate('host', 'username avatar location reputation')
      .populate('players', 'username avatar')
      .populate('applicants', 'username avatar');

    if (!game) return res.status(404).json({ message: 'Game not found' });
    res.json({ game });
  } catch (err) {
    console.error('[getGame]', err);
    res.status(500).json({ message: 'Server error fetching game' });
  }
});

// ── POST /api/games ──────────────────────────────────────────────────────────

router.post(
  '/',
  protect,
  requireVerified,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
    body('type').isIn(['magic', 'pokemon', 'yugioh', 'onepiece']).withMessage('Invalid game type'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('date').isISO8601().withMessage('Date must be a valid ISO 8601 date'),
    body('maxPlayers').isInt({ min: 2, max: 20 }).withMessage('maxPlayers must be between 2 and 20'),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, type, location, date, maxPlayers, notes } = req.body;

    try {
      // Geocode the location so games can be queried by distance
      const coords = await geocode(location);

      const gameData = {
        title,
        type,
        location,
        date,
        maxPlayers,
        notes,
        host: req.user._id,
        players: [req.user._id], // host is automatically the first player
      };

      if (coords) {
        gameData.coordinates = { type: 'Point', coordinates: coords };
      }

      const game = await Game.create(gameData);

      // Auto-create a group chat for this game
      await GroupChat.create({
        name: title,
        creator: req.user._id,
        members: [req.user._id],
        gameRef: game._id,
      });

      const populated = await game.populate('host', 'username avatar location');
      res.status(201).json({ game: populated });
    } catch (err) {
      console.error('[createGame]', err);
      res.status(500).json({ message: 'Server error creating game' });
    }
  }
);

// ── POST /api/games/:id/apply ───────────────────────────────────────────────
// Any logged-in user can apply; host must then accept them

router.post('/:id/apply', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    if (game.host.toString() === userId) {
      return res.status(400).json({ message: 'You are the host of this game' });
    }
    if (game.players.map(String).includes(userId)) {
      return res.status(400).json({ message: 'You are already in this game' });
    }
    if (game.applicants.map(String).includes(userId)) {
      return res.status(400).json({ message: 'You have already applied to this game' });
    }
    if (game.players.length >= game.maxPlayers) {
      return res.status(400).json({ message: 'This game is full' });
    }

    game.applicants.push(req.user._id);
    await game.save();

    await game.populate([
      { path: 'host', select: 'username avatar location reputation' },
      { path: 'players', select: 'username avatar' },
      { path: 'applicants', select: 'username avatar' },
    ]);
    res.json({ game });
  } catch (err) {
    console.error('[applyGame]', err);
    res.status(500).json({ message: 'Server error applying to game' });
  }
});

// ── POST /api/games/:id/accept/:userId ───────────────────────────────────────
// Host accepts an applicant → moves them from applicants → players

router.post('/:id/accept/:userId', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can accept players' });
    }
    if (game.players.length >= game.maxPlayers) {
      return res.status(400).json({ message: 'Game is already full' });
    }

    const targetId = req.params.userId;
    if (!game.applicants.map(String).includes(targetId)) {
      return res.status(400).json({ message: 'User has not applied to this game' });
    }

    game.applicants = game.applicants.filter((a) => a.toString() !== targetId);
    game.players.push(targetId);
    await game.save();

    // Add accepted player to the game's GroupChat
    await GroupChat.findOneAndUpdate(
      { gameRef: game._id },
      { $addToSet: { members: targetId } }
    );

    await game.populate([
      { path: 'host', select: 'username avatar location reputation' },
      { path: 'players', select: 'username avatar' },
      { path: 'applicants', select: 'username avatar' },
    ]);
    res.json({ game });
  } catch (err) {
    console.error('[acceptPlayer]', err);
    res.status(500).json({ message: 'Server error accepting player' });
  }
});

// ── POST /api/games/:id/deny/:userId ─────────────────────────────────────────
// Host removes a user from the applicants list

router.post('/:id/deny/:userId', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can deny players' });
    }

    const targetId = req.params.userId;
    game.applicants = game.applicants.filter((a) => a.toString() !== targetId);
    await game.save();

    await game.populate([
      { path: 'host', select: 'username avatar location reputation' },
      { path: 'players', select: 'username avatar' },
      { path: 'applicants', select: 'username avatar' },
    ]);
    res.json({ game });
  } catch (err) {
    console.error('[denyPlayer]', err);
    res.status(500).json({ message: 'Server error denying player' });
  }
});

// ── POST /api/games/:id/join ─────────────────────────────────────────────────

router.post('/:id/join', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    if (game.players.map(String).includes(userId)) {
      return res.status(400).json({ message: 'You have already joined this game' });
    }
    if (game.players.length >= game.maxPlayers) {
      return res.status(400).json({ message: 'This game is full' });
    }

    game.players.push(req.user._id);
    await game.save();

    const populated = await game.populate('host', 'username avatar');
    res.json({ game: populated });
  } catch (err) {
    console.error('[joinGame]', err);
    res.status(500).json({ message: 'Server error joining game' });
  }
});

// ── POST /api/games/:id/leave ────────────────────────────────────────────────

router.post('/:id/leave', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    if (game.host.toString() === userId) {
      return res.status(400).json({ message: 'The host cannot leave — delete the game instead' });
    }

    game.players = game.players.filter((p) => p.toString() !== userId);
    await game.save();

    res.json({ message: 'Left game successfully' });
  } catch (err) {
    console.error('[leaveGame]', err);
    res.status(500).json({ message: 'Server error leaving game' });
  }
});

// ── PUT /api/games/:id ───────────────────────────────────────────────────────
// Only the host can edit

router.put(
  '/:id',
  protect,
  requireVerified,
  [
    body('title').optional().trim().isLength({ max: 100 }),
    body('type').optional().isIn(['magic', 'pokemon', 'yugioh', 'onepiece']),
    body('location').optional().trim().notEmpty(),
    body('date').optional().isISO8601(),
    body('maxPlayers').optional().isInt({ min: 2, max: 20 }),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ message: 'Game not found' });
      if (game.host.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Only the host can edit this game' });
      }

      const allowed = ['title', 'type', 'location', 'date', 'maxPlayers', 'notes'];
      allowed.forEach((field) => {
        if (req.body[field] !== undefined) game[field] = req.body[field];
      });
      await game.save();

      await game.populate('host', 'username avatar');
      res.json({ game });
    } catch (err) {
      console.error('[updateGame]', err);
      res.status(500).json({ message: 'Server error updating game' });
    }
  }
);

// ── DELETE /api/games/:id ────────────────────────────────────────────────────
// Only the host can delete

router.delete('/:id', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can delete this game' });
    }

    await game.deleteOne();
    res.json({ message: 'Game deleted' });
  } catch (err) {
    console.error('[deleteGame]', err);
    res.status(500).json({ message: 'Server error deleting game' });
  }
});

// ── GET /api/games/:id/messages ───────────────────────────────────────────────
// Only players/host of the game can read chat

router.get('/:id/messages', protect, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    const isParticipant = game.players.map(String).includes(userId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Only accepted players can view chat' });
    }

    const query = { game: req.params.id };
    if (req.query.after) query.createdAt = { $gt: new Date(req.query.after) };

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'username avatar');

    res.json({ messages });
  } catch (err) {
    console.error('[getMessages]', err);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
});

// ── POST /api/games/:id/messages ──────────────────────────────────────────────
// Send a chat message — must be an accepted player (in players array)

router.post('/:id/messages', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    const isParticipant = game.players.map(String).includes(userId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Only accepted players can send messages' });
    }

    const text = (req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ message: 'Message cannot be empty' });

    const msg = await Message.create({ game: req.params.id, sender: req.user._id, text });
    await msg.populate('sender', 'username avatar');

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('[sendMessage]', err);
    res.status(500).json({ message: 'Server error sending message' });
  }
});

// ── GET /api/games/:id/my-review ─────────────────────────────────────────────
// Check if the current user has already reviewed this game

router.get('/:id/my-review', protect, async (req, res) => {
  try {
    const review = await Review.findOne({ game: req.params.id, reviewer: req.user._id });
    res.json({ review: review || null });
  } catch (err) {
    console.error('[getMyReview]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── POST /api/games/:id/review ───────────────────────────────────────────────
// Players rate the host after the game. Hosts cannot leave reviews.

router.post(
  '/:id/review',
  protect,
  requireVerified,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5'),
    body('comment').optional().trim().isLength({ max: 300 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const game = await Game.findById(req.params.id);
      if (!game) return res.status(404).json({ message: 'Game not found' });

      if (new Date(game.date) > new Date()) {
        return res.status(400).json({ message: 'You can only review after the game has taken place.' });
      }

      const userId = req.user._id.toString();

      if (game.host.toString() === userId) {
        return res.status(403).json({ message: 'Hosts cannot leave reviews.' });
      }
      if (!game.players.map(String).includes(userId)) {
        return res.status(403).json({ message: 'Only accepted players can leave a review.' });
      }

      const { rating, comment = '' } = req.body;

      const review = await Review.create({
        game: game._id,
        reviewer: req.user._id,
        reviewee: game.host,
        rating,
        comment,
      });

      const agg = await Review.aggregate([
        { $match: { reviewee: game.host } },
        { $group: { _id: null, avg: { $avg: '$rating' } } },
      ]);
      const newRep = agg.length ? Math.round(agg[0].avg * 2) / 2 : rating;
      await User.findByIdAndUpdate(game.host, { reputation: newRep });

      res.status(201).json({ review });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: 'You have already reviewed this game.' });
      }
      console.error('[submitReview]', err);
      res.status(500).json({ message: 'Server error submitting review' });
    }
  }
);
// ── POST /api/games/:id/invite/accept ───────────────────────────────────────
// Invited user accepts — moves from invitedPlayers to players

router.post('/:id/invite/accept', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    if (!game.invitedPlayers.map(String).includes(userId)) {
      return res.status(400).json({ message: 'No invite found for this game' });
    }
    if (game.players.length >= game.maxPlayers) {
      return res.status(400).json({ message: 'This game is now full' });
    }

    game.invitedPlayers = game.invitedPlayers.filter((u) => u.toString() !== userId);
    game.players.push(req.user._id);
    await game.save();

    // Add to the game's GroupChat
    await GroupChat.findOneAndUpdate(
      { gameRef: game._id },
      { $addToSet: { members: req.user._id } }
    );

    res.json({ message: 'Joined game' });
  } catch (err) {
    console.error('[acceptGameInvite]', err);
    res.status(500).json({ message: 'Server error accepting invite' });
  }
});

// ── POST /api/games/:id/invite/decline ──────────────────────────────────────
// Invited user declines — removes from invitedPlayers

router.post('/:id/invite/decline', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    const userId = req.user._id.toString();
    game.invitedPlayers = game.invitedPlayers.filter((u) => u.toString() !== userId);
    await game.save();
    res.json({ message: 'Invite declined' });
  } catch (err) {
    console.error('[declineGameInvite]', err);
    res.status(500).json({ message: 'Server error declining invite' });
  }
});

// ── POST /api/games/:id/invite/:userId ───────────────────────────────────────
// Host directly invites a user to their game (adds to invitedPlayers)

router.post('/:id/invite/:userId', protect, requireVerified, async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can invite players' });
    }

    const targetId = req.params.userId;
    if (game.players.map(String).includes(targetId)) {
      return res.status(400).json({ message: 'User is already in this game' });
    }
    if (game.invitedPlayers.map(String).includes(targetId)) {
      return res.status(400).json({ message: 'User has already been invited' });
    }
    if (game.players.length >= game.maxPlayers) {
      return res.status(400).json({ message: 'This game is full' });
    }

    game.invitedPlayers.push(targetId);
    await game.save();
    res.json({ message: 'Invite sent' });
  } catch (err) {
    console.error('[invitePlayer]', err);
    res.status(500).json({ message: 'Server error sending invite' });
  }
});

module.exports = router;