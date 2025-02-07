const express = require('express')
const router = express.Router()
const {registerBuyer, loginUser, getCurrentUser, registerSeller} = require('../controllers/userControllers')
const {verifySeller} = require('../controllers/adminController')
const {protect, isAdmin} = require('../middleware/authMiddleware')

router.post('/', registerBuyer)

router.post('/register-seller', registerSeller)

router.post('/login', loginUser)
 
router.get('/current', protect, getCurrentUser)

router.post('/verify', protect, isAdmin, verifySeller)

module.exports = router