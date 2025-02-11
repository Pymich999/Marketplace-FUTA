const express = require('express');
const router = express.Router();
const {CreateProduct, getProducts, updateProduct, deleteProduct, getProductById} = require('../controllers/productController')
const {protect, isSeller} = require('../middleware/authMiddleware')

//public endpoints routes
router.get('/', getProducts)
router.get('/id', getProductById)

//restricted routes
router.post('/', protect, isSeller, CreateProduct)
router.put('/:id', protect, isSeller, updateProduct)
router.delete('/:id', protect, isSeller, deleteProduct)

module.exports = router