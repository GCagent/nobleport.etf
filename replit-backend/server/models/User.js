const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
