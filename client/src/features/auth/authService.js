import axios from 'axios';

const API_URL = 'http://localhost:3000/api/users/';

// Request OTP for email verification (new endpoint)
const requestEmailOTP = async (email) => {
    try {
        const response = await axios.post(API_URL + 'request-otp', { email });
        return response.data;
    } catch (error) {
        console.error("Error requesting OTP:", error.response?.data || error.message);
        throw error;
    }
};

// Register buyer with OTP verification
const registerBuyer = async (userData) => {
    try {
        console.log("Registering buyer:", userData);
        const response = await axios.post(API_URL + 'register-buyer', userData);
        
        if (response.data && response.data.success) {
            // Store both access and refresh tokens
            const userDataToStore = {
                user: response.data.user,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken
            };
            localStorage.setItem('user', JSON.stringify(userDataToStore));
        }
        
        return response.data;
    } catch (error) {
        console.error("Error in registerBuyer:", error.response?.data || error.message);
        throw error;
    }
};

// Register seller with OTP verification
const registerSeller = async (userData) => {
    try {
        console.log("Registering seller:", userData);
        const response = await axios.post(API_URL + 'register-seller', userData);
        
        if (response.data && response.data.success) {
            // Store both access and refresh tokens
            const userDataToStore = {
                user: response.data.user,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken
            };
            localStorage.setItem('user', JSON.stringify(userDataToStore));
        }
        
        return response.data;
    } catch (error) {
        console.error("Error in registerSeller:", error.response?.data || error.message);
        throw error;
    }
};

// Login user
const login = async (userData) => {
    try {
        const response = await axios.post(API_URL + 'login', userData);
        
        if (response.data && response.data.success) {
            // Store both access and refresh tokens
            const userDataToStore = {
                user: response.data.user,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken
            };
            localStorage.setItem('user', JSON.stringify(userDataToStore));
        }
        
        return response.data;
    } catch (error) {
        console.error("Error in login:", error.response?.data || error.message);
        throw error;
    }
};

// Request password reset OTP
const requestPasswordReset = async (email) => {
    try {
        const response = await axios.post(API_URL + 'request-password-reset', { email });
        return response.data;
    } catch (error) {
        console.error("Error requesting password reset:", error.response?.data || error.message);
        throw error;
    }
};

// Verify password reset OTP
const verifyResetOTP = async (email, otp) => {
    try {
        const response = await axios.post(API_URL + 'verify-reset-otp', { email, otp });
        return response.data;
    } catch (error) {
        console.error("Error verifying reset OTP:", error.response?.data || error.message);
        throw error;
    }
};

// Reset password with new password
const resetPassword = async (email, password) => {
    try {
        const response = await axios.post(API_URL + 'reset-password', { email, password });
        return response.data;
    } catch (error) {
        console.error("Error resetting password:", error.response?.data || error.message);
        throw error;
    }
};

// Refresh access token
const refreshToken = async () => {
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (!userData || !userData.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await axios.post(API_URL + 'refresh-token', {
            refreshToken: userData.refreshToken
        });

        if (response.data && response.data.success) {
            // Update stored tokens
            const updatedUserData = {
                ...userData,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken
            };
            localStorage.setItem('user', JSON.stringify(updatedUserData));
        }

        return response.data;
    } catch (error) {
        console.error("Error refreshing token:", error.response?.data || error.message);
        // If refresh fails, clear stored data
        localStorage.removeItem('user');
        throw error;
    }
};

// Get user by ID
const getUserById = async (userId) => {
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        const token = userData?.accessToken;

        const response = await axios.get(API_URL + userId, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        return response.data;
    } catch (error) {
        console.error("Error getting user:", error.response?.data || error.message);
        throw error;
    }
};

// Logout user
const logout = () => {
    localStorage.removeItem('user');
};

// Get current user from localStorage
const getCurrentUser = () => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
};

// Check if user is authenticated
const isAuthenticated = () => {
    const userData = getCurrentUser();
    return userData && userData.accessToken;
};

// Get access token
const getAccessToken = () => {
    const userData = getCurrentUser();
    return userData?.accessToken;
};

// Axios interceptor to handle token refresh automatically
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                await refreshToken();
                const userData = getCurrentUser();
                if (userData?.accessToken) {
                    originalRequest.headers.Authorization = `Bearer ${userData.accessToken}`;
                    return axios(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed, redirect to login
                logout();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

const authService = {
    requestEmailOTP,
    registerBuyer,
    registerSeller,
    login,
    requestPasswordReset,
    verifyResetOTP,
    resetPassword,
    refreshToken,
    getUserById,
    logout,
    getCurrentUser,
    isAuthenticated,
    getAccessToken,
    
    // Deprecated methods for backward compatibility
    signup: registerBuyer, // Keep for backward compatibility
    seller_signup: registerSeller, // Keep for backward compatibility
};

export default authService;