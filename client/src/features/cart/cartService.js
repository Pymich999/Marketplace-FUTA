import axios from 'axios';
const API_URL = 'http://localhost:3000/api/cart';

// Get user cart
const getCart = async (token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    
    const response = await axios.get(API_URL, config);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error('Cart fetch error:', message);
    throw new Error(message);
  }
};

// Add item to cart
const addToCart = async ({ productId, quantity, token }) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    
    const cartData = { productId, quantity };
    const response = await axios.post(`${API_URL}/add`, cartData, config);
    return response.data;
  } catch (error) {
    console.error("Error:", error);
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};

// Update cart item quantity
const updateCart = async ({ productId, quantity, token }) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    
    const cartData = { productId, quantity };
    const response = await axios.put(`${API_URL}/update`, cartData, config);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error('Update cart error:', message);
    throw new Error(message);
  }
};

// Remove item from cart
const removeFromCart = async (productId, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    
    const response = await axios.delete(`${API_URL}/remove/${productId}`, config);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error('Remove from cart error:', message);
    throw new Error(message);
  }
};

export const cartService = {
  getCart,
  addToCart,
  updateCart,
  removeFromCart
};