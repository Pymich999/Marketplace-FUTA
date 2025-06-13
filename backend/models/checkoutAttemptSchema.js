const mongoose = require('mongoose');

// Schema for rate limiting checkout attempts
const checkoutAttemptSchema = new mongoose.Schema({
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cartItems: [{
    productId: String,
    quantity: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // TTL index - documents will be automatically deleted after 1 hour
  }
});

const CheckoutAttempt = mongoose.model('CheckoutAttempt', checkoutAttemptSchema);
