import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  FaBars, 
  FaHome, 
  FaShoppingCart, 
  FaUser, 
  FaSignOutAlt, 
  FaSignInAlt,
  FaStore,
  FaAngleDown,
  FaTimes,
  FaComment,
} from "react-icons/fa";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef(null);
  
  // Handle screen resize and detect mobile view
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      // Only auto-open on desktop
      if (!mobile) {
        setIsOpen(true);
      }
    };
    
    // Set initial state based on screen size
    handleResize();
    
    // Add event listener
    window.addEventListener("resize", handleResize);
    
    // Clean up
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile]);
  
  // Handle clicks outside the navbar to close it on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMobile && isOpen && navRef.current && !navRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobile]);

  // Check if the link is active
  const isActive = (path) => {
    return location.pathname === path ? "active" : "";
  };

  // Toggle navbar between expanded and minimized states
  const toggleNavbarSize = () => {
    setIsMinimized(!isMinimized);
    // Dispatch an event so other components can adjust
    window.dispatchEvent(new CustomEvent('navbarResize', { 
      detail: { isMinimized: !isMinimized } 
    }));
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsOpen(!isOpen);
  };

  // Logout handler
  const handleLogout = () => {
    console.log('Logout initiated');
    localStorage.removeItem('user');
    console.log('User removed from localStorage');
    setShowLogoutModal(false);
    console.log('Navigating to login page');
    navigate('/signup');
  };

  // Logout Modal Component
  const LogoutModal = () => {
    return (
      <div className="logout-modal-overlay">
        <div className="logout-modal">
          <button 
            className="logout-modal-close"
            onClick={() => setShowLogoutModal(false)}
          >
            <FaTimes />
          </button>
          <div className="logout-modal-content">
            <h2>Confirm Logout</h2>
            <p>Are you sure you want to log out?</p>
            <div className="logout-modal-actions">
              <button 
                className="logout-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button 
                className="logout-confirm"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="navbar-wrapper">
      {/* Logout Modal */}
      {showLogoutModal && <LogoutModal />}

      {/* Mobile Header with Menu Button and Logo */}
      <div className="mobile-header">
        <div className="logo-container">
          <FaStore size={24} />
          <h2 className="site-title">My Store</h2>
        </div>
        
        {/* Mobile Menu Button */}
        <button 
          className="menu-btn" 
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
        >
          {isOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>
      
      {/* Navbar Container */}
      <div 
        ref={navRef}
        className={`navbar-container ${isOpen ? "open" : ""} ${isMinimized ? "minimized" : ""} ${isMobile ? "mobile" : ""}`}
      >
        <nav className="sidebar">
          {/* Sidebar Header with Logo and Toggle Button - Only visible on desktop */}
          {!isMobile && (
            <div className="sidebar-header">
              <div className="logo-container">
                <FaStore size={24} />
                <h2 className="site-title">My Store</h2>
              </div>
              <button 
                className="toggle-nav-btn"
                onClick={toggleNavbarSize}
                aria-label="Toggle navbar size"
              >
                <FaAngleDown className={isMinimized ? "rotate-icon" : ""} />
              </button>
            </div>
          )}
          
          <ul>
            <li>
              <Link to="/" className={isActive("/")} title="Home">
                <FaHome /> 
                <span className="nav-text">Home</span>
              </Link>
            </li>
            <li>
              <Link to="/cart" className={isActive("/cart")} title="Cart">
                <FaShoppingCart /> 
                <span className="nav-text">Cart</span>
              </Link>
            </li>
            <li>
              <Link to="/list" className={isActive("/list")} title="Orders">
                <FaComment /> 
                <span className="nav-text">Orders</span>
              </Link>
            </li>
            <li>
              <Link to="/login" className={isActive("/login")} title="Login">
                <FaSignInAlt /> 
                <span className="nav-text">Login</span>
              </Link>
            </li>
            <li>
              <Link to="/signup" className={isActive("/signup")} title="Sign Up">
                <FaUser /> 
                <span className="nav-text">Sign Up</span>
              </Link>
            </li>
            <li>
              {/* Change to button to trigger modal instead of link */}
              <button 
                onClick={() => setShowLogoutModal(true)} 
                className="logout-button"
                title="Logout"
              >
                <FaSignOutAlt /> 
                <span className="nav-text">Logout</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
      
      {/* Overlay for mobile to close sidebar when clicking outside */}
      {isOpen && isMobile && (
        <div 
          className="navbar-overlay"
          onClick={toggleMobileMenu}
        />
      )}
    </div>
  );
};

export default Navbar;