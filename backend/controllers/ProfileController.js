const asyncHandler = require('express-async-handler');
const User = require('../models/userModels');
const SellerProfile = require('../models/Sellerprofile');
const Product = require('../models/productModels');
const mongoose = require('mongoose');

/**
 * Get current user's profile
 * @route GET /api/profile/me
 * @access Private
 */
const getMyProfile = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Find the user
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Prepare response object
        const profileData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            createdAt: user.createdAt
        };
        
        // If user is a seller, get additional seller profile information
        if (user.role === 'seller' || user.role === 'seller_pending') {
            const sellerProfile = await SellerProfile.findOne({ userId: user._id });
            
            if (sellerProfile) {
                profileData.sellerProfile = {
                    businessName: sellerProfile.businessName,
                    studentName: sellerProfile.studentName,
                    businessDescription: sellerProfile.businessDescription,
                    verificationStatus: sellerProfile.verificationStatus,
                    verificationSubmittedAt: sellerProfile.verificationSubmittedAt
                };
                
                // Get seller's products with full details (for the seller's own view)
                const products = await Product.find({ seller: userId }).sort({ createdAt: -1 });
                profileData.products = products;
                
                // Count products by status
                profileData.productStats = {
                    total: products.length,
                    inStock: products.filter(p => p.stock > 0).length,
                    outOfStock: products.filter(p => p.stock === 0).length
                };
            }
        }
        
        res.status(200).json({
            success: true,
            profile: profileData
        });
        
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch profile information' 
        });
    }
});

/**
 * Get profile by user ID with product catalog for sellers
 * @route GET /api/profile/:userId
 * @access Public
 */
const getProfileById = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate that userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid user ID format' 
            });
        }
        
        // Find the user
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Prepare public profile data (only include necessary fields)
        const profileData = {
            _id: user._id,
            name: user.name,
            role: user.role
        };
        
        // If user is a seller, get public seller profile information and their product catalog
        if (user.role === 'seller') {
            const sellerProfile = await SellerProfile.findOne({ userId: user._id });
            
            if (sellerProfile) {
                profileData.sellerProfile = {
                    businessName: sellerProfile.businessName,
                    studentName: sellerProfile.studentName,
                    businessDescription: sellerProfile.businessDescription
                };
                
                // Get query parameters for filtering
                const { category, minPrice, maxPrice, tag, sort = 'newest' } = req.query;
                
                // Build query object
                const query = { seller: userId, stock: { $gt: 0 } };
                
                // Add category filter if provided
                if (category) {
                    query.category = category;
                }
                
                // Add price range filter if provided
                if (minPrice || maxPrice) {
                    query.price = {};
                    if (minPrice) query.price.$gte = parseFloat(minPrice);
                    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
                }
                
                // Add tag filter if provided
                if (tag) {
                    query.tags = { $in: [tag] };
                }
                
                // Determine sort order
                let sortOption = {};
                switch (sort) {
                    case 'price_asc':
                        sortOption = { price: 1 };
                        break;
                    case 'price_desc':
                        sortOption = { price: -1 };
                        break;
                    case 'oldest':
                        sortOption = { createdAt: 1 };
                        break;
                    case 'newest':
                    default:
                        sortOption = { createdAt: -1 };
                }
                
                // Get seller's product catalog (publicly visible)
                const productCatalog = await Product.find(query)
                    .sort(sortOption)
                    .limit(req.query.limit ? parseInt(req.query.limit) : 20)
                    .skip(req.query.page ? parseInt(req.query.page) * 20 : 0);
                
                // Get total count for pagination
                const totalProducts = await Product.countDocuments(query);
                
                // Format product catalog for public display
                profileData.productCatalog = {
                    products: productCatalog.map(product => ({
                        _id: product._id,
                        title: product.title,
                        description: product.description,
                        price: product.price,
                        category: product.category,
                        images: product.images,
                        tags: product.tags,
                        stock: product.stock,
                        createdAt: product.createdAt
                    })),
                    pagination: {
                        total: totalProducts,
                        page: req.query.page ? parseInt(req.query.page) : 0,
                        pageSize: req.query.limit ? parseInt(req.query.limit) : 20,
                        totalPages: Math.ceil(totalProducts / (req.query.limit ? parseInt(req.query.limit) : 20))
                    }
                };
                
                // Get product categories for this seller
                const categories = await Product.distinct('category', { 
                    seller: userId,
                    stock: { $gt: 0 }
                });
                
                profileData.categories = categories;
                
                // Get price range
                const priceStats = await Product.aggregate([
                    { $match: { seller: new mongoose.Types.ObjectId(userId), stock: { $gt: 0 } } },
                    { 
                        $group: { 
                            _id: null, 
                            minPrice: { $min: "$price" }, 
                            maxPrice: { $max: "$price" } 
                        } 
                    }
                ]);
                
                if (priceStats.length > 0) {
                    profileData.priceRange = {
                        min: priceStats[0].minPrice,
                        max: priceStats[0].maxPrice
                    };
                }
                
                // Get popular tags
                const popularTags = await Product.aggregate([
                    { $match: { seller: new mongoose.Types.ObjectId(userId), stock: { $gt: 0 } } },
                    { $unwind: "$tags" },
                    { $group: { _id: "$tags", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 10 }
                ]);
                
                profileData.popularTags = popularTags.map(tag => ({
                    name: tag._id,
                    count: tag.count
                }));
            }
        }
        
        res.status(200).json({
            success: true,
            profile: profileData
        });
        
    } catch (error) {
        console.error('Error fetching profile by ID:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch profile information' 
        });
    }
});

