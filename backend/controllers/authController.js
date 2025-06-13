const asyncHandler = require('express-async-handler');
const admin = require('../firebase');
const User = require('../models/userModels');

// Send OTP
const sendOTP = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  try {
    // Firebase Phone Auth: Send OTP
    const verificationId = await admin.auth().createCustomToken(phone);

    return res.status(200).json({
      message: "OTP sent successfully",
      verificationId, // Send this to the frontend
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({ message: error.message });
  }
};


// Verify OTP
const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    res.status(400);
    throw new Error('Phone and OTP are required');
  }

  const session = req.session.otpSession;
  if (!session) {
    res.status(400);
    throw new Error('No OTP session found');
  }

  const isValid = await admin.auth().verifySessionCookie(session, otp);
  if (!isValid) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  req.session.verifiedPhone = phone;
  res.status(200).json({ message: 'OTP verified' });
});

// Complete Registration
const completeRegistration = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const phone = req.session.verifiedPhone;

  if (!name || !email || !password || !phone) {
    res.status(400);
    throw new Error('All fields are required');
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const user = await User.create({ name, email, password, phone, verified: true });
  res.status(201).json({ message: 'User registered successfully', user });
});

// Resend OTP
const resendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    res.status(400);
    throw new Error('Phone number is required');
  }

  const phoneNumber = `+${phone}`;
  const session = await admin.auth().createSessionCookie(phoneNumber);

  req.session.otpSession = session;
  res.status(200).json({ message: 'OTP resent successfully' });
});

module.exports = {
  sendOTP,
  verifyOTP,
  completeRegistration,
  resendOTP
};
