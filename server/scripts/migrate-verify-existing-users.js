/**
 * One-time migration: mark all existing users as email-verified.
 * Run once with: node server/scripts/migrate-verify-existing-users.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('../models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await User.updateMany(
    { isEmailVerified: { $ne: true } },
    { $set: { isEmailVerified: true } }
  );

  console.log(`✅ Marked ${result.modifiedCount} existing user(s) as verified.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
