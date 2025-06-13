const express = require("express");
const { placeOrder, getOrders } = require("../controllers/orderController");
const { protect, isBuyer } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, isBuyer, placeOrder); // Only buyers can place orders
router.get("/", protect, getOrders); // Buyer sees their orders, sellers see related orders

module.exports = router;
