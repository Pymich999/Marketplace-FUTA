import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getCart, updateCart, removeFromCart, reset } from '../../features/cart/cartSlice';

const Cart = () => {
  const dispatch = useDispatch();
  const { items, isLoading, isSuccess, isError, message } = useSelector(state => state.cart);
  const [operationInProgress, setOperationInProgress] = useState(false);

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

  // Show loading state during initial load
  if (isLoading && !operationInProgress) {
    return <div className="cart-loading">Loading your cart...</div>;
  }

  return (
    <div className="cart-container">
      <h2 className="cart-title">Your Shopping Cart</h2>
      
      {/* Cart is empty state */}
      {(!items || items.length === 0) ? (
        <div className="cart-empty">
          <p>Your cart is empty</p>
          <button className="continue-shopping-btn">Continue Shopping</button>
        </div>
      ) : (
        <>
          {/* Loading overlay during operations */}
          {operationInProgress && (
            <div className="operation-loading-overlay">
              Updating cart...
            </div>
          )}
          
          <div className="cart-items">
            {items.map((item) => {
              // Skip invalid items
              if (!item || !item.product) {
                return null;
              }
              
              return (
                <div key={item.product._id} className="cart-item">
                  <div className="item-image">
                    <div className="placeholder-image"></div>
                  </div>
                  <div className="item-details">
                    <h3 className="item-title">{item.product.title}</h3>
                    <p className="item-price">
                      ₦{typeof item.product.price === 'number' ? item.product.price.toFixed(2) : '0.00'}
                    </p>
                    {item.product.stock < 10 && (
                      <p className="low-stock-warning">Only {item.product.stock} left in stock</p>
                    )}
                  </div>
                  <div className="item-quantity">
                    <button 
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.product._id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || operationInProgress}
                    >
                      -
                    </button>
                    <span className="quantity-value">{item.quantity}</span>
                    <button 
                      className="quantity-btn"
                      onClick={() => handleQuantityChange(item.product._id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock || operationInProgress}
                    >
                      +
                    </button>
                  </div>
                  <div className="item-subtotal">
                    ₦{typeof item.product.price === 'number' ? 
                      (item.product.price * item.quantity).toFixed(2) : '0.00'}
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveItem(item.product._id)}
                    disabled={operationInProgress}
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
              <span>₦{calculateSubtotal()}</span>
            </div>
            <div className="summary-row">
              <span>Shipping:</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="summary-row total">
              <span>Total:</span>
              <span>₦{calculateSubtotal()}</span>
            </div>
            <button 
              className="checkout-btn"
              disabled={operationInProgress}
            >
              Proceed to Checkout
            </button>
            <button 
              className="continue-shopping-btn"
              disabled={operationInProgress}
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