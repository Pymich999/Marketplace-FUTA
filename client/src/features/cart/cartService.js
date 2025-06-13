import axios from 'axios';
const API_URL = 'http://localhost:3000/api/cart';

// Helper function to get token from localStorage
const getAuthToken = () => {
  try {
    const userData = JSON.parse(localStorage.getItem('user'));
    return userData?.accessToken;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

// Get user cart
const getCart = async (token) => {
  try {
    // Use provided token or get from localStorage
    const authToken = token || getAuthToken();
    
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const config = {
      headers: {
        Authorization: `Bearer ${authToken}`
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
    // Use provided token or get from localStorage
    const authToken = token || getAuthToken();
    
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const config = {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    };
    
    const cartData = { productId, quantity };
    const response = await axios.post(`${API_URL}/add`, cartData, config);
    return response.data;
  } catch (error) {
    console.error("Add to cart error:", error);
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};

// Update cart item quantity
const updateCart = async ({ productId, quantity, token }) => {
  try {
    // Use provided token or get from localStorage
    const authToken = token || getAuthToken();
    
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const config = {
      headers: {
        Authorization: `Bearer ${authToken}`
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
    // Use provided token or get from localStorage
    const authToken = token || getAuthToken();
    
    if (!authToken) {
      throw new Error('No authentication token available');
    }

    const config = {
      headers: {
        Authorization: `Bearer ${authToken}`
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