// server.js
import User from './models/User.js';
import VerificationCode from './models/VerificationCode.js';
import { authMiddleware, createAndSendCode, verifyCode, signToken } from './auth.js';

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';

// Models (existing)
import NumberEntry from './models/NumberEntry.js';
import Counter from './models/Counter.js';

// NEW: Auth models & helpers
import User from './models/User.js';
import VerificationCode from './models/VerificationCode.js';
import {
  authMiddleware,
  createAndSendCode,
  verifyCode,
  signToken,
} from './auth.js';

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

/**
 * CORS — allow single or comma-separated origins (and Authorization header)
 * Example .env:
 *   CORS_ORIGIN=https://www.testcity.xyz,http://localhost:5173
 */
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Attach req.user if Authorization: Bearer <token> is present
app.use(authMiddleware);

// Health
app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Numbers API running' });
});

// Mongo
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

/* =========================
   AUTH ROUTES (email codes)
   ========================= */

// Start registration: collect details client-side + send email code
app.post('/api/auth/register/start', async (req, res) => {
  try {
    const { email, fullName, phone, company } = req.body || {};
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and fullName required' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    // Clear any pending unused codes for this email/purpose
    await VerificationCode.deleteMany({ email, purpose: 'register', used: false });
    // Send a new code (stores record + emails via Resend)
    await createAndSendCode(email, 'register');

    // We’ll ask the client to resend name/phone/company on verify (simple & stateless)
    res.json({ ok: true });
  } catch (e) {
    console.error('register/start error:', e);
    res.status(500).json({ error: 'Failed to start registration' });
  }
});

// Complete registration: verify code, then create user + issue JWT
app.post('/api/auth/register/verify', async (req, res) => {
  try {
    const { email, code, fullName, phone, company } = req.body || {};
    if (!email || !code || !fullName) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const check = await verifyCode(email, code, 'register');
    if (!check.ok) return res.status(400).json({ error: check.reason || 'Verification failed' });

    const user = await User.create({ email, fullName, phone, company, verified: true });
    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('register/verify error:', e);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// Start login: send code if user exists
app.post('/api/auth/login/start', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });

    const existing = await User.findOne({ email });
    if (!existing) return res.status(404).json({ error: 'No account for that email' });

    await createAndSendCode(email, 'login');
    res.json({ ok: true });
  } catch (e) {
    console.error('login/start error:', e);
    res.status(500).json({ error: 'Failed to start login' });
  }
});

// Complete login: verify code, issue JWT
app.post('/api/auth/login/verify', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'Missing fields' });

    const check = await verifyCode(email, code, 'login');
    if (!check.ok) return res.status(400).json({ error: check.reason || 'Verification failed' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (e) {
    console.error('login/verify error:', e);
    res.status(500).json({ error: 'Failed to complete login' });
  }
});

// Example protected route
app.get('/api/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await User.findById(req.user.sub, { email: 1, fullName: 1 });
  res.json({ user });
});

/* =========================
   NUMBER ROUTES (existing)
   ========================= */

// Create + save random 8-digit number (with serial)
app.post('/api/numbers', async (_req, res) => {
  try {
    // Atomically increment counter and get the new value
    const serialDoc = await Counter.findOneAndUpdate(
      { _id: 'numbers' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, returnDocument: 'after' }
    );
    const nextSerial = serialDoc.seq;

    const value = Math.floor(10000000 + Math.random() * 90000000); // 8-digit
    const doc = await NumberEntry.create({
      value,
      savedAt: new Date(),
      serial: nextSerial,
    });

    res.status(201).json({
      id: doc._id,
      value: doc.value,
      savedAt: doc.savedAt,
      serial: doc.serial,
    });
  } catch (err) {
    console.error('POST /api/numbers error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicate serial. Try again.' });
    }
    res.status(500).json({ error: 'Failed to save number' });
  }
});

// Most recent number (value)
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

// Most recent number datetime
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

// ALL numbers (for the /all page)
app.get('/api/numbers/all', async (_req, res) => {
  try {
    const docs = await NumberEntry.find({}, { _id: 1, value: 1, savedAt: 1, serial: 1 }).sort({
      savedAt: -1,
    });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch all numbers' });
  }
});

