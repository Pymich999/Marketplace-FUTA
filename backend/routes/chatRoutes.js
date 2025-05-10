// server/routes/chatRoutes.js
const router = require("express").Router();
const {
  checkoutChat,
  getChatsForUser,
  getChatThread,
  getChatThreadDetails,
} = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

router.post("/checkout", protect, checkoutChat);
router.get("/",        protect, getChatsForUser);
router.get("/:threadId", protect, getChatThread);
// New route for fetching thread details from Firestore
router.get('/thread/:threadId', protect, getChatThreadDetails)

module.exports = router;
