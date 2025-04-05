import axios from 'axios';

const API_URL = 'http://localhost:3000/api/admin/sellers';

// Get pending seller requests
export const getPendingSellerRequests = async (token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    
    const response = await axios.get(`${API_URL}/pending`, config);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error('[SellerVerification] Fetch error:', message);
    throw new Error(message);
  }
};

// Update seller verification status
export const updateSellerVerification = async ({ sellerId, action, rejectionReason, token }) => {
  try {
    console.log('[SellerVerification] Update with token:', token); // Debug log
    const config = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
    
    const requestData = { sellerId, action, rejectionReason };
    
    const response = await axios.put(`${API_URL}/verify`, requestData, config);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error('[SellerVerification] Update error:', message);
    throw new Error(message);
  }
};
