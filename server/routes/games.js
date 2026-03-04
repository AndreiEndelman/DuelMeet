const router = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const Game = require('../models/Game');
const { protect } = require('../middleware/auth');

// ── GET /api/games ───────────────────────────────────────────────────────────
// Optional query params: type, page (default 1), limit (default 20)

router.get('/', async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type && ['magic', 'pokemon', 'yugioh', 'onepiece'].includes(type)) {
      filter.type = type;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [games, total] = await Promise.all([
      Game.find(filter)
        .sort({ date: 1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('host', 'username avatar location'),
      Game.countDocuments(filter),
    ]);

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
      .populate('players', 'username avatar');

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
      const game = await Game.create({
        title,
        type,
        location,
        date,
        maxPlayers,
        notes,
        host: req.user._id,
        players: [req.user._id], // host is automatically the first player
      });

      const populated = await game.populate('host', 'username avatar location');
      res.status(201).json({ game: populated });
    } catch (err) {
      console.error('[createGame]', err);
      res.status(500).json({ message: 'Server error creating game' });
    }
  }
);

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
