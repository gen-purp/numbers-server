import 'dotenv/config';
import mongoose from 'mongoose';
import NumberEntry from '../models/NumberEntry.js';
import Counter from '../models/Counter.js';

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('Missing MONGO_URI');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Fetch all, oldest first
  const docs = await NumberEntry.find({}).sort({ savedAt: 1 }).lean();
  console.log(`Found ${docs.length} docs to backfill`);

  // Determine starting serial
  // If some docs already have serial, keep them and fill gaps/zeros; else start at 1.
  let serial = 1;
  const ops = [];

  for (const d of docs) {
    if (typeof d.serial === 'number' && d.serial > 0) {
      // already has serial; ensure serial counter tracks max
      if (d.serial >= serial) serial = d.serial + 1;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { serial } }
      }
    });
    serial += 1;
  }

  if (ops.length > 0) {
    const bulk = await NumberEntry.bulkWrite(ops, { ordered: true });
    console.log('Bulk update result:', bulk.result || bulk);
  } else {
    console.log('No updates needed; all docs already have serials.');
  }

  const maxSerial = serial - 1;
  // Update counters to continue from maxSerial
  const updatedCounter = await Counter.findOneAndUpdate(
    { _id: 'numbers' },
    { $set: { seq: maxSerial } },
    { upsert: true, new: true }
  );
  console.log('Counter set to:', updatedCounter.seq);

  await mongoose.disconnect();
  console.log('Done backfilling serials.');
}

run().catch(async (err) => {
  console.error('Backfill error:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
