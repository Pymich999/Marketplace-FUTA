const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/userModels');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (error) {
            console.log(error);
            res.status(401);
            throw new Error("You are not Authorized");
        }
    }

    if (!token) {
        res.status(401);
        throw new Error("not authorized, no token");
    }
});

const isAdmin = asyncHandler(async (req, res, next) => {
    // Ensure req.user exists (it should if verifyToken ran successfully)
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized. No user data found." });
    }
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
    }
    next();
});

const isSeller = asyncHandler(async (req, res, next) => {
    if (req.user.role !== "seller") return res.status(403).json({ message: "Access denied" });
    next();
});

const isBuyer = asyncHandler(async (req, res, next) => {
    if (req.user.role !== "buyer") return res.status(403).json({ message: "Access denied" });
    next();
});


module.exports = { protect, isAdmin, isSeller, isBuyer };