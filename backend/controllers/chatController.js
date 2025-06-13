const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const admin = require("../firebase");
const Product = require("../models/productModels");
const User = require("../models/userModels");
const SellerProfile = require("../models/Sellerprofile");


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
        const messageText = `Hello ${sellerName}, ${buyerName} wants ${quantity}× ${product.title} for NGN ${totalPrice}.`;
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

// Cache for user data to reduce database queries
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clear cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      userCache.delete(key);
    }
  }
}, 60000); // Clean every minute

// Helper function to get cached user info
const getCachedUserInfo = async (userId) => {
  const cacheKey = userId;
  const cached = userCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const user = await User.findById(userId).select('name role').lean();
    if (!user) {
      const fallbackData = { name: `User ${userId.slice(0, 5)}`, role: 'user' };
      userCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
      return fallbackData;
    }

    let userName = user.name;
    if (user.role === 'seller') {
      const sellerProfile = await SellerProfile.findOne({ userId }).select('studentName businessName').lean();
      userName = sellerProfile?.studentName || sellerProfile?.businessName || user.name;
    }

    const userData = {
      name: userName || `User ${userId.slice(0, 5)}`,
      role: user.role
    };

    userCache.set(cacheKey, { data: userData, timestamp: Date.now() });
    return userData;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    const fallbackData = { name: `User ${userId.slice(0, 5)}`, role: 'user' };
    userCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
    return fallbackData;
  }
};

// Batch fetch user information
const batchFetchUsers = async (userIds) => {
  const uniqueUserIds = [...new Set(userIds)];
  const userPromises = uniqueUserIds.map(userId => getCachedUserInfo(userId));

  try {
    const users = await Promise.all(userPromises);
    const userMap = {};

    uniqueUserIds.forEach((userId, index) => {
      userMap[userId] = users[index];
    });

    return userMap;
  } catch (error) {
    console.error('Error in batch fetch users:', error);
    // Return fallback data for all users
    const fallbackMap = {};
    uniqueUserIds.forEach(userId => {
      fallbackMap[userId] = { name: `User ${userId.slice(0, 5)}`, role: 'user' };
    });
    return fallbackMap;
  }
};

// Main optimized endpoint - single API call solution
exports.getOptimizedChatsForUser = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  try {
    // Single Firebase query to get all chat threads
    const threadsSnapshot = await admin.database()
      .ref("chats")
      .once("value");

    if (!threadsSnapshot.exists()) {
      return res.json({ threads: [], users: {} });
    }

    const userThreads = [];
    const allUserIds = new Set();

    // Process all threads and extract user IDs
    threadsSnapshot.forEach(child => {
      const threadId = child.key;

      // Enhanced security check - ensure user is actually part of this thread
      if (!threadId.includes(userId)) return;

      const [buyerId, sellerId] = threadId.split("_");

      // Additional security validation
      if (buyerId !== userId && sellerId !== userId) return;

      const otherUserId = buyerId === userId ? sellerId : buyerId;

      // Validate that otherUserId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(otherUserId)) return;

      const threadData = child.val();
      if (!threadData || typeof threadData !== 'object') return;

      const messages = Object.values(threadData);
      if (!Array.isArray(messages) || messages.length === 0) {
        // Include empty threads but mark them appropriately
        userThreads.push({
          threadId,
          otherUserId,
          buyerId,
          sellerId,
          lastMessage: "",
          timestamp: Date.now(),
          unreadCount: 0,
          isEmpty: true
        });
        allUserIds.add(otherUserId);
        return;
      }

      // Sort messages by timestamp and get the latest
      const sortedMessages = messages
        .filter(msg => msg && typeof msg === 'object' && msg.timestamp)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      const lastMessage = sortedMessages[0];

      // Count unread messages for current user
      const unreadCount = messages.filter(msg =>
        msg &&
        msg.receiverId === userId &&
        !msg.read &&
        msg.senderId !== userId
      ).length;

      userThreads.push({
        threadId,
        otherUserId,
        buyerId,        // ✅ ADD THIS
        sellerId,       // ✅ ADD THIS
        lastMessage: lastMessage?.content || "",
        timestamp: lastMessage?.timestamp || Date.now(),
        unreadCount: unreadCount,
        lastMessageType: lastMessage?.type || 'text',
        productId: lastMessage?.productId || null,
        productTitle: lastMessage?.productTitle || null,  // ✅ ADD THIS
        quantity: lastMessage?.quantity || null,
        price: lastMessage?.price || null
      });

      allUserIds.add(otherUserId);
    });

    const userMap = await batchFetchUsers(Array.from(allUserIds));

    // Transform userMap to match frontend expectations
    const transformedUserMap = {};
    Object.entries(userMap).forEach(([userId, userData]) => {
      // Frontend expects: users[userId] = "Name String"
      // Controller returns: users[userId] = { name: "Name", role: "role" }
      transformedUserMap[userId] = userData.name;
    });

    // Sort threads by timestamp (most recent first)
    const sortedThreads = userThreads.sort((a, b) => b.timestamp - a.timestamp);

    const responseTimestamp = Date.now();
    res.set({
      'X-Data-Timestamp': responseTimestamp.toString(),
      'Cache-Control': 'private, max-age=60', // Cache for 1 minute
      'ETag': `"chats-${userId}-${responseTimestamp}"`
    });

    res.json({
      threads: sortedThreads,
      users: transformedUserMap,
      timestamp: responseTimestamp  // Use same timestamp
    });

  } catch (error) {
    console.error("Error fetching optimized chats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load conversations",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Legacy endpoint - kept for backward compatibility but optimized
exports.getChatsForUser = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  try {
    const snap = await admin.database().ref("chats").once("value");
    const threads = [];

    if (snap.exists()) {
      snap.forEach(child => {
        const threadId = child.key;
        if (threadId.includes(userId)) {
          const [buyerId, sellerId] = threadId.split("_");

          // Security validation
          if (buyerId === userId || sellerId === userId) {
            const otherUserId = buyerId === userId ? sellerId : buyerId;
            threads.push({ threadId, otherUserId });
          }
        }
      });
    }

    res.json(threads);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load conversations"
    });
  }
});

