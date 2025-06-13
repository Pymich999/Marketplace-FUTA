const mongoose = require('mongoose');

const sellerProfileSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    businessName: {
        type: String,
        required: true
    },

    phone: { type: String, unique: true },
    
    studentName: {
        type: String,
        required: true
    },
    businessDescription: {
        type: String,
        required: true
    },
    verificationStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    verificationSubmittedAt: {
        type: Date,
        default: Date.now
    },
    verificationApprovedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SellerProfile', sellerProfileSchema);