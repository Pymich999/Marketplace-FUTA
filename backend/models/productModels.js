const moongoose = require('mongoose');

const productSchema = new moongoose.Schema(
    {
        title: {
            type: String,
            required: true
        },
        description: {
            type: String
        },
        price: {
            type: Number,
            required: true
        },
        category: {
            type: String
        },
        stock: {
            type: Number,
            default: 0
        },
        seller: {
            // Reference to the seller (User) who created the product
            type: moongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        images: [
            {
                // Array of image URLs (e.g., uploaded to Cloudinary)
                type: String,
            }
        ],
        tags: [
            {
                // Tags help in searching and AI recommendations
                type: String,
            }
        ],

    },

    { timestamps: true }
);

module.exports = moongoose.model('Product', productSchema);