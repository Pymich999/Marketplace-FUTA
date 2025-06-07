// server/routes/chatRoutes.js
const router = require("express").Router();
const {
  checkoutChat,
  getOptimizedChatsForUser,
  getChatsForUser,
  getChatThread,
  getChatThreadDetails,
  markMessagesAsRead,
  getUnreadCount,
  clearUserCache
} = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

// Checkout routes
router.post("/checkout", protect, checkoutChat);
// Chat list routes
router.get("/", protect, getChatsForUser);
router.get("/optimized", protect, getOptimizedChatsForUser);
router.get("/unread-count", protect, getUnreadCount);

// Thread routes - specific routes before dynamic ones
router.get('/thread/:threadId', protect, getChatThreadDetails);
router.get("/:threadId", protect, getChatThread);

// Action routes
router.post('/mark-read', protect, markMessagesAsRead);
router.post('/clear-cache', protect, clearUserCache);

module.exports = router;