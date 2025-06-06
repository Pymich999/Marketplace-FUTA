const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Fixed typo: was 'bycrypt'
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/userModels');
const OTP = require('../models/OtpModel');
const SellerProfile = require('../models/Sellerprofile');
const { generateOTP, sendOTPEmail } = require('../utils/otpUtils');
const mongoose = require('mongoose');

// Rate limiting configurations
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1, // 1 OTP request per minute per IP
    message: 'OTP requests are limited to once per minute',
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 5 failed login attempts per window
    skipSuccessfulRequests: true,
    message: 'Too many failed login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Input validation middleware
const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .isLength({ max: 100 })
        .withMessage('Valid email is required (max 100 characters)'),
    body('password')
        .isLength({ min: 8, max: 128 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be 8-128 characters with uppercase, lowercase, number and special character'),
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name must be 2-50 characters, letters and spaces only'),
    body('phone')
        .isMobilePhone()
        .isLength({ min: 10, max: 15 })
        .withMessage('Valid phone number is required'),
    body('otp')
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be exactly 6 digits')
];

const emailValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .isLength({ max: 100 })
        .withMessage('Valid email is required')
];

const passwordResetValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 8, max: 128 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must be 8-128 characters with uppercase, lowercase, number and special character')
];

// Helper function to validate input and handle errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Enhanced password validation
const validatePassword = (password) => {
    const minLength = 8;
    const maxLength = 128;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    
    return password.length >= minLength && 
           password.length <= maxLength &&
           hasUpperCase && 
           hasLowerCase && 
           hasNumbers && 
           hasSpecialChar;
};

// Secure token generation with refresh tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { id: userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: '15m' } // Short-lived access token
    );
    
    const refreshToken = jwt.sign(
        { id: userId }, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, 
        { expiresIn: '7d' }
    );
    
    return { accessToken, refreshToken };
};

// Secure OTP verification with timing attack protection
const verifyOTPSecurely = (storedOTP, providedOTP) => {
    if (!storedOTP || !providedOTP) {
        return false;
    }
    
    // Convert to buffers for constant-time comparison
    const storedBuffer = Buffer.from(storedOTP.toString());
    const providedBuffer = Buffer.from(providedOTP.toString());
    
    // Ensure buffers are same length for timing safety
    if (storedBuffer.length !== providedBuffer.length) {
        return false;
    }
    
    return crypto.timingSafeEqual(storedBuffer, providedBuffer);
};

// Enhanced OTP cleanup - remove expired OTPs
const cleanupExpiredOTPs = async () => {
    try {
        await OTP.deleteMany({
            createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // 5 minutes
        });
    } catch (error) {
        console.error('Error cleaning up expired OTPs:', error);
    }
};

/**
 * Request OTP for email verification
 * @route POST /api/users/request-otp
 * @access Public
 */
const requestEmailOTP = [
    otpLimiter,
    emailValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email } = req.body;

        // Clean up expired OTPs first
        await cleanupExpiredOTPs();

        // Check if user with this email already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Check for recent OTP requests (additional rate limiting)
        const recentOTP = await OTP.findOne({
            email,
            createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // 1 minute
        });

        if (recentOTP) {
            return res.status(429).json({
                success: false,
                message: 'Please wait before requesting another OTP'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Save OTP to database with expiration
        await OTP.findOneAndDelete({ email });
        await OTP.create({ 
            email, 
            otp,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        });

        // Send OTP to user's email (keeping your Brevo logic)
        try {
            await sendOTPEmail(email, otp);
            res.status(200).json({ 
                success: true,
                message: 'OTP sent to email successfully' 
            });
        } catch (error) {
            console.error('Email sending error:', error);
            // Clean up OTP if email fails
            await OTP.findOneAndDelete({ email });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP. Please try again.'
            });
        }
    })
];

/**
 * Register a new buyer user
 * @route POST /api/users/register-buyer
 * @access Public
 */