// Enhanced security for thread access
exports.getChatThread = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const userId = req.user._id.toString();

  try {
    // Enhanced security check
    if (!threadId || !threadId.includes("_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid thread ID format"
      });
    }

    const [buyerId, sellerId] = threadId.split("_");

    // Strict access control - user must be either buyer or seller
    if (buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this conversation"
      });
    }

    // Validate that both IDs are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(buyerId) || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user IDs in thread"
      });
    }

    const snap = await admin.database().ref(`chats/${threadId}`).once("value");

    if (!snap.exists()) {
      return res.json([]);
    }

    const data = snap.val();
    const messages = Object.entries(data)
      .map(([id, msg]) => ({
        id,
        ...msg,
        // Sanitize message data
        content: msg.content || '',
        timestamp: msg.timestamp || Date.now(),
        senderId: msg.senderId || '',
        receiverId: msg.receiverId || ''
      }))
      .filter(msg =>
        // Additional validation - ensure message involves the requesting user
        msg.senderId === userId || msg.receiverId === userId
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    res.json(messages);
  } catch (error) {
    console.error("Error fetching chat thread:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load messages"
    });
  }
});

// Enhanced thread details with better security
exports.getChatThreadDetails = asyncHandler(async (req, res) => {
  const { threadId } = req.params;
  const userId = req.user._id.toString();

  try {
    // Enhanced security validation
    if (!threadId || !threadId.includes("_")) {
      return res.status(400).json({
        success: false,
        message: "Invalid thread ID format"
      });
    }

    const [buyerId, sellerId] = threadId.split("_");

    // Strict access control
    if (buyerId !== userId && sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this conversation"
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(buyerId) || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user IDs"
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

    // Additional security check
    if (!threadData.users || !threadData.users.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this conversation"
      });
    }

    // Sanitize and return thread data
    const sanitizedData = {
      users: threadData.users || [],
      lastMessage: threadData.lastMessage || '',
      lastTimestamp: threadData.lastTimestamp || Date.now(),
      productId: threadData.productId || null,
      buyerId: threadData.buyerId || '',
      sellerId: threadData.sellerId || '',
      buyerName: threadData.buyerName || '',
      sellerName: threadData.sellerName || '',
      productTitle: threadData.productTitle || '',
      quantity: threadData.quantity || 0,
      price: threadData.price || '0.00'
    };

    res.status(200).json(sanitizedData);
  } catch (error) {
    console.error("Error fetching thread details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load conversation details"
    });
  }
});

// Mark messages as read - optimized batch operation
exports.markMessagesAsRead = asyncHandler(async (req, res) => {
  const { threadId, messageIds } = req.body;
  const userId = req.user._id.toString();

  try {
    // Security validation
    if (!threadId.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid message IDs"
      });
    }

    // Batch update operation
    const updates = {};
    messageIds.forEach(messageId => {
      updates[`${messageId}/read`] = true;
      updates[`${messageId}/readAt`] = Date.now();
    });

    await admin.database().ref(`chats/${threadId}`).update(updates);

    res.json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark messages as read"
    });
  }
});

// Get unread message count for user - optimized
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();

  try {
    const snap = await admin.database().ref("chats").once("value");
    let totalUnreadCount = 0;

    if (snap.exists()) {
      snap.forEach(child => {
        const threadId = child.key;
        if (threadId.includes(userId)) {
          const threadData = child.val();
          if (threadData) {
            const messages = Object.values(threadData);
            const unreadCount = messages.filter(msg =>
              msg &&
              msg.receiverId === userId &&
              !msg.read &&
              msg.senderId !== userId
            ).length;
            totalUnreadCount += unreadCount;
          }
        }
      });
    }

    res.json({ unreadCount: totalUnreadCount });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count"
    });
  }
});

// Clear user cache (for admin/maintenance)
exports.clearUserCache = asyncHandler(async (req, res) => {
  try {
    userCache.clear();
    res.json({ success: true, message: "User cache cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to clear cache" });
  }
});