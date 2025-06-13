const express = require('express')
const router = express.Router()
const {registerBuyer, loginUser, registerSeller, requestEmailOTP, getUserById, requestPasswordReset, verifyResetOTP, resetPassword, refreshToken} = require('../controllers/userControllers')
const {protect, isAdmin} = require('../middleware/authMiddleware')


router.post('/', registerBuyer)

router.post('/request-otp', requestEmailOTP);

router.post('/seller-signup', registerSeller)

router.post('/login', loginUser)

router.get('/:userId', protect, getUserById);

// Password reset routes
router.post('/request-password-reset', requestPasswordReset);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);


module.exports = router