import React, { useState } from 'react';
import axios from 'axios';
import { uploadImage } from '../../utils/imageUpload';
import '../pages-styles/seller-dashboard.css'
import { FaPlus, FaTrash, FaCopy } from 'react-icons/fa';

const BulkProductUploader = ({ onComplete, showNotification, categories }) => {
  const [products, setProducts] = useState([
    {
      id: 1,
      title: '',
      description: '',
      price: '',
      category: '',
      stock: '',
      images: [],
      imagePreviews: [null, null, null]
    }
  ]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);

  // Add a new product form
  const addProductForm = () => {
    const newId = Math.max(...products.map(p => p.id), 0) + 1;
    setProducts([
      ...products,
      {
        id: newId,
        title: '',
        description: '',
        price: '',
        category: '',
        stock: '',
        images: [],
        imagePreviews: [null, null, null]
      }
    ]);
  };

  // Remove a product form
  const removeProductForm = (id) => {
    if (products.length <= 1) {
      showNotification('You must have at least one product', 'warning');
      return;
    }
    setProducts(products.filter(product => product.id !== id));
  };

  // Duplicate a product form
  const duplicateProductForm = (id) => {
    const productToDuplicate = products.find(product => product.id === id);
    if (!productToDuplicate) return;
    
    const newId = Math.max(...products.map(p => p.id), 0) + 1;
    const duplicatedProduct = {
      ...productToDuplicate,
      id: newId,
      title: `${productToDuplicate.title} (Copy)`,
      images: [], // Don't copy the actual files, just previews
      imagePreviews: [...productToDuplicate.imagePreviews]
    };
    
    setProducts([...products, duplicatedProduct]);
  };

  // Handle input change for a specific product
  const handleInputChange = (id, name, value) => {
    setProducts(products.map(product => {
      if (product.id === id) {
        return { ...product, [name]: value };
      }
      return product;
    }));
  };

  // Handle category selection for a specific product
  const handleCategorySelect = (id, category) => {
    handleInputChange(id, 'category', category);
  };

  // Handle image upload for a specific product
  const handleImageUpload = (id, e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      showNotification('Image size must be less than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProducts(products.map(product => {
        if (product.id === id) {
          const newPreviews = [...product.imagePreviews];
          newPreviews[index] = reader.result;
          
          const currentImages = Array.from(product.images || []);
          const newImages = [...currentImages];
          newImages[index] = file;
          
          return { 
            ...product, 
            imagePreviews: newPreviews,
            images: newImages.filter(img => img !== undefined)
          };
        }
        return product;
      }));
    };
    reader.readAsDataURL(file);
  };

  // Clear image for a specific product
  const clearImage = (id, index) => {
    document.getElementById(`image-${id}-${index}`).value = '';
    
    setProducts(products.map(product => {
      if (product.id === id) {
        const newPreviews = [...product.imagePreviews];
        newPreviews[index] = null;
        
        const currentImages = Array.from(product.images || []);
        const newImages = [...currentImages];
        newImages[index] = undefined;
        
        return { 
          ...product, 
          imagePreviews: newPreviews,
          images: newImages.filter(img => img !== undefined)
        };
      }
      return product;
    }));
  };

  // Validate all products before submission
  const validateProducts = () => {
    let isValid = true;
    let errorMessages = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      if (!product.title.trim()) {
        errorMessages.push(`Product #${i+1}: Title is required`);
        isValid = false;
      }
      
      if (!product.description.trim()) {
        errorMessages.push(`Product #${i+1}: Description is required`);
        isValid = false;
      }
      
      if (!product.price || isNaN(parseFloat(product.price)) || parseFloat(product.price) <= 0) {
        errorMessages.push(`Product #${i+1}: Valid price is required`);
        isValid = false;
      }
      
      if (!product.category) {
        errorMessages.push(`Product #${i+1}: Category is required`);
        isValid = false;
      }
      
      if (!product.stock || isNaN(parseInt(product.stock)) || parseInt(product.stock) < 0) {
        errorMessages.push(`Product #${i+1}: Valid stock is required`);
        isValid = false;
      }
      
      if (product.images.length === 0 && product.imagePreviews.every(preview => preview === null)) {
        errorMessages.push(`Product #${i+1}: At least one image is required`);
        isValid = false;
      }
    }

    if (!isValid) {
      setError(errorMessages.join('\n'));
      showNotification('Please fix the errors before submitting', 'error');
    }
    
    return isValid;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateProducts()) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const user = JSON.parse(localStorage.getItem('user')) || {};
      if (!user.token) {
        throw new Error('Authentication required');
      }
      
      const totalProducts = products.length;
      setProgress({ current: 0, total: totalProducts });
      const successfulUploads = [];
      
      // Process each product one by one
      for (let i = 0; i < products.length; i++) {
        try {
          const product = products[i];
          
          // Upload images for this product
          const files = Array.from(product.images || []);
          let imageUrls = [];
          
          // Upload new images if any
          if (files.length > 0) {
            const uploadPromises = files.map(async (file) => {
              const result = await uploadImage(file);
              return result.secure_url;
            });
            
            imageUrls = await Promise.all(uploadPromises);
          }
          
          const productData = {
            title: product.title.trim(),
            description: product.description.trim(),
            price: parseFloat(product.price),
            category: product.category.trim(),
            stock: parseInt(product.stock, 10),
            images: imageUrls
          };
          
          const config = {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`
            }
          };
          
          // Submit to API
          await axios.post('/api/products', productData, config);
          successfulUploads.push(i);
          
          // Update progress
          setProgress({ current: i + 1, total: totalProducts });
          
        } catch (err) {
          console.error(`Error uploading product #${i+1}:`, err);
          showNotification(`Failed to upload product #${i+1}: ${err.message || 'Unknown error'}`, 'error');
        }
      }
      
      if (successfulUploads.length === totalProducts) {
        showNotification(`Successfully uploaded all ${totalProducts} products!`, 'success');
      } else if (successfulUploads.length > 0) {
        showNotification(`Uploaded ${successfulUploads.length} out of ${totalProducts} products`, 'warning');
      } else {
        showNotification('Failed to upload any products', 'error');
      }
      
      // Notify parent component that we're done
      onComplete();
      
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
      showNotification(`Operation failed: ${errorMessage}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bulk-uploader">
      <div className="bulk-uploader-header">
        <h2>Bulk Product Upload</h2>
        <div className="bulk-controls">
          <button 
            type="button" 
            className="btn-add-product" 
            onClick={addProductForm}
            disabled={isUploading}
          >
            <FaPlus /> Add Another Product
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <pre>{error}</pre>
        </div>
      )}

      {isUploading && (
        <div className="upload-progress">
          <h3>Uploading Products ({progress.current}/{progress.total})</h3>
          <progress value={progress.current} max={progress.total} />
          <p>{Math.round((progress.current / progress.total) * 100)}% complete</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="product-forms">
          {products.map((product, productIndex) => (
            <div key={product.id} className="product-form-container">
              <div className="product-form-header">
                <h3>Product #{productIndex + 1}</h3>
                <div className="product-form-actions">
                  <button 
                    type="button" 
                    className="action-btn action-btn-duplicate" 
                    onClick={() => duplicateProductForm(product.id)}
                    disabled={isUploading}
                    title="Duplicate this product"
                    style={{ 
      backgroundColor: '#e0f2f1', 
      color: '#00796b',
      border: '1px solid #b2dfdb',
      borderRadius: '4px',
      padding: '6px 10px',
      marginRight: '8px'
    }}
                  >
                    <FaCopy />
                  </button>
                  <button 
                    type="button" 
                    className="btn-remove" 
                    onClick={() => removeProductForm(product.id)}
                    disabled={isUploading || products.length <= 1}
                    title="Remove this product"
                     style={{ 
      backgroundColor: '#ffebee', 
      color: '#c62828',
      border: '1px solid #ffcdd2',
      borderRadius: '4px',
      padding: '6px 10px'
    }}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="product-form">
                <div className="form-group">
                  <label htmlFor={`title-${product.id}`}>Product Title*</label>
                  <input 
                    type="text" 
                    id={`title-${product.id}`} 
                    value={product.title} 
                    onChange={(e) => handleInputChange(product.id, 'title', e.target.value)}
                    disabled={isUploading}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor={`description-${product.id}`}>Description*</label>
                  <textarea 
                    id={`description-${product.id}`} 
                    value={product.description} 
                    onChange={(e) => handleInputChange(product.id, 'description', e.target.value)}
                    rows="4"
                    disabled={isUploading}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor={`price-${product.id}`}>Price*</label>
                    <input 
                      type="number" 
                      id={`price-${product.id}`} 
                      value={product.price} 
                      onChange={(e) => handleInputChange(product.id, 'price', e.target.value)}
                      min="0"
                      step="0.01"
                      disabled={isUploading}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`stock-${product.id}`}>Stock*</label>
                    <input 
                      type="number" 
                      id={`stock-${product.id}`} 
                      value={product.stock} 
                      onChange={(e) => handleInputChange(product.id, 'stock', e.target.value)}
                      min="0"
                      disabled={isUploading}
                      required
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Category*</label>
                  <div className="category-bubbles">
                    {categories.map((category, index) => (
                      <div 
                        key={index}
                        className={`category-bubble ${product.category === category ? 'selected' : ''}`}
                        onClick={() => !isUploading && handleCategorySelect(product.id, category)}
                      >
                        {category}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Product Images*</label>
                  <div className="modern-image-upload">
                    {[0, 1, 2, 3].map((index) => (
                      <div key={`image-upload-${product.id}-${index}`} className="image-upload-container">
                        {product.imagePreviews[index] ? (
                          <div className="image-preview">
                            <img 
                              src={product.imagePreviews[index]} 
                              alt={`Preview ${index+1}`} 
                            />
                            <button 
                              type="button" 
                              className="clear-image"
                              onClick={() => !isUploading && clearImage(product.id, index)}
                              disabled={isUploading}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <label className="upload-box" htmlFor={`image-${product.id}-${index}`}>
                            <div className="plus-icon">+</div>
                            <div className="upload-text">Upload Image {index+1}</div>
                            <input 
                              type="file" 
                              id={`image-${product.id}-${index}`} 
                              onChange={(e) => !isUploading && handleImageUpload(product.id, e, index)}
                              accept="image/*"
                              disabled={isUploading}
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bulk-form-actions">
          <button 
            type="button" 
            className="btn-cancel"
            onClick={onComplete}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-submit"
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : `Upload ${products.length} Products`}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BulkProductUploader;