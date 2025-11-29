const mongoose = require('mongoose');
const applicationSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  institution: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  interestArea: { type: String, required: true, enum: ['foreign-policy', 'governance', 'climate', 'peace', 'culture'] },
  experience: { type: String, required: true },
  motivation: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  notes: { type: String, default: '' }
}, { timestamps: true });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ email: 1 });
module.exports = mongoose.model('Application', applicationSchema);
