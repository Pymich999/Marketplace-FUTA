const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel");
const Product = require("../models/productModels");

// Get User Cart
const getCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product", "title price stock");
    if (!cart) {
        return res.status(200).json({ items: [] }); // Empty cart
    }
    res.json(cart);
});

// Add to Cart
const addToCart = asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
        res.status(404);
        throw new Error("Product not found");
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
        cart = new Cart({ user: req.user._id, items: [] });
    }

    const existingItem = cart.items.find((item) => item.product.toString() === productId);

    if (existingItem) {
        existingItem.quantity += quantity; // Update quantity
    } else {
        cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    res.status(201).json(cart);
});

// Update Cart Quantity
const updateCart = asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
        res.status(404);
        throw new Error("Cart not found");
    }

    const item = cart.items.find((item) => item.product.toString() === productId);
    if (!item) {
        res.status(404);
        throw new Error("Product not in cart");
    }

    item.quantity = quantity; // Update quantity
    await cart.save();
    res.json(cart);
});

// Remove from Cart
const removeFromCart = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
        res.status(404);
        throw new Error("Cart not found");
    }

    cart.items = cart.items.filter((item) => item.product.toString() !== productId);
    await cart.save();
    res.json(cart);
});

module.exports = { getCart, addToCart, updateCart, removeFromCart };
