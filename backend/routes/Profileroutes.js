const express = require('express');
const router = express.Router();
const { 
    getMyProfile, 
    getProfileById, 
    updateProfile,
    getSellerDashboard,
    searchSellers
} = require('../controllers/ProfileController');
const { protect, isSeller } = require('../middleware/authMiddleware');

// Route to get the current user's profile
router.get('/me', protect, getMyProfile);

// Route to get dashboard stats for seller
router.get('/dashboard', protect, getSellerDashboard);
router.get('/dashboard/:userId', protect, getSellerDashboard);
// Route to update current user's profile
router.put('/update', protect, updateProfile);

// Route to search for sellers
router.get('/search', searchSellers);

// Route to get profile by user ID
router.get('/:userId', getProfileById);

module.exports = router;