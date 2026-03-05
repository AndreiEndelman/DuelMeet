const mongoose = require('mongoose');

const GameSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title must be at most 100 characters'],
    },
    type: {
      type: String,
      required: [true, 'Game type is required'],
      enum: {
        values: ['magic', 'pokemon', 'yugioh', 'onepiece'],
        message: 'Type must be magic, pokemon, yugioh, or onepiece',
      },
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    maxPlayers: {
      type: Number,
      required: [true, 'Max players is required'],
      min: [2, 'Must allow at least 2 players'],
      max: [20, 'Cannot exceed 20 players'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes must be at most 500 characters'],
      default: '',
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    players: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    applicants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // GeoJSON point — populated automatically when a game is created
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },
  },
  { timestamps: true }
);

// 2dsphere index enables MongoDB geospatial ($near) queries
GameSchema.index({ coordinates: '2dsphere' });

// Virtual: spots remaining
GameSchema.virtual('spotsLeft').get(function () {
  return this.maxPlayers - this.players.length;
});

// Ensure virtuals appear when converting to JSON
GameSchema.set('toJSON', { virtuals: true });
GameSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Game', GameSchema);
