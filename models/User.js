import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

// No extra index lines (unique is already on fields)
export default mongoose.model('User', UserSchema);