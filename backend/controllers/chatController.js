const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const admin = require("../firebase");
const Product = require("../models/productModels");
const User = require("../models/userModels");
const SellerProfile = require("../models/Sellerprofile");

// Checkout attempt TTL schema
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
    expires: 3600
  }
});
const CheckoutAttempt = mongoose.models.CheckoutAttempt ||
  mongoose.model('CheckoutAttempt', checkoutAttemptSchema);

exports.checkoutChat = asyncHandler(async (req, res) => {
  console.log("🔔 checkoutChat called with body:", JSON.stringify(req.body));

  try {
    const { cartItems, buyerId } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0 || !buyerId) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    const buyer = await User.findById(buyerId);
    if (!buyer) return res.status(404).json({ success: false, message: 'Buyer not found' });

    const hourAgo = new Date(Date.now() - 3600000);
    const count = await CheckoutAttempt.countDocuments({ buyerId, createdAt: { $gt: hourAgo } });
    if (count > 10) {
      return res.status(429).json({ success: false, message: 'Too many attempts' });
    }

    await CheckoutAttempt.create({ buyerId, cartItems });

    const notifiedSellers = [];
    const failedItems = [];
    const processedItems = new Set();

    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      await Promise.all(cartItems.map(async ({ productId, quantity }, idx) => {
        const itemKey = `${productId}_${quantity}`;
        if (processedItems.has(itemKey)) return;
        processedItems.add(itemKey);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
          failedItems.push({ productId, reason: "Invalid product ID" });
          return;
        }

        const product = await Product.findById(productId)
          .populate("seller", "name email phone role")
          .session(session);

        if (!product) {
          failedItems.push({ productId, reason: "Product not found" });
          return;
        }

        const seller = product.seller;
        if (!seller || seller.role !== "seller") {
          failedItems.push({ productId, reason: "User is not a seller" });
          return;
        }

        if (product.stock <= 0 || product.stock < quantity) {
          failedItems.push({
            productId,
            product: product.title,
            reason: `Stock too low (${product.stock})`
          });
          return;
        }

        // Fix: Use `stock`, not undefined `quantity` field in product
        product.stock -= quantity;
        await product.save({ session });

        const sellerProfile = await SellerProfile.findOne({ userId: seller._id });
        const sellerName = sellerProfile?.studentName || seller.name || "Seller";
        const buyerName = buyer.name || "Buyer";

        const totalPrice = (product.price * quantity).toFixed(2);
        const messageText = `Hello ${sellerName}, ${buyerName} wants ${quantity}× ${product.title} for $${totalPrice}.`;

        const threadId = [buyerId, seller._id.toString()].sort().join("_");

        // Realtime DB check for duplicate
        const snap = await admin.database()
          .ref(`chats/${threadId}`)
          .orderByChild('timestamp')
          .startAt(Date.now() - 3600000)
          .once("value");

        let isDuplicate = false;
        snap.forEach(childSnap => {
          const msg = childSnap.val();
          if (msg.content === messageText && msg.senderId === buyerId) {
            isDuplicate = true;
          }
        });

        if (isDuplicate) {
          failedItems.push({ productId, reason: "Duplicate checkout attempt" });
          return;
        }

        // ✅ Push to Realtime DB (message stream)
        const chatRef = admin.database().ref(`chats/${threadId}`);
        await chatRef.push({
          senderId:   buyerId,
          receiverId: seller._id.toString(),
          content:    messageText,
          timestamp:  Date.now(),
          type:       'checkout',
          price:      totalPrice,
          productId
        });

        // ✅ Push summary to Firestore (inbox view)
        await admin.firestore().collection('chatThreads').doc(threadId).set({
          users: [buyerId, seller._id.toString()],
          lastMessage: messageText,
          lastTimestamp: Date.now(),
          productId,
          buyerId,
          sellerId: seller._id.toString(),
          buyerName,
          sellerName,
          productTitle: product.title,
          quantity,
          price: totalPrice
        }, { merge: true });

        notifiedSellers.push({
          sellerId: seller._id,
          username: sellerName,
          productTitle: product.title,
          quantity,
          price: totalPrice
        });
      }));

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    res.status(200).json({
      success: true,
      sellers: notifiedSellers,
      failedItems: failedItems.length ? failedItems : undefined
    });

  } catch (error) {
    console.error("❌ checkoutChat error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

exports.getChatsForUser = asyncHandler(async (req, res) => {
  const uid = req.user._id.toString();
  const snap = await admin.database().ref("chats").once("value");
  const threads = [];

  snap.forEach(child => {
    const key = child.key;
    if (key.includes(uid)) {
      const [a, b] = key.split("_");
      const other = a === uid ? b : a;
      threads.push({ threadId: key, otherUserId: other });
    }
  });

  res.json(threads);
});

exports.getChatThread = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const snap = await admin.database().ref(`chats/${threadId}`).once("value");
  const data = snap.val() || {};
  const messages = Object.entries(data)
    .map(([id, msg]) => ({ id, ...msg }))
    .sort((a, b) => a.timestamp - b.timestamp);
  res.json(messages);
});