const registerBuyer = [
    authLimiter,
    registerValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { name, email, password, otp, phone } = req.body;

        // Additional password validation
        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be 8-128 characters with uppercase, lowercase, number and special character'
            });
        }

        // Verify OTP with expiration check
        const otpRecord = await OTP.findOne({ 
            email,
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // 5 min expiry
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired or was never sent. Please request a new one.'
            });
        }

        // Secure OTP verification
        if (!verifyOTPSecurely(otpRecord.otp, otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Check if user already exists by email or phone
        const userExists = await User.findOne({ 
            $or: [{ email }, { phone }]
        });
        
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or phone number already exists'
            });
        }

        // Hash password with stronger salt
        const salt = await bcrypt.genSalt(12); // Increased from 10
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            phone,
            role: 'buyer',
            loginAttempts: 0,
            isEmailVerified: true
        });

        if (user) {
            // Delete the OTP record since it's been used
            await OTP.findOneAndDelete({ email });

            // Generate tokens
            const { accessToken, refreshToken } = generateTokens(user._id);

            res.status(201).json({
                success: true,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                },
                accessToken,
                refreshToken
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    })
];

/**
 * Register a new seller user
 * @route POST /api/users/register-seller
 * @access Public
 */
const registerSeller = [
    authLimiter,
    [
        ...registerValidation,
        body('businessName')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Business name must be 2-100 characters'),
        body('studentName')
            .trim()
            .isLength({ min: 2, max: 50 })
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage('Student name must be 2-50 characters, letters and spaces only'),
        body('businessDescription')
            .trim()
            .isLength({ min: 10, max: 500 })
            .withMessage('Business description must be 10-500 characters')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { name, email, password, phone, otp, businessName, studentName, businessDescription } = req.body;

        // Additional password validation
        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be 8-128 characters with uppercase, lowercase, number and special character'
            });
        }

        // Verify OTP with expiration check
        const otpRecord = await OTP.findOne({ 
            email,
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // 5 min expiry
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired or was never sent. Please request a new one.'
            });
        }

        // Secure OTP verification
        if (!verifyOTPSecurely(otpRecord.otp, otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        const phoneExists = await User.findOne({ phone }) || await SellerProfile.findOne({ phone });
        if (phoneExists) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is already registered. Please use a different number.'
            });
        }

        // Hash password with stronger salt
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user with seller_pending role
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase(),
            phone,
            password: hashedPassword,
            role: 'seller_pending',
            loginAttempts: 0,
            isEmailVerified: true
        });

        if (user) {
            // Delete the OTP record since it's been used
            await OTP.findOneAndDelete({ email });

            // Create seller profile
            const sellerProfile = await SellerProfile.create({
                userId: user._id,
                businessName: businessName.trim(),
                studentName: studentName.trim(),
                phone,
                businessDescription: businessDescription.trim(),
                verificationStatus: 'pending',
                verificationSubmittedAt: new Date()
            });

            // Generate tokens
            const { accessToken, refreshToken } = generateTokens(user._id);

            // Return user data with token
            res.status(201).json({
                success: true,
                user: {
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
                    }
                },
                accessToken,
                refreshToken
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to create user'
            });
        }
    })
];

/**
 * Login user with account lockout protection
 * @route POST /api/users/login
 * @access Public
 */
const loginUser = [
    loginLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if account is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.status(423).json({
                success: false,
                message: 'Account is temporarily locked due to too many failed login attempts'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            // Increment failed login attempts
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            
            // Lock account after 5 failed attempts
            if (user.loginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
            }
            
            await user.save();
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Reset login attempts on successful login
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();

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

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        
        res.json({ 
            success: true,
            user: {
                _id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                sellerProfile: sellerProfileData
            },
            accessToken,
            refreshToken
        });
    })
];

/**
 * Get user by ID
 * @route GET /api/users/:userId
 * @access Private
 */
