const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bycrypt = require('bcryptjs');
const User = require('../models/userModels');

const registerBuyer = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error("All fields are compulsory pls");
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const salt = await bycrypt.genSalt(10);
    const hashed = await bycrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashed, role: "buyer" });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,

            token: generateJwtToken(user._id)
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