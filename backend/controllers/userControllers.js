const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bycrypt = require('bcryptjs');
const User = require('../models/userModels');

const registerBuyer = asyncHandler(async (req, res) => {
    const { name, email, password, idToken } = req.body;

    if (!name || !email || !password || !idToken) {
        res.status(400);
        throw new Error("All fields are required, including the Firebase ID token");
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        res.status(401);
        throw new Error("Invalid Firebase ID token");
    }

    // Extract phone number from Firebase ID token
    const phone = decodedToken.phone_number;
    if (!phone) {
        res.status(400);
        throw new Error("Phone number is required");
    }

    // The email in the request is the user’s chosen email (not from Firebase)
    const userExists = await User.findOne({ phone });

    if (userExists) {
        res.status(400);
        throw new Error("User with this phone number already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
        name,
        email, // Use the email provided in the request
        password: hashed,
        phone,  // Verified phone number
        role: "buyer",
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: generateJwtToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error("Invalid User Data");
    }
});


const registerSeller = asyncHandler(async (req, res) => {
    const { name, email, password, businessName, studentName, businessDescription } = req.body;

    if (!name || !email || !password || !businessName || !studentName || !businessDescription) {
        res.status(400);
        throw new Error("All fields are compulsory");
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const salt = await bycrypt.genSalt(10);
    const hashed = await bycrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashed, role: "seller_pending" });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            sellerDetails:{
                businessName,
                studentName,
                businessDescription,
            },
            token: generateJwtToken(user._id)
        });
    } else {
        res.status(400);
        throw new Error("Invalid User Data");
    }
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    console.log(user)

    if (user && (await bycrypt.compare(password, user.password))) {
        res.json({ _id: user.id, name: user.name, email: user.email, role: user.role, token: generateJwtToken(user._id) });
    } else {
        res.status(400);
        throw new Error("Invalid data, sign up first. ");
    }
});

const getCurrentUser = asyncHandler(async (req, res) => {
    res.json({ message: "Current User Data" });
});


const generateJwtToken = id => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '5d' });

module.exports = { registerBuyer, registerSeller, loginUser, getCurrentUser };