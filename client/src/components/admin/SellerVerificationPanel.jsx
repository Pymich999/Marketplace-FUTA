import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { getPendingSellerRequests, updateSellerVerification } from '../../features/admin/adminServices';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@mui/material';

const SellerVerificationPanel = () => {
  const [pendingSellers, setPendingSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectionReasons, setRejectionReasons] = useState({});
  const [processing, setProcessing] = useState({});
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  const user = JSON.parse(localStorage.getItem('user'));
  const userToken = user?.token;

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  useEffect(() => {
    if (!userToken) {
      setError('No authentication token found. Please login again.');
      setLoading(false);
      return;
    }

    const fetchPendingSellers = async () => {
      try {
        console.log('[SellerVerificationPanel] Fetching pending sellers...');
        const data = await getPendingSellerRequests(userToken);
        setPendingSellers(data);
        setLoading(false);
      } catch (err) {
        console.error('[SellerVerificationPanel] Fetch error:', err);
        setError(err.message || 'Failed to fetch pending sellers');
        setLoading(false);
      }
    };

    fetchPendingSellers();
  }, [userToken]);

  const handleVerification = async (sellerId, action) => {
    if (!userToken) {
      setError('No authentication token found. Please login again.');
      return;
    }

    setProcessing((prev) => ({ ...prev, [sellerId]: true }));
    
    try {
      const rejectionReason = rejectionReasons[sellerId] || '';
      console.log('[SellerVerificationPanel] Sending verification with:', {
        sellerId,
        action,
        rejectionReason
      });

      const updatedSeller = await updateSellerVerification(
        sellerId,
        action,
        rejectionReason,
        userToken
      );

      setPendingSellers((prev) =>
        prev.filter((seller) => seller.user._id !== sellerId)
      );
    } catch (err) {
      console.error('[SellerVerificationPanel] Verification error:', err);
      setError(err.message || 'Failed to process verification');
    } finally {
      setProcessing((prev) => ({ ...prev, [sellerId]: false }));
    }
  };

  const handleRejectionReasonChange = (sellerId, reason) => {
    setRejectionReasons((prev) => ({
      ...prev,
      [sellerId]: reason,
    }));
  };

  // Logout confirmation modal
  const renderLogoutModal = () => {
    if (!showLogoutModal) return null;
    
    return (
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
    );
  };

  // Logout button
  const renderLogoutButton = () => (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
      <Button
        variant="contained"
        color="error"
        onClick={() => setShowLogoutModal(true)}
        className="btn-logout"
      >
        Logout
      </Button>
    </Box>
  );

  // Main content rendering based on state
  const renderContent = () => {
    if (loading) {
      return (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box mt={2}>
          <Typography color="error">{error}</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => window.location.reload()}
            sx={{ mt: 2 }}
          >
            Refresh Page
          </Button>
        </Box>
      );
    }

    if (pendingSellers.length === 0) {
      return (
        <Box mt={2}>
          <Typography variant="h6" color="textSecondary">
            No pending seller verification requests
          </Typography>
        </Box>
      );
    }

    return (
      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ p: 2 }}>
          Seller Verification Requests
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Seller Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Business Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Business Description</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Submitted At</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Rejection Reason</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingSellers.map((seller) => (
              <TableRow key={seller.user._id} hover>
                <TableCell>{seller.user.name}</TableCell>
                <TableCell>{seller.profile?.businessName || 'N/A'}</TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  {seller.profile?.businessDescription || 'No description provided'}
                </TableCell>
                <TableCell>
                  {seller.profile?.submittedAt 
                    ? new Date(seller.profile.submittedAt).toLocaleString() 
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  {seller.profile?.verificationStatus === 'pending' ? (
                    <TextField
                      size="small"
                      label="Reason (if rejecting)"
                      value={rejectionReasons[seller.user._id] || ''}
                      onChange={(e) =>
                        handleRejectionReasonChange(seller.user._id, e.target.value)
                      }
                      fullWidth
                      sx={{ minWidth: 200 }}
                    />
                  ) : seller.profile?.verificationStatus === 'rejected' ? (
                    <Chip
                      label={seller.profile.rejectionReason || 'No reason provided'}
                      color="error"
                      size="small"
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  {seller.profile?.verificationStatus === 'pending' ? (
                    <Box display="flex" gap={1}>
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        disabled={processing[seller.user._id]}
                        onClick={() => handleVerification(seller.user._id, 'approve')}
                        sx={{ minWidth: 100 }}
                      >
                        {processing[seller.user._id] ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          'Approve'
                        )}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        disabled={processing[seller.user._id]}
                        onClick={() => handleVerification(seller.user._id, 'reject')}
                        sx={{ minWidth: 100 }}
                      >
                        {processing[seller.user._id] ? (
                          <CircularProgress size={20} />
                        ) : (
                          'Reject'
                        )}
                      </Button>
                    </Box>
                  ) : seller.profile?.verificationStatus === 'approved' ? (
                    <Chip 
                      label="Approved" 
                      color="success" 
                      size="small" 
                      variant="outlined"
                    />
                  ) : (
                    <Chip 
                      label="Rejected" 
                      color="error" 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <>
      {renderLogoutModal()}
      {renderLogoutButton()}
      <Box>
        <Typography variant="h5" gutterBottom>
          Seller Verification Requests
        </Typography>
        {renderContent()}
      </Box>
    </>
  );
};

export default SellerVerificationPanel;