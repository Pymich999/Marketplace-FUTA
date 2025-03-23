const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bycrypt = require('bcryptjs');
const User = require('../models/userModels');
const OTP = require('../models/OtpModel');
const SellerProfile = require('../models/Sellerprofile');
//const { generateJwtToken } = require('../utils/generateToken');
const { generateOTP, sendOTPEmail } = require('../utils/otpUtils');

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


const generateJwtToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '5d' });

module.exports = { registerBuyer, registerSeller, loginUser, requestEmailOTP};