import React from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Signup from './components/pages/Signup';
import Login from './components/pages/login';
import SellerSignup from "./components/pages/sellerSignup";
import Layout from './components/Layout';
import HomePage from './components/pages/homepage';
import AdminDashboard from "./components/pages/adminDashboard";
import SellerDashboard from "./components/pages/seller-dashboard";
import Cart from './components/pages/cart';
import Chatpage from './components/pages/Chatpage'
import Chatlist from './components/pages/Chatlist'
import Profile from './components/pages/profilepage'

function App() {
  return (
    <div className="app-container">
      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      
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
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        {/* Updated chat routes */}
        <Route path="/chats" element={<Chatlist />} />
        <Route path="/chats/:threadId" element={<Chatpage />} />
          
          {/* Keep these as fallbacks for any existing links */}
        <Route path="/list" element={<Chatlist />} />
        <Route path="/chatpage/:threadId" element={<Chatpage />} /> 
      </Routes>
    </div>
  );
}

export default App;