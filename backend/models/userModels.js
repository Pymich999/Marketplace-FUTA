const mongoose = require('mongoose');

const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required']
        },

        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true
        },

        password: {
            type: String,
            required: [true, 'Password is required']
        },

        phone: { type: String, unique: true },

        
        verified: { type: Boolean, default: false },

        loginAttempts: { type: Number, default: 0 },
        lockUntil: Date,
        isEmailVerified: { type: Boolean, default: false },

        role: {
            type: String,
            enum: ["buyer", "seller_pending", "seller"],
            default: "buyer"
        },
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model('User', userSchema);