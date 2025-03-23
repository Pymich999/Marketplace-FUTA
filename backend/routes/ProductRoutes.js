const express = require('express');
const router = express.Router();
const {CreateProduct, getProducts, updateProduct, deleteProduct, getProductById, getSellerProducts} = require('../controllers/productController')
const {protect, isSeller} = require('../middleware/authMiddleware')

//public endpoints routes
router.get('/', getProducts)
router.get('/id', getProductById)

//restricted routes
router.get('/seller', protect, isSeller, getSellerProducts);
router.post('/', protect, isSeller, CreateProduct)
router.put('/:id', protect, isSeller, updateProduct)
router.delete('/:id', protect, isSeller, deleteProduct)

module.exports = router