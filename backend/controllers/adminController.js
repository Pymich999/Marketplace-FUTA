const User = require("../models/userModels");

const verifySeller = async (req, res) => {
    try {
        const { userId, approve } = req.body; // 'approve' is a boolean flag

        const seller = await User.findById(userId);
        if (!seller || seller.role !== "seller_pending") {
            return res.status(404).json({ message: "Seller not found or already verified" });
        }

        // Ternary operator: if approve is true, set role to "seller"; if false, set role to "buyer"
        seller.role = approve ? "seller" : "buyer";
        await seller.save();
        res.status(200).json({ message: `Seller ${approve ? "approved" : "rejected"}` });
    } catch (error) {
        res.status(500).json({ message: "Server error", error });
    }
};

module.exports = { verifySeller };
