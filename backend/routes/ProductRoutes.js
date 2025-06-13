const express = require('express');
const router = express.Router();
const {CreateProduct, getProducts, updateProduct, deleteProduct, getProductById, getSellerProducts} = require('../controllers/productController')
const {protect, isSeller, isBuyer} = require('../middleware/authMiddleware')
const { productLimiter } = require('../middleware/ratelimiter');

//public endpoints routes
router.get('/', getProducts)
router.get('/id', getProductById)

//restricted routes
router.get('/seller', protect, isSeller, getSellerProducts);
router.post('/', protect, isSeller, productLimiter, CreateProduct)
router.put('/:id', protect, isSeller, productLimiter, updateProduct)
router.delete('/:id', protect, isSeller, deleteProduct)

module.exports = router