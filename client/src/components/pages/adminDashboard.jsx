// src/pages/AdminDashboard.js
import React from 'react';
import { Container, Typography } from '@mui/material';
import SellerVerificationPanel from '../../components/admin/SellerVerificationPanel';

const AdminDashboard = () => {
  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Seller Verification Requests
      </Typography>
      <SellerVerificationPanel />
    </Container>
  );
};

export default AdminDashboard;