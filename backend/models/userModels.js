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

        phone: { type: String, required: true, unique: true },

        
        verified: { type: Boolean, default: false },

        role: {
            type: String,
            enum: ["buyer", "seller", "admin", "seller_pending"],
            default: "buyer"
        },

        sellerDetails: {
            businessName: { type: String },
            studentName: { type: String },
            businessDescription: { type: String }
        },

    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model('User', userSchema);