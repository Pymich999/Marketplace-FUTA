const express = require('express');
const router = express.Router();
const {CreateProduct, getProducts} = require('../controllers/productController')
const {protect, isSeller} = require('../middleware/authMiddleware')

//public endpoints routes
router.get('/', getProducts)


//restricted routes
router.post('/', protect, isSeller, CreateProduct)

module.exports = router