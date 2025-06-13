import axios from 'axios';

const API_URL = 'http://localhost:3000/api/users/';

// Token refresh state management
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    
    failedQueue = [];
};

// Helper function to check if token is expired or about to expire
const isTokenExpired = (token) => {
    if (!token) return true;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        // Consider token expired if it expires in the next 2 minutes
        return payload.exp < (currentTime + 120);
    } catch (error) {
        console.error('Error parsing token:', error);
        return true;
    }
};

// Request OTP for email verification
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
        const response = await axios.post(API_URL, userData);
        
        if (response.data && response.data.success) {
            const userDataToStore = {
                user: response.data.user,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                tokenTimestamp: Date.now()
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
        const response = await axios.post(API_URL + 'seller-signup', userData);
        
        if (response.data && response.data.success) {
            const userDataToStore = {
                user: response.data.user,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                tokenTimestamp: Date.now()
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
            const userDataToStore = {
                user: response.data.user,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                tokenTimestamp: Date.now()
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

// Refresh access token - improved version
const refreshToken = async () => {
    const userData = JSON.parse(localStorage.getItem('user'));
    
    if (!userData || !userData.refreshToken) {
        throw new Error('No refresh token available');
    }

    // Check if refresh token itself is expired (rough check)
    try {
        const refreshPayload = JSON.parse(atob(userData.refreshToken.split('.')[1]));
        const currentTime = Date.now() / 1000;
        
        if (refreshPayload.exp < currentTime) {
            localStorage.removeItem('user');
            throw new Error('Refresh token expired');
        }
    } catch (error) {
        localStorage.removeItem('user');
        throw new Error('Invalid refresh token');
    }

    try {
        const response = await axios.post(API_URL + 'refresh-token', {
            refreshToken: userData.refreshToken
        });

        if (response.data && response.data.success) {
            const updatedUserData = {
                ...userData,
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                tokenTimestamp: Date.now()
            };
            localStorage.setItem('user', JSON.stringify(updatedUserData));
            return response.data;
        }
    } catch (error) {
        console.error("Error refreshing token:", error.response?.data || error.message);
        localStorage.removeItem('user');
        throw error;
    }
};

// Get user by ID with automatic token refresh
const getUserById = async (userId) => {
    try {
        await ensureValidToken();
        
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

// Ensure we have a valid token before making requests
const ensureValidToken = async () => {
    const userData = getCurrentUser();
    
    if (!userData || !userData.accessToken) {
        throw new Error('No authentication data');
    }
    
    if (isTokenExpired(userData.accessToken)) {
        console.log('Access token expired, refreshing...');
        await refreshToken();
    }
};

// Logout user
const logout = () => {
    localStorage.removeItem('user');
    // Optional: Also call backend logout endpoint if you have one
};

// Get current user from localStorage
const getCurrentUser = () => {
    try {
        const userData = localStorage.getItem('user');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
        return null;
    }
};

// Check if user is authenticated with valid token
const isAuthenticated = () => {
    const userData = getCurrentUser();
    if (!userData || !userData.accessToken || !userData.refreshToken) {
        return false;
    }
    
    // Check if refresh token is still valid
    try {
        const refreshPayload = JSON.parse(atob(userData.refreshToken.split('.')[1]));
        const currentTime = Date.now() / 1000;
        return refreshPayload.exp > currentTime;
    } catch (error) {
        return false;
    }
};

// Get access token
const getAccessToken = () => {
    const userData = getCurrentUser();
    return userData?.accessToken;
};

// Improved Axios interceptor with better error handling
axios.interceptors.request.use(
    async (config) => {
        // Skip token check for auth endpoints
        const authEndpoints = ['login', 'register-buyer', 'register-seller', 'request-otp', 'request-password-reset', 'verify-reset-otp', 'reset-password'];
        const isAuthEndpoint = authEndpoints.some(endpoint => config.url.includes(endpoint));
        
        if (!isAuthEndpoint) {
            const userData = getCurrentUser();
            if (userData?.accessToken) {
                // Check if token needs refresh before request
                if (isTokenExpired(userData.accessToken)) {
                    try {
                        await refreshToken();
                        const updatedUserData = getCurrentUser();
                        config.headers.Authorization = `Bearer ${updatedUserData.accessToken}`;
                    } catch (error) {
                        // If refresh fails, let the response interceptor handle it
                        config.headers.Authorization = `Bearer ${userData.accessToken}`;
                    }
                } else {
                    config.headers.Authorization = `Bearer ${userData.accessToken}`;
                }
            }
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If we're already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axios(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const result = await refreshToken();
                const newToken = result.accessToken;
                
                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                
                return axios(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                logout();
                
                // Only redirect if we're in a browser environment
                if (typeof window !== 'undefined') {
                    window.location.href = '/login';
                }
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
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
    ensureValidToken,
    
    // Deprecated methods for backward compatibility
    signup: registerBuyer,
    seller_signup: registerSeller,
};

export default authService;