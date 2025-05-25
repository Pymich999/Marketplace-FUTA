import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { FaUser, FaShoppingCart, FaStore, FaArrowLeft, FaArrowRight, FaComment, FaEnvelope } from 'react-icons/fa';
import '../../index.css'; // Import the same CSS file used by HomePage

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [textingLoading, setTextingLoading] = useState(false);
  const [chatThreadId, setChatThreadId] = useState(null);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    tag: searchParams.get('tag') || '',
    sort: searchParams.get('sort') || 'newest',
  });

  // Get the viewAsSeller parameter from search params
  const viewAsSeller = searchParams.get('viewAsSeller') === 'true';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    businessName: '',
    businessDescription: '',
  });

  const { userId } = useParams();
  const navigate = useNavigate();

  const getAuthToken = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? user.token : null;
  }

  const getCurrentUser = () => {
    return JSON.parse(localStorage.getItem('user'));
  }

  const isOwnProfile = !userId;

  // Helper function to get products from either location
  const getProductsFromProfile = (profile) => {
    return profile?.products || 
           profile?.productCatalog?.products || 
           [];
  };

  // Helper function to get pagination from either location
  const getPaginationFromProfile = (profile) => {
    return profile?.pagination || 
           profile?.productCatalog?.pagination || 
           null;
  };

  // Function to find existing chat thread with this seller
  const findExistingChatThread = async () => {
    if (!profile || !profile._id) {
      return null;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      return null;
    }

    // Prevent users from messaging themselves
    if (currentUser._id === profile._id) {
      return null;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      };

      // Try to find existing chat thread with this seller
      const chatsResponse = await axios.get('/api/chats', config);
      
      let existingThread = null;
      if (chatsResponse.data && Array.isArray(chatsResponse.data)) {
        existingThread = chatsResponse.data.find(thread => 
          (thread.buyerId === currentUser._id && thread.sellerId === profile._id) ||
          (thread.sellerId === currentUser._id && thread.buyerId === profile._id) ||
          (thread.otherUserId === profile._id)
        );
      }

      return existingThread?.threadId || null;
    } catch (err) {
      console.error('Error finding existing chat thread:', err);
      return null;
    }
  };

  // Function to create new chat thread
  const createNewChatThread = async () => {
    if (!profile || !profile._id) {
      return null;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      return null;
    }

    try {
      const config = {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      };

      // Create new chat thread
      const createChatData = {
        otherUserId: profile._id,
      };

      const createResponse = await axios.post('/api/chats/create', createChatData, config);
      
      if (createResponse.data && createResponse.data.threadId) {
        return createResponse.data.threadId;
      }
      
      return null;
    } catch (err) {
      console.error('Error creating chat thread:', err);
      return null;
    }
  };

  // Function to handle texting the seller - now simplified to just find/create thread ID
  const handleTextSeller = async () => {
    if (!profile || !profile._id) {
      alert('Unable to message this seller. Please try again later.');
      return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
      alert('Please log in to message sellers.');
      navigate('/login');
      return;
    }

    // Prevent users from messaging themselves
    if (currentUser._id === profile._id) {
      alert('You cannot message yourself.');
      return;
    }

    try {
      setTextingLoading(true);
      
      // First, try to find existing chat thread
      let threadId = await findExistingChatThread();
      
      // If no existing thread, create a new one
      if (!threadId) {
        threadId = await createNewChatThread();
      }

      if (threadId) {
        setChatThreadId(threadId);
        // Navigate to the chat thread
        navigate(`/chats/${threadId}`);
      } else {
        throw new Error('Unable to create or find chat thread');
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      alert(err.response?.data?.message || 'Failed to start conversation. Please try again.');
    } finally {
      setTextingLoading(false);
    }
  };

  const fetchMyProfile = async () => {
    try {
      setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      };
      
      const { data } = await axios.get('/api/profile/me', config);
      
      if (data.success) {
        setProfile(data.profile);
        setFormData({
          name: data.profile.name || '',
          phone: data.profile.phone || '',
          businessName: data.profile.sellerProfile?.businessName || '',
          businessDescription: data.profile.sellerProfile?.businessDescription || '',
        });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileById = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.minPrice) queryParams.append('minPrice', filters.minPrice);
      if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice);
      if (filters.tag) queryParams.append('tag', filters.tag);
      if (filters.sort) queryParams.append('sort', filters.sort);
      
      const { data } = await axios.get(`/api/profile/${userId}?${queryParams.toString()}`);
      
      if (data.success) {
        setProfile(data.profile);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  // Modified to accept a userId parameter for fetching other sellers' dashboard
  const fetchDashboard = async (targetUserId = null) => {
    try {
      console.log('=== Dashboard Fetch Debug ===');
      console.log('targetUserId:', targetUserId);
      console.log('Current user token:', getAuthToken() ? 'Present' : 'Missing');
      
      const config = {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      };
      
      // If targetUserId is provided, fetch that seller's dashboard instead of own
      const url = targetUserId 
        ? `/api/profile/dashboard/${targetUserId}` 
        : '/api/profile/dashboard';
      
      console.log('Dashboard URL:', url);
      
      const { data } = await axios.get(url, config);
      console.log('Dashboard response:', data);
      
      if (data.success) {
        setDashboardData(data.dashboardData);
        console.log('Dashboard data set successfully');
      } else {
        console.error('Dashboard fetch failed:', data.message);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      console.error('Error response:', err.response?.data);
      // Don't show error to user as dashboard is optional data
      setDashboardData(null);
    }
  };

  const updateProfileData = async () => {
    try {
      setLoading(true);
      const config = {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      };
      
      const { data } = await axios.put('/api/profile/update', formData, config);
      if (data.success) {
        setProfile(data.profile);
        setEditMode(false);
        alert('Profile updated successfully');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfileData();
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = () => userId && fetchProfileById();

  // Format price in the same way as the homepage
  const formatPrice = (price) => {
    return `₦${price.toLocaleString()}`;
  };
  
  // Handle going back to the previous page
  const handleGoBack = () => {
    navigate(-1); // This navigates to the previous page in history
  };
  
  // Handle viewing product details - using same approach as Cart.jsx
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

  useEffect(() => {
    if (isOwnProfile) fetchMyProfile();
    else if (userId) fetchProfileById();
  }, [userId]);

  useEffect(() => {
    // MODIFIED: Dashboard fetch logic to allow anyone to view the dashboard
    // 1. If it's own profile and user is a seller - fetch own dashboard
    // 2. If viewing another profile with viewAsSeller param - fetch that seller's dashboard
    // Note: Now viewAsSeller works regardless of who is viewing
    if (isOwnProfile && profile?.role === 'seller') {
      fetchDashboard();
    } else if (!isOwnProfile && viewAsSeller && profile?.role === 'seller') {
      fetchDashboard(userId);
    }
    
  }, [profile, viewAsSeller, userId, isOwnProfile]);

  // Enhanced debugging logs
  useEffect(() => {
    if (profile) {
      console.log("Profile data:", profile);
      console.log("Role:", profile?.role);
      console.log("Direct products array:", profile?.products);
      console.log("ProductCatalog products:", profile?.productCatalog?.products);
      console.log("Using products from:", getProductsFromProfile(profile));
    }
  }, [profile]);

  if (loading && !profile) return <div className="loading-container"><div className="loading-spinner"></div><p>Loading profile...</p></div>;
  
  if (error) return (
    <div className="error-container">
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Try Again</button>
    </div>
  );

  // Helper function to determine if user can text this seller
  const canTextSeller = () => {
  const currentUser = getCurrentUser();
  
  // Debug logging
  console.log('=== Text Seller Button Debug ===');
  console.log('isOwnProfile:', isOwnProfile);
  console.log('profile:', profile);
  console.log('profile?.role:', profile?.role);
  console.log('currentUser:', currentUser);
  console.log('currentUser._id:', currentUser?._id);
  console.log('profile._id:', profile?._id);
  
  // Check each condition step by step
  if (isOwnProfile) {
    console.log('❌ Cannot text: viewing own profile');
    return false;
  }
  
  if (!profile) {
    console.log('❌ Cannot text: no profile data');
    return false;
  }
  
  if (profile.role !== 'seller') {
    console.log('❌ Cannot text: profile is not a seller, role is:', profile.role);
    return false;
  }
  
  if (!currentUser) {
    console.log('❌ Cannot text: user not logged in');
    return false;
  }
  
  // Convert both IDs to strings to ensure proper comparison
  const currentUserId = String(currentUser._id);
  const profileUserId = String(profile._id);
  
  if (currentUserId === profileUserId) {
    console.log('❌ Cannot text: trying to message yourself');
    console.log('Current user ID:', currentUserId);
    console.log('Profile user ID:', profileUserId);
    return false;
  }
  
  console.log('✅ Can text seller: all conditions met');
  return true;
};

  // Header with logo and cart/seller action (similar to HomePage)
  const Header = () => (
    <div className="site-header">
      <div className="header-main">
        <div className="header-logo">
          <h1>FUTA Marketplace</h1>
        </div>
        <div className="header-actions">
          <Link to="/list" className="cart-icon">
            <FaComment />
          </Link>
          <button className="become-seller-button" onClick={() => navigate('/seller-signup')}>
            <FaStore /> Become a Seller
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Header />
      <div className="profile-page">
        {/* Back button */}
        <div className="back-button-container">
          <button className="back-button" onClick={handleGoBack}>
            <FaArrowLeft /> Back
          </button>
        </div>
        
        <div className="container mt-4">
          <div className="profile-content">
          <div className="row">
            <div className="col-lg-4">
              <div className="card mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h3>{isOwnProfile ? 'My Profile' : 'User Profile'}</h3>
                  {/* Only show edit button if it's the user's own profile */}
                  {isOwnProfile && (
                    <button className="btn btn-sm btn-primary" onClick={() => setEditMode(!editMode)}>
                      {editMode ? 'Cancel' : 'Edit Profile'}
                    </button>
                  )}
                </div>
                <div className="card-body">
                  {/* Edit mode is only available to the profile owner */}
                  {isOwnProfile && editMode ? (
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <label htmlFor="name" className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label htmlFor="phone" className="form-label">Phone</label>
                        <input
                          type="text"
                          className="form-control"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                        />
                      </div>
                      
                      {(profile.role === 'seller' || profile.role === 'seller_pending') && (
                        <>
                          <div className="mb-3">
                            <label htmlFor="businessName" className="form-label">Business Name</label>
                            <input
                              type="text"
                              className="form-control"
                              id="businessName"
                              name="businessName"
                              value={formData.businessName}
                              onChange={handleChange}
                            />
                          </div>
                          
                          <div className="mb-3">
                            <label htmlFor="businessDescription" className="form-label">Business Description</label>
                            <textarea
                              className="form-control"
                              id="businessDescription"
                              name="businessDescription"
                              rows="4"
                              value={formData.businessDescription}
                              onChange={handleChange}
                            ></textarea>
                          </div>
                        </>
                      )}
                      
                      <button type="submit" className="btn btn-success">Save Changes</button>
                    </form>
                  ) : (
                    <div className="profile-info-grid">
                      <div className="profile-info-box primary">
                        <div className="profile-info-label">Name</div>
                        <div className="profile-info-value">{profile.name}</div>
                      </div>
                      
                      {isOwnProfile && (
                        <div className="profile-info-box info">
                          <div className="profile-info-label">Email</div>
                          <div className="profile-info-value">{profile.email}</div>
                        </div>
                      )}
                      
                      {isOwnProfile && profile.phone && (
                        <div className="profile-info-box success">
                          <div className="profile-info-label">Phone</div>
                          <div className="profile-info-value">{profile.phone}</div>
                        </div>
                      )}
                      
                      <div className="profile-info-box warning">
                        <div className="profile-info-label">Role</div>
                        <div className="profile-info-value">{profile.role.replace('_', ' ').toUpperCase()}</div>
                      </div>
                      
                      {profile.sellerProfile && (
                        <>
                          <div className="profile-info-box success">
                            <div className="profile-info-label">Business Name</div>
                            <div className="profile-info-value">{profile.sellerProfile.businessName}</div>
                          </div>
                          
                          {profile.sellerProfile.studentName && (
                            <div className="profile-info-box info">
                              <div className="profile-info-label">Student Name</div>
                              <div className="profile-info-value">{profile.sellerProfile.studentName}</div>
                            </div>
                          )}
                          
                          <div className="profile-info-box primary">
                            <div className="profile-info-label">Business Description</div>
                            <div className="profile-info-description">{profile.sellerProfile.businessDescription}</div>
                          </div>
                          
                          {isOwnProfile && (
                            <div className="profile-info-box warning">
                              <div className="profile-info-label">Verification Status</div>
                              <div className="profile-info-value">
                                <span className={`badge ${profile.sellerProfile.verificationStatus === 'verified' ? 'text-bg-success' : 'text-bg-warning'}`}>
                                  {profile.sellerProfile.verificationStatus.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Text Seller Button - Only show if user can text this seller */}
                      {canTextSeller() && (
                        <div className="profile-info-box text-center mt-3">
                          {/* FIXED: Use direct navigation instead of complex async operations */}
                          <button 
                            className="btn btn-primary btn-lg w-100 text-seller-btn"
                            onClick={handleTextSeller}
                            disabled={textingLoading}
                          >
                            {textingLoading ? (
                              <>
                                <div className="spinner-border spinner-border-sm me-2" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </div>
                                Starting conversation...
                              </>
                            ) : (
                              <>
                                <FaEnvelope className="me-2" />
                                Message Seller
                              </>
                            )}
                          </button>
                          
                          {/* Alternative: Add link to chat list if direct messaging fails */}
                          <div className="mt-2">
                            <Link 
                              to="/list" 
                              className="btn btn-outline-secondary btn-sm"
                            >
                              View All Messages
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              {/* MODIFIED: Show dashboard based on viewAsSeller param regardless of whether it's own profile */}
              {/* This allows anyone to view the dashboard but not edit it */}
              {((isOwnProfile && profile?.role === 'seller') || 
                (!isOwnProfile && viewAsSeller && profile?.role === 'seller')) && dashboardData && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h3>Seller Dashboard</h3>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <div className="card bg-primary text-white">
                          <div className="card-body">
                            <h5 className="card-title">Total Products</h5>
                            <h2>{dashboardData.stats.totalProducts}</h2>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-md-4 mb-3">
                        <div className="card bg-success text-white">
                          <div className="card-body">
                            <h5 className="card-title">Active Products</h5>
                            <h2>{dashboardData.stats.activeProducts}</h2>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-md-4 mb-3">
                        <div className="card bg-warning text-dark">
                          <div className="card-body">
                            <h5 className="card-title">Out of Stock</h5>
                            <h2>{dashboardData.stats.outOfStockProducts}</h2>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* FIXED: Check for products in both possible locations */}
              {(getProductsFromProfile(profile).length > 0) && (
                <div className="card mb-4">
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <h3>Products</h3>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      data-bs-toggle="collapse"
                      data-bs-target="#filterCollapse"
                      aria-expanded="false"
                    >
                      Filter Products
                    </button>
                  </div>

                  <div className="collapse" id="filterCollapse">
                    <div className="card-body border-bottom">
                      <div className="row">
                        <div className="col-md-3">
                          <label className="form-label">Category</label>
                          <select
                            name="category"
                            className="form-select"
                            value={filters.category}
                            onChange={handleFilterChange}
                          >
                            <option value="">All Categories</option>
                            {profile.categories?.map((cat, index) => (
                              <option key={index} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="col-md-2">
                          <label className="form-label">Min Price</label>
                          <input
                            type="number"
                            name="minPrice"
                            className="form-control"
                            value={filters.minPrice}
                            onChange={handleFilterChange}
                          />
                        </div>
                        
                        <div className="col-md-2">
                          <label className="form-label">Max Price</label>
                          <input
                            type="number"
                            name="maxPrice"
                            className="form-control"
                            value={filters.maxPrice}
                            onChange={handleFilterChange}
                          />
                        </div>
                        
                        <div className="col-md-3">
                          <label className="form-label">Tag</label>
                          <select
                            name="tag"
                            className="form-select"
                            value={filters.tag}
                            onChange={handleFilterChange}
                          >
                            <option value="">All Tags</option>
                            {profile.popularTags?.map((tag, index) => (
                              <option key={index} value={tag.name}>
                                {tag.name} ({tag.count})
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="col-md-2">
                          <label className="form-label">Sort By</label>
                          <select
                            name="sort"
                            className="form-select"
                            value={filters.sort}
                            onChange={handleFilterChange}
                          >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="row mt-3">
                        <div className="col-12">
                          <button className="btn btn-primary" onClick={applyFilters}>
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="card-body">
                      {(() => {
                        const products = getProductsFromProfile(profile);
                        return products && Array.isArray(products) && products.length > 0 ? (
                          <div className="product-grid">
                            {products.map((product) => (
                              <div 
                                key={product._id} 
                                className="product-card"
                              >
                                <div className="product-image">
                                  {product.images && product.images.length > 0 ? (
                                    <img
                                      src={product.images[0]}
                                      alt={product.title}
                                      className="product-card-image cursor-pointer"
                                      onClick={() => handleViewProductDetail(product)}
                                    />
                                  ) : (
                                    <div className="placeholder-image">No image</div>
                                  )}

                                  {product.stock < 10 && (
                                    <div className="stock-badge">
                                      {product.stock === 0
                                        ? "Out of stock"
                                        : "Low stock"}
                                    </div>
                                  )}
                                </div>

                                <div className="product-info">
                                  <h3 
                                    className="product-title cursor-pointer"
                                    onClick={() => handleViewProductDetail(product)}
                                  >
                                    {product.title}
                                  </h3>

                                  <div className="product-category">
                                    {(product.category || "").split(",")[0].trim()}
                                  </div>

                                  <div className="product-price">
                                    {formatPrice(product.price)}
                                  </div>

                                  <div className="product-actions">
                                    <button
                                      className="view-details-button"
                                      onClick={() => handleViewProductDetail(product)}
                                    >
                                      View Details <FaArrowRight size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="no-products-message">
                            <p>No products available to display.</p>
                            <p className="text-muted">
                              {profile?.role !== 'seller' ? 
                                "Only seller accounts can display products." : 
                                "This seller hasn't added any products yet."}
                            </p>
                            {/* Enhanced debug information */}
                            <div className="debug-info" style={{marginTop: '20px', padding: '10px', background: '#f8f9fa', borderRadius: '4px'}}>
                              <p>Debug Information:</p>
                              <ul>
                                <li>User Role: {profile?.role || 'undefined'}</li>
                                <li>Direct Products: {profile?.products ? 
                                  (Array.isArray(profile.products) ? 
                                    `exists (${profile.products.length} items)` : 
                                    'not an array') : 
                                  'missing'}
                                </li>
                                <li>ProductCatalog Products: {profile?.productCatalog?.products ? 
                                  (Array.isArray(profile.productCatalog.products) ? 
                                    `exists (${profile.productCatalog.products.length} items)` : 
                                    'not an array') : 
                                  'missing'}
                                </li>
                                <li>Available Profile Keys: {profile ? Object.keys(profile).join(', ') : 'none'}</li>
                              </ul>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {(() => {
                      const pagination = getPaginationFromProfile(profile);
                      return pagination && (
                        <nav aria-label="Product pagination" className="mt-4">
                          <ul className="pagination justify-content-center">
                            <li className={`page-item ${pagination.page === 0 ? 'disabled' : ''}`}>
                              <button className="page-link" onClick={() => {
                                const newParams = new URLSearchParams(window.location.search);
                                newParams.set('page', pagination.page - 1);
                                navigate(`/profile/${userId}?${newParams.toString()}`);
                                fetchProfileById();
                              }}>
                                Previous
                              </button>
                            </li>
                            
                            {[...Array(pagination.totalPages).keys()].map((page) => (
                              <li key={page} className={`page-item ${pagination.page === page ? 'active' : ''}`}>
                                <button className="page-link" onClick={() => {
                                  const newParams = new URLSearchParams(window.location.search);
                                  newParams.set('page', page);
                                  navigate(`/profile/${userId}?${newParams.toString()}`);
                                  fetchProfileById();
                                }}>
                                  {page + 1}
                                </button>
                              </li>
                            ))}
                            
                            <li className={`page-item ${pagination.page === pagination.totalPages - 1 ? 'disabled' : ''}`}>
                              <button className="page-link" onClick={() => {
                                const newParams = new URLSearchParams(window.location.search);
                                newParams.set('page', pagination.page + 1);
                                navigate(`/profile/${userId}?${newParams.toString()}`);
                                fetchProfileById();
                              }}>
                                Next
                              </button>
                            </li>
                          </ul>
                        </nav>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Custom styles for the text seller button */}
        <style jsx>{`
          .text-seller-btn {
            background: linear-gradient(135deg, #007bff, #0056b3);
            border: none;
            border-radius: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
          }

          .text-seller-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #0056b3, #004494);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
          }

          .text-seller-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          .text-seller-btn .spinner-border-sm {
            width: 1rem;
            height: 1rem;
          }

          .profile-info-box.text-center {
            border: none;
            background: transparent;
            padding: 1rem 0;
          }

          /* Additional responsive styling */
          @media (max-width: 768px) {
            .text-seller-btn {
              font-size: 0.9rem;
              padding: 12px 20px;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default Profile;