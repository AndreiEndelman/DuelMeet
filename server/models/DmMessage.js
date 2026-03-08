const mongoose = require('mongoose');

const DmMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
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

// Efficient conversation thread + inbox queries
DmMessageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
DmMessageSchema.index({ receiver: 1, createdAt: -1 });

module.exports = mongoose.model('DmMessage', DmMessageSchema);
