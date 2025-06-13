const express = require('express');
const router = express.Router();
const {protect, isAdmin} = require('../middleware/authMiddleware')


const { 
    getPendingSellerRequests, 
    updateSellerVerification 
} = require('../controllers/adminController');

// Routes for admin
router.get('/sellers/pending', protect, isAdmin, getPendingSellerRequests);
router.put('/sellers/verify', protect, isAdmin,  updateSellerVerification);

module.exports = router;