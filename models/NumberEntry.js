import mongoose from 'mongoose';

const NumberEntrySchema = new mongoose.Schema(
{
value: { type: Number, required: true },
savedAt: { type: Date, required: true, default: Date.now }
},
{ timestamps: false }
);

NumberEntrySchema.index({ savedAt: -1 });

export default mongoose.model('NumberEntry', NumberEntrySchema);