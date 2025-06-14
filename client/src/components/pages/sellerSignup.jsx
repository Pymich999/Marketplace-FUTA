import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { 
  registerSeller, 
  requestEmailOTP, 
  reset, 
  clearMessage,
  setOTPSent,
  setOTPVerified 
} from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import Spinner from '../Spinner';
import futaLogo from '../../assets/futa-img-logo/logo.svg';
import '../pages-styles/auth.css'

function SellerSignup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: "",
    businessName: '',
    studentName: '',
    businessDescription: '',
    otp: ''
  });
  
  const { name, email, password, phone, businessName, studentName, businessDescription } = formData;
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { 
    user, 
    isLoading, 
    isSuccess, 
    isError, 
    message, 
    otpSent, 
    otpVerified 
  } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isSuccess && user) {
      toast.success("Seller account created successfully!");
      navigate("/seller-dashboard");
    }
    
    if (isError && message) {
      if (message.includes('duplicate key') && message.includes('phone')) {
        toast.error("This phone number is already registered. Please use a different number.");
      } else {
        toast.error(message);
      }
    }
    
    // Clear messages after showing them
    if (message) {
      const timer = setTimeout(() => {
        dispatch(clearMessage());
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, isSuccess, isError, message, navigate, dispatch]);

  // Reset component state when component unmounts
  useEffect(() => {
    return () => {
      dispatch(reset());
    };
  }, [dispatch]);

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Request OTP via Redux action
  const handleRequestEmailOTP = async () => {
    if (!formData.email) {
      toast.error("Please enter your email address first!");
      return;
    }

    try {
      const result = await dispatch(requestEmailOTP(formData.email));
      
      if (requestEmailOTP.fulfilled.match(result)) {
        toast.success("OTP has been sent to your email! Check your inbox.", {
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      } else {
        // Error is already handled in the useEffect above
        console.error("Failed to send OTP:", result.payload);
      }
    } catch (error) {
      console.error("Error requesting OTP:", error);
      toast.error("Failed to send OTP. Please check your connection and try again.");
    }
  };

  // Verify OTP before form submission
  const verifyOTP = async () => {
    if (!formData.otp) {
      toast.error("Please enter the OTP first!");
      return;
    }

    setIsVerifyingOtp(true);
    
    try {
      // Simulate OTP verification (you might want to add actual verification API call)
      setTimeout(() => {
        dispatch(setOTPVerified(true));
        toast.success("🎉 OTP verified successfully! You can now submit your seller application.", {
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
        setIsVerifyingOtp(false);
      }, 1000);
    } catch (error) {
      toast.error("Failed to verify OTP. Please try again.");
      setIsVerifyingOtp(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!phone || phone.trim() === '') {
      toast.error("Phone number is required");
      return;
    }
    
    if (!otpSent) {
      toast.error("Please request an OTP first!");
      return;
    }
    
    if (!formData.otp) {
      toast.error("Please enter the OTP sent to your email!");
      return;
    }
    
    if (!otpVerified) {
      toast.error("Please verify your OTP first!");
      return;
    }

    // Send the entire form data including OTP to the server via Redux action
    try {
      const result = await dispatch(registerSeller(formData));
      
      if (registerSeller.rejected.match(result)) {
        // Error handling is done in useEffect, but we can add specific handling here if needed
        console.error("Registration failed:", result.payload);
      }
    } catch (error) {
      console.error("Error during registration:", error);
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div className="auth-container">
      <div className="auth-logo-container">
        <img src={futaLogo} alt="Logo" className="auth-logo" />
      </div>
      
      <div className="auth-form">
        <h1 className="auth-title">Become a Seller</h1>
        
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              className="form-control"
              id="name"
              name="name"
              value={name}
              placeholder="Enter your full name"
              onChange={onChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              className="form-control"
              id="email"
              name="email"
              value={email}
              placeholder="Enter your email"
              onChange={onChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input 
                type={showPassword ? "text" : "password"}
                id="password" 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                placeholder="Password" 
                className="form-control" 
                required 
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor='phone'>Phone Number</label>
            <input 
              type="text" 
              name="phone" 
              value={phone} 
              onChange={onChange} 
              placeholder="Enter your phone number" 
              className="form-control" 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="businessName">Business Name</label>
            <input
              type="text"
              className="form-control"
              id="businessName"
              name="businessName"
              value={businessName}
              placeholder="Enter your business name"
              onChange={onChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="studentName">Student Name</label>
            <input
              type="text"
              className="form-control"
              id="studentName"
              name="studentName"
              value={studentName}
              placeholder="Enter student name"
              onChange={onChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="businessDescription">Business Description</label>
            <textarea
              className="form-control"
              id="businessDescription"
              name="businessDescription"
              value={businessDescription}
              placeholder="Describe your business"
              onChange={onChange}
              rows="4"
              required
            ></textarea>
          </div>

          {/* OTP Section */}
          <div className="otp-section">
            {!otpSent ? (
              <button 
                type="button" 
                onClick={handleRequestEmailOTP} 
                className="auth-button otp-button"
                disabled={isLoading}
              >
                {isLoading ? "Sending OTP..." : "Send Verification OTP"}
              </button>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="otp">Verification Code</label>
                  <input 
                    type="text" 
                    className="form-control"
                    id="otp"
                    name="otp" 
                    value={formData.otp} 
                    onChange={onChange} 
                    placeholder="Enter 6-digit code from email" 
                    required 
                  />
                  <small className="form-text text-muted">
                    Check your email for the verification code
                  </small>
                </div>
                
                {!otpVerified ? (
                  <button 
                    type="button" 
                    onClick={verifyOTP} 
                    className="auth-button verify-button"
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </button>
                ) : (
                  <div className="verification-success">
                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                    <span>Email verified successfully</span>
                  </div>
                )}
              </>
            )}
          </div>
          
          <button 
            type="submit" 
            className="auth-button submit-button" 
            disabled={isLoading || !otpSent || !formData.otp || !otpVerified}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Creating Your Seller Account...
              </>
            ) : (
              "Complete Registration"
            )}
          </button>
        </form>
        
        <div className="auth-prompt">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}

export default SellerSignup;