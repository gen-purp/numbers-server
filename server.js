import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import NumberEntry from './models/NumberEntry.js';

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
cors({
origin: corsOrigin === '*' ? true : corsOrigin,
credentials: false
})
);

app.get('/', (_req, res) => {
res.json({ ok: true, message: 'Numbers API running' });
});

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
console.error('Missing MONGO_URI in environment');
process.exit(1);
}

mongoose
.connect(mongoUri)
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => {
console.error('Mongo connection error:', err.message);
process.exit(1);
});

app.post('/api/numbers', async (_req, res) => {
try {
const value = Math.floor(10000000 + Math.random() * 90000000);
const doc = await NumberEntry.create({ value, savedAt: new Date() });
res.status(201).json({ id: doc._id, value: doc.value, savedAt: doc.savedAt });
} catch (err) {
console.error(err);
res.status(500).json({ error: 'Failed to save number' });
}
});

app.get('/api/numbers/last', async (_req, res) => {
try {
const doc = await NumberEntry.findOne({}, {}, { sort: { savedAt: -1 } });
if (!doc) return res.json({ value: null });
res.json({ value: doc.value });
} catch (err) {
console.error(err);
res.status(500).json({ error: 'Failed to fetch last number' });
}
});

app.get('/api/numbers/last/datetime', async (_req, res) => {
try {
const doc = await NumberEntry.findOne({}, {}, { sort: { savedAt: -1 } });
if (!doc) return res.json({ savedAt: null });
res.json({ savedAt: doc.savedAt });
} catch (err) {
console.error(err);
res.status(500).json({ error: 'Failed to fetch last datetime' });
}
});

// This route is to get ALL of the numbers from the DB, for the 
// webpage called "All Numbers", which just shows the whole DB table. 
app.get('/api/numbers/all', async (_req, res) => {
  try {
    const docs = await NumberEntry.find({}).sort({ savedAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch all numbers' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API listening on :${PORT}`));