/**
 * Update current user's profile
 * @route PUT /api/profile/update
 * @access Private
 */
const updateProfile = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Find the user
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Extract user fields to update
        const { name, phone } = req.body;
        
        // Update basic user information
        if (name) user.name = name;
        if (phone) user.phone = phone;
        
        await user.save();
        
        // If user is a seller and updating seller profile info
        if ((user.role === 'seller' || user.role === 'seller_pending') && 
            (req.body.businessName || req.body.businessDescription)) {
            
            const sellerProfile = await SellerProfile.findOne({ userId: user._id });
            
            if (sellerProfile) {
                // Extract seller profile fields to update
                const { businessName, businessDescription } = req.body;
                
                // Update seller profile information
                if (businessName) sellerProfile.businessName = businessName;
                if (businessDescription) sellerProfile.businessDescription = businessDescription;
                
                await sellerProfile.save();
            }
        }
        
        // Return the updated profile
        const updatedUser = await User.findById(userId).select('-password');
        
        const profileData = {
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            role: updatedUser.role
        };
        
        // Include seller profile if applicable
        if (updatedUser.role === 'seller' || updatedUser.role === 'seller_pending') {
            const updatedSellerProfile = await SellerProfile.findOne({ userId: userId });
            
            if (updatedSellerProfile) {
                profileData.sellerProfile = {
                    businessName: updatedSellerProfile.businessName,
                    studentName: updatedSellerProfile.studentName,
                    businessDescription: updatedSellerProfile.businessDescription,
                    verificationStatus: updatedSellerProfile.verificationStatus
                };
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            profile: profileData
        });
        
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to update profile information' 
        });
    }
});

/**
 * Get dashboard stats for seller
 * @route GET /api/profile/dashboard
 * @access Private (Seller only)
 */
