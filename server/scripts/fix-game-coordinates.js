require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // Unset coordinates from docs that have `{ type: 'Point' }` but no coordinates array
  const result = await db.collection('games').updateMany(
    { coordinates: { $exists: true }, 'coordinates.coordinates': { $exists: false } },
    { $unset: { coordinates: '' } }
  );
  console.log(`Fixed ${result.modifiedCount} game(s) with broken coordinates`);

  // Drop old non-sparse index and recreate as sparse
  try {
    await db.collection('games').dropIndex('coordinates_2dsphere');
    console.log('Dropped old 2dsphere index');
  } catch (e) {
    console.log('Note:', e.message);
  }
  await db.collection('games').createIndex({ coordinates: '2dsphere' }, { sparse: true });
  console.log('Created sparse 2dsphere index');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
