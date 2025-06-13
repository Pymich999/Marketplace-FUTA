const { set } = require('mongoose');
const Product = require('../models/productModels'); // Changed variable name to avoid conflict
const asyncHandler = require('express-async-handler');

const generateTagfromtext = (text) => {
    if (!text) return [];
    return text
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\w]/g, ""))
        .filter(word => word.length >= 3);
};

const mergeTags = (...arrays) => {
    const tagSets = new Set();
    arrays.forEach(arr => {
        if (Array.isArray(arr)) {
            arr.forEach(tag => tagSets.add(tag));
        }
    });
    return Array.from(tagSets);
};

const getSellerProducts = asyncHandler(async (req, res) => {
    // Get the current seller's ID from the authenticated user
    const sellerId = req.user._id;
    
    // Find all products where the seller field matches the current user's ID
    const products = await Product.find({ seller: sellerId });
    
    // Return the products
    res.status(200).json(products);
});

const CreateProduct = asyncHandler(async (req, res) => {
    try {
         // Convert comma-separated string to array
    if (typeof req.body.images === 'string') {
      req.body.images = req.body.images.split(',');
    }

    // Existing validation
    if (!req.body.images || !Array.isArray(req.body.images)) {
      return res.status(400).json({ message: 'Invalid images data' });
    }

    const cloudinaryRegex = new RegExp(
      `^https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`
    );

    if (!req.body.images.every(url => cloudinaryRegex.test(url))) {
      return res.status(400).json({ message: 'Invalid image URLs detected' });
    }


        const sellerId = req.user.id;

        const {
            title,
            description,
            price,
            category,
            stock,
            tags,
            images,
        } = req.body;

        if (!title || !description || !price || !images) {
            res.status(400)
            throw new Error("All fields are required to create a product")
        }

        let autoTags = tags;
        if (!autoTags || !Array.isArray(autoTags) || autoTags.length === 0) {
            const titleTags = generateTagfromtext(title);
            const descriptionTags = generateTagfromtext(description);
            const categoryTags = generateTagfromtext(category);

            autoTags = mergeTags(titleTags, descriptionTags, categoryTags);
        }

        const newProduct = await Product.create({
            title,
            description,
            price,
            category,
            stock,
            seller: sellerId,
            images,
            tags: autoTags,
        });

        if (newProduct) {
            res.status(201).json({
                title: newProduct.title, // Fixed: was using product.title instead of newProduct.title
                description: newProduct.description,
                price: newProduct.price,
                category: newProduct.category,
                stock: newProduct.stock,
                seller: newProduct.seller,
                tags: newProduct.tags,
            });
        };
    } catch (error) {
        console.error("Error in createProduct:", error);
        res.status(500).json({ message: 'Server error', error });
    };

});

const getProducts = async (req, res) => {
    try {
        const products = await Product.find({}).populate('seller');
        res.status(200).json(products);
    } catch (error) {
        console.error("Error in getProducts:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};


const updateProduct = asyncHandler(async (req, res) => {
    try {
        const productId = req.params.id;

        const foundProduct = await Product.findById(productId); // Changed variable name to avoid conflict
        if (!foundProduct) {
            return res.status(404).json({ message: "Product Not Found" });
        }

        if (foundProduct.seller.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not authorized to edit this product" });
        }

        const updatedProduct = await Product.findByIdAndUpdate(productId, req.body, { new: true });
        res.status(201).json(updatedProduct);
    } catch (error) {
        console.error("Error in updating: ", error);
        res.status(500).json({ message: 'Server Error', error });
    }
});


const deleteProduct = asyncHandler(async (req, res) => {
    try {
        const productId = req.params.id;

        const foundProduct = await Product.findById(productId); // Changed variable name

        if (!foundProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (foundProduct.seller.toString() !== req.user.id) {
            return res.status(200).json({ message: "You are not authorized to edit this product" });
        }

        await Product.findByIdAndDelete(productId);
        res.status(200).json({ message: "Deleted succesfully" });
    } catch (error) {
        console.error("Error in product deletion", error);
        res.status(500).json({ message: "Server error in deletion", error });
    }
});


const getProductById = async (req, res) => {
    try {
        const productId = req.params.id;
        const foundProduct = await Product.findById(productId).populate('seller', 'name email');
        if (!foundProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(foundProduct);
    } catch (error) {
        console.error("Error in getProductById:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

module.exports = { CreateProduct, getProducts, updateProduct, deleteProduct, getProductById, getSellerProducts };