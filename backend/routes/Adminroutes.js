const express = require('express');
const router = express.Router();
const {protect, isAdmin} = require('../middleware/authMiddleware')


const { 
    getPendingSellerRequests, 
    updateSellerVerification 
} = require('../controllers/adminController');

// Routes for admin
router.get('/pending', protect, isAdmin, getPendingSellerRequests);
router.put('/verify', protect, isAdmin,  updateSellerVerification);

module.exports = router;