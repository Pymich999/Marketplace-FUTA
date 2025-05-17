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
  FaTimes,
  FaComment
} from "react-icons/fa";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const navRef = useRef(null);
  
  // Handle screen resize and detect mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsOpen(false);
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
    if (isMobile && isOpen) {
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

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // Dispatch event for layout to know about menu state
    window.dispatchEvent(new CustomEvent('mobileMenuToggle', { 
      detail: { isOpen: newIsOpen } 
    }));
  };

  // Logout handler
  const handleLogout = () => {
    // For demo purposes, we'll just simulate a logout
    console.log("User logged out");
    localStorage.removeItem('user');
    setShowLogoutModal(false);
    navigate('/login');
  };

  // Logout Modal Component
  const LogoutModal = () => {
    return (
      <div className="logout-modal-overlay">
        <div className="logout-modal">
          <button 
            className="logout-modal-close"
            onClick={() => setShowLogoutModal(false)}
            aria-label="Close modal"
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
    <>
      {/* Logout Modal */}
      {showLogoutModal && <LogoutModal />}

      {/* Main Header - Desktop Only */}
      {!isMobile && (
        <header className="main-header">
          <div className="top-bar">
            <div className="logo-container">
              <Link to="/" className="logo-link">
                <FaStore className="logo-icon" />
                <span className="logo-text">FUTA Marketplace</span>
              </Link>
            </div>

            {/* Navigation Controls - Right side */}
            <div className="nav-controls">
              {/* Desktop Navigation Links */}
              <nav className="desktop-nav">
                <Link to="/" className={`nav-link ${isActive("/")}`}>
                  <FaHome />
                  <span>Home</span>
                </Link>
                <Link to="/cart" className={`nav-link ${isActive("/cart")}`}>
                  <FaShoppingCart />
                  <span>Cart</span>
                </Link>
                <Link to="/list" className={`nav-link ${isActive("/orders")}`}>
                  <FaComment />
                  <span>Orders</span>
                </Link>
                <Link to="/login" className={`nav-link ${isActive("/login")}`}>
                  <FaSignInAlt />
                  <span>Login</span>
                </Link>
                <Link to="/signup" className={`nav-link ${isActive("/signup")}`}>
                  <FaUser />
                  <span>Signup</span>
                </Link>
                <button 
              className={`bottom-nav-item`}
              onClick={() => setShowLogoutModal(true)}
            >
              <FaSignOutAlt />
              <span>Logout</span>
            </button>
              </nav>
            </div>
          </div>
        </header>
      )}

      {/* Bottom Navigation - Mobile */}
      {isMobile && (
        <header className="mobile-header">
          <div className="mobile-logo-bar">
            <Link to="/" className="mobile-logo-link">
              <FaStore className="logo-icon" />
              <span className="logo-text">FUTA Marketplace</span>
            </Link>
            <button 
              className="menu-toggle"
              onClick={toggleMobileMenu}
              aria-label="Toggle menu"
            >
              {isOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
          
          <nav className="bottom-nav">
            <Link to="/" className={`bottom-nav-item ${isActive("/")}`}>
              <FaHome />
              <span>Home</span>
            </Link>
            <Link to="/cart" className={`bottom-nav-item ${isActive("/cart")}`}>
              <FaShoppingCart />
              <span>Cart</span>
            </Link>
            <Link to="/list" className={`bottom-nav-item ${isActive("/orders")}`}>
              <FaComment />
              <span>Orders</span>
            </Link>
            <Link to="/login" className={`bottom-nav-item ${isActive("/login")}`}>
              <FaSignInAlt />
              <span>Login</span>
            </Link>
          </nav>
        </header>
      )}

      {/* Side Navigation - Shows as dropdown on mobile */}
      <aside 
        ref={navRef}
        className={`side-nav ${isOpen ? "open" : ""}`}
      >
        <div className="side-nav-content">
          <div className="side-nav-header">
            <h3>Menu</h3>
            <button 
              className="close-nav" 
              onClick={toggleMobileMenu}
              aria-label="Close menu"
            >
              <FaTimes />
            </button>
          </div>

          <ul className="side-nav-menu">
            <li>
              <Link to="/" className={isActive("/")} onClick={toggleMobileMenu}>
                <FaHome /> 
                <span>Home</span>
              </Link>
            </li>
            <li>
              <Link to="/cart" className={isActive("/cart")} onClick={toggleMobileMenu}>
                <FaShoppingCart /> 
                <span>Cart</span>
              </Link>
            </li>
            <li>
              <Link to="/list" className={isActive("/orders")} onClick={toggleMobileMenu}>
                <FaComment /> 
                <span>Orders</span>
              </Link>
            </li>
            <li>
              <Link to="/login" className={isActive("/login")} onClick={toggleMobileMenu}>
                <FaSignInAlt /> 
                <span>Login</span>
              </Link>
            </li>
            <li>
              <Link to="/signup" className={isActive("/signup")} onClick={toggleMobileMenu}>
                <FaUser /> 
                <span>Sign Up</span>
              </Link>
            </li>
            <li>
              <button 
                onClick={() => {
                  setShowLogoutModal(true);
                  toggleMobileMenu();
                }}
                className="logout-button"
              >
                <FaSignOutAlt /> 
                <span>Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
      
      {/* Overlay for mobile to close sidebar when clicking outside */}
      {isOpen && (
        <div 
          className="side-nav-overlay visible"
          onClick={toggleMobileMenu}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default Navbar;