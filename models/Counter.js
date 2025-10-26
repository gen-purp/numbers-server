import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },      // e.g., 'numbers'
  seq: { type: Number, required: true, default: 0 }
});

export default mongoose.model('Counter', CounterSchema);


