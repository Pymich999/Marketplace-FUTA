const express = require('express')
const router = express.Router()
const {registerBuyer, loginUser, registerSeller, requestEmailOTP, getUserById} = require('../controllers/userControllers')
const {protect, isAdmin} = require('../middleware/authMiddleware')


router.post('/', registerBuyer)

router.post('/request-otp', requestEmailOTP);

router.post('/seller-signup', registerSeller)

router.post('/login', loginUser)

router.get('/:userId', protect, getUserById);


module.exports = router