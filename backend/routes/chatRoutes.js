// server/routes/chatRoutes.js
const router = require("express").Router();
const {
  checkoutChat,
  getChatsForUser,
  getChatThread,
} = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");

router.post("/checkout", protect, checkoutChat);
router.get("/",        protect, getChatsForUser);
router.get("/:threadId", protect, getChatThread);

module.exports = router;
