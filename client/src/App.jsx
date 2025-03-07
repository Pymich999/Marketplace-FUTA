import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Signup from './components/Signup';
import Login from './components/login';
import Layout from './components/Layout'; 
import HomePage from './components/homepage';
import Cart from './components/cart';

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
    </Routes>
  );
}

export default App;