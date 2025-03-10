const express = require('express')
const router = express.Router()
const {registerBuyer, loginUser, registerSeller, requestEmailOTP} = require('../controllers/userControllers')
const {protect, isAdmin} = require('../middleware/authMiddleware')


router.post('/', registerBuyer)

router.post('/request-otp', requestEmailOTP);

router.post('/register-seller', registerSeller)

router.post('/login', loginUser)


module.exports = router