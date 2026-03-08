const mongoose = require('mongoose');

const GroupChatSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Optional — set when this chat was auto-created from a game
    gameRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GroupChat', GroupChatSchema);