const getSellerDashboard = asyncHandler(async (req, res) => {
    try {
        let targetUserId;
        const requestingUser = req.user;
        
        // Determine which user to show dashboard for
        if (req.params.userId) {
            // Route with userId parameter - viewing another seller's dashboard
            targetUserId = req.params.userId;
            
            // FIXED: Allow buyers, sellers, and seller_pending to view other sellers' dashboards
            if (!['buyer', 'seller', 'seller_pending'].includes(requestingUser.role)) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Unauthorized access' 
                });
            }
        } else {
            // Regular dashboard route (own dashboard)
            if (!['seller', 'seller_pending'].includes(requestingUser.role)) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied. Seller only endpoint.' 
                });
            }
            targetUserId = requestingUser._id;
        }
        
        // Get seller profile
        const sellerProfile = await SellerProfile.findOne({ userId: targetUserId });
        
        if (!sellerProfile) {
            return res.status(404).json({ 
                success: false, 
                message: 'Seller profile not found' 
            });
        }
        
        // Get seller's products
        const products = await Product.find({ seller: targetUserId });
        
        // Calculate basic stats
        const totalProducts = products.length;
        const activeProducts = products.filter(p => p.stock > 0).length;
        const outOfStockProducts = products.filter(p => p.stock === 0).length;
        
        // Get products by category
        const categoryStats = await Product.aggregate([
            { $match: { seller: new mongoose.Types.ObjectId(targetUserId) } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        // Get recent products
        const recentProducts = await Product.find({ seller: targetUserId })
            .sort({ createdAt: -1 })
            .limit(5);
        
        res.status(200).json({
            success: true,
            dashboardData: {
                profile: {
                    businessName: sellerProfile.businessName,
                    studentName: sellerProfile.studentName,
                    verificationStatus: sellerProfile.verificationStatus
                },
                stats: {
                    totalProducts,
                    activeProducts,
                    outOfStockProducts,
                    categoryCounts: categoryStats.map(cat => ({
                        category: cat._id,
                        count: cat.count
                    }))
                },
                recentProducts: recentProducts.map(product => ({
                    id: product._id,
                    title: product.title,
                    price: product.price,
                    stock: product.stock,
                    createdAt: product.createdAt
                }))
            }
        });
        
    } catch (error) {
        console.error('Error fetching seller dashboard:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to fetch dashboard information' 
        });
    }
});


/**
 * Search for sellers
 * @route GET /api/profile/search
 * @access Public
 */
const searchSellers = asyncHandler(async (req, res) => {
    try {
        const { query, category } = req.query;
        
        // Build the search query
        const searchQuery = { role: 'seller' };
        
        // If there's a search term
        if (query) {
            // Search user names directly
            searchQuery.$or = [
                { name: { $regex: query, $options: 'i' } }
            ];
        }
        
        // Find matching users
        const sellers = await User.find(searchQuery).select('_id name');
        
        // Get seller profiles for these users
        const sellerIds = sellers.map(seller => seller._id);
        
        // Find seller profiles
        const sellerProfiles = await SellerProfile.find({
            userId: { $in: sellerIds }
        });
        
        // Create a lookup for profiles
        const profileMap = {};
        sellerProfiles.forEach(profile => {
            profileMap[profile.userId.toString()] = profile;
        });
        
        // If category filter is applied, we need to find sellers who have products in that category
        let sellersWithCategory = [];
        if (category) {
            sellersWithCategory = await Product.distinct('seller', { 
                category,
                stock: { $gt: 0 }
            });
        }
        
        // Combine and format results
        const results = sellers.map(seller => {
            const profile = profileMap[seller._id.toString()];
            
            // Skip sellers who don't have products in the specified category
            if (category && !sellersWithCategory.some(id => id.toString() === seller._id.toString())) {
                return null;
            }
            
            return {
                _id: seller._id,
                name: seller.name,
                businessName: profile ? profile.businessName : null,
                studentName: profile ? profile.studentName : null,
                businessDescription: profile ? profile.businessDescription : null
            };
        }).filter(seller => seller !== null); // Remove null entries
        
        res.status(200).json({
            success: true,
            sellers: results
        });
        
    } catch (error) {
        console.error('Error searching sellers:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to search sellers' 
        });
    }
});

module.exports = {
    getMyProfile,
    getProfileById,
    updateProfile,
    getSellerDashboard,
    searchSellers
};