import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { sellerSignup, reset } from '../../features/auth/authSlice';
import { toast } from 'react-toastify';
import Spinner from '../Spinner';
import futaLogo from '../../assets/futa-img-logo/logo.svg';

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

  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isLoading, isSuccess, isError, message } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isSuccess || user) {
      navigate("/seller-dashboard");
    }
    if (isError) {
      toast.error(message);
    }
    dispatch(reset());
  }, [user, isSuccess, isError, message, navigate, dispatch]);

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Request OTP via email
  const requestEmailOTP = async () => {
    if (!formData.email) {
      toast.error("Enter email address first!");
      return;
    }

    setIsRequestingOtp(true);
    
    try {
      const response = await fetch('http://localhost:3000/api/users/request-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setOtpSent(true);
        toast.success("OTP sent to your email!");
      } else {
        toast.error(data.message || "Failed to send OTP. Please try again.");
      }
    } catch (error) {
      console.error("Error requesting OTP:", error);
      toast.error("Failed to send OTP. Please check your connection and try again.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Verify OTP before form submission
  const verifyOTP = async () => {
    if (!formData.otp) {
      toast.error("Enter OTP first!");
      return;
    }

    setIsVerifyingOtp(true);
    
    try {
      // Add actual OTP verification API call here if needed
      // For now, just simulating verification
      setTimeout(() => {
        setOtpVerified(true);
        toast.success("OTP verified successfully. You can now submit the form.");
        setIsVerifyingOtp(false);
      }, 1000);
    } catch (error) {
      toast.error("Failed to verify OTP. Please try again.");
      setIsVerifyingOtp(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();

    if (!phone || phone.trim() === '') {
    toast.error('Phone number is required');
    return;
    }
    

    if (!otpSent) {
      toast.error("Request an OTP first!");
      return;
    }
    
    if (!formData.otp) {
      toast.error("Enter the OTP sent to your email!");
      return;
    }
    
    // Send the entire form data including OTP to the server
    dispatch(sellerSignup(formData));
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
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={password}
              placeholder="Enter password"
              onChange={onChange}
              required
            />
          </div>
          

          <div className='form-group'>
          <label htmlFor='phone'>Enter Phone Number</label>
          <input 
            type="text" 
            name="phone" 
            value={phone} 
            onChange={onChange} 
            placeholder="Phone Number" 
            className="signup-input" 
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

          {/* Request Email OTP Button */}
          {!otpSent && (
            <button 
              type="button" 
              onClick={requestEmailOTP} 
              className="auth-button"
              disabled={isRequestingOtp}
            >
              {isRequestingOtp ? "Sending OTP..." : "Send OTP"}
            </button>
          )}

          {/* OTP Input Field shown once OTP is sent */}
          {otpSent && (
            <>
              <div className="form-group">
                <label htmlFor="otp">OTP Verification</label>
                <input 
                  type="text" 
                  className="form-control"
                  id="otp"
                  name="otp" 
                  value={formData.otp} 
                  onChange={onChange} 
                  placeholder="Enter OTP from Email" 
                  required 
                />
              </div>
              
              {!otpVerified && (
                <button 
                  type="button" 
                  onClick={verifyOTP} 
                  className="auth-button"
                  disabled={isVerifyingOtp}
                >
                  {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                </button>
              )}
            </>
          )}
          
          <button 
            type="submit" 
            className="auth-button" 
            disabled={isLoading || !otpSent || !formData.otp || !otpVerified}
          >
            {isLoading ? "Signing Up as Seller..." : "Sign Up"}
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