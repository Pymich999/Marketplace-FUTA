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
export const updateSellerVerification = async (sellerId, action, rejectionReason, token) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios.put(
      `${API_URL}/verify`,
      { sellerId, action, rejectionReason },
      config
    );
    
    return response.data;
  } catch (error) {
    console.error('[adminServices] Update error details:', {
      status: error.response?.status,
      data: error.response?.data,
      headers: error.response?.headers
    });
    throw new Error(error.response?.data?.message || 'You are not Authorized');
  }
};

