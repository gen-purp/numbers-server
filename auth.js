import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import VerificationCode from './models/VerificationCode.js';
import User from './models/User.js';

const jwtSecret = process.env.JWT_SECRET || '6ac0470238ad76e7fe0f9891b8d4c2ba';
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'Test City <noreply@auth.testcity.xyz>';

export function signToken(user) {
  return jwt.sign({ sub: user._id, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

export function authMiddleware(req, _res, next) {
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (!token) return next();
  try { req.user = jwt.verify(token, jwtSecret); } catch {}
  next();
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

export async function sendCodeEmail(email, code, purpose = 'login') {
  const subject = purpose === 'register' ? 'Your Test City verification code' : 'Your Test City login code';
  const text = `Your code is ${code}. It expires in 10 minutes.`;
  await resend.emails.send({ from: FROM, to: email, subject, text });
}

export async function createAndSendCode(email, purpose) {
  const code = generateCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await VerificationCode.create({ email, code, purpose, expiresAt: expires });
  await sendCodeEmail(email, code, purpose);
}

export async function verifyCode(email, code, purpose) {
  const rec = await VerificationCode.findOne({ email, purpose, used: false }).sort({ createdAt: -1 });
  if (!rec) return { ok: false, reason: 'No code found' };
  if (rec.expiresAt < new Date()) return { ok: false, reason: 'Code expired' };
  if (rec.code !== code) return { ok: false, reason: 'Invalid code' };
  rec.used = true; await rec.save();
  return { ok: true };
}
