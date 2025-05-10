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
  attemptId: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // 5 minutes instead of 1 hour
  }
});
const CheckoutAttempt = mongoose.models.CheckoutAttempt ||
  mongoose.model('CheckoutAttempt', checkoutAttemptSchema);

exports.checkoutChat = asyncHandler(async (req, res) => {
  console.log("🔔 checkoutChat called with body:", JSON.stringify(req.body));

  try {
    const { cartItems, buyerId, attemptId } = req.body;

    if (!Array.isArray(cartItems) || cartItems.length === 0 || !buyerId) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    // Check for recent duplicate attempt using the attemptId
    if (attemptId) {
      const existingAttempt = await CheckoutAttempt.findOne({ attemptId });
      if (existingAttempt) {
        return res.status(429).json({ 
          success: false, 
          message: 'Duplicate request detected' 
        });
      }
    }

    const buyer = await User.findById(buyerId);
    if (!buyer) return res.status(404).json({ success: false, message: 'Buyer not found' });

    // More aggressive rate limiting (10 attempts per 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 300000);
    const count = await CheckoutAttempt.countDocuments({ 
      buyerId, 
      createdAt: { $gt: fiveMinutesAgo } 
    });
    
    if (count >= 10) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many attempts. Please wait a few minutes.' 
      });
    }

    // Create attempt record with unique ID
    const newAttemptId = attemptId || crypto.randomBytes(16).toString('hex');
    await CheckoutAttempt.create({ 
      buyerId, 
      cartItems, 
      attemptId: newAttemptId 
    });

    const notifiedSellers = [];
    const failedItems = [];
    const processedItems = new Set();

    // Process each item
    await Promise.all(cartItems.map(async ({ productId, quantity }) => {
      try {
        const itemKey = `${productId}_${quantity}`;
        if (processedItems.has(itemKey)) return;
        processedItems.add(itemKey);

        if (!mongoose.Types.ObjectId.isValid(productId)) {
          failedItems.push({ productId, reason: "Invalid product ID" });
          return;
        }

        // Atomic product update
        const product = await Product.findOneAndUpdate(
          { 
            _id: productId,
            stock: { $gte: quantity }
          },
          { $inc: { stock: -quantity } },
          { 
            new: true,
            populate: { path: "seller", select: "name email phone role" }
          }
        );

        if (!product) {
          const originalProduct = await Product.findById(productId);
          if (!originalProduct) {
            failedItems.push({ productId, reason: "Product not found" });
          } else {
            failedItems.push({
              productId,
              product: originalProduct.title,
              reason: `Stock too low (${originalProduct.stock})`
            });
          }
          return;
        }

        const seller = product.seller;
        if (!seller || seller.role !== "seller") {
          await Product.updateOne(
            { _id: productId },
            { $inc: { stock: quantity } }
          );
          failedItems.push({ 
            productId, 
            product: product.title, 
            reason: "User is not a seller" 
          });
          return;
        }

        const sellerProfile = await SellerProfile.findOne({ userId: seller._id });
        const sellerName = sellerProfile?.studentName || seller.name || "Seller";
        const buyerName = buyer.name || "Buyer";

        const totalPrice = (product.price * quantity).toFixed(2);
        const messageText = `Hello ${sellerName}, ${buyerName} wants ${quantity}× ${product.title} for $${totalPrice}.`;
        const threadId = [buyerId, seller._id.toString()].sort().join("_");

        // More flexible duplicate message check (30 second window)
        const snap = await admin.database()
          .ref(`chats/${threadId}`)
          .orderByChild('timestamp')
          .startAt(Date.now() - 30000)
          .once("value");

        const isDuplicate = Object.values(snap.val() || {}).some(msg => 
          msg.senderId === buyerId && 
          msg.productId === productId &&
          Date.now() - msg.timestamp < 30000
        );

        if (isDuplicate) {
          await Product.updateOne(
            { _id: productId },
            { $inc: { stock: quantity } }
          );
          failedItems.push({ 
            productId, 
            product: product.title, 
            reason: "Recent duplicate request" 
          });
          return;
        }

        // Realtime DB update
        const chatRef = admin.database().ref(`chats/${threadId}`);
        await chatRef.push({
          senderId: buyerId,
          receiverId: seller._id.toString(),
          content: messageText,
          timestamp: Date.now(),
          type: 'checkout',
          price: totalPrice,
          productId
        });

        // Firestore update
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
      } catch (itemError) {
        console.error(`Error processing item ${productId}:`, itemError);
        failedItems.push({ 
          productId, 
          reason: `Processing error: ${itemError.message || 'Unknown error'}` 
        });
      }
    }));

    res.status(200).json({
      success: true,
      sellers: notifiedSellers,
      failedItems: failedItems.length ? failedItems : undefined,
      attemptId: newAttemptId // Return the attempt ID to client
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

exports.getChatThreadDetails = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const userId = req.user._id.toString();
  
  try {
    // Check if the user is part of this thread
    if (!threadId.includes(userId)) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have access to this conversation" 
      });
    }
    
    // Get thread details from Firestore
    const threadDoc = await admin.firestore().collection('chatThreads').doc(threadId).get();
    
    if (!threadDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        message: "Conversation not found" 
      });
    }
    
    const threadData = threadDoc.data();
    
    // Make sure user is actually part of this thread
    if (!threadData.users.includes(userId)) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have access to this conversation" 
      });
    }
    
    res.status(200).json(threadData);
  } catch (error) {
    console.error("Error fetching thread details:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to load conversation details" 
    });
  }
});