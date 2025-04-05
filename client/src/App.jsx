import React from "react";
import { Routes, Route } from "react-router-dom";
import Signup from './components/pages/Signup';
import Login from './components/pages/login';
import SellerSignup from "./components/pages/sellerSignup";
import Layout from './components/Layout'; 
import HomePage from './components/pages/homepage';
import AdminDashboard from "./components/pages/adminDashboard";
import SellerDashboard from "./components/pages/seller-dashboard";
import Cart from './components/pages/cart';

function App() {
  return (
    <Routes>
      {/* Routes with Navbar */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<Cart />} />
      </Route>
      
      {/* Routes without Navbar */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/seller-signup" element={<SellerSignup />} />
      <Route path="/seller-dashboard" element={<SellerDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;