const express = require("express");
const { addToCart, getCart, updateCart, removeFromCart } = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getCart); // Get user's cart
router.post("/add", protect, addToCart); // Add product to cart
router.put("/update", protect, updateCart); // Update quantity
router.delete("/remove/:productId", protect, removeFromCart); // Remove product

module.exports = router;
