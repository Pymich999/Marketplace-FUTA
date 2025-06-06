import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService from "./authService";

const user = JSON.parse(localStorage.getItem("user"));

const initialState = {
  user: user ? user : null,
  isLoading: false,
  isSuccess: false,
  isError: false,
  message: "",
  otpSent: false,
  otpVerified: false,
};

// Request OTP for email verification
export const requestEmailOTP = createAsyncThunk(
  "auth/request-otp",
  async (email, thunkAPI) => {
    try {
      return await authService.requestEmailOTP(email);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Register buyer (updated to use new service method)
export const registerBuyer = createAsyncThunk(
  "auth/register-buyer",
  async (userData, thunkAPI) => {
    try {
      return await authService.registerBuyer(userData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Register seller (updated to use new service method)
export const registerSeller = createAsyncThunk(
  "auth/register-seller",
  async (userData, thunkAPI) => {
    try {
      return await authService.registerSeller(userData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Login user
export const login = createAsyncThunk(
  "auth/login",
  async (userData, thunkAPI) => {
    try {
      return await authService.login(userData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Request password reset OTP
export const requestPasswordReset = createAsyncThunk(
  "auth/request-password-reset",
  async (email, thunkAPI) => {
    try {
      return await authService.requestPasswordReset(email);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Verify reset OTP
export const verifyResetOTP = createAsyncThunk(
  "auth/verify-reset-otp",
  async ({ email, otp }, thunkAPI) => {
    try {
      return await authService.verifyResetOTP(email, otp);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Reset password
export const resetPassword = createAsyncThunk(
  "auth/reset-password",
  async ({ email, password }, thunkAPI) => {
    try {
      return await authService.resetPassword(email, password);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Refresh token
export const refreshToken = createAsyncThunk(
  "auth/refresh-token",
  async (_, thunkAPI) => {
    try {
      return await authService.refreshToken();
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Get user by ID
export const getUserById = createAsyncThunk(
  "auth/get-user",
  async (userId, thunkAPI) => {
    try {
      return await authService.getUserById(userId);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Backward compatibility thunks
export const signup = registerBuyer; // Alias for backward compatibility
export const sellerSignup = registerSeller; // Alias for backward compatibility

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = "";
      state.otpSent = false;
      state.otpVerified = false;
    },
    logout: (state) => {
      authService.logout(); // Use authService logout method
      state.user = null;
      state.isSuccess = false;
      state.isError = false;
      state.message = "";
      state.otpSent = false;
      state.otpVerified = false;
    },
    clearMessage: (state) => {
      state.message = "";
      state.isError = false;
      state.isSuccess = false;
    },
    setOTPSent: (state, action) => {
      state.otpSent = action.payload;
    },
    setOTPVerified: (state, action) => {
      state.otpVerified = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Request Email OTP
      .addCase(requestEmailOTP.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(requestEmailOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.otpSent = true;
        state.message = action.payload.message;
      })
      .addCase(requestEmailOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.otpSent = false;
      })

      // Register Buyer
      .addCase(registerBuyer.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(registerBuyer.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.user = action.payload;
        state.otpSent = false;
        state.otpVerified = false;
      })
      .addCase(registerBuyer.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
      })

      // Register Seller
      .addCase(registerSeller.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(registerSeller.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.user = action.payload;
        state.otpSent = false;
        state.otpVerified = false;
      })
      .addCase(registerSeller.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
      })

      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.user = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
      })

      // Request Password Reset
      .addCase(requestPasswordReset.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.otpSent = true;
        state.message = action.payload.message;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.otpSent = false;
      })

      // Verify Reset OTP
      .addCase(verifyResetOTP.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(verifyResetOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.otpVerified = true;
        state.message = action.payload.message;
      })
      .addCase(verifyResetOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.otpVerified = false;
      })

      // Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = "";
      })
      .addCase(resetPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = action.payload.message;
        state.otpSent = false;
        state.otpVerified = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Refresh Token
      .addCase(refreshToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        // Update user with new tokens if needed
        if (state.user) {
          state.user = { ...state.user, ...action.payload };
        }
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        // If refresh fails, logout user
        state.user = null;
      })

      // Get User By ID
      .addCase(getUserById.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getUserById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        // You might want to update current user or store fetched user data
        if (action.payload.user) {
          state.user = { ...state.user, ...action.payload };
        }
      })
      .addCase(getUserById.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { reset, logout, clearMessage, setOTPSent, setOTPVerified } = authSlice.actions;
export default authSlice.reducer;