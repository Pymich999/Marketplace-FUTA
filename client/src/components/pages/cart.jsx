import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getCart, updateCart, removeFromCart, reset } from '../../features/cart/cartSlice';
import { FaArrowRight, FaShoppingBag, FaCheckCircle, FaBell } from 'react-icons/fa';

const Cart = () => {
  const dispatch = useDispatch();
  const user = JSON.parse(localStorage.getItem('user'));
  const token = user?.token;
  const navigate = useNavigate();
  const { items, isLoading, isSuccess, isError, message } = useSelector(state => state.cart);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  
  // Order progress states
  const [orderProgress, setOrderProgress] = useState('idle'); // idle, notifying, completed
  const [notifiedSellers, setNotifiedSellers] = useState([]);

  // Load cart data on component mount
  useEffect(() => {
    refreshCart();
    return () => {
      dispatch(reset());
    };
  }, [dispatch]);

  // Handle error notifications
  useEffect(() => {
    if (isError) {
      console.error("Cart error:", message);
    }
  }, [isError, message]);

  // Debug cart items
  useEffect(() => {
    if (items && items.length > 0) {
      console.log("Cart items loaded:", items);
    }
  }, [items]);

  // Utility function to refresh cart data
  const refreshCart = () => {
    dispatch(getCart())
      .unwrap()
      .catch(error => {
        console.error("Failed to refresh cart:", error);
      });
  };

  const handleQuantityChange = async (productId, quantity) => {
    if (quantity < 1 || operationInProgress) return;
    
    try {
      setOperationInProgress(true);
      
      await dispatch(updateCart({ productId, quantity })).unwrap();
      
      // Add a successful refresh here to ensure consistency
      await dispatch(getCart()).unwrap();
      
    } catch (error) {
      console.error('Failed to update quantity:', error);
      
      // Add a small delay before refreshing to prevent race conditions
      setTimeout(() => {
        refreshCart();
      }, 300);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleRemoveItem = async (productId) => {
    if (operationInProgress) return;
    
    try {
      setOperationInProgress(true);
      
      await dispatch(removeFromCart(productId)).unwrap();
      
      // Add a successful refresh here
      await dispatch(getCart()).unwrap();
      
    } catch (error) {
      console.error('Failed to remove item:', error);
      
      // Add a small delay before refreshing
      setTimeout(() => {
        refreshCart();
      }, 300);
    } finally {
      setOperationInProgress(false);
    }
  };

  const calculateSubtotal = () => {
    if (!items || items.length === 0) return '0.00';
    
    return items.reduce((total, item) => {
      if (!item || !item.product || typeof item.product.price !== 'number') {
        return total;
      }
      return total + (item.product.price * item.quantity);
    }, 0).toFixed(2);
  };

  // Handle redirect to product detail view - improved version
  const handleViewProductDetail = (product) => {
    if (!product || !product._id || !product.category) {
      console.error("Incomplete product data:", product);
      return;
    }
    
    navigate('/', { 
      state: { 
        selectedProduct: {
          ...product,
          category: product.category || '' // Ensure category exists
        },
        openProductDetail: true
      }
    });
  };

  const handleImageError = (productId) => {
    setImageErrors(prev => ({
      ...prev,
      [productId]: true
    }));
  };

  // Format currency to include the Naira symbol
  const formatPrice = (price) => {
    if (typeof price !== 'number') return '₦0.00';
    return `₦${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCheckout = async () => {
    setBusy(true);
    setOrderProgress('notifying');

    // Filter out any entries with a missing product
    const validItems = items.filter(i => i.product && (i.product._id || i.product.id));
    console.log(user)
    if (validItems.length === 0) {
      alert("Your cart is empty or contains invalid items.");
      setBusy(false);
      setOrderProgress('idle');
      return;
    }

    // Build your payload
    const payload = {
      cartItems: validItems.map(i => ({
        productId: i.product._id || i.product.id,
        quantity:  i.quantity
      })),
      buyerId: user._id || user.id
    };

    try {
      if (!token) {
        console.error("Token not found.");
        return;
      }

      const res = await axios.post(
        "http://localhost:3000/api/chats/checkout",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Save notified sellers for display
      setNotifiedSellers(res.data.sellers);
      
      // Show completion state after 2 seconds
      setTimeout(() => {
        setOrderProgress('completed');
      }, 2000);
      
      // Clear cart after order is completed (optional)
      // You might want to add a dedicated function to clear the cart in your Redux slice
      
      // Redirect to chats after 5 seconds
      setTimeout(() => {
        // navigate("/chats");
        // Or you can redirect to a dedicated order confirmation page
      }, 5000);
      
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to notify sellers.");
      setOrderProgress('idle');
    } finally {
      setBusy(false);
    }
  };

  // Show loading state during initial load
  if (isLoading && !operationInProgress && (!items || items.length === 0)) {
    return (
      <div className="cart-loading">
        <div className="loading-spinner"></div>
        <p>Loading your cart...</p>
      </div>
    );
  }

  // Render the order progress slider
  const renderOrderProgressSlider = () => {
    if (orderProgress === 'idle') {
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
                <span>Notifying Sellers</span>
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
              <h3>Notifying Sellers</h3>
              <p>Please wait while we notify the sellers about your order...</p>
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
                  <p>The following sellers have been notified:</p>
                  <ul className="seller-list">
                    {notifiedSellers.map(seller => (
                      <li key={seller._id || seller.id}>{seller.username}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <button 
                className="continue-shopping-btn"
                onClick={() => {
                  setOrderProgress('idle');
                  navigate('/');
                }}
              >
                Continue Shopping
              </button>
              
              <button
                className="view-chats-btn"
                onClick={() => navigate('/chats')}
              >
                View Your Chats
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cart-container">
      {renderOrderProgressSlider()}
      
      <h2 className="cart-title">Your Shopping Cart</h2>
      
      {/* Cart is empty state */}
      {(!items || items.length === 0) ? (
        <div className="cart-empty">
          <div className="empty-cart-icon">
            <FaShoppingBag size={48} />
          </div>
          <p>Your cart is empty</p>
          <button className="continue-shopping-btn" onClick={() => navigate('/')}>Continue Shopping</button>
        </div>
      ) : (
        <>
          {/* Loading overlay during operations */}
          {operationInProgress && (
            <div className="operation-loading-overlay">
              <div className="loading-spinner"></div>
              <p>Updating cart...</p>
            </div>
          )}
          
          <div className="cart-items">
            {items.map((item) => {
              // Skip invalid items
              if (!item || !item.product) {
                return null;
              }
              
              const product = item.product;
              const hasValidImage = product.images && 
                                   Array.isArray(product.images) && 
                                   product.images.length > 0 && 
                                   typeof product.images[0] === 'string' &&
                                   !imageErrors[product._id];
              
              return (
                <div key={product._id} className="cart-item">
                  <div 
                    className="item-image cursor-pointer"
                    onClick={() => handleViewProductDetail(product)}
                  >
                    {hasValidImage ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.title} 
                        className="product-image"
                        onError={() => handleImageError(product._id)}
                      />
                    ) : (
                      <div className="placeholder-image">
                        <FaShoppingBag size={24} />
                      </div>
                    )}
                  </div>
                  <div className="item-details">
                    <h3 
                      className="item-title cursor-pointer"
                      onClick={() => handleViewProductDetail(product)}
                    >
                      {product.title}
                    </h3>
                    <p className="item-price">
                      {formatPrice(product.price)}
                    </p>
                    {product.stock < 10 && (
                      <p className="low-stock-warning">Only {product.stock} left in stock</p>
                    )}
                    <button 
                      className="view-details-button"
                      onClick={() => handleViewProductDetail(product)}
                    >
                      View Details <FaArrowRight size={12} />
                    </button>
                  </div>
                  <div className="item-quantity">
                    <button 
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(product._id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || operationInProgress}
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button 
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(product._id, item.quantity + 1)}
                      disabled={item.quantity >= product.stock || operationInProgress}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <div className="item-subtotal">
                    {formatPrice(product.price * item.quantity)}
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveItem(product._id)}
                    disabled={operationInProgress}
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="cart-summary">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>{formatPrice(parseFloat(calculateSubtotal()))}</span>
            </div>
            <div className="summary-row">
              <span>Shipping:</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span>{formatPrice(parseFloat(calculateSubtotal()))}</span>
            </div>
            <button 
              className="checkout-btn"
              disabled={operationInProgress || orderProgress !== 'idle'}
              onClick={handleCheckout}
            >
              Proceed to Checkout
            </button>
            <button 
              className="continue-shopping-btn"
              disabled={operationInProgress || orderProgress !== 'idle'}
              onClick={() => navigate('/')}
            >
              Continue Shopping
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;