import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getCart, updateCart, removeFromCart, reset } from '../../features/cart/cartSlice';
import { FaArrowRight, FaShoppingBag, FaCheckCircle, FaBell } from 'react-icons/fa';
import _ from 'lodash';

const Cart = () => {
  const dispatch = useDispatch();
  const user = JSON.parse(localStorage.getItem('user'));
  const token = user?.token;
  const navigate = useNavigate();
  const { items, isLoading, isSuccess, isError, message } = useSelector(state => state.cart);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [checkoutAttemptId, setCheckoutAttemptId] = useState(null);
  
  const [orderProgress, setOrderProgress] = useState('idle');
  const [notifiedSellers, setNotifiedSellers] = useState([]);
  const [failedItems, setFailedItems] = useState([]);
  
  // New state for selected items
  const [selectedItems, setSelectedItems] = useState({});
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    refreshCart();
    return () => {
      dispatch(reset());
    };
  }, [dispatch]);

  useEffect(() => {
    if (isError) {
      console.error("Cart error:", message);
    }
  }, [isError, message]);

  useEffect(() => {
    if (items && items.length > 0) {
      console.log("Cart items count:", items.length);
      
      // Initialize selected items state
      const initialSelections = {};
      items.forEach(item => {
        if (item && item.product && item.product._id) {
          initialSelections[item.product._id] = false;
        }
      });
      setSelectedItems(initialSelections);
    }
  }, [items]);

  const refreshCart = () => {
    dispatch(getCart())
      .unwrap()
      .catch(error => {
        console.error("Failed to refresh cart:", error);
      });
  };

  // Handle individual item selection
  const handleSelectItem = (productId) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  // Handle select all items
  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    
    const newSelections = {};
    items.forEach(item => {
      if (item && item.product && item.product._id) {
        newSelections[item.product._id] = newSelectAll;
      }
    });
    setSelectedItems(newSelections);
  };

  // Debounced quantity change handler
  const handleQuantityChange = _.debounce(async (productId, quantity) => {
    if (quantity < 1 || operationInProgress) return;
    
    try {
      setOperationInProgress(true);
      await dispatch(updateCart({ productId, quantity })).unwrap();
      await dispatch(getCart()).unwrap();
    } catch (error) {
      console.error('Failed to update quantity:', error);
      setTimeout(() => refreshCart(), 300);
    } finally {
      setOperationInProgress(false);
    }
  }, 300);

  const handleRemoveItem = async (productId) => {
    if (operationInProgress) return;
    
    try {
      setOperationInProgress(true);
      await dispatch(removeFromCart(productId)).unwrap();
      await dispatch(getCart()).unwrap();
      
      // Remove from selected items
      setSelectedItems(prev => {
        const updated = {...prev};
        delete updated[productId];
        return updated;
      });
    } catch (error) {
      console.error('Failed to remove item:', error);
      setTimeout(() => refreshCart(), 300);
    } finally {
      setOperationInProgress(false);
    }
  };

  const calculateSubtotal = (selectedOnly = false) => {
    if (!items || items.length === 0) return '0.00';
    return items.reduce((total, item) => {
      if (!item || !item.product || typeof item.product.price !== 'number') {
        return total;
      }
      
      // Only include selected items if selectedOnly is true
      if (selectedOnly && (!selectedItems[item.product._id])) {
        return total;
      }
      
      return total + (item.product.price * item.quantity);
    }, 0).toFixed(2);
  };

  // Function to get selected items count
  const getSelectedItemsCount = () => {
    return Object.values(selectedItems).filter(Boolean).length;
  };

  const handleViewProductDetail = (product) => {
    if (!product || !product._id || !product.category) {
      console.error("Incomplete product data:", product);
      return;
    }
    
    navigate('/', { 
      state: { 
        selectedProduct: {
          ...product,
          category: product.category || ''
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

  const formatPrice = (price) => {
    if (typeof price !== 'number') return '₦0.00';
    return `₦${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Debounced checkout handler with attempt tracking - modified to handle selected items
  const handleCheckout = _.debounce(async () => {
    if (!token) {
      alert("You must be logged in to checkout");
      return;
    }

    if (busy || orderProgress !== 'idle') return;
    
    const selectedCount = getSelectedItemsCount();
    if (selectedCount === 0) {
      alert("Please select at least one item to checkout");
      return;
    }
    
    setBusy(true);
    setOrderProgress('notifying');
    setNotifiedSellers([]);
    setFailedItems([]);

    // Filter valid AND selected items
    const validSelectedItems = items.filter(i => 
      i.product && 
      (i.product._id || i.product.id) && 
      selectedItems[i.product._id || i.product.id]
    );
    
    if (validSelectedItems.length === 0) {
      alert("No valid items selected for checkout.");
      setBusy(false);
      setOrderProgress('idle');
      return;
    }

    // Generate a unique attempt ID if we don't have one
    const attemptId = checkoutAttemptId || crypto.randomUUID();
    setCheckoutAttemptId(attemptId);

    const payload = {
      cartItems: validSelectedItems.map(i => ({
        productId: i.product._id || i.product.id,
        quantity: i.quantity
      })),
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

        // Reset selection for checked out items
        const newSelections = {...selectedItems};
        validSelectedItems.forEach(item => {
          if (item && item.product && item.product._id) {
            newSelections[item.product._id] = false;
          }
        });
        setSelectedItems(newSelections);
        setSelectAll(false);

        setTimeout(() => setOrderProgress('completed'), 2000);
        setTimeout(() => navigate("/chats"), 5000);
      } else {
        throw new Error(res.data.message || "Checkout failed");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      
      // If it's a duplicate error, reset the attempt ID
      if (err.response?.status === 429) {
        setCheckoutAttemptId(null);
      }
      
      alert(err.response?.data?.message || "Failed to notify sellers. Please try again.");
      setOrderProgress('idle');
    } finally {
      setBusy(false);
    }
  }, 1000, { leading: true, trailing: false });

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
          
          {/* Selection controls */}
          <div className="selection-controls">
            <div className="select-all-container">
              <input
                type="checkbox"
                id="select-all"
                checked={selectAll}
                onChange={handleSelectAll}
                disabled={operationInProgress}
              />
              <label htmlFor="select-all">Select All</label>
            </div>
            
            <div className="selection-info">
              <span>
                {getSelectedItemsCount()} of {items.length} items selected
              </span>
              {getSelectedItemsCount() > 0 && (
                <span className="selected-subtotal">
                  Selected Subtotal: {formatPrice(parseFloat(calculateSubtotal(true)))}
                </span>
              )}
            </div>
          </div>
          
          {/* Table header */}
          <div className="cart-items-header">
            <div className="header-select"></div>
            <div className="header-product">Product</div>
            <div className="header-price">Price</div>
            <div className="header-quantity">Quantity</div>
            <div className="header-subtotal">Subtotal</div>
            <div className="header-actions"></div>
          </div>
          
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
              
              const isSelected = selectedItems[product._id] || false;
              
              return (
                <div key={product._id} className={`cart-item ${isSelected ? 'selected' : ''}`}>
                  <div className="item-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectItem(product._id)}
                      disabled={operationInProgress}
                    />
                  </div>
                  
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
              <span>Total Items:</span>
              <span>{items.length}</span>
            </div>
            <div className="summary-row">
              <span>Selected Items:</span>
              <span>{getSelectedItemsCount()}</span>
            </div>
            <div className="summary-row">
              <span>Selected Subtotal:</span>
              <span>{formatPrice(parseFloat(calculateSubtotal(true)))}</span>
            </div>
            <div className="summary-row">
              <span>Shipping:</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="summary-row total">
              <span>Total (Selected Items):</span>
              <span>{formatPrice(parseFloat(calculateSubtotal(true)))}</span>
            </div>
            <button 
              className={`checkout-btn ${getSelectedItemsCount() === 0 ? 'disabled' : ''}`}
              disabled={operationInProgress || orderProgress !== 'idle' || getSelectedItemsCount() === 0}
              onClick={handleCheckout}
            >
              Checkout Selected Items ({getSelectedItemsCount()})
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