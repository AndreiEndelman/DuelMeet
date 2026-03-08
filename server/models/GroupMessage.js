const mongoose = require('mongoose');

const GroupMessageSchema = new mongoose.Schema(
  {
    groupChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GroupChat',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true }
);

GroupMessageSchema.index({ groupChat: 1, createdAt: 1 });

module.exports = mongoose.model('GroupMessage', GroupMessageSchema);
