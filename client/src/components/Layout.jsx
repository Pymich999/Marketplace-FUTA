import React, { useState, useEffect } from "react";
import Navbar from './navbar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  const [isNavbarMinimized, setIsNavbarMinimized] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  useEffect(() => {
    // Listen for navbar resize events
    const handleNavbarResize = (event) => {
      setIsNavbarMinimized(event.detail.isMinimized);
    };
    
    // Listen for mobile menu toggle events
    const handleMobileMenuToggle = (event) => {
      setIsMobileNavOpen(event.detail.isOpen);
    };
    
    window.addEventListener('navbarResize', handleNavbarResize);
    window.addEventListener('mobileMenuToggle', handleMobileMenuToggle);
    
    // Handle window resize for mobile responsiveness
    const handleResize = () => {
      if (window.innerWidth > 768 && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('navbarResize', handleNavbarResize);
      window.removeEventListener('mobileMenuToggle', handleMobileMenuToggle);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileNavOpen]);
  
  return (
    <>
      <Navbar />
      {isMobileNavOpen && <div className="navbar-overlay visible" onClick={() => {
        // Dispatch custom event to close mobile menu
        window.dispatchEvent(new CustomEvent('mobileMenuToggle', { 
          detail: { isOpen: false } 
        }));
      }} />}
      <div className={`page-container ${isNavbarMinimized ? 'navbar-minimized' : ''}`}>
        <div className="content-container">
          <Outlet />
        </div>
      </div>
    </>
  );
};

export default Layout;