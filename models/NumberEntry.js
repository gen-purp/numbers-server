import mongoose from 'mongoose';

const NumberEntrySchema = new mongoose.Schema(
  {
    value:   { type: Number, required: true },
    savedAt: { type: Date,   required: true, default: Date.now },
    serial:  { type: Number, required: true, unique: true } // NEW
  },
  { timestamps: false }
);

NumberEntrySchema.index({ savedAt: -1 });
NumberEntrySchema.index({ serial: 1 }, { unique: true });   // helpful index

export default mongoose.model('NumberEntry', NumberEntrySchema);