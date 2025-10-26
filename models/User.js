import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    phone: { type: String },
    company: { type: String },
    verified: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model('User', UserSchema);


// import mongoose from 'mongoose';

// const UserSchema = new mongoose.Schema(
// {
// email: { type: String, required: true, unique: true, lowercase: true, trim: true },
// fullName: { type: String, required: true },
// phone: { type: String },
// company: { type: String },
// verified: { type: Boolean, default: true },
// createdAt: { type: Date, default: Date.now }
// },
// { timestamps: false }
// );

// UserSchema.index({ email: 1 }, { unique: true });

// export default mongoose.model('User', UserSchema);