// Second-most-recent (value)
app.get('/api/numbers/second', async (_req, res) => {
  try {
    const doc = await NumberEntry.findOne({}, { value: 1 }, { sort: { savedAt: -1 }, skip: 1 });
    if (!doc) return res.json({ value: null });
    res.json({ value: doc.value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch second-most-recent number' });
  }
});

// Second-most-recent (datetime)
app.get('/api/numbers/second/datetime', async (_req, res) => {
  try {
    const doc = await NumberEntry.findOne({}, { savedAt: 1 }, { sort: { savedAt: -1 }, skip: 1 });
    if (!doc) return res.json({ savedAt: null });
    res.json({ savedAt: doc.savedAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch second-most-recent datetime' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 API listening on :${PORT}`));



// fri 29 oct 2025, 9:40PM AEST --- did above code

// import 'dotenv/config';
// import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import mongoose from 'mongoose';
// import NumberEntry from './models/NumberEntry.js';
// import Counter from './models/Counter.js'; // add this near other imports

// const app = express();
// app.use(helmet());
// app.use(morgan('dev'));
// app.use(express.json());

// const corsOrigin = process.env.CORS_ORIGIN || '*';
// app.use(
// cors({
// origin: corsOrigin === '*' ? true : corsOrigin,
// credentials: false
// })
// );

// app.get('/', (_req, res) => {
// res.json({ ok: true, message: 'Numbers API running' });
// });

// const mongoUri = process.env.MONGO_URI;
// if (!mongoUri) {
// console.error('Missing MONGO_URI in environment');
// process.exit(1);
// }

// mongoose
// .connect(mongoUri)
// .then(() => console.log('✅ Connected to MongoDB'))
// .catch((err) => {
// console.error('Mongo connection error:', err.message);
// process.exit(1);
// });

// app.post('/api/numbers', async (_req, res) => {
//   try {
//     // Atomically increment counter and get the new value
//     const serialDoc = await Counter.findOneAndUpdate(
//       { _id: 'numbers' },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, returnDocument: 'after' }
//     );
//     const nextSerial = serialDoc.seq;

//     const value = Math.floor(10000000 + Math.random() * 90000000); // 8-digit
//     const doc = await NumberEntry.create({
//       value,
//       savedAt: new Date(),
//       serial: nextSerial
//     });

//     res.status(201).json({
//       id: doc._id,
//       value: doc.value,
//       savedAt: doc.savedAt,
//       serial: doc.serial
//     });
//   } catch (err) {
//     console.error('POST /api/numbers error:', err);
//     // If duplicate key on serial ever occurs, surface a clear message:
//     if (err && err.code === 11000) {
//       return res.status(409).json({ error: 'Duplicate serial. Try again.' });
//     }
//     res.status(500).json({ error: 'Failed to save number' });
//   }
// });

// app.get('/api/numbers/last', async (_req, res) => {
// try {
// const doc = await NumberEntry.findOne({}, {}, { sort: { savedAt: -1 } });
// if (!doc) return res.json({ value: null });
// res.json({ value: doc.value });
// } catch (err) {
// console.error(err);
// res.status(500).json({ error: 'Failed to fetch last number' });
// }
// });

// app.get('/api/numbers/last/datetime', async (_req, res) => {
// try {
// const doc = await NumberEntry.findOne({}, {}, { sort: { savedAt: -1 } });
// if (!doc) return res.json({ savedAt: null });
// res.json({ savedAt: doc.savedAt });
// } catch (err) {
// console.error(err);
// res.status(500).json({ error: 'Failed to fetch last datetime' });
// }
// });

// // This route is to get ALL of the numbers from the DB, for the 
// // webpage called "All Numbers", which just shows the whole DB table. 
// app.get('/api/numbers/all', async (_req, res) => {
//   try {
//     const docs = await NumberEntry.find({}).sort({ savedAt: -1 });
//     res.json(docs);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch all numbers' });
//   }
// });

// // Get second-most-recent number (value only)
// app.get('/api/numbers/second', async (_req, res) => {
//   try {
//     const doc = await NumberEntry.findOne({}, { value: 1 }, { sort: { savedAt: -1 }, skip: 1 });
//     if (!doc) return res.json({ value: null });
//     res.json({ value: doc.value });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch second-most-recent number' });
//   }
// });

// // Get datetime of second-most-recent number
// app.get('/api/numbers/second/datetime', async (_req, res) => {
//   try {
//     const doc = await NumberEntry.findOne({}, { savedAt: 1 }, { sort: { savedAt: -1 }, skip: 1 });
//     if (!doc) return res.json({ savedAt: null });
//     res.json({ savedAt: doc.savedAt });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch second-most-recent datetime' });
//   }
// });

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => console.log(`🚀 API listening on :${PORT}`));