const { set } = require('mongoose');
const product = require('../models/productModels');
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

const CreateProduct = asyncHandler(async (req, res) => {
    try {
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

        let autoTags = tags;
        if (!autoTags || !Array.isArray(autoTags) || autoTags.length === 0) {
            const titleTags = generateTagfromtext(title);
            const descriptionTags = generateTagfromtext(description);
            const categoryTags = generateTagfromtext(category);

            autoTags = mergeTags(titleTags, descriptionTags, categoryTags);
        }

        const newProduct = product.create({
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
                title: product.title,
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
        const products = await product.find({}).populate('seller');
        console.log(products)
        res.status(200).json(products);
    } catch (error) {
        console.error("Error in getProducts:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};


const updateProduct = asyncHandler(async (req, res) => {
    try {
        const productId = req.params.id;

        const product = await product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product Not Found" });
        }

        if (product.seller.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not authorized to edit this product" });
        }

        const updatedProduct = await product.findByIdAndUpdate(productId, req.body, { new: true });
        res.status(201).json(updatedProduct);
    } catch (error) {
        console.error("Error in updating: ", error);
        res.status(500).json({ message: 'Server Error', error });
    }
});


const deleteProduct = asyncHandler(async (req, res) => {
    try {
        const productId = req.params.id;

        const Product =await product.findById(productId);

        if (!Product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (Product.seller.toString() !== req.user.id) {
            return res.status(200).json({ message: "You are not authorized to edit this product" });
        }

        await product.findByIdAndDelete(productId);
        res.status(200).json({ message: "Deleted succesfully" });
    } catch (error) {
        console.error("Error in product deletion", error);
        res.status(500).json({ message: "Server error in deletion", error });
    }
});


const getProductById = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('seller', 'name email');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error("Error in getProductById:", error);
        res.status(500).json({ message: 'Server error', error });
    }
};

module.exports = { CreateProduct, getProducts, updateProduct, deleteProduct, getProductById };