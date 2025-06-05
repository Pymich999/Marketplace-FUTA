import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  FaShoppingCart,
  FaComment,
  FaArrowLeft,
  FaStar,
  FaChevronLeft,
  FaChevronRight,
  FaStore,
  FaFilter,
  FaTimes,
  FaCheck,
  FaBell,
  FaCheckCircle,
  FaUser
} from "react-icons/fa";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "../../features/cart/cartSlice";
import Navbar from "../navbar";
import "../../index.css";
import _ from 'lodash';

// Define fixed categories that won't change as products are added
const FIXED_CATEGORIES = [
  "Electronics",
  "Books",
  "Fashion",
  "Home & Kitchen",
  "Beauty",
  "Sports",
  "Food",
  "Services",
  "Others"
];

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategories, setActiveCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const [addingToCart, setAddingToCart] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollRef = useRef(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [orderProgress, setOrderProgress] = useState('idle');
  const [notifiedSellers, setNotifiedSellers] = useState([]);
  const [failedItems, setFailedItems] = useState([]);
  const [checkoutAttemptId, setCheckoutAttemptId] = useState(null);
  const [orderingProduct, setOrderingProduct] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading: cartLoading } = useSelector((state) => state.cart);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://localhost:3000/api/products");
        setProducts(res.data);

        // Extract all unique categories from products to know which fixed categories to activate
        const allCategories = res.data.flatMap((product) =>
          (product.category || "")
            .split(",")
            .map((cat) => cat.trim())
            .filter(Boolean)
        );
        const uniqueCategories = [...new Set(allCategories)];
        
        // Set the active categories based on what exists in the products
        setActiveCategories(
          FIXED_CATEGORIES.filter(category => 
            uniqueCategories.some(prodCat => 
              prodCat.toLowerCase().includes(category.toLowerCase())
            )
          )
        );

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
    if (selectedProduct?.images?.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) =>
          prev === selectedProduct.images.length - 1 ? 0 : prev + 1
        );
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (
      location.state?.selectedProduct &&
      location.state?.openProductDetail
    ) {
      setSelectedProduct(location.state.selectedProduct);
      setIsDetailOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleSellerSignup = () => {
    localStorage.removeItem("user");
    window.location.href = "/seller-signup";
  };

  const filteredProducts = products.filter((product) => {
    const searchTerm = search.toLowerCase().trim();
    const titleMatches = product?.title?.toLowerCase().includes(searchTerm);
    const tagsMatch = Array.isArray(product?.tags)
      ? product.tags.some((tag) =>
          tag.toLowerCase().includes(searchTerm)
        )
      : product?.tags?.toLowerCase().includes(searchTerm);
    const descriptionMatches = product?.description
      ?.toLowerCase()
      .includes(searchTerm);

    const matchesSearch =
      titleMatches || tagsMatch || descriptionMatches;

    const matchesCategory = selectedCategory
      ? (product?.category || "")
          .toLowerCase()
          .includes(selectedCategory.toLowerCase())
      : true;

    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (productId, productQuantity = 1) => {
    setAddingToCart((prev) => ({ ...prev, [productId]: true }));

    dispatch(addToCart({ productId, quantity: productQuantity }))
      .unwrap()
      .then(() => {
        const productName =
          products.find((p) => p._id === productId)?.title || "Product";
        showNotification(`${productName} added to cart!`, "success");
      })
      .catch((error) => {
        showNotification(`Failed to add to cart: ${error}`, "error");
      })
      .finally(() => {
        setAddingToCart((prev) => ({ ...prev, [productId]: false }));
      });
  };

  const handleDirectOrder = _.debounce(async (product) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = user?.token;

    if (!token) {
      alert("You must be logged in to place an order");
      return;
    }

    if (orderProgress !== 'idle') return;
    
    setOrderingProduct(product);
    setOrderProgress('notifying');
    setNotifiedSellers([]);
    setFailedItems([]);

    // Generate a unique attempt ID
    const attemptId = checkoutAttemptId || crypto.randomUUID();
    setCheckoutAttemptId(attemptId);

    const payload = {
      cartItems: [{
        productId: product._id,
        quantity: quantity || 1 // Use selected quantity or default to 1
      }],
      buyerId: user._id || user.id,
      attemptId
    };

    try {
      const res = await axios.post(
        "/api/chats/checkout",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setNotifiedSellers(res.data.sellers || []);
        
        if (res.data.failedItems && res.data.failedItems.length > 0) {
          setFailedItems(res.data.failedItems);
        }
        
        // Store the successful attempt ID to prevent duplicates
        if (res.data.attemptId) {
          setCheckoutAttemptId(res.data.attemptId);
        }

        setTimeout(() => setOrderProgress('completed'), 2000);
        setTimeout(() => {
          setOrderProgress('idle');
          navigate("/chats");
        }, 5000);
      } else {
        throw new Error(res.data.message || "Order failed");
      }
    } catch (err) {
      console.error("Order error:", err);
      
      // If it's a duplicate error, reset the attempt ID
      if (err.response?.status === 429) {
        setCheckoutAttemptId(null);
      }
      
      alert(err.response?.data?.message || "Failed to notify seller. Please try again.");
      setOrderProgress('idle');
    }
  }, 1000, { leading: true, trailing: false });

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
      const scrollAmount = direction === "left" ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleViewSellerProfile = () => {
    if (selectedProduct) {
      // Check multiple possible locations for seller ID based on API structure
      const sellerId = selectedProduct.sellerId || 
                      (selectedProduct.seller && selectedProduct.seller._id) ||
                      selectedProduct.userId;
                      
      if (sellerId) {
        // Add viewAsSeller=true query parameter to show dashboard
        navigate(`/profile/${sellerId}?viewAsSeller=true`);
      } else {
        alert("Seller information is not available for this product");
        console.error("No seller ID found in product data:", {
          selectedProduct,
          availableFields: Object.keys(selectedProduct)
        });
      }
    } else {
      alert("Product information is not available");
      console.error("selectedProduct is null or undefined");
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

  // Handle filter toggle on mobile
  const toggleFilterMenu = () => {
    setIsFilterMenuOpen(!isFilterMenuOpen);
  };

  // Get related products or just random products if no matches
  const getRelatedProducts = () => {
    if (!selectedProduct) return [];
    
    // First try to get products in the same category
    const relatedProducts = products.filter(
      (p) =>
        p._id !== selectedProduct._id &&
        (p.category || "")
          .split(",")
          .some((cat) =>
            (selectedProduct.category || "").includes(cat.trim())
          )
    );
    
    // If we don't have enough related products, add some random ones
    if (relatedProducts.length < 4) {
      const randomProducts = products
        .filter(p => 
          p._id !== selectedProduct._id && 
          !relatedProducts.some(rp => rp._id === p._id)
        )
        .sort(() => 0.5 - Math.random()); // Shuffle
      
      // Add random products until we have 4 or run out of products
      while (relatedProducts.length < 4 && randomProducts.length > 0) {
        relatedProducts.push(randomProducts.pop());
      }
    }
    
    return relatedProducts.slice(0, 4);
  };

  // Header with logo and cart/seller action
  const Header = () => (
    <div className="site-header">
      <div className="header-main">
        <div className="header-logo">
          <Link to="/">FUTA Marketplace</Link>
        </div>
        <div className="header-actions">
          <Link to="/cart" className="cart-icon">
            <FaShoppingCart />
          </Link>
          <Link to="/list" className="cart-icon">
            <FaComment />
          </Link>
          <button className="become-seller-button" onClick={handleSellerSignup}>
            <FaStore /> Become a Seller
          </button>
        </div>
      </div>
    </div>
  );

  if (isDetailOpen && selectedProduct) {
    return (
      <>
        <Header />
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
                <div className="product-detail-placeholder">No image available</div>
              )}

              {selectedProduct.images && selectedProduct.images.length > 1 && (
                <div className="thumbnail-container">
                  <button
                    className="thumbnail-nav-button left"
                    onClick={() => scrollThumbnails("left")}
                    aria-label="Scroll thumbnails left"
                  >
                    <FaChevronLeft />
                  </button>

                  <div className="product-detail-thumbnails" ref={scrollRef}>
                    {selectedProduct.images.map((image, index) => (
                      <div
                        key={index}
                        className={`product-thumbnail-container ${
                          index === currentImageIndex ? "active" : ""
                        }`}
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
                    onClick={() => scrollThumbnails("right")}
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
                  {(selectedProduct.category || "")
                    .split(",")
                    .map((cat) => cat.trim())
                    .filter(Boolean)
                    .map((cat, index) => (
                      <span key={index} className="category-badge">
                        {cat}
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
                <span
                  className={
                    selectedProduct.stock > 10 ? "in-stock" : "low-stock"
                  }
                >
                  {selectedProduct.stock > 0
                    ? `In Stock (${selectedProduct.stock} available)`
                    : "Out of Stock"}
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
                    className={`add-to-cart-detail ${
                      addingToCart[selectedProduct._id] ? "loading" : ""
                    }`}
                    onClick={() =>
                      handleAddToCart(selectedProduct._id, quantity)
                    }
                    disabled={
                      addingToCart[selectedProduct._id] ||
                      cartLoading ||
                      selectedProduct.stock <= 0
                    }
                  >
                    <FaShoppingCart />
                    {addingToCart[selectedProduct._id]
                      ? "Adding..."
                      : "Add to Cart"}
                  </button>

                  <button 
                    className={`order-now-button ${
                      orderProgress !== 'idle' && orderingProduct?._id === selectedProduct._id ? 'loading' : ''
                    }`}
                    onClick={() => handleDirectOrder(selectedProduct)}
                    disabled={
                      orderProgress !== 'idle' ||
                      addingToCart[selectedProduct._id] ||
                      cartLoading ||
                      selectedProduct.stock <= 0
                    }
                  >
                    Order Now
                  </button>
                </div>
              </div>

              {/* New Seller Profile Button */}
              <div className="seller-profile-section">
                <button 
                  className="seller-profile-button"
                  onClick={handleViewSellerProfile}
                >
                  <FaUser /> Checkout Seller Profile
                </button>
                <p className="seller-note">See more products from this seller</p>
              </div>
            </div>
          </div>

          <div className="product-detail-sections">
            <div className="product-detail-section">
              <h2>Product Details</h2>
              <p>This product is sold by a verified seller on FUTA Marketplace.</p>
              <p>
                Created:{" "}
                {new Date(selectedProduct.createdAt).toLocaleDateString()}
              </p>
              <p>
                Last Updated:{" "}
                {new Date(selectedProduct.updatedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="product-detail-section">
              <h2>Reviews & Ratings</h2>
              <p>No reviews yet. Be the first to review this product!</p>
            </div>
          </div>

          <div className="related-products">
            <h2>You May Also Like</h2>
            <div className="related-products-grid">
              {getRelatedProducts().map((product) => (
                <div key={product._id} className="related-product-card">
                  <img
                    src={product.images && product.images[0]}
                    alt={product.title}
                    onClick={() => handleProductClick(product)}
                  />
                  <h3>{product.title}</h3>
                  <p className="price">{formatPrice(product.price)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Additional CSS for the new seller profile button */}
        <style jsx>{`
          .seller-profile-section {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #eee;
          }
          
          .seller-profile-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px 16px;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            font-weight: 500;
            color: #212529;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          
          .seller-profile-button:hover {
            background-color: #e9ecef;
          }
          
          .seller-note {
            text-align: center;
            margin-top: 8px;
            font-size: 0.85rem;
            color: #6c757d;
          }
        `}</style>
      </>
    );
  }

  const renderOrderProgressSlider = () => {
    if (orderProgress === 'idle' || !orderingProduct) {
      return null;
    }

    return (
      <div className="order-progress-overlay">
        <div className="order-progress-container">
          <div className="progress-slider">
            <div className="progress-bar">
              <div 
                className={`progress-fill ${orderProgress === 'completed' ? 'completed' : ''}`}
                style={{ width: orderProgress === 'notifying' ? '50%' : '100%' }}
              ></div>
            </div>
            
            <div className="progress-steps">
              <div className="progress-step active">
                <div className="step-icon">
                  <FaBell />
                </div>
                <span>Notifying Seller</span>
              </div>
              
              <div className={`progress-step ${orderProgress === 'completed' ? 'active' : ''}`}>
                <div className="step-icon">
                  <FaCheckCircle />
                </div>
                <span>Order Placed</span>
              </div>
            </div>
          </div>
          
          {orderProgress === 'notifying' && (
            <div className="progress-message">
              <h3>Notifying Seller</h3>
              <p>Please wait while we notify the seller about your order...</p>
              <div className="loading-spinner"></div>
            </div>
          )}
          
          {orderProgress === 'completed' && (
            <div className="progress-message success">
              <h3>Congratulations!</h3>
              <div className="success-icon">
                <FaCheckCircle size={48} />
              </div>
              <p>Your order has been successfully placed!</p>
              
              {notifiedSellers.length > 0 && (
                <div className="seller-notification">
                  <p>The following seller has been notified:</p>
                  <ul className="seller-list">
                    {notifiedSellers.map((seller, idx) => (
                      <li key={seller.sellerId || idx}>
                        {seller.username}: {seller.quantity}× {seller.productTitle} 
                        ({formatPrice(parseFloat(seller.price))})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {failedItems.length > 0 && (
                <div className="failed-items">
                  <p className="warning">Some items couldn't be processed:</p>
                  <ul className="failed-list">
                    {failedItems.map((item, idx) => (
                      <li key={idx}>
                        {item.product || item.productId}: {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <button 
                className="view-chats-btn"
                onClick={() => navigate('/chats')}
              >
                View Your Chats
              </button>
              
              <button 
                className="continue-shopping-btn"
                onClick={() => {
                  setOrderProgress('idle');
                  navigate('/');
                }}
              >
                Continue Shopping
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderOrderProgressSlider()}
      <Header />

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

          <div className="seller-cta-banner">
            <div className="seller-cta-content">
              <h2>Start selling on FUTA Marketplace today!</h2>
              <p>Reach thousands of students and earn money with your products</p>
              <button
                className="seller-cta-button"
                onClick={handleSellerSignup}
              >
                <FaStore /> Become a Seller
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile filter toggle button */}
      <div className="mobile-filter-toggle">
        <button onClick={toggleFilterMenu}>
          {isFilterMenuOpen ? <FaTimes /> : <FaFilter />} 
          {isFilterMenuOpen ? "Close Filters" : "Filter Products"}
        </button>
      </div>

      {/* Category navigation - now with fixed categories */}
      <div className={`category-navigation ${isFilterMenuOpen ? 'open' : ''}`}>
        <button
          className={selectedCategory === "" ? "active" : ""}
          onClick={() => {
            setSelectedCategory("");
            setIsFilterMenuOpen(false);
          }}
        >
          All Products
        </button>
        
        {FIXED_CATEGORIES.map((cat, index) => {
          // Check if this category has products
          const hasProducts = activeCategories.includes(cat);
          
          return (
            <button
              key={index}
              className={`${selectedCategory === cat ? "active" : ""} ${!hasProducts ? "disabled" : ""}`}
              onClick={() => {
                if (hasProducts) {
                  setSelectedCategory(cat);
                  setIsFilterMenuOpen(false);
                }
              }}
              disabled={!hasProducts}
            >
              {cat} 
              {selectedCategory === cat && <FaCheck className="filter-selected" />}
            </button>
          );
        })}
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
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("");
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <h2 className="section-title">
                {selectedCategory
                  ? `${selectedCategory} Products`
                  : "All Products"}
                <span className="product-count">
                  {filteredProducts.length} items
                </span>
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
                          {product.stock === 0
                            ? "Out of stock"
                            : "Low stock"}
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
                        {(product.category || "").split(",")[0].trim()}
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
                          className={`order-now-button ${
                            orderProgress !== 'idle' && orderingProduct?._id === product._id ? 'loading' : ''
                          }`}
                          onClick={() => handleDirectOrder(product)}
                          disabled={
                            orderProgress !== 'idle' ||
                            addingToCart[product._id] ||
                            cartLoading ||
                            product.stock <= 0
                          }
                        >
                          Order Now
                        </button>

                        <button
                          className={`quick-add-button ${
                            addingToCart[product._id] ? "loading" : ""
                          }`}
                          onClick={() => handleAddToCart(product._id)}
                          disabled={
                            addingToCart[product._id] ||
                            cartLoading ||
                            product.stock <= 0
                          }
                        >
                          <FaShoppingCart />
                          {addingToCart[product._id] ? "..." : "Add"}
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
      </footer>
    </>
  );
};

export default HomePage;