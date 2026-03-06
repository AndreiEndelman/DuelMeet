const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    game:     { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating:   { type: Number, required: true, min: 1, max: 5 },
    comment:  { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true }
);

// One review per player per game
ReviewSchema.index({ game: 1, reviewer: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);
