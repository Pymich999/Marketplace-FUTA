
const asyncHandler = require('express-async-handler');
const User = require('../models/userModels');
const SellerProfile = require('../models/Sellerprofile');

// Get all pending seller verification requests
const getPendingSellerRequests = asyncHandler(async (req, res) => {
    // Ensure the requester is an admin
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error("Not authorized to access this resource");
    }
    
    // Find all users with seller_pending role
    const pendingSellers = await User.find({ role: 'seller_pending' }).select('-password');
    
    // Get their profiles
    const sellerDetails = await Promise.all(
        pendingSellers.map(async (seller) => {
            const profile = await SellerProfile.findOne({ userId: seller._id });
            return {
                user: {
                    _id: seller._id,
                    name: seller.name,
                    email: seller.email,
                    role: seller.role
                },
                profile: profile ? {
                    businessName: profile.businessName,
                    studentName: profile.studentName,
                    businessDescription: profile.businessDescription,
                    verificationStatus: profile.verificationStatus,
                    submittedAt: profile.verificationSubmittedAt
                } : null
            };
        })
    );
    
    res.json(sellerDetails);
});

// Approve or reject a seller
const updateSellerVerification = asyncHandler(async (req, res) => {
    const { sellerId, action, rejectionReason } = req.body;
    
    // Ensure the requester is an admin
    if (req.user.role !== 'admin') {
        res.status(403);
        throw new Error("Not authorized to perform this action");
    }
    
    // Validate action
    if (action !== 'approve' && action !== 'reject') {
        res.status(400);
        throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }
    
    // Find the seller
    const seller = await User.findById(sellerId);
    if (!seller || seller.role !== 'seller_pending') {
        res.status(404);
        throw new Error("Pending seller not found");
    }
    
    // Find seller profile
    const sellerProfile = await SellerProfile.findOne({ userId: sellerId });
    if (!sellerProfile) {
        res.status(404);
        throw new Error("Seller profile not found");
    }
    
    // Update status based on action
    if (action === 'approve') {
        seller.role = 'seller';
        sellerProfile.verificationStatus = 'approved';
        sellerProfile.verificationApprovedAt = new Date();
    } else {
        sellerProfile.verificationStatus = 'rejected';
        sellerProfile.rejectionReason = rejectionReason || "No reason provided";
    }
    
    await seller.save();
    await sellerProfile.save();
    
    res.json({
        message: `Seller ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        seller: {
            _id: seller._id,
            name: seller.name,
            email: seller.email,
            role: seller.role
        },
        profile: {
            businessName: sellerProfile.businessName,
            verificationStatus: sellerProfile.verificationStatus,
            rejectionReason: sellerProfile.rejectionReason
        }
    });
});

module.exports = {
    getPendingSellerRequests,
    updateSellerVerification
};