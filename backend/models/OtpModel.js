// OtpModel.js modification
// Find your OtpModel.js file and update the schema to include purpose and verified fields:

const mongoose = require('mongoose');

const otpSchema = mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['registration', 'password_reset'],
      default: 'registration'
    },
    verified: {
      type: Boolean,
      default: false
    },
    expiresAt: Date,
    verified: { type: Boolean, default: false },
    purpose: { type: String, enum: ['registration', 'password_reset'], default: 'registration' },
    
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // OTP expires after 10 minutes
    },
  }
);

module.exports = mongoose.model('OTP', otpSchema);