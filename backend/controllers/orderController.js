const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModels");
const Product = require("../models/productModels");
const Cart = require("../models/cartModel")

// Place an order
const placeOrder = asyncHandler(async (req, res) => {
    const { selectedProducts } = req.body; // Expect an array of { productId, quantity }

    if (!selectedProducts || selectedProducts.length === 0) {
        res.status(400);
        throw new Error("No items selected for order");
    }

    // Fetch user cart
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");

    if (!cart || cart.items.length === 0) {
        res.status(400);
        throw new Error("Your cart is empty");
    }

    let totalAmount = 0;
    const orderItems = [];
    const remainingCartItems = [];

    for (let cartItem of cart.items) {
        const selectedItem = selectedProducts.find(
            (item) => item.productId.toString() === cartItem.product._id.toString()
        );

        if (selectedItem) {
            if (cartItem.product.stock < selectedItem.quantity) {
                res.status(400);
                throw new Error(`Not enough stock for ${cartItem.product.title}`);
            }

            totalAmount += cartItem.product.price * selectedItem.quantity;
            orderItems.push({
                product: cartItem.product._id,
                quantity: selectedItem.quantity,
                price: cartItem.product.price,
            });

            // Reduce stock
            cartItem.product.stock -= selectedItem.quantity;
            await cartItem.product.save();
        } else {
            // Keep unselected items in the cart
            remainingCartItems.push(cartItem);
        }
    }

    // Create Order
    const order = await Order.create({
        buyer: req.user._id,
        items: orderItems,
        totalAmount,
        status: "Pending",
    });

    // Update cart with remaining items
    cart.items = remainingCartItems;
    await cart.save();

    res.status(201).json(order);
});

const getOrders = asyncHandler(async (req, res) => {
    let query = {};

    if (req.user.role === "buyer") {
        query.buyer = req.user._id; // Fetch buyer's own orders
    } else if (req.user.role === "seller") {
        const sellerProducts = await Product.find({ seller: req.user._id });
        query["items.product"] = { $in: sellerProducts.map(p => p._id) }; // Fetch orders containing seller's products
    }

    const orders = await Order.find(query).populate("buyer", "name email");

    res.status(200).json(orders);
});


module.exports = { placeOrder, getOrders };
