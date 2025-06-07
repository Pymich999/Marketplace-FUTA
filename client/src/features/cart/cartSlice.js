import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { cartService } from './cartService';

const initialState = {
  items: [],
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: ''
};

// Get cart - let service handle token
export const getCart = createAsyncThunk('cart/getCart', async (_, thunkAPI) => {
  try {
    return await cartService.getCart(); // Service will get token from localStorage
  } catch (error) {
    const message = error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

// Add to cart
export const addToCart = createAsyncThunk('cart/addToCart', async (cartData, thunkAPI) => {
  try {
    return await cartService.addToCart(cartData); // Service will get token from localStorage
  } catch (error) {
    const message = error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

// Update cart
export const updateCart = createAsyncThunk('cart/updateCart', async (cartData, thunkAPI) => {
  try {
    return await cartService.updateCart(cartData); // Service will get token from localStorage
  } catch (error) {
    const message = error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

// Remove from cart
export const removeFromCart = createAsyncThunk('cart/removeFromCart', async (productId, thunkAPI) => {
  try {
    return await cartService.removeFromCart(productId); // Service will get token from localStorage
  } catch (error) {
    const message = error.message || error.toString();
    return thunkAPI.rejectWithValue(message);
  }
});

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    reset: (state) => initialState
  },
  extraReducers: (builder) => {
    builder
      .addCase(getCart.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.items = action.payload.items || action.payload;
      })
      .addCase(getCart.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(addToCart.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        // Update items if the response includes updated cart
        if (action.payload.items) {
          state.items = action.payload.items;
        }
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(updateCart.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        // Update items if the response includes updated cart
        if (action.payload.items) {
          state.items = action.payload.items;
        }
      })
      .addCase(updateCart.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(removeFromCart.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(removeFromCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        // Update items if the response includes updated cart
        if (action.payload.items) {
          state.items = action.payload.items;
        }
      })
      .addCase(removeFromCart.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  }
});

export const { reset } = cartSlice.actions;
export default cartSlice.reducer;