const getUserById = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Validate that userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID format' 
            });
        }
        
        // Find user by ID
        const user = await User.findById(userId).select('name email role createdAt');
        
        // If user is not found
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // If user is a seller, get additional seller profile information
        let sellerData = null;
        if (user.role === 'seller' || user.role === 'seller_pending') {
            const sellerProfile = await SellerProfile.findOne({ userId: user._id });
            if (sellerProfile) {
                sellerData = {
                    businessName: sellerProfile.businessName,
                    studentName: sellerProfile.studentName,
                    verificationStatus: sellerProfile.verificationStatus
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
                createdAt: user.createdAt,
                sellerProfile: sellerData
            }
        });
        
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch user information' 
        });
    }
});

/**
 * Request password reset OTP
 * @route POST /api/users/request-password-reset
 * @access Public
 */
const requestPasswordReset = [
    otpLimiter,
    emailValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email } = req.body;

        // Check if user with this email exists
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User with this email does not exist'
            });
        }

        // Generate OTP
        const otp = generateOTP();

        // Save OTP to database (overwrites any existing OTP for this email)
        await OTP.findOneAndDelete({ email });
        await OTP.create({ 
            email: email.toLowerCase(), 
            otp,
            purpose: 'password_reset',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        });

        // Send OTP to user's email (keeping your Brevo logic)
        try {
            await sendOTPEmail(email, otp, 'Password Reset');
            res.status(200).json({ 
                success: true,
                message: 'Password reset OTP sent to email successfully' 
            });
        } catch (error) {
            console.error('Email sending error:', error);
            // Clean up OTP if email fails
            await OTP.findOneAndDelete({ email, purpose: 'password_reset' });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP. Please try again.'
            });
        }
    })
];

/**
 * Verify OTP for password reset
 * @route POST /api/users/verify-reset-otp
 * @access Public
 */
const verifyResetOTP = [
    authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be exactly 6 digits')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email, otp } = req.body;

        // Find OTP record with expiration check
        const otpRecord = await OTP.findOne({ 
            email: email.toLowerCase(), 
            purpose: 'password_reset',
            createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // 5 min expiry
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired or was never sent. Please request a new one.'
            });
        }

        // Secure OTP verification
        if (!verifyOTPSecurely(otpRecord.otp, otp)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Mark OTP as verified but don't delete it yet
        otpRecord.verified = true;
        await otpRecord.save();

        res.status(200).json({ 
            success: true,
            message: 'OTP verified successfully' 
        });
    })
];

/**
 * Reset password with verified OTP
 * @route POST /api/users/reset-password
 * @access Public
 */
const resetPassword = [
    authLimiter,
    passwordResetValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        // Additional password validation
        if (!validatePassword(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be 8-128 characters with uppercase, lowercase, number and special character'
            });
        }

        // Check if OTP was verified
        const otpRecord = await OTP.findOne({ 
            email: email.toLowerCase(), 
            purpose: 'password_reset',
            verified: true,
            createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } // 10 min window for password reset
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'Please verify your OTP first'
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password with stronger salt
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user password and reset login attempts
        user.password = hashedPassword;
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();

        // Delete the OTP record
        await OTP.findOneAndDelete({ email: email.toLowerCase(), purpose: 'password_reset' });

        res.status(200).json({ 
            success: true,
            message: 'Password reset successfully' 
        });
    })
];

/**
 * Refresh access token
 * @route POST /api/users/refresh-token
 * @access Public
 */
const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({
            success: false,
            message: 'Refresh token is required'
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

        res.json({
            success: true,
            accessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
});

module.exports = { 
    registerBuyer, 
    registerSeller, 
    loginUser,
    getUserById, 
    requestEmailOTP,
    requestPasswordReset,
    verifyResetOTP,
    resetPassword,
    refreshToken,
    // Export rate limiters for use in routes
    authLimiter,
    otpLimiter,
    loginLimiter
};