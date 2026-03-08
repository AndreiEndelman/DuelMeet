const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must be at most 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned in queries by default
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    favoriteGames: {
      type: [String],
      enum: ['magic', 'pokemon', 'yugioh', 'onepiece'],
      default: [],
    },
    reputation: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    reputationCount: {
      type: Number,
      default: 0,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [300, 'Bio must be at most 300 characters'],
      default: '',
    },
    quote: {
      type: String,
      trim: true,
      maxlength: [150, 'Quote must be at most 150 characters'],
      default: '',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifyToken: {
      type: String,
      select: false,
    },
    emailVerifyExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    // Tracks when user last opened Inbox — used for unread dot
    lastInboxAt: {
      type: Date,
      default: new Date(0),
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare entered password to hashed
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
