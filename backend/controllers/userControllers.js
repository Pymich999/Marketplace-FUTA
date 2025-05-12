const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bycrypt = require('bcryptjs');
const User = require('../models/userModels');
const OTP = require('../models/OtpModel');
const SellerProfile = require('../models/Sellerprofile');
//const { generateJwtToken } = require('../utils/generateToken');
const { generateOTP, sendOTPEmail } = require('../utils/otpUtils');
const mongoose = require('mongoose');


/**
 * Request OTP for email verification
 * @route POST /api/users/request-otp
 * @access Public
 */
const requestEmailOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  // Check if user with this email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  // Generate OTP
  const otp = generateOTP();

  // Save OTP to database (overwrites any existing OTP for this email)
  await OTP.findOneAndDelete({ email });
  await OTP.create({ email, otp });

  // Send OTP to user's email
  try {
    await sendOTPEmail(email, otp);
    res.status(200).json({ message: 'OTP sent to email successfully' });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to send OTP: ' + error.message);
  }
});

/**
 * Register a new buyer user
 * @route POST /api/users/register-buyer
 * @access Public
 */

const registerBuyer = asyncHandler(async (req, res) => {
  const { name, email, password, otp, phone } = req.body;

  if (!name || !email || !password || !otp || !phone) {
    res.status(400);
    throw new Error('All fields are required');
  }

  // Verify OTP
  const otpRecord = await OTP.findOne({ email });
  if (!otpRecord) {
    res.status(400);
    throw new Error('OTP has expired or was never sent. Please request a new one.');
  }

  if (otpRecord.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  // Check if user already exists by email or phone
  const userExists = await User.findOne({ 
    $or: [{ email }, { phone }]
  });
  
  if (userExists) {
    res.status(400);
    throw new Error('User with this email or phone number already exists');
  }

  // Hash password
  const salt = await bycrypt.genSalt(10);
  const hashed = await bycrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    name,
    email,
    password: hashed,
    phone,
    role: 'buyer',
  });

  if (user) {
    // Delete the OTP record since it's been used
    await OTP.findOneAndDelete({ email });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      token: generateJwtToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid User Data');
  }
});


const registerSeller = asyncHandler(async (req, res) => {
  const { name, email, password, phone,  otp, businessName, studentName, businessDescription } = req.body;

  // Validate required fields
  if (!name || !email || !password || !phone || !otp || !businessName || !studentName || !businessDescription) {
    res.status(400);
    throw new Error('All fields are compulsory');
  }

  // Verify OTP
  const otpRecord = await OTP.findOne({ email });
  if (!otpRecord) {
    res.status(400);
    throw new Error('OTP has expired or was never sent. Please request a new one.');
  }

  if (otpRecord.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const phoneExists = await User.findOne({ phone }) || await SellerProfile.findOne({ phone });
  if (phoneExists) {
    res.status(400);
    throw new Error('Phone number is already registered. Please use a different number.');
  }

  // Hash password
  const salt = await bycrypt.genSalt(10);
  const hashedPassword = await bycrypt.hash(password, salt);

  // Create user with seller_pending role
  const user = await User.create({
    name,
    email,
    phone,
    password: hashedPassword,
    role: 'seller_pending'
  });

  if (user) {
    // Delete the OTP record since it's been used
    await OTP.findOneAndDelete({ email });

    // Create seller profile
    const sellerProfile = await SellerProfile.create({
      userId: user._id,
      businessName,
      studentName,
      phone,
      businessDescription,
      verificationStatus: 'pending',
      verificationSubmittedAt: new Date()
    });

    // Return user data with token
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      sellerProfile: {
        businessName: sellerProfile.businessName,
        studentName: sellerProfile.studentName,
        businessDescription: sellerProfile.businessDescription,
        verificationStatus: sellerProfile.verificationStatus
      },
      token: generateJwtToken(user._id)
    });
  } else {
    res.status(400);
    throw new Error('Invalid User Data');
  }
});


const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    
    if (user && (await bycrypt.compare(password, user.password))) {
        // Check if user is a seller and fetch seller profile
        let sellerProfileData = null;
        if (user.role === 'seller_pending' || user.role === 'seller') {
            const sellerProfile = await SellerProfile.findOne({ userId: user._id });
            if (sellerProfile) {
                sellerProfileData = {
                    businessName: sellerProfile.businessName,
                    verificationStatus: sellerProfile.verificationStatus
                };
            }
        }
        
        res.json({ 
            _id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role, 
            sellerProfile: sellerProfileData,
            token: generateJwtToken(user._id) 
        });
    } else {
        res.status(401);
        throw new Error("Invalid credentials");
    }
});

const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  try {
    // Validate that userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }
    
    // Find user by ID
    const user = await User.findById(userId).select('name email role');
    
    // If user is not found
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // If user is a seller, get additional seller profile information
    let sellerData = null;
    if (user.role === 'seller' || user.role === 'seller_pending') {
      const sellerProfile = await SellerProfile.findOne({ userId: user._id });
      if (sellerProfile) {
        sellerData = {
          businessName: sellerProfile.businessName,
          studentName: sellerProfile.studentName
        };
      }
    }
    
    // Return user data
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        sellerProfile: sellerData
      }
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch user information' });
  }
});

const generateJwtToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '5d' });

const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  // Check if user with this email exists
  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('User with this email does not exist');
  }

  // Generate OTP
  const otp = generateOTP();

  // Save OTP to database (overwrites any existing OTP for this email)
  await OTP.findOneAndDelete({ email });
  await OTP.create({ 
    email, 
    otp,
    purpose: 'password_reset' // Mark this OTP for password reset
  });

  // Send OTP to user's email
  try {
    await sendOTPEmail(email, otp, 'Password Reset');
    res.status(200).json({ message: 'Password reset OTP sent to email successfully' });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to send OTP: ' + error.message);
  }
});

/**
 * Verify OTP for password reset
 * @route POST /api/users/verify-reset-otp
 * @access Public
 */
const verifyResetOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required');
  }

  // Find OTP record
  const otpRecord = await OTP.findOne({ 
    email, 
    purpose: 'password_reset' 
  });

  if (!otpRecord) {
    res.status(400);
    throw new Error('OTP has expired or was never sent. Please request a new one.');
  }

  // Verify OTP
  if (otpRecord.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  // OTP is valid - we'll keep the record until password is reset
  // Mark OTP as verified but don't delete it yet
  otpRecord.verified = true;
  await otpRecord.save();

  res.status(200).json({ message: 'OTP verified successfully' });
});

/**
 * Reset password with verified OTP
 * @route POST /api/users/reset-password
 * @access Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and new password are required');
  }

  // Check if OTP was verified
  const otpRecord = await OTP.findOne({ 
    email, 
    purpose: 'password_reset',
    verified: true
  });

  if (!otpRecord) {
    res.status(400);
    throw new Error('Please verify your OTP first');
  }

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Hash new password
  const salt = await bycrypt.genSalt(10);
  const hashedPassword = await bycrypt.hash(password, salt);

  // Update user password
  user.password = hashedPassword;
  await user.save();

  // Delete the OTP record
  await OTP.findOneAndDelete({ email, purpose: 'password_reset' });

  res.status(200).json({ message: 'Password reset successfully' });
});

// Add these to module.exports
module.exports = { 
  registerBuyer, 
  registerSeller, 
  loginUser,
  getUserById, 
  requestEmailOTP,
  requestPasswordReset,    // Add this
  verifyResetOTP,          // Add this
  resetPassword            // Add this
};