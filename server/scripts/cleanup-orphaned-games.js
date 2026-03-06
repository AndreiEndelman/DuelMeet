/**
 * Deletes games whose host no longer exists in the users collection.
 * Run once: node scripts/cleanup-orphaned-games.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Game     = require('../models/Game');
const Message  = require('../models/Message');
const Review   = require('../models/Review');
require('../models/User'); // register User schema for populate

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find games where populate returns null host
  const games = await Game.find().populate('host', '_id');
  const orphaned = games.filter(g => !g.host);
  console.log(`Found ${orphaned.length} orphaned games`);

  if (orphaned.length === 0) {
    console.log('Nothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  const ids = orphaned.map(g => g._id);
  await Message.deleteMany({ game: { $in: ids } });
  await Review.deleteMany({ game: { $in: ids } });
  await Game.deleteMany({ _id: { $in: ids } });

  console.log(`Deleted ${orphaned.length} orphaned games and their messages/reviews.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
