const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Game = require('../models/Game');
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const { geocode } = require('../utils/geocode');

// ── GET /api/games ───────────────────────────────────────────────────────────
// Optional query params: type, page, limit, location (address/zip), radius (miles)

router.get('/', async (req, res) => {
  try {
    const { type, page = 1, limit = 20, location, radius = 25 } = req.query;
    const filter = {};

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
        .populate('host', 'username avatar location');
      total = games.length;
    } else {
      [games, total] = await Promise.all([
        Game.find(filter)
          .sort({ date: 1 })
          .skip(skip)
          .limit(Number(limit))
          .populate('host', 'username avatar location'),
        Game.countDocuments(filter),
      ]);
    }

    res.json({ games, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
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

router.post('/:id/apply', protect, async (req, res) => {
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

router.post('/:id/accept/:userId', protect, async (req, res) => {
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

router.post('/:id/deny/:userId', protect, async (req, res) => {
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

router.post('/:id/join', protect, async (req, res) => {
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

router.post('/:id/leave', protect, async (req, res) => {
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

router.delete('/:id', protect, async (req, res) => {
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

module.exports = router;

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

router.post('/:id/messages', protect, async (req, res) => {
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
