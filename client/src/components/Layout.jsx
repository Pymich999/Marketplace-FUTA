import React, { useState, useEffect } from "react";
import Navbar from './navbar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  useEffect(() => {
    // Listen for mobile menu toggle events
    const handleMobileMenuToggle = (event) => {
      setIsMobileNavOpen(event.detail.isOpen);
      
      // Add or remove body scroll lock when mobile nav is open
      if (event.detail.isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    };
    
    window.addEventListener('mobileMenuToggle', handleMobileMenuToggle);
    
    // Clean up
    return () => {
      window.removeEventListener('mobileMenuToggle', handleMobileMenuToggle);
      document.body.style.overflow = '';
    };
  }, []);
  
  return (
    <div className={`app-layout ${isMobileNavOpen ? 'nav-open' : ''}`}>
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;