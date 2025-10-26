import mongoose from 'mongoose';

const VerificationCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['register', 'login'], required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false }
  },
  { timestamps: true }
);

VerificationCodeSchema.index({ email: 1, purpose: 1, createdAt: -1 });
VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('VerificationCode', VerificationCodeSchema);



// import mongoose from 'mongoose';

// const VerificationCodeSchema = new mongoose.Schema(
// {
// email: { type: String, required: true, index: true },
// code: { type: String, required: true }, // NOTE: for production, store a hash
// purpose: { type: String, enum: ['register', 'login'], required: true },
// expiresAt: { type: Date, required: true },
// used: { type: Boolean, default: false }
// },
// { timestamps: true }
// );

// VerificationCodeSchema.index({ email: 1, purpose: 1, createdAt: -1 });
// VerificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-clean after expiry

// export default mongoose.model('VerificationCode', VerificationCodeSchema);