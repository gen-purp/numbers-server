import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

import User from './models/User.js';
import { authMiddleware, requireAuth, signToken } from './auth.js';

const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// CORS allowlist from env (comma-separated)
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: false,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(authMiddleware);

// Health
app.get('/', (_req, res) => res.json({ ok: true, message: 'Auth API running' }));

// Mongo
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) { console.error('Missing MONGO_URI'); process.exit(1); }
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => { console.error('Mongo connection error:', err.message); process.exit(1); });

// ===== Auth routes =====

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, fullName, password } = req.body || {};
    if (!email || !fullName || !password) {
      return res.status(400).json({ error: 'email, fullName, and password are required' });
    }

    // Uniqueness
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
    const passwordHash = await bcrypt.hash(password, rounds);

    const user = await User.create({
      uuid: uuidv4(),
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      passwordHash
    });

    const token = signToken(user);
    res.status(201).json({
      ok: true,
      token,
      user: { id: user._id, uuid: user.uuid, email: user.email, fullName: user.fullName, createdAt: user.createdAt }
    });
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ error: 'Email already registered' });
    console.error('register error:', e);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user._id, uuid: user.uuid, email: user.email, fullName: user.fullName } });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Current user
app.get('/api/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub, { uuid: 1, email: 1, fullName: 1, createdAt: 1 });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Auth API listening on :${PORT}`));
