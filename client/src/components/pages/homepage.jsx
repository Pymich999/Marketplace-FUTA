import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Link } from 'react-router-dom';
import { FaShoppingCart, FaArrowLeft, FaStar, FaHeart, FaShare, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../features/cart/cartSlice";
import Navbar from "../navbar";
import "../../index.css";

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollRef = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading: cartLoading } = useSelector((state) => state.cart);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/products");
        setProducts(res.data);
        
        const allCategories = res.data.flatMap(product => 
          product.category.split(',').map(cat => cat.trim())
        );
        const uniqueCategories = [...new Set(allCategories)];
        setCategories(uniqueCategories);
        
        setError(null);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("Failed to load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct && selectedProduct.images && selectedProduct.images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex(prev => 
          prev === selectedProduct.images.length - 1 ? 0 : prev + 1
        );
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedProduct]);

  const filteredProducts = products.filter((product) => {
    const searchTerm = search.toLowerCase().trim();
    const titleMatches = product?.title?.toLowerCase().includes(searchTerm);
    const tagsMatch = Array.isArray(product?.tags) 
      ? product.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      : product?.tags?.toLowerCase().includes(searchTerm);
    const descriptionMatches = product?.description?.toLowerCase().includes(searchTerm);
    const matchesSearch = titleMatches || tagsMatch || descriptionMatches;
    const matchesCategory = selectedCategory 
      ? product?.category?.toLowerCase().includes(selectedCategory.toLowerCase()) 
      : true;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (productId, productQuantity = 1) => {
    setAddingToCart((prev) => ({ ...prev, [productId]: true }));
    
    dispatch(addToCart({ productId, quantity: productQuantity }))
      .unwrap()
      .then(() => {
        const productName = products.find(p => p._id === productId)?.title || "Product";
        showNotification(`${productName} added to cart!`, "success");
      })
      .catch((error) => {
        showNotification(`Failed to add to cart: ${error}`, "error");
      })
      .finally(() => {
        setAddingToCart((prev) => ({ ...prev, [productId]: false }));
      });
  };
  
  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setCurrentImageIndex(0);
    setIsDetailOpen(true);
    window.scrollTo(0, 0);
  };
  
  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedProduct(null);
  };
  
  const handleQuantityChange = (newQuantity) => {
    if (newQuantity < 1) return;
    if (selectedProduct && newQuantity > selectedProduct.stock) return;
    setQuantity(newQuantity);
  };

  const handleThumbnailClick = (index) => {
    setCurrentImageIndex(index);
  };

  const scrollThumbnails = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const showNotification = (message, type) => {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerText = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add("show");
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 3000);
    }, 100);
  };

  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };

  if (isDetailOpen && selectedProduct) {
    return (
      <div className="product-detail-container">
        <div className="product-detail-header">
          <button 
            className="back-button" 
            onClick={handleCloseDetail}
            aria-label="Go back to products"
          >
            <FaArrowLeft /> Back to Products
          </button>
        </div>
        
        <div className="product-detail-content">
          <div className="product-detail-gallery">
            {selectedProduct.images && selectedProduct.images.length > 0 ? (
              <div className="main-image-container">
                <img 
                  src={selectedProduct.images[currentImageIndex]} 
                  alt={selectedProduct.title} 
                  className="product-detail-image"
                />
              </div>
            ) : (
              <div className="product-detail-placeholder">
                No image available
              </div>
            )}
            
            {selectedProduct.images && selectedProduct.images.length > 1 && (
              <div className="thumbnail-container">
                <button 
                  className="thumbnail-nav-button left"
                  onClick={() => scrollThumbnails('left')}
                  aria-label="Scroll thumbnails left"
                >
                  <FaChevronLeft />
                </button>
                
                <div className="product-detail-thumbnails" ref={scrollRef}>
                  {selectedProduct.images.map((image, index) => (
                    <div 
                      key={index} 
                      className={`product-thumbnail-container ${index === currentImageIndex ? 'active' : ''}`}
                      onClick={() => handleThumbnailClick(index)}
                    >
                      <img 
                        src={image} 
                        alt={`${selectedProduct.title} thumbnail ${index}`} 
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
                
                <button 
                  className="thumbnail-nav-button right"
                  onClick={() => scrollThumbnails('right')}
                  aria-label="Scroll thumbnails right"
                >
                  <FaChevronRight />
                </button>
              </div>
            )}
          </div>
          
          <div className="product-detail-info">
            <h1 className="product-detail-title">{selectedProduct.title}</h1>
            
            <div className="product-detail-meta">
              <div className="product-detail-category">
                {selectedProduct.category.split(',').map((cat, index) => (
                  <span key={index} className="category-badge">
                    {cat.trim()}
                  </span>
                ))}
              </div>
              
              <div className="product-detail-rating">
                <span className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar key={star} />
                  ))}
                </span>
                <span className="rating-count">(24 reviews)</span>
              </div>
            </div>
            
            <div className="product-detail-price">
              {formatPrice(selectedProduct.price)}
            </div>
            
            <div className="product-detail-description">
              <p>{selectedProduct.description}</p>
            </div>
            
            <div className="product-detail-stock">
              <span className={selectedProduct.stock > 10 ? 'in-stock' : 'low-stock'}>
                {selectedProduct.stock > 0 
                  ? `In Stock (${selectedProduct.stock} available)` 
                  : 'Out of Stock'}
              </span>
            </div>
            
            <div className="product-detail-actions">
              <div className="quantity-selector">
                <button 
                  className="quantity-button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="quantity-value">{quantity}</span>
                <button 
                  className="quantity-button"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={quantity >= selectedProduct.stock}
                >
                  +
                </button>
              </div>
              
              <div className="cart-buttons">
                <button 
                  className={`add-to-cart-detail ${addingToCart[selectedProduct._id] ? 'loading' : ''}`}
                  onClick={() => handleAddToCart(selectedProduct._id, quantity)}
                  disabled={addingToCart[selectedProduct._id] || cartLoading || selectedProduct.stock <= 0}
                >
                  <FaShoppingCart />
                  {addingToCart[selectedProduct._id] ? 'Adding...' : 'Add to Cart'}
                </button>
                
                <button className="buy-now-button">
                  Buy Now
                </button>
              </div>
            </div>
            
            <div className="product-detail-extra-actions">
              <button className="wishlist-button">
                <FaHeart /> Add to Wishlist
              </button>
              <button className="share-button">
                <FaShare /> Share
              </button>
            </div>
            
            {selectedProduct.tags && selectedProduct.tags.length > 0 && (
              <div className="product-detail-tags">
                <span className="tags-title">Tags:</span>
                {selectedProduct.tags.map((tag, index) => (
                  <span key={index} className="tag-badge">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="product-detail-sections">
          <div className="product-detail-section">
            <h2>Product Details</h2>
            <p>This product is sold by a verified seller on FUTA Marketplace.</p>
            <p>Created: {new Date(selectedProduct.createdAt).toLocaleDateString()}</p>
            <p>Last Updated: {new Date(selectedProduct.updatedAt).toLocaleDateString()}</p>
          </div>
          
          <div className="product-detail-section">
            <h2>Reviews & Ratings</h2>
            <p>No reviews yet. Be the first to review this product!</p>
          </div>
        </div>
        
        <div className="related-products">
          <h2>You May Also Like</h2>
          <div className="related-products-grid">
            {products
              .filter(p => 
                p._id !== selectedProduct._id && 
                p.category.split(',').some(cat => 
                  selectedProduct.category.includes(cat.trim())
                )
              )
              .slice(0, 4)
              .map((product) => (
                <div key={product._id} className="related-product-card">
                  <img 
                    src={product.images && product.images[0]} 
                    alt={product.title} 
                    onClick={() => handleProductClick(product)}
                  />
                  <h3>{product.title}</h3>
                  <p className="price">{formatPrice(product.price)}</p>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="hero">
        <div className="hero-content">
          <h1>FUTA Marketplace</h1>
          <p>Discover unique products from trusted vendors</p>
          <div className="hero-search">
            <input
              type="text"
              placeholder="What are you looking for today?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            <button className="search-button">Search</button>
          </div>
        </div>
      </header>
      
      <div className="category-navigation">
        <button 
          className={selectedCategory === "" ? "active" : ""}
          onClick={() => setSelectedCategory("")}
        >
          All Products
        </button>
        {categories.map((cat, index) => (
          <button 
            key={index}
            className={selectedCategory === cat ? "active" : ""}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading products...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      ) : (
        <>
          {filteredProducts.length === 0 ? (
            <div className="no-results">
              <p>No products found. Try adjusting your search criteria.</p>
              <button onClick={() => {setSearch(""); setSelectedCategory("")}}>
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <h2 className="section-title">
                {selectedCategory ? `${selectedCategory} Products` : "All Products"}
                <span className="product-count">{filteredProducts.length} items</span>
              </h2>
              
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <div key={product._id} className="product-card">
                    <div 
                      className="product-image" 
                      onClick={() => handleProductClick(product)}
                    >
                      {product.images && product.images[0] ? (
                        <img 
                          src={product.images[0]} 
                          alt={product.title} 
                          className="product-card-image"
                        />
                      ) : (
                        <div className="placeholder-image"></div>
                      )}
                      {product.stock < 10 && (
                        <div className="stock-badge">
                          {product.stock === 0 ? "Out of stock" : "Low stock"}
                        </div>
                      )}
                    </div>
                    
                    <div className="product-info">
                      <h3 
                        className="product-title" 
                        onClick={() => handleProductClick(product)}
                      >
                        {product.title}
                      </h3>
                      
                      <div className="product-category">
                        {product.category.split(',')[0].trim()}
                      </div>
                      
                      <div className="product-price">
                        {formatPrice(product.price)}
                      </div>
                      
                      <div className="product-actions">
                        <button 
                          className="view-details-button"
                          onClick={() => handleProductClick(product)}
                        >
                          View Details
                        </button>
                        
                        <button 
                          className={`quick-add-button ${addingToCart[product._id] ? 'loading' : ''}`}
                          onClick={() => handleAddToCart(product._id)}
                          disabled={addingToCart[product._id] || cartLoading || product.stock <= 0}
                        >
                          <FaShoppingCart />
                          {addingToCart[product._id] ? '...' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3>FUTA Marketplace</h3>
            <p>Your trusted online shopping destination.</p>
          </div>
          
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="/about">About Us</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/faq">FAQ</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3>Customer Service</h3>
            <ul>
              <li><a href="/shipping">Shipping Policy</a></li>
              <li><a href="/returns">Returns & Refunds</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3>Contact Us</h3>
            <p>Email: support@futamarket.com</p>
            <p>Phone: +234 800 123 4567</p>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© 2025 FUTA Marketplace. All rights reserved.</p>
        </div>

        <div className="auth-prompt">
          Want to be a seller? register as a seller here? <Link to="/seller-signup">HERE</Link>
        </div>
      </footer>
    </>
  );
};

export default HomePage;