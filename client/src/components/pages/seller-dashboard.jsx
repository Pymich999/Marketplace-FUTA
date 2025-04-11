import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { uploadImage } from '../../utils/imageUpload';

const SellerDashboard = () => {
  // State for managing different views
  const [activeTab, setActiveTab] = useState('overview');
  
  // State for products
  const [products, setProducts] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for logout confirmation modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  // User state
  const [user, setUser] = useState(null);
  
  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0
  });
  
  // Form state for product upload
  const [newProduct, setNewProduct] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    stock: '',
    tags: '',
    images: []
  });
  
  // State for image previews
  const [imagePreviews, setImagePreviews] = useState([null, null, null]);
  
  // Selected product for editing
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login'; // Redirect to login page
  };
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const userString = localStorage.getItem('user');
        
        if (userString) {
          const userData = JSON.parse(userString);
          setUser(userData);
          const token = userData.token;
          
          if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          } else {
            setError('Authentication token not found. Please log in again.');
            setIsLoading(false);
            return;
          }
          
          // Only fetch products if user is a verified seller
          if (userData.role !== 'seller_pending') {
            const productsResponse = await axios.get('http://localhost:3000/api/products/seller');
            setProducts(productsResponse.data);
            calculateStats(productsResponse.data);
          }
        } else {
          setError('User data not found. Please log in again.');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.error('Dashboard data error:', err);
        setError('Failed to load dashboard data. Please make sure you are logged in as a seller.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const calculateStats = (prods) => {
    setStats({
      totalProducts: prods.length
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'images') {
      const files = e.target.files;
      setNewProduct({
        ...newProduct,
        images: files
      });
    } else {
      setNewProduct({
        ...newProduct,
        [name]: value
      });
    }
  };

  const handleImageUpload = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const newPreviews = [...imagePreviews];
      newPreviews[index] = reader.result;
      setImagePreviews(newPreviews);
    };
    reader.readAsDataURL(file);
    
    const currentImages = Array.from(newProduct.images || []);
    const newImages = [...currentImages];
    newImages[index] = file;
    
    setNewProduct({
      ...newProduct,
      images: newImages.filter(img => img !== undefined)
    });
  };

  const clearImage = (index) => {
    document.getElementById(`image-${index}`).value = '';
    const newPreviews = [...imagePreviews];
    newPreviews[index] = null;
    setImagePreviews(newPreviews);
    
    const currentImages = Array.from(newProduct.images || []);
    const newImages = [...currentImages];
    newImages[index] = undefined;
    
    setNewProduct({
      ...newProduct,
      images: newImages.filter(img => img !== undefined)
    });
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setError(null);

    try {
      const user = JSON.parse(localStorage.getItem('user')) || {};
      if (!user.token) throw new Error('Authentication required');

      const files = Array.from(newProduct.images);
      if (files.length === 0) throw new Error('At least one image is required');
      
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (files.some(file => !validTypes.includes(file.type))) {
        throw new Error('Only JPG, PNG, or WEBP images are allowed');
      }

      const uploadPromises = files.map(async (file, index) => {
        const result = await uploadImage(file);
        setUploadProgress(Math.round(((index + 1) / files.length) * 100));
        return result.secure_url;
      });

      const imageUrls = await Promise.all(uploadPromises);

      const productData = {
        title: newProduct.title.trim(),
        description: newProduct.description.trim(),
        price: parseFloat(newProduct.price),
        category: newProduct.category.trim(),
        stock: parseInt(newProduct.stock, 10),
        tags: typeof newProduct.tags === 'string' 
          ? newProduct.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
          : [],
        images: imageUrls
      };

      if (isNaN(productData.price) || productData.price <= 0) {
        throw new Error('Price must be a positive number');
      }
      if (isNaN(productData.stock) || productData.stock < 0) {
        throw new Error('Stock cannot be negative');
      }

      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        }
      };

      let response;
      if (selectedProduct) {
        response = await axios.put(
          `http://localhost:3000/api/products/${selectedProduct._id}`,
          productData,
          config
        );
        setProducts(products.map(p => 
          p._id === selectedProduct._id ? response.data : p
        ));
      } else {
        response = await axios.post(
          'http://localhost:3000/api/products',
          productData,
          config
        );
        setProducts([...products, response.data]);
      }

      setNewProduct({
        title: '',
        description: '',
        price: '',
        category: '',
        stock: '',
        tags: '',
        images: []
      });
      setImagePreviews([null, null, null]);

      alert(`Product ${selectedProduct ? 'updated' : 'added'} successfully!`);
      setActiveTab('products');

    } catch (err) {
      let errorMessage = 'An unexpected error occurred';
      if (err.response) {
        errorMessage = err.response.data?.message || err.response.statusText;
      } else if (err.request) {
        errorMessage = 'Network error - please check your connection';
      } else {
        errorMessage = err.message;
      }
      setError(`Operation failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`http://localhost:3000/api/products/${productId}`);
        setProducts(products.filter(product => product._id !== productId));
        alert('Product deleted successfully');
      } catch (err) {
        console.error('Product delete error:', err);
        setError('Failed to delete product. Please try again.');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (isLoading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error-message">{error}</div>;
  
  // Check if user role is seller_pending
  if (user?.role === 'seller_pending') {
    return (
      <div className="verification-pending">
        <div className="verification-content">
          <h1>FUTA-Marketplace Seller Verification</h1>
          <div className="verification-message">
            <p><strong>Thank you for registering as a seller!</strong></p>
            <p><strong>Your account is currently pending verification. This process typically takes 2-4 hours.</strong></p>
            <p><strong>Once verified, you'll be able to upload and sell your products on FUTA-Marketplace.</strong></p>
            <p><strong>We appreciate your patience and look forward to having you as part of our marketplace community!</strong></p>
          </div>
          <button 
            className="btn-logout"
            onClick={() => setShowLogoutModal(true)}
          >
            Logout
          </button>
        </div>
        
        {/* Logout Confirmation Modal */}
        {showLogoutModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Confirm Logout</h3>
              <p>Are you sure you want to logout?</p>
              <div className="modal-actions">
                <button 
                  className="btn-cancel"
                  onClick={() => setShowLogoutModal(false)}
                >
                  No, Cancel
                </button>
                <button 
                  className="btn-confirm"
                  onClick={handleLogout}
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="seller-dashboard">
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                No, Cancel
              </button>
              <button 
                className="btn-confirm"
                onClick={handleLogout}
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
      
      <header className="dashboard-header">
        <h1>Futa Marketplace - Seller Dashboard</h1>
        <button 
          className="btn-logout"
          onClick={() => setShowLogoutModal(true)}
        >
          Logout
        </button>
      </header>
      
      <div className="dashboard-content">
        <div className="dashboard-sidebar">
          <nav className="dashboard-nav">
            <ul>
              <li 
                className={activeTab === 'overview' ? 'active' : ''} 
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </li>
              <li 
                className={activeTab === 'products' ? 'active' : ''} 
                onClick={() => setActiveTab('products')}
              >
                Products
              </li>
              <li 
                className={activeTab === 'add-product' ? 'active' : ''} 
                onClick={() => setActiveTab('add-product')}
              >
                Add Product
              </li>
            </ul>
          </nav>
        </div>
        
        <div className="dashboard-main">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <h2>Dashboard Overview</h2>
              
              <div className="stats-cards">
                <div className="stat-card">
                  <h3>Products</h3>
                  <p className="stat-number">{stats.totalProducts}</p>
                </div>
              </div>
              
              <div className="recent-activity">
                <h3>Recent Products</h3>
                {products.length > 0 ? (
                  <div className="recent-products">
                    {products.slice(0, 5).map(product => (
                      <div key={`recent-product-${product._id}`} className="recent-product-item">
                        <p><strong>{product.title}</strong></p>
                        <p className="product-price">{formatCurrency(product.price)}</p>
                        <span className={`product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No products found. Start by adding your first product.</p>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'products' && (
            <div className="products-tab">
              <h2>Your Products</h2>
              
              {products.length > 0 ? (
                <div className="products-list">
                  <div className="products-header">
                    <div className="product-column">Image</div>
                    <div className="product-column">Title</div>
                    <div className="product-column">Price</div>
                    <div className="product-column">Stock</div>
                    <div className="product-column">Actions</div>
                  </div>
                  
                  {products.map(product => (
                    <div key={`product-${product._id}`} className="product-item">
                      <div className="product-column">
                        <div className="product-image">
                          {product.images && product.images.length > 0 ? (
                            <img src={product.images[0]} alt={product.title} />
                          ) : (
                            <div className="no-image">No Image</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="product-column">
                        <h3>{product.title}</h3>
                        <span className="product-category">{product.category}</span>
                      </div>
                      
                      <div className="product-column">
                        {formatCurrency(product.price)}
                      </div>
                      
                      <div className="product-column">
                        <span className={product.stock > 0 ? 'in-stock' : 'out-of-stock'}>
                          {product.stock > 0 ? `${product.stock} units` : 'Out of stock'}
                        </span>
                      </div>
                      
                      <div className="product-column">
                        <button 
                          className="btn-edit"
                          onClick={() => {
                            setSelectedProduct(product);
                            setNewProduct({
                              title: product.title,
                              description: product.description || '',
                              price: product.price,
                              category: product.category || '',
                              stock: product.stock,
                              tags: product.tags ? product.tags.join(', ') : '',
                              images: []
                            });
                            if (product.images && product.images.length > 0) {
                              const newPreviews = [...imagePreviews];
                              product.images.forEach((img, idx) => {
                                if (idx < 3) newPreviews[idx] = img;
                              });
                              setImagePreviews(newPreviews);
                            } else {
                              setImagePreviews([null, null, null]);
                            }
                            setActiveTab('add-product');
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => deleteProduct(product._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-products-message">
                  You haven't added any products yet. Go to Add Product to get started.
                </p>
              )}
            </div>
          )}
          
          {activeTab === 'add-product' && (
            <div className="add-product-tab">
              <h2>{selectedProduct ? 'Edit Product' : 'Add New Product'}</h2>

              {isUploading && (
                <div className="upload-progress">
                  <progress value={uploadProgress} max="100" />
                  <span>{uploadProgress}% uploaded</span>
               </div>
              )}
              
              <form className="product-form" onSubmit={handleProductSubmit}>
                <div className="form-group">
                  <label htmlFor="title">Product Title*</label>
                  <input 
                    type="text" 
                    id="title" 
                    name="title" 
                    value={newProduct.title} 
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="description">Description*</label>
                  <textarea 
                    id="description" 
                    name="description" 
                    value={newProduct.description} 
                    onChange={handleInputChange}
                    rows="4"
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="price">Price*</label>
                    <input 
                      type="number" 
                      id="price" 
                      name="price" 
                      value={newProduct.price} 
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="stock">Stock*</label>
                    <input 
                      type="number" 
                      id="stock" 
                      name="stock" 
                      value={newProduct.stock} 
                      onChange={handleInputChange}
                      min="0"
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <input 
                    type="text" 
                    id="category" 
                    name="category" 
                    value={newProduct.category} 
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="tags">Tags (comma separated)</label>
                  <input 
                    type="text" 
                    id="tags" 
                    name="tags" 
                    value={newProduct.tags} 
                    onChange={handleInputChange}
                    placeholder="e.g. electronics, smartphone, accessory"
                  />
                </div>
                
                <div className="form-group">
                  <label>Product Images* (Select exactly 3 images)</label>
                  <div className="modern-image-upload">
                    {[0, 1, 2].map((index) => (
                      <div key={`image-upload-${index}`} className="image-upload-container">
                        {imagePreviews[index] ? (
                          <div className="image-preview">
                            <img 
                              src={imagePreviews[index]} 
                              alt={`Preview ${index+1}`} 
                            />
                            <button 
                              type="button" 
                              className="clear-image"
                              onClick={() => clearImage(index)}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <label className="upload-box" htmlFor={`image-${index}`}>
                            <div className="plus-icon">+</div>
                            <div className="upload-text">Upload Image {index+1}</div>
                            <input 
                              type="file" 
                              id={`image-${index}`} 
                              onChange={(e) => handleImageUpload(e, index)}
                              accept="image/*"
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  <small className="form-help">Click the + icon to upload each image</small>
                </div>
                
                <div className="form-actions">
                  {selectedProduct && (
                    <button 
                      type="button" 
                      className="btn-cancel"
                      onClick={() => {
                        setSelectedProduct(null);
                        setNewProduct({
                          title: '',
                          description: '',
                          price: '',
                          category: '',
                          stock: '',
                          tags: '',
                          images: []
                        });
                        setImagePreviews([null, null, null]);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  
                  <button type="submit" className="btn-submit">
                    {selectedProduct ? 'Update Product' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;