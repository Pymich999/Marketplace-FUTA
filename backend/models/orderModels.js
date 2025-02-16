const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                quantity: {
                    type: Number,
                    required: true,
                },
                price: {
                    type: Number,
                    required: true,
                }
            }
        ],
        totalAmount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: [
                "Pending", "Confirmed", "Shipped", "Delivered", "Canceled"
            ],
            default: "Pending"

        },
        paymentStatus: {
            type: String,
            enum: [
                "Pending", "Paid", "Failed"
            ],
            default: "Pending"
        },
        transactionID: {type: String},
    },
    {timestamps: true},
);

const Order = mongoose.model("Order", orderSchema)

module.exports = Order